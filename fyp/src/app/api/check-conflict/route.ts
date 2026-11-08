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
    sections,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import {
    runRustConflictCheck,
    RustClassroomInput,
    RustExistingAssignmentInput,
    RustSolverConfig,
    RustTimeConstraintInput,
} from "@/lib/rust-scheduler";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

interface CheckConflictBody {
    scheduleId: number | string;
    candidate: RustExistingAssignmentInput;
    existingAssignments?: RustExistingAssignmentInput[];
    config?: RustSolverConfig;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as CheckConflictBody;
        const scheduleId =
            typeof body.scheduleId === "string"
                ? parseInt(body.scheduleId, 10)
                : body.scheduleId;

        if (!scheduleId || Number.isNaN(scheduleId) || !body.candidate) {
            return NextResponse.json(
                { error: "scheduleId and candidate are required" },
                { status: 400 }
            );
        }

        const [classroomRows, constraintJoinRows, dbAssignments] =
            await Promise.all([
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
                body.existingAssignments
                    ? Promise.resolve(null)
                    : db
                          .select({
                              courseHoursId: courseHours.id,
                              sectionId: sections.id,
                              sectionNumber: sections.number,
                              status: sections.status,
                              courseId: courses.id,
                              courseCode: courses.code,
                              courseTitle: courses.title,
                              capacity: courses.capacity,
                              majorId: courses.majorId,
                              majorName: majors.name,
                              instructorId: instructors.id,
                              firstName: instructors.firstName,
                              lastName: instructors.lastName,
                              day: courseHours.day,
                              timeSlot: courseHours.timeSlot,
                              classroomId: courseHours.classroomId,
                              classroomCode: classrooms.code,
                              classroomLocation: classrooms.location,
                          })
                          .from(courses)
                          .innerJoin(sections, eq(sections.courseId, courses.id))
                          .innerJoin(
                              courseHours,
                              eq(courseHours.sectionId, sections.id)
                          )
                          .leftJoin(majors, eq(majors.id, courses.majorId))
                          .leftJoin(
                              instructors,
                              eq(instructors.id, sections.instructorId)
                          )
                          .leftJoin(
                              classrooms,
                              eq(classrooms.id, courseHours.classroomId)
                          )
                          .where(eq(courses.scheduleId, scheduleId)),
            ]);

        const rustClassrooms: RustClassroomInput[] = classroomRows.map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            capacity: c.capacity,
            classroom_type_id: c.classroomTypeId,
            location: c.location,
        }));

        const constraintBucket = new Map<string, RustTimeConstraintInput>();
        for (const row of constraintJoinRows) {
            const key = `${row.instructorId}::${row.day}`;
            const existing = constraintBucket.get(key);
            if (existing) {
                if (!existing.time_slots.includes(row.timeSlot)) {
                    existing.time_slots.push(row.timeSlot);
                }
            } else {
                constraintBucket.set(key, {
                    instructor_id: row.instructorId,
                    day: row.day,
                    time_slots: [row.timeSlot],
                });
            }
        }

        let existingAssignments: RustExistingAssignmentInput[] =
            body.existingAssignments ?? [];

        if (dbAssignments) {
            existingAssignments = [];
            for (const row of dbAssignments) {
                if (!row.day || !row.timeSlot || !row.timeSlot.includes("-")) {
                    continue;
                }
                const [start, end] = row.timeSlot
                    .split("-")
                    .map((s) => s.trim());
                const isOnline =
                    row.status?.toLowerCase() === "online" ||
                    row.classroomId === null ||
                    (row.classroomId !== null && row.classroomId < 0);
                existingAssignments.push({
                    course_hours_id: row.courseHoursId,
                    section_id: row.sectionId,
                    course_id: row.courseId,
                    course_code: row.courseCode,
                    course_title: row.courseTitle,
                    section_number: row.sectionNumber,
                    capacity: row.capacity,
                    major_id: row.majorId,
                    major_name: row.majorName,
                    instructor_id: row.instructorId,
                    instructor_name:
                        row.firstName && row.lastName
                            ? `${row.firstName} ${row.lastName}`
                            : null,
                    is_online: isOnline,
                    day: row.day,
                    start_time: start,
                    end_time: end,
                    classroom_id: row.classroomId,
                    classroom_code: isOnline ? "Online" : row.classroomCode,
                    classroom_location: row.classroomLocation,
                });
            }
        }

        const result = await runRustConflictCheck({
            candidate: body.candidate,
            existing_assignments: existingAssignments,
            classrooms: rustClassrooms,
            time_constraints: Array.from(constraintBucket.values()),
            config: body.config,
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("Error running Rust conflict check:", error);
        return NextResponse.json(
            {
                error: "Failed to check scheduling conflicts",
                details:
                    error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
