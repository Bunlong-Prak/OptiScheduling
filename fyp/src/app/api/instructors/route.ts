import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { instructors } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// GET all instructors
export async function GET() {
    try {
        const allInstructors = await db.select().from(instructors);
        return NextResponse.json(allInstructors);
    } catch (error: unknown) {
        console.error("Error fetching instructors:", error);
        return NextResponse.json(
            { error: "Failed to fetch instructors" },
            { status: 500 }
        );
    }
}

// POST new instructor
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lastName, firstName, gender, email, phoneNumber } = body;

        const newInstructor = await db.insert(instructors).values({
            lastName,
            firstName,
            gender,
            email,
            phoneNumber,
        });

        return NextResponse.json(newInstructor);
    } catch (error: unknown) {
        console.error("Error creating instructor:", error);
        return NextResponse.json(
            { error: "Failed to create instructor" },
            { status: 500 }
        );
    }
}

// PUT update instructor
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, lastName, firstName, gender, email, phoneNumber } = body;

        const updatedInstructor = await db
            .update(instructors)
            .set({
                lastName,
                firstName,
                gender,
                email,
                phoneNumber,
            })
            .where(eq(instructors.id, id));

        return NextResponse.json(updatedInstructor);
    } catch (error: unknown) {
        console.error("Error updating instructor:", error);
        return NextResponse.json(
            { error: "Failed to update instructor" },
            { status: 500 }
        );
    }
}

// DELETE instructor
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

        await db.delete(instructors).where(eq(instructors.id, parseInt(id)));

        return NextResponse.json({
            message: "Instructor deleted successfully",
        });
    } catch (error: unknown) {
        console.error("Error deleting instructor:", error);
        return NextResponse.json(
            { error: "Failed to delete instructor" },
            { status: 500 }
        );
    }
}
