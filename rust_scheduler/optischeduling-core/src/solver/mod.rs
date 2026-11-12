pub mod annealing;
pub mod backtracking;
pub mod constructive;
pub mod state;

use std::time::{Duration, Instant};

use thiserror::Error;

use crate::model::{
    ScheduleRequest, ScheduleResponse, ScheduleStats, SolverMetrics, SolverStrategy,
};
use crate::time::TimeError;

use self::annealing::solve_annealing;
use self::backtracking::solve_backtracking;
use self::constructive::solve_greedy_repair;
use self::state::{PreparedProblem, ScheduleState};

#[derive(Debug, Error)]
pub enum SolverError {
    #[error("Invalid time configuration: {0}")]
    TimeConfig(#[from] TimeError),
}

pub fn solve(request: &ScheduleRequest) -> Result<ScheduleResponse, SolverError> {
    let start = Instant::now();
    let problem = PreparedProblem::build(request)?;
    let cfg = &problem.config;

    if problem.units.is_empty() {
        let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
        let state = ScheduleState::new(&problem);
        let breakdown = state.compute_breakdown();
        return Ok(ScheduleResponse {
            success: true,
            message: "No course hours to schedule".to_string(),
            assignments: Vec::new(),
            failed_units: Vec::new(),
            errors: Vec::new(),
            warnings: vec!["No scheduling units were found in request".to_string()],
            stats: ScheduleStats {
                total_courses: problem.total_courses,
                total_sections: problem.total_sections,
                constraints_applied: problem.constraints_applied,
                ..Default::default()
            },
            metrics: SolverMetrics {
                solve_time_ms: elapsed_ms,
                strategy: cfg.strategy,
                objective_score: 0,
                hard_violations: 0,
                threads_used: 1,
                annealing_iterations: 0,
                ejection_repairs: 0,
                breakdown,
            },
        });
    }

    let (state, threads_used, annealing_iterations, ejection_repairs) = match cfg.strategy {
        SolverStrategy::GreedyRepair => {
            let res = solve_greedy_repair(&problem, None, 3);
            (res.state, 1, 0, res.ejection_repairs)
        }
        SolverStrategy::Backtracking => {
            let budget = Duration::from_millis(cfg.time_budget_ms.max(20));
            let res = solve_backtracking(&problem, start + budget);
            (res.state, 1, res.nodes_explored, res.ejection_repairs)
        }
        SolverStrategy::SimulatedAnnealing | SolverStrategy::Hybrid => {
            let res = solve_annealing(&problem, cfg.time_budget_ms.max(10), cfg.seed, cfg.threads);
            (
                res.state,
                res.threads_used,
                res.total_iterations,
                res.ejection_repairs,
            )
        }
    };

    let solve_time_ms = start.elapsed().as_secs_f64() * 1000.0;
    let breakdown = state.compute_breakdown();
    let total_cost = state.total_cost;
    let (assignments, failed_units, errors) = state.extract_outputs();

    let mut part_time_units_total = 0usize;
    let mut part_time_units_scheduled = 0usize;
    for (u_idx, u) in problem.units.iter().enumerate() {
        let is_pt = u
            .inst_idx
            .map(|ii| problem.instructors[ii].is_part_time)
            .unwrap_or(false);
        if is_pt {
            part_time_units_total += 1;
            if state.assignments[u_idx].is_some() {
                part_time_units_scheduled += 1;
            }
        }
    }

    let mut warnings = Vec::new();
    if breakdown.same_section_same_day_violations > 0 {
        warnings.push(format!(
            "{} section unit(s) could not be separated across distinct days",
            breakdown.same_section_same_day_violations
        ));
    }
    if breakdown.online_offline_proximity_violations > 0 {
        warnings.push(format!(
            "{} online/offline transition(s) occur within {} minutes",
            breakdown.online_offline_proximity_violations, cfg.min_online_offline_gap_minutes
        ));
    }
    if breakdown.classroom_type_mismatches > 0 {
        warnings.push(format!(
            "{} unit(s) were placed in fallback classroom types due to resource contention",
            breakdown.classroom_type_mismatches
        ));
    }
    if breakdown.building_switches > 0 {
        warnings.push(format!(
            "{} instructor back-to-back building switch(es) remain",
            breakdown.building_switches
        ));
    }
    if breakdown.gapped_assignments > 0 {
        warnings.push(format!(
            "{} unit(s) required non-continuous slot combinations",
            breakdown.gapped_assignments
        ));
    }

    let hard_violations = breakdown.unassigned_count + breakdown.same_section_same_day_violations;
    let success = errors.is_empty();
    let message = if success {
        format!(
            "Scheduled all {} units cleanly in {:.2} ms",
            assignments.len(),
            solve_time_ms
        )
    } else {
        format!(
            "Scheduled {}/{} units ({} failed) in {:.2} ms",
            assignments.len(),
            problem.units.len(),
            errors.len(),
            solve_time_ms
        )
    };

    Ok(ScheduleResponse {
        success,
        message,
        assignments,
        failed_units,
        errors,
        warnings,
        stats: ScheduleStats {
            total_courses: problem.total_courses,
            total_sections: problem.total_sections,
            total_units: problem.units.len(),
            scheduled_assignments: state.assigned_count,
            constraints_applied: problem.constraints_applied,
            failed_assignments: state.problem.units.len() - state.assigned_count,
            part_time_units_scheduled,
            part_time_units_total,
        },
        metrics: SolverMetrics {
            solve_time_ms,
            strategy: cfg.strategy,
            objective_score: total_cost,
            hard_violations,
            threads_used,
            annealing_iterations,
            ejection_repairs,
            breakdown,
        },
    })
}
