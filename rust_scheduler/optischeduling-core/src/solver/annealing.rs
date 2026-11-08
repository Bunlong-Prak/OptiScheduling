use std::thread;
use std::time::{Duration, Instant};

use rand::rngs::SmallRng;
use rand::seq::SliceRandom;
use rand::{Rng, SeedableRng};

use super::constructive::{greedy_local_polish, solve_greedy_repair, try_ejection_repair};
use super::state::{PreparedProblem, ScheduleState, StaticUnitIssue};

pub struct AnnealingResult<'a> {
    pub state: ScheduleState<'a>,
    pub total_iterations: u64,
    pub threads_used: usize,
    pub ejection_repairs: usize,
}

pub fn solve_annealing<'a>(
    problem: &'a PreparedProblem,
    time_budget_ms: u64,
    base_seed: u64,
    requested_threads: usize,
) -> AnnealingResult<'a> {
    let budget = Duration::from_millis(time_budget_ms.max(5));
    let start = Instant::now();
    let deadline = start + budget;

    let movable: Vec<usize> = problem
        .units
        .iter()
        .enumerate()
        .filter(|(_, u)| !u.is_locked && u.static_issue == StaticUnitIssue::None)
        .map(|(i, _)| i)
        .collect();

    if movable.is_empty() {
        let res = solve_greedy_repair(problem, None, 3);
        return AnnealingResult {
            state: res.state,
            total_iterations: 0,
            threads_used: 1,
            ejection_repairs: res.ejection_repairs,
        };
    }

    let auto_threads = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(2)
        .clamp(1, 4);
    let mut threads_used = if requested_threads == 0 {
        auto_threads
    } else {
        requested_threads.clamp(1, 16)
    };
    if movable.len() < 12 || time_budget_ms < 15 {
        threads_used = 1;
    }

    let mut worker_results: Vec<(ScheduleState<'a>, u64, usize)> = Vec::with_capacity(threads_used);

    if threads_used == 1 {
        worker_results.push(run_worker(
            problem,
            &movable,
            0,
            base_seed,
            start,
            deadline,
        ));
    } else {
        thread::scope(|scope| {
            let mut handles = Vec::with_capacity(threads_used);
            for tid in 0..threads_used {
                let movable_ref = &movable;
                handles.push(scope.spawn(move || {
                    run_worker(
                        problem,
                        movable_ref,
                        tid,
                        base_seed.wrapping_add((tid as u64).wrapping_mul(0x9e3779b97f4a7c15)),
                        start,
                        deadline,
                    )
                }));
            }
            for h in handles {
                if let Ok(r) = h.join() {
                    worker_results.push(r);
                }
            }
        });
    }

    let mut total_iterations = 0u64;
    let mut total_repairs = 0usize;
    let mut best_state_opt: Option<ScheduleState<'a>> = None;

    for (st, iters, rep) in worker_results {
        total_iterations += iters;
        total_repairs += rep;
        match &best_state_opt {
            None => best_state_opt = Some(st),
            Some(cur) => {
                if is_better(&st, cur) {
                    best_state_opt = Some(st);
                }
            }
        }
    }

    let mut best_state = best_state_opt.unwrap_or_else(|| solve_greedy_repair(problem, None, 3).state);
    greedy_local_polish(&mut best_state, 3);

    AnnealingResult {
        state: best_state,
        total_iterations,
        threads_used,
        ejection_repairs: total_repairs,
    }
}

#[inline]
fn is_better(a: &ScheduleState<'_>, b: &ScheduleState<'_>) -> bool {
    a.assigned_count > b.assigned_count
        || (a.assigned_count == b.assigned_count && a.total_cost < b.total_cost)
}

fn run_worker<'a>(
    problem: &'a PreparedProblem,
    movable: &[usize],
    tid: usize,
    seed: u64,
    start: Instant,
    deadline: Instant,
) -> (ScheduleState<'a>, u64, usize) {
    let init = if tid == 0 {
        solve_greedy_repair(problem, None, 3)
    } else {
        solve_greedy_repair(problem, Some(seed), 2)
    };

    let mut current = init.state;
    let mut best = current.clone();
    let mut repairs = init.ejection_repairs;
    let mut rng = SmallRng::seed_from_u64(seed ^ 0x517cc1b727220a95);

    let total_ns = deadline.saturating_duration_since(start).as_nanos().max(1) as f64;
    let t_start = 1400.0_f64;
    let t_end = 8.0_f64;
    let t_ratio = t_end / t_start;

    let mut iters = 0u64;
    let mut temp = t_start;
    let n_movable = movable.len();
    let assignable_total = problem
        .units
        .iter()
        .filter(|u| u.static_issue == StaticUnitIssue::None)
        .count();

    while (iters & 63) != 0 || Instant::now() < deadline {
        if (iters & 63) == 0 {
            let elapsed_ns = Instant::now().saturating_duration_since(start).as_nanos() as f64;
            let progress = (elapsed_ns / total_ns).clamp(0.0, 1.0);
            temp = t_start * t_ratio.powf(progress);
        }

        iters += 1;

        let roll: u8 = rng.gen_range(0..100);
        if roll < 58 {
            // Single-unit Relocate (sampled best-of-K or guided)
            let u_idx = movable[rng.gen_range(0..n_movable)];
            let cost_before = current.total_cost;
            let old_pl = current.unplace(u_idx);

            let picked = if old_pl.is_none() || rng.gen_bool(0.18) {
                current.find_best_candidate(u_idx)
            } else {
                sample_best_of_k(&current, u_idx, 10, &mut rng)
            };

            if let Some((nt, nr, _)) = picked {
                current.place(u_idx, nt, nr);
                let delta = current.total_cost - cost_before;
                if accept_metropolis(delta, temp, &mut rng) {
                    if is_better(&current, &best) {
                        best = current.clone();
                    }
                } else {
                    let _ = current.unplace(u_idx);
                    if let Some(pl) = old_pl {
                        current.place(u_idx, pl.time_opt_idx as usize, pl.room_opt_idx as usize);
                    }
                }
            } else if let Some(pl) = old_pl {
                current.place(u_idx, pl.time_opt_idx as usize, pl.room_opt_idx as usize);
            }
        } else if roll < 86 && n_movable >= 2 {
            // 2-unit swap / coupled shift
            let i1 = rng.gen_range(0..n_movable);
            let mut i2 = rng.gen_range(0..n_movable);
            if i1 == i2 {
                i2 = (i1 + 1) % n_movable;
            }
            let u1 = movable[i1];
            let u2 = movable[i2];

            let cost_before = current.total_cost;
            let old1 = current.unplace(u1);
            let old2 = current.unplace(u2);

            let p1 = sample_best_of_k(&current, u1, 8, &mut rng);
            let accepted = if let Some((t1, r1, _)) = p1 {
                current.place(u1, t1, r1);
                if let Some((t2, r2, _)) = sample_best_of_k(&current, u2, 8, &mut rng) {
                    current.place(u2, t2, r2);
                    let delta = current.total_cost - cost_before;
                    if accept_metropolis(delta, temp, &mut rng) {
                        if is_better(&current, &best) {
                            best = current.clone();
                        }
                        true
                    } else {
                        let _ = current.unplace(u2);
                        let _ = current.unplace(u1);
                        false
                    }
                } else {
                    let _ = current.unplace(u1);
                    false
                }
            } else {
                false
            };

            if !accepted {
                if let Some(pl1) = old1 {
                    current.place(u1, pl1.time_opt_idx as usize, pl1.room_opt_idx as usize);
                }
                if let Some(pl2) = old2 {
                    current.place(u2, pl2.time_opt_idx as usize, pl2.room_opt_idx as usize);
                }
            }
        } else if roll < 95 && current.assigned_count < assignable_total {
            // Targeted ejection repair on any unassigned unit
            let unassigned_list: Vec<usize> = movable
                .iter()
                .copied()
                .filter(|&u| current.assignments[u].is_none())
                .collect();
            if !unassigned_list.is_empty() {
                let u_miss = unassigned_list[rng.gen_range(0..unassigned_list.len())];
                let mut protected = vec![false; problem.units.len()];
                if try_ejection_repair(&mut current, u_miss, 0, 2, &mut protected) {
                    repairs += 1;
                    if is_better(&current, &best) {
                        best = current.clone();
                    }
                }
            }
        } else if (iters & 31) == 0 {
            // Cluster LNS Ruin-and-Recreate
            lns_ruin_and_recreate(problem, movable, &mut current, &mut best, &mut repairs, &mut rng);
        }
    }

    (best, iters, repairs)
}

#[inline]
fn accept_metropolis(delta: i64, temp: f64, rng: &mut SmallRng) -> bool {
    if delta <= 0 {
        return true;
    }
    if temp <= 1e-6 {
        return false;
    }
    let prob = (-(delta as f64) / temp).exp();
    rng.gen::<f64>() < prob
}

fn sample_best_of_k(
    state: &ScheduleState<'_>,
    unit_idx: usize,
    k: usize,
    rng: &mut SmallRng,
) -> Option<(usize, usize, i64)> {
    let u = &state.problem.units[unit_idx];
    let nt = u.time_options.len();
    let nr = u.room_options.len();
    if nt == 0 || nr == 0 {
        return None;
    }

    let mut best: Option<(usize, usize, i64)> = None;
    let tries = k.min(nt * nr).max(1);

    for _ in 0..tries {
        let t_idx = rng.gen_range(0..nt);
        let to = &u.time_options[t_idx];
        if !state.can_place_time_hard(unit_idx, to) {
            continue;
        }
        let mask = state.problem.combo_for(u, to.combo_idx).mask;
        let t_delta = state.time_delta_cost(unit_idx, to);

        // Pick either a random room or the best preferred room
        if rng.gen_bool(0.7) {
            for (r_idx, ro) in u.room_options.iter().enumerate() {
                if state.can_place_room_hard(unit_idx, to.day, mask, ro) {
                    let d = t_delta + state.room_delta_cost(unit_idx, to, ro);
                    if best.map_or(true, |(_, _, bd)| d < bd) {
                        best = Some((t_idx, r_idx, d));
                    }
                    break;
                }
            }
        } else {
            let r_idx = rng.gen_range(0..nr);
            let ro = &u.room_options[r_idx];
            if state.can_place_room_hard(unit_idx, to.day, mask, ro) {
                let d = t_delta + state.room_delta_cost(unit_idx, to, ro);
                if best.map_or(true, |(_, _, bd)| d < bd) {
                    best = Some((t_idx, r_idx, d));
                }
            }
        }
    }

    best
}

fn lns_ruin_and_recreate<'a>(
    problem: &'a PreparedProblem,
    movable: &[usize],
    current: &mut ScheduleState<'a>,
    best: &mut ScheduleState<'a>,
    repairs: &mut usize,
    rng: &mut SmallRng,
) {
    let k = rng.gen_range(4..=10).min(movable.len());
    if k == 0 {
        return;
    }

    let anchor = movable[rng.gen_range(0..movable.len())];
    let anchor_u = &problem.units[anchor];
    let anchor_pl = current.assignments[anchor];

    let mut ruined: Vec<usize> = Vec::with_capacity(k);
    // Select related units (same cohort, instructor, or day) first
    for &u_idx in movable {
        if ruined.len() >= k {
            break;
        }
        if u_idx == anchor {
            ruined.push(u_idx);
            continue;
        }
        let u = &problem.units[u_idx];
        let same_inst = anchor_u.inst_idx.is_some() && u.inst_idx == anchor_u.inst_idx;
        let same_cohort = anchor_u.cohort_idx.is_some() && u.cohort_idx == anchor_u.cohort_idx;
        let same_day = match (anchor_pl, current.assignments[u_idx]) {
            (Some(a), Some(b)) => a.day == b.day,
            _ => false,
        };
        if (same_inst || same_cohort || same_day) && rng.gen_bool(0.45) {
            ruined.push(u_idx);
        }
    }

    while ruined.len() < k {
        let u_idx = movable[rng.gen_range(0..movable.len())];
        if !ruined.contains(&u_idx) {
            ruined.push(u_idx);
        }
    }

    let cost_before = current.total_cost;
    let assigned_before = current.assigned_count;
    let snapshot = current.clone();

    for &u_idx in &ruined {
        let _ = current.unplace(u_idx);
    }

    // Re-insert ruined units along with any previously unassigned movable units
    let mut order: Vec<usize> = ruined.clone();
    for &u_idx in movable {
        if current.assignments[u_idx].is_none() && !order.contains(&u_idx) {
            order.push(u_idx);
        }
    }
    order.shuffle(rng);

    for &u_idx in &order {
        if current.assignments[u_idx].is_some() {
            continue;
        }
        if let Some((bt, br, _)) = current.find_best_candidate(u_idx) {
            current.place(u_idx, bt, br);
        } else {
            let mut protected = vec![false; problem.units.len()];
            if try_ejection_repair(current, u_idx, 0, 2, &mut protected) {
                *repairs += 1;
            }
        }
    }

    let improved_or_equal = current.assigned_count > assigned_before
        || (current.assigned_count == assigned_before && current.total_cost <= cost_before);

    if improved_or_equal {
        if is_better(current, best) {
            *best = current.clone();
        }
    } else {
        *current = snapshot;
    }
}
