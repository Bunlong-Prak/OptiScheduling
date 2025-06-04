import { scheduleTimeSlots } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");

        if (!scheduleId) {
            return NextResponse.json(
                {
                    error: "scheduleId is required",
                },
                { status: 400 }
            );
        }

        // Fetch time slots for the specific schedule
        const timeSlots = await db
            .select({
                id: scheduleTimeSlots.id,
                startTime: scheduleTimeSlots.startTime,
                endTime: scheduleTimeSlots.endTime,
                scheduleId: scheduleTimeSlots.scheduleId,
            })
            .from(scheduleTimeSlots)
            .where(eq(scheduleTimeSlots.scheduleId, parseInt(scheduleId)));

        if (timeSlots.length === 0) {
            return NextResponse.json(
                { error: "No time slots found for this schedule" },
                { status: 404 }
            );
        }

        // Format response to match frontend expectations
        const scheduleWithTimeSlots = [
            {
                id: parseInt(scheduleId),
                timeSlots: timeSlots,
            },
        ];

        return NextResponse.json(scheduleWithTimeSlots);
    } catch (error: unknown) {
        console.error("Error fetching time slots:", error);
        return NextResponse.json(
            { error: "Failed to fetch time slots" },
            { status: 500 }
        );
    }
}
