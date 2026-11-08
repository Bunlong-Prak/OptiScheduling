pub mod benchmark;
pub mod model;
pub mod solver;
pub mod time;
pub mod validator;

pub use model::*;
pub use solver::{solve, SolverError};
pub use validator::{check_manual_conflict, validate_schedule};

#[cfg(test)]
mod tests {
    use rand::rngs::SmallRng;
    use rand::{Rng, SeedableRng};

    use super::*;
    use crate::solver::state::{PreparedProblem, ScheduleState};

    fn base_slots() -> Vec<TimeSlotInput> {
        vec![8, 9, 10, 11, 13, 14, 15, 16]
            .into_iter()
            .enumerate()
            .map(|(i, h)| TimeSlotInput {
                id: Some((i + 1) as i64),
                start_time: format!("{h:02}:00"),
                end_time: format!("{:02}:00", h + 1),
            })
            .collect()
    }

    #[test]
    fn invariant_incremental_cost_matches_full_recompute() {
        let mut req = benchmark::generate_paragon_benchmark(45, 777);
        req.config.enforce_separate_days = false; // also exercise same_section_same_day incremental term
        let problem = PreparedProblem::build(&req).unwrap();
        let mut state = ScheduleState::new(&problem);
        assert_eq!(state.total_cost, state.recompute_full_cost());

        let mut rng = SmallRng::seed_from_u64(123456);
        let n = problem.units.len();

        for _step in 0..1500 {
            let u = rng.gen_range(0..n);
            if state.assignments[u].is_some() {
                let _ = state.unplace(u);
                assert_eq!(
                    state.total_cost,
                    state.recompute_full_cost(),
                    "Drift after unplace(unit={})",
                    u
                );
            } else {
                let nt = problem.units[u].time_options.len();
                let nr = problem.units[u].room_options.len();
                if nt > 0 && nr > 0 {
                    let ti = rng.gen_range(0..nt);
                    let ri = rng.gen_range(0..nr);
                    let to = &problem.units[u].time_options[ti];
                    let ro = &problem.units[u].room_options[ri];
                    let mask = problem.combo_for(&problem.units[u], to.combo_idx).mask;
                    if state.can_place_time_hard(u, to) && state.can_place_room_hard(u, to.day, mask, ro) {
                        state.place(u, ti, ri);
                        assert_eq!(
                            state.total_cost,
                            state.recompute_full_cost(),
                            "Drift after place(unit={})",
                            u
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn enforces_split_section_units_on_different_days() {
        let req = ScheduleRequest {
            schedule_id: Some(1),
            time_slots: base_slots(),
            classrooms: vec![ClassroomInput {
                id: 1,
                code: "R101".into(),
                name: None,
                capacity: 40,
                classroom_type_id: 1,
                location: Some("Main".into()),
            }],
            instructors: vec![InstructorInput {
                id: 1,
                first_name: "Sok".into(),
                last_name: "Dara".into(),
                name: None,
                is_part_time: Some(false),
            }],
            time_constraints: vec![],
            preferred_slots: vec![],
            courses: vec![CourseInput {
                id: 1,
                title: "Algorithms".into(),
                code: "CS201".into(),
                color: None,
                capacity: 30,
                duration: 3.0,
                major_id: Some(1),
                major_name: Some("CS Year 2".into()),
                year: Some(2),
                sections: vec![SectionInput {
                    id: 10,
                    number: "S1".into(),
                    instructor_id: Some(1),
                    status: Some("offline".into()),
                    is_online: Some(false),
                    year: Some(2),
                    units: vec![
                        UnitInput {
                            course_hours_id: Some(101),
                            duration: 1.0,
                            prefer_classroom_type_id: None,
                            prefer_classroom_id: None,
                            locked: None,
                        },
                        UnitInput {
                            course_hours_id: Some(102),
                            duration: 1.0,
                            prefer_classroom_type_id: None,
                            prefer_classroom_id: None,
                            locked: None,
                        },
                        UnitInput {
                            course_hours_id: Some(103),
                            duration: 1.0,
                            prefer_classroom_type_id: None,
                            prefer_classroom_id: None,
                            locked: None,
                        },
                    ],
                }],
            }],
            config: SolverConfig {
                strategy: SolverStrategy::Hybrid,
                time_budget_ms: 40,
                ..Default::default()
            },
        };

        let resp = solve(&req).unwrap();
        assert!(resp.success);
        assert_eq!(resp.assignments.len(), 3);
        let mut days: Vec<&str> = resp.assignments.iter().map(|a| a.day.as_str()).collect();
        days.sort();
        days.dedup();
        assert_eq!(days.len(), 3, "All 3 units of section 10 must be on 3 distinct days");
        assert_eq!(resp.metrics.breakdown.same_section_same_day_violations, 0);
    }

    #[test]
    fn enforces_online_offline_proximity_avoidance() {
        // Two courses on same single day for same instructor: 1 online, 1 offline.
        // Slots available: 08:00-09:00, 09:00-10:00, 10:00-11:00.
        // Optimal must choose 08:00-09:00 and 10:00-11:00 (gap=60 min) instead of 08:00-09:00 & 09:00-10:00 (gap=0 min)!
        let req = ScheduleRequest {
            schedule_id: Some(1),
            time_slots: vec![
                TimeSlotInput { id: Some(1), start_time: "08:00".into(), end_time: "09:00".into() },
                TimeSlotInput { id: Some(2), start_time: "09:00".into(), end_time: "10:00".into() },
                TimeSlotInput { id: Some(3), start_time: "10:00".into(), end_time: "11:00".into() },
            ],
            classrooms: vec![ClassroomInput {
                id: 1,
                code: "MB-101".into(),
                name: None,
                capacity: 40,
                classroom_type_id: 1,
                location: None,
            }],
            instructors: vec![InstructorInput {
                id: 1,
                first_name: "Chan".into(),
                last_name: "Vannak".into(),
                name: None,
                is_part_time: Some(false),
            }],
            time_constraints: vec![],
            preferred_slots: vec![],
            courses: vec![
                CourseInput {
                    id: 1,
                    title: "Offline Course".into(),
                    code: "CS101".into(),
                    color: None,
                    capacity: 30,
                    duration: 1.0,
                    major_id: Some(1),
                    major_name: Some("CS Year 1".into()),
                    year: Some(1),
                    sections: vec![SectionInput {
                        id: 1,
                        number: "S1".into(),
                        instructor_id: Some(1),
                        status: Some("offline".into()),
                        is_online: Some(false),
                        year: Some(1),
                        units: vec![],
                    }],
                },
                CourseInput {
                    id: 2,
                    title: "Online Course".into(),
                    code: "CS102".into(),
                    color: None,
                    capacity: 30,
                    duration: 1.0,
                    major_id: Some(1),
                    major_name: Some("CS Year 1".into()),
                    year: Some(1),
                    sections: vec![SectionInput {
                        id: 2,
                        number: "S1".into(),
                        instructor_id: Some(1),
                        status: Some("online".into()),
                        is_online: Some(true),
                        year: Some(1),
                        units: vec![],
                    }],
                },
            ],
            config: SolverConfig {
                strategy: SolverStrategy::Hybrid,
                time_budget_ms: 40,
                days: vec!["Monday".into()],
                min_online_offline_gap_minutes: 60,
                ..Default::default()
            },
        };

        let resp = solve(&req).unwrap();
        assert!(resp.success);
        assert_eq!(resp.assignments.len(), 2);
        assert_eq!(
            resp.metrics.breakdown.online_offline_proximity_violations, 0,
            "Online & offline classes on same day should maintain >= 60 min buffer"
        );
    }

    #[test]
    fn unbounded_online_sections_exceeding_three_simultaneously() {
        // Old system hardcoded [-1, -2, -3] capped concurrent online classes at 3.
        // Rust engine allows 10 concurrent online courses simultaneously!
        let mut courses = Vec::new();
        let mut instructors = Vec::new();
        for i in 1..=10 {
            instructors.push(InstructorInput {
                id: i,
                first_name: "Online".into(),
                last_name: format!("Prof{i}"),
                name: None,
                is_part_time: Some(false),
            });
            courses.push(CourseInput {
                id: i,
                title: format!("Online Course {i}"),
                code: format!("ONL{i:02}"),
                color: None,
                capacity: 50,
                duration: 1.0,
                major_id: None,
                major_name: None,
                year: None,
                sections: vec![SectionInput {
                    id: i,
                    number: "S1".into(),
                    instructor_id: Some(i),
                    status: Some("online".into()),
                    is_online: Some(true),
                    year: None,
                    units: vec![],
                }],
            });
        }

        let req = ScheduleRequest {
            schedule_id: Some(1),
            time_slots: vec![TimeSlotInput {
                id: Some(1),
                start_time: "08:00".into(),
                end_time: "09:00".into(),
            }],
            classrooms: vec![], // Zero physical rooms needed!
            instructors,
            time_constraints: vec![],
            preferred_slots: vec![],
            courses,
            config: SolverConfig {
                strategy: SolverStrategy::GreedyRepair,
                days: vec!["Monday".into()],
                ..Default::default()
            },
        };

        let resp = solve(&req).unwrap();
        assert!(resp.success);
        assert_eq!(resp.assignments.len(), 10);
        assert!(resp.assignments.iter().all(|a| a.is_online && a.classroom_code == "Online"));
    }

    #[test]
    fn respects_classroom_type_and_building_continuity() {
        let req = ScheduleRequest {
            schedule_id: Some(1),
            time_slots: vec![
                TimeSlotInput { id: Some(1), start_time: "08:00".into(), end_time: "09:00".into() },
                TimeSlotInput { id: Some(2), start_time: "09:00".into(), end_time: "10:00".into() },
            ],
            classrooms: vec![
                ClassroomInput {
                    id: 10,
                    code: "MB-101".into(),
                    name: None,
                    capacity: 40,
                    classroom_type_id: 1, // Lecture
                    location: Some("Main Building".into()),
                },
                ClassroomInput {
                    id: 20,
                    code: "EW-101".into(),
                    name: None,
                    capacity: 40,
                    classroom_type_id: 1, // Lecture
                    location: Some("Engineering Wing".into()),
                },
                ClassroomInput {
                    id: 30,
                    code: "EW-LAB".into(),
                    name: None,
                    capacity: 40,
                    classroom_type_id: 2, // Lab
                    location: Some("Engineering Wing".into()),
                },
            ],
            instructors: vec![InstructorInput {
                id: 1,
                first_name: "Kim".into(),
                last_name: "Sovann".into(),
                name: None,
                is_part_time: Some(false),
            }],
            time_constraints: vec![],
            preferred_slots: vec![],
            courses: vec![
                CourseInput {
                    id: 1,
                    title: "Lab Class".into(),
                    code: "CS301".into(),
                    color: None,
                    capacity: 30,
                    duration: 1.0,
                    major_id: None,
                    major_name: None,
                    year: None,
                    sections: vec![SectionInput {
                        id: 1,
                        number: "S1".into(),
                        instructor_id: Some(1),
                        status: Some("offline".into()),
                        is_online: Some(false),
                        year: None,
                        units: vec![UnitInput {
                            course_hours_id: Some(1),
                            duration: 1.0,
                            prefer_classroom_type_id: Some(2), // Specifically wants Lab type!
                            prefer_classroom_id: None,
                            locked: None,
                        }],
                    }],
                },
                CourseInput {
                    id: 2,
                    title: "Lecture Class".into(),
                    code: "CS302".into(),
                    color: None,
                    capacity: 30,
                    duration: 1.0,
                    major_id: None,
                    major_name: None,
                    year: None,
                    sections: vec![SectionInput {
                        id: 2,
                        number: "S1".into(),
                        instructor_id: Some(1),
                        status: Some("offline".into()),
                        is_online: Some(false),
                        year: None,
                        units: vec![UnitInput {
                            course_hours_id: Some(2),
                            duration: 1.0,
                            prefer_classroom_type_id: Some(1), // Lecture
                            prefer_classroom_id: None,
                            locked: None,
                        }],
                    }],
                },
            ],
            config: SolverConfig {
                strategy: SolverStrategy::Hybrid,
                time_budget_ms: 40,
                days: vec!["Monday".into()],
                ..Default::default()
            },
        };

        let resp = solve(&req).unwrap();
        assert!(resp.success);
        let lab = resp.assignments.iter().find(|a| a.course_code == "CS301").unwrap();
        let lec = resp.assignments.iter().find(|a| a.course_code == "CS302").unwrap();
        assert_eq!(lab.classroom_code, "EW-LAB");
        // For lecture, picking EW-101 avoids switching from Engineering Wing to Main Building!
        assert_eq!(lec.classroom_code, "EW-101");
        assert_eq!(resp.metrics.breakdown.building_switches, 0);
    }

    #[test]
    fn ejection_chain_solves_blocked_puzzle() {
        // Classic greedy trap on 1 day, 2 time slots, 2 rooms:
        // Unit A (room_opt=R1, inst 1, flexible slots 08-09 or 09-10)
        // Unit B (inst 2, only slot 08-09, any room)
        // Even if Unit A takes 08-09 in R1 when no R2 existed, here say:
        // Only 1 room R1! Unit A can only be 08-09 or 09-10. Unit C has 08-09 or 09-10.
        // Force Unit C into 08-09 (preferred!) via Unit A preference 08-09 -> Unit B only allowed 08-09 (online or separate room).
        // Let's construct a hard 1-room permutation puzzle where:
        // Slot 1: 08:00-09:00, Slot 2: 09:00-10:00, Room 1 only!
        // Course 1 (Inst 1): wants Slot 1 first (static cost smaller -> tiebreak puts earlier slot!), or Slot 2.
        // Course 2 (Inst 2): blocked at Slot 2 -> MUST use Slot 1!
        // Even if ordered poorly (e.g. Backtracking / Ejection), both must be placed!
        let req = ScheduleRequest {
            schedule_id: Some(1),
            time_slots: vec![
                TimeSlotInput { id: Some(1), start_time: "08:00".into(), end_time: "09:00".into() },
                TimeSlotInput { id: Some(2), start_time: "09:00".into(), end_time: "10:00".into() },
            ],
            classrooms: vec![ClassroomInput {
                id: 1,
                code: "R1".into(),
                name: None,
                capacity: 30,
                classroom_type_id: 1,
                location: None,
            }],
            instructors: vec![
                InstructorInput { id: 1, first_name: "A".into(), last_name: "Flex".into(), name: None, is_part_time: Some(false) },
                InstructorInput { id: 2, first_name: "B".into(), last_name: "Tight".into(), name: None, is_part_time: Some(false) },
            ],
            time_constraints: vec![TimeConstraintInput {
                instructor_id: 2,
                day: "Monday".into(),
                time_slots: vec!["09:00-10:00".into()],
            }],
            preferred_slots: vec![],
            courses: vec![
                CourseInput {
                    id: 1,
                    title: "Flex".into(),
                    code: "FLX1".into(),
                    color: None,
                    capacity: 20,
                    duration: 1.0,
                    major_id: None,
                    major_name: None,
                    year: None,
                    sections: vec![SectionInput {
                        id: 1,
                        number: "S1".into(),
                        instructor_id: Some(1),
                        status: Some("offline".into()),
                        is_online: Some(false),
                        year: None,
                        units: vec![],
                    }],
                },
                CourseInput {
                    id: 2,
                    title: "Tight".into(),
                    code: "TGT1".into(),
                    color: None,
                    capacity: 20,
                    duration: 1.0,
                    major_id: None,
                    major_name: None,
                    year: None,
                    sections: vec![SectionInput {
                        id: 2,
                        number: "S1".into(),
                        instructor_id: Some(2),
                        status: Some("offline".into()),
                        is_online: Some(false),
                        year: None,
                        units: vec![],
                    }],
                },
            ],
            config: SolverConfig {
                strategy: SolverStrategy::Backtracking,
                time_budget_ms: 40,
                days: vec!["Monday".into()],
                prioritize_part_time: true,
                ..Default::default()
            },
        };

        let resp = solve(&req).unwrap();
        assert!(resp.success);
        assert_eq!(resp.assignments.len(), 2);
        let tight = resp.assignments.iter().find(|a| a.course_code == "TGT1").unwrap();
        assert_eq!(tight.start_time, "08:00");
    }

    #[test]
    fn validator_detects_room_instructor_and_soft_proximity_conflicts() {
        let existing = vec![
            ExistingAssignmentInput {
                course_hours_id: Some(1),
                section_id: 10,
                course_id: 1,
                course_code: "CS101".into(),
                course_title: "Intro".into(),
                section_number: "S1".into(),
                capacity: 30,
                major_id: Some(1),
                major_name: Some("CS Year 1".into()),
                year: Some(1),
                instructor_id: Some(1),
                instructor_name: Some("Prof A".into()),
                is_online: false,
                day: "Monday".into(),
                start_time: "08:00".into(),
                end_time: "09:00".into(),
                classroom_id: Some(5),
                classroom_code: Some("MB-101".into()),
                classroom_location: Some("Main Building".into()),
            },
        ];

        // 1. Editing SAME unit (course_hours_id=1) should NOT conflict with itself!
        let self_edit = check_manual_conflict(&ConflictCheckRequest {
            candidate: existing[0].clone(),
            existing_assignments: existing.clone(),
            classrooms: vec![],
            time_constraints: vec![],
            config: SolverConfig::default(),
        });
        assert!(self_edit.is_valid);

        // 2. Same instructor switching to online immediately at 09:00-10:00 triggers proximity warning
        let mut online_adj = existing[0].clone();
        online_adj.course_hours_id = Some(2);
        online_adj.section_id = 11;
        online_adj.course_id = 2;
        online_adj.course_code = "CS102".into();
        online_adj.is_online = true;
        online_adj.start_time = "09:00".into();
        online_adj.end_time = "10:00".into();
        online_adj.classroom_id = None;
        online_adj.classroom_code = Some("Online".into());
        online_adj.classroom_location = None;

        let res_warn = check_manual_conflict(&ConflictCheckRequest {
            candidate: online_adj,
            existing_assignments: existing.clone(),
            classrooms: vec![],
            time_constraints: vec![],
            config: SolverConfig::default(),
        });
        assert!(res_warn.is_valid);
        assert!(res_warn
            .soft_warnings
            .iter()
            .any(|w| w.kind == "ONLINE_OFFLINE_PROXIMITY"));

        // 3. Different course trying same room & overlapping time -> hard ROOM_CONFLICT
        let mut room_clash = existing[0].clone();
        room_clash.course_hours_id = Some(3);
        room_clash.section_id = 12;
        room_clash.course_id = 3;
        room_clash.course_code = "CS103".into();
        room_clash.instructor_id = Some(2);
        room_clash.instructor_name = Some("Prof B".into());

        let res_err = check_manual_conflict(&ConflictCheckRequest {
            candidate: room_clash,
            existing_assignments: existing,
            classrooms: vec![],
            time_constraints: vec![],
            config: SolverConfig::default(),
        });
        assert!(!res_err.is_valid);
        assert!(res_err.hard_conflicts.iter().any(|c| c.kind == "ROOM_CONFLICT"));
    }

    #[test]
    fn paragon_scale_benchmark_schedules_cleanly_under_budget() {
        let mut req = benchmark::generate_paragon_benchmark(120, 20250722);
        req.config.strategy = SolverStrategy::Hybrid;
        req.config.time_budget_ms = 120;
        let resp = solve(&req).unwrap();
        assert!(
            resp.stats.scheduled_assignments == resp.stats.total_units,
            "Expected all {} Paragon benchmark units scheduled, failed: {:?}",
            resp.stats.total_units,
            resp.errors
        );
        assert_eq!(resp.metrics.hard_violations, 0);
        // Validate full output independently using validator
        let existing_like: Vec<ExistingAssignmentInput> = resp
            .assignments
            .iter()
            .map(|a| ExistingAssignmentInput {
                course_hours_id: a.course_hours_id,
                section_id: a.section_id,
                course_id: a.course_id,
                course_code: a.course_code.clone(),
                course_title: a.course_title.clone(),
                section_number: a.section_number.clone(),
                capacity: 0,
                major_id: None,
                major_name: None,
                year: None,
                instructor_id: Some(a.instructor_id),
                instructor_name: Some(a.instructor_name.clone()),
                is_online: a.is_online,
                day: a.day.clone(),
                start_time: a.start_time.clone(),
                end_time: a.end_time.clone(),
                classroom_id: if a.classroom_id > 0 { Some(a.classroom_id) } else { None },
                classroom_code: Some(a.classroom_code.clone()),
                classroom_location: a.classroom_location.clone(),
            })
            .collect();

        let vreport = validate_schedule(&ValidateScheduleRequest {
            assignments: existing_like,
            classrooms: req.classrooms,
            time_constraints: req.time_constraints,
            time_slots: req.time_slots,
            config: req.config,
        });
        assert!(
            vreport.is_valid,
            "Independent validator found hard conflicts: {:?}",
            vreport.hard_conflicts
        );
    }
}
