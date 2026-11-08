use std::env;
use std::fs;
use std::io::{self, Read};
use std::process;

use anyhow::{Context, Result};
use optischeduling_core::benchmark::benchmark_strategies;
use optischeduling_core::{
    check_manual_conflict, solve, validate_schedule, ConflictCheckRequest, ScheduleRequest,
    SolverStrategy, ValidateScheduleRequest,
};

fn main() {
    if let Err(err) = run() {
        eprintln!("optischeduling-cli error: {err:#}");
        process::exit(1);
    }
}

fn run() -> Result<()> {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() || args[0] == "-h" || args[0] == "--help" {
        print_help();
        return Ok(());
    }
    if args[0] == "-V" || args[0] == "--version" {
        println!("optischeduling-cli {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }

    let cmd = args[0].as_str();
    let rest = &args[1..];

    match cmd {
        "solve" => cmd_solve(rest),
        "validate" => cmd_validate(rest),
        "check-conflict" => cmd_check_conflict(rest),
        "bench" => cmd_bench(rest),
        _ => {
            eprintln!("Unknown subcommand '{cmd}'. Use --help.");
            process::exit(2);
        }
    }
}

fn read_input(path: Option<&str>) -> Result<String> {
    if let Some(p) = path {
        fs::read_to_string(p).with_context(|| format!("Failed to read input file '{p}'"))
    } else {
        let mut buf = String::new();
        io::stdin()
            .read_to_string(&mut buf)
            .context("Failed to read JSON payload from stdin")?;
        Ok(buf)
    }
}

fn parse_strategy(raw: &str) -> Result<SolverStrategy> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "hybrid" => Ok(SolverStrategy::Hybrid),
        "greedy" | "greedy_repair" | "greedy-repair" => Ok(SolverStrategy::GreedyRepair),
        "backtracking" | "csp" => Ok(SolverStrategy::Backtracking),
        "sa" | "simulated_annealing" | "simulated-annealing" => Ok(SolverStrategy::SimulatedAnnealing),
        _ => anyhow::bail!("Unknown strategy '{raw}'"),
    }
}

fn cmd_solve(args: &[String]) -> Result<()> {
    let mut input_path: Option<String> = None;
    let mut strategy_override: Option<SolverStrategy> = None;
    let mut budget_override: Option<u64> = None;
    let mut threads_override: Option<usize> = None;
    let mut seed_override: Option<u64> = None;
    let mut pretty = false;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--input" | "-i" => {
                i += 1;
                input_path = Some(args.get(i).context("Missing value for --input")?.clone());
            }
            "--strategy" | "-s" => {
                i += 1;
                let val = args.get(i).context("Missing value for --strategy")?;
                strategy_override = Some(parse_strategy(val)?);
            }
            "--budget-ms" | "-b" => {
                i += 1;
                budget_override = Some(
                    args.get(i)
                        .context("Missing value for --budget-ms")?
                        .parse()
                        .context("Invalid --budget-ms integer")?,
                );
            }
            "--threads" | "-t" => {
                i += 1;
                threads_override = Some(
                    args.get(i)
                        .context("Missing value for --threads")?
                        .parse()
                        .context("Invalid --threads integer")?,
                );
            }
            "--seed" => {
                i += 1;
                seed_override = Some(
                    args.get(i)
                        .context("Missing value for --seed")?
                        .parse()
                        .context("Invalid --seed integer")?,
                );
            }
            "--pretty" => pretty = true,
            other => anyhow::bail!("Unexpected option '{other}' for solve"),
        }
        i += 1;
    }

    let raw_json = read_input(input_path.as_deref())?;
    let mut req: ScheduleRequest =
        serde_json::from_str(&raw_json).context("Invalid ScheduleRequest JSON")?;

    if let Some(s) = strategy_override {
        req.config.strategy = s;
    }
    if let Some(b) = budget_override {
        req.config.time_budget_ms = b;
    }
    if let Some(t) = threads_override {
        req.config.threads = t;
    }
    if let Some(seed) = seed_override {
        req.config.seed = seed;
    }

    let resp = solve(&req)?;
    if pretty {
        println!("{}", serde_json::to_string_pretty(&resp)?);
    } else {
        println!("{}", serde_json::to_string(&resp)?);
    }
    Ok(())
}

fn cmd_validate(args: &[String]) -> Result<()> {
    let mut input_path: Option<String> = None;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--input" | "-i" => {
                i += 1;
                input_path = Some(args.get(i).context("Missing value for --input")?.clone());
            }
            other => anyhow::bail!("Unexpected option '{other}' for validate"),
        }
        i += 1;
    }
    let raw_json = read_input(input_path.as_deref())?;
    let req: ValidateScheduleRequest =
        serde_json::from_str(&raw_json).context("Invalid ValidateScheduleRequest JSON")?;
    let report = validate_schedule(&req);
    println!("{}", serde_json::to_string(&report)?);
    Ok(())
}

fn cmd_check_conflict(args: &[String]) -> Result<()> {
    let mut input_path: Option<String> = None;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--input" | "-i" => {
                i += 1;
                input_path = Some(args.get(i).context("Missing value for --input")?.clone());
            }
            other => anyhow::bail!("Unexpected option '{other}' for check-conflict"),
        }
        i += 1;
    }
    let raw_json = read_input(input_path.as_deref())?;
    let req: ConflictCheckRequest =
        serde_json::from_str(&raw_json).context("Invalid ConflictCheckRequest JSON")?;
    let result = check_manual_conflict(&req);
    println!("{}", serde_json::to_string(&result)?);
    Ok(())
}

fn cmd_bench(args: &[String]) -> Result<()> {
    let mut sections: usize = 120;
    let mut budget_ms: u64 = 150;
    let mut json_out = false;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--sections" | "-n" => {
                i += 1;
                sections = args
                    .get(i)
                    .context("Missing value for --sections")?
                    .parse()
                    .context("Invalid --sections")?;
            }
            "--budget-ms" | "-b" => {
                i += 1;
                budget_ms = args
                    .get(i)
                    .context("Missing value for --budget-ms")?
                    .parse()
                    .context("Invalid --budget-ms")?;
            }
            "--json" => json_out = true,
            other => anyhow::bail!("Unexpected option '{other}' for bench"),
        }
        i += 1;
    }

    let results = benchmark_strategies(sections, budget_ms);
    if json_out {
        println!("{}", serde_json::to_string_pretty(&results)?);
        return Ok(());
    }

    println!(
        "Paragon IU Benchmark ({sections} sections, 103 instructors ~67% part-time, budget {budget_ms} ms)"
    );
    println!(
        "{:<20} {:>10} {:>9} {:>10} {:>9} {:>9} {:>8} {:>8} {:>8}",
        "Strategy",
        "Time(ms)",
        "Assigned",
        "Score",
        "SecSameDay",
        "On/Off",
        "BldgSw",
        "Cohort",
        "TypeMis"
    );
    println!("{}", "-".repeat(102));
    for r in &results {
        println!(
            "{:<20} {:>10.2} {:>4}/{:<4} {:>10} {:>9} {:>9} {:>8} {:>8} {:>8}",
            format!("{:?}", r.strategy),
            r.solve_time_ms,
            r.scheduled_units,
            r.total_units,
            r.objective_score,
            r.same_section_same_day_violations,
            r.online_offline_proximity_violations,
            r.building_switches,
            r.cohort_overlap_slots,
            r.classroom_type_mismatches,
        );
    }
    Ok(())
}

fn print_help() {
    println!(
        "optischeduling-cli — High-performance Rust scheduler for OptiScheduling\n\n\
         USAGE:\n\
           optischeduling-cli solve [--input <file>] [--strategy hybrid|greedy_repair|backtracking|simulated_annealing] [--budget-ms <ms>] [--threads <n>] [--seed <n>] [--pretty]\n\
           optischeduling-cli validate [--input <file>]\n\
           optischeduling-cli check-conflict [--input <file>]\n\
           optischeduling-cli bench [--sections <n>] [--budget-ms <ms>] [--json]\n"
    );
}
