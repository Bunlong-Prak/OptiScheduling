import { schedules, scheduleTimeSlots } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { generateAcademicYear } from "@/lib/utils";
import {
    createScheduleSchema,
    deleteScheduleSchema,
    editScheduleSchema,
} from "@/lib/validations/schedules";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// GET all schedules
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");
        if (!scheduleId) {
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
        } else {
            const allScheduleData = await db
                .select({
                    id: scheduleTimeSlots.id,
                    startTime: scheduleTimeSlots.startTime,
                    endTime: scheduleTimeSlots.endTime,
                })
                .from(scheduleTimeSlots)
                .where(eq(scheduleTimeSlots.scheduleId, parseInt(scheduleId)));

            return NextResponse.json(allScheduleData);
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
        const { id, name, startDate, endDate, userId } = validatedData;

        // Generate academic year string
        const academicYear = generateAcademicYear(startDate, endDate);

        const updatedSchedule = await db
            .update(schedules)
            .set({
                name,
                academicYear,
                userId,
            })
            .where(eq(schedules.id, id));

        return NextResponse.json(updatedSchedule);
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

        await db.delete(schedules).where(eq(schedules.id, id));

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
