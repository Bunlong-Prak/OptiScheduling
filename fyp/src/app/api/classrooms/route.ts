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

    // Type: Required, string, max 50 chars
    type: z
        .string()
        .min(1, { message: "Classroom type is required" })
        .max(50, { message: "Classroom type cannot exceed 50 characters" }),

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

    // Type: Required, string, max 50 chars
    type: z
        .string()
        .min(1, { message: "Classroom type is required" })
        .max(50, { message: "Classroom type cannot exceed 50 characters" }),

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
import { classroomTypes } from "@/drizzle/schema";

export async function GET() {
    try {
        // Join classrooms with classroomTypes to get the type name
        const classroomsWithTypes = await db
            .select({
                id: classrooms.id,
                code: classrooms.code,
                classroomTypeId: classrooms.classroomTypeId,
                typeName: classroomTypes.name,
                capacity: classrooms.capacity,
            })
            .from(classrooms)
            .leftJoin(
                classroomTypes,
                eq(classrooms.classroomTypeId, classroomTypes.id)
            );

        // Format the response to include type name
        const formattedClassrooms = classroomsWithTypes.map((classroom) => ({
            id: classroom.id,
            code: classroom.code,
            type: classroom.typeName || "Unknown Type",
            capacity: classroom.capacity,
        }));

        return NextResponse.json(formattedClassrooms);
    } catch (error) {
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
        const { code, type, capacity } = validatedData;

        const classroomType = await db.query.classroomTypes.findFirst({
            where: eq(classroomTypes.name, type),
        });
        if (!classroomType) {
            return NextResponse.json(
                { error: "Classroom type not found" },
                { status: 404 }
            );
        }

        const newClassroom = await db.insert(classrooms).values({
            code,
            classroomTypeId: classroomType?.id,
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
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const validatedData = editClassroomSchema.parse(body);
        const { id, code, type, capacity } = validatedData;

        const classroomType = await db.query.classroomTypes.findFirst({
            where: eq(classroomTypes.name, type),
        });
        if (!classroomType) {
            return NextResponse.json(
                { error: "Classroom type not found" },
                { status: 404 }
            );
        }

        const updatedClassroom = await db
            .update(classrooms)
            .set({
                code,
                classroomTypeId: classroomType?.id,
                capacity,
            })
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
        const validatedData = deleteClassroomSchema.safeParse(body);
        if (!validatedData.success) {
            return NextResponse.json(
                { error: "Invalid data" },
                { status: 400 }
            );
        }

        const { id } = validatedData.data;

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
