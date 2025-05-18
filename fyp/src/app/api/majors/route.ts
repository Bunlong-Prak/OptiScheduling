// Updated Route.ts File - Simplified Major Handling

import { majors } from "@/drizzle/schema";
import { db } from "@/lib/db";
import {
    createMajorSchema,
    deleteMajorSchema,
    editMajorSchema,
} from "@/lib/validations/majors";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET all majors
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");

        console.log("GET /api/majors with params:", { scheduleId });

        if (!scheduleId) {
            return NextResponse.json(
                { error: "scheduleId is required" },
                { status: 400 }
            );
        }

        // Regular get all majors
        const majorsQuery = await db
            .select({
                id: majors.id,
                name: majors.name,
                shortTag: majors.shortTag,
                scheduleId: majors.scheduleId,
            })
            .from(majors)
            .where(eq(majors.scheduleId, parseInt(scheduleId)));

        console.log(
            `Found ${majorsQuery.length} majors for scheduleId ${scheduleId}`
        );
        console.log("Majors:", majorsQuery);

        return NextResponse.json(majorsQuery);
    } catch (error: any) {
        console.error("Error fetching majors:", error);
        return NextResponse.json(
            { error: `Failed to fetch majors: ${error.message}` },
            { status: 500 }
        );
    }
}

// POST new major
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Single major creation
        try {
            const validatedData = createMajorSchema.parse(body);
            // Use type assertion since we know our schema includes these fields
            const { name, shortTag, scheduleId } = validatedData as {
                name: string;
                shortTag: string;
                scheduleId: number;
            };

            console.log("Adding major:", {
                name,
                shortTag,
                scheduleId,
            });

            // Insert major data
            const majorData = {
                name,
                shortTag,
                scheduleId,
            };

            await db.insert(majors).values(majorData);

            // For MySQL, we need to fetch the created item separately
            const newMajor = await db
                .select()
                .from(majors)
                .where(
                    and(
                        eq(majors.name, name),
                        eq(majors.shortTag, shortTag),
                        eq(majors.scheduleId, scheduleId)
                    )
                )
                .orderBy(desc(majors.id))
                .limit(1);

            console.log("Successfully added major:", newMajor[0]);
            return NextResponse.json(newMajor[0], { status: 201 });
        } catch (validationError: any) {
            console.error("Validation error:", validationError);
            return NextResponse.json(
                { error: `Validation error: ${validationError.message}` },
                { status: 400 }
            );
        }
    } catch (error: any) {
        console.error("Error creating major:", error);
        return NextResponse.json(
            { error: `Failed to create major: ${error.message}` },
            { status: 500 }
        );
    }
}

// PATCH update major
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("PATCH /api/majors with body:", body);

        // Single major update
        try {
            const validatedData = editMajorSchema.parse(body);
            const { id, name, shortTag } = validatedData as {
                id: number;
                name: string;
                shortTag: string;
            };

            console.log("Updating major:", {
                id,
                name,
                shortTag,
            });

            const updateData = {
                name,
                shortTag,
            };

            // Update without returning
            await db.update(majors).set(updateData).where(eq(majors.id, id));

            // Fetch the updated major separately
            const updatedMajor = await db
                .select()
                .from(majors)
                .where(eq(majors.id, id));

            console.log("Updated major:", updatedMajor[0]);
            return NextResponse.json(updatedMajor[0]);
        } catch (validationError: any) {
            console.error("Validation error:", validationError);
            return NextResponse.json(
                { error: `Validation error: ${validationError.message}` },
                { status: 400 }
            );
        }
    } catch (error: any) {
        console.error("Error updating major:", error);
        return NextResponse.json(
            { error: `Failed to update major: ${error.message}` },
            { status: 500 }
        );
    }
}

// DELETE major
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("DELETE /api/majors with body:", body);

        // Single major delete
        try {
            const validatedData = deleteMajorSchema.parse(body);
            const { id } = validatedData;

            console.log("Deleting major:", id);

            // For single delete, get the record before deleting
            const majorToDelete = await db
                .select()
                .from(majors)
                .where(eq(majors.id, id));

            if (majorToDelete.length === 0) {
                return NextResponse.json(
                    { error: `Major with id ${id} not found` },
                    { status: 404 }
                );
            }

            // Then delete
            await db.delete(majors).where(eq(majors.id, id));

            console.log("Successfully deleted major:", majorToDelete[0]);
            return NextResponse.json({
                message: "Major deleted successfully",
                deletedMajor: majorToDelete[0],
            });
        } catch (validationError: any) {
            console.error("Validation error:", validationError);
            return NextResponse.json(
                { error: `Validation error: ${validationError.message}` },
                { status: 400 }
            );
        }
    } catch (error: any) {
        console.error("Error deleting major:", error);
        return NextResponse.json(
            { error: `Failed to delete major: ${error.message}` },
            { status: 500 }
        );
    }
}
