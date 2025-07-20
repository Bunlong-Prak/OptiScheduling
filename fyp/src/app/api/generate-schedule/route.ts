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
    capacity: number;
    duration: number;
    sections: {
        prefer_classroom_id: number | null; // Keep for backward compatibility
        id: number;
        number: string;
        instructor_id: number | null;
        status?: string | null;
        separatedDurations?: number[];
        courseHoursIds: number[];
        preferClassroomIds?: (number | null)[]; // NEW: Array of classroom preferences per courseHour
    }[];
};
type SchedulingUnit = {
    section_id: number;
    section_number: string;
    course: Course;
    instructor_id: number | null;
    prefer_classroom_type_id: number | null; // This will now come from courseHours
    classroom_id: number | null;
    status?: string | null;
    duration: number;
    separationIndex: number;
    courseHours_id?: number;
    prefer_classroom_id?: number | null; // NEW: Store the specific classroom preference from courseHours
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

// Enhanced types for error tracking
type SchedulingError = {
    section_id: number;
    section_number: string;
    course_code: string;
    course_title: string;
    instructor_name: string;
    error_type:
        | "CAPACITY_CONSTRAINT"
        | "TIME_CONSTRAINT"
        | "INSTRUCTOR_CONFLICT"
        | "NO_AVAILABLE_SLOTS"
        | "NO_CLASSROOM"
        | "DURATION_MISMATCH"
        | "UNKNOWN_ERROR";
    error_message: string;
    details?: {
        required_capacity?: number;
        available_capacity?: number;
        conflicting_course?: string;
        conflicting_instructor?: string;
        required_duration?: number;
        available_duration?: number;
        classroom_attempt?: number;
        classrooms_attempted?: number[];
        total_classrooms_tried?: number;
        attempted_day?: string;
        attempted_time?: string;
        total_suitable_classrooms?: number;
        attempted_classroom?: string;
    };
};

type EnhancedScheduleResponse = {
    success: boolean;
    message: string;
    schedule: any[];
    stats: {
        totalCourses: number;
        totalSections: number;
        scheduledAssignments: number;
        constraintsApplied: number;
        failedAssignments: number;
    };
    errors: SchedulingError[];
    warnings: string[];
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

        const schedule_id = parseInt(scheduleIdParam, 10);
        if (isNaN(schedule_id)) {
            return NextResponse.json(
                { error: "Invalid Schedule ID. Must be a number." },
                { status: 400 }
            );
        }

        // 1. Fetch all the required data
        const coursesData = await fetchCourses(schedule_id);
        console.log("courses Data: ", coursesData);
        const timeConstraints = await fetchTimeConstraints(schedule_id);
        const classroomsData = await fetchClassrooms(schedule_id);
        const instructorsData = await fetchInstructors(schedule_id);
        const timeSlots = await fetchTimeSlots(schedule_id);

        console.log("timeslots: ", timeSlots);

        // 2. Generate the schedule with enhanced error tracking
        const result = generateScheduleWithErrorTracking(
            coursesData,
            timeConstraints,
            classroomsData,
            instructorsData,
            timeSlots
        );

        console.log("Schedule Generation Result:", result);

        // 3. Handle failed assignments by nullifying database records
        if (result.failedUnits.length > 0) {
            console.log(
                `\n=== HANDLING ${result.failedUnits.length} FAILED ASSIGNMENTS ===`
            );

            for (const failedUnit of result.failedUnits) {
                await handleFailedAssignment(
                    failedUnit.unit.section_id,
                    failedUnit.courseHoursId
                );
            }

            console.log("✅ Completed handling failed assignments");
        }

        // 4. Store successful assignments in the database
        if (result.assignments.length > 0) {
            const storageResult = await storeScheduleInDatabase(
                result.assignments,
                scheduleIdParam
            );
        }

        // 5. Transform assignments to match frontend expectations
        const transformedSchedule = await transformAssignmentsForFrontend(
            result.assignments,
            coursesData,
            schedule_id
        );

        // 6. Calculate enhanced stats
        const stats = {
            totalCourses: coursesData.length,
            totalSections: coursesData.reduce(
                (sum, course) => sum + course.sections.length,
                0
            ),
            scheduledAssignments: result.assignments.length,
            constraintsApplied: result.assignments.filter(
                (a) => a.instructor_name !== "Unknown"
            ).length,
            failedAssignments: result.errors.length,
        };

        // 7. Prepare response with detailed error information
        const response: EnhancedScheduleResponse = {
            success: result.errors.length === 0,
            message:
                result.errors.length === 0
                    ? "Schedule generated successfully"
                    : `Schedule generated with ${result.errors.length} failed assignments (database records nullified)`,
            schedule: transformedSchedule,
            stats: stats,
            errors: result.errors,
            warnings: result.warnings,
        };

        return NextResponse.json(response);
    } catch (error: unknown) {
        console.error("Error generating schedule:", error);
        const errorMessage =
            error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to generate schedule",
                details: errorMessage,
                errors: [],
                warnings: [],
            },
            { status: 500 }
        );
    }
}

function calculateTimeSlotDuration(timeSlot: string): number {
    const [startTime, endTime] = timeSlot.split("-");
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    return (endTotalMinutes - startTotalMinutes) / 60; // Return hours as decimal
}

function calculateCombinationDuration(slotCombination: string[]): number {
    return slotCombination.reduce((total, slot) => {
        return total + calculateTimeSlotDuration(slot);
    }, 0);
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
                capacity: courses.capacity,
            })
            .from(courses)
            .where(eq(courses.scheduleId, schedule_id));

        if (coursesData.length === 0) {
            return [];
        }

        const result: Course[] = [];
        for (const course of coursesData) {
            // Get sections for this course
            const sectionsData = await db
                .select({
                    id: sections.id,
                    number: sections.number,
                    instructor_id: sections.instructorId,
                    status: sections.status,
                })
                .from(sections)
                .where(eq(sections.courseId, course.id));

            // For each section, get separated durations and courseHours info
            const sectionsWithSeparatedDurations = [];
            for (const section of sectionsData) {
                // Fetch separated durations, courseHours IDs, and classroom preferences from courseHours table
                const courseHoursData = await db
                    .select({
                        id: courseHours.id,
                        separatedDuration: courseHours.separatedDuration,
                        prefer_classroom_id: courseHours.preferClassRoomId,
                    })
                    .from(courseHours)
                    .where(eq(courseHours.sectionId, section.id))
                    .orderBy(courseHours.id);

                let separatedDurations: number[] = [];
                let courseHoursIds: number[] = [];
                let preferClassroomIds: (number | null)[] = [];

                if (courseHoursData.length > 0) {
                    courseHoursData.forEach((ch) => {
                        if (
                            ch.separatedDuration !== null &&
                            ch.separatedDuration !== undefined
                        ) {
                            separatedDurations.push(ch.separatedDuration);
                            courseHoursIds.push(ch.id);
                            preferClassroomIds.push(ch.prefer_classroom_id);
                        }
                    });

                    console.log(
                        `Found ${
                            courseHoursData.length
                        } courseHours records for section ${
                            section.number
                        }: durations [${separatedDurations.join(
                            ", "
                        )}] with IDs [${courseHoursIds.join(
                            ", "
                        )}] and preferences [${preferClassroomIds.join(", ")}]`
                    );
                }

                // If no separated durations found in courseHours, use the full course duration
                if (separatedDurations.length === 0) {
                    separatedDurations = [course.duration];
                    preferClassroomIds = [null]; // No preference for default duration
                    console.log(
                        `No separated durations found for section ${section.number}, using full duration: ${course.duration}`
                    );
                }

                sectionsWithSeparatedDurations.push({
                    ...section,
                    separatedDurations: separatedDurations,
                    courseHoursIds: courseHoursIds,
                    preferClassroomIds: preferClassroomIds, // NEW: Store classroom preferences per courseHour
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
            `Fetched ${result.length} courses with separated duration and classroom preference information`
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
                classroom_type_id: classroomTypes.id,
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

function validateSchedulingUnitCapacity(
    unit: SchedulingUnit,
    classroomId: number,
    classroomsData: any[]
): { isValid: boolean; reason?: string; capacityInfo?: any } {
    console.log("=== CAPACITY VALIDATION FOR SCHEDULING UNIT ===");
    console.log(`Unit: ${unit.section_number} (${unit.course.code})`);
    console.log(`Classroom ID: ${classroomId}`);

    // Skip validation for online classrooms (negative IDs)
    if (classroomId < 0) {
        console.log("✅ Skipping capacity validation for online classroom");
        return { isValid: true };
    }

    // Find the classroom
    const classroom = classroomsData.find((cls) => cls.id === classroomId);
    if (!classroom) {
        console.log("❌ Classroom not found");
        return {
            isValid: false,
            reason: `Classroom with ID ${classroomId} not found`,
        };
    }

    // Get course capacity - check multiple possible fields

    const courseCapacity = getCourseCapacity(unit.course);
    const classroomCapacity = classroom.capacity || 0;

    console.log(
        `Course capacity: ${courseCapacity}, Classroom capacity: ${classroomCapacity}`
    );

    // Handle edge cases
    if (courseCapacity === 0 && classroomCapacity === 0) {
        console.log("⚠️ Both capacities are 0 - allowing with warning");
        return {
            isValid: true,
            capacityInfo: {
                courseCapacity,
                classroomCapacity,
                warning: "Both course and classroom capacity are unspecified",
            },
        };
    }

    if (courseCapacity === 0) {
        console.log("⚠️ Course capacity is 0 - allowing with warning");
        return {
            isValid: true,
            capacityInfo: {
                courseCapacity,
                classroomCapacity,
                warning: "Course capacity not specified",
            },
        };
    }

    if (classroomCapacity === 0) {
        console.log("❌ Classroom capacity is 0 but course needs students");
        return {
            isValid: false,
            reason: `Classroom ${classroom.code} has no specified capacity, but course requires ${courseCapacity} students`,
        };
    }

    // Main capacity validation
    if (courseCapacity > classroomCapacity) {
        const shortage = courseCapacity - classroomCapacity;
        console.log(
            `❌ Capacity exceeded: need ${courseCapacity}, available ${classroomCapacity}`
        );
        return {
            isValid: false,
            reason: `Course requires ${courseCapacity} students but classroom ${classroom.code} only has ${classroomCapacity} seats (${shortage} short)`,
        };
    }

    console.log("✅ Capacity validation passed");
    const utilizationPercentage = Math.round(
        (courseCapacity / classroomCapacity) * 100
    );

    return {
        isValid: true,
        capacityInfo: {
            courseCapacity,
            classroomCapacity,
            utilizationPercentage,
        },
    };
}

function getClassroomTypePreferenceStats(
    section: any,
    classroomsData: any[]
): {
    hasTypePreference: boolean;
    preferredTypeId?: number;
    matchingTypeClassrooms: any[];
    matchingTypeCount: number;
    totalSuitableCount: number;
    typeBreakdown: Map<number, any[]>;
} {
    const courseCapacity = getCourseCapacity(section.course);

    // Filter classrooms by capacity requirements first
    const capacitySuitableClassrooms = classroomsData.filter((classroom) => {
        const hasEnoughSeats =
            classroom.capacity >= (section.course.capacity || 0);
        const meetsCapacityRequirement =
            courseCapacity === 0 || classroom.capacity >= courseCapacity;
        return hasEnoughSeats && meetsCapacityRequirement;
    });

    // Create breakdown by classroom type
    const typeBreakdown = new Map<number, any[]>();
    console.log("Capacity suitable", capacitySuitableClassrooms);
    capacitySuitableClassrooms.forEach((classroom) => {
        const typeId = classroom.classroom_type_id;
        if (!typeBreakdown.has(typeId)) {
            typeBreakdown.set(typeId, []);
        }
        typeBreakdown.get(typeId)!.push(classroom);
    });

    // Check if section has classroom type preference
    console.log(section);
    if (!section.prefer_classroom_type_id) {
        return {
            hasTypePreference: false,
            matchingTypeClassrooms: [],
            matchingTypeCount: 0,
            totalSuitableCount: capacitySuitableClassrooms.length,
            typeBreakdown: typeBreakdown,
        };
    }

    // Find classrooms with matching type ID
    const matchingTypeClassrooms = capacitySuitableClassrooms.filter(
        (classroom) =>
            classroom.classroom_type_id === section.prefer_classroom_type_id
    );
    console.log("matching: ", matchingTypeClassrooms);
    return {
        hasTypePreference: true,
        preferredTypeId: section.preferClassroomTypeId,
        matchingTypeClassrooms: matchingTypeClassrooms,
        matchingTypeCount: matchingTypeClassrooms.length,
        totalSuitableCount: capacitySuitableClassrooms.length,
        typeBreakdown: typeBreakdown,
    };
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

function createAssignmentForNonConsecutiveSlots(
    unit: SchedulingUnit,
    slotCombination: string[],
    day: string,
    instructorName: string,
    classroomCode: string
): Assignment {
    // Sort slots by start time
    const sortedSlots = slotCombination.sort((a, b) => {
        const startA = a.split("-")[0];
        const startB = b.split("-")[0];
        return startA.localeCompare(startB);
    });

    const startTime = sortedSlots[0].split("-")[0];
    const endTime = sortedSlots[sortedSlots.length - 1].split("-")[1];

    // Log the scheduling details
    const isContinuous = areTimeSlotsContinuous(sortedSlots);

    if (!isContinuous) {
        console.log(`📅 Scheduled ${unit.section_number} with gaps on ${day}:`);

        // Show the actual time slots and gaps
        for (let i = 0; i < sortedSlots.length; i++) {
            const slot = sortedSlots[i];
            const [slotStart, slotEnd] = slot.split("-");
            const duration = calculateTimeSlotDuration(slot);

            console.log(
                `   Class ${i + 1}: ${slotStart}-${slotEnd} (${duration}h)`
            );

            // Show gap if there's a next slot
            if (i < sortedSlots.length - 1) {
                const nextSlot = sortedSlots[i + 1];
                const gapStart = slotEnd;
                const gapEnd = nextSlot.split("-")[0];

                if (gapStart !== gapEnd) {
                    const gapDuration = calculateTimeSlotDuration(
                        `${gapStart}-${gapEnd}`
                    );
                    console.log(
                        `   GAP: ${gapStart}-${gapEnd} (${gapDuration}h break)`
                    );
                }
            }
        }
        console.log(
            `   Overall span: ${startTime}-${endTime} (${unit.duration}h total class time)`
        );
    } else {
        console.log(
            `📅 Scheduled ${unit.section_number} continuously on ${day}: ${startTime}-${endTime} (${unit.duration}h)`
        );
    }

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

function getCourseCapacity(course: any): number {
    const capacityFields = [
        "capacity",
        "enrollmentCount",
        "studentCount",
        "maxStudents",
        "enrollment",
        "classSize",
        "students",
    ];

    for (const field of capacityFields) {
        const value = course[field];
        if (value !== undefined && value !== null && value !== "") {
            const numValue =
                typeof value === "string"
                    ? parseInt(value.trim(), 10)
                    : Number(value);
            if (!isNaN(numValue) && numValue >= 0) {
                return numValue;
            }
        }
    }

    return 0;
}

function createSchedulingUnits(coursesData: Course[]): SchedulingUnit[] {
    const schedulingUnits: SchedulingUnit[] = [];

    for (const course of coursesData) {
        for (const section of course.sections) {
            const separatedDurations = section.separatedDurations || [
                course.duration,
            ];
            const courseHoursIds = section.courseHoursIds || [];
            const preferClassroomIds = section.preferClassroomIds || [];

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
                }): [${separatedDurations.join(
                    ", "
                )}] hours with preferences [${preferClassroomIds.join(", ")}]`
            );

            // Create a scheduling unit for each separated duration
            separatedDurations.forEach((duration, index) => {
                const preferClassroomId = preferClassroomIds[index] || null;

                schedulingUnits.push({
                    section_id: section.id,
                    section_number: section.number,
                    course: course,
                    instructor_id: section.instructor_id,
                    prefer_classroom_type_id: preferClassroomId, // Will be resolved to type later
                    prefer_classroom_id: preferClassroomId, // Store the actual classroom preference
                    classroom_id: null, // Will be assigned during scheduling
                    status: section.status,
                    duration: duration,
                    separationIndex: index,
                    courseHours_id: courseHoursIds[index] || undefined,
                });

                console.log(
                    `  - Unit ${index + 1}: ${duration} hour(s) for section ${
                        section.number
                    } (courseHours_id: ${
                        courseHoursIds[index] || "new"
                    }, prefer_classroom: ${preferClassroomId || "none"})`
                );
            });
        }
    }

    console.log(
        `Created ${schedulingUnits.length} total scheduling units from ${coursesData.length} courses`
    );
    return schedulingUnits;
}

async function resolveClassroomTypeFromId(
    preferClassroomId: number | null,
    classroomsData: any[]
): Promise<number | null> {
    if (!preferClassroomId) return null;

    const classroom = classroomsData.find(
        (cls) => cls.id === preferClassroomId
    );
    return classroom ? classroom.classroom_type_id : null;
}

function getSuitableClassroomsForUnit(
    unit: SchedulingUnit,
    classroomsData: any[]
): any[] {
    console.log(
        `Finding suitable classrooms for section ${unit.section_number}...`
    );

    // Handle online sections
    if (unit.status === "online") {
        return [
            { id: -1, code: "Online-1", capacity: 9999, classroom_type_id: -1 },
            { id: -2, code: "Online-2", capacity: 9999, classroom_type_id: -1 },
            { id: -3, code: "Online-3", capacity: 9999, classroom_type_id: -1 },
        ];
    }

    const courseCapacity = getCourseCapacity(unit.course);

    // Get all classrooms that meet capacity requirements
    const capacitySuitableClassrooms = classroomsData.filter((classroom) => {
        const hasEnoughSeats =
            classroom.capacity >= (unit.course.capacity || 0);
        const meetsCapacityRequirement =
            courseCapacity === 0 || classroom.capacity >= courseCapacity;
        return hasEnoughSeats && meetsCapacityRequirement;
    });

    // Separate classrooms by preference - first by specific classroom, then by type
    const specificPreferredClassrooms = [];
    const typePreferredClassrooms = [];
    const otherSuitableClassrooms = [];

    for (const classroom of capacitySuitableClassrooms) {
        // Check for specific classroom preference first
        if (
            unit.prefer_classroom_id &&
            classroom.id === unit.prefer_classroom_id
        ) {
            specificPreferredClassrooms.push(classroom);
        }
        // Then check for classroom type preference
        else if (
            unit.prefer_classroom_type_id &&
            classroom.classroom_type_id === unit.prefer_classroom_type_id
        ) {
            typePreferredClassrooms.push(classroom);
        } else {
            otherSuitableClassrooms.push(classroom);
        }
    }

    // Return in order of preference: specific > type > others
    const allSuitable = [
        ...specificPreferredClassrooms,
        ...typePreferredClassrooms,
        ...otherSuitableClassrooms,
    ];

    console.log(`Found ${allSuitable.length} suitable classrooms:`);
    console.log(
        `  - Specific preference: ${specificPreferredClassrooms.length}`
    );
    console.log(`  - Type preference: ${typePreferredClassrooms.length}`);
    console.log(`  - Other suitable: ${otherSuitableClassrooms.length}`);

    return allSuitable;
}

function scheduleSchedulingUnitWithRetry(
    unit: SchedulingUnit,
    timeConstraints: TimeConstraint[],
    classroomsData: any[],
    instructorsData: any[],
    timeSlots: string[],
    scheduleGrid: ScheduleGrid,
    instructorGrid: InstructorGrid,
    maxClassroomRetries: number = 5 // Maximum classroom alternatives to try
): {
    success: boolean;
    assignment?: Assignment;
    error?: SchedulingError;
    warnings?: string[];
    shouldNullifyDB?: boolean;
} {
    const duration = unit.duration;
    const warnings: string[] = [];

    console.log(
        `\n=== ENHANCED SCHEDULING WITH RETRY: ${unit.section_number} (${unit.course.code}) ===`
    );

    // Get instructor info
    const instructor = instructorsData.find(
        (inst) => inst.id === unit.instructor_id
    );
    const instructorName = instructor
        ? `${instructor.first_name} ${instructor.last_name}`
        : "Unknown";

    // Check instructor assignment first
    if (!unit.instructor_id) {
        return {
            success: false,
            shouldNullifyDB: true,
            error: {
                section_id: unit.section_id,
                section_number: unit.section_number,
                course_code: unit.course.code,
                course_title: unit.course.title,
                instructor_name: "No Instructor Assigned",
                error_type: "INSTRUCTOR_CONFLICT",
                error_message: `Section ${unit.section_number} has no assigned instructor`,
                details: {},
            },
            warnings,
        };
    }

    // Get instructor constraints
    const instructorConstraints = timeConstraints.filter(
        (constraint) => constraint.instructor_id === unit.instructor_id
    );

    // Find possible time slot combinations
    const possibleCombinations = findPossibleTimeSlots(timeSlots, duration);

    if (possibleCombinations.length === 0) {
        return {
            success: false,
            shouldNullifyDB: true,
            error: {
                section_id: unit.section_id,
                section_number: unit.section_number,
                course_code: unit.course.code,
                course_title: unit.course.title,
                instructor_name: instructorName,
                error_type: "DURATION_MISMATCH",
                error_message: `No time slot combinations found for ${duration} hour duration`,
                details: { required_duration: duration },
            },
            warnings,
        };
    }

    const availableDays = [...DAYS];
    shuffleArray(availableDays);

    let lastAttemptError: SchedulingError | null = null;
    let classroomAttempt = 0;

    // RETRY LOOP: Try multiple classroom assignments
    while (classroomAttempt < maxClassroomRetries) {
        classroomAttempt++;
        console.log(
            `\n--- Classroom Assignment Attempt ${classroomAttempt} of ${maxClassroomRetries} ---`
        );

        // Reset classroom_id to trigger new assignment
        unit.classroom_id = null;

        // USE EXISTING assignClassroomToSectionWithTypePreference LOGIC
        unit.classroom_id = assignClassroomToSectionWithTypePreference(
            unit,
            classroomsData
        );

        if (!unit.classroom_id) {
            // If classroom assignment fails completely, no point in retrying
            const courseCapacity = getCourseCapacity(unit.course);
            const suitableClassrooms = classroomsData.filter(
                (cls) =>
                    cls.capacity >= courseCapacity &&
                    cls.capacity >= (unit.course.capacity || 0)
            );

            return {
                success: false,
                shouldNullifyDB: true,
                error: {
                    section_id: unit.section_id,
                    section_number: unit.section_number,
                    course_code: unit.course.code,
                    course_title: unit.course.title,
                    instructor_name: instructorName,
                    error_type:
                        suitableClassrooms.length === 0
                            ? "CAPACITY_CONSTRAINT"
                            : "NO_CLASSROOM",
                    error_message:
                        suitableClassrooms.length === 0
                            ? `No classroom has sufficient capacity for ${courseCapacity} students`
                            : `Failed to assign classroom due to unknown error`,
                    details: {
                        required_capacity: courseCapacity,
                        available_capacity: Math.max(
                            ...classroomsData.map((c) => c.capacity || 0)
                        ),
                        classroom_attempt: classroomAttempt,
                    },
                },
                warnings,
            };
        }

        // Get classroom info for this attempt
        const classroom = classroomsData.find(
            (cls) => cls.id === unit.classroom_id
        );
        const classroomCode = classroom
            ? classroom.code
            : unit.classroom_id === -1 ||
              unit.classroom_id === -2 ||
              unit.classroom_id === -3
            ? "Online"
            : "Unknown";

        console.log(
            `✅ Assigned classroom: ${classroomCode} (ID: ${unit.classroom_id}) - Attempt ${classroomAttempt}`
        );

        // Validate capacity for this classroom
        const capacityValidation = validateSchedulingUnitCapacity(
            unit,
            unit.classroom_id,
            classroomsData
        );

        if (!capacityValidation.isValid) {
            console.log(
                `❌ Capacity validation failed for ${classroomCode}: ${capacityValidation.reason}`
            );

            lastAttemptError = {
                section_id: unit.section_id,
                section_number: unit.section_number,
                course_code: unit.course.code,
                course_title: unit.course.title,
                instructor_name: instructorName,
                error_type: "CAPACITY_CONSTRAINT",
                error_message: `${capacityValidation.reason} (Attempt ${classroomAttempt})`,
                details: {
                    ...capacityValidation.capacityInfo,
                    classroom_attempt: classroomAttempt,
                    attempted_classroom: classroomCode,
                },
            };

            // Try another classroom assignment
            continue;
        }

        // Try to schedule on each day with this assigned classroom
        let scheduledSuccessfully = false;

        for (const day of availableDays) {
            console.log(
                `  Trying to schedule on ${day} with ${classroomCode}...`
            );

            // Get instructor's available time slots for this day
            const dayConstraint = instructorConstraints.find(
                (constraint) => constraint.day === day
            );
            let instructorAvailableTimeSlots: string[];

            if (dayConstraint) {
                instructorAvailableTimeSlots = timeSlots.filter(
                    (slot) => !dayConstraint.timeSlots.includes(slot)
                );
            } else {
                instructorAvailableTimeSlots = [...timeSlots];
            }

            // Sort combinations to prioritize continuous ones
            const sortedCombinations = possibleCombinations.sort((a, b) => {
                const aContinuous = areTimeSlotsContinuous(a);
                const bContinuous = areTimeSlotsContinuous(b);
                if (aContinuous && !bContinuous) return -1;
                if (!aContinuous && bContinuous) return 1;
                return 0;
            });

            // Try each time combination
            for (const combination of sortedCombinations) {
                const validation = validateTimeSlotAssignment(
                    combination,
                    duration,
                    unit.section_number
                );

                if (!validation.isValid) continue;

                // Check if this combination can be scheduled
                const canScheduleResult = canScheduleAtTimeWithDetails(
                    day,
                    combination,
                    unit.classroom_id!,
                    unit.instructor_id,
                    scheduleGrid,
                    instructorGrid,
                    instructorAvailableTimeSlots
                );

                if (canScheduleResult.canSchedule) {
                    // SUCCESS! Mark slots as occupied
                    markSlotsAsOccupied(
                        day,
                        combination,
                        unit.classroom_id!,
                        unit.instructor_id,
                        unit.section_id,
                        scheduleGrid,
                        instructorGrid
                    );

                    console.log(
                        `✅ SUCCESS: Scheduled ${unit.section_number} in ${classroomCode} on ${day}`
                    );
                    console.log(`   Time slots: ${combination.join(", ")}`);
                    console.log(
                        `   Successfully assigned on classroom attempt ${classroomAttempt}`
                    );

                    const assignment = createAssignmentForNonConsecutiveSlots(
                        unit,
                        combination,
                        day,
                        instructorName,
                        classroomCode
                    );

                    return { success: true, assignment, warnings };
                } else {
                    // Store the most recent detailed error
                    lastAttemptError = {
                        section_id: unit.section_id,
                        section_number: unit.section_number,
                        course_code: unit.course.code,
                        course_title: unit.course.title,
                        instructor_name: instructorName,
                        error_type: canScheduleResult.errorType,
                        error_message: `${canScheduleResult.errorMessage} (Classroom: ${classroomCode}, Attempt: ${classroomAttempt})`,
                        details: {
                            attempted_day: day,
                            attempted_time: combination.join(", "),
                            attempted_classroom: classroomCode,
                            classroom_attempt: classroomAttempt,
                            conflicting_course:
                                canScheduleResult.conflictingCourse,
                            conflicting_instructor:
                                canScheduleResult.conflictingInstructor,
                        },
                    };
                }
            }
        }

        // If we reach here, this classroom couldn't be scheduled
        console.log(
            `❌ Could not schedule with ${classroomCode} (attempt ${classroomAttempt}), trying new classroom assignment...`
        );

        // Mark this classroom as "tried" by temporarily removing it from consideration
        // (Optional: You could implement a more sophisticated exclusion mechanism here)
    }

    // If we get here, all classroom assignment attempts failed
    console.log(
        `❌ SCHEDULING FAILED: Tried ${classroomAttempt} different classroom assignments`
    );

    return {
        success: false,
        shouldNullifyDB: true,
        error: lastAttemptError || {
            section_id: unit.section_id,
            section_number: unit.section_number,
            course_code: unit.course.code,
            course_title: unit.course.title,
            instructor_name: instructorName,
            error_type: "NO_AVAILABLE_SLOTS",
            error_message: `Failed to schedule after ${classroomAttempt} classroom assignment attempts`,
            details: {
                required_duration: duration,
                classroom_attempt: classroomAttempt,
            },
        },
        warnings,
    };
}

function validateTimeSlotAssignment(
    slotCombination: string[],
    durationHours: number,
    sectionNumber: string
): {
    isValid: boolean;
    actualDuration: number;
    message: string;
    hasGaps: boolean;
    assignmentType: "continuous" | "adjacent" | "dispersed";
} {
    if (slotCombination.length === 0) {
        return {
            isValid: false,
            actualDuration: 0,
            message: `No time slots provided for section ${sectionNumber}`,
            hasGaps: false,
            assignmentType: "dispersed",
        };
    }

    const actualDuration = calculateCombinationDuration(slotCombination);
    const tolerance = 0.01;

    // Check if the total duration matches exactly
    if (Math.abs(actualDuration - durationHours) > tolerance) {
        return {
            isValid: false,
            actualDuration: actualDuration,
            message: `Duration mismatch for section ${sectionNumber}: available ${actualDuration}h, needed ${durationHours}h`,
            hasGaps: false,
            assignmentType: "dispersed",
        };
    }

    // Determine assignment type
    const isContinuous = areTimeSlotsContinuous(slotCombination);
    const isAdjacent = areTimeSlotsAdjacent(slotCombination);

    let assignmentType: "continuous" | "adjacent" | "dispersed";
    if (isContinuous) {
        assignmentType = "continuous";
    } else if (isAdjacent) {
        assignmentType = "adjacent";
    } else {
        assignmentType = "dispersed";
    }

    return {
        isValid: true,
        actualDuration: actualDuration,
        message: `Valid ${assignmentType} assignment for section ${sectionNumber}: ${slotCombination.join(
            ", "
        )} (${actualDuration}h)`,
        hasGaps: !isContinuous,
        assignmentType: assignmentType,
    };
}
function findGapTolerantCombinations(
    timeSlots: string[],
    durationHours: number,
    tolerance: number
): string[][] {
    console.log(`Finding gap-tolerant combinations for ${durationHours} hours`);

    const combinations: string[][] = [];

    // Generate all possible subsets of time slots
    const allSubsets = generateAllSubsets(timeSlots);

    for (const subset of allSubsets) {
        if (subset.length === 0) continue;

        const totalDuration = calculateCombinationDuration(subset);

        // Check if this combination exactly matches the required duration
        if (Math.abs(totalDuration - durationHours) < tolerance) {
            // Sort the subset by start time to ensure proper ordering
            const sortedSubset = subset.sort((a, b) => {
                const startA = a.split("-")[0];
                const startB = b.split("-")[0];
                return startA.localeCompare(startB);
            });

            // Check if it's already continuous (avoid duplicates)
            if (!areTimeSlotsContinuous(sortedSubset)) {
                combinations.push(sortedSubset);
                console.log(
                    `✅ Found gap-tolerant combination: ${sortedSubset.join(
                        ", "
                    )} = ${totalDuration}h (with gaps)`
                );
            }
        }
    }

    return combinations;
}

async function updateSchedulingUnitsWithClassroomTypes(
    units: SchedulingUnit[],
    classroomsData: any[]
): Promise<SchedulingUnit[]> {
    return units.map((unit) => {
        if (unit.prefer_classroom_id) {
            const classroom = classroomsData.find(
                (cls) => cls.id === unit.prefer_classroom_id
            );
            if (classroom) {
                unit.prefer_classroom_type_id = classroom.classroom_type_id;
                console.log(
                    `Resolved classroom ID ${unit.prefer_classroom_id} to type ${classroom.classroom_type_id} for unit ${unit.section_number}`
                );
            }
        }
        return unit;
    });
}

function generateScheduleWithErrorTracking(
    coursesData: Course[],
    timeConstraints: TimeConstraint[],
    classroomsData: any[],
    instructorsData: any[],
    timeSlots: string[]
): {
    assignments: Assignment[];
    errors: SchedulingError[];
    warnings: string[];
    failedUnits: { unit: SchedulingUnit; courseHoursId?: number }[];
} {
    console.log(
        "=== STARTING ENHANCED SCHEDULE GENERATION WITH COURSEHOURS PREFERENCES ==="
    );

    const assignments: Assignment[] = [];
    const errors: SchedulingError[] = [];
    const warnings: string[] = [];
    const failedUnits: { unit: SchedulingUnit; courseHoursId?: number }[] = [];
    const scheduleGrid = initializeScheduleGrid(classroomsData, timeSlots);
    const instructorGrid = initializeInstructorGrid(instructorsData, timeSlots);

    // Create scheduling units from courses
    let schedulingUnits = createSchedulingUnits(coursesData);

    // Resolve classroom types for units that have specific classroom preferences
    schedulingUnits = schedulingUnits.map((unit) => {
        if (unit.prefer_classroom_id) {
            const classroom = classroomsData.find(
                (cls) => cls.id === unit.prefer_classroom_id
            );
            if (classroom) {
                unit.prefer_classroom_type_id = classroom.classroom_type_id;
                console.log(
                    `Resolved classroom ID ${unit.prefer_classroom_id} to type ${classroom.classroom_type_id} for unit ${unit.section_number}`
                );
            }
        }
        return unit;
    });

    // Sort by duration and priority as before
    schedulingUnits.sort((a, b) => {
        if (Math.abs(b.duration - a.duration) > 0.01) {
            return b.duration - a.duration;
        }
        const aHasConstraints = timeConstraints.some(
            (tc) => tc.instructor_id === a.instructor_id
        );
        const bHasConstraints = timeConstraints.some(
            (tc) => tc.instructor_id === b.instructor_id
        );
        if (aHasConstraints && !bHasConstraints) return -1;
        if (!aHasConstraints && bHasConstraints) return 1;
        return 0;
    });

    console.log(
        `Processing ${schedulingUnits.length} scheduling units with courseHours-based preferences...`
    );

    for (const unit of schedulingUnits) {
        console.log(
            `\nProcessing: Section ${unit.section_number} of ${
                unit.course.code
            } (${unit.duration}h, Part ${
                unit.separationIndex + 1
            }, Prefer Classroom: ${unit.prefer_classroom_id || "none"})`
        );

        const result = scheduleSchedulingUnitWithRetry(
            unit,
            timeConstraints,
            classroomsData,
            instructorsData,
            timeSlots,
            scheduleGrid,
            instructorGrid
        );

        if (result.success && result.assignment) {
            assignments.push(result.assignment);
            console.log(
                `✅ Successfully scheduled unit ${unit.section_number} part ${
                    unit.separationIndex + 1
                }`
            );
        } else {
            errors.push(result.error!);

            if (result.shouldNullifyDB) {
                failedUnits.push({
                    unit: unit,
                    courseHoursId: unit.courseHours_id,
                });
            }

            console.log(
                `❌ Failed to schedule unit ${unit.section_number} part ${
                    unit.separationIndex + 1
                }: ${result.error?.error_message}`
            );
        }

        if (result.warnings) {
            warnings.push(...result.warnings);
        }
    }

    console.log(
        `\n=== ENHANCED SCHEDULE GENERATION WITH COURSEHOURS PREFERENCES COMPLETED ===`
    );
    console.log(
        `Generated ${assignments.length} assignments out of ${schedulingUnits.length} units.`
    );
    console.log(
        `${errors.length} units failed with detailed error information.`
    );
    console.log(`${failedUnits.length} units need database nullification.`);

    return { assignments, errors, warnings, failedUnits };
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
    console.log(`=== ASSIGNING CLASSROOM TO SECTION ${section.number} ===`);

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

    // Get course capacity for filtering
    const citygetCourseCapa = (course: any): number => {
        const capacityFields = [
            "capacity",
            "enrollmentCount",
            "studentCount",
            "maxStudents",
            "enrollment",
            "classSize",
        ];
        for (const field of capacityFields) {
            const value = course[field];
            if (value !== undefined && value !== null && value !== "") {
                const numValue =
                    typeof value === "string"
                        ? parseInt(value.trim(), 10)
                        : Number(value);
                if (!isNaN(numValue) && numValue >= 0) {
                    return numValue;
                }
            }
        }
        return 0;
    };

    const courseCapacity = getCourseCapacity(section.course);
    console.log(`Course capacity needed: ${courseCapacity}`);

    // Filter classrooms by capacity AND course capacity requirements
    const suitableClassrooms = classroomsData.filter((classroom) => {
        // First check: classroom must have enough seats for the course's base capacity
        const hasEnoughSeats =
            classroom.capacity >= (section.course.capacity || 0);

        // Second check: classroom must have enough seats for the actual course enrollment
        const meetsCapacityRequirement =
            courseCapacity === 0 || classroom.capacity >= courseCapacity;

        console.log(
            `Classroom ${classroom.code}: capacity=${
                classroom.capacity
            }, courseCapacity=${courseCapacity}, suitable=${
                hasEnoughSeats && meetsCapacityRequirement
            }`
        );

        return hasEnoughSeats && meetsCapacityRequirement;
    });

    console.log(
        `Found ${suitableClassrooms.length} suitable classrooms out of ${classroomsData.length} total`
    );

    if (suitableClassrooms.length === 0) {
        console.log("❌ No suitable classrooms found with adequate capacity");

        // Log details about why classrooms were rejected
        classroomsData.forEach((classroom) => {
            const reason =
                classroom.capacity < courseCapacity
                    ? `too small (${classroom.capacity} < ${courseCapacity})`
                    : "other criteria not met";
            console.log(`  - ${classroom.code}: ${reason}`);
        });

        return null;
    }

    // Randomly select from suitable classrooms
    const randomIndex = Math.floor(Math.random() * suitableClassrooms.length);
    const assignedClassroom = suitableClassrooms[randomIndex];

    console.log(
        `✅ Assigned classroom: ${assignedClassroom.code} (capacity: ${assignedClassroom.capacity})`
    );
    return assignedClassroom.id;
}

function assignClassroomToSectionWithTypePreference(
    unit: SchedulingUnit,
    classroomsData: any[],
    excludeClassroomIds: number[] = []
): number | null {
    console.log(
        `=== ASSIGNING CLASSROOM WITH COURSEOUR-BASED PREFERENCES TO UNIT ${unit.section_number} ===`
    );

    if (excludeClassroomIds.length > 0) {
        console.log(
            `   Excluding previously tried classrooms: ${excludeClassroomIds.join(
                ", "
            )}`
        );
    }

    // Handle online sections first
    if (unit.status === "online") {
        const onlineClassroomIds = [-1, -2, -3];
        const availableOnlineIds = onlineClassroomIds.filter(
            (id) => !excludeClassroomIds.includes(id)
        );

        if (availableOnlineIds.length === 0) {
            console.log("❌ All online classrooms have been tried");
            return null;
        }

        const randomIndex = Math.floor(
            Math.random() * availableOnlineIds.length
        );
        console.log(
            `✅ Assigned online section to Online Classroom ${Math.abs(
                availableOnlineIds[randomIndex]
            )}`
        );
        return availableOnlineIds[randomIndex];
    }

    // Filter out excluded classrooms
    const availableClassrooms = classroomsData.filter(
        (classroom) => !excludeClassroomIds.includes(classroom.id)
    );

    if (availableClassrooms.length === 0) {
        console.log("❌ All classrooms have been tried");
        return null;
    }

    // Get course capacity requirements
    const courseCapacity = getCourseCapacity(unit.course);
    console.log(`📊 Course capacity needed: ${courseCapacity}`);

    // Filter ALL classrooms by capacity requirements
    const capacitySuitableClassrooms = availableClassrooms.filter(
        (classroom) => {
            const hasEnoughSeats =
                classroom.capacity >= (unit.course.capacity || 0);
            const meetsCapacityRequirement =
                courseCapacity === 0 || classroom.capacity >= courseCapacity;
            return hasEnoughSeats && meetsCapacityRequirement;
        }
    );

    console.log(
        `📊 Found ${capacitySuitableClassrooms.length} capacity-suitable classrooms`
    );

    if (capacitySuitableClassrooms.length === 0) {
        console.log("❌ No classrooms meet capacity requirements");
        return null;
    }

    // PRIORITY 1: Check for specific classroom preference from courseHours
    if (unit.prefer_classroom_id) {
        console.log(
            `🎯 HIGHEST PRIORITY: Unit prefers specific classroom ID ${unit.prefer_classroom_id}`
        );

        const specificPreferredClassroom = capacitySuitableClassrooms.find(
            (classroom) => classroom.id === unit.prefer_classroom_id
        );

        if (specificPreferredClassroom) {
            console.log(
                `✅ SPECIFIC CLASSROOM ASSIGNED: ${specificPreferredClassroom.code} (ID: ${specificPreferredClassroom.id})`
            );
            console.log(
                `🎯 Highest priority satisfied - used preferred specific classroom!`
            );
            return specificPreferredClassroom.id;
        } else {
            console.log(
                `⚠️ Preferred specific classroom ${unit.prefer_classroom_id} is not available or doesn't meet capacity`
            );
        }
    }

    // PRIORITY 2: Check for classroom type preference
    const hasTypePreference =
        unit.prefer_classroom_type_id !== null &&
        unit.prefer_classroom_type_id !== undefined;

    if (hasTypePreference) {
        console.log(
            `🎯 SECONDARY PRIORITY: Unit prefers classroom type ${unit.prefer_classroom_type_id}`
        );

        const preferredTypeClassrooms = capacitySuitableClassrooms.filter(
            (classroom) =>
                classroom.classroom_type_id === unit.prefer_classroom_type_id
        );

        if (preferredTypeClassrooms.length > 0) {
            const randomIndex = Math.floor(
                Math.random() * preferredTypeClassrooms.length
            );
            const selectedClassroom = preferredTypeClassrooms[randomIndex];

            console.log(
                `✅ TYPE PREFERENCE ASSIGNED: ${selectedClassroom.code} (Type: ${selectedClassroom.classroom_type_id})`
            );
            console.log(
                `🎯 Secondary priority satisfied - used preferred classroom type!`
            );
            return selectedClassroom.id;
        } else {
            console.log(
                `⚠️ No classrooms of preferred type ${unit.prefer_classroom_type_id} are available`
            );
        }
    }

    // FALLBACK: Select from ANY capacity-suitable classroom
    console.log(
        `📋 FALLBACK ASSIGNMENT: Selecting from any suitable classroom`
    );

    const randomIndex = Math.floor(
        Math.random() * capacitySuitableClassrooms.length
    );
    const assignedClassroom = capacitySuitableClassrooms[randomIndex];

    console.log(
        `✅ FALLBACK ASSIGNED: ${assignedClassroom.code} (Type: ${assignedClassroom.classroom_type_id})`
    );

    if (unit.prefer_classroom_id || hasTypePreference) {
        console.log(
            `⚠️ Note: Preferences were not available, used fallback assignment`
        );
    }

    return assignedClassroom.id;
}
function scheduleWithPriorityBasedClassroomAssignment(
    unit: SchedulingUnit,
    timeConstraints: TimeConstraint[],
    classroomsData: any[],
    instructorsData: any[],
    timeSlots: string[],
    scheduleGrid: ScheduleGrid,
    instructorGrid: InstructorGrid,
    maxClassroomRetries: number = 5
): {
    success: boolean;
    assignment?: Assignment;
    error?: SchedulingError;
    warnings?: string[];
    shouldNullifyDB?: boolean;
} {
    const duration = unit.duration;
    const warnings: string[] = [];

    console.log(
        `\n=== PRIORITY-BASED CLASSROOM SCHEDULING: ${unit.section_number} (${unit.course.code}) ===`
    );

    // Get instructor info
    const instructor = instructorsData.find(
        (inst) => inst.id === unit.instructor_id
    );
    const instructorName = instructor
        ? `${instructor.first_name} ${instructor.last_name}`
        : "Unknown";

    // Check instructor assignment
    if (!unit.instructor_id) {
        return {
            success: false,
            shouldNullifyDB: true,
            error: {
                section_id: unit.section_id,
                section_number: unit.section_number,
                course_code: unit.course.code,
                course_title: unit.course.title,
                instructor_name: "No Instructor Assigned",
                error_type: "INSTRUCTOR_CONFLICT",
                error_message: `Section ${unit.section_number} has no assigned instructor`,
                details: {},
            },
            warnings,
        };
    }

    // Get course capacity and check if ANY classrooms can accommodate this course
    const courseCapacity = getCourseCapacity(unit.course);
    const suitableClassrooms = classroomsData.filter((classroom) => {
        const hasEnoughSeats =
            classroom.capacity >= (unit.course.capacity || 0);
        const meetsCapacityRequirement =
            courseCapacity === 0 || classroom.capacity >= courseCapacity;
        return hasEnoughSeats && meetsCapacityRequirement;
    });

    if (suitableClassrooms.length === 0) {
        return {
            success: false,
            shouldNullifyDB: true,
            error: {
                section_id: unit.section_id,
                section_number: unit.section_number,
                course_code: unit.course.code,
                course_title: unit.course.title,
                instructor_name: instructorName,
                error_type: "CAPACITY_CONSTRAINT",
                error_message: `No classrooms have sufficient capacity for ${courseCapacity} students`,
                details: {
                    required_capacity: courseCapacity,
                    available_capacity: Math.max(
                        ...classroomsData.map((c) => c.capacity || 0)
                    ),
                },
            },
            warnings,
        };
    }

    console.log(
        `📊 ${suitableClassrooms.length} classrooms can accommodate this course (any type)`
    );

    // Check type preference info for logging
    const hasTypePreference =
        unit.prefer_classroom_type_id !== null &&
        unit.prefer_classroom_type_id !== undefined;

    if (hasTypePreference) {
        const preferredTypeCount = suitableClassrooms.filter(
            (c) => c.classroom_type_id === unit.prefer_classroom_type_id
        ).length;

        console.log(`🎯 Course prefers type ${unit.prefer_classroom_type_id}`);
        console.log(
            `🎯 ${preferredTypeCount} suitable classrooms of preferred type available`
        );

        if (preferredTypeCount === 0) {
            warnings.push(
                `Section ${unit.section_number} prefers classroom type ${unit.prefer_classroom_type_id}, but none are available with sufficient capacity. Will use any suitable classroom.`
            );
        }
    }

    // Get instructor constraints and find possible time combinations
    const instructorConstraints = timeConstraints.filter(
        (constraint) => constraint.instructor_id === unit.instructor_id
    );

    const possibleCombinations = findPossibleTimeSlots(timeSlots, duration);
    if (possibleCombinations.length === 0) {
        return {
            success: false,
            shouldNullifyDB: true,
            error: {
                section_id: unit.section_id,
                section_number: unit.section_number,
                course_code: unit.course.code,
                course_title: unit.course.title,
                instructor_name: instructorName,
                error_type: "DURATION_MISMATCH",
                error_message: `No time slot combinations found for ${duration} hour duration`,
                details: { required_duration: duration },
            },
            warnings,
        };
    }

    const availableDays = [...DAYS];
    shuffleArray(availableDays);

    let lastAttemptError: SchedulingError | null = null;
    let classroomAttempt = 0;
    const excludedClassrooms: number[] = [];

    // RETRY LOOP with priority-based classroom assignment
    while (classroomAttempt < maxClassroomRetries) {
        classroomAttempt++;
        console.log(
            `\n--- Priority-Based Classroom Assignment Attempt ${classroomAttempt} of ${maxClassroomRetries} ---`
        );

        // Reset and assign new classroom using priority-based approach
        unit.classroom_id = assignClassroomToSectionWithTypePreference(
            unit,
            classroomsData,
            excludedClassrooms
        );

        if (!unit.classroom_id) {
            return {
                success: false,
                shouldNullifyDB: true,
                error: {
                    section_id: unit.section_id,
                    section_number: unit.section_number,
                    course_code: unit.course.code,
                    course_title: unit.course.title,
                    instructor_name: instructorName,
                    error_type: "NO_CLASSROOM",
                    error_message: `No more suitable classrooms available after ${excludedClassrooms.length} attempts`,
                    details: {
                        classroom_attempt: classroomAttempt,
                        excluded_classrooms: excludedClassrooms.length,
                        total_suitable: suitableClassrooms.length,
                    },
                },
                warnings,
            };
        }

        const classroom = classroomsData.find(
            (cls) => cls.id === unit.classroom_id
        );
        const classroomCode = classroom
            ? classroom.code
            : unit.classroom_id < 0
            ? "Online"
            : "Unknown";

        console.log(
            `✅ Trying classroom: ${classroomCode} (Type: ${
                classroom?.classroom_type_id || "N/A"
            }) - Attempt ${classroomAttempt}`
        );

        // Try to schedule on each day
        let scheduledSuccessfully = false;

        for (const day of availableDays) {
            console.log(
                `  Trying to schedule on ${day} with ${classroomCode}...`
            );

            // Get instructor's available time slots for this day
            const dayConstraint = instructorConstraints.find(
                (constraint) => constraint.day === day
            );
            let instructorAvailableTimeSlots: string[];

            if (dayConstraint) {
                instructorAvailableTimeSlots = timeSlots.filter(
                    (slot) => !dayConstraint.timeSlots.includes(slot)
                );
            } else {
                instructorAvailableTimeSlots = [...timeSlots];
            }

            // Sort combinations to prioritize continuous ones
            const sortedCombinations = possibleCombinations.sort((a, b) => {
                const aContinuous = areTimeSlotsContinuous(a);
                const bContinuous = areTimeSlotsContinuous(b);
                if (aContinuous && !bContinuous) return -1;
                if (!aContinuous && bContinuous) return 1;
                return 0;
            });

            // Try each time combination
            for (const combination of sortedCombinations) {
                const validation = validateTimeSlotAssignment(
                    combination,
                    duration,
                    unit.section_number
                );
                if (!validation.isValid) continue;

                const canScheduleResult = canScheduleAtTimeWithDetails(
                    day,
                    combination,
                    unit.classroom_id!,
                    unit.instructor_id,
                    scheduleGrid,
                    instructorGrid,
                    instructorAvailableTimeSlots
                );

                if (canScheduleResult.canSchedule) {
                    // SUCCESS!
                    markSlotsAsOccupied(
                        day,
                        combination,
                        unit.classroom_id!,
                        unit.instructor_id,
                        unit.section_id,
                        scheduleGrid,
                        instructorGrid
                    );

                    console.log(
                        `✅ SUCCESS: Scheduled ${unit.section_number} in ${classroomCode} on ${day}`
                    );
                    console.log(`   Time slots: ${combination.join(", ")}`);

                    // Log priority satisfaction
                    if (hasTypePreference && classroom) {
                        const gotPreferredType =
                            classroom.classroom_type_id ===
                            unit.prefer_classroom_type_id;

                        if (gotPreferredType) {
                            console.log(
                                `🎯 PRIORITY SATISFIED: Got preferred classroom type ${unit.prefer_classroom_type_id}!`
                            );
                        } else {
                            console.log(
                                `📋 FALLBACK USED: Got type ${classroom.classroom_type_id}, preferred was ${unit.prefer_classroom_type_id}`
                            );
                            console.log(
                                `   (Preferred type classrooms were likely full)`
                            );
                        }
                    }

                    const assignment = createAssignmentForNonConsecutiveSlots(
                        unit,
                        combination,
                        day,
                        instructorName,
                        classroomCode
                    );

                    return { success: true, assignment, warnings };
                } else {
                    lastAttemptError = {
                        section_id: unit.section_id,
                        section_number: unit.section_number,
                        course_code: unit.course.code,
                        course_title: unit.course.title,
                        instructor_name: instructorName,
                        error_type: canScheduleResult.errorType,
                        error_message: `${canScheduleResult.errorMessage} (Classroom: ${classroomCode}, Attempt: ${classroomAttempt})`,
                        details: {
                            attempted_day: day,
                            attempted_time: combination.join(", "),
                            attempted_classroom: classroomCode,
                            classroom_attempt: classroomAttempt,
                        },
                    };
                }
            }
        }

        // This classroom didn't work, exclude it from future attempts
        excludedClassrooms.push(unit.classroom_id);
        console.log(
            `❌ Could not schedule with ${classroomCode}, excluding it from future attempts`
        );
    }

    // All attempts failed
    return {
        success: false,
        shouldNullifyDB: true,
        error: lastAttemptError || {
            section_id: unit.section_id,
            section_number: unit.section_number,
            course_code: unit.course.code,
            course_title: unit.course.title,
            instructor_name: instructorName,
            error_type: "NO_AVAILABLE_SLOTS",
            error_message: `Failed to schedule after trying ${classroomAttempt} different classrooms`,
            details: {
                required_duration: duration,
                classroom_attempts: classroomAttempt,
                excluded_classrooms: excludedClassrooms.length,
                total_suitable_classrooms: suitableClassrooms.length,
            },
        },
        warnings,
    };
}

function findConsecutiveCombinations(
    timeSlots: string[],
    durationHours: number,
    tolerance: number
): string[][] {
    const combinations: string[][] = [];

    // Try all possible starting positions for consecutive slots
    for (let startIndex = 0; startIndex < timeSlots.length; startIndex++) {
        const result = findContinuousTimeSlotCombination(
            timeSlots,
            startIndex,
            durationHours,
            tolerance
        );
        if (result && result.length > 0) {
            // Verify the combination is truly continuous
            if (areTimeSlotsContinuous(result)) {
                combinations.push(result);
                console.log(
                    `✅ Found continuous combination starting at index ${startIndex}: ${result.join(
                        ", "
                    )}`
                );
            } else {
                console.log(
                    `❌ Rejected non-continuous combination: ${result.join(
                        ", "
                    )}`
                );
            }
        }
    }

    return combinations;
}
async function handleFailedAssignment(
    sectionId: number,
    courseHoursId?: number
): Promise<void> {
    try {
        if (courseHoursId) {
            // Update existing courseHours record to set scheduling fields to null
            await db
                .update(courseHours)
                .set({
                    day: null,
                    timeSlot: null,
                    classroomId: null,
                })
                .where(eq(courseHours.id, courseHoursId));

            console.log(
                `✅ Set courseHours ID ${courseHoursId} fields to null for failed assignment (section ${sectionId})`
            );
        } else {
            // For sections without courseHours_id, we might need to find existing records
            // or create a new record with null values
            const existingCourseHours = await db
                .select()
                .from(courseHours)
                .where(eq(courseHours.sectionId, sectionId));

            if (existingCourseHours.length > 0) {
                // Update all existing courseHours for this section
                await db
                    .update(courseHours)
                    .set({
                        day: null,
                        timeSlot: null,
                        classroomId: null,
                    })
                    .where(eq(courseHours.sectionId, sectionId));

                console.log(
                    `✅ Set ${existingCourseHours.length} courseHours records to null for failed assignment (section ${sectionId})`
                );
            } else {
                // Optionally create a new courseHours record with null values
                await db.insert(courseHours).values({
                    day: null,
                    timeSlot: null,
                    separatedDuration: null,
                    classroomId: null,
                    sectionId: sectionId,
                });

                console.log(
                    `✅ Created new courseHours record with null values for failed assignment (section ${sectionId})`
                );
            }
        }
    } catch (error) {
        console.error(
            `❌ Error handling failed assignment for section ${sectionId}:`,
            error
        );
    }
}
function findPossibleTimeSlots(
    timeSlots: string[],
    durationHours: number
): string[][] {
    console.log(
        `Finding all possible combinations for ${durationHours} hours from ${timeSlots.length} slots`
    );

    const combinations: string[][] = [];
    const tolerance = 0.01;

    // Strategy 1: Try continuous combinations first (highest priority)
    console.log("=== Strategy 1: Looking for continuous combinations ===");
    const consecutiveCombinations = findConsecutiveCombinations(
        timeSlots,
        durationHours,
        tolerance
    );

    if (consecutiveCombinations.length > 0) {
        combinations.push(...consecutiveCombinations);
        console.log(
            `✅ Found ${consecutiveCombinations.length} continuous combinations`
        );
    }

    // Strategy 2: Try adjacent combinations (allowing small gaps)
    console.log("=== Strategy 2: Looking for adjacent combinations ===");
    const adjacentCombinations = findAdjacentTimeSlotCombinations(
        timeSlots,
        durationHours,
        tolerance
    );

    if (adjacentCombinations.length > 0) {
        combinations.push(...adjacentCombinations);
        console.log(
            `✅ Found ${adjacentCombinations.length} adjacent combinations`
        );
    }

    // Strategy 3: Fallback to any valid combination (if needed)
    if (combinations.length === 0) {
        console.log("=== Strategy 3: Looking for any valid combinations ===");
        const fallbackCombinations = findAllValidCombinations(
            timeSlots,
            durationHours,
            tolerance
        );

        if (fallbackCombinations.length > 0) {
            combinations.push(...fallbackCombinations);
            console.log(
                `✅ Found ${fallbackCombinations.length} fallback combinations`
            );
        }
    }

    // Remove duplicates and prioritize by type
    const uniqueCombinations = removeDuplicateCombinations(combinations);

    // Sort combinations: continuous first, then adjacent, then others
    uniqueCombinations.sort((a, b) => {
        const aContinuous = areTimeSlotsContinuous(a);
        const bContinuous = areTimeSlotsContinuous(b);
        const aAdjacent = areTimeSlotsAdjacent(a);
        const bAdjacent = areTimeSlotsAdjacent(b);

        if (aContinuous && !bContinuous) return -1;
        if (!aContinuous && bContinuous) return 1;
        if (aAdjacent && !bAdjacent) return -1;
        if (!aAdjacent && bAdjacent) return 1;
        return 0;
    });

    console.log(
        `Generated ${uniqueCombinations.length} total combinations for ${durationHours} hours`
    );

    // Log the example you mentioned
    if (Math.abs(durationHours - 1.66) < tolerance) {
        console.log("\n=== Example for 1.66h course ===");
        console.log(
            "Available slots: 08:00-08:50 (0.83h), 09:00-09:50 (0.83h), 10:00-10:50 (0.83h)"
        );
        console.log("Expected combinations:");
        console.log("1. [08:00-08:50, 09:00-09:50] = 1.66h");
        console.log("2. [09:00-09:50, 10:00-10:50] = 1.66h");

        uniqueCombinations.forEach((combo, index) => {
            const totalDuration = calculateCombinationDuration(combo);
            const isAdjacent = areTimeSlotsAdjacent(combo);
            console.log(
                `Found combination ${index + 1}: [${combo.join(
                    ", "
                )}] = ${totalDuration}h (adjacent: ${isAdjacent})`
            );
        });
    }

    return uniqueCombinations;
}

function areTimeSlotsAdjacent(slotCombination: string[]): boolean {
    if (slotCombination.length <= 1) return true;

    // Sort slots by start time
    const sortedSlots = [...slotCombination].sort((a, b) => {
        const startA = a.split("-")[0];
        const startB = b.split("-")[0];
        return startA.localeCompare(startB);
    });

    // Check each adjacent pair - allow small gaps (like 10 minutes)
    for (let i = 0; i < sortedSlots.length - 1; i++) {
        const currentSlot = sortedSlots[i];
        const nextSlot = sortedSlots[i + 1];

        const currentEndTime = currentSlot.split("-")[1];
        const nextStartTime = nextSlot.split("-")[0];

        // Calculate gap in minutes
        const currentEnd = timeToMinutes(currentEndTime);
        const nextStart = timeToMinutes(nextStartTime);
        const gapMinutes = nextStart - currentEnd;

        // Allow gaps up to 30 minutes (adjustable)
        const maxGapMinutes = 30;

        if (gapMinutes > maxGapMinutes) {
            console.log(
                `❌ Gap too large between ${currentSlot} and ${nextSlot}: ${gapMinutes} minutes`
            );
            return false;
        }

        if (gapMinutes < 0) {
            console.log(
                `❌ Time slots overlap: ${currentSlot} and ${nextSlot}`
            );
            return false;
        }
    }

    return true;
}

// Helper function to convert time string to minutes
function timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

// Fallback function to find any valid combinations
function findAllValidCombinations(
    timeSlots: string[],
    durationHours: number,
    tolerance: number
): string[][] {
    console.log(`Finding any valid combinations for ${durationHours} hours`);

    const combinations: string[][] = [];

    // Use a more efficient approach instead of generating all subsets
    // Try combinations of increasing length
    for (
        let comboLength = 1;
        comboLength <= Math.min(timeSlots.length, 5);
        comboLength++
    ) {
        const combos = generateCombinationsOfLength(timeSlots, comboLength);

        for (const combo of combos) {
            const totalDuration = calculateCombinationDuration(combo);

            if (Math.abs(totalDuration - durationHours) < tolerance) {
                // Sort by start time
                const sortedCombo = combo.sort((a, b) => {
                    const startA = a.split("-")[0];
                    const startB = b.split("-")[0];
                    return startA.localeCompare(startB);
                });

                combinations.push(sortedCombo);
                console.log(
                    `✅ Found valid combination: [${sortedCombo.join(
                        ", "
                    )}] = ${totalDuration}h`
                );
            }
        }

        // If we found combinations, prioritize shorter combinations
        if (combinations.length > 0) {
            break;
        }
    }

    return combinations;
}

function generateCombinationsOfLength(
    arr: string[],
    length: number
): string[][] {
    if (length === 1) {
        return arr.map((item) => [item]);
    }

    const combinations: string[][] = [];

    for (let i = 0; i <= arr.length - length; i++) {
        const rest = generateCombinationsOfLength(arr.slice(i + 1), length - 1);
        for (const combination of rest) {
            combinations.push([arr[i], ...combination]);
        }
    }

    return combinations;
}

function findAdjacentTimeSlotCombinations(
    timeSlots: string[],
    durationHours: number,
    tolerance: number = 0.01
): string[][] {
    console.log(
        `Finding adjacent combinations for ${durationHours} hours from ${timeSlots.length} slots`
    );

    const combinations: string[][] = [];

    // Try all possible starting positions
    for (let startIndex = 0; startIndex < timeSlots.length; startIndex++) {
        const startSlot = timeSlots[startIndex];
        const startDuration = calculateTimeSlotDuration(startSlot);

        console.log(
            `Trying start slot ${startSlot} (${startDuration}h) at index ${startIndex}`
        );

        // If single slot matches exactly
        if (Math.abs(startDuration - durationHours) < tolerance) {
            combinations.push([startSlot]);
            console.log(`✅ Single slot exact match: ${startSlot}`);
            continue;
        }

        // If start slot is larger than required duration, skip
        if (startDuration > durationHours + tolerance) {
            console.log(
                `❌ Start slot too large: ${startDuration}h > ${durationHours}h`
            );
            continue;
        }

        // Build combination with adjacent slots
        const combination = [startSlot];
        let totalDuration = startDuration;
        let remainingDuration = durationHours - startDuration;

        // Look for adjacent slots (allowing gaps)
        for (
            let nextIndex = startIndex + 1;
            nextIndex < timeSlots.length;
            nextIndex++
        ) {
            const nextSlot = timeSlots[nextIndex];
            const nextDuration = calculateTimeSlotDuration(nextSlot);

            console.log(
                `  Checking next slot: ${nextSlot} (${nextDuration}h), remaining: ${remainingDuration}h`
            );

            // If this slot exactly matches remaining duration
            if (Math.abs(nextDuration - remainingDuration) < tolerance) {
                combination.push(nextSlot);
                totalDuration += nextDuration;
                console.log(
                    `✅ Found exact adjacent match: [${combination.join(
                        ", "
                    )}] = ${totalDuration}h`
                );
                combinations.push([...combination]);
                break;
            }

            // If this slot is smaller than remaining duration, add it and continue
            if (nextDuration < remainingDuration - tolerance) {
                combination.push(nextSlot);
                totalDuration += nextDuration;
                remainingDuration -= nextDuration;
                console.log(
                    `  Added slot: ${nextSlot}, total: ${totalDuration}h, remaining: ${remainingDuration}h`
                );

                // Check if we're close enough to the target
                if (remainingDuration < tolerance) {
                    console.log(
                        `✅ Found complete adjacent combination: [${combination.join(
                            ", "
                        )}] = ${totalDuration}h`
                    );
                    combinations.push([...combination]);
                    break;
                }
                continue;
            }

            // If this slot is larger than remaining duration, we can't use it
            if (nextDuration > remainingDuration + tolerance) {
                console.log(
                    `❌ Next slot too large: ${nextDuration}h > ${remainingDuration}h remaining`
                );
                break;
            }
        }
    }

    console.log(`Found ${combinations.length} adjacent combinations`);
    return combinations;
}

function findContinuousTimeSlotCombination(
    timeSlots: string[],
    startIndex: number,
    durationHours: number,
    tolerance: number
): string[] | null {
    console.log(
        `Trying to build continuous combination starting from index ${startIndex}`
    );

    const combination: string[] = [];
    let totalDuration = 0;
    let currentIndex = startIndex;

    while (
        currentIndex < timeSlots.length &&
        totalDuration < durationHours - tolerance
    ) {
        const currentSlot = timeSlots[currentIndex];
        const slotDuration = calculateTimeSlotDuration(currentSlot);

        // If adding this slot would exceed the required duration, check if we can use it
        if (totalDuration + slotDuration > durationHours + tolerance) {
            console.log(
                `❌ Adding slot ${currentSlot} would exceed duration (${
                    totalDuration + slotDuration
                } > ${durationHours})`
            );
            break;
        }

        // If this is not the first slot, check continuity
        if (combination.length > 0) {
            const lastSlot = combination[combination.length - 1];
            const lastEndTime = lastSlot.split("-")[1];
            const currentStartTime = currentSlot.split("-")[0];

            if (lastEndTime !== currentStartTime) {
                console.log(
                    `❌ Gap detected between ${lastSlot} and ${currentSlot} - stopping`
                );
                break;
            }
        }

        // Add the slot to our combination
        combination.push(currentSlot);
        totalDuration += slotDuration;

        console.log(
            `✅ Added slot ${currentSlot}, total duration: ${totalDuration}h`
        );

        // Check if we've reached the exact duration
        if (Math.abs(totalDuration - durationHours) < tolerance) {
            console.log(
                `✅ Found exact match: ${combination.join(
                    ", "
                )} = ${totalDuration}h`
            );
            return combination;
        }

        currentIndex++;
    }

    // If we didn't find an exact match, return null
    if (Math.abs(totalDuration - durationHours) >= tolerance) {
        console.log(
            `❌ Could not find exact continuous match. Total: ${totalDuration}h, Required: ${durationHours}h`
        );
        return null;
    }

    return combination;
}
function findAllPossibleCombinations(
    timeSlots: string[],
    durationHours: number,
    tolerance: number
): string[][] {
    const combinations: string[][] = [];

    // Generate all possible subsets of time slots
    const allSubsets = generateAllSubsets(timeSlots);

    for (const subset of allSubsets) {
        if (subset.length === 0) continue;

        const totalDuration = calculateCombinationDuration(subset);

        // Check if this combination exactly matches the required duration
        if (Math.abs(totalDuration - durationHours) < tolerance) {
            // Sort the subset by start time to ensure proper ordering
            const sortedSubset = subset.sort((a, b) => {
                const startA = a.split("-")[0];
                const startB = b.split("-")[0];
                return startA.localeCompare(startB);
            });

            combinations.push(sortedSubset);
            console.log(
                `✅ Found valid combination: ${sortedSubset.join(
                    ", "
                )} = ${totalDuration}h`
            );
        }
    }

    return combinations;
}

function generateAllSubsets(timeSlots: string[]): string[][] {
    const subsets: string[][] = [];
    const n = timeSlots.length;

    // Use bit manipulation to generate all subsets
    for (let i = 1; i < 1 << n; i++) {
        // Start from 1 to exclude empty set
        const subset: string[] = [];
        for (let j = 0; j < n; j++) {
            if (i & (1 << j)) {
                subset.push(timeSlots[j]);
            }
        }
        subsets.push(subset);
    }

    return subsets;
}

function areTimeSlotsContinuous(slotCombination: string[]): boolean {
    if (slotCombination.length <= 1) return true;

    // Sort slots by start time first
    const sortedSlots = [...slotCombination].sort((a, b) => {
        const startA = a.split("-")[0];
        const startB = b.split("-")[0];
        return startA.localeCompare(startB);
    });

    // Check each adjacent pair for continuity
    for (let i = 0; i < sortedSlots.length - 1; i++) {
        const currentSlot = sortedSlots[i];
        const nextSlot = sortedSlots[i + 1];

        // Get end time of current slot and start time of next slot
        const currentEndTime = currentSlot.split("-")[1];
        const nextStartTime = nextSlot.split("-")[0];

        // Check if they connect exactly (no gaps, no overlaps)
        if (currentEndTime !== nextStartTime) {
            console.log(
                `❌ Time slots not continuous: ${currentSlot} ends at ${currentEndTime} but ${nextSlot} starts at ${nextStartTime}`
            );
            return false;
        }
    }

    console.log(
        `✅ All time slots are continuous: ${sortedSlots.join(" -> ")}`
    );
    return true;
}

function findTimeSlotCombinationFromIndex(
    timeSlots: string[],
    startIndex: number,
    durationHours: number,
    tolerance: number
): string[] | null {
    const firstSlot = timeSlots[startIndex];
    const firstSlotDuration = calculateTimeSlotDuration(firstSlot);

    // Case 1: Duration exactly matches first slot duration
    if (Math.abs(durationHours - firstSlotDuration) < tolerance) {
        console.log(
            `✅ Exact single slot match: ${firstSlot} (${firstSlotDuration}h) exactly matches ${durationHours}h`
        );
        return [firstSlot];
    }

    // Case 1b: Duration is less than first slot duration - NOT ALLOWED
    if (durationHours < firstSlotDuration - tolerance) {
        console.log(
            `❌ Duration ${durationHours}h is smaller than slot ${firstSlot} (${firstSlotDuration}h) - not allowed`
        );
        return null;
    }

    // Case 2: Duration is greater than first slot, need to find combination
    let currentCombination = [firstSlot];
    let remainingDuration = durationHours - firstSlotDuration;

    // Try to find consecutive slots that can accommodate the remaining duration
    for (
        let nextIndex = startIndex + 1;
        nextIndex < timeSlots.length;
        nextIndex++
    ) {
        const nextSlot = timeSlots[nextIndex];
        const nextSlotDuration = calculateTimeSlotDuration(nextSlot);

        // Check if the next slot is consecutive to the current combination
        if (!areTimeSlotsContinuous([...currentCombination, nextSlot])) {
            break; // Stop if slots are not consecutive
        }

        // Case 2a: Next slot duration exactly matches remaining duration
        if (Math.abs(remainingDuration - nextSlotDuration) < tolerance) {
            currentCombination.push(nextSlot);
            console.log(
                `✅ Found exact combination: ${currentCombination.join(
                    ", "
                )} = ${durationHours}h`
            );
            return currentCombination;
        }

        // Case 2b: Next slot duration is less than remaining duration, continue building
        if (nextSlotDuration < remainingDuration - tolerance) {
            currentCombination.push(nextSlot);
            remainingDuration -= nextSlotDuration;

            // If remaining duration is very small, we're done
            if (remainingDuration < tolerance) {
                console.log(
                    `✅ Found complete combination: ${currentCombination.join(
                        ", "
                    )} = ${durationHours}h`
                );
                return currentCombination;
            }
            continue;
        }

        // Case 2c: Next slot duration is greater than remaining duration - NOT ALLOWED
        if (nextSlotDuration > remainingDuration + tolerance) {
            console.log(
                `❌ Next slot ${nextSlot} (${nextSlotDuration}h) is larger than remaining duration ${remainingDuration}h - stopping search`
            );
            break;
        }
    }

    // If we couldn't find a valid combination
    console.log(
        `❌ No valid combination found starting from slot ${startIndex} for ${durationHours}h`
    );
    return null;
}
// Helper function to remove duplicate combinations
function removeDuplicateCombinations(combinations: string[][]): string[][] {
    const uniqueCombinations: string[][] = [];
    const seen = new Set<string>();

    for (const combination of combinations) {
        const key = combination.join(",");
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCombinations.push(combination);
        }
    }

    return uniqueCombinations;
}

// Check if a section can be scheduled at a specific time
function canScheduleAtTimeWithDetails(
    day: string,
    slotCombination: string[],
    classroomId: number,
    instructorId: number,
    scheduleGrid: ScheduleGrid,
    instructorGrid: InstructorGrid,
    instructorAvailableSlots: string[]
): {
    canSchedule: boolean;
    errorType: SchedulingError["error_type"];
    errorMessage: string;
    conflictingCourse?: string;
    conflictingInstructor?: string;
} {
    for (const timeSlot of slotCombination) {
        // Check if instructor is available at this slot
        if (!instructorAvailableSlots.includes(timeSlot)) {
            return {
                canSchedule: false,
                errorType: "TIME_CONSTRAINT",
                errorMessage: `Instructor is not available at ${day} ${timeSlot} due to time constraints`,
            };
        }

        // Check classroom availability
        const classroomKey = `${day}-${classroomId}-${timeSlot}`;
        const classroomSlot = scheduleGrid.get(classroomKey);
        if (!classroomSlot || !classroomSlot.isAvailable) {
            const conflictingSection = classroomSlot?.assigned_section_id;
            return {
                canSchedule: false,
                errorType: "NO_AVAILABLE_SLOTS",
                errorMessage: `Classroom ${classroomId} is not available at ${day} ${timeSlot}`,
                conflictingCourse: conflictingSection
                    ? `Section ID: ${conflictingSection}`
                    : undefined,
            };
        }

        // Check instructor availability in grid
        const instructorKey = `${day}-${instructorId}-${timeSlot}`;
        const instructorSlot = instructorGrid.get(instructorKey);
        if (!instructorSlot || !instructorSlot.isAvailable) {
            const conflictingSection = instructorSlot?.assigned_section_id;
            return {
                canSchedule: false,
                errorType: "INSTRUCTOR_CONFLICT",
                errorMessage: `Instructor is already scheduled at ${day} ${timeSlot}`,
                conflictingCourse: conflictingSection
                    ? `Section ID: ${conflictingSection}`
                    : undefined,
            };
        }
    }

    return {
        canSchedule: true,
        errorType: "UNKNOWN_ERROR",
        errorMessage: "",
    };
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

    // Sort slots by start time and get the earliest start time
    const sortedSlots = slotCombination.sort((a, b) => {
        const startA = a.split("-")[0];
        const startB = b.split("-")[0];
        return startA.localeCompare(startB);
    });

    return sortedSlots[0].split("-")[0];
}

function testExample() {
    console.log("=== Testing Example: 1.66h course ===");

    const timeSlots = ["08:00-08:50", "09:00-09:50", "10:00-10:50"];
    const courseDuration = 1.66;

    console.log(`Time slots: ${timeSlots.join(", ")}`);
    console.log(
        `Each slot duration: ${calculateTimeSlotDuration(timeSlots[0])}h`
    );
    console.log(`Course duration needed: ${courseDuration}h`);

    const combinations = findPossibleTimeSlots(timeSlots, courseDuration);

    console.log(`\nFound ${combinations.length} combinations:`);
    combinations.forEach((combo, index) => {
        const totalDuration = calculateCombinationDuration(combo);
        const validation = validateTimeSlotAssignment(
            combo,
            courseDuration,
            "TEST"
        );
        console.log(
            `${index + 1}. [${combo.join(", ")}] = ${totalDuration}h (${
                validation.assignmentType
            })`
        );
    });

    return combinations;
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

                // Check if this is an online course and set classroom_id accordingly
                const isOnlineCourse = assignment.classroom_id < 0; // Online courses have negative classroom IDs
                const classroomIdToStore = isOnlineCourse
                    ? null
                    : assignment.classroom_id;

                if (assignment.courseHours_id) {
                    // Update existing courseHours record using the courseHours_id
                    const result = await db
                        .update(courseHours)
                        .set({
                            day: assignment.day,
                            timeSlot: timeSlotFormat,
                            classroomId: classroomIdToStore, // Set to null for online courses
                        })
                        .where(eq(courseHours.id, assignment.courseHours_id));

                    updatedCount++;

                    console.log(
                        `✅ Updated courseHours ID ${
                            assignment.courseHours_id
                        } for section ${assignment.section_id}: ${
                            assignment.day
                        } ${timeSlotFormat} (${durationHours}h, Classroom: ${
                            classroomIdToStore || "Online"
                        })`
                    );
                } else {
                    // Insert new courseHours record if no ID exists
                    const insertResult = await db.insert(courseHours).values({
                        day: assignment.day,
                        timeSlot: timeSlotFormat,
                        separatedDuration: durationHours,
                        classroomId: classroomIdToStore, // Set to null for online courses
                        sectionId: assignment.section_id,
                    });

                    insertedCount++;

                    console.log(
                        `✅ Inserted new courseHours for section ${
                            assignment.section_id
                        }: ${
                            assignment.day
                        } ${timeSlotFormat} (${durationHours}h, Classroom: ${
                            classroomIdToStore || "Online"
                        })`
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
