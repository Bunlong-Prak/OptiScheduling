import { courses } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const courseSchema = z.object({
    // Course Code: Required, alphanumeric with possible spaces/dashes, min 2 chars, max 10 chars
    courseCode: z
        .string()
        .min(2, { message: "Course code must be at least 2 characters" })
        .max(10, { message: "Course code cannot exceed 10 characters" })
        .regex(/^[A-Z0-9\s-]+$/i, {
            message:
                "Course code can only contain letters, numbers, spaces, and hyphens",
        }),

    // Course Name: Required, string, min 3 chars, max 100 chars
    courseName: z
        .string()
        .min(3, { message: "Course name must be at least 3 characters" })
        .max(100, { message: "Course name cannot exceed 100 characters" }),

    // Course Type: Required, string, min 2 chars
    courseType: z
        .string()
        .min(2, { message: "Course type must be at least 2 characters" }),

    // Section: Required
    section: z.string().min(1, { message: "Section is required" }),

    // Major: Required
    major: z.string().min(1, { message: "Major is required" }),

    // Instructor: Required
    instructor: z.string().min(1, { message: "Instructor is required" }),

    // Classroom: Required
    classroom: z.string().min(1, { message: "Classroom is required" }),

    // Color: Required
    color: z.string().min(1, { message: "Color is required" }),
});

// GET all courses
export async function GET() {
    try {
        const allCourses = await db.select().from(courses);
        return NextResponse.json(allCourses);
    } catch (error: unknown) {
        console.error("Error fetching courses:", error);
        return NextResponse.json(
            { error: "Failed to fetch courses" },
            { status: 500 }
        );
    }
}

// POST new course
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            title,
            type,
            code,
            color,
            capacity,
            description,
            scheduleId,
            majorId,
            instructorId,
        } = body;

        const newCourse = await db.insert(courses).values({
            title,
            type,
            code,
            color,
            capacity,
            description,
            scheduleId,
            majorId,
            instructorId,
        });

        return NextResponse.json(newCourse);
    } catch (error: unknown) {
        console.error("Error creating course:", error);
        return NextResponse.json(
            { error: "Failed to create course" },
            { status: 500 }
        );
    }
}

// PUT update course
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const {
            id,
            title,
            type,
            code,
            degree,
            gradeType,
            color,
            capacity,
            description,
            scheduleId,
            majorId,
            instructorId,
        } = body;

        const updatedCourse = await db
            .update(courses)
            .set({
                title,
                type,
                code,
                color,
                capacity,
                description,
                scheduleId,
                majorId,
                instructorId,
            })
            .where(eq(courses.id, id));

        return NextResponse.json(updatedCourse);
    } catch (error: unknown) {
        console.error("Error updating course:", error);
        return NextResponse.json(
            { error: "Failed to update course" },
            { status: 500 }
        );
    }
}

// DELETE course
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

        await db.delete(courses).where(eq(courses.id, parseInt(id)));

        return NextResponse.json({ message: "Course deleted successfully" });
    } catch (error: unknown) {
        console.error("Error deleting course:", error);
        return NextResponse.json(
            { error: "Failed to delete course" },
            { status: 500 }
        );
    }
}
