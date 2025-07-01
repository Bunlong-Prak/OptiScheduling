import {
    classrooms,
    classroomTypes,
    courseHours,
    courses,
    instructors,
    instructorTimeConstraint,
    instructorTimeConstraintDay,
    instructorTimeConstraintTimeSlot,
    scheduleTimeSlots,
    sections,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// Constants for days
const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];
type InstructorSlot = {
    day: string;
    timeSlot: string;
    instructor_id: number;
    isAvailable: boolean;
    assigned_section_id?: number;
};

type InstructorGrid = Map<string, InstructorSlot>;
// Function to normalize time slot formats
function normalizeTimeSlot(timeSlot: string): string {
    // Handle "8:00 AM - 9:00 AM" format
    if (timeSlot.includes(" - ")) {
        const [startTime, endTime] = timeSlot.split(" - ");
        const normalizedStart = convertToHHMM(startTime.trim());
        const normalizedEnd = convertToHHMM(endTime.trim());
        return `${normalizedStart}-${normalizedEnd}`;
    }

    // If it's already in HH:MM-HH:MM format, return as is
    if (timeSlot.match(/^\d{2}:\d{2}-\d{2}:\d{2}$/)) {
        return timeSlot;
    }

    // Convert single time to HH:MM format
    return convertToHHMM(timeSlot);
}

function convertToHHMM(timeStr: string): string {
    // Remove leading/trailing spaces
    timeStr = timeStr.trim();

    // Handle AM/PM format
    if (timeStr.includes(" AM")) {
        const time = timeStr.replace(" AM", "");
        const [hour, minute] = time.split(":");
        const hourNum = parseInt(hour);
        return `${hourNum.toString().padStart(2, "0")}:${minute || "00"}`;
    } else if (timeStr.includes(" PM")) {
        const time = timeStr.replace(" PM", "");
        const [hour, minute] = time.split(":");
        let hourNum = parseInt(hour);

        // Only add 12 if not already 12 PM
        if (hourNum !== 12) {
            hourNum += 12;
        }

        return `${hourNum.toString().padStart(2, "0")}:${minute || "00"}`;
    }

    // Already in HH:MM or H:MM format, just ensure padding
    if (timeStr.includes(":")) {
        const [hour, minute] = timeStr.split(":");
        return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    }

    // Just a number, treat as hour
    const hourNum = parseInt(timeStr);
    return `${hourNum.toString().padStart(2, "0")}:00`;
}

// Types for our algorithm
type TimeConstraint = {
    instructor_id: number;
    day: string;
    timeSlots: string[];
};

type Course = {
    id: number;
    title: string;
    code: string;
    duration: number;
    sections: {
        id: number;
        number: string;
        instructor_id: number | null; // Keep as nullable since schema allows null
        status?: string | null;
        separatedDurations?: number[];
        courseHoursIds: number[];
        // Remove classroom_id since it's not in the sections table
    }[];
};
type SchedulingUnit = {
    section_id: number;
    section_number: string;
    course: Course;
    instructor_id: number | null; // Allow null
    classroom_id: number | null; // This will be assigned during scheduling
    status?: string | null;
    duration: number;
    separationIndex: number;
    courseHours_id?: number;
};

// UPDATED: Added classroom_id to Assignment type
type Assignment = {
    section_id: number;
    course_code: string;
    course_title: string;
    instructor_name: string;
    day: string;
    start_time: string;
    end_time: string;
    classroom_code: string;
    classroom_id: number;
    courseHours_id?: number;
};

type Slot = {
    day: string;
    timeSlot: string;
    classroom_id: number;
    isAvailable: boolean;
    assigned_section_id?: number;
};

type TransformedScheduleItem = {
    id: number;
    section_id: number;
    course_code: string;
    course_title: string;
    course_color: string;
    instructor_name: string;
    day: string;
    start_time: string;
    end_time: string;
    classroom_code: string;
    classroom_id: number;
    duration: number;
    separated_duration: number;
    section_number: string;
    firstName: string;
    lastName: string;
    title: string;
    code: string;
    isOnline: boolean;
};

type ScheduleGrid = Map<string, Slot>; // Key format: "day-classroom_id-timeSlot"

// POST endpoint to generate the schedule
export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scheduleIdParam = searchParams.get("scheduleId");

        if (!scheduleIdParam) {
            return NextResponse.json(
                { error: "Schedule ID is required" },
                { status: 400 }
            );
        }

        // Validate scheduleId is a number
        const schedule_id = parseInt(scheduleIdParam, 10);
        if (isNaN(schedule_id)) {
            return NextResponse.json(
                { error: "Invalid Schedule ID. Must be a number." },
                { status: 400 }
            );
        }

        // 1. Fetch all the required data
        const coursesData = await fetchCourses(schedule_id);
        const timeConstraints = await fetchTimeConstraints(schedule_id);
        const classroomsData = await fetchClassrooms(schedule_id);
        const instructorsData = await fetchInstructors(schedule_id);

        // Fetch the custom time slots for this schedule
        const timeSlots = await fetchTimeSlots(schedule_id);

        console.log("timeslots: ", timeSlots);
        // 2. Generate the schedule
        const assignments = generateSchedule(
            coursesData,
            timeConstraints,
            classroomsData,
            instructorsData,
            timeSlots
        );

        console.log("Assignments: ", assignments);

        // 3. Store the schedule in the database
        const storageResult = await storeScheduleInDatabase(
            assignments,
            scheduleIdParam
        );

        // 4. Transform assignments to match frontend expectations
        const transformedSchedule = await transformAssignmentsForFrontend(
            assignments,
            coursesData,
            schedule_id
        );

        // 5. Calculate stats
        const stats = calculateScheduleStats(assignments, coursesData);

        // 6. Return the generated schedule with proper format
        return NextResponse.json({
            message: "Schedule generated and stored successfully",
            schedule: transformedSchedule,
            stats: stats,
        });
    } catch (error: unknown) {
        console.error("Error generating schedule:", error);
        const errorMessage =
            error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                error: "Failed to generate schedule",
                details: errorMessage,
            },
            { status: 500 }
        );
    }
}

async function transformAssignmentsForFrontend(
    assignments: Assignment[],
    coursesData: Course[],
    scheduleId: number
) {
    console.log("Transforming assignments for frontend...");

    const transformedSchedule = [];

    for (const assignment of assignments) {
        // Find the course data to get additional information
        const course = coursesData.find(
            (c) => c.code === assignment.course_code
        );
        const section = course?.sections.find(
            (s) => s.id === assignment.section_id
        );

        // Get the course color from the database
        const courseColor = await getCourseColor(course?.id, scheduleId);

        // FIXED: Calculate duration from HH:MM format instead of parseInt
        const [startHour, startMinute] = assignment.start_time
            .split(":")
            .map(Number);
        const [endHour, endMinute] = assignment.end_time.split(":").map(Number);

        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;
        const durationHours = (endTotalMinutes - startTotalMinutes) / 60;

        const transformedItem = {
            id: assignment.section_id, // Use section_id as id
            section_id: assignment.section_id,
            course_code: assignment.course_code,
            course_title: assignment.course_title,
            course_color: courseColor || "",
            instructor_name: assignment.instructor_name,
            day: assignment.day,
            start_time: assignment.start_time,
            end_time: assignment.end_time,
            classroom_code: assignment.classroom_code,
            classroom_id: assignment.classroom_id,
            duration: durationHours, // FIXED: Use calculated duration in hours
            separated_duration: durationHours, // FIXED: Use calculated duration in hours
            // Additional fields that might be needed
            section_number: section?.number || "",
            firstName: assignment.instructor_name.split(" ")[0] || "",
            lastName:
                assignment.instructor_name.split(" ").slice(1).join(" ") || "",
            title: assignment.course_title,
            code: assignment.course_code,
            isOnline: assignment.classroom_id < 0,
        };

        transformedSchedule.push(transformedItem);
    }

    console.log(
        `Transformed ${transformedSchedule.length} assignments for frontend`
    );
    return transformedSchedule;
}

async function getCourseColor(
    courseId: number | undefined,
    scheduleId: number
): Promise<string | null> {
    if (!courseId) return null;

    try {
        const result = await db
            .select({ color: courses.color })
            .from(courses)
            .where(eq(courses.id, courseId))
            .limit(1);

        return result[0]?.color || null;
    } catch (error) {
        console.error("Error fetching course color:", error);
        return null;
    }
}

function calculateScheduleStats(
    assignments: Assignment[],
    coursesData: Course[]
) {
    const totalCourses = coursesData.length;
    const totalSections = coursesData.reduce(
        (sum, course) => sum + course.sections.length,
        0
    );
    const scheduledAssignments = assignments.length;

    // Count constraints applied (this is a simplified calculation)
    const constraintsApplied = assignments.filter(
        (a) => a.instructor_name !== "Unknown"
    ).length;

    return {
        totalCourses,
        totalSections,
        scheduledAssignments,
        constraintsApplied,
    };
}

// Fetch time slots for a given schedule
async function fetchTimeSlots(schedule_id: number): Promise<string[]> {
    try {
        console.log(`Fetching time slots for schedule_id: ${schedule_id}`);

        const timeSlotData = await db
            .select({
                start_time: scheduleTimeSlots.startTime,
                end_time: scheduleTimeSlots.endTime,
            })
            .from(scheduleTimeSlots)
            .where(eq(scheduleTimeSlots.scheduleId, schedule_id));

        if (!timeSlotData || timeSlotData.length === 0) {
            console.log("No time slots found, using default time slots");
            return [
                "08:00-09:00",
                "09:00-10:00",
                "10:00-11:00",
                "11:00-12:00",
                "12:00-13:00",
                "13:00-14:00",
                "14:00-15:00",
                "15:00-16:00",
                "16:00-17:00",
                "17:00-18:00",
            ];
        }

        // Format as "HH:MM-HH:MM"
        const timeSlots = timeSlotData.map((slot) => {
            const startTime = slot.start_time.padStart(5, "0"); // Ensure HH:MM format
            const endTime = slot.end_time.padStart(5, "0"); // Ensure HH:MM format
            return `${startTime}-${endTime}`;
        });

        console.log(
            `Found ${
                timeSlots.length
            } time slots for schedule ${schedule_id}: ${timeSlots.join(", ")}`
        );
        return timeSlots;
    } catch (error) {
        console.error("Error fetching time slots:", error);
        throw new Error(
            `Failed to fetch time slots: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

// Fetch all courses with their sections for a given schedule_id
async function fetchCourses(schedule_id: number): Promise<Course[]> {
    try {
        console.log(`Fetching courses for schedule_id: ${schedule_id}`);

        // Fetch courses
        const coursesData = await db
            .select({
                id: courses.id,
                title: courses.title,
                code: courses.code,
                duration: courses.duration,
            })
            .from(courses)
            .where(eq(courses.scheduleId, schedule_id));

        if (coursesData.length === 0) {
            return [];
        }

        const result: Course[] = [];
        for (const course of coursesData) {
            // Get sections for this course - NO classroom_id since it's not in schema
            const sectionsData = await db
                .select({
                    id: sections.id,
                    number: sections.number,
                    instructor_id: sections.instructorId,
                    status: sections.status,
                })
                .from(sections)
                .where(eq(sections.courseId, course.id));

            // For each section, get separated durations and courseHours IDs from courseHours table
            const sectionsWithSeparatedDurations = [];
            for (const section of sectionsData) {
                // Fetch separated durations and courseHours IDs from courseHours table for this section
                const courseHoursData = await db
                    .select({
                        id: courseHours.id,
                        separatedDuration: courseHours.separatedDuration,
                    })
                    .from(courseHours)
                    .where(eq(courseHours.sectionId, section.id))
                    .orderBy(courseHours.id);

                let separatedDurations: number[] = [];
                let courseHoursIds: number[] = [];

                if (courseHoursData.length > 0) {
                    courseHoursData.forEach((ch) => {
                        if (
                            ch.separatedDuration !== null &&
                            ch.separatedDuration !== undefined
                        ) {
                            separatedDurations.push(ch.separatedDuration);
                            courseHoursIds.push(ch.id);
                        }
                    });

                    console.log(
                        `Found ${
                            courseHoursData.length
                        } courseHours records for section ${
                            section.number
                        }: durations [${separatedDurations.join(
                            ", "
                        )}] with IDs [${courseHoursIds.join(", ")}]`
                    );
                }

                // If no separated durations found in courseHours, use the full course duration
                if (separatedDurations.length === 0) {
                    separatedDurations = [course.duration];
                    console.log(
                        `No separated durations found for section ${section.number}, using full duration: ${course.duration}`
                    );
                }

                sectionsWithSeparatedDurations.push({
                    ...section,
                    separatedDurations: separatedDurations,
                    courseHoursIds: courseHoursIds,
                });
            }

            if (sectionsWithSeparatedDurations.length > 0) {
                result.push({
                    ...course,
                    sections: sectionsWithSeparatedDurations,
                });
            }
        }

        console.log(
            `Fetched ${result.length} courses with separated duration information`
        );
        return result;
    } catch (error) {
        console.error("Error fetching courses:", error);
        throw error;
    }
}

// Fetch all instructors
async function fetchInstructors(schedule_id: number) {
    try {
        console.log(`Fetching instructors for schedule_id: ${schedule_id}`);

        const result = await db
            .select({
                id: instructors.id,
                first_name: instructors.firstName,
                last_name: instructors.lastName,
            })
            .from(instructors)
            .where(eq(instructors.scheduleId, schedule_id));

        console.log(`Found ${result.length} instructors`);
        return result;
    } catch (error) {
        console.error("Error fetching instructors:", error);
        throw new Error(
            `Failed to fetch instructors: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

// Fetch all time constraints
async function fetchTimeConstraints(
    schedule_id: number
): Promise<TimeConstraint[]> {
    try {
        console.log(
            `Fetching time constraints for schedule_id: ${schedule_id}`
        );
        const constraints: TimeConstraint[] = [];

        const instructorConstraints = await db
            .select({
                id: instructorTimeConstraint.id,
                instructor_id: instructorTimeConstraint.instructorId,
            })
            .from(instructorTimeConstraint)
            .where(eq(instructorTimeConstraint.scheduleId, schedule_id));

        console.log(
            `Found ${instructorConstraints.length} instructor constraints`
        );

        for (const constraint of instructorConstraints) {
            const days = await db
                .select({
                    id: instructorTimeConstraintDay.id,
                    day: instructorTimeConstraintDay.day,
                })
                .from(instructorTimeConstraintDay)
                .where(
                    eq(
                        instructorTimeConstraintDay.instructorTimeConstraintId,
                        constraint.id
                    )
                );

            for (const day of days) {
                const timeSlots = await db
                    .select({
                        time_slot: instructorTimeConstraintTimeSlot.timeSlot,
                    })
                    .from(instructorTimeConstraintTimeSlot)
                    .where(
                        eq(
                            instructorTimeConstraintTimeSlot.instructorTimeConstraintDayId,
                            day.id
                        )
                    );

                if (timeSlots.length > 0) {
                    // Normalize the time slots to match our TIME_SLOTS format
                    const normalizedTimeSlots = timeSlots.map((ts) =>
                        normalizeTimeSlot(ts.time_slot)
                    );

                    constraints.push({
                        instructor_id: constraint.instructor_id,
                        day: day.day,
                        timeSlots: normalizedTimeSlots,
                    });

                    console.log(
                        `Added constraint for instructor ${constraint.instructor_id} on ${day.day} with ${timeSlots.length} time slots`
                    );
                    console.log(
                        `Original time slots: ${timeSlots
                            .map((ts) => ts.time_slot)
                            .join(", ")}`
                    );
                    console.log(
                        `Normalized time slots: ${normalizedTimeSlots.join(
                            ", "
                        )}`
                    );
                }
            }
        }

        console.log(`Returning ${constraints.length} total time constraints`);
        return constraints;
    } catch (error) {
        console.error("Error fetching time constraints:", error);
        throw new Error(
            `Failed to fetch time constraints: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

// Fetch all classrooms
async function fetchClassrooms(schedule_id: number) {
    try {
        // In a real system, you might filter classrooms by schedule_id as well
        const result = await db
            .select({
                id: classrooms.id,
                code: classrooms.code,
                capacity: classrooms.capacity,
            })
            .from(classrooms)
            .innerJoin(
                classroomTypes,
                eq(classrooms.classroomTypeId, classroomTypes.id)
            )
            .where(eq(classroomTypes.scheduleId, schedule_id));

        if (!result || result.length === 0) {
            console.log("No classrooms found in the database");
        } else {
            console.log(`Found ${result.length} classrooms`);
        }

        return result;
    } catch (error) {
        console.error("Error fetching classrooms:", error);
        throw new Error(
            `Failed to fetch classrooms: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

function validateSeparatedDurations(
    separatedDurations: number[],
    totalDuration: number,
    sectionNumber: string
): boolean {
    const sum = separatedDurations.reduce((acc, duration) => acc + duration, 0);

    if (sum !== totalDuration) {
        console.warn(
            `Warning: Separated durations [${separatedDurations.join(
                ", "
            )}] for section ${sectionNumber} sum to ${sum} but course total duration is ${totalDuration}`
        );
        return false;
    }

    return true;
}
function createSchedulingUnits(coursesData: Course[]): SchedulingUnit[] {
    const schedulingUnits: SchedulingUnit[] = [];

    for (const course of coursesData) {
        for (const section of course.sections) {
            const separatedDurations = section.separatedDurations || [
                course.duration,
            ];
            const courseHoursIds = section.courseHoursIds || [];

            // Validate that separated durations sum to total course duration
            if (
                section.separatedDurations &&
                section.separatedDurations.length > 1
            ) {
                const isValid = validateSeparatedDurations(
                    separatedDurations,
                    course.duration,
                    section.number
                );

                if (!isValid) {
                    console.warn(
                        `Using separated durations anyway for section ${
                            section.number
                        }: [${separatedDurations.join(", ")}]`
                    );
                }
            }

            console.log(
                `Creating ${
                    separatedDurations.length
                } scheduling units for section ${section.number} (${
                    course.code
                }): [${separatedDurations.join(", ")}] hours`
            );

            // Create a scheduling unit for each separated duration
            separatedDurations.forEach((duration, index) => {
                schedulingUnits.push({
                    section_id: section.id,
                    section_number: section.number,
                    course: course,
                    instructor_id: section.instructor_id, // Keep as nullable
                    classroom_id: null, // Will be assigned during scheduling
                    status: section.status,
                    duration: duration,
                    separationIndex: index,
                    courseHours_id: courseHoursIds[index] || undefined,
                });

                console.log(
                    `  - Unit ${index + 1}: ${duration} hour(s) for section ${
                        section.number
                    } (courseHours_id: ${courseHoursIds[index] || "new"})`
                );
            });
        }
    }

    console.log(
        `Created ${schedulingUnits.length} total scheduling units from ${coursesData.length} courses`
    );
    return schedulingUnits;
}
// UPDATED: Modified to include classroom_id in the Assignment object
function scheduleSchedulingUnit(
    unit: SchedulingUnit,
    timeConstraints: TimeConstraint[],
    classroomsData: any[],
    instructorsData: any[],
    timeSlots: string[],
    scheduleGrid: ScheduleGrid,
    instructorGrid: InstructorGrid
): Assignment | null {
    const duration = unit.duration;

    // Handle null instructor_id
    if (!unit.instructor_id) {
        console.log(
            `Section ${unit.section_number} has no assigned instructor`
        );
        // You might want to skip this or assign a default instructor
        return null;
    }

    // Get instructor info
    const instructor = instructorsData.find(
        (inst) => inst.id === unit.instructor_id
    );
    const instructorName = instructor
        ? `${instructor.first_name} ${instructor.last_name}`
        : "Unknown";

    // Step 1: Assign classroom if not already assigned
    if (!unit.classroom_id) {
        unit.classroom_id = assignClassroomToSection(unit, classroomsData);
    }

    if (!unit.classroom_id) {
        console.log(
            `Failed to assign classroom to scheduling unit ${
                unit.section_number
            } part ${unit.separationIndex + 1}`
        );
        return null;
    }

    // Get classroom info
    const classroom = classroomsData.find(
        (cls) => cls.id === unit.classroom_id
    );
    const classroomCode = classroom
        ? classroom.code
        : unit.classroom_id === -1
        ? "Online"
        : unit.classroom_id === -2
        ? "Online"
        : unit.classroom_id === -3
        ? "Online"
        : "Unknown";

    // Get instructor constraints
    const instructorConstraints = timeConstraints.filter(
        (constraint) => constraint.instructor_id === unit.instructor_id
    );

    // Find possible time slot combinations that fit the duration
    const possibleSlots = findPossibleTimeSlots(timeSlots, duration);
    console.log(
        `Found ${possibleSlots.length} possible time slot combinations for duration ${duration}`
    );

    // Try to schedule on each day
    const availableDays = [...DAYS];
    shuffleArray(availableDays);

    for (const day of availableDays) {
        console.log(`Trying to schedule on ${day}`);

        // Check if instructor is available on this day
        const dayConstraints = instructorConstraints.filter(
            (constraint) => constraint.day === day
        );

        // Shuffle possible slots for each day to ensure random selection
        const randomizedSlots = [...possibleSlots];
        shuffleArray(randomizedSlots);

        // If instructor has constraints for this day, check availability
        if (dayConstraints.length > 0) {
            const availableTimeSlots = dayConstraints[0].timeSlots;

            // Find a suitable time slot combination from randomized slots
            for (const slotCombination of randomizedSlots) {
                if (
                    canScheduleAtTime(
                        day,
                        slotCombination,
                        unit.classroom_id!,
                        unit.instructor_id,
                        scheduleGrid,
                        instructorGrid,
                        availableTimeSlots
                    )
                ) {
                    // Mark both classroom and instructor slots as occupied
                    markSlotsAsOccupied(
                        day,
                        slotCombination,
                        unit.classroom_id!,
                        unit.instructor_id,
                        unit.section_id,
                        scheduleGrid,
                        instructorGrid
                    );

                    const startTime = getStartTime(slotCombination);
                    const endTime = getEndTime(slotCombination);

                    return {
                        section_id: unit.section_id,
                        course_code: unit.course.code,
                        course_title: unit.course.title,
                        instructor_name: instructorName,
                        day: day,
                        start_time: startTime,
                        end_time: endTime,
                        classroom_code: classroomCode,
                        classroom_id: unit.classroom_id!,
                        courseHours_id: unit.courseHours_id,
                    };
                }
            }
        } else {
            // No constraints for this instructor on this day, try any available slot from randomized slots
            for (const slotCombination of randomizedSlots) {
                if (
                    canScheduleAtTime(
                        day,
                        slotCombination,
                        unit.classroom_id!,
                        unit.instructor_id,
                        scheduleGrid,
                        instructorGrid
                    )
                ) {
                    // Mark both classroom and instructor slots as occupied
                    markSlotsAsOccupied(
                        day,
                        slotCombination,
                        unit.classroom_id!,
                        unit.instructor_id,
                        unit.section_id,
                        scheduleGrid,
                        instructorGrid
                    );

                    const startTime = getStartTime(slotCombination);
                    const endTime = getEndTime(slotCombination);

                    return {
                        section_id: unit.section_id,
                        course_code: unit.course.code,
                        course_title: unit.course.title,
                        instructor_name: instructorName,
                        day: day,
                        start_time: startTime,
                        end_time: endTime,
                        classroom_code: classroomCode,
                        classroom_id: unit.classroom_id!,
                        courseHours_id: unit.courseHours_id,
                    };
                }
            }
        }
    }

    console.log(
        `Could not find available time slot for scheduling unit ${
            unit.section_number
        } part ${unit.separationIndex + 1}`
    );
    return null;
}
// Function to generate schedule automatically
function generateSchedule(
    coursesData: Course[],
    timeConstraints: TimeConstraint[],
    classroomsData: any[],
    instructorsData: any[],
    timeSlots: string[]
): Assignment[] {
    console.log("Starting schedule generation...");

    const assignments: Assignment[] = [];
    const scheduleGrid = initializeScheduleGrid(classroomsData, timeSlots);
    const instructorGrid = initializeInstructorGrid(instructorsData, timeSlots);

    // NEW: Create scheduling units from courses (handles separated durations)
    const schedulingUnits = createSchedulingUnits(coursesData);

    // Sort scheduling units by duration (longest first) for better scheduling
    schedulingUnits.sort((a, b) => b.duration - a.duration);

    console.log(`Processing ${schedulingUnits.length} scheduling units...`);

    for (const unit of schedulingUnits) {
        console.log(
            `\nProcessing scheduling unit: Section ${
                unit.section_number
            } of course ${unit.course.code} (Duration: ${
                unit.duration
            }h, Part ${unit.separationIndex + 1})`
        );

        // Step 1: Assign classroom if not already assigned
        if (!unit.classroom_id) {
            unit.classroom_id = assignClassroomToSection(unit, classroomsData);
        }

        if (!unit.classroom_id) {
            console.log(
                `Failed to assign classroom to scheduling unit ${
                    unit.section_number
                } part ${unit.separationIndex + 1}`
            );
            continue;
        }

        // Step 2: Schedule this unit
        const assignment = scheduleSchedulingUnit(
            unit,
            timeConstraints,
            classroomsData,
            instructorsData,
            timeSlots,
            scheduleGrid,
            instructorGrid
        );

        if (assignment) {
            assignments.push(assignment);
            console.log(
                `Successfully scheduled unit ${unit.section_number} part ${
                    unit.separationIndex + 1
                }`
            );
        } else {
            console.log(
                `Failed to schedule unit ${unit.section_number} part ${
                    unit.separationIndex + 1
                }`
            );
        }
    }

    console.log(
        `Schedule generation completed. Generated ${assignments.length} assignments.`
    );
    return assignments;
}
function initializeInstructorGrid(
    instructorsData: any[],
    timeSlots: string[]
): InstructorGrid {
    const grid = new Map<string, InstructorSlot>();

    for (const instructor of instructorsData) {
        for (const day of DAYS) {
            for (const timeSlot of timeSlots) {
                const key = `${day}-${instructor.id}-${timeSlot}`;
                grid.set(key, {
                    day,
                    timeSlot,
                    instructor_id: instructor.id,
                    isAvailable: true,
                });
            }
        }
    }

    return grid;
}
// Initialize the schedule grid to track availability
function initializeScheduleGrid(
    classroomsData: any[],
    timeSlots: string[]
): ScheduleGrid {
    const grid = new Map<string, Slot>();

    // Add physical classrooms
    for (const classroom of classroomsData) {
        for (const day of DAYS) {
            for (const timeSlot of timeSlots) {
                const key = `${day}-${classroom.id}-${timeSlot}`;
                grid.set(key, {
                    day,
                    timeSlot,
                    classroom_id: classroom.id,
                    isAvailable: true,
                });
            }
        }
    }

    // Add virtual online classrooms with negative IDs
    const onlineClassroomIds = [-1, -2, -3];
    for (const onlineId of onlineClassroomIds) {
        for (const day of DAYS) {
            for (const timeSlot of timeSlots) {
                const key = `${day}-${onlineId}-${timeSlot}`;
                grid.set(key, {
                    day,
                    timeSlot,
                    classroom_id: onlineId,
                    isAvailable: true,
                });
            }
        }
    }

    return grid;
}

function assignClassroomToSection(
    section: any,
    classroomsData: any[]
): number | null {
    console.log(`Assigning classroom to section ${section.number}`);

    // Check if the section is online
    if (section.status === "online") {
        // Randomly assign to one of the 3 online "classrooms" using negative IDs
        const onlineClassroomIds = [-1, -2, -3];
        const randomIndex = Math.floor(
            Math.random() * onlineClassroomIds.length
        );
        console.log(
            `Assigned online section to Online Classroom ${Math.abs(
                onlineClassroomIds[randomIndex]
            )}`
        );
        return onlineClassroomIds[randomIndex];
    }

    // For offline courses, proceed with normal classroom assignment
    const suitableClassrooms = classroomsData.filter(
        (classroom) => classroom.capacity >= (section.course.capacity || 0)
    );

    if (suitableClassrooms.length === 0) {
        console.log("No suitable classrooms found");
        return null;
    }

    const randomIndex = Math.floor(Math.random() * suitableClassrooms.length);
    const assignedClassroom = suitableClassrooms[randomIndex];

    return assignedClassroom.id;
}

// UPDATED: Modified to include classroom_id in the Assignment object
// Schedule a section by finding available time slots
function scheduleSection(
    section: any,
    timeConstraints: TimeConstraint[],
    classroomsData: any[],
    instructorsData: any[],
    timeSlots: string[],
    scheduleGrid: ScheduleGrid,
    instructorGrid: InstructorGrid // NEW: Added instructor grid parameter
): Assignment | null {
    const course = section.course;
    const duration = course.duration;

    // Get instructor info
    const instructor = instructorsData.find(
        (inst) => inst.id === section.instructor_id
    );
    const instructorName = instructor
        ? `${instructor.first_name} ${instructor.last_name}`
        : "Unknown";

    // Get classroom info
    const classroom = classroomsData.find(
        (cls) => cls.id === section.classroom_id
    );
    const classroomCode = classroom
        ? classroom.code
        : section.classroom_id === -1
        ? "Online"
        : section.classroom_id === -2
        ? "Online"
        : section.classroom_id === -3
        ? "Online"
        : "Unknown";

    // Get instructor constraints
    const instructorConstraints = timeConstraints.filter(
        (constraint) => constraint.instructor_id === section.instructor_id
    );

    // Find possible time slot combinations that fit the duration
    const possibleSlots = findPossibleTimeSlots(timeSlots, duration);
    console.log("possible slot", possibleSlots);
    console.log(
        `Found ${possibleSlots.length} possible time slot combinations for duration ${duration}`
    );

    // Try to schedule on each day
    const availableDays = [...DAYS];
    shuffleArray(availableDays);

    for (const day of availableDays) {
        console.log(`Trying to schedule on ${day}`);

        // Check if instructor is available on this day
        const dayConstraints = instructorConstraints.filter(
            (constraint) => constraint.day === day
        );

        // If instructor has constraints for this day, check availability
        if (dayConstraints.length > 0) {
            const availableTimeSlots = dayConstraints[0].timeSlots;

            // Find a suitable time slot combination
            for (const slotCombination of possibleSlots) {
                if (
                    canScheduleAtTime(
                        day,
                        slotCombination,
                        section.classroom_id,
                        section.instructor_id, // NEW: Pass instructor ID
                        scheduleGrid,
                        instructorGrid, // NEW: Pass instructor grid
                        availableTimeSlots
                    )
                ) {
                    // Mark both classroom and instructor slots as occupied
                    markSlotsAsOccupied(
                        day,
                        slotCombination,
                        section.classroom_id,
                        section.instructor_id, // NEW: Pass instructor ID
                        section.id,
                        scheduleGrid,
                        instructorGrid // NEW: Pass instructor grid
                    );

                    const startTime = getStartTime(slotCombination);
                    const endTime = getEndTime(slotCombination);

                    // UPDATED: Include classroom_id in the returned Assignment
                    return {
                        section_id: section.id,
                        course_code: course.code,
                        course_title: course.title,
                        instructor_name: instructorName,
                        day: day,
                        start_time: startTime,
                        end_time: endTime,
                        classroom_code: classroomCode,
                        classroom_id: section.classroom_id, // NEW: Added classroom_id
                    };
                }
            }
        } else {
            // No constraints for this instructor on this day, try any available slot
            for (const slotCombination of possibleSlots) {
                if (
                    canScheduleAtTime(
                        day,
                        slotCombination,
                        section.classroom_id,
                        section.instructor_id, // NEW: Pass instructor ID
                        scheduleGrid,
                        instructorGrid // NEW: Pass instructor grid
                    )
                ) {
                    // Mark both classroom and instructor slots as occupied
                    markSlotsAsOccupied(
                        day,
                        slotCombination,
                        section.classroom_id,
                        section.instructor_id, // NEW: Pass instructor ID
                        section.id,
                        scheduleGrid,
                        instructorGrid // NEW: Pass instructor grid
                    );

                    const startTime = getStartTime(slotCombination);
                    const endTime = getEndTime(slotCombination);

                    // UPDATED: Include classroom_id in the returned Assignment
                    return {
                        section_id: section.id,
                        course_code: course.code,
                        course_title: course.title,
                        instructor_name: instructorName,
                        day: day,
                        start_time: startTime,
                        end_time: endTime,
                        classroom_code: classroomCode,
                        classroom_id: section.classroom_id, // NEW: Added classroom_id
                    };
                }
            }
        }
    }

    console.log(
        `Could not find available time slot for section ${section.number}`
    );
    return null;
}

// Find all possible consecutive time slot combinations for a given duration
function findPossibleTimeSlots(
    timeSlots: string[],
    durationHours: number
): string[][] {
    // Calculate hours per slot dynamically from the first time slot
    const hoursPerSlot = calculateHoursPerSlot(timeSlots[0]);
    const slotsNeeded = Math.ceil(durationHours / hoursPerSlot);

    console.log(
        `Duration: ${durationHours} hours, Hours per slot: ${hoursPerSlot}, Slots needed: ${slotsNeeded}`
    );

    const combinations: string[][] = [];
    for (let i = 0; i <= timeSlots.length - slotsNeeded; i++) {
        const combination = timeSlots.slice(i, i + slotsNeeded);
        combinations.push(combination);
    }

    // FIXED: Shuffle the combinations randomly instead of sorting by time
    shuffleArray(combinations);

    console.log(
        `Generated ${combinations.length} possible time slot combinations (randomized)`
    );
    return combinations;
}
// Helper function to calculate hours per slot from a time slot string
function calculateHoursPerSlot(timeSlot: string): number {
    const [startTime, endTime] = timeSlot.split("-");
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    return (endTotalMinutes - startTotalMinutes) / 60;
}
// Check if a section can be scheduled at a specific time
function canScheduleAtTime(
    day: string,
    slotCombination: string[],
    classroomId: number,
    instructorId: number, // NEW: Added instructor ID parameter
    scheduleGrid: ScheduleGrid,
    instructorGrid: InstructorGrid, // NEW: Added instructor grid parameter
    instructorAvailableSlots?: string[]
): boolean {
    // Check if all required slots are available in the classroom
    for (const timeSlot of slotCombination) {
        // Check classroom availability
        const classroomKey = `${day}-${classroomId}-${timeSlot}`;
        const classroomSlot = scheduleGrid.get(classroomKey);

        if (!classroomSlot || !classroomSlot.isAvailable) {
            console.log(
                `❌ Classroom ${classroomId} not available at ${day} ${timeSlot}`
            );
            return false;
        }

        // NEW: Check instructor availability
        const instructorKey = `${day}-${instructorId}-${timeSlot}`;
        const instructorSlot = instructorGrid.get(instructorKey);

        if (!instructorSlot || !instructorSlot.isAvailable) {
            console.log(
                `❌ Instructor ${instructorId} not available at ${day} ${timeSlot}`
            );
            return false;
        }

        // If instructor has time constraints, check if this slot is in their available slots
        if (
            instructorAvailableSlots &&
            !instructorAvailableSlots.includes(timeSlot)
        ) {
            console.log(
                `❌ Instructor ${instructorId} has time constraint at ${day} ${timeSlot}`
            );
            return false;
        }
    }

    console.log(
        `✅ Both classroom ${classroomId} and instructor ${instructorId} available for ${day} ${slotCombination.join(
            ","
        )}`
    );
    return true;
}

// Mark time slots as occupied
function markSlotsAsOccupied(
    day: string,
    slotCombination: string[],
    classroomId: number,
    instructorId: number, // NEW: Added instructor ID parameter
    sectionId: number,
    scheduleGrid: ScheduleGrid,
    instructorGrid: InstructorGrid // NEW: Added instructor grid parameter
): void {
    for (const timeSlot of slotCombination) {
        // Mark classroom slot as occupied
        const classroomKey = `${day}-${classroomId}-${timeSlot}`;
        const classroomSlot = scheduleGrid.get(classroomKey);

        if (classroomSlot) {
            classroomSlot.isAvailable = false;
            classroomSlot.assigned_section_id = sectionId;
        }

        // NEW: Mark instructor slot as occupied
        const instructorKey = `${day}-${instructorId}-${timeSlot}`;
        const instructorSlot = instructorGrid.get(instructorKey);

        if (instructorSlot) {
            instructorSlot.isAvailable = false;
            instructorSlot.assigned_section_id = sectionId;
            console.log(
                `🔒 Marked instructor ${instructorId} as occupied at ${day} ${timeSlot} for section ${sectionId}`
            );
        }
    }
}

function getStartTime(slotCombination: string[]): string {
    if (slotCombination.length === 0) {
        throw new Error("Slot combination cannot be empty");
    }

    // Extract the start time from the first time slot (HH:MM-HH:MM format)
    const startTime = slotCombination[0].split("-")[0];
    return startTime; // Already in HH:MM format
}

function getEndTime(slotCombination: string[]): string {
    if (slotCombination.length === 0) {
        throw new Error("Slot combination cannot be empty");
    }

    // Extract the end time from the last time slot (HH:MM-HH:MM format)
    const endTime = slotCombination[slotCombination.length - 1].split("-")[1];
    return endTime; // Already in HH:MM format
}
// Utility function to shuffle array
function shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// UPDATED: Modified to include classroom_id in the database insertion
async function insertAndUpdateCourseHours(
    assignments: Assignment[],
    scheduleId: string
): Promise<{
    success: boolean;
    updated: number;
    inserted: number;
    errors: any[];
}> {
    console.log(`Batch updating ${assignments.length} assignments...`);
    try {
        let updatedCount = 0;
        let insertedCount = 0;
        const errors: any[] = [];

        // Process each assignment to update existing course hours
        for (const assignment of assignments) {
            try {
                // Keep the HH:MM format for time slot
                const timeSlotFormat = `${assignment.start_time} - ${assignment.end_time}`;

                // Calculate duration in hours from HH:MM format
                const [startHour, startMinute] = assignment.start_time
                    .split(":")
                    .map(Number);
                const [endHour, endMinute] = assignment.end_time
                    .split(":")
                    .map(Number);

                const startTotalMinutes = startHour * 60 + startMinute;
                const endTotalMinutes = endHour * 60 + endMinute;
                const durationHours =
                    (endTotalMinutes - startTotalMinutes) / 60;

                if (assignment.courseHours_id) {
                    // Update existing courseHours record using the courseHours_id
                    const result = await db
                        .update(courseHours)
                        .set({
                            day: assignment.day,
                            timeSlot: timeSlotFormat,
                            separatedDuration: durationHours,
                            classroomId: assignment.classroom_id,
                        })
                        .where(eq(courseHours.id, assignment.courseHours_id));

                    updatedCount++;

                    console.log(
                        `✅ Updated courseHours ID ${assignment.courseHours_id} for section ${assignment.section_id}: ${assignment.day} ${timeSlotFormat} (${durationHours}h, Classroom: ${assignment.classroom_id})`
                    );
                } else {
                    // Insert new courseHours record if no ID exists
                    const insertResult = await db.insert(courseHours).values({
                        day: assignment.day,
                        timeSlot: timeSlotFormat,
                        separatedDuration: durationHours,
                        classroomId: assignment.classroom_id,
                        sectionId: assignment.section_id,
                    });

                    insertedCount++;

                    console.log(
                        `✅ Inserted new courseHours for section ${assignment.section_id}: ${assignment.day} ${timeSlotFormat} (${durationHours}h, Classroom: ${assignment.classroom_id})`
                    );
                }
            } catch (error) {
                console.error(
                    `❌ Error processing section ${assignment.section_id}:`,
                    error
                );
                errors.push({
                    sectionId: assignment.section_id,
                    courseHoursId: assignment.courseHours_id,
                    error:
                        error instanceof Error ? error.message : String(error),
                });
            }
        }

        console.log(
            `✅ Batch operation completed. Updated: ${updatedCount}, Inserted: ${insertedCount} course hours`
        );

        return {
            success: errors.length === 0,
            updated: updatedCount,
            inserted: insertedCount,
            errors: errors,
        };
    } catch (error) {
        console.error("❌ Error in batch operation:", error);
        return {
            success: false,
            updated: 0,
            inserted: 0,
            errors: [
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
            ],
        };
    }
}

// Replace your original storeScheduleInDatabase function with this
async function storeScheduleInDatabase(
    assignments: Assignment[],
    scheduleId: string
): Promise<{
    success: boolean;
    updated: number;
    inserted: number;
    errors: any[];
}> {
    return await insertAndUpdateCourseHours(assignments, scheduleId);
}
