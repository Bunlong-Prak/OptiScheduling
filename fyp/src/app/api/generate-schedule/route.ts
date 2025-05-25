import {
    classrooms,
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
        classroom_id: number | null;
        instructor_id: number;
    }[];
};

type Assignment = {
    section_id: number;
    course_code: string;
    course_title: string;
    instructor_name: string;
    day: string;
    start_time: string;
    end_time: string;
    classroom_code: string;
};

type Slot = {
    day: string;
    timeSlot: string;
    classroom_id: number;
    isAvailable: boolean;
    assigned_section_id?: number;
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

        // 2. Generate the schedule
        const schedule = generateSchedule(
            coursesData,
            timeConstraints,
            classroomsData,
            instructorsData,
            timeSlots
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
                timeSlots: timeSlots,
            },
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

// Fetch time slots for a given schedule
async function fetchTimeSlots(schedule_id: number): Promise<string[]> {
    try {
        console.log(`Fetching time slots for schedule_id: ${schedule_id}`);

        const timeSlotData = await db
            .select({
                start_time: scheduleTimeSlots.startTime,
            })
            .from(scheduleTimeSlots)
            .where(eq(scheduleTimeSlots.scheduleId, schedule_id))
            .orderBy(scheduleTimeSlots.startTime);

        if (!timeSlotData || timeSlotData.length === 0) {
            console.log("No time slots found, using default time slots");
            return [
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
        }

        // Extract start times and normalize them
        const startTimes = timeSlotData.map((slot) =>
            normalizeTimeSlot(slot.start_time)
        );
        console.log(
            `Found ${
                startTimes.length
            } time slots for schedule ${schedule_id}: ${startTimes.join(", ")}`
        );
        return startTimes;
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

        console.log(
            `Found ${coursesData.length} courses for schedule_id ${schedule_id}`
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
                    classroom_id: sections.classroomId,
                    instructor_id: sections.instructorId,
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
        throw new Error(
            `Failed to fetch courses: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
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
            .from(classrooms);

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

// Generate the schedule
function generateSchedule(
    courses: Course[],
    timeConstraints: TimeConstraint[],
    classrooms: { id: number; code: string; capacity: number }[],
    instructors: { id: number; first_name: string; last_name: string }[],
    timeSlots: string[]
): Assignment[] {
    // Create a grid of all possible slots
    const grid: ScheduleGrid = new Map();

    // Initialize the grid with all slots marked as available
    for (const day of DAYS) {
        for (const timeSlot of timeSlots) {
            for (const classroom of classrooms) {
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
    const instructorAssignments = new Map<string, boolean>(); // Key: "instructor_id-day-timeSlot"

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
        instructors.map((i) => [i.id, `${i.first_name} ${i.last_name}`])
    );

    // First pass: Place courses with duration <= 2 hours
    for (const course of sortedCourses) {
        if (course.duration <= 2) {
            for (const section of course.sections) {
                // Instead of skipping, we'll find an appropriate classroom
                const assignment = findClassroomAndSlotForSection(
                    grid,
                    course,
                    section,
                    classrooms,
                    timeConstraints,
                    instructorAssignments,
                    classroomCodeMap,
                    instructorNameMap,
                    timeSlots
                );

                if (assignment) {
                    assignments.push(assignment);
                    // Update the section's classroom_id with the assigned classroom
                    const assignedClassroomId = classrooms.find(
                        (c) => c.code === assignment.classroom_code
                    )?.id;

                    if (assignedClassroomId) {
                        const updatedSection = {
                            ...section,
                            classroom_id: assignedClassroomId,
                        };

                        markSlotsAsOccupied(
                            grid,
                            course,
                            updatedSection,
                            assignment.day,
                            assignment.start_time,
                            timeSlots
                        );

                        // Mark instructor as busy during this time
                        markInstructorAsBusy(
                            instructorAssignments,
                            section.instructor_id,
                            assignment.day,
                            assignment.start_time,
                            assignment.end_time,
                            timeSlots
                        );
                    }
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

                // Find classroom and slot for first part
                const firstCourse = { ...course, duration: firstDuration };
                const firstAssignment = findClassroomAndSlotForSection(
                    grid,
                    firstCourse,
                    section,
                    classrooms,
                    timeConstraints,
                    instructorAssignments,
                    classroomCodeMap,
                    instructorNameMap,
                    timeSlots
                );

                if (firstAssignment) {
                    assignments.push(firstAssignment);

                    // Update the section's classroom_id with the assigned classroom
                    const assignedClassroomId = classrooms.find(
                        (c) => c.code === firstAssignment.classroom_code
                    )?.id;

                    if (assignedClassroomId) {
                        const updatedSection = {
                            ...section,
                            classroom_id: assignedClassroomId,
                        };

                        markSlotsAsOccupied(
                            grid,
                            firstCourse,
                            updatedSection,
                            firstAssignment.day,
                            firstAssignment.start_time,
                            timeSlots
                        );

                        markInstructorAsBusy(
                            instructorAssignments,
                            section.instructor_id,
                            firstAssignment.day,
                            firstAssignment.start_time,
                            firstAssignment.end_time,
                            timeSlots
                        );

                        // Find classroom and slot for second part (preferably on a different day)
                        // Try to use the same classroom for consistency
                        const secondCourse = {
                            ...course,
                            duration: secondDuration,
                        };
                        const secondAssignment =
                            findSplitClassroomAndSlotForSection(
                                grid,
                                secondCourse,
                                updatedSection,
                                classrooms,
                                timeConstraints,
                                firstAssignment.day,
                                firstAssignment.classroom_code,
                                instructorAssignments,
                                classroomCodeMap,
                                instructorNameMap,
                                timeSlots
                            );

                        if (secondAssignment) {
                            assignments.push(secondAssignment);

                            // Get the classroom ID for the second part (it may be different)
                            const secondClassroomId = classrooms.find(
                                (c) =>
                                    c.code === secondAssignment.classroom_code
                            )?.id;

                            if (secondClassroomId) {
                                const secondUpdatedSection = {
                                    ...updatedSection,
                                    classroom_id: secondClassroomId,
                                };

                                markSlotsAsOccupied(
                                    grid,
                                    secondCourse,
                                    secondUpdatedSection,
                                    secondAssignment.day,
                                    secondAssignment.start_time,
                                    timeSlots
                                );

                                markInstructorAsBusy(
                                    instructorAssignments,
                                    section.instructor_id,
                                    secondAssignment.day,
                                    secondAssignment.start_time,
                                    secondAssignment.end_time,
                                    timeSlots
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    return assignments;
}

// New function to find both a classroom and a time slot for a section
function findClassroomAndSlotForSection(
    grid: ScheduleGrid,
    course: Course,
    section: {
        id: number;
        number: string;
        classroom_id: number | null;
        instructor_id: number;
    },
    classrooms: { id: number; code: string; capacity: number }[],
    timeConstraints: TimeConstraint[],
    instructorAssignments: Map<string, boolean>,
    classroomCodeMap: Map<number, string>,
    instructorNameMap: Map<number, string>,
    timeSlots: string[]
): Assignment | null {
    // Get the instructor's constraints for easy access
    const instructorConstraints = timeConstraints.filter(
        (tc) => tc.instructor_id === section.instructor_id
    );

    // Log for debugging
    console.log(
        `Finding classroom and slot for course ${course.code}, section ${section.id}, instructor ${section.instructor_id}, duration ${course.duration}`
    );
    console.log(
        `Instructor has ${instructorConstraints.length} time constraints`
    );

    // First check if section already has an assigned classroom
    if (section.classroom_id !== null) {
        console.log(
            `Section ${section.id} already has classroom ${section.classroom_id} assigned. Using it.`
        );
        return findSlotForAssignedClassroom(
            grid,
            course,
            section,
            timeConstraints,
            instructorAssignments,
            classroomCodeMap,
            instructorNameMap,
            timeSlots
        );
    }

    // If no classroom assigned, try each classroom to find one with available slots
    for (const classroom of classrooms) {
        console.log(
            `Trying classroom ${classroom.id} (${classroom.code}) for section ${section.id}`
        );

        // Create a temporary section with this classroom assigned
        const tempSection = {
            ...section,
            classroom_id: classroom.id,
        };

        // Try to find a suitable slot with this classroom
        const assignment = findSlotForAssignedClassroom(
            grid,
            course,
            tempSection,
            timeConstraints,
            instructorAssignments,
            classroomCodeMap,
            instructorNameMap,
            timeSlots
        );

        if (assignment) {
            console.log(
                `Found suitable classroom ${classroom.id} (${classroom.code}) and slot for section ${section.id}`
            );
            return assignment;
        }
    }

    console.log(
        `Could not find any suitable classroom and slot for course ${course.code}, section ${section.id}`
    );
    return null;
}

// Mark slots as occupied after assignment
function markSlotsAsOccupied(
    grid: ScheduleGrid,
    course: Course,
    section: { id: number; number: string; classroom_id: number | null },
    day: string,
    start_time: string,
    timeSlots: string[]
): void {
    if (section.classroom_id === null) {
        console.log(
            `Cannot mark slots as occupied: section ${section.id} has no classroom assigned`
        );
        return;
    }

    const startIndex = timeSlots.findIndex((ts) => ts === start_time);

    for (let i = 0; i < course.duration; i++) {
        if (startIndex + i >= timeSlots.length) break;

        const timeSlot = timeSlots[startIndex + i];
        // Use the classroom ID here, not the section ID
        const key = `${day}-${section.classroom_id}-${timeSlot}`;
        const slot = grid.get(key);

        if (slot) {
            slot.isAvailable = false;
            slot.assigned_section_id = section.id;
            console.log(
                `Marked slot ${key} as occupied by section ${section.id}`
            );
        } else {
            console.log(
                `Warning: Could not find slot with key ${key} to mark as occupied`
            );
        }
    }
}

// Mark instructor as busy for the given time period
function markInstructorAsBusy(
    instructorAssignments: Map<string, boolean>,
    instructor_id: number,
    day: string,
    start_time: string,
    end_time: string,
    timeSlots: string[]
): void {
    const startIndex = timeSlots.findIndex((ts) => ts === start_time);
    const endIndex = timeSlots.findIndex((ts) => ts === end_time);

    for (let i = startIndex; i <= endIndex; i++) {
        if (i >= 0 && i < timeSlots.length) {
            const timeSlot = timeSlots[i];
            const key = `${instructor_id}-${day}-${timeSlot}`;
            instructorAssignments.set(key, true);
            console.log(
                `Marked instructor ${instructor_id} as busy on ${day} at ${timeSlot}`
            );
        }
    }
} // No available classroom and slot found

// Function to find a slot for a section with an already assigned classroom
function findSlotForAssignedClassroom(
    grid: ScheduleGrid,
    course: Course,
    section: {
        id: number;
        number: string;
        classroom_id: number | null;
        instructor_id: number;
    },
    timeConstraints: TimeConstraint[],
    instructorAssignments: Map<string, boolean>,
    classroomCodeMap: Map<number, string>,
    instructorNameMap: Map<number, string>,
    timeSlots: string[]
): Assignment | null {
    // If classroom_id is null, return null since we can't schedule without a classroom
    if (section.classroom_id === null) {
        console.log(
            `Cannot schedule section ${section.id} for course ${course.code} - no classroom assigned`
        );
        return null;
    }

    // Get the instructor's constraints for easy access
    const instructorConstraints = timeConstraints.filter(
        (tc) => tc.instructor_id === section.instructor_id
    );

    // Check instructor availability for each day and timeslot
    for (const day of DAYS) {
        // Get this instructor's constraints for this specific day
        const dayConstraints = instructorConstraints.filter(
            (tc) => tc.day === day
        );

        if (dayConstraints.length > 0) {
            console.log(
                `Instructor ${section.instructor_id} has ${dayConstraints.length} constraints on ${day}`
            );

            // Get all constrained time slots for this day
            const constrainedSlots = dayConstraints.flatMap(
                (dc) => dc.timeSlots
            );
            console.log(
                `Constrained time slots: ${constrainedSlots.join(", ")}`
            );

            // If the instructor is busy for all time slots in a day, skip the day entirely
            const allTimeSlots = new Set(timeSlots);
            const busyTimeSlots = new Set(constrainedSlots);

            // Debug log to see what's happening
            console.log(
                `Total time slots: ${allTimeSlots.size}, Busy time slots: ${busyTimeSlots.size}`
            );

            if (busyTimeSlots.size >= allTimeSlots.size) {
                console.log(
                    `Instructor ${section.instructor_id} is busy for all time slots on ${day}. Skipping day.`
                );
                continue;
            }
        }

        // Try each timeslot
        for (let i = 0; i < timeSlots.length - course.duration + 1; i++) {
            const start_time = timeSlots[i];
            const endTimeIndex = i + course.duration - 1;
            const end_time = timeSlots[endTimeIndex];

            // Check if all consecutive slots are available for this specific classroom
            let allSlotsAvailable = true;
            for (let j = 0; j < course.duration; j++) {
                const timeSlot = timeSlots[i + j];
                const key = `${day}-${section.classroom_id}-${timeSlot}`;
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
                        `Time slot ${timeSlot} on ${day} is constrained for instructor ${section.instructor_id}`
                    );
                    allSlotsAvailable = false;
                    break;
                }

                // Check if instructor is already teaching another class at this time
                const instructorKey = `${section.instructor_id}-${day}-${timeSlot}`;
                if (instructorAssignments.get(instructorKey)) {
                    console.log(
                        `Instructor ${section.instructor_id} is already teaching at ${timeSlot} on ${day}`
                    );
                    allSlotsAvailable = false;
                    break;
                }
            }

            if (allSlotsAvailable) {
                console.log(
                    `Found suitable slot for course ${course.code}, section ${section.id} in classroom ${section.classroom_id}: ${day} at ${start_time}-${end_time}`
                );
                return {
                    section_id: section.id,
                    course_code: course.code,
                    course_title: course.title,
                    instructor_name:
                        instructorNameMap.get(section.instructor_id) ||
                        "Unknown",
                    day,
                    start_time,
                    end_time,
                    classroom_code:
                        classroomCodeMap.get(section.classroom_id) || "Unknown",
                };
            }
        }
    }

    console.log(
        `Could not find any suitable slot for course ${course.code}, section ${section.id} in classroom ${section.classroom_id}`
    );
    return null; // No available slot found
}

// Find a split classroom and slot for the second part of a split course
function findSplitClassroomAndSlotForSection(
    grid: ScheduleGrid,
    course: Course,
    section: {
        id: number;
        number: string;
        classroom_id: number | null;
        instructor_id: number;
    },
    classrooms: { id: number; code: string; capacity: number }[],
    timeConstraints: TimeConstraint[],
    firstDay: string,
    preferredClassroomCode: string,
    instructorAssignments: Map<string, boolean>,
    classroomCodeMap: Map<number, string>,
    instructorNameMap: Map<number, string>,
    timeSlots: string[]
): Assignment | null {
    // If classroom_id is null, something went wrong
    if (section.classroom_id === null) {
        console.log(
            `Section ${section.id} has no classroom assigned for split scheduling.`
        );
        return null;
    }

    // First try days other than the first day
    const otherDays = DAYS.filter((day) => day !== firstDay);

    // Shuffle the days to distribute classes more evenly
    const shuffledDays = [...otherDays].sort(() => Math.random() - 0.5);

    // Try to use the same classroom first
    console.log(
        `Trying to find a slot for the split course in the same classroom (${preferredClassroomCode})`
    );

    // First try to find a slot with the preferred classroom on a different day
    for (const day of shuffledDays) {
        const assignment = tryClassroomOnDay(
            grid,
            course,
            section,
            day,
            timeConstraints,
            instructorAssignments,
            classroomCodeMap,
            instructorNameMap,
            timeSlots
        );

        if (assignment) {
            return assignment;
        }
    }

    // If that fails, try other classrooms on different days
    console.log(
        `Could not find slot in the same classroom on different days. Trying other classrooms.`
    );

    for (const day of shuffledDays) {
        for (const classroom of classrooms) {
            // Skip the already tried classroom
            if (classroom.code === preferredClassroomCode) {
                continue;
            }

            // Create a temporary section with this classroom assigned
            const tempSection = {
                ...section,
                classroom_id: classroom.id,
            };

            const assignment = tryClassroomOnDay(
                grid,
                course,
                tempSection,
                day,
                timeConstraints,
                instructorAssignments,
                classroomCodeMap,
                instructorNameMap,
                timeSlots
            );

            if (assignment) {
                return assignment;
            }
        }
    }

    // If still no luck, try the same day with the preferred classroom
    console.log(
        `Trying the same day (${firstDay}) with the preferred classroom.`
    );
    const sameDay = tryClassroomOnDay(
        grid,
        course,
        section,
        firstDay,
        timeConstraints,
        instructorAssignments,
        classroomCodeMap,
        instructorNameMap,
        timeSlots
    );

    if (sameDay) {
        return sameDay;
    }

    // Last resort: try other classrooms on the same day
    console.log(`Trying other classrooms on the same day (${firstDay}).`);
    for (const classroom of classrooms) {
        if (classroom.code === preferredClassroomCode) {
            continue;
        }

        const tempSection = {
            ...section,
            classroom_id: classroom.id,
        };

        const assignment = tryClassroomOnDay(
            grid,
            course,
            tempSection,
            firstDay,
            timeConstraints,
            instructorAssignments,
            classroomCodeMap,
            instructorNameMap,
            timeSlots
        );

        if (assignment) {
            return assignment;
        }
    }

    console.log(
        `Could not find any suitable split arrangement for course ${course.code}, section ${section.id}`
    );
    return null;
}

// Helper function to try a specific classroom on a specific day
function tryClassroomOnDay(
    grid: ScheduleGrid,
    course: Course,
    section: {
        id: number;
        number: string;
        classroom_id: number | null;
        instructor_id: number;
    },
    day: string,
    timeConstraints: TimeConstraint[],
    instructorAssignments: Map<string, boolean>,
    classroomCodeMap: Map<number, string>,
    instructorNameMap: Map<number, string>,
    timeSlots: string[]
): Assignment | null {
    if (section.classroom_id === null) {
        return null;
    }

    // Get the instructor's constraints for this day
    const dayConstraints = timeConstraints
        .filter(
            (tc) => tc.instructor_id === section.instructor_id && tc.day === day
        )
        .flatMap((dc) => dc.timeSlots);

    // Try each timeslot on this day
    for (let i = 0; i < timeSlots.length - course.duration + 1; i++) {
        const start_time = timeSlots[i];
        const endTimeIndex = i + course.duration - 1;
        const end_time = timeSlots[endTimeIndex];

        // Check if all consecutive slots are available
        let allSlotsAvailable = true;
        for (let j = 0; j < course.duration; j++) {
            const timeSlot = timeSlots[i + j];
            const key = `${day}-${section.classroom_id}-${timeSlot}`;
            const slot = grid.get(key);

            // Check if slot exists and is available
            if (!slot || !slot.isAvailable) {
                allSlotsAvailable = false;
                break;
            }

            // Check if instructor has a time constraint for this slot
            if (dayConstraints.includes(timeSlot)) {
                allSlotsAvailable = false;
                break;
            }

            // Check if instructor is already teaching
            const instructorKey = `${section.instructor_id}-${day}-${timeSlot}`;
            if (instructorAssignments.get(instructorKey)) {
                allSlotsAvailable = false;
                break;
            }
        }

        if (allSlotsAvailable) {
            console.log(
                `Found suitable slot for split course ${course.code}, section ${section.id} in classroom ${section.classroom_id}: ${day} at ${start_time}-${end_time}`
            );
            return {
                section_id: section.id,
                course_code: course.code,
                course_title: course.title,
                instructor_name:
                    instructorNameMap.get(section.instructor_id) || "Unknown",
                day,
                start_time,
                end_time,
                classroom_code:
                    classroomCodeMap.get(section.classroom_id) || "Unknown",
            };
        }
    }

    return null;
}
