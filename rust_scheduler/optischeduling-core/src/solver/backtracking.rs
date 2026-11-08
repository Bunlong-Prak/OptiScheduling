use std::time::Instant;

use smallvec::SmallVec;

use super::constructive::solve_greedy_repair;
use super::state::{PreparedProblem, ScheduleState, StaticUnitIssue};

pub struct BacktrackingResult<'a> {
    pub state: ScheduleState<'a>,
    pub nodes_explored: u64,
    pub ejection_repairs: usize,
}

pub fn solve_backtracking<'a>(
    problem: &'a PreparedProblem,
    deadline: Instant,
) -> BacktrackingResult<'a> {
    let warm = solve_greedy_repair(problem, None, 2);
    let mut best_state = warm.state.clone();
    let ejection_repairs = warm.ejection_repairs;

    let mut active_units: Vec<usize> = Vec::new();
    for (idx, u) in problem.units.iter().enumerate() {
        if u.static_issue == StaticUnitIssue::None {
            active_units.push(idx);
        }
    }

    if active_units.is_empty() || Instant::now() >= deadline {
        return BacktrackingResult {
            state: best_state,
            nodes_explored: 0,
            ejection_repairs,
        };
    }

    // Precompute minimum static cost per unit for sound Branch-and-Bound lower bound
    let min_static_cost: Vec<i64> = problem
        .units
        .iter()
        .map(|u| {
            let mt = u
                .time_options
                .iter()
                .map(|t| t.static_time_cost as i64)
                .min()
                .unwrap_or(0);
            let mr = u
                .room_options
                .iter()
                .map(|r| r.static_room_cost as i64)
                .min()
                .unwrap_or(0);
            mt + mr
        })
        .collect();

    let mut work = ScheduleState::new(problem);
    // Pre-place locked units first
    let mut remaining: Vec<usize> = Vec::with_capacity(active_units.len());
    for &u_idx in &active_units {
        if problem.units[u_idx].is_locked {
            if let Some((t_idx, r_idx, _)) = work.find_best_candidate(u_idx) {
                work.place(u_idx, t_idx, r_idx);
            } else {
                // Locked conflict means no complete assignment of active_units is possible via pure backtracking
                return BacktrackingResult {
                    state: best_state,
                    nodes_explored: 1,
                    ejection_repairs,
                };
            }
        } else {
            remaining.push(u_idx);
        }
    }

    let target_assigned = active_units.len();
    let mut ctx = DfsContext {
        problem,
        min_static_cost: &min_static_cost,
        remaining: &remaining,
        best_state: &mut best_state,
        target_assigned,
        deadline,
        nodes: 0,
        timed_out: false,
    };

    let mut placed_flags = vec![false; remaining.len()];
    dfs_mrv(&mut work, &mut placed_flags, remaining.len(), &mut ctx);
    let nodes_explored = ctx.nodes;

    BacktrackingResult {
        state: best_state,
        nodes_explored,
        ejection_repairs,
    }
}

struct DfsContext<'a, 'b> {
    problem: &'a PreparedProblem,
    min_static_cost: &'b [i64],
    remaining: &'b [usize],
    best_state: &'b mut ScheduleState<'a>,
    target_assigned: usize,
    deadline: Instant,
    nodes: u64,
    timed_out: bool,
}

fn dfs_mrv<'a, 'b>(
    state: &mut ScheduleState<'a>,
    placed_flags: &mut [bool],
    unplaced_count: usize,
    ctx: &mut DfsContext<'a, 'b>,
) {
    if ctx.timed_out {
        return;
    }
    ctx.nodes += 1;
    if (ctx.nodes & 127) == 0 && Instant::now() >= ctx.deadline {
        ctx.timed_out = true;
        return;
    }

    if unplaced_count == 0 {
        if state.assigned_count > ctx.best_state.assigned_count
            || (state.assigned_count == ctx.best_state.assigned_count
                && state.total_cost < ctx.best_state.total_cost)
        {
            *ctx.best_state = state.clone();
        }
        return;
    }

    // Sound Branch-and-Bound lower bound when we already have a complete solution
    if ctx.best_state.assigned_count == ctx.target_assigned {
        let mut lb = state.total_cost;
        let w_unassigned = ctx.problem.config.weights.unassigned_unit;
        for (pos, &u_idx) in ctx.remaining.iter().enumerate() {
            if !placed_flags[pos] {
                lb += -w_unassigned + ctx.min_static_cost[u_idx];
            }
        }
        if lb >= ctx.best_state.total_cost {
            return;
        }
    }

    // Dynamic MRV + Forward Checking: choose unassigned unit with minimum feasible (time, room) count
    let mut best_pos: Option<usize> = None;
    let mut best_domain_len = usize::MAX;
    let mut best_moves: SmallVec<[(usize, usize, i64); 32]> = SmallVec::new();

    for (pos, &u_idx) in ctx.remaining.iter().enumerate() {
        if placed_flags[pos] {
            continue;
        }
        let u = &ctx.problem.units[u_idx];
        let mut count = 0usize;
        let mut moves: SmallVec<[(usize, usize, i64); 32]> = SmallVec::new();

        for (t_idx, to) in u.time_options.iter().enumerate() {
            if !state.can_place_time_hard(u_idx, to) {
                continue;
            }
            let mask = ctx.problem.combo_for(u, to.combo_idx).mask;
            let t_delta = state.time_delta_cost(u_idx, to);

            for (r_idx, ro) in u.room_options.iter().enumerate() {
                if state.can_place_room_hard(u_idx, to.day, mask, ro) {
                    count += 1;
                    if count > best_domain_len {
                        break;
                    }
                    let d = t_delta + state.room_delta_cost(u_idx, to, ro);
                    moves.push((t_idx, r_idx, d));
                }
            }
            if count > best_domain_len {
                break;
            }
        }

        // Forward Checking: if ANY unassigned variable has 0 valid assignments, prune immediately!
        if count == 0 {
            return;
        }

        // Tie-break MRV with part-time priority
        let is_better = if count < best_domain_len {
            true
        } else if count == best_domain_len {
            let pt_new = u
                .inst_idx
                .map(|ii| ctx.problem.instructors[ii].is_part_time)
                .unwrap_or(false);
            let pt_old = best_pos
                .and_then(|bp| ctx.problem.units[ctx.remaining[bp]].inst_idx)
                .map(|ii| ctx.problem.instructors[ii].is_part_time)
                .unwrap_or(false);
            pt_new && !pt_old
        } else {
            false
        };

        if is_better {
            best_domain_len = count;
            best_pos = Some(pos);
            best_moves = moves;
        }
    }

    let Some(chosen_pos) = best_pos else {
        return;
    };
    let chosen_u = ctx.remaining[chosen_pos];

    // Order values by lowest immediate penalty (LCV heuristic)
    best_moves.sort_unstable_by_key(|x| x.2);

    // Deduplicate identical-outcome equivalent rooms at same time if needed? Keep all explored moves
    placed_flags[chosen_pos] = true;
    for &(t_idx, r_idx, _) in &best_moves {
        if ctx.timed_out {
            break;
        }
        state.place(chosen_u, t_idx, r_idx);
        dfs_mrv(state, placed_flags, unplaced_count - 1, ctx);
        let _ = state.unplace(chosen_u);
    }
    placed_flags[chosen_pos] = false;
}
