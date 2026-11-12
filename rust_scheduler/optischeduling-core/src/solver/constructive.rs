use rand::rngs::SmallRng;
use rand::seq::SliceRandom;
use rand::{Rng, SeedableRng};
use smallvec::SmallVec;

use super::state::{
    interval_gap, Placement, PreparedProblem, ScheduleState, StaticUnitIssue, NO_ROOM_SENTINEL,
};

pub struct ConstructiveResult<'a> {
    pub state: ScheduleState<'a>,
    pub ejection_repairs: usize,
}

/// Computes deterministic MRV + Part-Time-First unit ordering.
/// If `rng_seed` is `Some(seed)`, adds light tie-break jitter for multi-start diversity.
pub fn order_units(problem: &PreparedProblem, rng_seed: Option<u64>) -> Vec<usize> {
    let mut locked = Vec::new();
    let mut active = Vec::new();

    for (idx, u) in problem.units.iter().enumerate() {
        if u.static_issue != StaticUnitIssue::None {
            continue;
        }
        if u.is_locked {
            locked.push(idx);
        } else {
            active.push(idx);
        }
    }

    let mut rng = rng_seed.map(SmallRng::seed_from_u64);
    let mut jitter: Vec<u32> = if let Some(ref mut r) = rng {
        (0..problem.units.len())
            .map(|_| r.gen_range(0..8))
            .collect()
    } else {
        vec![0; problem.units.len()]
    };
    let _ = &mut jitter;

    active.sort_by_key(|&idx| {
        let u = &problem.units[idx];
        let is_pt = u
            .inst_idx
            .map(|ii| problem.instructors[ii].is_part_time)
            .unwrap_or(false);
        let pt_tier: u8 = if problem.config.prioritize_part_time && is_pt {
            0
        } else {
            1
        };
        let domain_est = u
            .time_options
            .len()
            .saturating_mul(u.room_options.len().max(1));
        let domain_bucket = if rng_seed.is_some() {
            domain_est / 4 + jitter[idx] as usize
        } else {
            domain_est
        };
        let dur_key = -((u.duration_hours * 100.0).round() as i64);
        let split_priority = if problem.section_units_count[u.section_idx] > 1 {
            0u8
        } else {
            1u8
        };
        (
            pt_tier,
            split_priority,
            domain_bucket,
            dur_key,
            -u.capacity,
            idx,
        )
    });

    locked.extend(active);
    locked
}

/// Runs MRV + Part-Time-First constructive greedy placement followed by ejection-chain repair.
pub fn solve_greedy_repair<'a>(
    problem: &'a PreparedProblem,
    rng_seed: Option<u64>,
    max_repair_depth: usize,
) -> ConstructiveResult<'a> {
    let mut state = ScheduleState::new(problem);
    let ordered = order_units(problem, rng_seed);
    let mut failed: Vec<usize> = Vec::new();
    let mut repairs = 0usize;

    let randomize_ties = rng_seed.is_some();
    let mut rng = rng_seed.map(SmallRng::seed_from_u64);

    for &u_idx in &ordered {
        if let Some((t_idx, r_idx, _)) = pick_candidate(&state, u_idx, randomize_ties, rng.as_mut())
        {
            state.place(u_idx, t_idx, r_idx);
        } else {
            failed.push(u_idx);
        }
    }

    // Also try randomized shuffle on repair order if multi-start
    if randomize_ties && failed.len() > 1 {
        if let Some(ref mut r) = rng {
            failed.shuffle(r);
        }
    }

    // Ejection-chain / Kempe repair pass for any unit blocked during initial greedy placement
    let mut remaining_after_pass = Vec::new();
    for &u_idx in &failed {
        if let Some((t_idx, r_idx, _)) = state.find_best_candidate(u_idx) {
            state.place(u_idx, t_idx, r_idx);
            continue;
        }
        let mut protected = vec![false; problem.units.len()];
        if try_ejection_repair(&mut state, u_idx, 0, max_repair_depth, &mut protected) {
            repairs += 1;
        } else {
            remaining_after_pass.push(u_idx);
        }
    }

    // Second pass in case earlier ejection freed room/time for a later failed unit
    for &u_idx in &remaining_after_pass {
        if state.assignments[u_idx].is_some() {
            continue;
        }
        if let Some((t_idx, r_idx, _)) = state.find_best_candidate(u_idx) {
            state.place(u_idx, t_idx, r_idx);
        } else {
            let mut protected = vec![false; problem.units.len()];
            if try_ejection_repair(&mut state, u_idx, 0, max_repair_depth, &mut protected) {
                repairs += 1;
            }
        }
    }

    // Fast 1-opt coordinate descent polish (strictly improving soft costs)
    greedy_local_polish(&mut state, 2);

    ConstructiveResult {
        state,
        ejection_repairs: repairs,
    }
}

fn pick_candidate(
    state: &ScheduleState<'_>,
    unit_idx: usize,
    with_diversity: bool,
    mut rng: Option<&mut SmallRng>,
) -> Option<(usize, usize, i64)> {
    if !with_diversity {
        return state.find_best_candidate(unit_idx);
    }
    let rng = rng.take()?;
    let u = &state.problem.units[unit_idx];
    let mut top: SmallVec<[(usize, usize, i64); 4]> = SmallVec::new();

    for (t_idx, to) in u.time_options.iter().enumerate() {
        if !state.can_place_time_hard(unit_idx, to) {
            continue;
        }
        let t_delta = state.time_delta_cost(unit_idx, to);
        let mask = state.problem.combo_for(u, to.combo_idx).mask;
        for (r_idx, ro) in u.room_options.iter().enumerate() {
            if state.can_place_room_hard(unit_idx, to.day, mask, ro) {
                let d = t_delta + state.room_delta_cost(unit_idx, to, ro);
                if top.len() < 3 {
                    top.push((t_idx, r_idx, d));
                    top.sort_unstable_by_key(|x| x.2);
                } else if d < top[2].2 {
                    top[2] = (t_idx, r_idx, d);
                    top.sort_unstable_by_key(|x| x.2);
                }
                break;
            }
        }
    }

    if top.is_empty() {
        None
    } else if rng.gen_bool(0.75) {
        Some(top[0])
    } else {
        Some(top[rng.gen_range(0..top.len())])
    }
}

/// Deterministic coordinate descent moving each assigned non-locked unit if a strictly better slot exists.
pub fn greedy_local_polish(state: &mut ScheduleState<'_>, max_passes: usize) {
    let n = state.problem.units.len();
    for _ in 0..max_passes {
        let mut improved = false;
        for u_idx in 0..n {
            if state.problem.units[u_idx].is_locked {
                continue;
            }
            let Some(old_pl) = state.unplace(u_idx) else {
                continue;
            };
            let prev_cost_diff = {
                // Cost right now is with u_idx unplaced. Note old_pl gave total_cost_with_old;
                // we just compare find_best_candidate delta against re-placing old_pl directly.
                // Let's compare cleanly using `total_cost` by recording `cost_with_old` before unplace.
                0i64
            };
            let _ = prev_cost_diff;

            let best = state.find_best_candidate(u_idx);
            // Temporarily evaluate old_pl's delta in current state:
            let to_old = &state.problem.units[u_idx].time_options[old_pl.time_opt_idx as usize];
            let ro_old = &state.problem.units[u_idx].room_options[old_pl.room_opt_idx as usize];
            let old_delta =
                state.time_delta_cost(u_idx, to_old) + state.room_delta_cost(u_idx, to_old, ro_old);

            if let Some((bt, br, bd)) = best {
                if bd < old_delta {
                    state.place(u_idx, bt, br);
                    improved = true;
                    continue;
                }
            }
            state.place(
                u_idx,
                old_pl.time_opt_idx as usize,
                old_pl.room_opt_idx as usize,
            );
        }
        if !improved {
            break;
        }
    }
}

/// Attempts to place unassigned `unit_idx` by evicting 1..=2 conflicting non-locked units
/// and recursively relocating them up to `max_depth`.
pub fn try_ejection_repair(
    state: &mut ScheduleState<'_>,
    unit_idx: usize,
    depth: usize,
    max_depth: usize,
    protected: &mut [bool],
) -> bool {
    if state.assignments[unit_idx].is_some() {
        return true;
    }

    // Base try: direct placement without eviction
    if let Some((t_idx, r_idx, _)) = state.find_best_candidate(unit_idx) {
        state.place(unit_idx, t_idx, r_idx);
        return true;
    }

    if depth >= max_depth {
        return false;
    }

    let u = &state.problem.units[unit_idx];
    if u.is_locked || u.time_options.is_empty() || u.room_options.is_empty() {
        return false;
    }

    protected[unit_idx] = true;

    let time_limit = u.time_options.len().min(if depth == 0 { 24 } else { 12 });
    let room_limit = u.room_options.len().min(if depth == 0 { 6 } else { 3 });

    for t_idx in 0..time_limit {
        for r_idx in 0..room_limit {
            let mut blockers: SmallVec<[usize; 4]> = SmallVec::new();
            let mut blocked_by_hard_limit = false;

            collect_blockers(
                state,
                unit_idx,
                t_idx,
                r_idx,
                protected,
                &mut blockers,
                &mut blocked_by_hard_limit,
            );

            if blocked_by_hard_limit || blockers.is_empty() || blockers.len() > 2 {
                continue;
            }
            if depth > 0 && blockers.len() > 1 {
                continue;
            }

            // Save and unplace all blockers
            let mut saved: SmallVec<[(usize, Placement); 4]> = SmallVec::new();
            for &b in &blockers {
                if let Some(pl) = state.unplace(b) {
                    saved.push((b, pl));
                }
            }

            // Place target unit now that blockers were evicted
            let to = &state.problem.units[unit_idx].time_options[t_idx];
            let ro = &state.problem.units[unit_idx].room_options[r_idx];
            let mask = state
                .problem
                .combo_for(&state.problem.units[unit_idx], to.combo_idx)
                .mask;
            let placeable_now = state.can_place_time_hard(unit_idx, to)
                && state.can_place_room_hard(unit_idx, to.day, mask, ro);

            if placeable_now {
                state.place(unit_idx, t_idx, r_idx);

                let mut all_ok = true;
                for &(b, _) in &saved {
                    if !try_ejection_repair(state, b, depth + 1, max_depth, protected) {
                        all_ok = false;
                        break;
                    }
                }

                if all_ok {
                    protected[unit_idx] = false;
                    return true;
                }

                // Rollback any relocated blockers before restoring originals
                for &(b, _) in &saved {
                    let _ = state.unplace(b);
                }
                let _ = state.unplace(unit_idx);
            }

            // Restore exact original blocker placements
            for (b, pl) in saved {
                state.place(b, pl.time_opt_idx as usize, pl.room_opt_idx as usize);
            }
        }
    }

    protected[unit_idx] = false;
    false
}

fn collect_blockers(
    state: &ScheduleState<'_>,
    unit_idx: usize,
    t_idx: usize,
    r_idx: usize,
    protected: &[bool],
    blockers: &mut SmallVec<[usize; 4]>,
    impossible: &mut bool,
) {
    let problem = state.problem;
    let u = &problem.units[unit_idx];
    let to = &u.time_options[t_idx];
    let ro = &u.room_options[r_idx];
    let combo = problem.combo_for(u, to.combo_idx);
    let day = to.day as usize;

    let mut push_blocker = |b: usize| -> bool {
        if problem.units[b].is_locked || protected[b] {
            return false;
        }
        if !blockers.contains(&b) {
            blockers.push(b);
        }
        blockers.len() <= 2
    };

    // 1. Same section same day (when hard)
    if problem.section_hard_separate[u.section_idx] {
        let sec_base = u.section_idx * state.num_days + day;
        if state.section_day_count[sec_base] > 0 {
            for (other_idx, pl_opt) in state.assignments.iter().enumerate() {
                if let Some(pl) = pl_opt {
                    if problem.units[other_idx].section_idx == u.section_idx
                        && pl.day == to.day
                        && !push_blocker(other_idx)
                    {
                        *impossible = true;
                        return;
                    }
                }
            }
        }
    }

    // 2. Instructor conflicts (time overlap + hard online/offline gap)
    if let Some(ii) = u.inst_idx {
        let id_idx = ii * state.num_days + day;
        for other in &state.inst_day_units[id_idx] {
            let o_idx = other.unit_idx as usize;
            let o_pl = state.assignments[o_idx].unwrap();
            let o_mask = problem
                .combo_for(&problem.units[o_idx], o_pl.combo_idx)
                .mask;
            let time_clash = (o_mask & combo.mask) != 0;
            let gap_clash = problem.config.enforce_online_offline_gap
                && other.is_online != u.is_online
                && interval_gap(
                    combo.start_min,
                    combo.end_min,
                    other.start_min,
                    other.end_min,
                ) < problem.config.min_online_offline_gap_minutes;

            if (time_clash || gap_clash) && !push_blocker(o_idx) {
                *impossible = true;
                return;
            }
        }
    }

    // 3. Cohort hard online/offline gap
    if problem.config.enforce_online_offline_gap {
        if let Some(ci) = u.cohort_idx {
            let cd_idx = ci * state.num_days + day;
            for other in &state.cohort_day_units[cd_idx] {
                if other.course_id != u.course_id
                    && other.is_online != u.is_online
                    && interval_gap(
                        combo.start_min,
                        combo.end_min,
                        other.start_min,
                        other.end_min,
                    ) < problem.config.min_online_offline_gap_minutes
                    && !push_blocker(other.unit_idx as usize)
                {
                    *impossible = true;
                    return;
                }
            }
        }
    }

    // 4. Physical classroom conflict
    if ro.room_idx != NO_ROOM_SENTINEL {
        let rd_idx = ro.room_idx as usize * state.num_days + day;
        if (state.room_busy[rd_idx] & combo.mask) != 0 {
            for (other_idx, pl_opt) in state.assignments.iter().enumerate() {
                if let Some(pl) = pl_opt {
                    if pl.day == to.day && pl.room_idx == ro.room_idx {
                        let o_mask = problem
                            .combo_for(&problem.units[other_idx], pl.combo_idx)
                            .mask;
                        if (o_mask & combo.mask) != 0 && !push_blocker(other_idx) {
                            *impossible = true;
                            return;
                        }
                    }
                }
            }
        }
    }
}
