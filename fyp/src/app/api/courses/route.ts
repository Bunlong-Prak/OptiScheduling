import {
    classrooms,
    courses,
    instructors,
    majors,
    schedules,
    sections,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// Updated section schema to include status
const sectionSchema = z.object({
    section: z.string().min(1, { message: "Section number is required" }),
    instructorId: z.string().optional(), // Optional instructor ID
    status: z.enum(["online", "offline"]).default("offline"), // Status at section level
});

// Updated course schema for creating new courses (removed status from course level)
const courseSchema = z.object({
    // Course Code: Required, alphanumeric with possible spaces/dashes, min 2 chars, max 10 chars
    code: z
        .string()
        .min(1, { message: "Course code must be at least 2 characters" })
        .max(10, { message: "Course code cannot exceed 10 characters" })
        .regex(/^[A-Z0-9\s-]+$/i, {
            message:
                "Course code can only contain letters, numbers, spaces, and hyphens",
        }),
    // Course Name: Required, string, min 3 chars, max 100 chars
    title: z
        .string()
        .min(1, { message: "Course name must be at least 3 characters" })
        .max(100, { message: "Course name cannot exceed 100 characters" }),
    // Single major name - will be converted to majorId
    majorsList: z
        .array(z.string())
        .min(1, { message: "A Major is required" })
        .max(1, { message: "Only one major can be selected" }),
    // Color: Required (now supports hex colors)
    color: z
        .string()
        .min(1, { message: "Color is required" })
        .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
            message: "Color must be a valid hex color (e.g., #FF0000)",
        }),
    duration: z.number().min(1, { message: "Duration is required" }),
    // Capacity: Required
    capacity: z.number().min(1, { message: "Capacity is required" }),
    // Sections array: Required, at least one section (now includes status per section)
    sectionsList: z
        .array(sectionSchema)
        .min(1, { message: "At least one section is required" }),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
    }),
});

// Updated schema for editing courses (removed status from course level)
const editCourseSchema = z.object({
    sectionId: z.number({
        required_error: "Section ID is required",
    }),
    // Course Code: Required, alphanumeric with possible spaces/dashes, min 2 chars, max 10 chars
    code: z
        .string()
        .min(1, { message: "Course code must be at least 2 characters" })
        .max(10, { message: "Course code cannot exceed 10 characters" })
        .regex(/^[A-Z0-9\s-]+$/i, {
            message:
                "Course code can only contain letters, numbers, spaces, and hyphens",
        }),
    // Course Name: Required, string, min 3 chars, max 100 chars
    title: z
        .string()
        .min(1, { message: "Course name must be at least 3 characters" })
        .max(100, { message: "Course name cannot exceed 100 characters" }),
    // Single major name - will be converted to majorId
    majorsList: z
        .array(z.string())
        .min(1, { message: "A Major is required" })
        .max(1, { message: "Only one major can be selected" }),
    // Color: Required (now supports hex colors)
    color: z
        .string()
        .min(1, { message: "Color is required" })
        .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
            message: "Color must be a valid hex color (e.g., #FF0000)",
        }),
    duration: z.number().min(1, { message: "Duration is required" }),
    // Capacity: Required
    capacity: z.number().min(1, { message: "Capacity is required" }),
    // Sections array: Required, at least one section (now includes status per section)
    sectionsList: z
        .array(sectionSchema)
        .min(1, { message: "At least one section is required" }),
    // Optional array of section IDs to delete
    sectionsToDelete: z.array(z.number()).optional(),
});

const deleteCourseSchema = z.object({
    sectionId: z.number({
        required_error: "Section ID is required",
    }),
});

// GET all courses - updated to include section status
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");

        // Updated query to include section status
        let query = db
            .select({
                id: courses.id,
                title: courses.title,
                code: courses.code,
                major: majors.name, // Get major name from direct join
                color: courses.color,
                firstName: instructors.firstName,
                lastName: instructors.lastName,
                instructorId: instructors.id, // Include instructor ID
                duration: courses.duration,
                capacity: courses.capacity,
                status: sections.status, // Get status from sections table
                sectionId: sections.id,
                section: sections.number,
                classroom: classrooms.code,
            })
            .from(courses)
            .innerJoin(majors, eq(courses.majorId, majors.id)) // Direct join with majors
            .innerJoin(sections, eq(courses.id, sections.courseId))
            .leftJoin(instructors, eq(sections.instructorId, instructors.id)) // Changed to leftJoin to handle sections without instructors
            .leftJoin(classrooms, eq(sections.classroomId, classrooms.id))
            .innerJoin(schedules, eq(courses.scheduleId, schedules.id)) as any;

        // Add filter for scheduleId if provided
        if (scheduleId) {
            query = query.where(eq(courses.scheduleId, parseInt(scheduleId)));
        }

        const allCourses = await query;
        return NextResponse.json(allCourses);
    } catch (error: unknown) {
        console.error("Error fetching courses:", error);
        return NextResponse.json(
            { error: "Failed to fetch courses" },
            { status: 500 }
        );
    }
}

// POST - Create a new course (updated to handle section-level status)
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate request data
        const validationResult = courseSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validationResult.error.errors,
                },
                { status: 400 }
            );
        }

        const {
            code,
            title,
            majorsList,
            color,
            duration,
            capacity,
            sectionsList,
            scheduleId,
        } = validationResult.data;

        // Ensure we have exactly one major
        if (!Array.isArray(majorsList) || majorsList.length !== 1) {
            return NextResponse.json(
                { error: "Exactly one major is required" },
                { status: 400 }
            );
        }

        // Get the major name from the array (there's only one element)
        const majorName = majorsList[0];

        // Look up the major ID for the provided major name
        const majorResult = await db
            .select({ id: majors.id })
            .from(majors)
            .where(eq(majors.name, majorName))
            .limit(1);

        if (majorResult.length === 0) {
            return NextResponse.json(
                { error: "Major not found" },
                { status: 404 }
            );
        }

        // Get the major ID
        const majorId = majorResult[0].id;

        const scheduleResult = await db
            .select({ id: schedules.id })
            .from(schedules)
            .where(eq(schedules.id, scheduleId))
            .limit(1);

        if (scheduleResult.length === 0) {
            return NextResponse.json(
                { error: "Schedule not found" },
                { status: 404 }
            );
        }

        // Insert the course with majorId (removed status from course level)
        const insertCourse = await db.insert(courses).values({
            code: code,
            title: title,
            color: color,
            scheduleId: scheduleResult[0].id,
            majorId: majorId, // Store majorId directly in the course table
            duration: duration,
            capacity: capacity,
        });

        // Get the inserted course ID
        const newCourse = await db.query.courses.findFirst({
            where: and(eq(courses.code, code), eq(courses.title, title)),
            orderBy: desc(courses.id),
        });

        if (!newCourse) {
            return NextResponse.json(
                { error: "Failed to create course" },
                { status: 500 }
            );
        }

        // Array to collect created course sections
        const createdSections = [];

        // Process each section (now includes status)
        for (const sectionData of sectionsList) {
            const { section, instructorId, status } = sectionData;

            // Insert the section with status
            const sectionValues: any = {
                number: section,
                courseId: newCourse.id,
                status: status || "offline", // Default to offline if not provided
            };

            // Add instructor if provided
            if (
                instructorId !== undefined &&
                instructorId !== null &&
                instructorId !== ""
            ) {
                sectionValues.instructorId = parseInt(instructorId);
            }

            await db.insert(sections).values(sectionValues);

            // Fetch the created section data for response
            const sectionDetails = await db
                .select({
                    id: sections.id,
                    number: sections.number,
                    status: sections.status,
                })
                .from(sections)
                .where(
                    and(
                        eq(sections.courseId, newCourse.id),
                        eq(sections.number, section)
                    )
                )
                .limit(1);

            if (sectionDetails.length > 0) {
                createdSections.push(sectionDetails[0]);
            }
        }

        // Return course with sections
        return NextResponse.json({
            message: "Course created successfully",
            course: {
                id: newCourse.id,
                code: newCourse.code,
                title: newCourse.title,
                sections: createdSections,
            },
        });
    } catch (error) {
        console.error("Error creating course:", error);
        return NextResponse.json(
            { error: "Failed to create course" },
            { status: 500 }
        );
    }
}

// PATCH - Update an existing course (updated to handle section-level status)
export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        // Validate request data - using partial schema for updates
        const updateSchema = editCourseSchema.partial();
        const validationResult = updateSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validationResult.error.errors,
                },
                { status: 400 }
            );
        }

        const {
            sectionId,
            code,
            title,
            majorsList,
            color,
            duration,
            capacity,
            sectionsList,
            sectionsToDelete,
        } = validationResult.data;

        if (!sectionId) {
            return NextResponse.json(
                { error: "Section ID is required" },
                { status: 400 }
            );
        }

        // Get the courseId from the sectionId
        const sectionInfo = await db
            .select({ courseId: sections.courseId })
            .from(sections)
            .where(eq(sections.id, sectionId))
            .limit(1);

        if (sectionInfo.length === 0) {
            return NextResponse.json(
                { error: "Section not found" },
                { status: 404 }
            );
        }

        const courseId = sectionInfo[0].courseId;

        // Check if course exists
        const existingCourse = await db.query.courses.findFirst({
            where: eq(courses.id, courseId),
        });

        if (!existingCourse) {
            return NextResponse.json(
                { error: "Course not found" },
                { status: 404 }
            );
        }

        // Prepare the update data (removed status from course level)
        const updateData: Partial<{
            code: string;
            title: string;
            color: string;
            duration: number;
            capacity: number;
            majorId: number;
        }> = {};

        if (code !== undefined) updateData.code = code;
        if (title !== undefined) updateData.title = title;
        if (color !== undefined) updateData.color = color;
        if (duration !== undefined) updateData.duration = duration;
        if (capacity !== undefined) updateData.capacity = capacity;

        // Handle majorsList update if provided - Using the single major
        if (majorsList && majorsList.length === 1) {
            // Get the major name
            const majorName = majorsList[0];

            // Look up the major ID
            const majorResult = await db
                .select({ id: majors.id })
                .from(majors)
                .where(eq(majors.name, majorName))
                .limit(1);

            if (majorResult.length === 0) {
                return NextResponse.json(
                    { error: "Major not found" },
                    { status: 404 }
                );
            }

            // Set the majorId for direct update
            updateData.majorId = majorResult[0].id;
        }

        // Update the course
        if (Object.keys(updateData).length > 0) {
            await db
                .update(courses)
                .set(updateData)
                .where(eq(courses.id, courseId));
        }

        // Handle section updates if provided (now includes status)
        if (sectionsList && sectionsList.length > 0) {
            // Delete all existing sections for this course first
            await db.delete(sections).where(eq(sections.courseId, courseId));

            // Create new sections with updated data
            for (const sectionData of sectionsList) {
                const { section, instructorId, status } = sectionData;

                // Prepare section values
                const sectionValues: any = {
                    number: section,
                    courseId: courseId,
                    status: status || "offline", // Default to offline if not provided
                };

                // Add instructor if provided
                if (
                    instructorId !== undefined &&
                    instructorId !== null &&
                    instructorId !== ""
                ) {
                    sectionValues.instructorId = parseInt(instructorId);
                }

                await db.insert(sections).values(sectionValues);
            }
        }

        // If any sections need to be deleted (this might not be needed since we're recreating all sections)
        if (sectionsToDelete && Array.isArray(sectionsToDelete)) {
            for (const sectionIdToDelete of sectionsToDelete) {
                await db
                    .delete(sections)
                    .where(eq(sections.id, sectionIdToDelete));
            }
        }

        return NextResponse.json({
            message: "Course updated successfully",
        });
    } catch (error) {
        console.error("Error updating course:", error);
        return NextResponse.json(
            { error: "Failed to update course" },
            { status: 500 }
        );
    }
}

// DELETE - Remove a course (unchanged)
export async function DELETE(request: Request) {
    try {
        const body = await request.json();

        // Validate request data
        const validationResult = deleteCourseSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validationResult.error.errors,
                },
                { status: 400 }
            );
        }

        const { sectionId } = validationResult.data;

        // Get the section to find its courseId
        const sectionInfo = await db
            .select({ courseId: sections.courseId })
            .from(sections)
            .where(eq(sections.id, sectionId))
            .limit(1);

        if (sectionInfo.length === 0) {
            return NextResponse.json(
                { error: "Section not found" },
                { status: 404 }
            );
        }

        const courseId = sectionInfo[0].courseId;

        // Check if the course exists
        const existingCourse = await db.query.courses.findFirst({
            where: eq(courses.id, courseId),
        });

        if (!existingCourse) {
            return NextResponse.json(
                { error: "Course not found" },
                { status: 404 }
            );
        }

        // First delete all sections associated with the course
        await db.delete(sections).where(eq(sections.id, sectionId));

        // Check if any sections remain for this course
        const remainingSections = await db
            .select({ id: sections.id })
            .from(sections)
            .where(eq(sections.courseId, courseId));

        // If no sections remain, delete the course
        if (remainingSections.length === 0) {
            // Then delete the course (majorId is now stored directly in the course table)
            await db.delete(courses).where(eq(courses.id, courseId));
        }

        return NextResponse.json({
            message: "Course and associated sections deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting course:", error);
        return NextResponse.json(
            { error: "Failed to delete course" },
            { status: 500 }
        );
    }
}
