import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export type RustSolverStrategy =
    | "hybrid"
    | "greedy_repair"
    | "backtracking"
    | "simulated_annealing";

export interface RustSolverConfig {
    strategy?: RustSolverStrategy;
    time_budget_ms?: number;
    seed?: number;
    threads?: number;
    prioritize_part_time?: boolean;
    enforce_separate_days?: boolean;
    enforce_online_offline_gap?: boolean;
    min_online_offline_gap_minutes?: number;
    max_adjacent_gap_minutes?: number;
    max_consecutive_hours?: number;
    avoid_cohort_overlap?: boolean;
    penalize_building_switches?: boolean;
    max_building_transition_minutes?: number;
    days?: string[];
}

export interface RustTimeSlotInput {
    id?: number | null;
    start_time: string;
    end_time: string;
}

export interface RustClassroomInput {
    id: number;
    code: string;
    name?: string | null;
    capacity: number;
    classroom_type_id: number;
    location?: string | null;
}

export interface RustInstructorInput {
    id: number;
    first_name: string;
    last_name: string;
    name?: string | null;
    is_part_time?: boolean | null;
}

export interface RustTimeConstraintInput {
    instructor_id: number;
    day: string;
    time_slots: string[];
}

export interface RustUnitInput {
    course_hours_id?: number | null;
    duration: number;
    prefer_classroom_type_id?: number | null;
    prefer_classroom_id?: number | null;
}

export interface RustSectionInput {
    id: number;
    number: string;
    instructor_id?: number | null;
    status?: string | null;
    is_online?: boolean | null;
    year?: number | null;
    units: RustUnitInput[];
}

export interface RustCourseInput {
    id: number;
    title: string;
    code: string;
    color?: string | null;
    capacity: number;
    duration: number;
    major_id?: number | null;
    major_name?: string | null;
    year?: number | null;
    sections: RustSectionInput[];
}

export interface RustScheduleRequest {
    schedule_id?: number | null;
    time_slots: RustTimeSlotInput[];
    classrooms: RustClassroomInput[];
    instructors: RustInstructorInput[];
    time_constraints: RustTimeConstraintInput[];
    preferred_slots?: RustTimeConstraintInput[];
    courses: RustCourseInput[];
    config?: RustSolverConfig;
}

export interface RustAssignmentOutput {
    unit_index: number;
    course_id: number;
    section_id: number;
    section_number: string;
    course_hours_id: number | null;
    course_code: string;
    course_title: string;
    course_color: string | null;
    instructor_id: number;
    instructor_name: string;
    is_online: boolean;
    day: string;
    start_time: string;
    end_time: string;
    slot_indices: number[];
    duration_hours: number;
    classroom_id: number;
    classroom_code: string;
    classroom_location: string | null;
    is_continuous: boolean;
    satisfied_classroom_preference: boolean;
}

export interface RustFailedUnitOutput {
    unit_index: number;
    section_id: number;
    section_number: string;
    course_id: number;
    course_code: string;
    course_hours_id: number | null;
    duration_hours: number;
}

export interface RustSchedulingError {
    section_id: number;
    section_number: string;
    course_code: string;
    course_title: string;
    instructor_name: string;
    error_type:
        | "CAPACITY_CONSTRAINT"
        | "TIME_CONSTRAINT"
        | "INSTRUCTOR_CONFLICT"
        | "NO_AVAILABLE_SLOTS"
        | "NO_CLASSROOM"
        | "DURATION_MISMATCH"
        | "UNKNOWN_ERROR";
    error_message: string;
    details?: Record<string, unknown>;
}

export interface RustObjectiveBreakdown {
    unassigned_count: number;
    same_section_same_day_violations: number;
    online_offline_proximity_violations: number;
    outside_preferred_slot_violations: number;
    classroom_type_mismatches: number;
    specific_classroom_mismatches: number;
    gapped_assignments: number;
    cohort_overlap_slots: number;
    building_switches: number;
    over_consecutive_violations: number;
    total_seat_waste: number;
}

export interface RustSolverMetrics {
    solve_time_ms: number;
    strategy: RustSolverStrategy;
    objective_score: number;
    hard_violations: number;
    threads_used: number;
    annealing_iterations: number;
    ejection_repairs: number;
    breakdown: RustObjectiveBreakdown;
}

export interface RustScheduleResponse {
    success: boolean;
    message: string;
    assignments: RustAssignmentOutput[];
    failed_units: RustFailedUnitOutput[];
    errors: RustSchedulingError[];
    warnings: string[];
    stats: {
        total_courses: number;
        total_sections: number;
        total_units: number;
        scheduled_assignments: number;
        constraints_applied: number;
        failed_assignments: number;
        part_time_units_scheduled: number;
        part_time_units_total: number;
    };
    metrics: RustSolverMetrics;
}

export interface RustExistingAssignmentInput {
    course_hours_id?: number | null;
    section_id: number;
    course_id: number;
    course_code: string;
    course_title?: string;
    section_number?: string;
    capacity?: number;
    major_id?: number | null;
    major_name?: string | null;
    year?: number | null;
    instructor_id?: number | null;
    instructor_name?: string | null;
    is_online: boolean;
    day: string;
    start_time: string;
    end_time: string;
    classroom_id?: number | null;
    classroom_code?: string | null;
    classroom_location?: string | null;
}

export interface RustConflictCheckRequest {
    candidate: RustExistingAssignmentInput;
    existing_assignments: RustExistingAssignmentInput[];
    classrooms?: RustClassroomInput[];
    time_constraints?: RustTimeConstraintInput[];
    config?: RustSolverConfig;
}

export interface RustConflictItem {
    severity: "error" | "warning";
    kind: string;
    message: string;
    conflicting_course_code?: string | null;
    conflicting_section_id?: number | null;
}

export interface RustConflictCheckResult {
    is_valid: boolean;
    hard_conflicts: RustConflictItem[];
    soft_warnings: RustConflictItem[];
    check_time_us: number;
}

const DEFAULT_TIMEOUT_MS = 10000;

function resolveCliBinaryPath(): string | null {
    const envBin = process.env.OPTISCHEDULING_BIN;
    if (envBin && fs.existsSync(envBin)) {
        return envBin;
    }

    const cwd = process.cwd();
    const exeName =
        process.platform === "win32"
            ? "optischeduling-cli.exe"
            : "optischeduling-cli";

    const candidates = [
        path.resolve(cwd, "..", "rust_scheduler", "target", "release", exeName),
        path.resolve(cwd, "rust_scheduler", "target", "release", exeName),
        path.resolve(cwd, "..", "rust_scheduler", "target", "debug", exeName),
        path.resolve(cwd, "rust_scheduler", "target", "debug", exeName),
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    return null;
}

async function postToRustServer<TReq, TRes>(
    endpointPath: string,
    payload: TReq,
    timeoutMs: number
): Promise<TRes | null> {
    const serverUrl = process.env.OPTISCHEDULING_RUST_URL?.trim();
    if (!serverUrl) {
        return null;
    }

    const target = `${serverUrl.replace(/\/+$/, "")}${endpointPath}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(target, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(
                `Rust scheduler HTTP ${res.status}: ${errText || res.statusText}`
            );
        }
        return (await res.json()) as TRes;
    } catch (err) {
        console.warn(
            `Rust HTTP server unreachable at ${target}, falling back to CLI binary:`,
            err instanceof Error ? err.message : String(err)
        );
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function execRustCli<TReq, TRes>(
    subcommand: "solve" | "check-conflict" | "validate",
    payload: TReq,
    timeoutMs: number
): Promise<TRes> {
    const binary = resolveCliBinaryPath();
    if (!binary) {
        throw new Error(
            "optischeduling-cli binary not found. Build it cleanly with `cd ../rust_scheduler && cargo build --release` or set OPTISCHEDULING_BIN / OPTISCHEDULING_RUST_URL."
        );
    }

    return new Promise<TRes>((resolve, reject) => {
        const child = spawn(binary, [subcommand], {
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        let finished = false;

        const timer = setTimeout(() => {
            if (!finished) {
                finished = true;
                child.kill("SIGKILL");
                reject(
                    new Error(
                        `Rust CLI '${subcommand}' timed out after ${timeoutMs}ms`
                    )
                );
            }
        }, timeoutMs);

        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString("utf8");
        });

        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
        });

        child.on("error", (err) => {
            if (!finished) {
                finished = true;
                clearTimeout(timer);
                reject(
                    new Error(
                        `Failed to launch Rust CLI (${binary}): ${err.message}`
                    )
                );
            }
        });

        child.on("close", (code) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);

            if (code !== 0) {
                reject(
                    new Error(
                        `Rust CLI exited with code ${code}: ${
                            stderr.trim() || stdout.trim()
                        }`
                    )
                );
                return;
            }

            try {
                const parsed = JSON.parse(stdout) as TRes;
                resolve(parsed);
            } catch (parseErr) {
                reject(
                    new Error(
                        `Invalid JSON returned from Rust CLI: ${
                            parseErr instanceof Error
                                ? parseErr.message
                                : String(parseErr)
                        }`
                    )
                );
            }
        });

        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
    });
}

export async function runRustScheduler(
    request: RustScheduleRequest
): Promise<RustScheduleResponse> {
    const budget = request.config?.time_budget_ms ?? 150;
    const timeoutMs = Math.max(DEFAULT_TIMEOUT_MS, budget + 5000);

    const httpRes = await postToRustServer<
        RustScheduleRequest,
        RustScheduleResponse
    >("/v1/schedule/generate", request, timeoutMs);
    if (httpRes) {
        return httpRes;
    }

    return execRustCli<RustScheduleRequest, RustScheduleResponse>(
        "solve",
        request,
        timeoutMs
    );
}

export async function runRustConflictCheck(
    request: RustConflictCheckRequest
): Promise<RustConflictCheckResult> {
    const timeoutMs = 5000;
    const httpRes = await postToRustServer<
        RustConflictCheckRequest,
        RustConflictCheckResult
    >("/v1/schedule/check-conflict", request, timeoutMs);
    if (httpRes) {
        return httpRes;
    }

    return execRustCli<RustConflictCheckRequest, RustConflictCheckResult>(
        "check-conflict",
        request,
        timeoutMs
    );
}
