// Complete Fixed Route.ts File

import { majors } from "@/drizzle/schema";
import { db } from "@/lib/db";
import {
    createMajorSchema,
    editMajorSchema,
    deleteMajorSchema,
} from "@/lib/validations/majors";
import { and, eq, like, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET all majors or majors by name
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");
        const name = searchParams.get("name");

        console.log("GET /api/majors with params:", { scheduleId, name });

        if (!scheduleId) {
            return NextResponse.json(
                { error: "scheduleId is required" },
                { status: 400 }
            );
        }

        // If name is provided, find majors by name
        if (name) {
            // Get base name without "Year X" part
            const baseName = String(name).replace(/\s+Year\s+\d+$/, "");

            console.log("Searching for majors with base name:", baseName);

            // Find all majors with the same base name
            const result = await db
                .select()
                .from(majors)
                .where(
                    and(
                        eq(majors.scheduleId, parseInt(scheduleId)),
                        // Match both exact name and names with "Year X" suffix
                        like(majors.name, `${baseName}%`)
                    )
                );

            console.log(`Found ${result.length} majors matching ${baseName}`);

            const formattedMajors = result.map((major) => ({
                id: major.id,
                name: major.name,
                shortTag: major.shortTag,
                year: major.year,
                scheduleId: major.scheduleId,
            }));

            return NextResponse.json(formattedMajors);
        }

        // Regular get all majors
        const majorsQuery = await db
            .select({
                id: majors.id,
                name: majors.name,
                shortTag: majors.shortTag,
                year: majors.year,
                scheduleId: majors.scheduleId,
            })
            .from(majors)
            .where(eq(majors.scheduleId, parseInt(scheduleId)));

        console.log(
            `Found ${majorsQuery.length} majors for scheduleId ${scheduleId}`
        );
        console.log("Majors:", majorsQuery);
        const formattedMajors = majorsQuery.map((major) => ({
            id: major.id,
            name: major.name,
            shortTag: major.shortTag,
            year: major.year,
            scheduleId: major.scheduleId,
        }));

        return NextResponse.json(formattedMajors);
    } catch (error: any) {
        console.error("Error fetching majors:", error);
        return NextResponse.json(
            { error: `Failed to fetch majors: ${error.message}` },
            { status: 500 }
        );
    }
}

// POST new major (single or batch)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("POST /api/majors with body:", body);

        // Check if it's a batch operation
        if (body.majors && Array.isArray(body.majors)) {
            // Batch create operation
            const majorsToAdd = body.majors;

            if (!majorsToAdd.length) {
                return NextResponse.json(
                    { error: "Empty majors array" },
                    { status: 400 }
                );
            }

            console.log(`Adding ${majorsToAdd.length} majors in batch`);
            console.log("Majors to add:", majorsToAdd);
            // Insert without returning
            try {
                await db.insert(majors).values(majorsToAdd);
            } catch (insertError: any) {
                console.error("Error inserting majors:", insertError);
                return NextResponse.json(
                    {
                        error: `Database insertion error: ${insertError.message}`,
                    },
                    { status: 500 }
                );
            }

            try {
                // For MySQL, we need to fetch the created items separately
                const lastInsertedMajors = await db
                    .select()
                    .from(majors)
                    .where(
                        and(
                            eq(majors.scheduleId, majorsToAdd[0].scheduleId),
                            // This works if we're inserting one set of majors at a time
                            like(majors.name, `${majorsToAdd[0].name}%`)
                        )
                    )
                    .orderBy(majors.id);

                console.log(
                    `Successfully retrieved ${lastInsertedMajors.length} newly inserted majors`
                );
                return NextResponse.json(lastInsertedMajors, { status: 201 });
            } catch (selectError: any) {
                console.error(
                    "Error selecting newly inserted majors:",
                    selectError
                );
                // Still return success even if we couldn't retrieve the inserted items
                return NextResponse.json(
                    {
                        message:
                            "Majors added successfully, but couldn't retrieve details",
                        success: true,
                    },
                    { status: 201 }
                );
            }
        } else {
            // Single major creation
            try {
                const validatedData = createMajorSchema.parse(body);
                // Use type assertion since we know our schema includes these fields
                const { name, shortTag, scheduleId, year } = validatedData as {
                    name: string;
                    shortTag: string;
                    scheduleId: number;
                    year?: number | null;
                };

                console.log("Adding single major:", {
                    name,
                    shortTag,
                    scheduleId,
                    year,
                });

                // Insert with conditional year property
                const majorData: {
                    name: string;
                    shortTag: string;
                    scheduleId: number;
                    year?: number | null;
                } = {
                    name,
                    shortTag,
                    scheduleId,
                };

                // Only add year if it's defined
                if (year !== undefined) {
                    majorData.year = year;
                }

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
        }
    } catch (error: any) {
        console.error("Error creating major:", error);
        return NextResponse.json(
            { error: `Failed to create major: ${error.message}` },
            { status: 500 }
        );
    }
}

// PUT/PATCH update major (single or batch)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("PATCH /api/majors with body:", body);

        // Check if it's a batch operation
        if (body.updates && Array.isArray(body.updates)) {
            // Batch update operation
            const updates = body.updates;

            if (!updates.length) {
                return NextResponse.json(
                    { error: "Empty updates array" },
                    { status: 400 }
                );
            }

            console.log(`Updating ${updates.length} majors in batch`);
            const updatedMajors = [];

            // Process each update individually
            for (const update of updates) {
                if (!update.id) {
                    console.warn("Skipping update with missing id:", update);
                    continue;
                }

                const { id, ...data } = update;
                console.log(`Updating major ${id} with:`, data);

                try {
                    // Update without returning
                    await db.update(majors).set(data).where(eq(majors.id, id));

                    // Fetch the updated major separately
                    const updated = await db
                        .select()
                        .from(majors)
                        .where(eq(majors.id, id));

                    if (updated.length > 0) {
                        updatedMajors.push(updated[0]);
                    } else {
                        console.warn(
                            `Major with id ${id} not found after update`
                        );
                    }
                } catch (updateError: any) {
                    console.error(`Error updating major ${id}:`, updateError);
                }
            }

            return NextResponse.json({
                message: `Updated ${updatedMajors.length} majors`,
                majors: updatedMajors,
            });
        } else {
            // Single major update
            try {
                const validatedData = editMajorSchema.parse(body);
                const { id, name, shortTag, year } = validatedData as {
                    id: number;
                    name: string;
                    shortTag: string;
                    year?: number | null;
                };

                console.log("Updating single major:", {
                    id,
                    name,
                    shortTag,
                    year,
                });

                const updateData: {
                    name: string;
                    shortTag: string;
                    year?: number | null;
                } = {
                    name,
                    shortTag,
                };

                // Only include year in the update if it's explicitly provided
                if (year !== undefined) {
                    updateData.year = year;
                }

                // Update without returning
                await db
                    .update(majors)
                    .set(updateData)
                    .where(eq(majors.id, id));

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
        }
    } catch (error: any) {
        console.error("Error updating major:", error);
        return NextResponse.json(
            { error: `Failed to update major: ${error.message}` },
            { status: 500 }
        );
    }
}

// DELETE major (single or batch)
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("DELETE /api/majors with body:", body);

        // Check if it's a batch operation
        if (body.ids && Array.isArray(body.ids)) {
            // Batch delete operation
            const ids: number[] = body.ids;

            if (!ids.length) {
                return NextResponse.json(
                    { error: "Empty ids array" },
                    { status: 400 }
                );
            }

            console.log(`Deleting ${ids.length} majors in batch:`, ids);

            // For batch delete, we can't easily get the deleted records,
            // so just return success message with the deleted IDs
            let successCount = 0;
            const failedIds: number[] = [];

            for (const id of ids) {
                try {
                    const result = await db
                        .delete(majors)
                        .where(eq(majors.id, id));
                    if (result) {
                        successCount++;
                    } else {
                        failedIds.push(id);
                    }
                } catch (deleteError: any) {
                    console.error(`Error deleting major ${id}:`, deleteError);
                    failedIds.push(id);
                }
            }

            return NextResponse.json({
                message: `Deleted ${successCount} out of ${ids.length} majors successfully`,
                deletedIds: ids.filter((id: number) => !failedIds.includes(id)),
                failedIds: failedIds.length > 0 ? failedIds : undefined,
            });
        } else {
            // Single major delete
            try {
                const validatedData = deleteMajorSchema.parse(body);
                const { id } = validatedData;

                console.log("Deleting single major:", id);

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
                return NextResponse.json(
                    majorToDelete[0] || {
                        message: "Major deleted successfully",
                        deletedId: id,
                    }
                );
            } catch (validationError: any) {
                console.error("Validation error:", validationError);
                return NextResponse.json(
                    { error: `Validation error: ${validationError.message}` },
                    { status: 400 }
                );
            }
        }
    } catch (error: any) {
        console.error("Error deleting major:", error);
        return NextResponse.json(
            { error: `Failed to delete major: ${error.message}` },
            { status: 500 }
        );
    }
}
