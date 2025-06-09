import { classroomTypes, schedules } from "@/drizzle/schema";
import { db } from "@/lib/db";
import {
    createClassroomTypeSchema,
    editClassroomTypeSchema,
    deleteClassroomTypeSchema,
} from "@/lib/validations/classroom_type";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET all classroom types
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");

        if (!scheduleId) {
            return NextResponse.json(
                { error: "Schedule ID is required" },
                { status: 400 }
            );
        }

        const classroomTypeQuery = await db
            .select({
                id: classroomTypes.id,
                name: classroomTypes.name,
                description: classroomTypes.description,
            })
            .from(classroomTypes)
            .where(eq(classroomTypes.scheduleId, parseInt(scheduleId)));

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

        const newClassroomType = await db.insert(classroomTypes).values({
            name: validatedData.name,
            description: validatedData.description || null,
            scheduleId: validatedData.scheduleId,
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

// PATCH update classroom type
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const validatedData = editClassroomTypeSchema.parse(body);

        const updatedClassroomType = await db
            .update(classroomTypes)
            .set({
                name: validatedData.name,
                description: validatedData.description || null,
            })
            .where(eq(classroomTypes.id, validatedData.id));

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
