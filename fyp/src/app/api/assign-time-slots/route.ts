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
            .innerJoin(courseHours, eq(courseHours.id, sections.courseHoursId))
            .innerJoin(instructors, eq(instructors.id, courses.instructorId))
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

        // Check if body is an array
        if (!Array.isArray(body)) {
            return NextResponse.json(
                { error: "Expected an array of assignments" },
                { status: 400 }
            );
        }

        // Validate each item in the array
        const results = [];

        for (const assignment of body) {
            const validationResult = saveTimetableSchema.safeParse(assignment);
            if (!validationResult.success) {
                // Log the error but continue processing other items
                console.error(
                    `Validation error for assignment: ${JSON.stringify(
                        assignment
                    )}`,
                    validationResult.error.errors
                );
                continue;
            }

            const { sectionId, day, startTime, endTime, classroom } =
                validationResult.data;

            // First, create the course hour
            await db.insert(courseHours).values({
                day: day,
                timeSlot: `${startTime} - ${endTime}`,
            });

            // Get the ID of the newly created course hour
            const createdCourseHour = await db
                .select({ id: courseHours.id })
                .from(courseHours)
                .where(eq(courseHours.timeSlot, `${startTime} - ${endTime}`))
                .limit(1);

            if (createdCourseHour.length === 0) {
                console.error(
                    `Failed to create course hour for section ${sectionId}`
                );
                continue; // Skip to next assignment
            }

            const courseHourId = createdCourseHour[0].id;

            // Update the section with the reference to the new course hour
            await db
                .update(sections)
                .set({
                    courseHoursId: courseHourId,
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
        }

        return NextResponse.json({
            message: `Successfully processed ${results.length} of ${body.length} assignments`,
            data: results,
        });
    } catch (error: unknown) {
        console.error("Error saving timetable assignments:", error);
        return NextResponse.json(
            { error: "Failed to save timetable assignments" },
            { status: 500 }
        );
    }
}

// PATCH to update assignment (when moving a course to a different time slot)
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const validatedData = timetableAssignmentSchema.parse(body);
        const { sectionId, courseHoursId, classroomId } = validatedData;
        // Note: day is validated but not used directly in the sections update

        // Update the section with new assignment data
        await db
            .update(sections)
            .set({
                courseHoursId,
                classroomId,
            })
            .where(eq(sections.id, sectionId));

        // Fetch the updated section separately
        const updatedSection = await db
            .select()
            .from(sections)
            .where(eq(sections.id, sectionId))
            .limit(1);

        return NextResponse.json(updatedSection[0] || { id: sectionId });
    } catch (error: unknown) {
        console.error("Error updating timetable assignment:", error);
        return NextResponse.json(
            { error: "Failed to update timetable assignment" },
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
                courseHoursId: null,
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
