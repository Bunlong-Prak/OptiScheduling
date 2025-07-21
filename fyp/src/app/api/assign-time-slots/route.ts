import {
    classrooms,
    courseHours,
    courses,
    instructors,
    sections,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
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
    courseHoursId: z.number(),
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
            const isOnline = assignment.classroomId !== null && assignment.classroomId < 0;

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
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");

        if (!scheduleId) {
            return NextResponse.json(
                { error: "scheduleId is required" },
                { status: 400 }
            );
        }

        const body = await request.json();

        // Check if body is an array
        if (!Array.isArray(body)) {
            return NextResponse.json(
                { error: "Expected an array of assignments" },
                { status: 400 }
            );
        }

        const results = [];
        const errors = [];

        // Extract all course hour IDs from the request
        const requestCourseHourIds = new Set();
        body.forEach((assignment) => {
            // Only add 'id' if it's a valid number, indicating an existing course hour
            if (assignment.id && typeof assignment.id === "number") {
                requestCourseHourIds.add(assignment.id);
            }
        });

        // Get all existing course hours for this specific schedule
        const allExistingCourseHours = await db
            .select({
                id: courseHours.id,
                sectionId: courseHours.sectionId,
            })
            .from(courseHours)
            .innerJoin(sections, eq(courseHours.sectionId, sections.id))
            .innerJoin(courses, eq(sections.courseId, courses.id))
            .where(eq(courses.scheduleId, parseInt(scheduleId)));

        // Find course hours that exist in database (for this schedule) but not in request body
        // These are the course hours that should be unassigned (day, timeSlot, classroomId set to null)
        const courseHoursToNull = allExistingCourseHours.filter(
            (courseHour) => !requestCourseHourIds.has(courseHour.id)
        );

        // Set day, timeSlot, and classroomId to null for missing course hours
        if (courseHoursToNull.length > 0) {
            const courseHourIdsToNull = courseHoursToNull.map((ch) => ch.id);

            await db
                .update(courseHours)
                .set({
                    day: null,
                    timeSlot: null,
                    classroomId: null,
                })
                .where(inArray(courseHours.id, courseHourIdsToNull));

            console.log(
                `Nullified ${courseHoursToNull.length} course hours that were not in the request for schedule ${scheduleId}`
            );
        }

        // Process each assignment from the request body
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
                continue; // Skip to the next assignment if validation fails
            }

            const {
                id, // This is the courseHour.id from the frontend, if it exists
                sectionId,
                day,
                startTime,
                endTime,
                classroom,
                isOnline,
                duration,
            } = validationResult.data;

            // Debug logging for the assignment data
            console.log("Assignment data:", {
                id,
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
                // First, verify that the section belongs to the specified schedule
                const sectionScheduleCheck = await db
                    .select({ scheduleId: courses.scheduleId })
                    .from(sections)
                    .innerJoin(courses, eq(sections.courseId, courses.id))
                    .where(eq(sections.id, sectionId))
                    .limit(1);

                if (
                    sectionScheduleCheck.length === 0 ||
                    sectionScheduleCheck[0].scheduleId !== parseInt(scheduleId)
                ) {
                    console.error(
                        `Section ${sectionId} does not belong to schedule ${scheduleId}`
                    );
                    errors.push({
                        sectionId,
                        error: `Section does not belong to the specified schedule`,
                    });
                    continue; // Skip to the next assignment if section doesn't match schedule
                }

                let currentCourseHourId: number | null = id; // This variable will hold the ID of the course hour being processed (either existing or newly created)

                // If an 'id' is provided in the assignment, attempt to update that specific course hour
                if (currentCourseHourId) {
                    const existingCourseHourById = await db
                        .select({ id: courseHours.id })
                        .from(courseHours)
                        .where(eq(courseHours.id, currentCourseHourId))
                        .limit(1); // Should only find one if ID is unique and valid

                    if (existingCourseHourById.length > 0) {
                        // Course hour with the given ID exists, so update it
                        console.log(
                            `Updating existing course hour with ID: ${currentCourseHourId} for section ${sectionId}...`
                        );
                        await db
                            .update(courseHours)
                            .set({
                                day: day,
                                timeSlot: `${startTime} - ${endTime}`,
                                separatedDuration: duration, // Ensure duration is also updated
                            })
                            .where(eq(courseHours.id, currentCourseHourId));
                    } else {
                        // If an ID was provided but no matching course hour was found,
                        // it implies either an invalid ID was sent or it's a new entry that
                        // was mistakenly given an ID. In this scenario, we'll treat it as a new creation.
                        console.warn(
                            `Provided courseHour ID ${currentCourseHourId} not found. Creating a new course hour for section ${sectionId}.`
                        );
                        currentCourseHourId = null; // Force creation of a new one by setting ID to null
                    }
                }

                // If no ID was provided (currentCourseHourId is null), or if the provided ID didn't exist, create a new course hour.
                if (!currentCourseHourId) {
                    console.log(
                        `Creating new course hour for section ${sectionId}...`
                    );

                    // Insert the new course hour into the database
                    await db.insert(courseHours).values({
                        sectionId: sectionId,
                        day: day,
                        timeSlot: `${startTime} - ${endTime}`,
                        separatedDuration: duration,
                    });

                    const whereConditions = [
                        eq(courseHours.sectionId, sectionId),
                        eq(courseHours.day, day),
                        eq(courseHours.timeSlot, `${startTime} - ${endTime}`),
                    ];
                    if (typeof duration !== "undefined") {
                        whereConditions.push(
                            eq(courseHours.separatedDuration, duration)
                        );
                    }

                    const createdCourseHour = await db
                        .select({ id: courseHours.id })
                        .from(courseHours)
                        .where(and(...whereConditions))
                        .limit(1); // Limit to 1, assuming these conditions uniquely identify the new row

                    if (createdCourseHour.length === 0) {
                        console.error(
                            `Failed to retrieve ID for newly created course hour for section ${sectionId}`
                        );
                        errors.push({
                            sectionId,
                            error: "Failed to create and retrieve course hour ID",
                        });
                        continue; // Skip to the next assignment if we can't get the new ID
                    }
                    currentCourseHourId = createdCourseHour[0].id; // Assign the newly created ID
                    console.log(
                        `Created course hour with ID: ${currentCourseHourId}`
                    );
                }

                // Now, update the classroom ID for the identified or newly created course hour.
                // For online courses, preserve the virtual classroom ID; for physical courses, use the actual classroom ID
                let classroomId: number | null;
                
                if (isOnline) {
                    // For online courses, parse the classroom parameter which contains the virtual classroom ID
                    classroomId = classroom ? parseInt(classroom) : -1;
                } else {
                    // For physical courses, set to null if no classroom provided, otherwise parse the classroom ID
                    classroomId = classroom ? parseInt(classroom) : null;
                }

                await db
                    .update(courseHours)
                    .set({
                        classroomId: classroomId,
                    })
                    .where(eq(courseHours.id, currentCourseHourId)); // Use the currentCourseHourId for the update

                // Fetch the updated section and the full course hour data to include in the response
                const updatedSection = await db
                    .select()
                    .from(sections)
                    .where(eq(sections.id, sectionId))
                    .limit(1);

                const fullCourseHour = await db
                    .select()
                    .from(courseHours)
                    .where(eq(courseHours.id, currentCourseHourId))
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

        // Prepare the final response
        const response = {
            message: `Successfully processed ${results.length} of ${body.length} assignments for schedule ${scheduleId}`,
            data: results,
            nullifiedCourseHours: courseHoursToNull.length,
            scheduleId: parseInt(scheduleId),
            ...(errors.length > 0 && {
                // Only include errors if there are any
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

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const validatedData = removeTimetableAssignmentSchema.parse(body);
        const { courseHoursId } = validatedData;

        await db
            .update(courseHours)
            .set({
                day: null,
                timeSlot: null,
                classroomId: null,
            })
            .where(eq(courseHours.id, courseHoursId));

        return NextResponse.json({
            message: "Assignment removed successfully",
        });
    } catch (error: unknown) {
        console.error("Error removing timetable assignment:", error);
        return NextResponse.json(
            { error: "Failed to remove timetable assignment" },
            { status: 500 }
        );
    }
}
