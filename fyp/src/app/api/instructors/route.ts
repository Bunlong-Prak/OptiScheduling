import { instructors } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createInstructorSchema = z.object({
    firstName: z
        .string({
            required_error: "First name is required",
        })
        .min(1, "First name cannot be empty"),
    lastName: z
        .string({
            required_error: "Last name is required",
        })
        .min(1, "Last name cannot be empty"),
    gender: z
        .string({
            required_error: "Gender is required",
        })
        .min(1, "Gender cannot be empty"),
    email: z
        .string({
            required_error: "Email is required",
        })
        .email("Invalid email format"),
    phoneNumber: z.string({
        required_error: "Phone Number is required",
    }),
});
const editInstructorSchema = z.object({
    id: z.number({
        required_error: "ID is required",
    }),
    firstName: z
        .string({
            required_error: "First name is required",
        })
        .min(1, "First name cannot be empty"),
    lastName: z
        .string({
            required_error: "Last name is required",
        })
        .min(1, "Last name cannot be empty"),
    gender: z
        .string({
            required_error: "Gender is required",
        })
        .min(1, "Gender cannot be empty"),
    email: z
        .string({
            required_error: "Email is required",
        })
        .email("Invalid email format"),
    phoneNumber: z.string({
        required_error: "Phone Number is required",
    }),
});

const deleteInstructorSchema = z.object({
    id: z.number({
        required_error: "ID is required",
    }),
});

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

        // Validate request body against schema
        const validatedData = createInstructorSchema.parse(body);

        const { firstName, lastName, gender, email, phoneNumber } =
            validatedData;

        const newInstructor = await db.insert(instructors).values({
            firstName,
            lastName,
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

// PATCH update instructor
export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        // Validate request body against schema
        const validatedData = editInstructorSchema.parse(body);

        const { id, firstName, lastName, gender, email, phoneNumber } =
            validatedData;

        const updatedInstructor = await db
            .update(instructors)
            .set({
                firstName,
                lastName,
                gender,
                email,
                phoneNumber,
            })
            .where(eq(instructors.id, id));

        return NextResponse.json(updatedInstructor);
    } catch (error: unknown) {
        console.error("Error updating instructor:", error);

        // Handle Zod validation errors specifically
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Validation error",
                    details: error.errors,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

// DELETE instructor
export async function DELETE(request: Request) {
    try {
        const body = await request.json();

        // Validate request body against schema
        const validatedData = deleteInstructorSchema.parse(body);

        const { id } = validatedData;

        await db.delete(instructors).where(eq(instructors.id, id));

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
