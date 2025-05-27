import {
    classrooms,
    courseHours,
    courses,
    instructors,
    sections,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// Validation schema for timetable assignments
const timetableAssignmentSchema = z.object({
    sectionId: z.number(),
    courseHoursId: z.number(),
    classroomId: z.number(),
    day: z.string(),
    duration: z.number().optional(),
});

const saveTimetableSchema = z.object({
    sectionId: z.number(),
    day: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    classroom: z.string(),
});

const removeTimetableAssignmentSchema = z.object({
    sectionId: z.number(),
});

// GET timetable assignments
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");

        if (!scheduleId) {
            return NextResponse.json(
                { error: "Schedule ID is required" },
                { status: 400 }
            );
        }

        // Join sections with courseHours to get all assignments
        const assignments = await db
            .select({
                sectionId: sections.id,
                courseHours: courseHours.timeSlot,
                classroom: classrooms.code,
                code: courses.code,
                title: courses.title,
                firstName: instructors.firstName,
                lastName: instructors.lastName,
                day: courseHours.day,
                timeSlot: courseHours.timeSlot,
                duration: courses.duration,
                color: courses.color,
            })
            .from(courses)
            .innerJoin(sections, eq(sections.courseId, courses.id))
            .innerJoin(courseHours, eq(courseHours.sectionId, sections.id))
            .innerJoin(instructors, eq(instructors.id, sections.instructorId))
            .innerJoin(classrooms, eq(classrooms.id, sections.classroomId))
            .where(eq(courses.scheduleId, parseInt(scheduleId)));
        console.log("Assignments:", assignments);
        return NextResponse.json(assignments);
    } catch (error: unknown) {
        console.error("Error fetching timetable assignments:", error);
        return NextResponse.json(
            { error: "Failed to fetch timetable assignments" },
            { status: 500 }
        );
    }
}

// POST new course to timetable
export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (body.length === 0) {
            await db.delete(courseHours);
            return NextResponse.json("AH PLER");
        }
        // Check if body is an array
        if (!Array.isArray(body)) {
            return NextResponse.json(
                { error: "Expected an array of assignments" },
                { status: 400 }
            );
        }

        // Extract all sectionIds from the request
        const requestSectionIds = new Set(
            body.map((assignment) => assignment.sectionId).filter(Boolean)
        );

        console.log("Section IDs in request:", Array.from(requestSectionIds));

        // Find and delete course hours that don't have matching sections in the request
        if (requestSectionIds.size > 0) {
            // Get all existing course hours
            const existingCourseHours = await db
                .select({
                    id: courseHours.id,
                    sectionId: courseHours.sectionId,
                })
                .from(courseHours);

            // Find course hours that should be deleted (not in the request)
            const courseHoursToDelete = existingCourseHours.filter(
                (courseHour) => !requestSectionIds.has(courseHour.sectionId)
            );

            console.log(
                `Found ${courseHoursToDelete.length} course hours to delete`
            );

            // Delete course hours that are not in the request
            if (courseHoursToDelete.length > 0) {
                const idsToDelete = courseHoursToDelete.map((ch) => ch.id);

                await db
                    .delete(courseHours)
                    .where(inArray(courseHours.id, idsToDelete));

                console.log(
                    `Deleted ${courseHoursToDelete.length} course hours:`,
                    courseHoursToDelete.map((ch) => ({
                        id: ch.id,
                        sectionId: ch.sectionId,
                    }))
                );

                // Also clear classroom assignments for sections that were removed
                const sectionsToCleanup = courseHoursToDelete.map(
                    (ch) => ch.sectionId
                );
                if (sectionsToCleanup.length > 0) {
                    await db
                        .update(sections)
                        .set({ classroomId: null })
                        .where(inArray(sections.id, sectionsToCleanup));

                    console.log(
                        `Cleared classroom assignments for ${sectionsToCleanup.length} sections`
                    );
                }
            }
        }

        // Validate each item in the array
        const results = [];
        const errors = [];

        for (const assignment of body) {
            const validationResult = saveTimetableSchema.safeParse(assignment);

            if (!validationResult.success) {
                // Log the error but continue processing other items
                const errorMsg = `Validation error for assignment: ${JSON.stringify(
                    assignment
                )}`;
                console.error(errorMsg, validationResult.error.errors);
                errors.push({
                    assignment,
                    error: validationResult.error.errors,
                });
                continue;
            }

            const { sectionId, day, startTime, endTime, classroom } =
                validationResult.data;

            try {
                // Check if course hour already exists for this section
                const existingCourseHour = await db
                    .select()
                    .from(courseHours)
                    .where(eq(courseHours.sectionId, sectionId))
                    .limit(1);

                let courseHourId;

                if (existingCourseHour.length > 0) {
                    console.log(
                        `Course hour already exists for section ${sectionId}, updating...`
                    );

                    // Update existing course hour
                    courseHourId = existingCourseHour[0].id;
                    await db
                        .update(courseHours)
                        .set({
                            day: day,
                            timeSlot: `${startTime} - ${endTime}`,
                        })
                        .where(eq(courseHours.id, courseHourId));
                } else {
                    // Create new course hour
                    await db.insert(courseHours).values({
                        day: day,
                        timeSlot: `${startTime} - ${endTime}`,
                        sectionId: sectionId,
                    });

                    // Get the ID of the newly created course hour
                    const createdCourseHour = await db
                        .select({ id: courseHours.id })
                        .from(courseHours)
                        .where(eq(courseHours.sectionId, sectionId));

                    if (createdCourseHour.length === 0) {
                        console.error(
                            `Failed to create course hour for section ${sectionId}`
                        );
                        errors.push({
                            sectionId,
                            error: "Failed to create course hour",
                        });
                        continue;
                    }

                    courseHourId = createdCourseHour[0].id;
                }

                console.log("Processing section:", sectionId);

                // Update the section with the classroom ID
                await db
                    .update(sections)
                    .set({
                        classroomId: parseInt(classroom),
                    })
                    .where(eq(sections.id, sectionId));

                // Get the updated section
                const updatedSection = await db
                    .select()
                    .from(sections)
                    .where(eq(sections.id, sectionId))
                    .limit(1);

                // Add this assignment's result to the results array
                results.push({
                    sectionId,
                    courseHour: { id: courseHourId },
                    section: updatedSection[0],
                });
            } catch (assignmentError) {
                console.error(
                    `Error processing assignment for section ${sectionId}:`,
                    assignmentError
                );
                errors.push({
                    sectionId,
                    assignment,
                    error:
                        assignmentError instanceof Error
                            ? assignmentError.message
                            : "Unknown error",
                });
            }
        }

        // Prepare response
        const response = {
            message: `Successfully processed ${results.length} of ${body.length} assignments`,
            data: results,
            ...(errors.length > 0 && {
                errors: errors,
                errorCount: errors.length,
            }),
        };

        return NextResponse.json(response);
    } catch (error: unknown) {
        console.error("Error saving timetable assignments:", error);
        return NextResponse.json(
            {
                error: "Failed to save timetable assignments",
                details:
                    error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// DELETE to remove assignment (when dragging a course out of the timetable)
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const validatedData = removeTimetableAssignmentSchema.parse(body);
        const { sectionId } = validatedData;

        // Remove the assignment by setting courseHoursId and classroomId to null
        await db
            .update(sections)
            .set({
                classroomId: null,
            })
            .where(eq(sections.id, sectionId));

        // Fetch the updated section separately
        const updatedSection = await db
            .select()
            .from(sections)
            .where(eq(sections.id, sectionId))
            .limit(1);

        return NextResponse.json({
            message: "Assignment removed successfully",
            section: updatedSection[0] || { id: sectionId },
        });
    } catch (error: unknown) {
        console.error("Error removing timetable assignment:", error);
        return NextResponse.json(
            { error: "Failed to remove timetable assignment" },
            { status: 500 }
        );
    }
}
