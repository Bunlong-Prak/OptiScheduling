// File: app/api/generate-schedule/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
    courses,
    instructors,
    sections,
    classrooms,
    instructorTimeConstraint,
    instructorTimeConstraintDay,
    instructorTimeConstraintTimeSlot,
} from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// Constants for days and time slots
const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];
const TIME_SLOTS = [
    "8:00",
    "9:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
];

// Function to normalize time slot formats
function normalizeTimeSlot(timeSlot: string): string {
    // Handle "8:00 AM - 9:00 AM" format
    if (timeSlot.includes(" - ")) {
        // Extract the start time only (we only care about when the slot starts)
        timeSlot = timeSlot.split(" - ")[0];
    }

    // Convert from "8:00 AM" format to "8:00" format
    if (timeSlot.includes(" AM")) {
        return timeSlot.replace(" AM", "");
    } else if (timeSlot.includes(" PM")) {
        // Convert PM times to 24-hour format
        const timeParts = timeSlot.replace(" PM", "").split(":");
        let hour = parseInt(timeParts[0]);

        // Only add 12 if not already in 24-hour format (i.e., not 12 PM)
        if (hour !== 12) {
            hour += 12;
        }

        return `${hour}:${timeParts[1]}`;
    }

    // Already in the right format
    return timeSlot;
}

// Types for our algorithm
type TimeConstraint = {
    instructorId: number;
    day: string;
    timeSlots: string[];
};

type Course = {
    id: number;
    title: string;
    code: string;
    duration: number;
    instructorId: number;
    sections: {
        id: number;
        number: string;
        classroomId: number;
    }[];
};

type Assignment = {
    sectionId: number;
    courseCode: string;
    courseTitle: string;
    instructorName: string;
    day: string;
    startTime: string;
    endTime: string;
    classroomCode: string;
};

type Slot = {
    day: string;
    timeSlot: string;
    classroomId: number;
    isAvailable: boolean;
    assignedSectionId?: number;
};

type ScheduleGrid = Map<string, Slot>; // Key format: "day-classroomId-timeSlot"

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
        const scheduleId = parseInt(scheduleIdParam, 10);
        if (isNaN(scheduleId)) {
            return NextResponse.json(
                { error: "Invalid Schedule ID. Must be a number." },
                { status: 400 }
            );
        }

        // 1. Fetch all the required data
        const coursesData = await fetchCourses(scheduleId);
        const timeConstraints = await fetchTimeConstraints(scheduleId);
        const classroomsData = await fetchClassrooms(scheduleId);
        const instructorsData = await fetchInstructors(scheduleId);

        // 2. Generate the schedule
        const schedule = generateSchedule(
            coursesData,
            timeConstraints,
            classroomsData,
            instructorsData
        );

        // 3. Return the generated schedule (for testing in Postman)
        // In a real implementation, you would save this to the database
        return NextResponse.json({
            message: "Schedule generated successfully",
            schedule: schedule,
            stats: {
                totalCourses: coursesData.length,
                totalSections: coursesData.reduce(
                    (acc, course) => acc + course.sections.length,
                    0
                ),
                scheduledAssignments: schedule.length,
                constraintsApplied: timeConstraints.length,
            },
        });
    } catch (error) {
        console.error("Error generating schedule:", error);
        return NextResponse.json(
            {
                error: "Failed to generate schedule",
                details: error.message || String(error),
            },
            { status: 500 }
        );
    }
}

// Fetch all courses with their sections for a given scheduleId
async function fetchCourses(scheduleId: number): Promise<Course[]> {
    try {
        console.log(`Fetching courses for scheduleId: ${scheduleId}`);

        // Fetch courses
        const coursesData = await db
            .select({
                id: courses.id,
                title: courses.title,
                code: courses.code,
                duration: courses.duration,
                instructorId: courses.instructorId,
            })
            .from(courses)
            .where(eq(courses.scheduleId, scheduleId));

        console.log(
            `Found ${coursesData.length} courses for scheduleId ${scheduleId}`
        );

        if (coursesData.length === 0) {
            console.log("No courses found for this schedule");
            return [];
        }

        // For each course, fetch its sections
        const result: Course[] = [];
        for (const course of coursesData) {
            console.log(
                `Fetching sections for course: ${course.id} (${course.code})`
            );

            const sectionsData = await db
                .select({
                    id: sections.id,
                    number: sections.number,
                    classroomId: sections.classroomId,
                })
                .from(sections)
                .where(eq(sections.courseId, course.id));

            console.log(
                `Found ${sectionsData.length} sections for course ${course.id}`
            );

            // Only add the course if it has at least one section
            if (sectionsData.length > 0) {
                result.push({
                    ...course,
                    sections: sectionsData,
                });
            } else {
                console.log(
                    `Skipping course ${course.id} as it has no sections`
                );
            }
        }

        console.log(`Returning ${result.length} courses with their sections`);
        return result;
    } catch (error) {
        console.error("Error fetching courses:", error);
        throw new Error(`Failed to fetch courses: ${error.message}`);
    }
}

// Fetch all instructors
async function fetchInstructors(scheduleId: number) {
    try {
        console.log(`Fetching instructors for scheduleId: ${scheduleId}`);

        const result = await db
            .select({
                id: instructors.id,
                firstName: instructors.firstName,
                lastName: instructors.lastName,
            })
            .from(instructors)
            .where(eq(instructors.scheduleId, scheduleId));

        console.log(`Found ${result.length} instructors`);
        return result;
    } catch (error) {
        console.error("Error fetching instructors:", error);
        throw new Error(`Failed to fetch instructors: ${error.message}`);
    }
}

// Fetch all time constraints
async function fetchTimeConstraints(
    scheduleId: number
): Promise<TimeConstraint[]> {
    try {
        console.log(`Fetching time constraints for scheduleId: ${scheduleId}`);
        const constraints: TimeConstraint[] = [];

        const instructorConstraints = await db
            .select({
                id: instructorTimeConstraint.id,
                instructorId: instructorTimeConstraint.instructorId,
            })
            .from(instructorTimeConstraint)
            .where(eq(instructorTimeConstraint.scheduleId, scheduleId));

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
                        timeSlot: instructorTimeConstraintTimeSlot.timeSlot,
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
                        normalizeTimeSlot(ts.timeSlot)
                    );

                    constraints.push({
                        instructorId: constraint.instructorId,
                        day: day.day,
                        timeSlots: normalizedTimeSlots,
                    });

                    console.log(
                        `Added constraint for instructor ${constraint.instructorId} on ${day.day} with ${timeSlots.length} time slots`
                    );
                    console.log(
                        `Original time slots: ${timeSlots
                            .map((ts) => ts.timeSlot)
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
        throw new Error(`Failed to fetch time constraints: ${error.message}`);
    }
}

// Fetch all classrooms
async function fetchClassrooms(scheduleId: number) {
    try {
        // In a real system, you might filter classrooms by scheduleId as well
        const result = await db
            .select({
                id: classrooms.id,
                code: classrooms.code,
                capacity: classrooms.capacity,
            })
            .from(classrooms);

        if (!result || result.length === 0) {
            console.log("No classrooms found in the database");
        } else {
            console.log(`Found ${result.length} classrooms`);
        }

        return result;
    } catch (error) {
        console.error("Error fetching classrooms:", error);
        throw new Error(`Failed to fetch classrooms: ${error.message}`);
    }
}

// Generate the schedule
function generateSchedule(
    courses: Course[],
    timeConstraints: TimeConstraint[],
    classrooms: { id: number; code: string; capacity: number }[],
    instructors: { id: number; firstName: string; lastName: string }[]
): Assignment[] {
    // Create a grid of all possible slots
    const grid: ScheduleGrid = new Map();

    // Initialize the grid with all slots marked as available
    for (const day of DAYS) {
        for (const timeSlot of TIME_SLOTS) {
            for (const classroom of classrooms) {
                const key = `${day}-${classroom.id}-${timeSlot}`;
                grid.set(key, {
                    day,
                    timeSlot,
                    classroomId: classroom.id,
                    isAvailable: true,
                });
            }
        }
    }

    // Mark slots as unavailable based on time constraints
    for (const constraint of timeConstraints) {
        for (const timeSlot of constraint.timeSlots) {
            for (const classroom of classrooms) {
                const key = `${constraint.day}-${classroom.id}-${timeSlot}`;
                const slot = grid.get(key);
                if (slot) {
                    slot.isAvailable = false;
                }
            }
        }
    }

    // Create a map to track instructor assignments for each day and time slot
    const instructorAssignments = new Map<string, boolean>(); // Key: "instructorId-day-timeSlot"

    // Sort courses by duration (longest first) and number of sections (most first)
    const sortedCourses = [...courses].sort((a, b) => {
        if (a.duration !== b.duration) {
            return b.duration - a.duration; // Descending by duration
        }
        return b.sections.length - a.sections.length; // Descending by number of sections
    });

    const assignments: Assignment[] = [];
    const classroomCodeMap = new Map(classrooms.map((c) => [c.id, c.code]));
    const instructorNameMap = new Map(
        instructors.map((i) => [i.id, `${i.firstName} ${i.lastName}`])
    );

    // First pass: Place courses with duration <= 2 hours
    for (const course of sortedCourses) {
        if (course.duration <= 2) {
            for (const section of course.sections) {
                const assignment = findSlotForSection(
                    grid,
                    course,
                    section,
                    timeConstraints,
                    instructorAssignments,
                    classroomCodeMap,
                    instructorNameMap
                );

                if (assignment) {
                    assignments.push(assignment);
                    markSlotsAsOccupied(
                        grid,
                        course,
                        section.id,
                        assignment.day,
                        assignment.startTime
                    );

                    // Mark instructor as busy during this time
                    markInstructorAsBusy(
                        instructorAssignments,
                        course.instructorId,
                        assignment.day,
                        assignment.startTime,
                        assignment.endTime
                    );
                }
            }
        }
    }

    // Second pass: Split courses with duration > 2 hours
    for (const course of sortedCourses) {
        if (course.duration > 2) {
            for (const section of course.sections) {
                // Split the course into two parts
                const firstDuration = Math.ceil(course.duration / 2);
                const secondDuration = course.duration - firstDuration;

                // Find slot for first part
                const firstCourse = { ...course, duration: firstDuration };
                const firstAssignment = findSlotForSection(
                    grid,
                    firstCourse,
                    section,
                    timeConstraints,
                    instructorAssignments,
                    classroomCodeMap,
                    instructorNameMap
                );

                if (firstAssignment) {
                    assignments.push(firstAssignment);
                    markSlotsAsOccupied(
                        grid,
                        firstCourse,
                        section.id,
                        firstAssignment.day,
                        firstAssignment.startTime
                    );
                    markInstructorAsBusy(
                        instructorAssignments,
                        course.instructorId,
                        firstAssignment.day,
                        firstAssignment.startTime,
                        firstAssignment.endTime
                    );

                    // Find slot for second part (preferably on a different day)
                    const secondCourse = {
                        ...course,
                        duration: secondDuration,
                    };
                    const secondAssignment = findSlotForSplitSection(
                        grid,
                        secondCourse,
                        section,
                        timeConstraints,
                        firstAssignment.day,
                        instructorAssignments,
                        classroomCodeMap,
                        instructorNameMap
                    );

                    if (secondAssignment) {
                        assignments.push(secondAssignment);
                        markSlotsAsOccupied(
                            grid,
                            secondCourse,
                            section.id,
                            secondAssignment.day,
                            secondAssignment.startTime
                        );
                        markInstructorAsBusy(
                            instructorAssignments,
                            course.instructorId,
                            secondAssignment.day,
                            secondAssignment.startTime,
                            secondAssignment.endTime
                        );
                    }
                }
            }
        }
    }

    return assignments;
}

// Find an available slot for a section
function findSlotForSection(
    grid: ScheduleGrid,
    course: Course,
    section: { id: number; number: string; classroomId: number },
    timeConstraints: TimeConstraint[],
    instructorAssignments: Map<string, boolean>,
    classroomCodeMap: Map<number, string>,
    instructorNameMap: Map<number, string>
): Assignment | null {
    // Get the instructor's constraints for easy access
    const instructorConstraints = timeConstraints.filter(
        (tc) => tc.instructorId === course.instructorId
    );

    // Log for debugging
    console.log(
        `Finding slot for course ${course.code}, instructor ${course.instructorId}, duration ${course.duration}`
    );
    console.log(
        `Instructor has ${instructorConstraints.length} time constraints`
    );

    // Check instructor availability for each day and timeslot
    for (const day of DAYS) {
        // Get this instructor's constraints for this specific day
        const dayConstraints = instructorConstraints.filter(
            (tc) => tc.day === day
        );

        if (dayConstraints.length > 0) {
            console.log(
                `Instructor ${course.instructorId} has ${dayConstraints.length} constraints on ${day}`
            );

            // Get all constrained time slots for this day
            const constrainedSlots = dayConstraints.flatMap(
                (dc) => dc.timeSlots
            );
            console.log(
                `Constrained time slots: ${constrainedSlots.join(", ")}`
            );

            // If the instructor is busy for all time slots in a day, skip the day entirely
            const allTimeSlots = new Set(TIME_SLOTS);
            const busyTimeSlots = new Set(constrainedSlots);

            // Debug log to see what's happening
            console.log(
                `Total time slots: ${allTimeSlots.size}, Busy time slots: ${busyTimeSlots.size}`
            );

            if (busyTimeSlots.size >= allTimeSlots.size) {
                console.log(
                    `Instructor ${course.instructorId} is busy for all time slots on ${day}. Skipping day.`
                );
                continue;
            }
        }

        // Try each timeslot
        for (let i = 0; i < TIME_SLOTS.length - course.duration + 1; i++) {
            const startTime = TIME_SLOTS[i];
            const endTimeIndex = i + course.duration - 1;
            const endTime = TIME_SLOTS[endTimeIndex];

            // Check if all consecutive slots are available
            let allSlotsAvailable = true;
            for (let j = 0; j < course.duration; j++) {
                const timeSlot = TIME_SLOTS[i + j];
                const key = `${day}-${section.classroomId}-${timeSlot}`;
                const slot = grid.get(key);

                // Check if slot exists and is available
                if (!slot || !slot.isAvailable) {
                    allSlotsAvailable = false;
                    break;
                }

                // Check if instructor has a time constraint for this specific slot
                const hasConstraint = dayConstraints.some((dc) =>
                    dc.timeSlots.includes(timeSlot)
                );

                if (hasConstraint) {
                    console.log(
                        `Time slot ${timeSlot} on ${day} is constrained for instructor ${course.instructorId}`
                    );
                    allSlotsAvailable = false;
                    break;
                }

                // Check if instructor is already teaching another class at this time
                const instructorKey = `${course.instructorId}-${day}-${timeSlot}`;
                if (instructorAssignments.get(instructorKey)) {
                    console.log(
                        `Instructor ${course.instructorId} is already teaching at ${timeSlot} on ${day}`
                    );
                    allSlotsAvailable = false;
                    break;
                }
            }

            if (allSlotsAvailable) {
                console.log(
                    `Found suitable slot for course ${course.code}: ${day} at ${startTime}-${endTime}`
                );
                return {
                    sectionId: section.id,
                    courseCode: course.code,
                    courseTitle: course.title,
                    instructorName:
                        instructorNameMap.get(course.instructorId) || "Unknown",
                    day,
                    startTime,
                    endTime,
                    classroomCode:
                        classroomCodeMap.get(section.classroomId) || "Unknown",
                };
            }
        }
    }

    console.log(`Could not find any suitable slot for course ${course.code}`);
    return null; // No available slot found
}

// Find a slot for the second part of a split course (preferably on a different day)
function findSlotForSplitSection(
    grid: ScheduleGrid,
    course: Course,
    section: { id: number; number: string; classroomId: number },
    timeConstraints: TimeConstraint[],
    firstDay: string,
    instructorAssignments: Map<string, boolean>,
    classroomCodeMap: Map<number, string>,
    instructorNameMap: Map<number, string>
): Assignment | null {
    // First try days other than the first day
    const otherDays = DAYS.filter((day) => day !== firstDay);

    // Shuffle the days to distribute classes more evenly
    const shuffledDays = [...otherDays].sort(() => Math.random() - 0.5);

    // Get the instructor's constraints for easy access
    const instructorConstraints = timeConstraints.filter(
        (tc) => tc.instructorId === course.instructorId
    );

    console.log(
        `Finding split slot for course ${course.code} part 2, duration ${course.duration}`
    );

    // Try to find a slot on a different day first
    for (const day of shuffledDays) {
        // Get this instructor's constraints for this specific day
        const dayConstraints = instructorConstraints.filter(
            (tc) => tc.day === day
        );

        if (dayConstraints.length > 0) {
            console.log(
                `Instructor ${course.instructorId} has ${dayConstraints.length} constraints on ${day}`
            );

            // Get all constrained time slots for this day
            const constrainedSlots = dayConstraints.flatMap(
                (dc) => dc.timeSlots
            );
            console.log(
                `Constrained time slots: ${constrainedSlots.join(", ")}`
            );

            // If the instructor is busy for all time slots in a day, skip the day entirely
            const allTimeSlots = new Set(TIME_SLOTS);
            const busyTimeSlots = new Set(constrainedSlots);

            console.log(
                `Total time slots: ${allTimeSlots.size}, Busy time slots: ${busyTimeSlots.size}`
            );

            if (busyTimeSlots.size >= allTimeSlots.size) {
                console.log(
                    `Instructor ${course.instructorId} is busy for all time slots on ${day}. Skipping day.`
                );
                continue;
            }
        }

        // Try each timeslot
        for (let i = 0; i < TIME_SLOTS.length - course.duration + 1; i++) {
            const startTime = TIME_SLOTS[i];
            const endTimeIndex = i + course.duration - 1;
            const endTime = TIME_SLOTS[endTimeIndex];

            // Check if all consecutive slots are available
            let allSlotsAvailable = true;
            for (let j = 0; j < course.duration; j++) {
                const timeSlot = TIME_SLOTS[i + j];
                const key = `${day}-${section.classroomId}-${timeSlot}`;
                const slot = grid.get(key);

                if (!slot || !slot.isAvailable) {
                    allSlotsAvailable = false;
                    break;
                }

                // Check if instructor has a time constraint for this specific slot
                const hasConstraint = dayConstraints.some((dc) =>
                    dc.timeSlots.includes(timeSlot)
                );

                if (hasConstraint) {
                    console.log(
                        `Time slot ${timeSlot} on ${day} is constrained for instructor ${course.instructorId}`
                    );
                    allSlotsAvailable = false;
                    break;
                }

                // Check if instructor is already teaching another class at this time
                const instructorKey = `${course.instructorId}-${day}-${timeSlot}`;
                if (instructorAssignments.get(instructorKey)) {
                    console.log(
                        `Instructor ${course.instructorId} is already teaching at ${timeSlot} on ${day}`
                    );
                    allSlotsAvailable = false;
                    break;
                }
            }

            if (allSlotsAvailable) {
                console.log(
                    `Found suitable split slot for course ${course.code}: ${day} at ${startTime}-${endTime}`
                );
                return {
                    sectionId: section.id,
                    courseCode: course.code,
                    courseTitle: course.title,
                    instructorName:
                        instructorNameMap.get(course.instructorId) || "Unknown",
                    day,
                    startTime,
                    endTime,
                    classroomCode:
                        classroomCodeMap.get(section.classroomId) || "Unknown",
                };
            }
        }
    }

    console.log(
        `Could not find split slot on a different day for course ${course.code}, trying same day`
    );

    // If no slot found on a different day, try the same day
    return findSlotForSection(
        grid,
        course,
        section,
        timeConstraints,
        instructorAssignments,
        classroomCodeMap,
        instructorNameMap
    );
}

// Mark slots as occupied after assignment
function markSlotsAsOccupied(
    grid: ScheduleGrid,
    course: Course,
    sectionId: number,
    day: string,
    startTime: string
): void {
    const startIndex = TIME_SLOTS.findIndex((ts) => ts === startTime);

    for (let i = 0; i < course.duration; i++) {
        if (startIndex + i >= TIME_SLOTS.length) break;

        const timeSlot = TIME_SLOTS[startIndex + i];
        const key = `${day}-${sectionId}-${timeSlot}`;
        const slot = grid.get(key);

        if (slot) {
            slot.isAvailable = false;
            slot.assignedSectionId = sectionId;
        }
    }
}

// Mark instructor as busy for the given time period
function markInstructorAsBusy(
    instructorAssignments: Map<string, boolean>,
    instructorId: number,
    day: string,
    startTime: string,
    endTime: string
): void {
    const startIndex = TIME_SLOTS.findIndex((ts) => ts === startTime);
    const endIndex = TIME_SLOTS.findIndex((ts) => ts === endTime);

    for (let i = startIndex; i <= endIndex; i++) {
        if (i >= 0 && i < TIME_SLOTS.length) {
            const timeSlot = TIME_SLOTS[i];
            const key = `${instructorId}-${day}-${timeSlot}`;
            instructorAssignments.set(key, true);
        }
    }
}

// GET endpoint to get the current schedule (for testing in Postman)
export async function GET(request: Request) {
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
        const scheduleId = parseInt(scheduleIdParam, 10);
        if (isNaN(scheduleId)) {
            return NextResponse.json(
                { error: "Invalid Schedule ID. Must be a number." },
                { status: 400 }
            );
        }

        // For now, return a simple message - in a real implementation you would fetch assignments
        return NextResponse.json({
            message: "Use POST method to generate a schedule for testing",
            scheduleId,
        });
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json(
            { error: "An error occurred" },
            { status: 500 }
        );
    }
}
