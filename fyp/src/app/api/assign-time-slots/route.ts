import {
    classrooms,
    courseHours,
    courses,
    instructors,
    sections,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
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
    id: z.number(), // Optional ID for existing assignments
    sectionId: z.number(),
    day: z.string(),
    duration: z.number().optional(), // Duration in minutes
    startTime: z.string(),
    endTime: z.string(),
    classroom: z.string().nullable(), // Allow null for online courses
    isOnline: z.boolean().optional(), // Flag for online courses
});

const removeTimetableAssignmentSchema = z.object({
    sectionId: z.number(),
});

// GET timetable assignments
// GET timetable assignments - Updated to handle online courses
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
        // Use LEFT JOIN for classrooms to include courses without assigned classrooms (online courses)
        const assignments = await db
            .select({
                id: courseHours.id,
                sectionId: sections.id,
                sectionNumber: sections.number,
                courseHours: courseHours.timeSlot,
                classroom: classrooms.code, // This will be null for online courses
                classroomId: courseHours.classroomId, // Include this to check if it's null
                code: courses.code,
                title: courses.title,
                firstName: instructors.firstName,
                lastName: instructors.lastName,
                capacity: courses.capacity,
                day: courseHours.day,
                timeSlot: courseHours.timeSlot,
                duration: courseHours.separatedDuration,
                color: courses.color,
            })
            .from(courses)
            .innerJoin(sections, eq(sections.courseId, courses.id))
            .innerJoin(courseHours, eq(courseHours.sectionId, sections.id))
            .innerJoin(instructors, eq(instructors.id, sections.instructorId))
            .leftJoin(classrooms, eq(classrooms.id, courseHours.classroomId)) // LEFT JOIN to include null classrooms
            .where(eq(courses.scheduleId, parseInt(scheduleId)));

        console.log("Raw assignments from DB:", assignments);

        // Process assignments to handle online courses
        const processedAssignments = assignments.map((assignment) => {
            const isOnline = assignment.classroomId === null;

            return {
                ...assignment,
                // For online courses, provide a virtual classroom code
                classroom: isOnline ? "Online" : assignment.classroom,
                isOnline: isOnline,
            };
        });

        console.log("Processed assignments:", processedAssignments);
        return NextResponse.json(processedAssignments);
    } catch (error: unknown) {
        console.error("Error fetching timetable assignments:", error);
        return NextResponse.json(
            { error: "Failed to fetch timetable assignments" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Check if body is an array
        if (!Array.isArray(body)) {
            return NextResponse.json(
                { error: "Expected an array of assignments" },
                { status: 400 }
            );
        }

        // Validate each item in the array
        const results = [];
        const errors = [];

        // Extract all course hour IDs from the request
        const requestCourseHourIds = new Set();
        body.forEach((assignment) => {
            if (assignment.id) {
                requestCourseHourIds.add(assignment.id);
            }
        });

        // Get all existing course hours
        const allExistingCourseHours = await db
            .select({ id: courseHours.id })
            .from(courseHours);

        // Find course hours that exist in database but not in request
        const courseHoursToNull = allExistingCourseHours.filter(
            (courseHour) => !requestCourseHourIds.has(courseHour.id)
        );

        // Set day, timeSlot, and classroomId to null for missing course hours

        // Process each assignment
        for (const assignment of body) {
            const validationResult = saveTimetableSchema.safeParse(assignment);

            if (!validationResult.success) {
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

            const {
                id,
                sectionId,
                day,
                startTime,
                endTime,
                classroom,
                isOnline,
                duration,
            } = validationResult.data;

            // Debug logging
            console.log("Assignment data:", {
                sectionId,
                day,
                startTime,
                endTime,
                classroom,
                isOnline,
                duration,
            });
            console.log("Time slot will be:", `${startTime} - ${endTime}`);

            try {
                // Check if course hour already exists for this section
                const existingCourseHour = await db
                    .select({ id: courseHours.id })
                    .from(courseHours)
                    .where(eq(courseHours.sectionId, sectionId))
                    .limit(1);

                let courseHourId;

                if (existingCourseHour.length > 0) {
                    // Update existing course hour
                    courseHourId = existingCourseHour[0].id;
                    console.log(
                        `Updating existing course hour with ID: ${courseHourId} for section ${sectionId}...`
                    );

                    await db
                        .update(courseHours)
                        .set({
                            day: day,
                            timeSlot: `${startTime} - ${endTime}`,
                        })
                        .where(eq(courseHours.id, id));
                } else {
                    // Create new course hour
                    console.log(
                        `Creating new course hour for section ${sectionId}...`
                    );

                    await db.insert(courseHours).values({
                        sectionId: sectionId,
                        day: day,
                        timeSlot: `${startTime} - ${endTime}`,
                        separatedDuration: duration,
                    });

                    // Get the created course hour ID
                    const createdCourseHour = await db
                        .select({ id: courseHours.id })
                        .from(courseHours)
                        .where(eq(courseHours.sectionId, sectionId))
                        .limit(1);

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
                    console.log(`Created course hour with ID: ${courseHourId}`);
                }

                console.log("Processing section:", sectionId);

                // Update the section with the classroom ID
                // For online courses, set classroomId to null
                const classroomId =
                    isOnline || !classroom ? null : parseInt(classroom);

                await db
                    .update(courseHours)
                    .set({
                        classroomId: classroomId,
                    })
                    .where(eq(courseHours.id, id));

                // Get the updated section
                const updatedSection = await db
                    .select()
                    .from(sections)
                    .where(eq(sections.id, sectionId))
                    .limit(1);

                // Get the full course hour data to include in response
                const fullCourseHour = await db
                    .select()
                    .from(courseHours)
                    .where(eq(courseHours.id, courseHourId))
                    .limit(1);

                results.push({
                    sectionId,
                    courseHour: fullCourseHour[0], // This will include day, timeSlot, etc.
                    section: updatedSection[0],
                    isOnline: isOnline || false,
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
            nullifiedCourseHours: courseHoursToNull.length,
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
            .update(courseHours)
            .set({
                classroomId: null,
            })
            .where(eq(courseHours.id, sectionId));

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
