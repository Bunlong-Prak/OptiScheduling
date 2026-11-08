use std::cmp::Ordering;

use rustc_hash::FxHashMap;
use smallvec::SmallVec;

use crate::model::{
    AssignmentOutput, ClassroomInput, FailedUnitOutput, ObjectiveBreakdown, ScheduleRequest,
    SchedulingError, SchedulingErrorDetails, SchedulingErrorType, SolverConfig, DEFAULT_DAYS,
};
use crate::time::{
    constraint_strings_to_mask, find_slot_combinations, format_minutes, intervals_overlap,
    normalize_time_slots, parse_hhmm_minutes, ComboKind, NormalizedTimeSlot, SlotCombo,
    TimeError,
};

pub const NO_ROOM_SENTINEL: u16 = u16::MAX;

#[derive(Debug, Clone)]
pub struct PreparedClassroom {
    pub id: i64,
    pub code: String,
    pub name: Option<String>,
    pub capacity: i32,
    pub classroom_type_id: i64,
    pub location: Option<String>,
    pub building_id: Option<u16>,
}

#[derive(Debug, Clone)]
pub struct PreparedInstructor {
    pub id: i64,
    pub name: String,
    pub is_part_time: bool,
    pub unavail_mask: Vec<u128>,
    pub pref_mask: Vec<u128>,
    pub has_pref_any: bool,
    pub avail_slots_count: usize,
}

#[derive(Debug, Clone)]
pub struct TimeOption {
    pub day: u8,
    pub combo_idx: u16,
    pub is_outside_pref: bool,
    pub static_time_cost: i32,
}

#[derive(Debug, Clone)]
pub struct RoomOption {
    /// Index into `PreparedProblem.classrooms`, or `NO_ROOM_SENTINEL` for online sections
    pub room_idx: u16,
    pub building_id: Option<u16>,
    pub matches_specific: bool,
    pub matches_type: bool,
    pub seat_waste: i32,
    pub static_room_cost: i32,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StaticUnitIssue {
    None,
    DurationMismatch { required: f64 },
    CapacityConstraint { required: i32, max_available: i32 },
    TimeConstraint { total_slots: usize },
    InvalidLockedAssignment { reason: String },
}

#[derive(Debug, Clone)]
pub struct PreparedUnit {
    pub unit_index: usize,
    pub course_id: i64,
    pub section_id: i64,
    pub section_idx: usize,
    pub section_number: String,
    pub course_hours_id: Option<i64>,
    pub course_code: String,
    pub course_title: String,
    pub course_color: Option<String>,
    pub capacity: i32,
    pub duration_hours: f64,
    pub is_online: bool,
    pub is_locked: bool,
    pub inst_idx: Option<usize>,
    pub cohort_idx: Option<usize>,
    pub major_idx: Option<usize>,
    pub prefer_classroom_type_id: Option<i64>,
    pub prefer_classroom_id: Option<i64>,
    pub combo_group_idx: usize,
    pub time_options: Vec<TimeOption>,
    pub room_options: Vec<RoomOption>,
    pub static_issue: StaticUnitIssue,
}

#[derive(Debug)]
pub struct PreparedProblem {
    pub config: SolverConfig,
    pub days: Vec<String>,
    pub slots: Vec<NormalizedTimeSlot>,
    pub combo_groups: Vec<Vec<SlotCombo>>,
    pub classrooms: Vec<PreparedClassroom>,
    pub instructors: Vec<PreparedInstructor>,
    pub units: Vec<PreparedUnit>,
    pub section_units_count: Vec<usize>,
    pub section_hard_separate: Vec<bool>,
    pub num_cohorts: usize,
    pub num_majors: usize,
    pub constraints_applied: usize,
    pub total_courses: usize,
    pub total_sections: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Placement {
    pub time_opt_idx: u16,
    pub room_opt_idx: u16,
    pub day: u8,
    pub combo_idx: u16,
    pub room_idx: u16,
    pub static_cost: i32,
}

#[derive(Debug, Clone, Copy)]
pub struct InstDayUnit {
    pub unit_idx: u16,
    pub start_min: u16,
    pub end_min: u16,
    pub is_online: bool,
    pub building_id: Option<u16>,
}

#[derive(Debug, Clone, Copy)]
pub struct CohortDayUnit {
    pub unit_idx: u16,
    pub course_id: i64,
    pub start_min: u16,
    pub end_min: u16,
    pub is_online: bool,
    pub mask: u128,
}

#[derive(Debug, Clone, Copy)]
pub struct MajorDayUnit {
    pub unit_idx: u16,
    pub course_id: i64,
    pub mask: u128,
}

impl PreparedProblem {
    pub fn build(req: &ScheduleRequest) -> Result<Self, TimeError> {
        let mut config = req.config.clone();
        if config.days.is_empty() {
            config.days = DEFAULT_DAYS.iter().map(|s| (*s).to_string()).collect();
        }
        let days = config.days.clone();
        let num_days = days.len();
        let slots = normalize_time_slots(&req.time_slots)?;

        // Map day names cleanly (supports full name or 3-letter abbreviation)
        let day_lookup = |raw: &str| -> Option<usize> {
            let clean = raw.trim().to_ascii_lowercase();
            if clean.is_empty() {
                return None;
            }
            if let Some(pos) = days.iter().position(|d| d.to_ascii_lowercase() == clean) {
                return Some(pos);
            }
            if clean.len() >= 3 {
                let prefix = &clean[..3];
                if let Some(pos) = days
                    .iter()
                    .position(|d| d.to_ascii_lowercase().starts_with(prefix))
                {
                    return Some(pos);
                }
            }
            None
        };

        // Buildings & classrooms
        let mut building_map: FxHashMap<String, u16> = FxHashMap::default();
        let mut raw_rooms: Vec<&ClassroomInput> = req.classrooms.iter().collect();
        raw_rooms.sort_by_key(|r| (r.capacity, r.id));

        let mut classrooms = Vec::with_capacity(raw_rooms.len());
        for r in raw_rooms {
            let clean_loc = r
                .location
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty());
            let building_id = clean_loc.map(|loc| {
                let key = loc.to_ascii_lowercase();
                let next_id = building_map.len() as u16;
                *building_map.entry(key).or_insert(next_id)
            });
            classrooms.push(PreparedClassroom {
                id: r.id,
                code: r.code.clone(),
                name: r.name.clone(),
                capacity: r.capacity,
                classroom_type_id: r.classroom_type_id,
                location: clean_loc.map(str::to_string),
                building_id,
            });
        }

        // Instructors
        let mut inst_map: FxHashMap<i64, usize> = FxHashMap::default();
        let mut instructors: Vec<PreparedInstructor> = Vec::with_capacity(req.instructors.len());

        for inst in &req.instructors {
            if !inst_map.contains_key(&inst.id) {
                let idx = instructors.len();
                inst_map.insert(inst.id, idx);
                instructors.push(PreparedInstructor {
                    id: inst.id,
                    name: inst.display_name(),
                    is_part_time: inst.is_part_time.unwrap_or(false),
                    unavail_mask: vec![0u128; num_days],
                    pref_mask: vec![0u128; num_days],
                    has_pref_any: false,
                    avail_slots_count: slots.len() * num_days,
                });
            }
        }

        // Ensure any instructor referenced by a section is present
        for course in &req.courses {
            for section in &course.sections {
                if let Some(inst_id) = section.instructor_id {
                    if inst_id > 0 && !inst_map.contains_key(&inst_id) {
                        let idx = instructors.len();
                        inst_map.insert(inst_id, idx);
                        instructors.push(PreparedInstructor {
                            id: inst_id,
                            name: format!("Instructor #{inst_id}"),
                            is_part_time: false,
                            unavail_mask: vec![0u128; num_days],
                            pref_mask: vec![0u128; num_days],
                            has_pref_any: false,
                            avail_slots_count: slots.len() * num_days,
                        });
                    }
                }
            }
        }

        // Populate blackout constraints & explicit preferred slots
        let mut constraints_applied = 0usize;
        for tc in &req.time_constraints {
            if let Some(&inst_idx) = inst_map.get(&tc.instructor_id) {
                if let Some(day_idx) = day_lookup(&tc.day) {
                    let mask = constraint_strings_to_mask(&tc.time_slots, &slots);
                    if mask != 0 {
                        instructors[inst_idx].unavail_mask[day_idx] |= mask;
                        constraints_applied += 1;
                    }
                }
            }
        }

        for ps in &req.preferred_slots {
            if let Some(&inst_idx) = inst_map.get(&ps.instructor_id) {
                if let Some(day_idx) = day_lookup(&ps.day) {
                    let mask = constraint_strings_to_mask(&ps.time_slots, &slots);
                    if mask != 0 {
                        instructors[inst_idx].pref_mask[day_idx] |= mask;
                        instructors[inst_idx].has_pref_any = true;
                    }
                }
            }
        }

        // Finalize instructor part-time flag and available slot counts
        let explicit_pt_map: FxHashMap<i64, Option<bool>> =
            req.instructors.iter().map(|i| (i.id, i.is_part_time)).collect();
        let all_slots_mask: u128 = if slots.len() == 128 {
            u128::MAX
        } else {
            (1u128 << slots.len()) - 1
        };

        for inst in &mut instructors {
            let has_unavail = inst.unavail_mask.iter().any(|&m| m != 0);
            if explicit_pt_map.get(&inst.id).copied().flatten().is_none() {
                // Paragon rule: treat constrained/pref-bound instructors as part-time priority when not specified
                inst.is_part_time = has_unavail || inst.has_pref_any;
            }
            let avail_cnt: usize = inst
                .unavail_mask
                .iter()
                .map(|&u| (all_slots_mask & !u).count_ones() as usize)
                .sum();
            inst.avail_slots_count = avail_cnt;
        }

        // Deduplicated duration combo table (duration_in_thousandths -> index into combo_groups)
        let mut combo_map: FxHashMap<i64, usize> = FxHashMap::default();
        let mut combo_groups: Vec<Vec<SlotCombo>> = Vec::new();

        let mut cohort_map: FxHashMap<(String, u16), usize> = FxHashMap::default();
        let mut major_map: FxHashMap<String, usize> = FxHashMap::default();
        let mut section_map: FxHashMap<i64, usize> = FxHashMap::default();
        let mut section_units_count: Vec<usize> = Vec::new();
        let mut units: Vec<PreparedUnit> = Vec::new();
        let mut total_sections = 0usize;

        let max_room_capacity = classrooms.iter().map(|c| c.capacity).max().unwrap_or(0);

        for course in &req.courses {
            let base_major_key = normalize_base_major(course.major_id, course.major_name.as_deref());
            let major_idx = base_major_key.as_ref().map(|k| {
                let next_id = major_map.len();
                *major_map.entry(k.clone()).or_insert(next_id)
            });

            for section in &course.sections {
                total_sections += 1;
                let section_idx = if let Some(&existing) = section_map.get(&section.id) {
                    existing
                } else {
                    let idx = section_units_count.len();
                    section_map.insert(section.id, idx);
                    section_units_count.push(0);
                    idx
                };

                let is_online = section.is_online_section();
                let inst_idx = section
                    .instructor_id
                    .filter(|&id| id > 0)
                    .and_then(|id| inst_map.get(&id).copied());

                let inferred_year = section
                    .year
                    .or(course.year)
                    .or_else(|| course.major_name.as_deref().and_then(parse_year_from_major))
                    .or_else(|| parse_year_from_section(&section.number));

                let cohort_idx = match (&base_major_key, inferred_year) {
                    (Some(maj), Some(yr)) => {
                        let next_id = cohort_map.len();
                        Some(*cohort_map.entry((maj.clone(), yr)).or_insert(next_id))
                    }
                    _ => None,
                };

                let synthetic_units;
                let unit_slice = if section.units.is_empty() {
                    synthetic_units = [crate::model::UnitInput {
                        course_hours_id: None,
                        duration: course.duration,
                        prefer_classroom_type_id: None,
                        prefer_classroom_id: None,
                        locked: None,
                    }];
                    &synthetic_units[..]
                } else {
                    &section.units[..]
                };

                section_units_count[section_idx] += unit_slice.len();

                for unit in unit_slice {
                    let dur = if unit.duration > 0.0 {
                        unit.duration
                    } else {
                        course.duration
                    };
                    let combo_group_idx = get_or_build_combos(
                        &mut combo_map,
                        &mut combo_groups,
                        &slots,
                        dur,
                        config.max_adjacent_gap_minutes,
                    );
                    let combos = &combo_groups[combo_group_idx];

                    let unit_index = units.len();
                    let mut static_issue = StaticUnitIssue::None;
                    let mut time_options: Vec<TimeOption> = Vec::new();
                    let mut room_options: Vec<RoomOption> = Vec::new();
                    let mut is_locked = false;

                    // Room options
                    if is_online {
                        room_options.push(RoomOption {
                            room_idx: NO_ROOM_SENTINEL,
                            building_id: None,
                            matches_specific: true,
                            matches_type: true,
                            seat_waste: 0,
                            static_room_cost: 0,
                        });
                    } else {
                        for (r_idx, room) in classrooms.iter().enumerate() {
                            if room.capacity < course.capacity {
                                continue;
                            }
                            let matches_specific = match unit.prefer_classroom_id {
                                Some(pid) => room.id == pid,
                                None => true,
                            };
                            let matches_type = match unit.prefer_classroom_type_id {
                                Some(tid) => room.classroom_type_id == tid,
                                None => true,
                            };
                            let seat_waste = (room.capacity - course.capacity).max(0);
                            let mut static_room_cost = (seat_waste as i64
                                * config.weights.seat_waste_per_seat)
                                as i32;
                            if !matches_specific {
                                static_room_cost += config.weights.wrong_specific_classroom as i32;
                            }
                            if !matches_type {
                                static_room_cost += config.weights.wrong_classroom_type as i32;
                            }
                            room_options.push(RoomOption {
                                room_idx: r_idx as u16,
                                building_id: room.building_id,
                                matches_specific,
                                matches_type,
                                seat_waste,
                                static_room_cost,
                            });
                        }

                        // Sort rooms by preference & tightest capacity fit
                        room_options.sort_by_key(|ro| {
                            (
                                ro.static_room_cost,
                                !ro.matches_specific,
                                !ro.matches_type,
                                ro.seat_waste,
                                ro.room_idx,
                            )
                        });
                    }

                    // Handle locked assignment if provided
                    if let Some(locked) = &unit.locked {
                        is_locked = true;
                        match resolve_locked_candidate(
                            locked,
                            is_online,
                            &day_lookup,
                            &slots,
                            combos,
                            &classrooms,
                            &room_options,
                        ) {
                            Ok((day_idx, combo_idx, matched_room_opt)) => {
                                let combo = &combos[combo_idx];
                                let inst_avail_ok = match inst_idx {
                                    Some(ii) => (instructors[ii].unavail_mask[day_idx] & combo.mask) == 0,
                                    None => true,
                                };
                                if !inst_avail_ok {
                                    static_issue = StaticUnitIssue::TimeConstraint {
                                        total_slots: combos.len(),
                                    };
                                } else {
                                    let is_outside_pref = match inst_idx {
                                        Some(ii) if instructors[ii].has_pref_any => {
                                            (instructors[ii].pref_mask[day_idx] & combo.mask)
                                                != combo.mask
                                        }
                                        _ => false,
                                    };
                                    time_options.push(TimeOption {
                                        day: day_idx as u8,
                                        combo_idx: combo_idx as u16,
                                        is_outside_pref,
                                        static_time_cost: compute_static_time_cost(
                                            day_idx,
                                            combo,
                                            is_outside_pref,
                                            &config,
                                        ),
                                    });
                                    if let Some(ro) = matched_room_opt {
                                        room_options.clear();
                                        room_options.push(ro);
                                    }
                                }
                            }
                            Err(reason) => {
                                static_issue = StaticUnitIssue::InvalidLockedAssignment { reason };
                            }
                        }
                    } else if combos.is_empty() {
                        static_issue = StaticUnitIssue::DurationMismatch { required: dur };
                    } else if room_options.is_empty() {
                        static_issue = StaticUnitIssue::CapacityConstraint {
                            required: course.capacity,
                            max_available: max_room_capacity,
                        };
                    } else {
                        for day_idx in 0..num_days {
                            for (combo_idx, combo) in combos.iter().enumerate() {
                                if let Some(ii) = inst_idx {
                                    if (instructors[ii].unavail_mask[day_idx] & combo.mask) != 0 {
                                        continue;
                                    }
                                }
                                let is_outside_pref = match inst_idx {
                                    Some(ii) if instructors[ii].has_pref_any => {
                                        (instructors[ii].pref_mask[day_idx] & combo.mask)
                                            != combo.mask
                                    }
                                    _ => false,
                                };
                                time_options.push(TimeOption {
                                    day: day_idx as u8,
                                    combo_idx: combo_idx as u16,
                                    is_outside_pref,
                                    static_time_cost: compute_static_time_cost(
                                        day_idx,
                                        combo,
                                        is_outside_pref,
                                        &config,
                                    ),
                                });
                            }
                        }

                        if time_options.is_empty() {
                            static_issue = StaticUnitIssue::TimeConstraint {
                                total_slots: combos.len() * num_days,
                            };
                        } else {
                            // Prefer preferred slots + continuous combos + earlier days
                            time_options.sort_by_key(|to| {
                                (
                                    to.static_time_cost,
                                    to.is_outside_pref,
                                    to.combo_idx,
                                    to.day,
                                )
                            });
                        }
                    }

                    units.push(PreparedUnit {
                        unit_index,
                        course_id: course.id,
                        section_id: section.id,
                        section_idx,
                        section_number: section.number.clone(),
                        course_hours_id: unit.course_hours_id,
                        course_code: course.code.clone(),
                        course_title: course.title.clone(),
                        course_color: course.color.clone(),
                        capacity: course.capacity,
                        duration_hours: dur,
                        is_online,
                        is_locked,
                        inst_idx,
                        cohort_idx,
                        major_idx,
                        prefer_classroom_type_id: unit.prefer_classroom_type_id,
                        prefer_classroom_id: unit.prefer_classroom_id,
                        combo_group_idx,
                        time_options,
                        room_options,
                        static_issue,
                    });
                }
            }
        }

        let section_hard_separate: Vec<bool> = section_units_count
            .iter()
            .map(|&cnt| config.enforce_separate_days && cnt <= num_days)
            .collect();

        Ok(Self {
            config,
            days,
            slots,
            combo_groups,
            classrooms,
            instructors,
            units,
            section_units_count,
            section_hard_separate,
            num_cohorts: cohort_map.len(),
            num_majors: major_map.len(),
            constraints_applied,
            total_courses: req.courses.len(),
            total_sections,
        })
    }

    #[inline]
    pub fn combo_for(&self, unit: &PreparedUnit, combo_idx: u16) -> &SlotCombo {
        &self.combo_groups[unit.combo_group_idx][combo_idx as usize]
    }
}

fn get_or_build_combos(
    combo_map: &mut FxHashMap<i64, usize>,
    combo_groups: &mut Vec<Vec<SlotCombo>>,
    slots: &[NormalizedTimeSlot],
    dur_hours: f64,
    max_adjacent_gap: u16,
) -> usize {
    let key = (dur_hours * 1000.0).round() as i64;
    if let Some(&idx) = combo_map.get(&key) {
        return idx;
    }
    let combos = find_slot_combinations(slots, dur_hours, max_adjacent_gap);
    let idx = combo_groups.len();
    combo_groups.push(combos);
    combo_map.insert(key, idx);
    idx
}

fn compute_static_time_cost(
    day_idx: usize,
    combo: &SlotCombo,
    is_outside_pref: bool,
    config: &SolverConfig,
) -> i32 {
    let w = &config.weights;
    let mut cost = (combo.internal_gap_minutes as i64 * w.gap_per_minute)
        + (day_idx as i64 * w.later_day_tiebreak)
        + (combo.first_slot as i64 * w.later_slot_tiebreak);
    if combo.kind == ComboKind::Dispersed {
        cost += w.dispersed_combo;
    }
    if is_outside_pref {
        cost += w.outside_preferred_slot;
    }
    cost as i32
}

fn resolve_locked_candidate(
    locked: &crate::model::LockedAssignmentInput,
    is_online: bool,
    day_lookup: &dyn Fn(&str) -> Option<usize>,
    slots: &[NormalizedTimeSlot],
    combos: &[SlotCombo],
    classrooms: &[PreparedClassroom],
    room_options: &[RoomOption],
) -> Result<(usize, usize, Option<RoomOption>), String> {
    let day_idx = day_lookup(&locked.day)
        .ok_or_else(|| format!("Unknown locked day '{}'", locked.day))?;
    let start_min = parse_hhmm_minutes(&locked.start_time)
        .map_err(|e| format!("Invalid locked start_time: {e}"))?;
    let end_min = parse_hhmm_minutes(&locked.end_time)
        .map_err(|e| format!("Invalid locked end_time: {e}"))?;
    if end_min <= start_min {
        return Err("Locked end_time <= start_time".into());
    }

    // First try matching exact combo in combos
    let combo_idx = combos
        .iter()
        .position(|c| c.start_min == start_min && c.end_min == end_min)
        .or_else(|| {
            // Fallback: find any slot overlapping range and check exact start/end
            let mut mask = 0u128;
            for s in slots {
                if intervals_overlap(s.start_min, s.end_min, start_min, end_min) {
                    mask |= s.overlap_mask;
                }
            }
            combos.iter().position(|c| (c.mask & mask) == c.mask && mask != 0)
        })
        .ok_or_else(|| {
            format!(
                "No slot combination matches locked time {}-{}",
                locked.start_time, locked.end_time
            )
        })?;

    if is_online {
        return Ok((day_idx, combo_idx, None));
    }

    if let Some(cid) = locked.classroom_id {
        if let Some(ro) = room_options
            .iter()
            .find(|r| r.room_idx != NO_ROOM_SENTINEL && classrooms[r.room_idx as usize].id == cid)
        {
            return Ok((day_idx, combo_idx, Some(ro.clone())));
        }
        return Err(format!(
            "Locked classroom ID {cid} does not exist or lacks capacity"
        ));
    }

    Ok((day_idx, combo_idx, None))
}

fn normalize_base_major(major_id: Option<i64>, major_name: Option<&str>) -> Option<String> {
    if let Some(raw) = major_name {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            // Strip trailing "Year <num>" case-insensitively
            let lower = trimmed.to_ascii_lowercase();
            if let Some(idx) = lower.rfind(" year ") {
                let tail = lower[idx + 6..].trim();
                if !tail.is_empty() && tail.chars().all(|c| c.is_ascii_digit()) {
                    return Some(trimmed[..idx].trim().to_ascii_lowercase());
                }
            }
            return Some(lower);
        }
    }
    major_id.filter(|&id| id > 0).map(|id| format!("id:{id}"))
}

fn parse_year_from_major(raw: &str) -> Option<u16> {
    let lower = raw.trim().to_ascii_lowercase();
    if let Some(idx) = lower.rfind(" year ") {
        let tail = lower[idx + 6..].trim();
        if let Ok(yr) = tail.parse::<u16>() {
            if (1..=10).contains(&yr) {
                return Some(yr);
            }
        }
    }
    None
}

fn parse_year_from_section(raw: &str) -> Option<u16> {
    // Matches patterns like "CS2", "SE3A", "IT101" (letters followed immediately by a digit 1..6)
    let bytes = raw.trim().as_bytes();
    let mut i = 0;
    while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
        i += 1;
    }
    if i > 0 && i < bytes.len() && bytes[i].is_ascii_digit() {
        let d = (bytes[i] - b'0') as u16;
        if (1..=6).contains(&d) {
            return Some(d);
        }
    }
    None
}

#[derive(Debug, Clone)]
pub struct ScheduleState<'a> {
    pub problem: &'a PreparedProblem,
    pub assignments: Vec<Option<Placement>>,
    pub assigned_count: usize,
    pub num_days: usize,
    /// `[inst * num_days + day]`
    pub inst_busy: Vec<u128>,
    /// `[room * num_days + day]`
    pub room_busy: Vec<u128>,
    /// `[section * num_days + day]`
    pub section_day_count: Vec<u16>,
    /// `[inst * num_days + day]`
    pub inst_day_units: Vec<SmallVec<[InstDayUnit; 8]>>,
    /// `[inst * num_days + day]`
    pub inst_day_count: Vec<u16>,
    /// `[inst]`
    pub inst_active_days: Vec<u16>,
    /// `[cohort * num_days + day]`
    pub cohort_day_units: Vec<SmallVec<[CohortDayUnit; 12]>>,
    /// `[major * num_days + day]`
    pub major_day_units: Vec<SmallVec<[MajorDayUnit; 16]>>,
    /// `[day]`
    pub day_load: Vec<u16>,
    pub total_cost: i64,
}

impl<'a> ScheduleState<'a> {
    pub fn new(problem: &'a PreparedProblem) -> Self {
        let num_units = problem.units.len();
        let num_days = problem.days.len();
        let num_inst = problem.instructors.len();
        let num_rooms = problem.classrooms.len();
        let num_sections = problem.section_units_count.len();
        let num_cohorts = problem.num_cohorts;
        let num_majors = problem.num_majors;

        Self {
            problem,
            assignments: vec![None; num_units],
            assigned_count: 0,
            num_days,
            inst_busy: vec![0u128; num_inst * num_days],
            room_busy: vec![0u128; num_rooms * num_days],
            section_day_count: vec![0u16; num_sections * num_days],
            inst_day_units: vec![SmallVec::new(); num_inst * num_days],
            inst_day_count: vec![0u16; num_inst * num_days],
            inst_active_days: vec![0u16; num_inst],
            cohort_day_units: vec![SmallVec::new(); num_cohorts * num_days],
            major_day_units: vec![SmallVec::new(); num_majors * num_days],
            day_load: vec![0u16; num_days],
            total_cost: (num_units as i64) * problem.config.weights.unassigned_unit,
        }
    }

    #[inline]
    fn inst_day_idx(&self, inst: usize, day: usize) -> usize {
        inst * self.num_days + day
    }

    #[inline]
    fn room_day_idx(&self, room: usize, day: usize) -> usize {
        room * self.num_days + day
    }

    #[inline]
    fn sec_day_idx(&self, sec: usize, day: usize) -> usize {
        sec * self.num_days + day
    }

    #[inline]
    fn cohort_day_idx(&self, cohort: usize, day: usize) -> usize {
        cohort * self.num_days + day
    }

    #[inline]
    fn major_day_idx(&self, major: usize, day: usize) -> usize {
        major * self.num_days + day
    }

    /// Checks whether a time option is hard-feasible (ignoring room choice).
    #[inline]
    pub fn can_place_time_hard(&self, unit_idx: usize, time_opt: &TimeOption) -> bool {
        let u = &self.problem.units[unit_idx];
        let day = time_opt.day as usize;
        let combo = self.problem.combo_for(u, time_opt.combo_idx);

        // 1. Separate days per section
        if self.problem.section_hard_separate[u.section_idx] {
            if self.section_day_count[self.sec_day_idx(u.section_idx, day)] > 0 {
                return false;
            }
        }

        // 2. Instructor no double-booking + optional hard online/offline gap
        if let Some(ii) = u.inst_idx {
            let id_idx = self.inst_day_idx(ii, day);
            if (self.inst_busy[id_idx] & combo.mask) != 0 {
                return false;
            }
            if self.problem.config.enforce_online_offline_gap {
                let min_gap = self.problem.config.min_online_offline_gap_minutes;
                for other in &self.inst_day_units[id_idx] {
                    if other.is_online != u.is_online
                        && interval_gap(combo.start_min, combo.end_min, other.start_min, other.end_min)
                            < min_gap
                    {
                        return false;
                    }
                }
            }
        }

        // 3. Cohort hard online/offline gap if configured
        if self.problem.config.enforce_online_offline_gap {
            if let Some(ci) = u.cohort_idx {
                let cd_idx = self.cohort_day_idx(ci, day);
                let min_gap = self.problem.config.min_online_offline_gap_minutes;
                for other in &self.cohort_day_units[cd_idx] {
                    if other.course_id != u.course_id
                        && other.is_online != u.is_online
                        && interval_gap(combo.start_min, combo.end_min, other.start_min, other.end_min)
                            < min_gap
                    {
                        return false;
                    }
                }
            }
        }

        true
    }

    #[inline]
    pub fn can_place_room_hard(&self, _unit_idx: usize, day: u8, combo_mask: u128, room_opt: &RoomOption) -> bool {
        if room_opt.room_idx == NO_ROOM_SENTINEL {
            return true;
        }
        let rd_idx = self.room_day_idx(room_opt.room_idx as usize, day as usize);
        (self.room_busy[rd_idx] & combo_mask) == 0
    }

    /// Computes exact time-dependent soft penalty of adding an unassigned `unit_idx` on `time_opt`.
    /// (Does not include `room_opt.static_room_cost` or building switch cost.)
    pub fn time_delta_cost(&self, unit_idx: usize, time_opt: &TimeOption) -> i64 {
        let u = &self.problem.units[unit_idx];
        let day = time_opt.day as usize;
        let combo = self.problem.combo_for(u, time_opt.combo_idx);
        let cfg = &self.problem.config;
        let w = &cfg.weights;

        let mut delta = -w.unassigned_unit + time_opt.static_time_cost as i64;

        // 1. Soft same-section-same-day (when hard separate didn't trigger)
        let sec_cnt = self.section_day_count[self.sec_day_idx(u.section_idx, day)];
        if sec_cnt > 0 {
            delta += w.same_section_same_day;
        }

        // 2. Instructor soft constraints: online/offline proximity, part-time scatter, >max consecutive hours
        if let Some(ii) = u.inst_idx {
            let id_idx = self.inst_day_idx(ii, day);
            let existing = &self.inst_day_units[id_idx];

            if self.problem.instructors[ii].is_part_time
                && self.inst_active_days[ii] > 0
                && self.inst_day_count[id_idx] == 0
            {
                delta += w.part_time_day_scatter;
            }

            if !existing.is_empty() {
                for other in existing {
                    if other.is_online != u.is_online
                        && interval_gap(combo.start_min, combo.end_min, other.start_min, other.end_min)
                            < cfg.min_online_offline_gap_minutes
                    {
                        delta += w.online_offline_proximity;
                    }
                }
            }

            let before_consec = consecutive_excess_penalty(
                existing,
                None,
                cfg.max_adjacent_gap_minutes,
                cfg.max_consecutive_hours,
                w.over_consecutive_hour,
            );
            let new_entry = InstDayUnit {
                unit_idx: unit_idx as u16,
                start_min: combo.start_min,
                end_min: combo.end_min,
                is_online: u.is_online,
                building_id: None,
            };
            let after_consec = consecutive_excess_penalty(
                existing,
                Some(new_entry),
                cfg.max_adjacent_gap_minutes,
                cfg.max_consecutive_hours,
                w.over_consecutive_hour,
            );
            delta += after_consec - before_consec;
        }

        // 3. Cohort online/offline proximity & student cohort overlap
        if let Some(ci) = u.cohort_idx {
            let cd_idx = self.cohort_day_idx(ci, day);
            let existing = &self.cohort_day_units[cd_idx];
            if !existing.is_empty() {
                let mut same_course_mask = 0u128;
                let mut other_course_mask = 0u128;
                for other in existing {
                    if other.course_id == u.course_id {
                        same_course_mask |= other.mask;
                    } else {
                        other_course_mask |= other.mask;
                        if other.is_online != u.is_online
                            && interval_gap(
                                combo.start_min,
                                combo.end_min,
                                other.start_min,
                                other.end_min,
                            ) < cfg.min_online_offline_gap_minutes
                        {
                            delta += w.online_offline_proximity;
                        }
                    }
                }
                if cfg.avoid_cohort_overlap {
                    let newly_added = combo.mask & !same_course_mask;
                    let new_conflicts = (newly_added & other_course_mask).count_ones() as i64;
                    delta += new_conflicts * w.cohort_overlap_per_slot;
                }
            }
        } else if cfg.avoid_cohort_overlap && w.major_only_overlap_per_slot > 0 {
            if let Some(mi) = u.major_idx {
                let md_idx = self.major_day_idx(mi, day);
                let existing = &self.major_day_units[md_idx];
                if !existing.is_empty() {
                    let mut same_course_mask = 0u128;
                    let mut other_course_mask = 0u128;
                    for other in existing {
                        if other.course_id == u.course_id {
                            same_course_mask |= other.mask;
                        } else {
                            other_course_mask |= other.mask;
                        }
                    }
                    let newly_added = combo.mask & !same_course_mask;
                    let new_conflicts = (newly_added & other_course_mask).count_ones() as i64;
                    delta += new_conflicts * w.major_only_overlap_per_slot;
                }
            }
        }

        // 4. Day load balance
        delta += w.day_load_imbalance * (self.day_load[day] as i64);

        delta
    }

    /// Computes exact room + building-switch penalty delta given an already-chosen `time_opt`.
    #[inline]
    pub fn room_delta_cost(
        &self,
        unit_idx: usize,
        time_opt: &TimeOption,
        room_opt: &RoomOption,
    ) -> i64 {
        let mut delta = room_opt.static_room_cost as i64;
        let cfg = &self.problem.config;
        if cfg.penalize_building_switches && !self.problem.units[unit_idx].is_online {
            if let (Some(ii), Some(b_id)) = (self.problem.units[unit_idx].inst_idx, room_opt.building_id) {
                let u = &self.problem.units[unit_idx];
                let combo = self.problem.combo_for(u, time_opt.combo_idx);
                let id_idx = self.inst_day_idx(ii, time_opt.day as usize);
                let existing = &self.inst_day_units[id_idx];
                if !existing.is_empty() {
                    let before = building_switch_penalty(
                        existing,
                        None,
                        cfg.max_building_transition_minutes,
                        cfg.weights.building_switch,
                    );
                    let after = building_switch_penalty(
                        existing,
                        Some(InstDayUnit {
                            unit_idx: unit_idx as u16,
                            start_min: combo.start_min,
                            end_min: combo.end_min,
                            is_online: false,
                            building_id: Some(b_id),
                        }),
                        cfg.max_building_transition_minutes,
                        cfg.weights.building_switch,
                    );
                    delta += after - before;
                }
            }
        }
        delta
    }

    pub fn place(&mut self, unit_idx: usize, time_opt_idx: usize, room_opt_idx: usize) {
        debug_assert!(self.assignments[unit_idx].is_none());
        let u = &self.problem.units[unit_idx];
        let time_opt = &u.time_options[time_opt_idx];
        let room_opt = &u.room_options[room_opt_idx];
        let combo = self.problem.combo_for(u, time_opt.combo_idx);
        let day = time_opt.day as usize;

        let delta = self.time_delta_cost(unit_idx, time_opt)
            + self.room_delta_cost(unit_idx, time_opt, room_opt);
        self.total_cost += delta;

        if let Some(ii) = u.inst_idx {
            let id_idx = self.inst_day_idx(ii, day);
            self.inst_busy[id_idx] |= combo.mask;
            self.inst_day_units[id_idx].push(InstDayUnit {
                unit_idx: unit_idx as u16,
                start_min: combo.start_min,
                end_min: combo.end_min,
                is_online: u.is_online,
                building_id: room_opt.building_id,
            });
            if self.inst_day_count[id_idx] == 0 {
                self.inst_active_days[ii] += 1;
            }
            self.inst_day_count[id_idx] += 1;
        }

        if room_opt.room_idx != NO_ROOM_SENTINEL {
            let rd_idx = self.room_day_idx(room_opt.room_idx as usize, day);
            self.room_busy[rd_idx] |= combo.mask;
        }

        let sd_idx = self.sec_day_idx(u.section_idx, day);
        self.section_day_count[sd_idx] += 1;

        if let Some(ci) = u.cohort_idx {
            let cd_idx = self.cohort_day_idx(ci, day);
            self.cohort_day_units[cd_idx].push(CohortDayUnit {
                unit_idx: unit_idx as u16,
                course_id: u.course_id,
                start_min: combo.start_min,
                end_min: combo.end_min,
                is_online: u.is_online,
                mask: combo.mask,
            });
        } else if let Some(mi) = u.major_idx {
            let md_idx = self.major_day_idx(mi, day);
            self.major_day_units[md_idx].push(MajorDayUnit {
                unit_idx: unit_idx as u16,
                course_id: u.course_id,
                mask: combo.mask,
            });
        }

        self.day_load[day] += 1;
        self.assigned_count += 1;
        self.assignments[unit_idx] = Some(Placement {
            time_opt_idx: time_opt_idx as u16,
            room_opt_idx: room_opt_idx as u16,
            day: time_opt.day,
            combo_idx: time_opt.combo_idx,
            room_idx: room_opt.room_idx,
            static_cost: time_opt.static_time_cost + room_opt.static_room_cost,
        });
    }

    pub fn unplace(&mut self, unit_idx: usize) -> Option<Placement> {
        let prev = self.assignments[unit_idx].take()?;
        let u = &self.problem.units[unit_idx];
        let time_opt = &u.time_options[prev.time_opt_idx as usize];
        let room_opt = &u.room_options[prev.room_opt_idx as usize];
        let combo = self.problem.combo_for(u, prev.combo_idx);
        let day = prev.day as usize;

        if let Some(ii) = u.inst_idx {
            let id_idx = self.inst_day_idx(ii, day);
            self.inst_busy[id_idx] &= !combo.mask;
            if let Some(pos) = self.inst_day_units[id_idx]
                .iter()
                .position(|x| x.unit_idx as usize == unit_idx)
            {
                self.inst_day_units[id_idx].swap_remove(pos);
            }
            self.inst_day_count[id_idx] -= 1;
            if self.inst_day_count[id_idx] == 0 {
                self.inst_active_days[ii] -= 1;
            }
        }

        if prev.room_idx != NO_ROOM_SENTINEL {
            let rd_idx = self.room_day_idx(prev.room_idx as usize, day);
            self.room_busy[rd_idx] &= !combo.mask;
        }

        let sd_idx = self.sec_day_idx(u.section_idx, day);
        self.section_day_count[sd_idx] -= 1;

        if let Some(ci) = u.cohort_idx {
            let cd_idx = self.cohort_day_idx(ci, day);
            if let Some(pos) = self.cohort_day_units[cd_idx]
                .iter()
                .position(|x| x.unit_idx as usize == unit_idx)
            {
                self.cohort_day_units[cd_idx].swap_remove(pos);
            }
        } else if let Some(mi) = u.major_idx {
            let md_idx = self.major_day_idx(mi, day);
            if let Some(pos) = self.major_day_units[md_idx]
                .iter()
                .position(|x| x.unit_idx as usize == unit_idx)
            {
                self.major_day_units[md_idx].swap_remove(pos);
            }
        }

        self.day_load[day] -= 1;
        self.assigned_count -= 1;

        // Removing `unit_idx` reverses the exact delta of adding it to the remaining state
        let delta = self.time_delta_cost(unit_idx, time_opt)
            + self.room_delta_cost(unit_idx, time_opt, room_opt);
        self.total_cost -= delta;

        Some(prev)
    }

    /// Best `(time_opt_idx, room_opt_idx, delta_cost)` for unassigned unit `unit_idx`.
    pub fn find_best_candidate(&self, unit_idx: usize) -> Option<(usize, usize, i64)> {
        let u = &self.problem.units[unit_idx];
        let mut best: Option<(usize, usize, i64)> = None;

        for (t_idx, to) in u.time_options.iter().enumerate() {
            if let Some((_, _, best_d)) = best {
                // Lower bound on time delta without other dynamic terms? No lower bound is negative unless unassigned_unit
                // Note `time_delta_cost` starts at `-unassigned_unit + static_time_cost` >= best_d only if room_delta >= 0,
                // wait: we can still compute fast and accurately:
                let _ = best_d;
            }
            if !self.can_place_time_hard(unit_idx, to) {
                continue;
            }
            let t_delta = self.time_delta_cost(unit_idx, to);
            let combo_mask = self.problem.combo_for(u, to.combo_idx).mask;

            // If we don't care about building switches or building switch isn't active, the FIRST free room is optimal!
            if !self.problem.config.penalize_building_switches || u.is_online || u.inst_idx.is_none()
            {
                for (r_idx, ro) in u.room_options.iter().enumerate() {
                    if self.can_place_room_hard(unit_idx, to.day, combo_mask, ro) {
                        let d = t_delta + ro.static_room_cost as i64;
                        if best.map_or(true, |(_, _, bd)| d < bd) {
                            best = Some((t_idx, r_idx, d));
                        }
                        break; // room_options is sorted by static_room_cost!
                    }
                }
            } else {
                // Building switch depends on which room building is picked; still bounded: once an exact zero-switch room is found
                // OR static_room_cost already exceeds best_delta, we can stop early!
                let mut best_for_time: Option<(usize, i64)> = None;
                for (r_idx, ro) in u.room_options.iter().enumerate() {
                    if let Some((_, b_rd)) = best_for_time {
                        if (ro.static_room_cost as i64) >= b_rd {
                            break;
                        }
                    }
                    if !self.can_place_room_hard(unit_idx, to.day, combo_mask, ro) {
                        continue;
                    }
                    let rd = self.room_delta_cost(unit_idx, to, ro);
                    if best_for_time.map_or(true, |(_, b)| rd < b) {
                        best_for_time = Some((r_idx, rd));
                    }
                }
                if let Some((r_idx, rd)) = best_for_time {
                    let d = t_delta + rd;
                    if best.map_or(true, |(_, _, bd)| d < bd) {
                        best = Some((t_idx, r_idx, d));
                    }
                }
            }
        }

        best
    }

    pub fn recompute_full_cost(&self) -> i64 {
        let cfg = &self.problem.config;
        let w = &cfg.weights;
        let unassigned = self.problem.units.len() - self.assigned_count;
        let mut total = (unassigned as i64) * w.unassigned_unit;

        for (u_idx, pl_opt) in self.assignments.iter().enumerate() {
            if let Some(pl) = pl_opt {
                let u = &self.problem.units[u_idx];
                total += u.time_options[pl.time_opt_idx as usize].static_time_cost as i64;
                total += u.room_options[pl.room_opt_idx as usize].static_room_cost as i64;
            }
        }

        for &cnt in &self.section_day_count {
            if cnt > 1 {
                total += (cnt as i64 - 1) * w.same_section_same_day;
            }
        }

        for ii in 0..self.problem.instructors.len() {
            if self.problem.instructors[ii].is_part_time && self.inst_active_days[ii] > 1 {
                total += (self.inst_active_days[ii] as i64 - 1) * w.part_time_day_scatter;
            }
            for day in 0..self.num_days {
                let units = &self.inst_day_units[self.inst_day_idx(ii, day)];
                if !units.is_empty() {
                    // Pairwise online/offline proximity
                    for i in 0..units.len() {
                        for j in (i + 1)..units.len() {
                            if units[i].is_online != units[j].is_online
                                && interval_gap(
                                    units[i].start_min,
                                    units[i].end_min,
                                    units[j].start_min,
                                    units[j].end_min,
                                ) < cfg.min_online_offline_gap_minutes
                            {
                                total += w.online_offline_proximity;
                            }
                        }
                    }
                    total += consecutive_excess_penalty(
                        units,
                        None,
                        cfg.max_adjacent_gap_minutes,
                        cfg.max_consecutive_hours,
                        w.over_consecutive_hour,
                    );
                    if cfg.penalize_building_switches {
                        total += building_switch_penalty(
                            units,
                            None,
                            cfg.max_building_transition_minutes,
                            w.building_switch,
                        );
                    }
                }
            }
        }

        for ci in 0..self.problem.num_cohorts {
            for day in 0..self.num_days {
                let units = &self.cohort_day_units[self.cohort_day_idx(ci, day)];
                if units.len() > 1 {
                    for i in 0..units.len() {
                        for j in (i + 1)..units.len() {
                            if units[i].course_id != units[j].course_id
                                && units[i].is_online != units[j].is_online
                                && interval_gap(
                                    units[i].start_min,
                                    units[i].end_min,
                                    units[j].start_min,
                                    units[j].end_min,
                                ) < cfg.min_online_offline_gap_minutes
                            {
                                total += w.online_offline_proximity;
                            }
                        }
                    }
                    if cfg.avoid_cohort_overlap {
                        total += distinct_course_overlap_slots_cohort(units)
                            * w.cohort_overlap_per_slot;
                    }
                }
            }
        }

        if cfg.avoid_cohort_overlap && w.major_only_overlap_per_slot > 0 {
            for mi in 0..self.problem.num_majors {
                for day in 0..self.num_days {
                    let units = &self.major_day_units[self.major_day_idx(mi, day)];
                    if units.len() > 1 {
                        total += distinct_course_overlap_slots_major(units)
                            * w.major_only_overlap_per_slot;
                    }
                }
            }
        }

        for &load in &self.day_load {
            let l = load as i64;
            if l > 1 {
                total += (l * (l - 1) / 2) * w.day_load_imbalance;
            }
        }

        total
    }

    pub fn compute_breakdown(&self) -> ObjectiveBreakdown {
        let cfg = &self.problem.config;
        let mut bd = ObjectiveBreakdown::default();
        bd.unassigned_count = self.problem.units.len() - self.assigned_count;

        for (u_idx, pl_opt) in self.assignments.iter().enumerate() {
            if let Some(pl) = pl_opt {
                let u = &self.problem.units[u_idx];
                let to = &u.time_options[pl.time_opt_idx as usize];
                let ro = &u.room_options[pl.room_opt_idx as usize];
                let combo = self.problem.combo_for(u, pl.combo_idx);

                if to.is_outside_pref {
                    bd.outside_preferred_slot_violations += 1;
                }
                if !ro.matches_type {
                    bd.classroom_type_mismatches += 1;
                }
                if !ro.matches_specific {
                    bd.specific_classroom_mismatches += 1;
                }
                if combo.kind != ComboKind::Continuous {
                    bd.gapped_assignments += 1;
                }
                bd.total_seat_waste += ro.seat_waste as i64;
            }
        }

        for &cnt in &self.section_day_count {
            if cnt > 1 {
                bd.same_section_same_day_violations += (cnt - 1) as usize;
            }
        }

        for ii in 0..self.problem.instructors.len() {
            for day in 0..self.num_days {
                let units = &self.inst_day_units[self.inst_day_idx(ii, day)];
                if !units.is_empty() {
                    for i in 0..units.len() {
                        for j in (i + 1)..units.len() {
                            if units[i].is_online != units[j].is_online
                                && interval_gap(
                                    units[i].start_min,
                                    units[i].end_min,
                                    units[j].start_min,
                                    units[j].end_min,
                                ) < cfg.min_online_offline_gap_minutes
                            {
                                bd.online_offline_proximity_violations += 1;
                            }
                        }
                    }
                    if consecutive_excess_penalty(
                        units,
                        None,
                        cfg.max_adjacent_gap_minutes,
                        cfg.max_consecutive_hours,
                        1,
                    ) > 0
                    {
                        bd.over_consecutive_violations += 1;
                    }
                    if cfg.penalize_building_switches {
                        bd.building_switches += building_switch_penalty(
                            units,
                            None,
                            cfg.max_building_transition_minutes,
                            1,
                        ) as usize;
                    }
                }
            }
        }

        for ci in 0..self.problem.num_cohorts {
            for day in 0..self.num_days {
                let units = &self.cohort_day_units[self.cohort_day_idx(ci, day)];
                if units.len() > 1 {
                    for i in 0..units.len() {
                        for j in (i + 1)..units.len() {
                            if units[i].course_id != units[j].course_id
                                && units[i].is_online != units[j].is_online
                                && interval_gap(
                                    units[i].start_min,
                                    units[i].end_min,
                                    units[j].start_min,
                                    units[j].end_min,
                                ) < cfg.min_online_offline_gap_minutes
                            {
                                bd.online_offline_proximity_violations += 1;
                            }
                        }
                    }
                    bd.cohort_overlap_slots +=
                        distinct_course_overlap_slots_cohort(units) as usize;
                }
            }
        }

        bd
    }

    pub fn extract_outputs(
        &self,
    ) -> (Vec<AssignmentOutput>, Vec<FailedUnitOutput>, Vec<SchedulingError>) {
        let mut assignments = Vec::with_capacity(self.assigned_count);
        let mut failed_units = Vec::new();
        let mut errors = Vec::new();

        for (u_idx, u) in self.problem.units.iter().enumerate() {
            let inst_name = u
                .inst_idx
                .map(|ii| self.problem.instructors[ii].name.clone())
                .unwrap_or_else(|| "Unassigned".to_string());

            if let Some(pl) = self.assignments[u_idx] {
                let ro = &u.room_options[pl.room_opt_idx as usize];
                let combo = self.problem.combo_for(u, pl.combo_idx);
                let (classroom_id, classroom_code, classroom_location) =
                    if ro.room_idx == NO_ROOM_SENTINEL {
                        (-1, "Online".to_string(), None)
                    } else {
                        let room = &self.problem.classrooms[ro.room_idx as usize];
                        (room.id, room.code.clone(), room.location.clone())
                    };

                assignments.push(AssignmentOutput {
                    unit_index: u.unit_index,
                    course_id: u.course_id,
                    section_id: u.section_id,
                    section_number: u.section_number.clone(),
                    course_hours_id: u.course_hours_id,
                    course_code: u.course_code.clone(),
                    course_title: u.course_title.clone(),
                    course_color: u.course_color.clone(),
                    instructor_id: u
                        .inst_idx
                        .map(|ii| self.problem.instructors[ii].id)
                        .unwrap_or(0),
                    instructor_name: inst_name,
                    is_online: u.is_online,
                    day: self.problem.days[pl.day as usize].clone(),
                    start_time: format_minutes(combo.start_min),
                    end_time: format_minutes(combo.end_min),
                    slot_indices: combo.slot_indices.iter().map(|&x| x as usize).collect(),
                    duration_hours: u.duration_hours,
                    classroom_id,
                    classroom_code,
                    classroom_location,
                    is_continuous: combo.kind == ComboKind::Continuous,
                    satisfied_classroom_preference: ro.matches_specific && ro.matches_type,
                });
            } else {
                failed_units.push(FailedUnitOutput {
                    unit_index: u.unit_index,
                    section_id: u.section_id,
                    section_number: u.section_number.clone(),
                    course_id: u.course_id,
                    course_code: u.course_code.clone(),
                    course_hours_id: u.course_hours_id,
                    duration_hours: u.duration_hours,
                });
                errors.push(self.diagnose_failure(u_idx, &inst_name));
            }
        }

        (assignments, failed_units, errors)
    }

    fn diagnose_failure(&self, unit_idx: usize, inst_name: &str) -> SchedulingError {
        let u = &self.problem.units[unit_idx];
        let (error_type, error_message, details) = match &u.static_issue {
            StaticUnitIssue::DurationMismatch { required } => (
                SchedulingErrorType::DurationMismatch,
                format!(
                    "No time slot combinations found for {} ({:.2}h duration)",
                    u.section_number, required
                ),
                Some(SchedulingErrorDetails {
                    required_duration: Some(*required),
                    ..Default::default()
                }),
            ),
            StaticUnitIssue::CapacityConstraint {
                required,
                max_available,
            } => (
                SchedulingErrorType::CapacityConstraint,
                format!(
                    "No classroom has sufficient capacity for {} students (max available: {})",
                    required, max_available
                ),
                Some(SchedulingErrorDetails {
                    required_capacity: Some(*required),
                    available_capacity: Some(*max_available),
                    ..Default::default()
                }),
            ),
            StaticUnitIssue::TimeConstraint { .. } => (
                SchedulingErrorType::TimeConstraint,
                format!(
                    "Instructor {} is unavailable across all valid time slots for {}h",
                    inst_name, u.duration_hours
                ),
                Some(SchedulingErrorDetails {
                    required_duration: Some(u.duration_hours),
                    ..Default::default()
                }),
            ),
            StaticUnitIssue::InvalidLockedAssignment { reason } => (
                SchedulingErrorType::UnknownError,
                format!("Invalid locked assignment: {reason}"),
                None,
            ),
            StaticUnitIssue::None => {
                // Static options exist, so failure happened dynamically due to resource contention
                let mut had_any_time_feasible = false;
                for to in &u.time_options {
                    if self.can_place_time_hard(unit_idx, to) {
                        had_any_time_feasible = true;
                        break;
                    }
                }
                if !had_any_time_feasible {
                    (
                        SchedulingErrorType::InstructorConflict,
                        format!(
                            "All remaining time options conflict with existing schedule for {} (instructor/section constraints)",
                            inst_name
                        ),
                        Some(SchedulingErrorDetails {
                            required_duration: Some(u.duration_hours),
                            conflicting_instructor: Some(inst_name.to_string()),
                            ..Default::default()
                        }),
                    )
                } else {
                    (
                        SchedulingErrorType::NoClassroom,
                        format!(
                            "No capacity-suitable classroom ({} seats) is free during any feasible time slot",
                            u.capacity
                        ),
                        Some(SchedulingErrorDetails {
                            required_capacity: Some(u.capacity),
                            total_suitable_classrooms: Some(u.room_options.len()),
                            ..Default::default()
                        }),
                    )
                }
            }
        };

        SchedulingError {
            section_id: u.section_id,
            section_number: u.section_number.clone(),
            course_code: u.course_code.clone(),
            course_title: u.course_title.clone(),
            instructor_name: inst_name.to_string(),
            error_type,
            error_message,
            details,
        }
    }
}

#[inline]
pub fn interval_gap(a_start: u16, a_end: u16, b_start: u16, b_end: u16) -> u16 {
    if a_end <= b_start {
        b_start - a_end
    } else if b_end <= a_start {
        a_start - b_end
    } else {
        0
    }
}

fn consecutive_excess_penalty(
    existing: &[InstDayUnit],
    extra: Option<InstDayUnit>,
    max_adjacent_gap: u16,
    max_consecutive_hours: f64,
    weight_per_hour: i64,
) -> i64 {
    if weight_per_hour == 0 {
        return 0;
    }
    let max_consec_min = (max_consecutive_hours * 60.0).round() as i64;
    if max_consec_min <= 0 {
        return 0;
    }

    let mut items: SmallVec<[InstDayUnit; 12]> = SmallVec::from_slice(existing);
    if let Some(ex) = extra {
        items.push(ex);
    }
    if items.len() <= 1 {
        let single_dur = items.first().map_or(0, |x| (x.end_min - x.start_min) as i64);
        if single_dur > max_consec_min {
            return ((single_dur - max_consec_min) * weight_per_hour) / 60;
        }
        return 0;
    }

    items.sort_unstable_by_key(|x| (x.start_min, x.end_min));

    let mut penalty = 0i64;
    let mut block_active_min = (items[0].end_min - items[0].start_min) as i64;
    let mut prev_end = items[0].end_min;

    for it in items.iter().skip(1) {
        let gap = it.start_min.saturating_sub(prev_end);
        let dur = (it.end_min - it.start_min) as i64;
        if gap <= max_adjacent_gap {
            block_active_min += dur;
            if it.end_min > prev_end {
                prev_end = it.end_min;
            }
        } else {
            if block_active_min > max_consec_min {
                penalty += ((block_active_min - max_consec_min) * weight_per_hour) / 60;
            }
            block_active_min = dur;
            prev_end = it.end_min;
        }
    }
    if block_active_min > max_consec_min {
        penalty += ((block_active_min - max_consec_min) * weight_per_hour) / 60;
    }

    penalty
}

fn building_switch_penalty(
    existing: &[InstDayUnit],
    extra: Option<InstDayUnit>,
    max_transition_minutes: u16,
    weight_per_switch: i64,
) -> i64 {
    if weight_per_switch == 0 {
        return 0;
    }
    let mut items: SmallVec<[InstDayUnit; 12]> = SmallVec::new();
    for x in existing {
        if !x.is_online && x.building_id.is_some() {
            items.push(*x);
        }
    }
    if let Some(ex) = extra {
        if !ex.is_online && ex.building_id.is_some() {
            items.push(ex);
        }
    }
    if items.len() <= 1 {
        return 0;
    }
    items.sort_unstable_by_key(|x| (x.start_min, x.end_min));

    let mut switches = 0i64;
    for w in items.windows(2) {
        let gap = w[1].start_min.saturating_sub(w[0].end_min);
        if gap <= max_transition_minutes && w[0].building_id != w[1].building_id {
            switches += 1;
        }
    }
    switches * weight_per_switch
}

fn distinct_course_overlap_slots_cohort(units: &[CohortDayUnit]) -> i64 {
    let mut seen_courses: SmallVec<[(i64, u128); 12]> = SmallVec::new();
    for u in units {
        if let Some((_, mask)) = seen_courses.iter_mut().find(|(cid, _)| *cid == u.course_id) {
            *mask |= u.mask;
        } else {
            seen_courses.push((u.course_id, u.mask));
        }
    }
    sum_mask_overlaps(&seen_courses)
}

fn distinct_course_overlap_slots_major(units: &[MajorDayUnit]) -> i64 {
    let mut seen_courses: SmallVec<[(i64, u128); 16]> = SmallVec::new();
    for u in units {
        if let Some((_, mask)) = seen_courses.iter_mut().find(|(cid, _)| *cid == u.course_id) {
            *mask |= u.mask;
        } else {
            seen_courses.push((u.course_id, u.mask));
        }
    }
    sum_mask_overlaps(&seen_courses)
}

fn sum_mask_overlaps(seen_courses: &[(i64, u128)]) -> i64 {
    if seen_courses.len() <= 1 {
        return 0;
    }
    let mut union_once = 0u128;
    let mut overlap_slots = 0i64;
    for &(_, mask) in seen_courses {
        let inter = union_once & mask;
        overlap_slots += inter.count_ones() as i64;
        union_once |= mask;
    }
    // Wait: if 3 courses cover slot s, `inter` triggers once for course 2 (+1) and once for course 3 (+1) => total +2 == (3 - 1)!
    overlap_slots
}

#[allow(dead_code)]
fn _compare_opt(a: Option<i64>, b: Option<i64>) -> Ordering {
    match (a, b) {
        (Some(x), Some(y)) => x.cmp(&y),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}
