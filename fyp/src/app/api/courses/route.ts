import {
    classrooms,
    classroomTypes,
    courseHours,
    courses,
    instructors,
    majors,
    schedules,
    sections,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import { and, desc, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// Updated section schema to include status and splitDurations
const sectionSchema = z.object({
    section: z.string().min(1, { message: "Section number is required" }),
    instructorId: z
        .string()
        .min(1, { message: "Instructor ID is required" })
        .optional() // Make it optional
        .or(z.literal(null)), // Allow null values
    status: z.enum(["online", "offline"]).default("offline"),
    preferClassRoomType: z
        .object({
            id: z.number().optional(),
            name: z.string().optional(),
            description: z.string().optional().nullable(),
        })
        .optional()
        .nullable(),
    splitDurations: z
        .array(
            z.object({
                separatedDuration: z.number().optional(),
            })
        )
        .optional(),
});

// Updated course schema for creating new courses
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
    duration: z
        .number({ invalid_type_error: "Duration is required" })
        .min(0.01, "Duration must be at least 0.01 hours")
        .max(6, "Cannot exceed 6 hours"),
    // Capacity: Required
    capacity: z
        .number({ invalid_type_error: "Capacity is required" })
        .min(0, "Capacity must be at least 0")
        .max(100, "Capacity cannot exceed 100 students"),
    // Sections array: Required, at least one section (now includes status and splitDurations)
    sectionsList: z
        .array(sectionSchema)
        .min(1, { message: "At least one section is required" }),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
    }),
});

// Updated schema for editing courses
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
    duration: z
        .number({ invalid_type_error: "Duration is required" })
        .min(0.01, "Duration must be at least 0.01 hours")
        .max(6, "Cannot exceed 6 hours"),
    // Capacity: Required
    capacity: z
        .number({ invalid_type_error: "Capacity is required" })
        .min(0, "Capacity must be at least 0")
        .max(100, "Capacity cannot exceed 100 students"),
    // Sections array: Required, at least one section (now includes status and splitDurations)
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

        // Updated query to use courseHours.id as the primary identifier
        let query = db
            .select({
                id: courseHours.id, // Changed to courseHours.id for unique identification
                courseId: courses.id, // Keep course ID for reference
                sectionId: sections.id, // Keep section ID for reference
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
                section: sections.number,
                classroom: classrooms.code,
                separatedDuration: courseHours.separatedDuration, // This is now unique per courseHours.id
                day: courseHours.day, // Include day information
                timeSlot: courseHours.timeSlot, // Include time slot information
                preferClassRoomTypeId: sections.preferClassRoomId,
                preferClassRoomTypeName: classroomTypes.name,
            })
            .from(courseHours) // Start from courseHours to ensure unique records
            .innerJoin(sections, eq(courseHours.sectionId, sections.id))
            .innerJoin(courses, eq(sections.courseId, courses.id))
            .innerJoin(majors, eq(courses.majorId, majors.id)) // Direct join with majors
            .leftJoin(instructors, eq(sections.instructorId, instructors.id)) // leftJoin to handle sections without instructors
            .leftJoin(classrooms, eq(courseHours.classroomId, classrooms.id))
            .innerJoin(schedules, eq(courses.scheduleId, schedules.id))
            .innerJoin(
                classroomTypes,
                eq(classroomTypes.id, sections.preferClassRoomId)
            ) as any;

        // Add filter for scheduleId if provided
        if (scheduleId) {
            query = query.where(eq(courses.scheduleId, parseInt(scheduleId)));
        }

        const allCourseHours = await query;

        // Convert back to array - now each record represents a unique course hour
        const result = Object.values(allCourseHours);

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("Error fetching courses:", error);
        return NextResponse.json(
            { error: "Failed to fetch courses" },
            { status: 500 }
        );
    }
}

// POST - Create a new course (updated to handle courseHours)
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

        // Insert the course with majorId
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

        // Process each section (now includes status and courseHours)
        for (const sectionData of sectionsList) {
            const { section, instructorId, status, splitDurations } =
                sectionData;

            // Insert the section with status
            const sectionValues: any = {
                number: section,
                courseId: newCourse.id,
                status: status || "offline", // Default to offline if not provided
                preferClassRoomId: sectionData.preferClassRoomType?.id || null, // Allow null for no preference
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

            // Fetch the created section to get its ID
            const createdSection = await db
                .select({
                    id: sections.id,
                    number: sections.number,
                    status: sections.status,
                    preferClassRoomId: sections.preferClassRoomId,
                })
                .from(sections)
                .where(
                    and(
                        eq(sections.courseId, newCourse.id),
                        eq(sections.number, section)
                    )
                )
                .orderBy(desc(sections.id))
                .limit(1);

            if (createdSection.length > 0) {
                const newSectionId = createdSection[0].id;
                createdSections.push(createdSection[0]);

                // Insert courseHours if splitDurations are provided
                if (splitDurations && splitDurations.length > 0) {
                    for (const timeSlot of splitDurations) {
                        const { separatedDuration } = timeSlot;

                        // Use separatedDuration if provided, otherwise use course duration
                        const durationToUse =
                            separatedDuration !== undefined
                                ? separatedDuration
                                : duration;

                        await db.insert(courseHours).values({
                            separatedDuration: durationToUse,
                            sectionId: newSectionId,
                        });
                    }
                }
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

// PATCH - Update an existing course (updated to handle courseHours)

export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        // Validate request data
        const validationResult = editCourseSchema.safeParse(body);

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
        } = validationResult.data;

        if (!sectionId) {
            return NextResponse.json(
                { error: "Section ID is required" },
                { status: 400 }
            );
        }

        // Get the courseId from the sectionId
        const sectionInfo = await db
            .select({
                courseId: sections.courseId,
                currentNumber: sections.number,
            })
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

        // STEP 1: Update course-level data (affects ALL sections of this course)
        const courseUpdateData: Partial<{
            code: string;
            title: string;
            color: string;
            duration: number;
            capacity: number;
            majorId: number;
        }> = {};

        if (code !== undefined) courseUpdateData.code = code;
        if (title !== undefined) courseUpdateData.title = title;
        if (color !== undefined) courseUpdateData.color = color;
        if (duration !== undefined) courseUpdateData.duration = duration;
        if (capacity !== undefined) courseUpdateData.capacity = capacity;

        // Handle majorsList update if provided
        if (majorsList && majorsList.length === 1) {
            const majorName = majorsList[0];
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

            courseUpdateData.majorId = majorResult[0].id;
        }

        // Update the course data (affects all sections)
        if (Object.keys(courseUpdateData).length > 0) {
            await db
                .update(courses)
                .set(courseUpdateData)
                .where(eq(courses.id, courseId));
        }

        // STEP 2: Update existing sections and create new sections
        if (sectionsList && sectionsList.length > 0) {
            for (const sectionData of sectionsList) {
                const {
                    section,
                    instructorId,
                    status,
                    splitDurations,
                    preferClassRoomType,
                } = sectionData;

                // Check if section with this number already exists for this course
                const existingSection = await db
                    .select({ id: sections.id })
                    .from(sections)
                    .where(
                        and(
                            eq(sections.courseId, courseId),
                            eq(sections.number, section)
                        )
                    )
                    .limit(1);

                let currentSectionId;

                if (existingSection.length > 0) {
                    // Section exists - update it
                    currentSectionId = existingSection[0].id;

                    const sectionUpdateData: any = {
                        number: section,
                        status: status || "offline",
                        preferClassRoomId: preferClassRoomType?.id || null, // Allow null for no preference
                    };

                    // Handle instructor assignment/removal
                    if (
                        instructorId !== undefined &&
                        instructorId !== null &&
                        instructorId !== ""
                    ) {
                        sectionUpdateData.instructorId = parseInt(instructorId);
                    } else {
                        sectionUpdateData.instructorId = null;
                    }

                    // Update the existing section
                    await db
                        .update(sections)
                        .set(sectionUpdateData)
                        .where(eq(sections.id, currentSectionId));
                } else {
                    // Section doesn't exist - create it
                    const sectionInsertData: any = {
                        number: section,
                        status: status || "offline",
                        courseId: courseId,
                    };

                    // Handle instructor assignment
                    if (
                        instructorId !== undefined &&
                        instructorId !== null &&
                        instructorId !== ""
                    ) {
                        sectionInsertData.instructorId = parseInt(instructorId);
                    }

                    // Insert new section
                    const insertResult = await db
                        .insert(sections)
                        .values(sectionInsertData);

                    currentSectionId = insertResult[0].insertId;
                }

                // STEP 3: Update courseHours for this section
                // Check existing courseHours for this section
                const existingCourseHours = await db
                    .select({ id: courseHours.id })
                    .from(courseHours)
                    .where(eq(courseHours.sectionId, currentSectionId));

                if (splitDurations && splitDurations.length > 0) {
                    // If we have split durations, we need to handle multiple courseHours

                    // If existing courseHours count matches splitDurations count, update them
                    if (existingCourseHours.length === splitDurations.length) {
                        // Update existing courseHours
                        for (let i = 0; i < splitDurations.length; i++) {
                            const timeSlot = splitDurations[i];
                            const { separatedDuration } = timeSlot;

                            const durationToUse =
                                separatedDuration !== undefined
                                    ? separatedDuration
                                    : duration !== undefined
                                    ? duration
                                    : existingCourse.duration;

                            await db
                                .update(courseHours)
                                .set({ separatedDuration: durationToUse })
                                .where(
                                    eq(
                                        courseHours.id,
                                        existingCourseHours[i].id
                                    )
                                );
                        }
                    } else {
                        // Different count - delete all existing and insert new ones
                        await db
                            .delete(courseHours)
                            .where(eq(courseHours.sectionId, currentSectionId));

                        for (const timeSlot of splitDurations) {
                            const { separatedDuration } = timeSlot;

                            const durationToUse =
                                separatedDuration !== undefined
                                    ? separatedDuration
                                    : duration !== undefined
                                    ? duration
                                    : existingCourse.duration;

                            await db.insert(courseHours).values({
                                separatedDuration: durationToUse,
                                sectionId: currentSectionId,
                            });
                        }
                    }
                } else {
                    // No split durations - we want single courseHour
                    const durationToUse =
                        duration !== undefined
                            ? duration
                            : existingCourse.duration;

                    if (existingCourseHours.length === 1) {
                        // Update the existing single courseHour
                        await db
                            .update(courseHours)
                            .set({ separatedDuration: durationToUse })
                            .where(
                                eq(courseHours.id, existingCourseHours[0].id)
                            );
                    } else if (existingCourseHours.length > 1) {
                        // Multiple courseHours exist but we want single - delete all and create one
                        await db
                            .delete(courseHours)
                            .where(eq(courseHours.sectionId, currentSectionId));

                        await db.insert(courseHours).values({
                            separatedDuration: durationToUse,
                            sectionId: currentSectionId,
                        });
                    } else {
                        // No courseHours exist - create one
                        await db.insert(courseHours).values({
                            separatedDuration: durationToUse,
                            sectionId: currentSectionId,
                        });
                    }
                }
            }
        }

        // STEP 4: If course duration changed, update courseHours for ALL OTHER sections
        // (but only if they don't have custom split durations)
        if (duration !== undefined && duration !== existingCourse.duration) {
            // Get all other sections for this course
            const allOtherSections = await db
                .select({ id: sections.id })
                .from(sections)
                .where(
                    and(
                        eq(sections.courseId, courseId),
                        ne(sections.id, sectionId) // Exclude the section we just updated
                    )
                );

            // Update courseHours for other sections that don't have custom splits
            for (const otherSection of allOtherSections) {
                // Check if this section has multiple courseHours (indicating custom splits)
                const courseHoursCount = await db
                    .select({ id: courseHours.id })
                    .from(courseHours)
                    .where(eq(courseHours.sectionId, otherSection.id));

                // If section has only one courseHour, update it to match new course duration
                if (courseHoursCount.length === 1) {
                    await db
                        .update(courseHours)
                        .set({ separatedDuration: duration })
                        .where(eq(courseHours.sectionId, otherSection.id));
                }
                // If section has multiple courseHours (custom splits), leave them unchanged
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
// DELETE - Remove a course (updated to handle courseHours)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get("scheduleId");

        // SCENARIO 1: Handle "Clear All" if scheduleId is provided in the URL
        if (scheduleId) {
            const scheduleIdNum = parseInt(scheduleId);
            if (isNaN(scheduleIdNum)) {
                return NextResponse.json(
                    { error: "Invalid Schedule ID format" },
                    { status: 400 }
                );
            }

            // Get all courses for this schedule
            const coursesToDelete = await db
                .select({ id: courses.id })
                .from(courses)
                .where(eq(courses.scheduleId, scheduleIdNum));

            if (coursesToDelete.length === 0) {
                return NextResponse.json(
                    { message: "No courses to delete" },
                    { status: 200 }
                );
            }

            // Delete courseHours, sections, and courses in the correct order
            for (const course of coursesToDelete) {
                const courseSections = await db
                    .select({ id: sections.id })
                    .from(sections)
                    .where(eq(sections.courseId, course.id));
                for (const section of courseSections) {
                    await db
                        .delete(courseHours)
                        .where(eq(courseHours.sectionId, section.id));
                }
                await db
                    .delete(sections)
                    .where(eq(sections.courseId, course.id));
                await db.delete(courses).where(eq(courses.id, course.id));
            }

            return NextResponse.json({
                message: `Successfully cleared ${coursesToDelete.length} courses`,
            });
        }

        // SCENARIO 2: Handle "Delete One" if sectionId is provided in the body
        const body = await request.json();
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

        // Find the course ID to check for orphans later
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

        // 1. Delete associated courseHours for the section
        await db
            .delete(courseHours)
            .where(eq(courseHours.sectionId, sectionId));

        // 2. Delete the section itself
        await db.delete(sections).where(eq(sections.id, sectionId));

        // 3. Check if the parent course has any remaining sections
        const remainingSections = await db
            .select({ id: sections.id })
            .from(sections)
            .where(eq(sections.courseId, courseId))
            .limit(1);

        // 4. If no sections remain, delete the parent course to prevent orphaned data
        if (remainingSections.length === 0) {
            await db.delete(courses).where(eq(courses.id, courseId));
        }

        return NextResponse.json({
            message: "Course section deleted successfully",
        });
    } catch (error) {
        console.error("Error during DELETE operation:", error);
        // Handle JSON parsing errors if the body is empty for a single-delete attempt
        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: "Invalid request. Missing sectionId in body." },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: "Failed to perform delete operation" },
            { status: 500 }
        );
    }
}
