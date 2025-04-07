import { classroomTypes, schedules } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export const createClassroomTypeSchema = z.object({
    // ID: Optional for creation (auto-incremented by DB)
    id: z.number().int().positive().optional(),
    // Name: Required, string, max 100 chars
    name: z
        .string()
        .min(1, { message: "Classroom type name is required" })
        .max(100, {
            message: "Classroom type name cannot exceed 100 characters",
        }),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
    }),
});

export const editClassroomTypeSchema = z.object({
    // ID: Required for updates
    id: z.number({
        required_error: "ID is required",
    }),
    // Name: Required, string, max 100 chars
    name: z
        .string()
        .min(1, { message: "Classroom type name is required" })
        .max(100, {
            message: "Classroom type name cannot exceed 100 characters",
        }),
});

export const deleteClassroomTypeSchema = z.object({
    // ID: Required for deletion
    id: z.number({
        required_error: "ID is required",
    }),
});

// GET all classroom types
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");

        let classroomTypeQuery;
        if (scheduleId) {
            classroomTypeQuery = await db
                .select({
                    id: classroomTypes.id,
                    name: classroomTypes.name,
                })
                .from(classroomTypes)
                .innerJoin(
                    schedules,
                    eq(classroomTypes.scheduleId, schedules.id)
                )
                .where(eq(classroomTypes.scheduleId, parseInt(scheduleId)));
        }
        return NextResponse.json(classroomTypeQuery);
    } catch (error: unknown) {
        console.error("Error fetching classroom types:", error);
        return NextResponse.json(
            { error: "Failed to fetch classroom types" },
            { status: 500 }
        );
    }
}

// POST new classroom type
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validatedData = createClassroomTypeSchema.parse(body);
        const { name, scheduleId } = validatedData;
        const newClassroomType = await db.insert(classroomTypes).values({
            name,
            scheduleId,
        });
        return NextResponse.json(newClassroomType);
    } catch (error: unknown) {
        console.error("Error creating classroom type:", error);
        return NextResponse.json(
            { error: "Failed to create classroom type" },
            { status: 500 }
        );
    }
}

// PUT update classroom type
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const validatedData = editClassroomTypeSchema.parse(body);
        const { id, name } = validatedData;
        const updatedClassroomType = await db
            .update(classroomTypes)
            .set({
                name,
            })
            .where(eq(classroomTypes.id, id));
        return NextResponse.json(updatedClassroomType);
    } catch (error: unknown) {
        console.error("Error updating classroom type:", error);
        return NextResponse.json(
            { error: "Failed to update classroom type" },
            { status: 500 }
        );
    }
}

// DELETE classroom type
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const validatedData = deleteClassroomTypeSchema.parse(body);
        const { id } = validatedData;
        await db.delete(classroomTypes).where(eq(classroomTypes.id, id));
        return NextResponse.json({
            message: "Classroom type deleted successfully",
        });
    } catch (error: unknown) {
        console.error("Error deleting classroom type:", error);
        return NextResponse.json(
            { error: "Failed to delete classroom type" },
            { status: 500 }
        );
    }
}
