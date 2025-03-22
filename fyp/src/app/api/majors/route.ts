import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { majors } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// GET all majors
export async function GET() {
    try {
        const allMajors = await db.select().from(majors);
        return NextResponse.json(allMajors);
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
        const { name, shortTag } = body;

        const newMajor = await db.insert(majors).values({
            name,
            shortTag,
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
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, shortTag } = body;

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
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "ID is required" },
                { status: 400 }
            );
        }

        await db.delete(majors).where(eq(majors.id, parseInt(id)));

        return NextResponse.json({ message: "Major deleted successfully" });
    } catch (error: unknown) {
        console.error("Error deleting major:", error);
        return NextResponse.json(
            { error: "Failed to delete major" },
            { status: 500 }
        );
    }
}
