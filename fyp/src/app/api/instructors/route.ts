import { instructors } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET all instructors
export async function GET() {
    try {
        const allInstructors = await db.select().from(instructors);

        // Transform the data to match UI expectations
        const formattedInstructors = allInstructors.map((instructor) => ({
            id: instructor.id,
            first_name: instructor.firstName,
            last_name: instructor.lastName,
            gender: instructor.gender,
            email: instructor.email,
            phone_number: instructor.phoneNumber,
        }));

        return NextResponse.json(formattedInstructors);
    } catch (error: unknown) {
        console.error("Error fetching instructors:", error);
        return NextResponse.json(
            { error: "Failed to fetch instructors" },
            { status: 500 }
        );
    }
}

// POST new instructor
export const POST = createInstructor;

export async function createInstructor(request: Request) {
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

// DELETE instructor
export async function DeleteInstructor(request: Request) {
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
