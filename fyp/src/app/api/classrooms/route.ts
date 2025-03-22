import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classrooms } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// GET all classrooms
export async function GET() {
    try {
        const allClassrooms = await db.select().from(classrooms);
        return NextResponse.json(allClassrooms);
    } catch (error: unknown) {
        console.error("Error fetching classrooms:", error);
        return NextResponse.json(
            { error: "Failed to fetch classrooms" },
            { status: 500 }
        );
    }
}

// POST new classroom
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, type, capacity } = body;

        const newClassroom = await db.insert(classrooms).values({
            name,
            type,
            capacity,
        });

        return NextResponse.json(newClassroom);
    } catch (error: unknown) {
        console.error("Error creating classroom:", error);
        return NextResponse.json(
            { error: "Failed to create classroom" },
            { status: 500 }
        );
    }
}

// PUT update classroom
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, type, capacity } = body;

        const updatedClassroom = await db
            .update(classrooms)
            .set({ name, type, capacity })
            .where(eq(classrooms.id, id));

        return NextResponse.json(updatedClassroom);
    } catch (error: unknown) {
        console.error("Error updating classroom:", error);
        return NextResponse.json(
            { error: "Failed to update classroom" },
            { status: 500 }
        );
    }
}

// DELETE classroom
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

        await db.delete(classrooms).where(eq(classrooms.id, parseInt(id)));

        return NextResponse.json({ message: "Classroom deleted successfully" });
    } catch (error: unknown) {
        console.error("Error deleting classroom:", error);
        return NextResponse.json(
            { error: "Failed to delete classroom" },
            { status: 500 }
        );
    }
}
