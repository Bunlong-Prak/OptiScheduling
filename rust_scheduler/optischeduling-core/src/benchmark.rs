use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use serde::Serialize;

use crate::model::{
    ClassroomInput, CourseInput, InstructorInput, ScheduleRequest, ScheduleResponse, SectionInput,
    SolverConfig, SolverStrategy, TimeConstraintInput, TimeSlotInput, UnitInput, DEFAULT_DAYS,
};
use crate::solver::solve;

#[derive(Debug, Clone, Serialize)]
pub struct BenchmarkEntry {
    pub strategy: SolverStrategy,
    pub total_units: usize,
    pub scheduled_units: usize,
    pub failed_units: usize,
    pub solve_time_ms: f64,
    pub objective_score: i64,
    pub ejection_repairs: usize,
    pub annealing_iterations: u64,
    pub threads_used: usize,
    pub same_section_same_day_violations: usize,
    pub online_offline_proximity_violations: usize,
    pub building_switches: usize,
    pub cohort_overlap_slots: usize,
    pub classroom_type_mismatches: usize,
}

/// Generates a realistic Paragon International University timetabling dataset:
/// - 103 instructors (67% part-time with realistic availability blackouts)
/// - Multi-building campus ("Main Building", "Engineering Wing")
/// - Mix of Lecture Halls, Standard Rooms, Computer Labs (type IDs 1, 2, 3)
/// - Mix of online (~22%) and offline sections with split course_hours
pub fn generate_paragon_benchmark(num_sections: usize, seed: u64) -> ScheduleRequest {
    let mut rng = SmallRng::seed_from_u64(seed);

    // 11 standard hourly time slots from 08:00 to 20:00 (excluding 12:00-13:00 lunch gap for realism)
    let slot_hours = [8u16, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19];
    let time_slots: Vec<TimeSlotInput> = slot_hours
        .iter()
        .enumerate()
        .map(|(i, &h)| TimeSlotInput {
            id: Some((i + 1) as i64),
            start_time: format!("{h:02}:00"),
            end_time: format!("{:02}:00", h + 1),
        })
        .collect();

    // Classrooms across 2 buildings and 3 types (1=Lecture, 2=Lab, 3=Seminar)
    let mut classrooms = Vec::new();
    let specs = [
        ("MB-101", 1, 80, "Main Building"),
        ("MB-102", 1, 80, "Main Building"),
        ("MB-201", 1, 45, "Main Building"),
        ("MB-202", 1, 45, "Main Building"),
        ("MB-203", 1, 45, "Main Building"),
        ("MB-204", 3, 30, "Main Building"),
        ("MB-301", 2, 35, "Main Building"),
        ("MB-302", 2, 35, "Main Building"),
        ("EW-101", 1, 60, "Engineering Wing"),
        ("EW-102", 1, 45, "Engineering Wing"),
        ("EW-201", 2, 35, "Engineering Wing"),
        ("EW-202", 2, 35, "Engineering Wing"),
        ("EW-301", 3, 30, "Engineering Wing"),
        ("EW-302", 3, 25, "Engineering Wing"),
        ("MB-401", 1, 100, "Main Building"),
        ("EW-401", 1, 40, "Engineering Wing"),
    ];
    for (idx, &(code, rtype, cap, loc)) in specs.iter().enumerate() {
        classrooms.push(ClassroomInput {
            id: (idx + 1) as i64,
            code: code.to_string(),
            name: Some(format!("Room {code}")),
            capacity: cap,
            classroom_type_id: rtype,
            location: Some(loc.to_string()),
        });
    }

    // 103 instructors (69 part-time ~67%, 34 full-time ~33%) matching Thesis Table 3
    let total_instructors = 103usize;
    let num_part_time = 69usize;
    let mut instructors = Vec::with_capacity(total_instructors);
    let mut time_constraints = Vec::new();
    let mut preferred_slots = Vec::new();

    for idx in 0..total_instructors {
        let id = (idx + 1) as i64;
        let is_pt = idx < num_part_time;
        instructors.push(InstructorInput {
            id,
            first_name: if is_pt { "PT".into() } else { "FT".into() },
            last_name: format!("Lecturer{id}"),
            name: None,
            is_part_time: Some(is_pt),
        });

        if is_pt {
            // Part-time lecturers are blocked during daytime on 2-3 days or morning/afternoon blocks
            let mode = idx % 3;
            for (d_idx, day) in DEFAULT_DAYS.iter().enumerate() {
                if mode == 0 && (d_idx == 0 || d_idx == 2 || d_idx == 4) {
                    // Available mainly evenings + Tue/Thu/Sat
                    let blocked: Vec<String> = slot_hours[..6]
                        .iter()
                        .map(|h| format!("{h:02}:00-{:02}:00", h + 1))
                        .collect();
                    time_constraints.push(TimeConstraintInput {
                        instructor_id: id,
                        day: (*day).to_string(),
                        time_slots: blocked,
                    });
                } else if mode == 1 && d_idx >= 3 {
                    // Busy Thu-Sat afternoons
                    let blocked: Vec<String> = slot_hours[4..]
                        .iter()
                        .map(|h| format!("{h:02}:00-{:02}:00", h + 1))
                        .collect();
                    time_constraints.push(TimeConstraintInput {
                        instructor_id: id,
                        day: (*day).to_string(),
                        time_slots: blocked,
                    });
                } else if mode == 2 && d_idx % 2 == 1 {
                    let blocked: Vec<String> = slot_hours[..5]
                        .iter()
                        .map(|h| format!("{h:02}:00-{:02}:00", h + 1))
                        .collect();
                    time_constraints.push(TimeConstraintInput {
                        instructor_id: id,
                        day: (*day).to_string(),
                        time_slots: blocked,
                    });
                }

                // Evening/preferred window for part-time
                if (idx + d_idx) % 2 == 0 {
                    let pref: Vec<String> = slot_hours[5..]
                        .iter()
                        .map(|h| format!("{h:02}:00-{:02}:00", h + 1))
                        .collect();
                    preferred_slots.push(TimeConstraintInput {
                        instructor_id: id,
                        day: (*day).to_string(),
                        time_slots: pref,
                    });
                }
            }
        }
    }

    let majors = [
        (1, "Computer Science"),
        (2, "Management Information Systems"),
        (3, "Business Administration"),
        (4, "Digital Arts and Design"),
    ];

    let mut courses = Vec::new();
    let mut unit_id_counter = 1i64;
    let mut section_id_counter = 1i64;
    let mut sec_created = 0usize;
    let mut course_idx = 0usize;

    while sec_created < num_sections {
        course_idx += 1;
        let (maj_id, maj_name) = majors[(course_idx - 1) % majors.len()];
        let year = (((course_idx - 1) / majors.len()) % 4 + 1) as u16;
        let is_lab_course = course_idx.is_multiple_of(3);
        let prefer_type = if is_lab_course {
            2
        } else if course_idx.is_multiple_of(5) {
            3
        } else {
            1
        };
        let capacity = if is_lab_course {
            30
        } else if course_idx.is_multiple_of(7) {
            55
        } else {
            35
        };

        let secs_in_course = if sec_created + 2 <= num_sections && rng.gen_bool(0.45) {
            2
        } else {
            1
        };

        let mut sections = Vec::with_capacity(secs_in_course);
        for s_offset in 0..secs_in_course {
            sec_created += 1;
            let s_id = section_id_counter;
            section_id_counter += 1;
            let inst_id =
                (((sec_created * 7 + rng.gen_range(0..5)) % total_instructors) + 1) as i64;
            let is_online = sec_created.is_multiple_of(5);

            // Split course hours (2.0 + 1.0 or 1.0 + 1.0 + 1.0 or 2.0 + 2.0)
            let split_durations: &[f64] = match sec_created % 3 {
                0 => &[2.0, 1.0],
                1 => &[1.0, 1.0, 1.0],
                _ => &[2.0, 2.0],
            };

            let mut units = Vec::with_capacity(split_durations.len());
            for &d in split_durations {
                let ch_id = unit_id_counter;
                unit_id_counter += 1;
                units.push(UnitInput {
                    course_hours_id: Some(ch_id),
                    duration: d,
                    prefer_classroom_type_id: Some(prefer_type),
                    prefer_classroom_id: None,
                    locked: None,
                });
            }

            sections.push(SectionInput {
                id: s_id,
                number: format!("S{}-{}", year, s_offset + 1),
                instructor_id: Some(inst_id),
                status: Some(if is_online { "online" } else { "offline" }.to_string()),
                is_online: Some(is_online),
                year: Some(year),
                units,
            });
        }

        courses.push(CourseInput {
            id: course_idx as i64,
            title: format!("{maj_name} Course {course_idx}"),
            code: format!("CS{}{:02}", year, course_idx % 100),
            color: Some("#3B82F6".into()),
            capacity,
            duration: 3.0,
            major_id: Some(maj_id),
            major_name: Some(format!("{maj_name} Year {year}")),
            year: Some(year),
            sections,
        });
    }

    ScheduleRequest {
        schedule_id: Some(1),
        time_slots,
        classrooms,
        instructors,
        time_constraints,
        preferred_slots,
        courses,
        config: SolverConfig::default(),
    }
}

pub fn benchmark_strategies(num_sections: usize, time_budget_ms: u64) -> Vec<BenchmarkEntry> {
    let base_req = generate_paragon_benchmark(num_sections, 20250722);
    let strategies = [
        SolverStrategy::GreedyRepair,
        SolverStrategy::Hybrid,
        SolverStrategy::SimulatedAnnealing,
    ];

    let mut out = Vec::with_capacity(strategies.len());
    for strat in strategies {
        let mut req = base_req.clone();
        req.config.strategy = strat;
        req.config.time_budget_ms = time_budget_ms;
        if let Ok(resp) = solve(&req) {
            out.push(entry_from_response(&resp));
        }
    }
    out
}

fn entry_from_response(resp: &ScheduleResponse) -> BenchmarkEntry {
    let m = &resp.metrics;
    let b = &m.breakdown;
    BenchmarkEntry {
        strategy: m.strategy,
        total_units: resp.stats.total_units,
        scheduled_units: resp.stats.scheduled_assignments,
        failed_units: resp.stats.failed_assignments,
        solve_time_ms: m.solve_time_ms,
        objective_score: m.objective_score,
        ejection_repairs: m.ejection_repairs,
        annealing_iterations: m.annealing_iterations,
        threads_used: m.threads_used,
        same_section_same_day_violations: b.same_section_same_day_violations,
        online_offline_proximity_violations: b.online_offline_proximity_violations,
        building_switches: b.building_switches,
        cohort_overlap_slots: b.cohort_overlap_slots,
        classroom_type_mismatches: b.classroom_type_mismatches,
    }
}
