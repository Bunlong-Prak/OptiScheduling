use std::collections::{BTreeSet, HashMap};
use std::time::Instant;

use crate::model::{
    ConflictCheckRequest, ConflictCheckResult, ConflictItem, ExistingAssignmentInput,
    ObjectiveBreakdown, ValidateScheduleRequest, ValidationReport,
};
use crate::solver::state::interval_gap;
use crate::time::{intervals_overlap, parse_hhmm_minutes, parse_time_range};

#[derive(Debug, Clone)]
struct ParsedAssignment<'a> {
    raw: &'a ExistingAssignmentInput,
    day_norm: String,
    start_min: u16,
    end_min: u16,
    cohort_key: Option<(String, u16)>,
    building: Option<String>,
}

pub fn check_manual_conflict(req: &ConflictCheckRequest) -> ConflictCheckResult {
    let t0 = Instant::now();
    let mut hard_conflicts = Vec::new();
    let mut soft_warnings = Vec::new();

    let Some(cand) = parse_assignment(&req.candidate, &req.classrooms) else {
        hard_conflicts.push(ConflictItem {
            severity: "error".into(),
            kind: "INVALID_TIME".into(),
            message: format!(
                "Invalid assignment time range {}-{}",
                req.candidate.start_time, req.candidate.end_time
            ),
            conflicting_course_code: None,
            conflicting_section_id: None,
        });
        return ConflictCheckResult {
            is_valid: false,
            hard_conflicts,
            soft_warnings,
            check_time_us: t0.elapsed().as_secs_f64() * 1_000_000.0,
        };
    };

    // 1. Capacity check
    if !cand.raw.is_online && cand.raw.capacity > 0 {
        if let Some(cid) = cand.raw.classroom_id.filter(|&x| x > 0) {
            if let Some(room) = req.classrooms.iter().find(|r| r.id == cid) {
                if room.capacity < cand.raw.capacity {
                    hard_conflicts.push(ConflictItem {
                        severity: "error".into(),
                        kind: "CAPACITY_EXCEEDED".into(),
                        message: format!(
                            "Room {} capacity ({}) is smaller than required ({})",
                            room.code, room.capacity, cand.raw.capacity
                        ),
                        conflicting_course_code: None,
                        conflicting_section_id: None,
                    });
                }
            }
        }
    }

    // 2. Instructor unavailability check
    if let Some(inst_id) = cand.raw.instructor_id.filter(|&x| x > 0) {
        for tc in &req.time_constraints {
            if tc.instructor_id != inst_id || !days_match(&tc.day, &cand.day_norm) {
                continue;
            }
            for slot_str in &tc.time_slots {
                let overlaps = if let Ok((cs, ce)) = parse_time_range(slot_str) {
                    intervals_overlap(cand.start_min, cand.end_min, cs, ce)
                } else if let Ok(pt) = parse_hhmm_minutes(slot_str) {
                    pt >= cand.start_min && pt < cand.end_min
                } else {
                    false
                };
                if overlaps {
                    hard_conflicts.push(ConflictItem {
                        severity: "error".into(),
                        kind: "INSTRUCTOR_UNAVAILABLE".into(),
                        message: format!(
                            "Instructor is unavailable on {} during {} ({})",
                            cand.raw.day, slot_str, cand.raw.course_code
                        ),
                        conflicting_course_code: None,
                        conflicting_section_id: None,
                    });
                    break;
                }
            }
        }
    }

    // 3. Pairwise checks against existing assignments on same day (skip self if editing same course_hours_id)
    let mut inst_day_items: Vec<ParsedAssignment<'_>> = Vec::new();
    for ex_raw in &req.existing_assignments {
        if is_same_unit(cand.raw, ex_raw) {
            continue;
        }
        let Some(ex) = parse_assignment(ex_raw, &req.classrooms) else {
            continue;
        };
        if !days_match(&ex.day_norm, &cand.day_norm) {
            continue;
        }

        let overlaps = intervals_overlap(cand.start_min, cand.end_min, ex.start_min, ex.end_min);

        // Same room conflict
        if overlaps && !cand.raw.is_online && !ex.raw.is_online && same_room(cand.raw, ex.raw) {
            hard_conflicts.push(ConflictItem {
                severity: "error".into(),
                kind: "ROOM_CONFLICT".into(),
                message: format!(
                    "Classroom {} is already booked by {} ({}-{})",
                    ex.raw.classroom_code.as_deref().unwrap_or("room"),
                    ex.raw.course_code,
                    ex.raw.start_time,
                    ex.raw.end_time
                ),
                conflicting_course_code: Some(ex.raw.course_code.clone()),
                conflicting_section_id: Some(ex.raw.section_id),
            });
        }

        // Instructor double-booking
        let same_inst = same_instructor(cand.raw, ex.raw);
        if same_inst {
            inst_day_items.push(ex.clone());
            if overlaps {
                hard_conflicts.push(ConflictItem {
                    severity: "error".into(),
                    kind: "INSTRUCTOR_CONFLICT".into(),
                    message: format!(
                        "Instructor {} is already teaching {} ({}-{})",
                        ex.raw.instructor_name.as_deref().unwrap_or("assigned instructor"),
                        ex.raw.course_code,
                        ex.raw.start_time,
                        ex.raw.end_time
                    ),
                    conflicting_course_code: Some(ex.raw.course_code.clone()),
                    conflicting_section_id: Some(ex.raw.section_id),
                });
            }
        }

        // Same section same day check
        if ex.raw.section_id == cand.raw.section_id {
            let item = ConflictItem {
                severity: if req.config.enforce_separate_days {
                    "error".into()
                } else {
                    "warning".into()
                },
                kind: "SAME_SECTION_SAME_DAY".into(),
                message: format!(
                    "Section {} ({}) already has another session scheduled on {}",
                    cand.raw.section_number, cand.raw.course_code, cand.raw.day
                ),
                conflicting_course_code: Some(ex.raw.course_code.clone()),
                conflicting_section_id: Some(ex.raw.section_id),
            };
            if req.config.enforce_separate_days {
                hard_conflicts.push(item);
            } else {
                soft_warnings.push(item);
            }
        }

        // Online/offline proximity (for same instructor OR same cohort)
        let same_cohort = cand.cohort_key.is_some()
            && ex.cohort_key == cand.cohort_key
            && cand.raw.course_id != ex.raw.course_id;
        if (same_inst || same_cohort) && cand.raw.is_online != ex.raw.is_online {
            let gap = interval_gap(cand.start_min, cand.end_min, ex.start_min, ex.end_min);
            if gap < req.config.min_online_offline_gap_minutes {
                let target = if same_inst { "instructor" } else { "student cohort" };
                let item = ConflictItem {
                    severity: if req.config.enforce_online_offline_gap {
                        "error".into()
                    } else {
                        "warning".into()
                    },
                    kind: "ONLINE_OFFLINE_PROXIMITY".into(),
                    message: format!(
                        "Online/offline class {} is only {} min from {} class {} on {} for same {}",
                        if cand.raw.is_online { "(online)" } else { "(offline)" },
                        gap,
                        if ex.raw.is_online { "online" } else { "offline" },
                        ex.raw.course_code,
                        cand.raw.day,
                        target
                    ),
                    conflicting_course_code: Some(ex.raw.course_code.clone()),
                    conflicting_section_id: Some(ex.raw.section_id),
                };
                if req.config.enforce_online_offline_gap {
                    hard_conflicts.push(item);
                } else {
                    soft_warnings.push(item);
                }
            }
        }

        // Cohort overlap warning
        if req.config.avoid_cohort_overlap && overlaps && same_cohort {
            soft_warnings.push(ConflictItem {
                severity: "warning".into(),
                kind: "COHORT_OVERLAP".into(),
                message: format!(
                    "Overlaps with {} ({}-{}) for the same major/year cohort",
                    ex.raw.course_code, ex.raw.start_time, ex.raw.end_time
                ),
                conflicting_course_code: Some(ex.raw.course_code.clone()),
                conflicting_section_id: Some(ex.raw.section_id),
            });
        }
    }

    // 4. Consecutive hours & building switch checks for instructor on day
    if !inst_day_items.is_empty() || cand.raw.instructor_id.is_some() {
        let mut all_day = inst_day_items;
        all_day.push(cand.clone());
        all_day.sort_by_key(|x| (x.start_min, x.end_min));

        let max_consec_min = (req.config.max_consecutive_hours * 60.0).round() as u16;
        if exceeds_consecutive_limit(&all_day, req.config.max_adjacent_gap_minutes, max_consec_min) {
            soft_warnings.push(ConflictItem {
                severity: "warning".into(),
                kind: "CONSECUTIVE_HOURS_EXCEEDED".into(),
                message: format!(
                    "Instructor exceeds {:.1} continuous teaching hours on {}",
                    req.config.max_consecutive_hours, cand.raw.day
                ),
                conflicting_course_code: None,
                conflicting_section_id: None,
            });
        }

        if req.config.penalize_building_switches {
            let switches = count_building_switches(
                &all_day,
                req.config.max_building_transition_minutes,
            );
            if switches > 0 {
                soft_warnings.push(ConflictItem {
                    severity: "warning".into(),
                    kind: "BUILDING_SWITCH".into(),
                    message: format!(
                        "Instructor has {} tight building transition(s) (<= {} min) on {}",
                        switches, req.config.max_building_transition_minutes, cand.raw.day
                    ),
                    conflicting_course_code: None,
                    conflicting_section_id: None,
                });
            }
        }
    }

    ConflictCheckResult {
        is_valid: hard_conflicts.is_empty(),
        hard_conflicts,
        soft_warnings,
        check_time_us: t0.elapsed().as_secs_f64() * 1_000_000.0,
    }
}

pub fn validate_schedule(req: &ValidateScheduleRequest) -> ValidationReport {
    let t0 = Instant::now();
    let mut hard_conflicts = Vec::new();
    let mut soft_warnings = Vec::new();
    let mut breakdown = ObjectiveBreakdown::default();

    let mut parsed: Vec<ParsedAssignment<'_>> = Vec::with_capacity(req.assignments.len());
    for a in &req.assignments {
        if let Some(p) = parse_assignment(a, &req.classrooms) {
            parsed.push(p);
        } else {
            hard_conflicts.push(ConflictItem {
                severity: "error".into(),
                kind: "INVALID_TIME".into(),
                message: format!(
                    "Invalid time {}-{} for {}",
                    a.start_time, a.end_time, a.course_code
                ),
                conflicting_course_code: Some(a.course_code.clone()),
                conflicting_section_id: Some(a.section_id),
            });
        }
    }

    // Group by normalized day
    let mut by_day: HashMap<String, Vec<usize>> = HashMap::new();
    for (idx, p) in parsed.iter().enumerate() {
        by_day.entry(p.day_norm.clone()).or_default().push(idx);
    }

    // Per-item capacity & availability
    for p in &parsed {
        if !p.raw.is_online && p.raw.capacity > 0 {
            if let Some(cid) = p.raw.classroom_id.filter(|&x| x > 0) {
                if let Some(room) = req.classrooms.iter().find(|r| r.id == cid) {
                    if room.capacity < p.raw.capacity {
                        hard_conflicts.push(ConflictItem {
                            severity: "error".into(),
                            kind: "CAPACITY_EXCEEDED".into(),
                            message: format!(
                                "{} needs {} seats, {} holds {}",
                                p.raw.course_code, p.raw.capacity, room.code, room.capacity
                            ),
                            conflicting_course_code: Some(p.raw.course_code.clone()),
                            conflicting_section_id: Some(p.raw.section_id),
                        });
                    } else {
                        breakdown.total_seat_waste += (room.capacity - p.raw.capacity) as i64;
                    }
                }
            }
        }

        if let Some(inst_id) = p.raw.instructor_id.filter(|&x| x > 0) {
            for tc in &req.time_constraints {
                if tc.instructor_id == inst_id && days_match(&tc.day, &p.day_norm) {
                    for slot_str in &tc.time_slots {
                        let overlaps = if let Ok((cs, ce)) = parse_time_range(slot_str) {
                            intervals_overlap(p.start_min, p.end_min, cs, ce)
                        } else if let Ok(pt) = parse_hhmm_minutes(slot_str) {
                            pt >= p.start_min && pt < p.end_min
                        } else {
                            false
                        };
                        if overlaps {
                            hard_conflicts.push(ConflictItem {
                                severity: "error".into(),
                                kind: "INSTRUCTOR_UNAVAILABLE".into(),
                                message: format!(
                                    "{} ({}) falls inside instructor blackout {}",
                                    p.raw.course_code, p.raw.day, slot_str
                                ),
                                conflicting_course_code: Some(p.raw.course_code.clone()),
                                conflicting_section_id: Some(p.raw.section_id),
                            });
                            break;
                        }
                    }
                }
            }
        }
    }

    // Per-day pairwise & instructor sequences
    for (_day, idxs) in &by_day {
        let mut by_inst: HashMap<i64, Vec<usize>> = HashMap::new();
        for &idx in idxs {
            if let Some(iid) = parsed[idx].raw.instructor_id.filter(|&x| x > 0) {
                by_inst.entry(iid).or_default().push(idx);
            }
        }

        for i_pos in 0..idxs.len() {
            let a = &parsed[idxs[i_pos]];
            for j_pos in (i_pos + 1)..idxs.len() {
                let b = &parsed[idxs[j_pos]];
                let overlaps = intervals_overlap(a.start_min, a.end_min, b.start_min, b.end_min);

                if overlaps && !a.raw.is_online && !b.raw.is_online && same_room(a.raw, b.raw) {
                    hard_conflicts.push(ConflictItem {
                        severity: "error".into(),
                        kind: "ROOM_CONFLICT".into(),
                        message: format!(
                            "Room {} double-booked on {} between {} and {}",
                            a.raw.classroom_code.as_deref().unwrap_or("?"),
                            a.raw.day,
                            a.raw.course_code,
                            b.raw.course_code
                        ),
                        conflicting_course_code: Some(b.raw.course_code.clone()),
                        conflicting_section_id: Some(b.raw.section_id),
                    });
                }

                let same_inst = same_instructor(a.raw, b.raw);
                if overlaps && same_inst {
                    hard_conflicts.push(ConflictItem {
                        severity: "error".into(),
                        kind: "INSTRUCTOR_CONFLICT".into(),
                        message: format!(
                            "Instructor double-booked on {} between {} and {}",
                            a.raw.day, a.raw.course_code, b.raw.course_code
                        ),
                        conflicting_course_code: Some(b.raw.course_code.clone()),
                        conflicting_section_id: Some(b.raw.section_id),
                    });
                }

                if a.raw.section_id == b.raw.section_id {
                    breakdown.same_section_same_day_violations += 1;
                    let item = ConflictItem {
                        severity: if req.config.enforce_separate_days {
                            "error".into()
                        } else {
                            "warning".into()
                        },
                        kind: "SAME_SECTION_SAME_DAY".into(),
                        message: format!(
                            "Section {} ({}) has multiple sessions on {}",
                            a.raw.section_number, a.raw.course_code, a.raw.day
                        ),
                        conflicting_course_code: Some(b.raw.course_code.clone()),
                        conflicting_section_id: Some(b.raw.section_id),
                    };
                    if req.config.enforce_separate_days {
                        hard_conflicts.push(item);
                    } else {
                        soft_warnings.push(item);
                    }
                }

                let same_cohort = a.cohort_key.is_some()
                    && a.cohort_key == b.cohort_key
                    && a.raw.course_id != b.raw.course_id;

                if (same_inst || same_cohort) && a.raw.is_online != b.raw.is_online {
                    let gap = interval_gap(a.start_min, a.end_min, b.start_min, b.end_min);
                    if gap < req.config.min_online_offline_gap_minutes {
                        breakdown.online_offline_proximity_violations += 1;
                        let item = ConflictItem {
                            severity: if req.config.enforce_online_offline_gap {
                                "error".into()
                            } else {
                                "warning".into()
                            },
                            kind: "ONLINE_OFFLINE_PROXIMITY".into(),
                            message: format!(
                                "Online {} & offline {} only {} min apart on {}",
                                if a.raw.is_online { &a.raw.course_code } else { &b.raw.course_code },
                                if a.raw.is_online { &b.raw.course_code } else { &a.raw.course_code },
                                gap,
                                a.raw.day
                            ),
                            conflicting_course_code: Some(b.raw.course_code.clone()),
                            conflicting_section_id: Some(b.raw.section_id),
                        };
                        if req.config.enforce_online_offline_gap {
                            hard_conflicts.push(item);
                        } else {
                            soft_warnings.push(item);
                        }
                    }
                }

                if req.config.avoid_cohort_overlap && overlaps && same_cohort {
                    breakdown.cohort_overlap_slots += 1;
                    soft_warnings.push(ConflictItem {
                        severity: "warning".into(),
                        kind: "COHORT_OVERLAP".into(),
                        message: format!(
                            "Cohort overlap on {} between {} and {}",
                            a.raw.day, a.raw.course_code, b.raw.course_code
                        ),
                        conflicting_course_code: Some(b.raw.course_code.clone()),
                        conflicting_section_id: Some(b.raw.section_id),
                    });
                }
            }
        }

        // Consecutive hours + building switches per instructor on this day
        let max_consec_min = (req.config.max_consecutive_hours * 60.0).round() as u16;
        let mut seen_days: BTreeSet<i64> = BTreeSet::new();
        for (&iid, list) in &by_inst {
            if !seen_days.insert(iid) || list.is_empty() {
                continue;
            }
            let mut items: Vec<ParsedAssignment<'_>> =
                list.iter().map(|&idx| parsed[idx].clone()).collect();
            items.sort_by_key(|x| (x.start_min, x.end_min));

            if exceeds_consecutive_limit(&items, req.config.max_adjacent_gap_minutes, max_consec_min)
            {
                breakdown.over_consecutive_violations += 1;
                soft_warnings.push(ConflictItem {
                    severity: "warning".into(),
                    kind: "CONSECUTIVE_HOURS_EXCEEDED".into(),
                    message: format!(
                        "Instructor {} exceeds {:.1} consecutive hours on {}",
                        items[0].raw.instructor_name.as_deref().unwrap_or("instructor"),
                        req.config.max_consecutive_hours,
                        items[0].raw.day
                    ),
                    conflicting_course_code: None,
                    conflicting_section_id: None,
                });
            }

            if req.config.penalize_building_switches {
                let sw =
                    count_building_switches(&items, req.config.max_building_transition_minutes);
                if sw > 0 {
                    breakdown.building_switches += sw;
                    soft_warnings.push(ConflictItem {
                        severity: "warning".into(),
                        kind: "BUILDING_SWITCH".into(),
                        message: format!(
                            "Instructor {} has {} building transition(s) on {}",
                            items[0].raw.instructor_name.as_deref().unwrap_or("instructor"),
                            sw,
                            items[0].raw.day
                        ),
                        conflicting_course_code: None,
                        conflicting_section_id: None,
                    });
                }
            }
        }
    }

    ValidationReport {
        is_valid: hard_conflicts.is_empty(),
        hard_conflicts,
        soft_warnings,
        breakdown,
        check_time_ms: t0.elapsed().as_secs_f64() * 1000.0,
    }
}

fn parse_assignment<'a>(
    raw: &'a ExistingAssignmentInput,
    classrooms: &[crate::model::ClassroomInput],
) -> Option<ParsedAssignment<'a>> {
    let start_min = parse_hhmm_minutes(&raw.start_time).ok()?;
    let end_min = parse_hhmm_minutes(&raw.end_time).ok()?;
    if end_min <= start_min {
        return None;
    }

    let cohort_key = infer_cohort_key(
        raw.major_id,
        raw.major_name.as_deref(),
        raw.year,
        &raw.section_number,
    );

    let building = raw
        .classroom_location
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_ascii_lowercase())
        .or_else(|| {
            raw.classroom_id.and_then(|cid| {
                classrooms
                    .iter()
                    .find(|c| c.id == cid)
                    .and_then(|c| c.location.as_deref())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_ascii_lowercase())
            })
        });

    Some(ParsedAssignment {
        raw,
        day_norm: normalize_day(&raw.day),
        start_min,
        end_min,
        cohort_key,
        building,
    })
}

fn normalize_day(day: &str) -> String {
    let s = day.trim().to_ascii_lowercase();
    if s.len() >= 3 {
        s[..3].to_string()
    } else {
        s
    }
}

fn days_match(a: &str, b: &str) -> bool {
    let na = normalize_day(a);
    let nb = normalize_day(b);
    !na.is_empty() && na == nb
}

fn is_same_unit(a: &ExistingAssignmentInput, b: &ExistingAssignmentInput) -> bool {
    match (a.course_hours_id, b.course_hours_id) {
        (Some(id1), Some(id2)) => id1 == id2,
        _ => false,
    }
}

fn same_room(a: &ExistingAssignmentInput, b: &ExistingAssignmentInput) -> bool {
    match (a.classroom_id.filter(|&x| x > 0), b.classroom_id.filter(|&x| x > 0)) {
        (Some(id1), Some(id2)) => id1 == id2,
        _ => match (&a.classroom_code, &b.classroom_code) {
            (Some(c1), Some(c2)) => {
                !c1.trim().is_empty() && c1.trim().eq_ignore_ascii_case(c2.trim())
            }
            _ => false,
        },
    }
}

fn same_instructor(a: &ExistingAssignmentInput, b: &ExistingAssignmentInput) -> bool {
    match (
        a.instructor_id.filter(|&x| x > 0),
        b.instructor_id.filter(|&x| x > 0),
    ) {
        (Some(id1), Some(id2)) => id1 == id2,
        _ => match (&a.instructor_name, &b.instructor_name) {
            (Some(n1), Some(n2)) => {
                let s1 = n1.trim();
                let s2 = n2.trim();
                !s1.is_empty()
                    && !s1.eq_ignore_ascii_case("unassigned")
                    && !s1.eq_ignore_ascii_case("unknown")
                    && s1.eq_ignore_ascii_case(s2)
            }
            _ => false,
        },
    }
}

fn infer_cohort_key(
    major_id: Option<i64>,
    major_name: Option<&str>,
    explicit_year: Option<u16>,
    section_number: &str,
) -> Option<(String, u16)> {
    let mut yr = explicit_year;
    let mut base_major: Option<String> = None;

    if let Some(raw) = major_name {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            let lower = trimmed.to_ascii_lowercase();
            if let Some(idx) = lower.rfind(" year ") {
                let tail = lower[idx + 6..].trim();
                if let Ok(parsed) = tail.parse::<u16>() {
                    if yr.is_none() {
                        yr = Some(parsed);
                    }
                    base_major = Some(trimmed[..idx].trim().to_ascii_lowercase());
                }
            }
            if base_major.is_none() {
                base_major = Some(lower);
            }
        }
    }

    if base_major.is_none() {
        base_major = major_id.filter(|&id| id > 0).map(|id| format!("id:{id}"));
    }

    if yr.is_none() {
        let bytes = section_number.trim().as_bytes();
        let mut i = 0;
        while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
            i += 1;
        }
        if i > 0 && i < bytes.len() && bytes[i].is_ascii_digit() {
            let d = (bytes[i] - b'0') as u16;
            if (1..=6).contains(&d) {
                yr = Some(d);
            }
        }
    }

    match (base_major, yr) {
        (Some(m), Some(y)) => Some((m, y)),
        _ => None,
    }
}

fn exceeds_consecutive_limit(
    sorted_items: &[ParsedAssignment<'_>],
    max_adjacent_gap: u16,
    max_consec_min: u16,
) -> bool {
    if sorted_items.is_empty() || max_consec_min == 0 {
        return false;
    }
    let mut block_active = sorted_items[0].end_min - sorted_items[0].start_min;
    if block_active > max_consec_min {
        return true;
    }
    let mut prev_end = sorted_items[0].end_min;
    for it in sorted_items.iter().skip(1) {
        let gap = it.start_min.saturating_sub(prev_end);
        let dur = it.end_min - it.start_min;
        if gap <= max_adjacent_gap {
            block_active += dur;
            if it.end_min > prev_end {
                prev_end = it.end_min;
            }
        } else {
            block_active = dur;
            prev_end = it.end_min;
        }
        if block_active > max_consec_min {
            return true;
        }
    }
    false
}

fn count_building_switches(
    sorted_items: &[ParsedAssignment<'_>],
    max_transition_minutes: u16,
) -> usize {
    let physical: Vec<&ParsedAssignment<'_>> = sorted_items
        .iter()
        .filter(|x| !x.raw.is_online && x.building.is_some())
        .collect();
    if physical.len() <= 1 {
        return 0;
    }
    let mut switches = 0usize;
    for w in physical.windows(2) {
        let gap = w[1].start_min.saturating_sub(w[0].end_min);
        if gap <= max_transition_minutes && w[0].building != w[1].building {
            switches += 1;
        }
    }
    switches
}
