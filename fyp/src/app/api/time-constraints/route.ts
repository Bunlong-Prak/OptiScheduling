// File: app/api/time-constraints/route.ts
import {
    instructors,
    instructorTimeConstraint,
    instructorTimeConstraintDay,
    instructorTimeConstraintTimeSlot,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import {
    createInstructorConstraintSchema,
    deleteInstructorConstraintSchema,
    editInstructorConstraintSchema,
} from "@/lib/validations/time-constraints";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET all instructor constraints
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

        // First, fetch all the raw data from the database with IDs
        const instructorTimeConstraintsQuery = await db
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
            )
            .where(
                eq(instructorTimeConstraint.scheduleId, parseInt(scheduleId))
            );

        // Group the data by day ID to collect all time slots per day
        const constraintMap = new Map();

        instructorTimeConstraintsQuery.forEach((item) => {
            const key = `${item.dayId}`; // Use dayId as the unique key

            if (!constraintMap.has(key)) {
                // Create new constraint entry
                constraintMap.set(key, {
                    id: item.dayId,
                    instructor_id: item.instructorId,
                    day_of_the_week: item.day,
                    time_period: [item.timeSlot],
                    firstName: item.firstName,
                    lastName: item.lastName,
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

        const { instructorId, day, timeSlots, scheduleId } =
            validationResult.data;

        // Check if a constraint already exists for this instructor
        const existingConstraint =
            await db.query.instructorTimeConstraint.findFirst({
                where: and(
                    eq(instructorTimeConstraint.instructorId, instructorId),
                    eq(instructorTimeConstraint.scheduleId, scheduleId)
                ),
            });

        let constraintId;
        if (existingConstraint) {
            constraintId = existingConstraint.id;
        } else {
            // Create a new constraint
            await db.insert(instructorTimeConstraint).values({
                instructorId,
                scheduleId,
            });

            // Get the newly created constraint
            const newConstraint =
                await db.query.instructorTimeConstraint.findFirst({
                    where: and(
                        eq(instructorTimeConstraint.instructorId, instructorId),
                        eq(instructorTimeConstraint.scheduleId, scheduleId)
                    ),
                });

            if (!newConstraint) {
                return NextResponse.json(
                    { error: "Failed to create constraint" },
                    { status: 500 }
                );
            }

            constraintId = newConstraint.id;
        }

        // Check if a day entry already exists for this constraint
        const existingDay =
            await db.query.instructorTimeConstraintDay.findFirst({
                where: and(
                    eq(
                        instructorTimeConstraintDay.instructorTimeConstraintId,
                        constraintId
                    ),
                    eq(instructorTimeConstraintDay.day, day)
                ),
            });

        let dayId;
        if (existingDay) {
            dayId = existingDay.id;

            // Delete existing time slots for this day
            await db
                .delete(instructorTimeConstraintTimeSlot)
                .where(
                    eq(
                        instructorTimeConstraintTimeSlot.instructorTimeConstraintDayId,
                        dayId
                    )
                );
        } else {
            // Create a new day entry
            await db.insert(instructorTimeConstraintDay).values({
                instructorTimeConstraintId: constraintId,
                day: day,
            });

            // Get the newly created day
            const newDay = await db.query.instructorTimeConstraintDay.findFirst(
                {
                    where: and(
                        eq(
                            instructorTimeConstraintDay.instructorTimeConstraintId,
                            constraintId
                        ),
                        eq(instructorTimeConstraintDay.day, day)
                    ),
                }
            );

            if (!newDay) {
                return NextResponse.json(
                    { error: "Failed to create day constraint" },
                    { status: 500 }
                );
            }

            dayId = newDay.id;
        }

        // Create time slots for this day
        const timeSlotValues = timeSlots.map((slot: string) => ({
            instructorTimeConstraintDayId: dayId,
            timeSlot: slot,
        }));

        await db
            .insert(instructorTimeConstraintTimeSlot)
            .values(timeSlotValues);

        return NextResponse.json({
            message: "Instructor time constraint created successfully",
            data: {
                instructorId,
                day,
                timeSlots,
                constraintId,
                dayId,
            },
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
        console.log("DELETE request body:", body); // Debug log

        // Validate request data
        const validationResult =
            deleteInstructorConstraintSchema.safeParse(body);
        if (!validationResult.success) {
            console.error("Validation failed:", validationResult.error.errors);
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validationResult.error.errors,
                },
                { status: 400 }
            );
        }

        const { instructorId, day, scheduleId } = validationResult.data;
        console.log("Deleting constraint for:", {
            instructorId,
            day,
            scheduleId,
        }); // Debug log

        // Type safety check: ensure day is not undefined
        if (!day) {
            return NextResponse.json(
                { error: "Day is required" },
                { status: 400 }
            );
        }

        // Use a transaction for the entire operation
        return await db.transaction(async (tx) => {
            // Get the constraint ID first
            const constraint =
                await tx.query.instructorTimeConstraint.findFirst({
                    where: and(
                        eq(instructorTimeConstraint.instructorId, instructorId),
                        eq(instructorTimeConstraint.scheduleId, scheduleId)
                    ),
                });

            if (!constraint) {
                throw new Error("Instructor constraint not found");
            }

            console.log("Found constraint:", constraint.id); // Debug log

            // Get the day entry
            const constraintDay =
                await tx.query.instructorTimeConstraintDay.findFirst({
                    where: and(
                        eq(
                            instructorTimeConstraintDay.instructorTimeConstraintId,
                            constraint.id
                        ),
                        eq(instructorTimeConstraintDay.day, day)
                    ),
                });

            if (!constraintDay) {
                throw new Error("Day constraint not found");
            }

            console.log("Found day constraint:", constraintDay.id); // Debug log

            // Delete all time slots for the specified day first
            const deletedTimeSlots = await tx
                .delete(instructorTimeConstraintTimeSlot)
                .where(
                    eq(
                        instructorTimeConstraintTimeSlot.instructorTimeConstraintDayId,
                        constraintDay.id
                    )
                );

            console.log("Deleted time slots"); // Debug log

            // Delete the day entry
            const deletedDay = await tx
                .delete(instructorTimeConstraintDay)
                .where(eq(instructorTimeConstraintDay.id, constraintDay.id));

            console.log("Deleted day entry"); // Debug log

            // Check if there are any remaining days for this constraint
            const remainingDays =
                await tx.query.instructorTimeConstraintDay.findMany({
                    where: eq(
                        instructorTimeConstraintDay.instructorTimeConstraintId,
                        constraint.id
                    ),
                });

            console.log("Remaining days count:", remainingDays.length); // Debug log

            // If no days are left, delete the constraint itself
            if (remainingDays.length === 0) {
                await tx
                    .delete(instructorTimeConstraint)
                    .where(eq(instructorTimeConstraint.id, constraint.id));
                console.log("Deleted main constraint"); // Debug log
            }

            return NextResponse.json({
                message: "Instructor time constraint deleted successfully",
                deletedItems: {
                    timeSlots: true,
                    day: true,
                    constraint: remainingDays.length === 0,
                },
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
