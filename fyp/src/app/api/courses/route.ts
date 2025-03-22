import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courses } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

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
            degree,
            gradeType,
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
            degree,
            gradeType,
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
                degree,
                gradeType,
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
