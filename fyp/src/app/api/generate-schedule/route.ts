import {
    classrooms,
    classroomTypes,
    courseHours,
    courses,
    instructors,
    instructorTimeConstraint,
    instructorTimeConstraintDay,
    instructorTimeConstraintTimeSlot,
    majors,
    scheduleTimeSlots,
    sections,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import {
    runRustScheduler,
    RustClassroomInput,
    RustCourseInput,
    RustInstructorInput,
    RustScheduleRequest,
    RustSectionInput,
    RustSolverConfig,
    RustSolverMetrics,
    RustSolverStrategy,
    RustTimeConstraintInput,
    RustTimeSlotInput,
    RustUnitInput,
} from "@/lib/rust-scheduler";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

const ALLOWED_STRATEGIES = new Set<RustSolverStrategy>([
    "hybrid",
    "greedy_repair",
    "backtracking",
    "simulated_annealing",
]);

function normalizeTimeToHHMM(raw: string): string {
    const clean = raw.trim();
    const upper = clean.toUpperCase();
    if (upper.endsWith("AM") || upper.endsWith("PM")) {
        const isPm = upper.endsWith("PM");
        const core = upper.slice(0, -2).trim();
        const [hStr, mStr = "00"] = core.split(":");
        let hour = parseInt(hStr, 10);
        if (!Number.isNaN(hour)) {
            if (isPm && hour !== 12) hour += 12;
            if (!isPm && hour === 12) hour = 0;
            return `${hour.toString().padStart(2, "0")}:${mStr.padStart(2, "0")}`;
        }
    }
    if (clean.includes(":")) {
        const [hStr, mStr] = clean.split(":");
        return `${hStr.trim().padStart(2, "0")}:${(mStr || "00").trim().padStart(2, "0")}`;
    }
    const hourOnly = parseInt(clean, 10);
    if (!Number.isNaN(hourOnly)) {
        return `${hourOnly.toString().padStart(2, "0")}:00`;
    }
    return clean;
}

function normalizeTimeRange(raw: string): string {
    if (raw.includes("-")) {
        const [start, end] = raw.split("-").map((p) => normalizeTimeToHHMM(p));
        return `${start}-${end}`;
    }
    return normalizeTimeToHHMM(raw);
}

interface GenerateScheduleBody {
    strategy?: RustSolverStrategy;
    timeBudgetMs?: number;
    enforceSeparateDays?: boolean;
    enforceOnlineOfflineGap?: boolean;
    minOnlineOfflineGapMinutes?: number;
    maxConsecutiveHours?: number;
    avoidCohortOverlap?: boolean;
    penalizeBuildingSwitches?: boolean;
    prioritizePartTime?: boolean;
}

async function parseOptionalConfig(request: Request): Promise<RustSolverConfig> {
    const config: RustSolverConfig = {};
    const { searchParams } = new URL(request.url);
    const strategyQuery = searchParams.get("strategy") as RustSolverStrategy | null;
    if (strategyQuery && ALLOWED_STRATEGIES.has(strategyQuery)) {
        config.strategy = strategyQuery;
    }

    try {
        const rawText = await request.text();
        if (!rawText || rawText.trim().length === 0) {
            return config;
        }
        const body = JSON.parse(rawText) as GenerateScheduleBody;
        if (body.strategy && ALLOWED_STRATEGIES.has(body.strategy)) {
            config.strategy = body.strategy;
        }
        if (typeof body.timeBudgetMs === "number" && body.timeBudgetMs > 0) {
            config.time_budget_ms = Math.min(30000, Math.round(body.timeBudgetMs));
        }
        if (typeof body.enforceSeparateDays === "boolean") {
            config.enforce_separate_days = body.enforceSeparateDays;
        }
        if (typeof body.enforceOnlineOfflineGap === "boolean") {
            config.enforce_online_offline_gap = body.enforceOnlineOfflineGap;
        }
        if (
            typeof body.minOnlineOfflineGapMinutes === "number" &&
            body.minOnlineOfflineGapMinutes >= 0
        ) {
            config.min_online_offline_gap_minutes = Math.round(
                body.minOnlineOfflineGapMinutes
            );
        }
        if (
            typeof body.maxConsecutiveHours === "number" &&
            body.maxConsecutiveHours > 0
        ) {
            config.max_consecutive_hours = body.maxConsecutiveHours;
        }
        if (typeof body.avoidCohortOverlap === "boolean") {
            config.avoid_cohort_overlap = body.avoidCohortOverlap;
        }
        if (typeof body.penalizeBuildingSwitches === "boolean") {
            config.penalize_building_switches = body.penalizeBuildingSwitches;
        }
        if (typeof body.prioritizePartTime === "boolean") {
            config.prioritize_part_time = body.prioritizePartTime;
        }
    } catch {
        // Ignore empty or non-JSON request bodies so legacy callers stay compatible
    }

    return config;
}

export async function POST(request: Request) {
    const reqStart = performance.now();

    try {
        const { searchParams } = new URL(request.url);
        const scheduleIdParam = searchParams.get("scheduleId");

        if (!scheduleIdParam) {
            return NextResponse.json(
                { error: "Schedule ID is required" },
                { status: 400 }
            );
        }

        const scheduleId = parseInt(scheduleIdParam, 10);
        if (Number.isNaN(scheduleId)) {
            return NextResponse.json(
                { error: "Invalid Schedule ID. Must be a number." },
                { status: 400 }
            );
        }

        const solverConfig = await parseOptionalConfig(request);
        const dbFetchStart = performance.now();

        // 1. Batched parallel independent queries (eliminates all N+1 queries)
        const [
            timeSlotRows,
            classroomRows,
            classroomTypeRows,
            instructorRows,
            majorRows,
            courseRows,
            constraintJoinRows,
        ] = await Promise.all([
            db
                .select({
                    id: scheduleTimeSlots.id,
                    startTime: scheduleTimeSlots.startTime,
                    endTime: scheduleTimeSlots.endTime,
                })
                .from(scheduleTimeSlots)
                .where(eq(scheduleTimeSlots.scheduleId, scheduleId)),
            db
                .select({
                    id: classrooms.id,
                    code: classrooms.code,
                    name: classrooms.name,
                    capacity: classrooms.capacity,
                    location: classrooms.location,
                    classroomTypeId: classroomTypes.id,
                })
                .from(classrooms)
                .innerJoin(
                    classroomTypes,
                    eq(classrooms.classroomTypeId, classroomTypes.id)
                )
                .where(eq(classroomTypes.scheduleId, scheduleId)),
            db
                .select({ id: classroomTypes.id })
                .from(classroomTypes)
                .where(eq(classroomTypes.scheduleId, scheduleId)),
            db
                .select({
                    id: instructors.id,
                    firstName: instructors.firstName,
                    lastName: instructors.lastName,
                })
                .from(instructors)
                .where(eq(instructors.scheduleId, scheduleId)),
            db
                .select({
                    id: majors.id,
                    name: majors.name,
                })
                .from(majors)
                .where(eq(majors.scheduleId, scheduleId)),
            db
                .select({
                    id: courses.id,
                    title: courses.title,
                    code: courses.code,
                    color: courses.color,
                    capacity: courses.capacity,
                    duration: courses.duration,
                    majorId: courses.majorId,
                })
                .from(courses)
                .where(eq(courses.scheduleId, scheduleId)),
            db
                .select({
                    instructorId: instructorTimeConstraint.instructorId,
                    day: instructorTimeConstraintDay.day,
                    timeSlot: instructorTimeConstraintTimeSlot.timeSlot,
                })
                .from(instructorTimeConstraint)
                .innerJoin(
                    instructorTimeConstraintDay,
                    eq(
                        instructorTimeConstraint.id,
                        instructorTimeConstraintDay.instructorTimeConstraintId
                    )
                )
                .innerJoin(
                    instructorTimeConstraintTimeSlot,
                    eq(
                        instructorTimeConstraintDay.id,
                        instructorTimeConstraintTimeSlot.instructorTimeConstraintDayId
                    )
                )
                .where(eq(instructorTimeConstraint.scheduleId, scheduleId)),
        ]);

        const courseIds = courseRows.map((c) => c.id);
        const sectionRows =
            courseIds.length > 0
                ? await db
                      .select({
                          id: sections.id,
                          number: sections.number,
                          status: sections.status,
                          courseId: sections.courseId,
                          instructorId: sections.instructorId,
                      })
                      .from(sections)
                      .where(inArray(sections.courseId, courseIds))
                : [];

        const sectionIds = sectionRows.map((s) => s.id);
        const courseHourRows =
            sectionIds.length > 0
                ? await db
                      .select({
                          id: courseHours.id,
                          separatedDuration: courseHours.separatedDuration,
                          sectionId: courseHours.sectionId,
                          preferClassRoomId: courseHours.preferClassRoomId,
                      })
                      .from(courseHours)
                      .where(inArray(courseHours.sectionId, sectionIds))
                      .orderBy(courseHours.id)
                : [];

        const dbFetchMs = performance.now() - dbFetchStart;

        // 2. Build lookup maps & fix preferClassRoomId -> classroom_type_id vs classroom_id ambiguity
        const classroomTypeIdSet = new Set(classroomTypeRows.map((t) => t.id));
        const classroomIdSet = new Set(classroomRows.map((c) => c.id));
        const majorNameMap = new Map(majorRows.map((m) => [m.id, m.name]));

        const hoursBySection = new Map<number, typeof courseHourRows>();
        for (const ch of courseHourRows) {
            const list = hoursBySection.get(ch.sectionId);
            if (list) list.push(ch);
            else hoursBySection.set(ch.sectionId, [ch]);
        }

        const sectionsByCourse = new Map<number, typeof sectionRows>();
        for (const sec of sectionRows) {
            const list = sectionsByCourse.get(sec.courseId);
            if (list) list.push(sec);
            else sectionsByCourse.set(sec.courseId, [sec]);
        }

        // Build constraint buckets grouped by instructorId + day
        const constraintBucket = new Map<string, RustTimeConstraintInput>();
        for (const row of constraintJoinRows) {
            const key = `${row.instructorId}::${row.day}`;
            const normalized = normalizeTimeRange(row.timeSlot);
            const existing = constraintBucket.get(key);
            if (existing) {
                if (!existing.time_slots.includes(normalized)) {
                    existing.time_slots.push(normalized);
                }
            } else {
                constraintBucket.set(key, {
                    instructor_id: row.instructorId,
                    day: row.day,
                    time_slots: [normalized],
                });
            }
        }

        // 3. Transform payload into RustScheduleRequest
        const rustTimeSlots: RustTimeSlotInput[] = timeSlotRows.map((ts) => ({
            id: ts.id,
            start_time: normalizeTimeToHHMM(ts.startTime),
            end_time: normalizeTimeToHHMM(ts.endTime),
        }));

        const rustClassrooms: RustClassroomInput[] = classroomRows.map((cls) => ({
            id: cls.id,
            code: cls.code,
            name: cls.name,
            capacity: cls.capacity,
            classroom_type_id: cls.classroomTypeId,
            location: cls.location,
        }));

        const rustInstructors: RustInstructorInput[] = instructorRows.map(
            (inst) => ({
                id: inst.id,
                first_name: inst.firstName,
                last_name: inst.lastName,
            })
        );

        const rustCourses: RustCourseInput[] = [];
        const courseMap = new Map<number, (typeof courseRows)[number]>();
        const sectionMap = new Map<number, (typeof sectionRows)[number]>();

        for (const course of courseRows) {
            courseMap.set(course.id, course);
            const secs = sectionsByCourse.get(course.id) ?? [];
            const rustSections: RustSectionInput[] = [];

            for (const sec of secs) {
                sectionMap.set(sec.id, sec);
                const chRows = hoursBySection.get(sec.id) ?? [];
                const validUnits: RustUnitInput[] = [];

                for (const ch of chRows) {
                    const dur =
                        ch.separatedDuration !== null &&
                        ch.separatedDuration !== undefined &&
                        ch.separatedDuration > 0
                            ? ch.separatedDuration
                            : course.duration;

                    // Fix original schema mismatch: courses/route.ts stores classroomTypes.id inside courseHours.preferClassRoomId
                    let preferClassroomTypeId: number | null = null;
                    let preferClassroomId: number | null = null;
                    if (
                        ch.preferClassRoomId !== null &&
                        ch.preferClassRoomId !== undefined
                    ) {
                        if (classroomTypeIdSet.has(ch.preferClassRoomId)) {
                            preferClassroomTypeId = ch.preferClassRoomId;
                        } else if (classroomIdSet.has(ch.preferClassRoomId)) {
                            preferClassroomId = ch.preferClassRoomId;
                        }
                    }

                    validUnits.push({
                        course_hours_id: ch.id,
                        duration: dur,
                        prefer_classroom_type_id: preferClassroomTypeId,
                        prefer_classroom_id: preferClassroomId,
                    });
                }

                if (validUnits.length === 0) {
                    validUnits.push({
                        course_hours_id: null,
                        duration: course.duration,
                        prefer_classroom_type_id: null,
                        prefer_classroom_id: null,
                    });
                }

                rustSections.push({
                    id: sec.id,
                    number: sec.number,
                    instructor_id: sec.instructorId,
                    status: sec.status,
                    is_online:
                        sec.status?.trim().toLowerCase() === "online"
                            ? true
                            : false,
                    units: validUnits,
                });
            }

            if (rustSections.length > 0) {
                rustCourses.push({
                    id: course.id,
                    title: course.title,
                    code: course.code,
                    color: course.color,
                    capacity: course.capacity,
                    duration: course.duration,
                    major_id: course.majorId,
                    major_name: majorNameMap.get(course.majorId) ?? null,
                    sections: rustSections,
                });
            }
        }

        const rustRequest: RustScheduleRequest = {
            schedule_id: scheduleId,
            time_slots: rustTimeSlots,
            classrooms: rustClassrooms,
            instructors: rustInstructors,
            time_constraints: Array.from(constraintBucket.values()),
            courses: rustCourses,
            config: solverConfig,
        };

        // 4. Solve in Rust engine
        const rustResult = await runRustScheduler(rustRequest);

        // 5. Persist results in a single atomic transaction (no N+1 sequential round-trips)
        const dbWriteStart = performance.now();
        await db.transaction(async (tx) => {
            // Nullify failed existing courseHours rows
            const failedExistingIds = rustResult.failed_units
                .map((u) => u.course_hours_id)
                .filter((id): id is number => id !== null && id !== undefined);

            if (failedExistingIds.length > 0) {
                await tx
                    .update(courseHours)
                    .set({
                        day: null,
                        timeSlot: null,
                        classroomId: null,
                    })
                    .where(inArray(courseHours.id, failedExistingIds));
            }

            // Nullify any unscheduled sections without courseHoursId
            const failedSectionIdsWithoutCh = rustResult.failed_units
                .filter((u) => u.course_hours_id === null)
                .map((u) => u.section_id);
            if (failedSectionIdsWithoutCh.length > 0) {
                await tx
                    .update(courseHours)
                    .set({
                        day: null,
                        timeSlot: null,
                        classroomId: null,
                    })
                    .where(inArray(courseHours.sectionId, failedSectionIdsWithoutCh));
            }

            // Update existing assigned courseHours rows in chunked Promise.all inside transaction
            const toUpdate = rustResult.assignments.filter(
                (a) => a.course_hours_id !== null && a.course_hours_id !== undefined
            );
            const CHUNK_SIZE = 50;
            for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
                const slice = toUpdate.slice(i, i + CHUNK_SIZE);
                await Promise.all(
                    slice.map((a) =>
                        tx
                            .update(courseHours)
                            .set({
                                day: a.day,
                                timeSlot: `${a.start_time} - ${a.end_time}`,
                                classroomId: a.is_online ? null : a.classroom_id,
                            })
                            .where(eq(courseHours.id, a.course_hours_id!))
                    )
                );
            }

            // Batch insert any synthetic units that lacked an existing courseHours row
            const toInsert = rustResult.assignments.filter(
                (a) => a.course_hours_id === null || a.course_hours_id === undefined
            );
            if (toInsert.length > 0) {
                await tx.insert(courseHours).values(
                    toInsert.map((a) => ({
                        day: a.day,
                        timeSlot: `${a.start_time} - ${a.end_time}`,
                        separatedDuration: a.duration_hours,
                        classroomId: a.is_online ? null : a.classroom_id,
                        sectionId: a.section_id,
                    }))
                );
            }
        });
        const dbWriteMs = performance.now() - dbWriteStart;

        // 6. Zero-query frontend transformation
        const transformedSchedule = rustResult.assignments.map((a) => {
            const course = courseMap.get(a.course_id);
            const sec = sectionMap.get(a.section_id);
            const nameParts = a.instructor_name.trim().split(/\s+/);
            return {
                id: a.course_hours_id ?? a.section_id,
                section_id: a.section_id,
                course_hours_id: a.course_hours_id,
                course_code: a.course_code,
                course_title: a.course_title,
                course_color: a.course_color ?? course?.color ?? "",
                instructor_name: a.instructor_name,
                day: a.day,
                start_time: a.start_time,
                end_time: a.end_time,
                classroom_code: a.classroom_code,
                classroom_id: a.classroom_id,
                classroom_location: a.classroom_location,
                duration: a.duration_hours,
                separated_duration: a.duration_hours,
                section_number: a.section_number || sec?.number || "",
                firstName: nameParts[0] ?? "",
                lastName: nameParts.slice(1).join(" "),
                title: a.course_title,
                code: a.course_code,
                isOnline: a.is_online,
            };
        });

        const totalMs = performance.now() - reqStart;

        const responsePayload: {
            success: boolean;
            message: string;
            schedule: typeof transformedSchedule;
            stats: {
                totalCourses: number;
                totalSections: number;
                scheduledAssignments: number;
                constraintsApplied: number;
                failedAssignments: number;
            };
            errors: typeof rustResult.errors;
            warnings: string[];
            metrics: RustSolverMetrics;
            timing: {
                dbFetchMs: number;
                rustSolveMs: number;
                dbWriteMs: number;
                totalMs: number;
            };
        } = {
            success: rustResult.errors.length === 0,
            message: rustResult.message,
            schedule: transformedSchedule,
            stats: {
                totalCourses: rustResult.stats.total_courses,
                totalSections: rustResult.stats.total_sections,
                scheduledAssignments: rustResult.stats.scheduled_assignments,
                constraintsApplied: rustResult.stats.constraints_applied,
                failedAssignments: rustResult.stats.failed_assignments,
            },
            errors: rustResult.errors,
            warnings: rustResult.warnings,
            metrics: rustResult.metrics,
            timing: {
                dbFetchMs: Math.round(dbFetchMs * 100) / 100,
                rustSolveMs: Math.round(rustResult.metrics.solve_time_ms * 100) / 100,
                dbWriteMs: Math.round(dbWriteMs * 100) / 100,
                totalMs: Math.round(totalMs * 100) / 100,
            },
        };

        return NextResponse.json(responsePayload);
    } catch (error: unknown) {
        console.error("Error generating schedule with Rust engine:", error);
        const errorMessage =
            error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to generate schedule",
                details: errorMessage,
                errors: [],
                warnings: [],
            },
            { status: 500 }
        );
    }
}
