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
    classroom: z.string().min(1, { message: "Classroom is required" }),
});

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
    // Major: Required
    major: z.string().min(1, { message: "Major is required" }),
    // Color: Required
    color: z.string().min(1, { message: "Color is required" }),
    // Instructor: Required - now clearly defined as ID
    instructor: z.string().min(1, { message: "Instructor ID is required" }),
    // Duration: Required
    duration: z.number().min(1, { message: "Duration is required" }),
    // Capacity: Required
    capacity: z.number().min(1, { message: "Capacity is required" }),
    // Sections array: Required, at least one section
    sectionClassroom: z
        .array(sectionSchema)
        .min(1, { message: "At least one section/classroom is required" }),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
    }),
});

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
    // Major: Required
    major: z.string().min(1, { message: "Major is required" }),
    // Color: Required
    color: z.string().min(1, { message: "Color is required" }),
    // Instructor: Required - now clearly defined as ID
    instructor: z.string().min(1, { message: "Instructor ID is required" }),
    // Duration: Required
    duration: z.number().min(1, { message: "Duration is required" }),
    // Capacity: Required
    capacity: z.number().min(1, { message: "Capacity is required" }),
    // Sections array: Required, at least one section
    sectionClassroom: z
        .array(sectionSchema)
        .min(1, { message: "At least one section/classroom is required" }),
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

        // Base query
        let query = db
            .select({
                id: courses.id,
                title: courses.title,
                code: courses.code,
                major: majors.name,
                color: courses.color,
                firstName: instructors.firstName,
                lastName: instructors.lastName,
                instructorId: instructors.id, // Include instructor ID
                duration: courses.duration,
                capacity: courses.capacity,
                sectionId: sections.id,
                section: sections.number,
                classroom: classrooms.code,
            })
            .from(courses)
            .innerJoin(majors, eq(courses.majorId, majors.id))
            .innerJoin(instructors, eq(courses.instructorId, instructors.id))
            .innerJoin(sections, eq(courses.id, sections.courseId))
            .innerJoin(classrooms, eq(sections.classroomId, classrooms.id))
            .innerJoin(schedules, eq(courses.scheduleId, schedules.id)) as any; // Explicitly cast to any to allow mutation

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
            major,
            color,
            instructor,
            duration,
            capacity,
            sectionClassroom,
            scheduleId,
        } = validationResult.data;

        // Look up the major ID
        const majorResult = await db
            .select({ id: majors.id })
            .from(majors)
            .where(eq(majors.name, major))
            .limit(1);

        if (majorResult.length === 0) {
            return NextResponse.json(
                { error: "Major not found" },
                { status: 404 }
            );
        }

        // Use instructor directly as the ID (since frontend now sends ID)
        const instructorResult = await db
            .select({ id: instructors.id })
            .from(instructors)
            .where(eq(instructors.id, parseInt(instructor))) // Convert string ID to number
            .limit(1);

        if (instructorResult.length === 0) {
            return NextResponse.json(
                { error: "Instructor not found" },
                { status: 404 }
            );
        }

        const scheduleResult = await db
            .select({ id: schedules.id })
            .from(schedules)
            .where(eq(schedules.id, scheduleId))
            .limit(1);

        // Insert the course without using returning()
        const coursess = await db.insert(courses).values({
            code: code,
            title: title,
            majorId: majorResult[0].id,
            color: color,
            scheduleId: scheduleResult[0].id,
            instructorId: instructorResult[0].id,
            duration: duration,
            capacity: capacity,
        });
        console.log("Inserted course:", coursess);
        // Get the inserted course ID
        const newCourse = await db.query.courses.findFirst({
            where: and(
                eq(courses.code, code),
                eq(courses.title, title),
                eq(courses.majorId, majorResult[0].id),
                eq(courses.instructorId, instructorResult[0].id)
            ),
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

        // Process each section and classroom
        for (const sectionData of sectionClassroom) {
            const { section, classroom } = sectionData;

            // Look up the classroom ID for this section
            const classroomResult = await db
                .select({ id: classrooms.id })
                .from(classrooms)
                .where(eq(classrooms.code, classroom))
                .limit(1);

            if (classroomResult.length === 0) {
                // Log error but continue with other sections
                console.error(
                    `Classroom ${classroom} not found for section ${section}`
                );
                continue;
            }

            // Insert the section
            await db.insert(sections).values({
                number: section,
                courseId: newCourse.id,
                classroomId: classroomResult[0].id,
            });

            // Fetch the created section data for response
            const sectionDetails = await db
                .select({
                    id: sections.id,
                    number: sections.number,
                    classroom: classrooms.code,
                })
                .from(sections)
                .innerJoin(classrooms, eq(sections.classroomId, classrooms.id))
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

        // Fetch the complete course with basic info (without sections)
        const createdCourse = await db
            .select({
                id: courses.id,
                title: courses.title,
                code: courses.code,
                major: majors.name,
                color: courses.color,
                firstName: instructors.firstName,
                lastName: instructors.lastName,
                instructorId: instructors.id, // Include instructor ID
                duration: courses.duration,
                capacity: courses.capacity,
            })
            .from(courses)
            .innerJoin(majors, eq(courses.majorId, majors.id))
            .innerJoin(instructors, eq(courses.instructorId, instructors.id))
            .where(eq(courses.id, newCourse.id))
            .limit(1);

        // Return course with sections
        return NextResponse.json({
            message: "Course created successfully",
            course: {
                ...createdCourse[0],
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
            major,
            color,
            instructor,
            duration,
            capacity,
            sectionClassroom,
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
            majorId: number;
            instructorId: number;
        }> = {};

        if (code !== undefined) updateData.code = code;
        if (title !== undefined) updateData.title = title;
        if (color !== undefined) updateData.color = color;
        if (duration !== undefined) updateData.duration = duration;
        if (capacity !== undefined) updateData.capacity = capacity;

        // Handle major update if provided
        if (major !== undefined) {
            const majorResult = await db
                .select({ id: majors.id })
                .from(majors)
                .where(eq(majors.name, major))
                .limit(1);

            if (majorResult.length === 0) {
                return NextResponse.json(
                    { error: "Major not found" },
                    { status: 404 }
                );
            }

            updateData.majorId = majorResult[0].id;
        }

        // Handle instructor update if provided
        if (instructor !== undefined) {
            // Use instructor directly as the ID (since frontend now sends ID)
            const instructorResult = await db
                .select({ id: instructors.id })
                .from(instructors)
                .where(eq(instructors.id, parseInt(instructor))) // Convert string ID to number
                .limit(1);

            if (instructorResult.length === 0) {
                return NextResponse.json(
                    { error: "Instructor not found" },
                    { status: 404 }
                );
            }

            updateData.instructorId = instructorResult[0].id;
        }

        // Update the course
        if (Object.keys(updateData).length > 0) {
            await db
                .update(courses)
                .set(updateData)
                .where(eq(courses.id, courseId));
        }

        // Handle section updates if provided
        if (sectionClassroom && sectionClassroom.length > 0) {
            // Process each section in the request
            for (const sectionData of sectionClassroom) {
                const { section, classroom } = sectionData;

                // Look up the classroom ID for this section
                const classroomResult = await db
                    .select({ id: classrooms.id })
                    .from(classrooms)
                    .where(eq(classrooms.code, classroom))
                    .limit(1);

                if (classroomResult.length === 0) {
                    console.error(
                        `Classroom ${classroom} not found for section ${section}`
                    );
                    continue;
                }

                // Update the section that was specified in the request
                await db
                    .update(sections)
                    .set({
                        number: section,
                        classroomId: classroomResult[0].id,
                    })
                    .where(eq(sections.id, sectionId));
            }
        }

        // If any additional sections need to be created
        if (body.additionalSections && Array.isArray(body.additionalSections)) {
            for (const sectionData of body.additionalSections) {
                const { section, classroom } = sectionData;

                // Look up the classroom ID
                const classroomResult = await db
                    .select({ id: classrooms.id })
                    .from(classrooms)
                    .where(eq(classrooms.code, classroom))
                    .limit(1);

                if (classroomResult.length === 0) {
                    console.error(
                        `Classroom ${classroom} not found for new section ${section}`
                    );
                    continue;
                }

                // Create new section
                await db.insert(sections).values({
                    number: section,
                    courseHoursId: 1, // Using 1 as requested
                    courseId: courseId,
                    classroomId: classroomResult[0].id,
                });
            }
        }

        // If any sections need to be deleted
        if (body.sectionsToDelete && Array.isArray(body.sectionsToDelete)) {
            for (const sectionIdToDelete of body.sectionsToDelete) {
                await db
                    .delete(sections)
                    .where(eq(sections.id, sectionIdToDelete));
            }
        }

        // Fetch the updated course with its sections
        const updatedCourse = await db
            .select({
                id: courses.id,
                title: courses.title,
                code: courses.code,
                major: majors.name,
                color: courses.color,
                firstName: instructors.firstName,
                lastName: instructors.lastName,
                instructorId: instructors.id, // Include instructor ID
                duration: courses.duration,
                capacity: courses.capacity,
            })
            .from(courses)
            .innerJoin(majors, eq(courses.majorId, majors.id))
            .innerJoin(instructors, eq(courses.instructorId, instructors.id))
            .where(eq(courses.id, courseId))
            .limit(1);

        const updatedSections = await db
            .select({
                id: sections.id,
                number: sections.number,
                classroom: classrooms.code,
            })
            .from(sections)
            .innerJoin(classrooms, eq(sections.classroomId, classrooms.id))
            .where(eq(sections.courseId, courseId));

        return NextResponse.json({
            message: "Course updated successfully",
            course: {
                ...updatedCourse[0],
                sections: updatedSections,
            },
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

        const allSections = await db.select({ id: sections.id }).from(sections);
        // Then delete the course itself
        if (allSections.length === 1)
            await db.delete(courses).where(eq(courses.id, courseId));

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
