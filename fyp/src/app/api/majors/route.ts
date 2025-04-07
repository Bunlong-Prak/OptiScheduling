import { majors } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export const createMajorSchema = z.object({
    // ID: Optional for creation (auto-incremented by DB)
    id: z.number().int().positive().optional(),

    // Name: Required, string, max 100 chars
    name: z
        .string()
        .min(1, { message: "Major name is required" })
        .max(100, { message: "Major name cannot exceed 100 characters" }),

    // Short Tag: Required, string, max 10 chars
    shortTag: z
        .string()
        .min(1, { message: "Short tag is required" })
        .max(10, { message: "Short tag cannot exceed 10 characters" }),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
    }),
});

export const editMajorSchema = z.object({
    // ID: Required for updates
    id: z.number({
        required_error: "ID is required",
    }),

    // Name: Required, string, max 100 chars
    name: z
        .string()
        .min(1, { message: "Major name is required" })
        .max(100, { message: "Major name cannot exceed 100 characters" }),

    // Short Tag: Required, string, max 10 chars
    shortTag: z
        .string()
        .min(1, { message: "Short tag is required" })
        .max(10, { message: "Short tag cannot exceed 10 characters" }),
});

export const deleteMajorSchema = z.object({
    // ID: Required for deletion
    id: z.number({
        required_error: "ID is required",
    }),
});
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
