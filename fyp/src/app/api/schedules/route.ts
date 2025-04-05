import { schedules } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

function formatDate(date: Date): string {
    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];

    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    return `${month} ${day}, ${year}`;
}

// Function to generate academic year as "Jan 5, 2025 - May 15, 2026" format
function generateAcademicYear(startDate: Date, endDate: Date): string {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

export const createScheduleSchema = z
    .object({
        id: z.number().int().positive().optional(),

        name: z
            .string()
            .min(1, { message: "Schedule name is required" })
            .max(100, {
                message: "Schedule name cannot exceed 100 characters",
            }),

        startDate: z.coerce.date({
            required_error: "Start date is required",
            invalid_type_error: "Start date must be a valid date",
        }),

        // End Date: Required and must be after start date
        endDate: z.coerce.date({
            required_error: "End date is required",
            invalid_type_error: "End date must be a valid date",
        }),

        // User ID: Optional, to associate schedule with a user
        userId: z.string().min(1).max(100),
    })
    .refine((data) => data.endDate > data.startDate, {
        message: "End date must be after start date",
        path: ["endDate"],
    });

// Schema for editing an existing schedule
export const editScheduleSchema = z
    .object({
        // ID: Required for updates
        id: z.number({
            required_error: "ID is required",
        }),

        // Name: Required, string
        name: z
            .string()
            .min(1, { message: "Schedule name is required" })
            .max(100, {
                message: "Schedule name cannot exceed 100 characters",
            }),

        // Start Date: Required
        startDate: z.coerce.date({
            required_error: "Start date is required",
            invalid_type_error: "Start date must be a valid date",
        }),

        // End Date: Required and must be after start date
        endDate: z.coerce.date({
            required_error: "End date is required",
            invalid_type_error: "End date must be a valid date",
        }),

        // User ID: Optional, to associate schedule with a user
        userId: z.string().min(1).max(100),
    })
    .refine((data) => data.endDate > data.startDate, {
        message: "End date must be after start date",
        path: ["endDate"],
    });

// Schema for deleting a schedule
export const deleteScheduleSchema = z.object({
    // ID: Required for deletion
    id: z.number({
        required_error: "ID is required",
    }),
});

// GET all schedules
export async function GET() {
    try {
        const allSchedules = await db.select().from(schedules);
        const formattedSchedules = allSchedules.map((schedule) => ({
            id: schedule.id,
            name: schedule.name,
            academic_year: schedule.academicYear,
        }));
        return NextResponse.json(formattedSchedules);
    } catch (error: unknown) {
        console.error("Error fetching schedules:", error);
        return NextResponse.json(
            { error: "Failed to fetch schedules" },
            { status: 500 }
        );
    }
}

// POST new schedule
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validatedData = createScheduleSchema.parse(body);
        const { name, startDate, endDate, userId } = validatedData;

        // Generate academic year string
        const academicYear = generateAcademicYear(startDate, endDate);

        const newSchedule = await db.insert(schedules).values({
            name,
            academicYear,
            userId,
        });

        return NextResponse.json(newSchedule);
    } catch (error: unknown) {
        console.error("Error creating schedule:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to create schedule" },
            { status: 500 }
        );
    }
}

// PUT/PATCH update schedule
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const validatedData = editScheduleSchema.parse(body);
        const { id, name, startDate, endDate, userId } = validatedData;

        // Generate academic year string
        const academicYear = generateAcademicYear(startDate, endDate);

        const updatedSchedule = await db
            .update(schedules)
            .set({
                name,
                academicYear,
                userId,
            })
            .where(eq(schedules.id, id));

        return NextResponse.json(updatedSchedule);
    } catch (error: unknown) {
        console.error("Error updating schedule:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to update schedule" },
            { status: 500 }
        );
    }
}

// DELETE schedule
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const validatedData = deleteScheduleSchema.parse(body);
        const { id } = validatedData;

        await db.delete(schedules).where(eq(schedules.id, id));

        return NextResponse.json({
            message: "Schedule deleted successfully",
        });
    } catch (error: unknown) {
        console.error("Error deleting schedule:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to delete schedule" },
            { status: 500 }
        );
    }
}
