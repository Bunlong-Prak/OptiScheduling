import {
    classroomTypes,
    courseHours,
    courses,
    instructors,
    instructorTimeConstraint,
    instructorTimeConstraintDay,
    instructorTimeConstraintTimeSlot,
    majors,
    schedules,
    scheduleTimeSlots,
    sections,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import { generateAcademicYear } from "@/lib/utils";
import {
    createScheduleSchema,
    deleteScheduleSchema,
    editScheduleSchema,
} from "@/lib/validations/schedules";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// GET all schedules
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");
        const userId = searchParams.get("userId");

        if (!scheduleId) {
            // Check if userId is provided
            if (userId) {
                // Fetch all schedules for the user with their time slots
                const allScheduleData = await db
                    .select({
                        id: schedules.id,
                        name: schedules.name,
                        academicYear: schedules.academicYear,
                        timeSlotId: scheduleTimeSlots.id,
                        startTime: scheduleTimeSlots.startTime,
                        endTime: scheduleTimeSlots.endTime,
                        scheduleId: scheduleTimeSlots.scheduleId,
                    })
                    .from(schedules)
                    .where(eq(schedules.userId, userId))
                    .innerJoin(
                        scheduleTimeSlots,
                        eq(scheduleTimeSlots.scheduleId, schedules.id)
                    );

                const scheduleMap = new Map();
                allScheduleData.forEach((item) => {
                    if (!scheduleMap.has(item.id)) {
                        scheduleMap.set(item.id, {
                            id: item.id,
                            name: item.name,
                            academic_year: item.academicYear,
                            timeSlots: [],
                        });
                    }
                    // Add this time slot to the schedule
                    const schedule = scheduleMap.get(item.id);
                    schedule.timeSlots.push({
                        id: item.timeSlotId,
                        startTime: item.startTime,
                        endTime: item.endTime,
                    });
                });

                const formattedSchedules = Array.from(scheduleMap.values());
                console.log("Formatted schedules:", formattedSchedules);
                return NextResponse.json(formattedSchedules);
            }
        } else {
            let query = db
                .select({
                    id: schedules.id,
                    name: schedules.name,
                    academicYear: schedules.academicYear,
                    userId: schedules.userId,
                    timeSlotId: scheduleTimeSlots.id,
                    startTime: scheduleTimeSlots.startTime,
                    endTime: scheduleTimeSlots.endTime,
                })
                .from(schedules)
                .where(eq(schedules.id, parseInt(scheduleId)))
                .innerJoin(
                    scheduleTimeSlots,
                    eq(scheduleTimeSlots.scheduleId, schedules.id)
                );

            const scheduleData = await query;

            if (scheduleData.length === 0) {
                return NextResponse.json(
                    { error: "Schedule not found" },
                    { status: 404 }
                );
            }

            // Format the response for a single schedule
            const schedule = {
                id: scheduleData[0].id,
                name: scheduleData[0].name,
                academic_year: scheduleData[0].academicYear,
                userId: scheduleData[0].userId,
                timeSlots: scheduleData.map((item) => ({
                    id: item.timeSlotId,
                    startTime: item.startTime,
                    endTime: item.endTime,
                })),
            };

            return NextResponse.json(schedule);
        }
    } catch (error: unknown) {
        console.error("Error fetching schedules:", error);
        return NextResponse.json(
            { error: "Failed to fetch schedules" },
            { status: 500 }
        );
    }
}

// POST new schedule
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validatedData = createScheduleSchema.parse(body);
        const {
            name,
            startDate,
            endDate,
            numberOfTimeSlots,
            timeSlots,
            userId,
        } = validatedData;

        // Generate academic year string
        const academicYear = generateAcademicYear(startDate, endDate);

        return await db.transaction(async (tx) => {
            const newSchedule = await tx.insert(schedules).values({
                name,
                academicYear,
                userId,
                numberOfTimeSlots,
            });

            const schedule = await tx
                .select({
                    id: schedules.id,
                })
                .from(schedules)
                .where(eq(schedules.name, name));

            for (const timeSlot of timeSlots) {
                await db.insert(scheduleTimeSlots).values({
                    startTime: timeSlot.startTime,
                    endTime: timeSlot.endTime,
                    scheduleId: schedule[0].id,
                });
            }
            return NextResponse.json(newSchedule);
        });
    } catch (error: unknown) {
        console.error("Error creating schedule:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to create schedule" },
            { status: 500 }
        );
    }
}

// PUT/PATCH update schedule
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const validatedData = editScheduleSchema.parse(body);
        const { id, name, startDate, endDate, userId, timeSlots } =
            validatedData;

        // Generate academic year string
        const academicYear = generateAcademicYear(startDate, endDate);

        return await db.transaction(async (tx) => {
            // Update schedule details
            await tx
                .update(schedules)
                .set({
                    name,
                    academicYear,
                    userId,
                })
                .where(eq(schedules.id, id));

            // If timeSlots are provided, update them too
            if (timeSlots && timeSlots.length > 0) {
                // First delete existing time slots for this schedule
                await tx
                    .delete(scheduleTimeSlots)
                    .where(eq(scheduleTimeSlots.scheduleId, id));

                // Then insert the new time slots
                for (const timeSlot of timeSlots) {
                    await tx.insert(scheduleTimeSlots).values({
                        startTime: timeSlot.startTime,
                        endTime: timeSlot.endTime,
                        scheduleId: id,
                    });
                }
            }

            return NextResponse.json({
                message: "Schedule updated successfully",
                id,
            });
        });
    } catch (error: unknown) {
        console.error("Error updating schedule:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to update schedule" },
            { status: 500 }
        );
    }
}

// DELETE schedule
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const validatedData = deleteScheduleSchema.parse(body);
        const { id } = validatedData;

        await db.transaction(async (tx) => {
            // First, get all courses for this schedule to cascade further
            const scheduleCourses = await tx
                .select({ id: courses.id })
                .from(courses)
                .where(eq(courses.scheduleId, id));

            const courseIds = scheduleCourses.map((course) => course.id);

            if (courseIds.length > 0) {
                // Get all sections for these courses
                const courseSections = await tx
                    .select({ id: sections.id })
                    .from(sections)
                    .where(inArray(sections.courseId, courseIds));

                const sectionIds = courseSections.map((section) => section.id);

                if (sectionIds.length > 0) {
                    // Delete course_hours for all sections
                    await tx
                        .delete(courseHours)
                        .where(inArray(courseHours.sectionId, sectionIds));
                }

                // Delete all sections for these courses
                await tx
                    .delete(sections)
                    .where(inArray(sections.courseId, courseIds));

                // Delete all courses for this schedule
                await tx.delete(courses).where(eq(courses.scheduleId, id));
            }

            // Delete instructor time constraints and related data
            const instructorConstraints = await tx
                .select({ id: instructorTimeConstraint.id })
                .from(instructorTimeConstraint)
                .where(eq(instructorTimeConstraint.scheduleId, id));

            const constraintIds = instructorConstraints.map(
                (constraint) => constraint.id
            );

            if (constraintIds.length > 0) {
                // Get all constraint days
                const constraintDays = await tx
                    .select({ id: instructorTimeConstraintDay.id })
                    .from(instructorTimeConstraintDay)
                    .where(
                        inArray(
                            instructorTimeConstraintDay.instructorTimeConstraintId,
                            constraintIds
                        )
                    );

                const dayIds = constraintDays.map((day) => day.id);

                if (dayIds.length > 0) {
                    // Delete time slots for constraint days
                    await tx
                        .delete(instructorTimeConstraintTimeSlot)
                        .where(
                            inArray(
                                instructorTimeConstraintTimeSlot.instructorTimeConstraintDayId,
                                dayIds
                            )
                        );
                }

                // Delete constraint days
                await tx
                    .delete(instructorTimeConstraintDay)
                    .where(
                        inArray(
                            instructorTimeConstraintDay.instructorTimeConstraintId,
                            constraintIds
                        )
                    );

                // Delete instructor time constraints
                await tx
                    .delete(instructorTimeConstraint)
                    .where(eq(instructorTimeConstraint.scheduleId, id));
            }

            // Delete instructors for this schedule
            await tx.delete(instructors).where(eq(instructors.scheduleId, id));

            // Delete classroom types for this schedule
            await tx
                .delete(classroomTypes)
                .where(eq(classroomTypes.scheduleId, id));

            // Delete majors for this schedule
            await tx.delete(majors).where(eq(majors.scheduleId, id));

            // Delete schedule time slots
            await tx
                .delete(scheduleTimeSlots)
                .where(eq(scheduleTimeSlots.scheduleId, id));

            // Finally, delete the schedule itself
            await tx.delete(schedules).where(eq(schedules.id, id));
        });

        return NextResponse.json({
            message: "Schedule deleted successfully",
        });
    } catch (error: unknown) {
        console.error("Error deleting schedule:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to delete schedule" },
            { status: 500 }
        );
    }
}
