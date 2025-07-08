import { instructors, schedules } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// FIXED: Updated schemas to match frontend data structure
const createInstructorSchema = z.object({
    instructor_id: z.string().optional(), // Made optional as it can be empty
    first_name: z
        .string({
            required_error: "First name is required",
        })
        .min(1, "First name cannot be empty"),
    last_name: z
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
    phone_number: z.string().optional(), // Made optional
    schedule_id: z.number({
        required_error: "Schedule ID is required",
    }),
});

const editInstructorSchema = z.object({
    id: z.number({
        required_error: "ID is required",
    }),
    instructor_id: z.string().optional(),
    first_name: z
        .string({
            required_error: "First name is required",
        })
        .min(1, "First name cannot be empty"),
    last_name: z
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
    phone_number: z.string().optional(),
});

const deleteInstructorSchema = z.object({
    id: z.number({
        required_error: "ID is required",
    }),
});

// GET all instructors
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");

        let instructorQuery;
        if (scheduleId) {
            instructorQuery = await db
                .select({
                    id: instructors.id,
                    instructor_id: instructors.instructorId, // FIXED: Correct field mapping
                    first_name: instructors.firstName,
                    last_name: instructors.lastName,
                    gender: instructors.gender,
                    email: instructors.email,
                    phone_number: instructors.phoneNumber,
                })
                .from(instructors)
                .innerJoin(schedules, eq(instructors.scheduleId, schedules.id))
                .where(eq(instructors.scheduleId, parseInt(scheduleId)));
        } else {
            // FIXED: Handle case when no scheduleId is provided
            instructorQuery = await db
                .select({
                    id: instructors.id,
                    instructor_id: instructors.instructorId,
                    first_name: instructors.firstName,
                    last_name: instructors.lastName,
                    gender: instructors.gender,
                    email: instructors.email,
                    phone_number: instructors.phoneNumber,
                })
                .from(instructors);
        }

        // FIXED: Return data in the format expected by frontend
        return NextResponse.json(instructorQuery || []);
    } catch (error: unknown) {
        console.error("Error fetching instructors:", error);
        return NextResponse.json(
            { error: "Failed to fetch instructors" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate request body against schema
        try {
            const validatedData = createInstructorSchema.parse(body);

            const {
                instructor_id,
                first_name,
                last_name,
                gender,
                email,
                phone_number,
                schedule_id,
            } = validatedData;

            // FIXED: Check for duplicate email before insertion
            const existingInstructor = await db.query.instructors.findFirst({
                where: eq(instructors.email, email),
            });

            if (existingInstructor) {
                return NextResponse.json(
                    { error: "An instructor with this email already exists" },
                    { status: 409 }
                );
            }

            // FIXED: Map frontend fields to database fields
            const result = await db
                .insert(instructors)
                .values({
                    instructorId: instructor_id || "", // Map to database field
                    firstName: first_name, // Map to database field
                    lastName: last_name, // Map to database field
                    gender,
                    email: email, // Normalize email
                    phoneNumber: phone_number || "", // Map to database field
                    scheduleId: schedule_id, // Map to database field
                })
                .$returningId();

            // Check if insertion was successful
            if (!result || result.length === 0) {
                return NextResponse.json(
                    {
                        error: "Failed to create instructor - no record returned",
                    },
                    { status: 500 }
                );
            }

            // Fetch the complete record and return in frontend format
            const createdInstructor = await db.query.instructors.findFirst({
                where: eq(instructors.id, result[0].id),
            });

            if (!createdInstructor) {
                return NextResponse.json(
                    { error: "Failed to retrieve created instructor" },
                    { status: 500 }
                );
            }

            // FIXED: Return data in frontend format
            const responseData = {
                id: createdInstructor.id,
                instructor_id: createdInstructor.instructorId,
                first_name: createdInstructor.firstName,
                last_name: createdInstructor.lastName,
                gender: createdInstructor.gender,
                email: createdInstructor.email,
                phone_number: createdInstructor.phoneNumber,
            };

            return NextResponse.json(responseData, { status: 201 });
        } catch (validationError) {
            console.error("Validation error:", validationError);
            if (validationError instanceof z.ZodError) {
                return NextResponse.json(
                    {
                        error: "Invalid instructor data",
                        details: validationError.errors
                            .map(
                                (err) => `${err.path.join(".")}: ${err.message}`
                            )
                            .join(", "),
                    },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: "Invalid instructor data" },
                { status: 400 }
            );
        }
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

        const {
            id,
            instructor_id,
            first_name,
            last_name,
            gender,
            email,
            phone_number,
        } = validatedData;

        // FIXED: Check if instructor exists
        const existingInstructor = await db.query.instructors.findFirst({
            where: eq(instructors.id, id),
        });

        if (!existingInstructor) {
            return NextResponse.json(
                { error: "Instructor not found" },
                { status: 404 }
            );
        }

        // FIXED: Check for duplicate email (excluding current instructor)
        const duplicateEmail = await db.query.instructors.findFirst({
            where: eq(instructors.email, email),
        });

        if (duplicateEmail && duplicateEmail.id !== id) {
            return NextResponse.json(
                { error: "Another instructor with this email already exists" },
                { status: 409 }
            );
        }

        // FIXED: Map frontend fields to database fields
        await db
            .update(instructors)
            .set({
                instructorId: instructor_id || "",
                firstName: first_name,
                lastName: last_name,
                gender,
                email: email.toLowerCase(),
                phoneNumber: phone_number || "",
            })
            .where(eq(instructors.id, id));

        // Fetch the updated record
        const updatedInstructor = await db.query.instructors.findFirst({
            where: eq(instructors.id, id),
        });

        if (!updatedInstructor) {
            return NextResponse.json(
                { error: "Failed to update instructor" },
                { status: 500 }
            );
        }

        // FIXED: Return updated data in frontend format
        const responseData = {
            id: updatedInstructor.id,
            instructor_id: updatedInstructor.instructorId,
            first_name: updatedInstructor.firstName,
            last_name: updatedInstructor.lastName,
            gender: updatedInstructor.gender,
            email: updatedInstructor.email,
            phone_number: updatedInstructor.phoneNumber,
        };

        return NextResponse.json(responseData);
    } catch (error: unknown) {
        console.error("Error updating instructor:", error);

        // Handle Zod validation errors specifically
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: "Validation error",
                    details: error.errors
                        .map((err) => `${err.path.join(".")}: ${err.message}`)
                        .join(", "),
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to update instructor",
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

        // FIXED: Check if instructor exists before deletion
        const existingInstructor = await db.query.instructors.findFirst({
            where: eq(instructors.id, id),
        });

        if (!existingInstructor) {
            return NextResponse.json(
                { error: "Instructor not found" },
                { status: 404 }
            );
        }

        // Save instructor data before deletion
        const instructorToDelete = {
            id: existingInstructor.id,
            instructor_id: existingInstructor.instructorId,
            first_name: existingInstructor.firstName,
            last_name: existingInstructor.lastName,
        };

        // Delete the instructor
        await db.delete(instructors).where(eq(instructors.id, id));

        return NextResponse.json({
            message: "Instructor deleted successfully",
            deletedInstructor: instructorToDelete,
        });
    } catch (error: unknown) {
        console.error("Error deleting instructor:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: "Validation error",
                    details: error.errors
                        .map((err) => `${err.path.join(".")}: ${err.message}`)
                        .join(", "),
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: "Failed to delete instructor" },
            { status: 500 }
        );
    }
}
