import { classrooms, classroomTypes, courseHours } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// Updated validation schemas to include all fields
const createClassroomSchema = z.object({
    code: z.string().min(1, "Classroom code is required"),
    name: z.string().min(1, "Classroom name is required"),
    location: z.string().optional().nullable(),
    type: z.string().min(1, "Classroom type is required"),
    capacity: z.number().min(0, "Capacity must be greater than or equal to 0"),
    scheduleId: z.string().min(1, "Schedule ID is required"),
});

const editClassroomSchema = z.object({
    id: z.number(),
    code: z.string().min(1, "Classroom code is required"),
    name: z.string().min(1, "Classroom name is required"),
    location: z.string().optional().nullable(),
    type: z.string().min(1, "Classroom type is required"),
    capacity: z.number().min(0, "Capacity must be greater than or equal to 0"),
    scheduleId: z.string().min(1, "Schedule ID is required"),
});

const deleteClassroomSchema = z.object({
    id: z.number(),
    scheduleId: z.string().min(1, "Schedule ID is required"),
});

// GET all classrooms
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

        const classroomTypesQuery = await db
            .select({
                id: classrooms.id,
                code: classrooms.code,
                name: classrooms.name,
                location: classrooms.location,
                typeName: classroomTypes.name,
                capacity: classrooms.capacity,
            })
            .from(classrooms)
            .innerJoin(
                classroomTypes,
                eq(classrooms.classroomTypeId, classroomTypes.id)
            )
            .where(eq(classroomTypes.scheduleId, parseInt(scheduleId)));

        // Format the response to include type name
        const formattedClassrooms = classroomTypesQuery.map((classroom) => ({
            id: classroom.id,
            name: classroom.name,
            location: classroom.location,
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

        // Validate request body and extract scheduleId
        const validatedData = createClassroomSchema.parse(body);
        const { name, location, code, type, capacity, scheduleId } =
            validatedData;

        // Find classroom type in the specific schedule
        const classroomType = await db.query.classroomTypes.findFirst({
            where: and(
                eq(classroomTypes.name, type),
                eq(classroomTypes.scheduleId, parseInt(scheduleId))
            ),
        });

        if (!classroomType) {
            return NextResponse.json(
                { error: "Classroom type not found in this schedule" },
                { status: 404 }
            );
        }

        // Create classroom with the correct classroomTypeId
        const newClassroom = await db.insert(classrooms).values({
            name,
            code,
            classroomTypeId: classroomType.id,
            location,
            capacity,
        });

        console.log("New classroom created:", newClassroom);

        return NextResponse.json(newClassroom);
    } catch (error: unknown) {
        console.error("Error creating classroom:", error);

        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.errors },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: "Failed to create classroom" },
            { status: 500 }
        );
    }
}

// PATCH update classroom
export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        // Validate request body and extract scheduleId
        const validatedData = editClassroomSchema.parse(body);
        const { id, code, name, location, type, capacity, scheduleId } =
            validatedData;

        // Security check: Verify the classroom belongs to the specified schedule
        const existingClassroom = await db
            .select()
            .from(classrooms)
            .innerJoin(
                classroomTypes,
                eq(classrooms.classroomTypeId, classroomTypes.id)
            )
            .where(
                and(
                    eq(classrooms.id, id),
                    eq(classroomTypes.scheduleId, parseInt(scheduleId))
                )
            );

        if (existingClassroom.length === 0) {
            return NextResponse.json(
                { error: "Classroom not found in this schedule" },
                { status: 404 }
            );
        }

        // Find classroom type in the specific schedule
        const classroomType = await db.query.classroomTypes.findFirst({
            where: and(
                eq(classroomTypes.name, type),
                eq(classroomTypes.scheduleId, parseInt(scheduleId))
            ),
        });

        if (!classroomType) {
            return NextResponse.json(
                { error: "Classroom type not found in this schedule" },
                { status: 404 }
            );
        }

        // Update classroom with all fields
        const updatedClassroom = await db
            .update(classrooms)
            .set({
                code,
                name,
                location,
                classroomTypeId: classroomType.id,
                capacity,
            })
            .where(eq(classrooms.id, id));

        return NextResponse.json(updatedClassroom);
    } catch (error: unknown) {
        console.error("Error updating classroom:", error);

        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.errors },
                { status: 400 }
            );
        }

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

        // Validate request body
        const validatedData = deleteClassroomSchema.safeParse(body);
        if (!validatedData.success) {
            return NextResponse.json(
                { error: "Invalid data", details: validatedData.error.errors },
                { status: 400 }
            );
        }

        const { id, scheduleId } = validatedData.data;

        // Security check: Verify the classroom belongs to the specified schedule
        const classroomExists = await db
            .select()
            .from(classrooms)
            .innerJoin(
                classroomTypes,
                eq(classrooms.classroomTypeId, classroomTypes.id)
            )
            .where(
                and(
                    eq(classrooms.id, id),
                    eq(classroomTypes.scheduleId, parseInt(scheduleId))
                )
            );

        if (classroomExists.length === 0) {
            return NextResponse.json(
                { error: "Classroom not found in this schedule" },
                { status: 404 }
            );
        }

        // Check if classroom is being used in course_hours
        const courseHoursUsage = await db
            .select()
            .from(courseHours)
            .where(eq(courseHours.classroomId, id));

        if (courseHoursUsage.length > 0) {
            // Option: Force delete by removing course_hours references first
            await db.delete(courseHours).where(eq(courseHours.classroomId, id));
            console.log(
                `Deleted ${courseHoursUsage.length} course_hours records for classroom ${id}`
            );
        }

        await db.delete(classrooms).where(eq(classrooms.id, id));
        return NextResponse.json({ message: "Classroom deleted successfully" });
    } catch (error: unknown) {
        console.error("Error deleting classroom:", error);

        // Handle foreign key constraint error
        if (
            error instanceof Error &&
            error.message.includes("foreign key constraint fails")
        ) {
            return NextResponse.json(
                {
                    error: "Cannot delete classroom because it's being used in course schedules",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: "Failed to delete classroom" },
            { status: 500 }
        );
    }
}
