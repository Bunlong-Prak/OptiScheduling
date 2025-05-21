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

const sectionSchema = z.object({
    section: z.string().min(1, { message: "Section number is required" }),
    instructorId: z.string().optional(), // Optional instructor ID
});

// Course schema for creating new courses
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
    // Color: Required
    color: z.string().min(1, { message: "Color is required" }),

    duration: z.number().min(1, { message: "Duration is required" }),
    // Capacity: Required
    capacity: z.number().min(1, { message: "Capacity is required" }),
    status: z.string().optional(), // Optional status field
    // Sections array: Required, at least one section
    sectionsList: z
        .array(sectionSchema)
        .min(1, { message: "At least one section is required" }),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
    }),
});

// Schema for editing courses
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
    // Color: Required
    color: z.string().min(1, { message: "Color is required" }),
    // Instructor: Required - now clearly defined as I
    duration: z.number().min(1, { message: "Duration is required" }),
    // Capacity: Required
    capacity: z.number().min(1, { message: "Capacity is required" }),
    status: z.string().optional(), // Optional status field
    // Sections array: Required, at least one section
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

// GET all courses
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");
        // Base query - directly join with majors using majorId in courses
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
                status: courses.status,
                sectionId: sections.id,
                section: sections.number,
                classroom: classrooms.code,
            })
            .from(courses)
            .innerJoin(majors, eq(courses.majorId, majors.id)) // Direct join with majors
            .innerJoin(sections, eq(courses.id, sections.courseId))
            .innerJoin(instructors, eq(sections.instructorId, instructors.id))
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

// POST - Create a new course
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
            status,
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

        // Insert the course with majorId
        const insertCourse = await db.insert(courses).values({
            code: code,
            title: title,
            color: color,
            scheduleId: scheduleResult[0].id,

            majorId: majorId, // Store majorId directly in the course table
            duration: duration,
            capacity: capacity,
            status: status,
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

        // Process each section
        for (const sectionData of sectionsList) {
            const { section, instructorId } = sectionData;

            // Insert the section
            if (instructorId !== undefined) {
                await db.insert(sections).values({
                    number: section,
                    courseId: newCourse.id,
                    instructorId: parseInt(instructorId), // Use the instructor ID directly
                });
            } else {
                console.warn(
                    `Skipping section ${section} due to missing instructorId`
                );
            }

            // Fetch the created section data for response
            const sectionDetails = await db
                .select({
                    id: sections.id,
                    number: sections.number,
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
        });
    } catch (error) {
        console.error("Error creating course:", error);
        return NextResponse.json(
            { error: "Failed to create course" },
            { status: 500 }
        );
    }
}

// PATCH - Update an existing course
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
            status,
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

        // Prepare the update data
        const updateData: Partial<{
            code: string;
            title: string;
            color: string;
            duration: number;
            capacity: number;
            status: string;
            majorId: number;
            instructorId: number;
        }> = {};

        if (code !== undefined) updateData.code = code;
        if (title !== undefined) updateData.title = title;
        if (color !== undefined) updateData.color = color;
        if (duration !== undefined) updateData.duration = duration;
        if (capacity !== undefined) updateData.capacity = capacity;
        if (status !== undefined) updateData.status = status;

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

        // Handle section updates if provided
        if (sectionsList && sectionsList.length > 0) {
            // Get all existing sections for this course
            const existingSections = await db
                .select({ id: sections.id, number: sections.number })
                .from(sections)
                .where(eq(sections.courseId, courseId));

            // Create a map of existing section numbers for quick lookup
            const existingSectionMap = new Map();
            existingSections.forEach((section) => {
                existingSectionMap.set(section.number, section.id);
            });

            // Process each section in the request
            for (const sectionData of sectionsList) {
                const { section, instructorId } = sectionData;

                // Check if section already exists
                if (existingSectionMap.has(section)) {
                    // If the section exists but has a different ID than our primary section ID,
                    // we don't need to do anything as it's already in the database
                    console.log(
                        `Section ${section} already exists, skipping creation`
                    );
                } else {
                    // Convert string ID to number
                    if (instructorId !== undefined) {
                        await db.insert(sections).values({
                            number: section,
                            courseId: courseId,
                            instructorId: parseInt(instructorId), // Use the provided instructor ID or the existing one
                        });
                    } else {
                        // Optionally handle the missing instructorId case here (e.g., throw error or skip)
                        console.warn(
                            `Skipping section ${section} due to missing instructorId`
                        );
                    }
                }
            }
        }

        // If any sections need to be deleted
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

// DELETE - Remove a course
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
