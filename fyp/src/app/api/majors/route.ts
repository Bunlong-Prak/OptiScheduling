import { majors } from "@/drizzle/schema";
import { db } from "@/lib/db";
import {
    createMajorSchema,
    editMajorSchema,
    deleteMajorSchema,
} from "@/lib/validations/majors";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET all majors
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");
        let majorsQuery;
        if (scheduleId) {
            majorsQuery = await db
                .select({
                    id: majors.id,
                    name: majors.name,
                    shortTag: majors.shortTag,
                })
                .from(majors)
                .where(eq(majors.scheduleId, parseInt(scheduleId)));
        }

        const formattedMajors = majorsQuery?.map((major) => ({
            id: major.id,
            name: major.name,
            short_tag: major.shortTag,
        }));
        return NextResponse.json(formattedMajors);
    } catch (error: unknown) {
        console.error("Error fetching majors:", error);
        return NextResponse.json(
            { error: "Failed to fetch majors" },
            { status: 500 }
        );
    }
}

// POST new major
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validatedData = createMajorSchema.parse(body);
        const { name, shortTag, scheduleId } = validatedData;

        const newMajor = await db.insert(majors).values({
            name,
            shortTag,
            scheduleId,
        });

        return NextResponse.json(newMajor);
    } catch (error: unknown) {
        console.error("Error creating major:", error);
        return NextResponse.json(
            { error: "Failed to create major" },
            { status: 500 }
        );
    }
}

// PUT update major
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const validatedData = editMajorSchema.parse(body);
        const { id, name, shortTag } = validatedData;

        const updatedMajor = await db
            .update(majors)
            .set({
                name,
                shortTag,
            })
            .where(eq(majors.id, id));

        return NextResponse.json(updatedMajor);
    } catch (error: unknown) {
        console.error("Error updating major:", error);
        return NextResponse.json(
            { error: "Failed to update major" },
            { status: 500 }
        );
    }
}

// DELETE major
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const validatedData = deleteMajorSchema.parse(body);
        const { id } = validatedData;

        await db.delete(majors).where(eq(majors.id, id));

        return NextResponse.json({ message: "Major deleted successfully" });
    } catch (error: unknown) {
        console.error("Error deleting major:", error);
        return NextResponse.json(
            { error: "Failed to delete major" },
            { status: 500 }
        );
    }
}
