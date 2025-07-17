import { NextResponse } from "next/server";
import { schedules } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/drizzle/db";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");
        const userId = searchParams.get("userId");

        if (!scheduleId || !userId) {
            return NextResponse.json({ owner: false });
        }

        const exist = await db
            .select()
            .from(schedules)
            .where(
                and(
                    eq(schedules.id, parseInt(scheduleId)),
                    eq(schedules.userId, userId)
                )
            )
            .limit(1);

        const isOwner = exist.length > 0;

        return NextResponse.json({ owner: isOwner });
    } catch (error) {
        console.error("Error fetching schedules:", error);
        return NextResponse.json(
            { error: "Failed to fetch schedules" },
            { status: 500 }
        );
    }
}
