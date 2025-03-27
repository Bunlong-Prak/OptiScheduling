import { classrooms } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// Define the classroom schema using Zod
export const createClassroomSchema = z.object({
    // Name: Required, string, max 255 chars
    code: z
        .string()
        .min(1, { message: "Classroom name is required" })
        .max(255, { message: "Classroom name cannot exceed 255 characters" }),

    // Capacity: Required, positive integer
    capacity: z
        .number()
        .int({ message: "Capacity must be a whole number" })
        .positive({ message: "Capacity must be a positive number" }),
});

export const editClassroomSchema = z.object({
    // ID: Optional for creation (auto-incremented by DB), required for updates
    id: z.number({
        required_error: "ID is required",
    }),

    // Name: Required, string, max 255 chars
    code: z
        .string()
        .min(1, { message: "Classroom name is required" })
        .max(255, { message: "Classroom name cannot exceed 255 characters" }),

    // Capacity: Required, positive integer
    capacity: z
        .number()
        .int({ message: "Capacity must be a whole number" })
        .positive({ message: "Capacity must be a positive number" }),
});

export const deleteClassroomSchema = z.object({
    // ID: Optional for creation (auto-incremented by DB), required for updates
    id: z.number({
        required_error: "ID is required",
    }),
});
// GET all classrooms
export async function GET() {
    try {
        const allClassrooms = await db.select().from(classrooms);

        const formattedClassrooms = allClassrooms.map((classroom) => ({
            id: classroom.id,
            code: classroom.code,
            capacity: classroom.capacity,
        }));
        return NextResponse.json(formattedClassrooms);
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
        const validatedData = createClassroomSchema.parse(body);
        const { code, capacity, classroomTypeId } = validatedData;

        const newClassroom = await db.insert(classrooms).values({
            code,
            capacity,
            classroomTypeId,
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
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const validatedData = editClassroomSchema.parse(body);
        const { id, code, type, capacity } = validatedData;

        const updatedClassroom = await db
            .update(classrooms)
            .set({ code, type, capacity })
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
        const body = await request.json();
        const validatedData = deleteClassroomSchema.parse(body);
        const { id } = validatedData;

        if (!id) {
            return NextResponse.json(
                { error: "ID is required" },
                { status: 400 }
            );
        }

        await db.delete(classrooms).where(eq(classrooms.id, id));
        return NextResponse.json({ message: "Classroom deleted successfully" });
    } catch (error: unknown) {
        console.error("Error deleting classroom:", error);
        return NextResponse.json(
            { error: "Failed to delete classroom" },
            { status: 500 }
        );
    }
}
