import {
    instructors,
    instructorTimeConstraint,
    instructorTimeConstraintDay,
    instructorTimeConstraintTimeSlot,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export const createInstructorConstraintSchema = z.object({
    // instructorId: Required, positive integer
    instructorId: z
        .number()
        .int({ message: "Instructor ID must be a whole number" })
        .positive({ message: "Instructor ID must be a positive number" }),

    // day: Required, string
    day: z
        .string()
        .min(1, { message: "Day is required" })
        .refine(
            (val) =>
                [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ].includes(val),
            { message: "Day must be a valid day of the week" }
        ),

    // timeSlots: Required, array of strings, non-empty
    timeSlots: z
        .array(z.string().min(1, { message: "Time slot cannot be empty" }))
        .min(1, { message: "At least one time slot is required" }),
});

export const editInstructorConstraintSchema = z.object({
    instructorId: z
        .number()
        .int({ message: "Instructor ID must be a whole number" })
        .positive({ message: "Instructor ID must be a positive number" }),

    // day: Required, string
    day: z
        .string()
        .min(1, { message: "Day is required" })
        .refine(
            (val) =>
                [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ].includes(val),
            { message: "Day must be a valid day of the week" }
        ),

    // timeSlots: Required, array of strings, non-empty
    timeSlots: z
        .array(z.string().min(1, { message: "Time slot cannot be empty" }))
        .min(1, { message: "At least one time slot is required" }),
});

export const deleteInstructorConstraintSchema = z.object({
    // constraintId: Required, positive integer
    instructorId: z
        .number()
        .int({ message: "Instructor ID must be a whole number" })
        .positive({ message: "Instructor ID must be a positive number" }),
});

// GET all instructor constraints
export async function GET() {
    try {
        // First, fetch all the raw data from the database with IDs
        const instructorTimeConstraints = await db
            .select({
                instructorId: instructors.id,
                firstName: instructors.firstName,
                lastName: instructors.lastName,
                dayId: instructorTimeConstraintDay.id,
                day: instructorTimeConstraintDay.day,
                timeSlot: instructorTimeConstraintTimeSlot.timeSlot,
            })
            .from(instructors)
            .innerJoin(
                instructorTimeConstraint,
                eq(instructors.id, instructorTimeConstraint.instructorId)
            )
            .innerJoin(
                instructorTimeConstraintDay,
                eq(
                    instructorTimeConstraint.id,
                    instructorTimeConstraintDay.instructorTimeConstraintId
                )
            )
            .innerJoin(
                instructorTimeConstraintTimeSlot,
                eq(
                    instructorTimeConstraintDay.id,
                    instructorTimeConstraintTimeSlot.instructorTimeConstraintDayId
                )
            );

        // Group the data by day ID to collect all time slots per day
        const constraintMap = new Map();

        instructorTimeConstraints.forEach((item) => {
            const key = `${item.dayId}`; // Use dayId as the unique key

            if (!constraintMap.has(key)) {
                // Create new constraint entry
                constraintMap.set(key, {
                    id: item.dayId, // Use dayId as the constraint ID
                    instructor_id: item.instructorId, // Use the actual instructor ID
                    day_of_the_week: item.day, // Use the renamed field to match frontend expectations
                    time_period: [item.timeSlot], // Start an array with the first time slot
                });
            } else {
                // Add time slot to existing constraint
                const constraint = constraintMap.get(key);
                if (!constraint.time_period.includes(item.timeSlot)) {
                    constraint.time_period.push(item.timeSlot);
                }
            }
        });

        // Convert the map to an array
        const formattedConstraints = Array.from(constraintMap.values());

        return NextResponse.json(formattedConstraints);
    } catch (error) {
        console.error("Error fetching instructor constraints:", error);
        return NextResponse.json(
            { error: "Failed to fetch instructor constraints" },
            { status: 500 }
        );
    }
}

// POST new instructor constraint
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate request data
        const validationResult =
            createInstructorConstraintSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validationResult.error.errors,
                },
                { status: 400 }
            );
        }

        const { instructorId, day, timeSlots } = validationResult.data;

        // First create the time constraint
        await db.insert(instructorTimeConstraint).values({
            instructorId,
        });

        // Get the inserted constraint ID
        const constraint = await db.query.instructorTimeConstraint.findFirst({
            where: eq(instructorTimeConstraint.instructorId, instructorId),
        });
        if (!constraint) {
            return NextResponse.json(
                { error: "Instructor not found" },
                { status: 404 }
            );
        }

        // Create day entry
        await db.insert(instructorTimeConstraintDay).values({
            instructorTimeConstraintId: constraint.id,
            day: day,
        });

        // Get the inserted day ID
        const constraintDay =
            await db.query.instructorTimeConstraintDay.findFirst({
                where: eq(instructorTimeConstraintDay.day, day),
            });
        if (!constraintDay) {
            return NextResponse.json(
                { error: "Day not found" },
                { status: 404 }
            );
        }

        // Create time slots for this day
        const timeSlotValues = timeSlots.map((slot: string) => ({
            instructorTimeConstraintDayId: constraintDay.id,
            timeSlot: slot,
        }));

        await db
            .insert(instructorTimeConstraintTimeSlot)
            .values(timeSlotValues);

        return NextResponse.json({
            message: "Instructor time constraint created successfully",
        });
    } catch (error: unknown) {
        console.error("Error creating instructor constraint:", error);
        return NextResponse.json(
            { error: "Failed to create instructor constraint" },
            { status: 500 }
        );
    }
}

// PATCH update instructor constraint
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        // Validate request data
        const validationResult = editInstructorConstraintSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validationResult.error.errors,
                },
                { status: 400 }
            );
        }

        const { instructorId, day, timeSlots } = validationResult.data;

        // Find the existing constraint
        const constraint = await db.query.instructorTimeConstraint.findFirst({
            where: eq(instructorTimeConstraint.instructorId, instructorId),
        });

        if (!constraint) {
            return NextResponse.json(
                { error: "Instructor constraint not found" },
                { status: 404 }
            );
        }

        // Find the day entry
        const constraintDay =
            await db.query.instructorTimeConstraintDay.findFirst({
                where: and(
                    eq(
                        instructorTimeConstraintDay.instructorTimeConstraintId,
                        constraint.id
                    ),
                    eq(instructorTimeConstraintDay.day, day)
                ),
            });

        if (!constraintDay) {
            return NextResponse.json(
                { error: "Day constraint not found" },
                { status: 404 }
            );
        }

        // Use a transaction for the update
        return await db.transaction(async (tx) => {
            // Delete existing time slots for this day
            await tx
                .delete(instructorTimeConstraintTimeSlot)
                .where(
                    eq(
                        instructorTimeConstraintTimeSlot.instructorTimeConstraintDayId,
                        constraintDay.id
                    )
                );

            // Create new time slots
            const timeSlotValues = timeSlots.map((slot: string) => ({
                instructorTimeConstraintDayId: constraintDay.id,
                timeSlot: slot,
            }));

            await tx
                .insert(instructorTimeConstraintTimeSlot)
                .values(timeSlotValues);

            return NextResponse.json({
                message: "Instructor time constraint updated successfully",
                data: {
                    constraintId: constraint.id,
                    dayId: constraintDay.id,
                    timeSlots: timeSlots,
                },
            });
        });
    } catch (error: unknown) {
        console.error("Error updating instructor constraint:", error);

        if (error instanceof Error) {
            return NextResponse.json(
                {
                    error: "Failed to update instructor constraint",
                    message: error.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Failed to update instructor constraint" },
            { status: 500 }
        );
    }
}

// DELETE instructor constraint
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        // Validate request data
        const validationResult =
            deleteInstructorConstraintSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validationResult.error.errors,
                },
                { status: 400 }
            );
        }

        const { instructorId } = validationResult.data;

        // Get the constraint ID first
        const constraint = await db.query.instructorTimeConstraint.findFirst({
            where: eq(instructorTimeConstraint.instructorId, instructorId),
        });

        if (!constraint) {
            return NextResponse.json(
                { error: "Instructor constraint not found" },
                { status: 404 }
            );
        }

        const constraintId = constraint.id;

        // Use a transaction to ensure all deletions succeed or fail together
        return await db.transaction(async (tx) => {
            // Get all days for this constraint
            const days = await tx
                .select({ id: instructorTimeConstraintDay.id })
                .from(instructorTimeConstraintDay)
                .where(
                    eq(
                        instructorTimeConstraintDay.instructorTimeConstraintId,
                        constraintId
                    )
                );

            // Delete all time slots for all days in one query
            if (days.length > 0) {
                const dayIds = days.map((day) => day.id);
                await tx
                    .delete(instructorTimeConstraintTimeSlot)
                    .where(
                        inArray(
                            instructorTimeConstraintTimeSlot.instructorTimeConstraintDayId,
                            dayIds
                        )
                    );
            }

            // Delete all days
            await tx
                .delete(instructorTimeConstraintDay)
                .where(
                    eq(
                        instructorTimeConstraintDay.instructorTimeConstraintId,
                        constraintId
                    )
                );

            // Finally, delete the constraint itself
            await tx
                .delete(instructorTimeConstraint)
                .where(eq(instructorTimeConstraint.id, constraintId));

            return NextResponse.json({
                message: "Instructor time constraint deleted successfully",
            });
        });
    } catch (error: unknown) {
        console.error("Error deleting instructor constraint:", error);

        if (error instanceof Error) {
            return NextResponse.json(
                {
                    error: "Failed to delete instructor constraint",
                    message: error.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Failed to delete instructor constraint" },
            { status: 500 }
        );
    }
}
