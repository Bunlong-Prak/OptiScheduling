import { schedules } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { generateAcademicYear } from "@/lib/utils";
import {
    createScheduleSchema,
    editScheduleSchema,
    deleteScheduleSchema,
} from "@/lib/validations/schedules";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// GET all schedules
export async function GET() {
    try {
        const allSchedules = await db.select().from(schedules);
        const formattedSchedules = allSchedules.map((schedule) => ({
            id: schedule.id,
            name: schedule.name,
            academic_year: schedule.academicYear,
        }));
        return NextResponse.json(formattedSchedules);
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
        const { name, startDate, endDate, userId } = validatedData;

        // Generate academic year string
        const academicYear = generateAcademicYear(startDate, endDate);

        const newSchedule = await db.insert(schedules).values({
            name,
            academicYear,
            userId,
        });

        return NextResponse.json(newSchedule);
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
