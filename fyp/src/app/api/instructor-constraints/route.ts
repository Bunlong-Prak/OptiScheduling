import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
    instructorUnavailableDays,
    instructorUnavailableTimePeriods,
} from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// GET all instructor constraints
export async function GET() {
    try {
        const unavailableDays = await db
            .select()
            .from(instructorUnavailableDays);
        const unavailableTimePeriods = await db
            .select()
            .from(instructorUnavailableTimePeriods);

        return NextResponse.json({
            unavailableDays,
            unavailableTimePeriods,
        });
    } catch (error: unknown) {
        console.error("Error fetching instructor constraints:", error);
        return NextResponse.json(
            { error: "Failed to fetch instructor constraints" },
            { status: 500 }
        );
    }
}

// POST new instructor constraint
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { daysOfWeek, instructorId, timePeriods } = body;

        // First create the unavailable day
        const newUnavailableDay = await db
            .insert(instructorUnavailableDays)
            .values({
                daysOfWeek,
                instructorId,
            });

        // Then create the time periods for this day
        if (timePeriods && timePeriods.length > 0) {
            const timePeriodValues = timePeriods.map((period: string) => ({
                timePeriod: period,
                instructorUnavailableDayId: newUnavailableDay.insertId,
                instructorId,
            }));

            await db
                .insert(instructorUnavailableTimePeriods)
                .values(timePeriodValues);
        }

        return NextResponse.json(newUnavailableDay);
    } catch (error: unknown) {
        console.error("Error creating instructor constraint:", error);
        return NextResponse.json(
            { error: "Failed to create instructor constraint" },
            { status: 500 }
        );
    }
}

// PUT update instructor constraint
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, daysOfWeek, instructorId, timePeriods } = body;

        // Update the unavailable day
        const updatedUnavailableDay = await db
            .update(instructorUnavailableDays)
            .set({
                daysOfWeek,
                instructorId,
            })
            .where(eq(instructorUnavailableDays.id, id));

        // Delete existing time periods
        await db
            .delete(instructorUnavailableTimePeriods)
            .where(
                eq(
                    instructorUnavailableTimePeriods.instructorUnavailableDayId,
                    id
                )
            );

        // Create new time periods
        if (timePeriods && timePeriods.length > 0) {
            const timePeriodValues = timePeriods.map((period: string) => ({
                timePeriod: period,
                instructorUnavailableDayId: id,
                instructorId,
            }));

            await db
                .insert(instructorUnavailableTimePeriods)
                .values(timePeriodValues);
        }

        return NextResponse.json(updatedUnavailableDay);
    } catch (error: unknown) {
        console.error("Error updating instructor constraint:", error);
        return NextResponse.json(
            { error: "Failed to update instructor constraint" },
            { status: 500 }
        );
    }
}

// DELETE instructor constraint
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "ID is required" },
                { status: 400 }
            );
        }

        // Delete time periods first (due to foreign key constraint)
        await db
            .delete(instructorUnavailableTimePeriods)
            .where(
                eq(
                    instructorUnavailableTimePeriods.instructorUnavailableDayId,
                    parseInt(id)
                )
            );

        // Then delete the unavailable day
        await db
            .delete(instructorUnavailableDays)
            .where(eq(instructorUnavailableDays.id, parseInt(id)));

        return NextResponse.json({
            message: "Instructor constraint deleted successfully",
        });
    } catch (error: unknown) {
        console.error("Error deleting instructor constraint:", error);
        return NextResponse.json(
            { error: "Failed to delete instructor constraint" },
            { status: 500 }
        );
    }
}
