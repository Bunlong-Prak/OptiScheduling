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
    // Instructor: Required
    instructor: z.string().min(1, { message: "Instructor is required" }),
    // Duration: Required
    duration: z.number().min(1, { message: "Duration is required" }),
    // Capacity: Required
    capacity: z.number().min(1, { message: "Capacity is required" }),
    // Sections array: Required, at least one section
    sectionClassroom: z
        .array(sectionSchema)
        .min(1, { message: "At least one section/classroom is required" }),
});

// GET all courses
export async function GET() {
    try {
        const allCourses = await db
            .select({
                title: courses.title,
                code: courses.code,
                major: majors.name,
                color: courses.color,
                firstName: instructors.firstName,
                lastName: instructors.lastName,
                duration: courses.duration,
                section: sections.number,
                classroom: classrooms.code,
            })
            .from(courses)
            .innerJoin(majors, eq(courses.majorId, majors.id))
            .innerJoin(instructors, eq(courses.instructorId, instructors.id))
            .innerJoin(sections, eq(courses.id, sections.courseId))
            .innerJoin(classrooms, eq(sections.classroomId, classrooms.id));
        return NextResponse.json(allCourses);
    } catch (error: unknown) {
        console.error("Error fetching courses:", error);
        return NextResponse.json(
            { error: "Failed to fetch courses" },
            { status: 500 }
        );
    }
}

// POST new course
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
        } = validationResult.data;

        const nameParts = instructor.split(" ");
        let firstName = "";
        let lastName = "";
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
        if (nameParts.length >= 2) {
            // Last part is the last name
            lastName = nameParts[nameParts.length - 1];
            // Everything before the last part is the first name
            firstName = nameParts.slice(0, nameParts.length - 1).join(" ");
        } else {
            // If there's only one part, assume it's the last name
            lastName = instructor;
        }

        // Look up the instructor ID
        const instructorResult = await db
            .select({ id: instructors.id })
            .from(instructors)
            .where(eq(instructors.lastName, lastName))
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
            .where(eq(schedules.id, 1))
            .limit(1);

        if (scheduleResult.length === 0) {
            // Create a default schedule
            await db.insert(schedules).values({
                id: 1,
                name: "Default Schedule",
                academicYear: "2023-2024",
                userId: "1",
                // Add other required fields
            });
        }
        // Insert the course without using returning()
        const coursess = await db.insert(courses).values({
            code: code,
            title: title,
            majorId: majorResult[0].id,
            color: color,
            scheduleId: 1,
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
                courseHoursId: 1,
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
export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        // Get course ID from params
        const courseId = params.id;

        // Parse the request body
        const body = await request.json();

        // Validate the input using a partial schema to allow updates to only some fields
        const partialSchema = courseSchema.partial();
        const validatedData = partialSchema.parse(body);

        // Begin transaction to handle related tables
        return await db.transaction(async (tx) => {
            // Check if course exists
            const existingCourse = await tx
                .select({ id: courses.id })
                .from(courses)
                .where(eq(courses.id, parseInt(courseId)))
                .limit(1);

            if (existingCourse.length === 0) {
                return NextResponse.json(
                    { error: "Course not found" },
                    { status: 404 }
                );
            }

            // Prepare update data for course table
            const courseUpdate: any = {};

            // Add fields to update
            if (validatedData.code) courseUpdate.code = validatedData.code;
            if (validatedData.title) courseUpdate.title = validatedData.title;
            if (validatedData.color) courseUpdate.color = validatedData.color;
            if (validatedData.duration)
                courseUpdate.duration = validatedData.duration;

            // Handle foreign key updates
            if (validatedData.major) {
                const majorResult = await tx
                    .select({ id: majors.id })
                    .from(majors)
                    .where(eq(majors.name, validatedData.major))
                    .limit(1);

                if (majorResult.length === 0) {
                    return NextResponse.json(
                        { error: "Major not found" },
                        { status: 404 }
                    );
                }

                courseUpdate.majorId = majorResult[0].id;
            }

            if (validatedData.instructor) {
                const instructorResult = await tx
                    .select({ id: instructors.id })
                    .from(instructors)
                    .where(eq(instructors.lastName, validatedData.instructor))
                    .limit(1);

                if (instructorResult.length === 0) {
                    return NextResponse.json(
                        { error: "Instructor not found" },
                        { status: 404 }
                    );
                }

                courseUpdate.instructorId = instructorResult[0].id;
            }

            // Update the course if there are fields to update
            if (Object.keys(courseUpdate).length > 0) {
                await tx
                    .update(courses)
                    .set(courseUpdate)
                    .where(eq(courses.id, parseInt(courseId)));
            }

            // Handle section update if needed
            if (validatedData.section || validatedData.classroom) {
                // Get current section
                const currentSection = await tx
                    .select({ id: sections.id })
                    .from(sections)
                    .where(eq(sections.courseId, parseInt(courseId)))
                    .limit(1);

                if (currentSection.length > 0) {
                    const sectionUpdate: any = {};

                    if (validatedData.section) {
                        sectionUpdate.number = validatedData.section;
                    }

                    if (validatedData.classroom) {
                        const classroomResult = await tx
                            .select({ id: classrooms.id })
                            .from(classrooms)
                            .where(eq(classrooms.code, validatedData.classroom))
                            .limit(1);

                        if (classroomResult.length === 0) {
                            return NextResponse.json(
                                { error: "Classroom not found" },
                                { status: 404 }
                            );
                        }

                        sectionUpdate.classroomId = classroomResult[0].id;
                    }

                    // Update section if there are fields to update
                    if (Object.keys(sectionUpdate).length > 0) {
                        await tx
                            .update(sections)
                            .set(sectionUpdate)
                            .where(eq(sections.id, currentSection[0].id));
                    }
                }
            }

            // Fetch the updated course with joins to return
            const updatedCourse = await tx
                .select({
                    id: courses.id,
                    title: courses.title,
                    code: courses.code,
                    major: majors.name,
                    color: courses.color,
                    firstName: instructors.firstName,
                    lastName: instructors.lastName,
                    duration: courses.duration,
                    section: sections.number,
                    classroom: classrooms.code,
                })
                .from(courses)
                .innerJoin(majors, eq(courses.majorId, majors.id))
                .innerJoin(
                    instructors,
                    eq(courses.instructorId, instructors.id)
                )
                .innerJoin(sections, eq(courses.id, sections.courseId))
                .innerJoin(classrooms, eq(sections.classroomId, classrooms.id))
                .where(eq(courses.id, parseInt(courseId)))
                .limit(1);

            return NextResponse.json(updatedCourse[0], { status: 200 });
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }

        console.error("Error updating course:", error);
        return NextResponse.json(
            { error: "Failed to update course" },
            { status: 500 }
        );
    }
}

// DELETE - Remove a course
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        // Get course ID from params
        const courseId = params.id;

        // Begin transaction to handle related tables
        return await db.transaction(async (tx) => {
            // Check if course exists
            const existingCourse = await tx
                .select({ id: courses.id })
                .from(courses)
                .where(eq(courses.id, parseInt(courseId)))
                .limit(1);

            if (existingCourse.length === 0) {
                return NextResponse.json(
                    { error: "Course not found" },
                    { status: 404 }
                );
            }

            // First delete sections as they depend on course
            await tx
                .delete(sections)
                .where(eq(sections.courseId, parseInt(courseId)));

            // Then delete the course
            await tx.delete(courses).where(eq(courses.id, parseInt(courseId)));

            return NextResponse.json(
                { message: "Course deleted successfully" },
                { status: 200 }
            );
        });
    } catch (error) {
        console.error("Error deleting course:", error);
        return NextResponse.json(
            { error: "Failed to delete course" },
            { status: 500 }
        );
    }
}
