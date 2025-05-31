import {
    classrooms,
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

// Function to format time slot for display (reverse of normalize)
function formatTimeSlot(timeSlot: string): string {
    const [hour, minute] = timeSlot.split(":");
    const hourNum = parseInt(hour);

    if (hourNum === 0) {
        return `12:${minute} AM`;
    } else if (hourNum < 12) {
        return `${hourNum}:${minute} AM`;
    } else if (hourNum === 12) {
        return `12:${minute} PM`;
    } else {
        return `${hourNum - 12}:${minute} PM`;
    }
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

        console.log("timeslots: ", timeSlots);
        // 2. Generate the schedule
        const schedule = generateSchedule(
            coursesData,
            timeConstraints,
            classroomsData,
            instructorsData,
            timeSlots
        );

        console.log("Schedule: ", schedule);

        // 3. Store the schedule in the database
        const storageResult = await storeScheduleInDatabase(schedule);

        // 4. Return the generated schedule with storage results
        return NextResponse.json({
            message: "Schedule generated and stored successfully",
            schedule: schedule,
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
                end_time: scheduleTimeSlots.endTime,
            })
            .from(scheduleTimeSlots)
            .where(eq(scheduleTimeSlots.scheduleId, schedule_id));

        if (!timeSlotData || timeSlotData.length === 0) {
            console.log("No time slots found, using default time slots");
            return [
                "8-9",
                "9-10",
                "10-11",
                "11-12",
                "12-13",
                "13-14",
                "14-15",
                "15-16",
                "16-17",
                "17-18",
            ];
        }

        // Each row represents one time slot - format as "start-end"
        const timeSlots = timeSlotData.map((slot) => {
            // Extract hour from start_time and end_time
            const startHour = parseInt(slot.start_time);
            const endHour = parseInt(slot.end_time);
            return `${startHour}-${endHour}`;
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
// Add this function to your existing code

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

    // Sort sections by course duration (longest first) for better scheduling
    const allSections = coursesData
        .flatMap((course) =>
            course.sections.map((section) => ({
                ...section,
                course: course,
            }))
        )
        .sort((a, b) => b.course.duration - a.course.duration);

    console.log(`Processing ${allSections.length} sections...`);

    for (const section of allSections) {
        console.log(
            `\nProcessing section ${section.number} of course ${section.course.code}`
        );

        // Step 1: Assign classroom if not already assigned
        if (!section.classroom_id) {
            section.classroom_id = assignClassroomToSection(
                section,
                classroomsData
            );
            if (!section.classroom_id) {
                console.log(
                    `Failed to assign classroom to section ${section.number}`
                );
                continue;
            }
        }

        // Step 2: Find available time slots for this section
        const assignment = scheduleSection(
            section,
            timeConstraints,
            classroomsData,
            instructorsData,
            timeSlots,
            scheduleGrid
        );

        if (assignment) {
            assignments.push(assignment);
            console.log(`Successfully scheduled section ${section.number}`);
        } else {
            console.log(`Failed to schedule section ${section.number}`);
        }
    }

    console.log(
        `Schedule generation completed. Generated ${assignments.length} assignments.`
    );
    return assignments;
}

// Initialize the schedule grid to track availability
function initializeScheduleGrid(
    classroomsData: any[],
    timeSlots: string[]
): ScheduleGrid {
    const grid = new Map<string, Slot>();

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

    return grid;
}

// Assign classroom to section based on capacity and availability
function assignClassroomToSection(
    section: any,
    classroomsData: any[]
): number | null {
    // Find suitable classrooms (you can add more criteria here)
    const suitableClassrooms = classroomsData.filter(
        (classroom) => classroom.capacity >= (section.course.capacity || 0)
    );

    if (suitableClassrooms.length === 0) {
        console.log(
            `No suitable classrooms found for section ${section.number}`
        );
        return null;
    }

    // For now, assign the first suitable classroom
    // You can implement more sophisticated logic here
    const assignedClassroom = suitableClassrooms[0];
    console.log(
        `Assigned classroom ${assignedClassroom.code} to section ${section.number}`
    );

    return assignedClassroom.id;
}

// Schedule a section by finding available time slots
function scheduleSection(
    section: any,
    timeConstraints: TimeConstraint[],
    classroomsData: any[],
    instructorsData: any[],
    timeSlots: string[],
    scheduleGrid: ScheduleGrid
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
    const classroomCode = classroom ? classroom.code : "Unknown";

    // Get instructor constraints
    const instructorConstraints = timeConstraints.filter(
        (constraint) => constraint.instructor_id === section.instructor_id
    );

    // Find possible time slot combinations that fit the duration
    const possibleSlots = findPossibleTimeSlots(timeSlots, duration);

    console.log(
        `Found ${possibleSlots.length} possible time slot combinations for duration ${duration}`
    );

    console.log("possible Slots: ", possibleSlots);

    // Try to schedule on each day
    const availableDays = [...DAYS];
    shuffleArray(availableDays); // Randomize day selection

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
                        scheduleGrid,
                        availableTimeSlots
                    )
                ) {
                    // Mark slots as occupied
                    markSlotsAsOccupied(
                        day,
                        slotCombination,
                        section.classroom_id,
                        section.id,
                        scheduleGrid
                    );

                    const startTime = getStartTime(slotCombination);
                    const endTime = getEndTime(slotCombination);

                    return {
                        section_id: section.id,
                        course_code: course.code,
                        course_title: course.title,
                        instructor_name: instructorName,
                        day: day,
                        start_time: startTime,
                        end_time: endTime,
                        classroom_code: classroomCode,
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
                        scheduleGrid
                    )
                ) {
                    // Mark slots as occupied
                    markSlotsAsOccupied(
                        day,
                        slotCombination,
                        section.classroom_id,
                        section.id,
                        scheduleGrid
                    );

                    const startTime = getStartTime(slotCombination);
                    const endTime = getEndTime(slotCombination);

                    return {
                        section_id: section.id,
                        course_code: course.code,
                        course_title: course.title,
                        instructor_name: instructorName,
                        day: day,
                        start_time: startTime,
                        end_time: endTime,
                        classroom_code: classroomCode,
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
    duration: number
): string[][] {
    const combinations: string[][] = [];

    // Generate consecutive slot combinations based on duration
    for (let i = 0; i <= timeSlots.length - duration; i++) {
        const combination = timeSlots.slice(i, i + duration);
        combinations.push(combination);
    }

    // Sort combinations by their starting time slot (smaller to bigger)
    return combinations.sort((a, b) => {
        // Extract the start hour from the first time slot of each combination
        const startHourA = parseInt(a[0].split("-")[0]);
        const startHourB = parseInt(b[0].split("-")[0]);
        return startHourA - startHourB;
    });
}

// Check if a section can be scheduled at a specific time
function canScheduleAtTime(
    day: string,
    slotCombination: string[],
    classroomId: number,
    scheduleGrid: ScheduleGrid,
    instructorAvailableSlots?: string[]
): boolean {
    // Check if all required slots are available in the classroom
    for (const timeSlot of slotCombination) {
        const key = `${day}-${classroomId}-${timeSlot}`;
        const slot = scheduleGrid.get(key);

        if (!slot || !slot.isAvailable) {
            return false;
        }

        // If instructor has time constraints, check if this slot is in their available slots
        if (
            instructorAvailableSlots &&
            !instructorAvailableSlots.includes(timeSlot)
        ) {
            return false;
        }
    }

    return true;
}

// Mark time slots as occupied
function markSlotsAsOccupied(
    day: string,
    slotCombination: string[],
    classroomId: number,
    sectionId: number,
    scheduleGrid: ScheduleGrid
): void {
    for (const timeSlot of slotCombination) {
        const key = `${day}-${classroomId}-${timeSlot}`;
        const slot = scheduleGrid.get(key);

        if (slot) {
            slot.isAvailable = false;
            slot.assigned_section_id = sectionId;
        }
    }
}

function getStartTime(slotCombination: string[]): string {
    if (slotCombination.length === 0) {
        throw new Error("Slot combination cannot be empty");
    }

    // Extract the start hour from the first time slot
    const startHour = slotCombination[0].split("-")[0];
    return startHour;
}

function getEndTime(slotCombination: string[]): string {
    if (slotCombination.length === 0) {
        throw new Error("Slot combination cannot be empty");
    }

    // Extract the end hour from the last time slot
    const endHour = slotCombination[slotCombination.length - 1].split("-")[1];
    return endHour;
}
// Utility function to shuffle array
function shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Function to store schedule in database
async function storeScheduleInDatabase(
    assignments: Assignment[]
): Promise<{ success: boolean; stored: number; errors: any[] }> {
    console.log(`Storing ${assignments.length} assignments in database...`);

    let stored = 0;
    const errors: any[] = [];

    await db.delete(courseHours);

    for (const assignment of assignments) {
        try {
            console.log(`Processing assignment: ${assignment.start_time}`);

            const timeSlotFormat = `${assignment.start_time} - ${assignment.end_time}`;

            console.log(`Storing course hour: ${timeSlotFormat}`);

            await db.insert(courseHours).values({
                day: assignment.day,
                timeSlot: timeSlotFormat,
                sectionId: assignment.section_id,
            });

            stored++;
            console.log(
                `✅ Stored assignment for section ${assignment.section_id}`
            );
        } catch (error) {
            console.error(
                `❌ Error storing assignment for section ${assignment.section_id}:`,
                error
            );
            errors.push({
                section_id: assignment.section_id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    console.log(
        `Storage completed. Stored: ${stored}, Errors: ${errors.length}`
    );

    return {
        success: errors.length === 0,
        stored,
        errors,
    };
}
