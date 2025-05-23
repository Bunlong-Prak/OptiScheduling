"use client";

import {
    CellToDelete,
    Classroom,
    Course,
    CourseHour,
    ScheduleAssignment,
    ScheduleResponse,
    TimetableCourse,
} from "@/app/types";
import {
    colors_class,
    getConsistentCourseColor,
} from "@/components/custom/colors";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// Mock data for the timetable
const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

// Define TimetableGrid type for the timetable data structure
type TimetableGrid = Record<string, TimetableCourse>;

// Initial schedule data (empty object)
const initialSchedule: TimetableGrid = {};

export default function TimetableViewClassroom() {
    const [schedule, setSchedule] = useState<TimetableGrid>(initialSchedule);
    const [draggedCourse, setDraggedCourse] = useState<TimetableCourse | null>(
        null
    );
    const [selectedCourse, setSelectedCourse] =
        useState<TimetableCourse | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [cellToDelete, setCellToDelete] = useState<CellToDelete>({
        day: "",
        classroomId: "",
        timeSlot: "",
        timeSlotId: 0, // Related to course hour
    });

    // State for holding real courses from API
    const [availableCourses, setAvailableCourses] = useState<TimetableCourse[]>(
        []
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [assignedCourses, setAssignedCourses] = useState<TimetableCourse[]>(
        []
    );
    const [isLoading, setIsLoading] = useState(true);
    // const [isSaving, setIsSaving] = useState(false);

    // Add state to track if dragging to available courses area
    const [isDraggingToAvailable, setIsDraggingToAvailable] = useState(false);

    // New state for time slots from database - course hours related
    const [timeSlots, setTimeSlots] = useState<CourseHour[]>([]);
    // State for display time slots (which might be condensed for consecutive slots)
    // const [displayTimeSlots, setDisplayTimeSlots] = useState<CourseHour[]>([]);

    // State for classrooms from database
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    // Add these new state variables to your existing useState declarations
    const [isGeneratingSchedule, setIsGeneratingSchedule] =
        useState<boolean>(false);
    const [scheduleGenerated, setScheduleGenerated] = useState<boolean>(false);
    const [generationStats, setGenerationStats] = useState<{
        totalCourses: number;
        totalSections: number;
        scheduledAssignments: number;
        constraintsApplied: number;
    } | null>(null);

    const params = useParams();

    // Helper function to get consistent time slot key
    const getTimeSlotKey = (timeSlot: any): string => {
        // If it's a time slot string like "8:00-9:00", use it directly
        if (typeof timeSlot === "string") {
            return timeSlot;
        }

        // If it's an object with startTime, use that
        if (timeSlot.startTime) {
            return timeSlot.startTime;
        }

        // If it's an object with time_slot, use that
        if (timeSlot.time_slot) {
            return timeSlot.time_slot;
        }

        return timeSlot.toString();
    };

    // Helper function to check if time slots are consecutive
    const areTimeSlotsConsecutive = (slots: any[]): boolean => {
        if (!slots || slots.length < 2) return false;

        // Loop through pairs of time slots
        for (let i = 0; i < slots.length - 1; i++) {
            const currentSlot = slots[i];
            const nextSlot = slots[i + 1];

            // Get end time of current slot and start time of next slot
            let currentEndTime, nextStartTime;

            if (currentSlot.endTime) {
                currentEndTime = currentSlot.endTime;
            } else if (
                currentSlot.time_slot &&
                currentSlot.time_slot.includes("-")
            ) {
                currentEndTime = currentSlot.time_slot.split("-")[1].trim();
            } else {
                return false; // Cannot determine end time
            }

            if (nextSlot.startTime) {
                nextStartTime = nextSlot.startTime;
            } else if (nextSlot.time_slot && nextSlot.time_slot.includes("-")) {
                nextStartTime = nextSlot.time_slot.split("-")[0].trim();
            } else {
                return false; // Cannot determine start time
            }

            // Check if they match
            if (currentEndTime !== nextStartTime) {
                return false;
            }
        }

        return true;
    };

    // Helper function to parse a time slot string
    const parseTimeSlot = (
        timeSlotStr: string
    ): { startTime: string; endTime: string } => {
        if (!timeSlotStr || !timeSlotStr.includes("-")) {
            return { startTime: timeSlotStr, endTime: timeSlotStr };
        }

        const [startTime, endTime] = timeSlotStr
            .split("-")
            .map((time) => time.trim());
        return { startTime, endTime };
    };

    // Fetch time slots and classrooms from API
    useEffect(() => {
        const fetchTimeSlots = async () => {
            try {
                const scheduleId = params.id;
                const response = await fetch(`/api/schedules`);

                if (response.ok) {
                    const schedulesData = await response.json();
                    // Find the current schedule by ID
                    const currentSchedule = schedulesData.find(
                        (s: any) => s.id.toString() === scheduleId
                    );

                    if (currentSchedule && currentSchedule.timeSlots) {
                        // Transform API time slots to a consistent format
                        const apiTimeSlots = currentSchedule.timeSlots.map(
                            (slot: any) => {
                                // Create a formatted slot object
                                const formattedSlot: any = {
                                    id: slot.id,
                                    time_slot:
                                        slot.time_slot ||
                                        (slot.startTime && slot.endTime
                                            ? `${slot.startTime}-${slot.endTime}`
                                            : slot.startTime),
                                    startTime: slot.startTime,
                                    endTime: slot.endTime,
                                };

                                // If time_slot already has start/end times but not as separate properties
                                if (
                                    !slot.startTime &&
                                    !slot.endTime &&
                                    slot.time_slot &&
                                    slot.time_slot.includes("-")
                                ) {
                                    const parsed = parseTimeSlot(
                                        slot.time_slot
                                    );
                                    formattedSlot.startTime = parsed.startTime;
                                    formattedSlot.endTime = parsed.endTime;
                                }

                                return formattedSlot;
                            }
                        );

                        console.log("Raw API time slots:", apiTimeSlots);

                        // Check if the time slots are consecutive
                        const isConsecutive =
                            areTimeSlotsConsecutive(apiTimeSlots);
                        console.log(
                            "Time slots are consecutive:",
                            isConsecutive
                        );

                        // Save original time slots for data processing
                        setTimeSlots(apiTimeSlots);

                        // For display, just use the time slots as is
                    } else {
                        console.error(
                            "No time slots found for schedule",
                            scheduleId
                        );
                    }
                } else {
                    console.error("Failed to fetch schedules");
                }
            } catch (error) {
                console.error("Error fetching time slots:", error);
            }
        };

        const fetchClassrooms = async () => {
            try {
                const scheduleId = params.id;
                const response = await fetch(
                    `/api/classrooms?scheduleId=${scheduleId}`
                );
                if (response.ok) {
                    const data = await response.json();
                    // Use classrooms directly without adding extra fields
                    setClassrooms(data);
                } else {
                    console.error("Failed to fetch classrooms");
                    setClassrooms([]);
                }
            } catch (error) {
                console.error("Error fetching classrooms:", error);
                setClassrooms([]);
            }
        };

        fetchTimeSlots(); // Now we're fetching time slots from API
        fetchClassrooms();
    }, [params.id]);

    // Fetch real courses from API
    // Fetch real courses from API
    useEffect(() => {
        const fetchCourses = async () => {
            setIsLoading(true);
            try {
                const scheduleId = params.id;
                const response = await fetch(
                    `/api/courses?scheduleId=${scheduleId}`
                );
                if (response.ok) {
                    const coursesData: Course[] = await response.json();

                    // Group courses by sectionId
                    const coursesBySectionId: { [sectionId: string]: Course } =
                        {};

                    coursesData.forEach((course) => {
                        const sectionId = course.sectionId;

                        if (!coursesBySectionId[sectionId]) {
                            // First time seeing this section, create a new entry
                            coursesBySectionId[sectionId] = { ...course };
                        } else {
                            // We've seen this section before, combine the majors
                            const existingCourse =
                                coursesBySectionId[sectionId];
                        }
                    });

                    // Transform for timetable
                    const transformedCourses = Object.values(
                        coursesBySectionId
                    ).map((course: any) => ({
                        code: course.code,
                        sectionId: course.sectionId,
                        name: course.title,
                        // CHANGE THIS LINE:
                        color:
                            colors_class[course.color] ||
                            getConsistentCourseColor(course.code),

                        duration: course.duration,
                        instructor: `${course.firstName || ""} ${
                            course.lastName || ""
                        }`.trim(),
                        section: course.section,
                        room: course.classroom || "TBA",
                        uniqueId: `${course.code}-${course.section}`,
                        majors: course.major || [],
                        // Add this line to store the original color name:
                        originalColor: course.color,
                    }));

                    setAvailableCourses(transformedCourses);
                } else {
                    console.error("Failed to fetch courses");
                    setAvailableCourses([]);
                }
            } catch (error) {
                console.error("Error fetching courses:", error);
                setAvailableCourses([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCourses();
    }, [params.id]);

    // Fetch timetable assignments from API
    useEffect(() => {
        const fetchTimetableAssignments = async () => {
            if (!params.id || !timeSlots.length || !classrooms.length) return;

            setIsLoading(true);
            try {
                const scheduleId = params.id;
                const response = await fetch(
                    `/api/assign-time-slots?scheduleId=${scheduleId}`
                );

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch assignments: ${response.status} ${response.statusText}`
                    );
                }

                const assignmentsData = await response.json();

                // Process the assignments data to create schedule
                const newSchedule: TimetableGrid = {};
                const newAssignedCourses: TimetableCourse[] = [];

                assignmentsData.forEach((assignment: any) => {
                    // Extract data from the API response
                    const sectionId = assignment.sectionId;
                    const classroomCode = assignment.classroom;
                    const code = assignment.code;
                    const title = assignment.title || code;
                    const firstName = assignment.firstName;
                    const lastName = assignment.lastName;
                    const day = assignment.day;
                    const originalColor = assignment.color;

                    const colorClassName =
                        originalColor && colors_class[originalColor]
                            ? colors_class[originalColor]
                            : getConsistentCourseColor(code);

                    // Parse the time slot - handle different formats
                    let startTime = assignment.startTime; // Direct startTime if available
                    let endTime = assignment.endTime; // Direct endTime if available

                    // If startTime/endTime not directly available, parse from timeSlot
                    if (!startTime && assignment.timeSlot) {
                        const timeSlot = assignment.timeSlot;

                        // Handle format like "13:00 - 15:00"
                        if (timeSlot.includes(" - ")) {
                            const parts = timeSlot.split(" - ");
                            startTime = parts[0].trim();
                            endTime = parts[1].trim();
                        } else {
                            // If it's just a single time or time range without spaces
                            startTime = timeSlot;
                        }
                    }

                    // Use specified duration or calculate from time slots
                    let duration = parseInt(assignment.duration || "1", 10);

                    // Skip invalid assignments
                    if (!sectionId || !day || !startTime) {
                        console.warn(
                            "Skipping invalid assignment:",
                            assignment
                        );
                        return;
                    }

                    // Find classroom by code
                    const classroom = classrooms.find(
                        (c) => c.code === classroomCode
                    );

                    if (!classroom) {
                        console.warn(
                            `Classroom with code ${classroomCode} not found.`
                        );
                        return;
                    }

                    const classroomId = classroom.id.toString();

                    // Instructor name
                    const instructorName =
                        firstName && lastName
                            ? `${firstName} ${lastName}`
                            : "TBA";

                    // Deterministic color based on course code
                    // const colorIndex =
                    //     code.charCodeAt(0) % Object.keys(colors_class).length;
                    // const colorClassName = getConsistentCourseColor(code);

                    // Find the time slot that matches the start time
                    // This is crucial: we need to match the exact format
                    const startIndex = timeSlots.findIndex((ts) => {
                        const tsKey = getTimeSlotKey(ts);

                        // Try multiple matching strategies
                        return (
                            tsKey === startTime || // Exact match
                            ts.startTime === startTime || // Match startTime property
                            ts.time_slot === startTime || // Match time_slot property
                            // If the time slot is a range, check if it starts with our startTime
                            (ts.time_slot &&
                                ts.time_slot.startsWith(startTime + "-")) ||
                            // Try matching just the time part if it's in HH:MM format
                            (tsKey.includes("-") &&
                                tsKey.split("-")[0].trim() === startTime)
                        );
                    });

                    if (startIndex === -1) {
                        console.warn(
                            `Time slot "${startTime}" not found for course ${code}. Available time slots:`,
                            timeSlots.map((ts) => ({
                                key: getTimeSlotKey(ts),
                                startTime: ts.startTime,
                                time_slot: ts.time_slot,
                            }))
                        );
                        return;
                    }

                    // If we have an endTime, try to calculate duration more accurately
                    if (endTime) {
                        const endIndex = timeSlots.findIndex((ts) => {
                            const tsKey = getTimeSlotKey(ts);
                            return (
                                ts.endTime === endTime ||
                                (ts.time_slot &&
                                    ts.time_slot.endsWith("-" + endTime)) ||
                                (tsKey.includes("-") &&
                                    tsKey.split("-")[1].trim() === endTime)
                            );
                        });

                        if (endIndex !== -1) {
                            duration = endIndex - startIndex + 1;
                            console.log(
                                `Calculated duration for ${code}: ${duration} hours (${startTime} to ${endTime})`
                            );
                        }
                    }

                    // Calculate actualDuration and endTime
                    const actualDuration = Math.min(
                        duration,
                        timeSlots.length - startIndex
                    );

                    // Create the course object
                    const course = {
                        sectionId: sectionId,
                        code: code,
                        name: title,
                        instructor: instructorName,
                        duration: actualDuration,
                        day: day,
                        startTime: startTime,
                        endTime:
                            endTime ||
                            timeSlots[
                                Math.min(
                                    startIndex + actualDuration - 1,
                                    timeSlots.length - 1
                                )
                            ].endTime,
                        classroom: classroomId,
                        color: colorClassName,
                        section: sectionId.toString(),
                        room: classroomCode,
                        originalColor: originalColor, // Store original color name
                    };

                    // Add to assigned courses
                    if (
                        !newAssignedCourses.some(
                            (c) =>
                                c.sectionId === sectionId &&
                                c.day === day &&
                                c.startTime === startTime
                        )
                    ) {
                        newAssignedCourses.push({ ...course });
                    }

                    // Add to schedule grid - this is where the UI display happens
                    for (let i = 0; i < actualDuration; i++) {
                        if (startIndex + i >= timeSlots.length) break;

                        const currentTimeSlot = getTimeSlotKey(
                            timeSlots[startIndex + i]
                        );
                        const key = `${day}-${classroomId}-${currentTimeSlot}`;

                        newSchedule[key] = {
                            ...course,
                            isStart: i === 0,
                            isMiddle: i > 0 && i < actualDuration - 1,
                            isEnd: i === actualDuration - 1,
                            colspan: i === 0 ? actualDuration : 0,
                        };
                    }
                });

                // Update state with assignments
                setSchedule(newSchedule);
                setAssignedCourses(newAssignedCourses);

                // Update available courses (remove assigned courses)
                const assignedIds = new Set(
                    newAssignedCourses.map((c) => c.sectionId)
                );
                setAvailableCourses((prev) =>
                    prev.filter((c) => !assignedIds.has(c.sectionId))
                );
            } catch (error) {
                console.error("Error fetching timetable assignments:", error);
            } finally {
                setIsLoading(false);
            }
        };

        // Only fetch if we have the necessary data
        if (timeSlots.length > 0 && classrooms.length > 0) {
            fetchTimetableAssignments();
        }
    }, [params.id, timeSlots, classrooms]); // Re-fetch if schedule ID, time slots or classrooms change

    // Handle drag start
    const handleDragStart = (course: TimetableCourse) => {
        setDraggedCourse(course);
    };

    // Handle drag over
    const handleDragOver = (
        e: React.DragEvent<HTMLTableCellElement | HTMLDivElement>
    ) => {
        e.preventDefault();
    };

    // Handle drag over for available courses section
    const handleAvailableDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(true);
    };

    // Handle drag leave for available courses section
    const handleAvailableDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(false);
    };

    // Function to save all assignments to the database
    const saveAllAssignments = async () => {
        try {
            // Prepare data for API - ensure we're saving the right format
            const assignmentsData = assignedCourses.map((course) => ({
                sectionId: course.sectionId,
                day: course.day,
                startTime: course.startTime,
                endTime: course.endTime,
                classroom: course.classroom,
            }));
            // Send all assignments to API
            const response = await fetch("/api/assign-time-slots", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(assignmentsData),
            });

            if (response.ok) {
                alert("All assignments saved successfully!");
            } else {
                const errorData = await response.json();
                console.error("Failed to save assignments:", errorData);
                alert(
                    `Failed to save assignments: ${
                        errorData.error || "Unknown error"
                    }`
                );
            }
        } catch (error) {
            console.error("Error saving assignments:", error);
            alert(
                `Error saving assignments: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    };

    // // Function to export timetable
    // const exportTimetable = () => {
    //     // Implement export functionality
    //     alert("Export functionality to be implemented");
    // };

    // Handle drag over for available courses section
    const handleAvailableDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(false);

        if (!draggedCourse) return;

        // Only process if the course is from the timetable (has day property)
        if (draggedCourse.day) {
            // Remove course from the timetable
            removeCourseFromTimetable(draggedCourse);
        }
    };

    // Function to remove a course from the timetable and return it to available courses
    const removeCourseFromTimetable = (course: TimetableCourse) => {
        if (!course.day || !course.classroom || !course.startTime) return;

        // Find all keys for this course in the schedule
        const newSchedule = { ...schedule };

        // Remove all occurrences of this course ID from schedule
        Object.keys(newSchedule).forEach((key) => {
            if (newSchedule[key].sectionId === course.sectionId) {
                delete newSchedule[key];
            }
        });

        setSchedule(newSchedule);

        // Return the course to available courses list
        // Create a clean version without timetable-specific properties
        const cleanCourse = {
            code: course.code,
            name: course.name,
            color: course.color,
            duration: course.duration,
            instructor: course.instructor,
            sectionId: course.sectionId,
            section: course.section,
            room: course.room,
            // Explicitly clean any timetable positioning data
            day: undefined,
            startTime: undefined,
            endTime: undefined,
            classroom: undefined,
            isStart: undefined,
            isMiddle: undefined,
            isEnd: undefined,
            colspan: undefined,
        };

        // Only add back to available courses if it's not already there
        if (!availableCourses.some((c) => c.sectionId === course.sectionId)) {
            setAvailableCourses((prev) => [...prev, cleanCourse]);
        }

        // Remove from assigned courses
        setAssignedCourses((prev) =>
            prev.filter((c) => c.sectionId !== course.sectionId)
        );
    };
    const getTimeSlotId = (timeSlotStr: string): number => {
        // Find the time slot using the consistent key
        const index = timeSlots.findIndex(
            (ts) => getTimeSlotKey(ts) === timeSlotStr
        );
        return index !== -1 ? index + 1 : 0;
    };

    // Handle drop - completely rewritten to prevent duplication
    // Handle drop - completely rewritten to prevent duplication
    const handleDrop = (day: string, classroomId: string, timeSlot: string) => {
        if (!draggedCourse || timeSlots.length === 0) return;

        console.log("Dropping course on slot:", timeSlot);

        // Find the time slot that matches the drop location
        const matchingTimeSlot = timeSlots.find(
            (ts) => getTimeSlotKey(ts) === timeSlot
        );

        if (!matchingTimeSlot) {
            console.error(`Time slot ${timeSlot} not found`);
            return;
        }

        const timeSlotIndex = timeSlots.indexOf(matchingTimeSlot);

        // Check if the time slot is already occupied
        const key = `${day}-${classroomId}-${timeSlot}`;
        const existingCourse = schedule[key];

        // If dropping on the same course, do nothing
        if (
            existingCourse &&
            existingCourse.sectionId === draggedCourse.sectionId
        ) {
            return;
        }

        // If dropping on a different course, show conflict message
        if (
            existingCourse &&
            existingCourse.sectionId !== draggedCourse.sectionId
        ) {
            alert(
                "This time slot is already occupied. Please choose another slot."
            );
            return;
        }

        // CRITICAL FIX: Check if there's enough space for the course duration within the SAME DAY
        // First, calculate how many time slots are left in this day
        const remainingSlots = timeSlots.length - timeSlotIndex;

        if (draggedCourse.duration > remainingSlots) {
            alert(
                "Courses cannot span across multiple days. Not enough time slots available for this course duration."
            );
            return;
        }

        // Check for conflicts in subsequent time slots
        for (let i = 1; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;
            const nextTimeSlot = getTimeSlotKey(timeSlots[timeSlotIndex + i]);
            const nextKey = `${day}-${classroomId}-${nextTimeSlot}`;
            if (
                schedule[nextKey] &&
                schedule[nextKey].sectionId !== draggedCourse.sectionId
            ) {
                alert(
                    "There's a conflict with another course in subsequent time slots."
                );
                return;
            }
        }

        // Create a new schedule and remove all instances of the dragged course
        const newSchedule = { ...schedule };
        Object.keys(newSchedule).forEach((scheduleKey) => {
            if (
                newSchedule[scheduleKey].sectionId === draggedCourse.sectionId
            ) {
                delete newSchedule[scheduleKey];
            }
        });

        // Calculate end time
        const endTimeIndex = timeSlotIndex + draggedCourse.duration - 1;
        const endTimeSlot =
            endTimeIndex < timeSlots.length
                ? timeSlots[endTimeIndex].endTime ||
                  timeSlots[endTimeIndex].time_slot?.split("-")[1]?.trim() ||
                  timeSlots[endTimeIndex].time_slot
                : timeSlots[timeSlots.length - 1].endTime ||
                  timeSlots[timeSlots.length - 1].time_slot
                      ?.split("-")[1]
                      ?.trim() ||
                  timeSlots[timeSlots.length - 1].time_slot;

        // Create course with assignment data
        const assignedCourse = {
            ...draggedCourse,
            day: day,
            startTime:
                timeSlots[timeSlotIndex].startTime ||
                getTimeSlotKey(timeSlots[timeSlotIndex]),
            endTime: endTimeSlot,
            classroom: classroomId,
            color: draggedCourse.color, // Keep the original color instead of regenerating it
            originalColor: draggedCourse.originalColor,
        };

        // Add the course to all its new time slots
        for (let i = 0; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;
            const currentTimeSlot = getTimeSlotKey(
                timeSlots[timeSlotIndex + i]
            );
            const currentKey = `${day}-${classroomId}-${currentTimeSlot}`;

            newSchedule[currentKey] = {
                ...assignedCourse,
                isStart: i === 0,
                isMiddle: i > 0 && i < draggedCourse.duration - 1,
                isEnd: i === draggedCourse.duration - 1,
                colspan: i === 0 ? draggedCourse.duration : 0,
            };
        }

        // Update schedule state
        setSchedule(newSchedule);

        // IMPORTANT FIX: Always remove the course from available courses when it's assigned
        // No matter where it came from - ensure it's not in the available list
        setAvailableCourses((prev) =>
            prev.filter(
                (course) => course.sectionId !== draggedCourse.sectionId
            )
        );

        // Check if course is already in assigned courses
        const isAlreadyAssigned = assignedCourses.some(
            (c) => c.sectionId === draggedCourse.sectionId
        );

        if (isAlreadyAssigned) {
            // Update the course position within assigned courses
            setAssignedCourses((prev) => {
                const filtered = prev.filter(
                    (c) => c.sectionId !== draggedCourse.sectionId
                );
                return [...filtered, assignedCourse];
            });
        } else {
            // Add to assigned courses
            setAssignedCourses((prev) => [...prev, assignedCourse]);
        }
    };
    // Handle course click - updated to use classroom instead of major
    const handleCourseClick = (
        day: string,
        classroomId: string,
        timeSlot: string,
        course: TimetableCourse
    ) => {
        setSelectedCourse(course);
        const timeSlotId = getTimeSlotId(timeSlot); // Course hours related
        setCellToDelete({ day, classroomId, timeSlot, timeSlotId });
        setIsDialogOpen(true);
    };

    // Add this function to fetch and generate the schedule
    const generateSchedule = async () => {
        if (!params.id) {
            alert("Schedule ID is missing");
            return;
        }

        setIsGeneratingSchedule(true);

        try {
            const scheduleId = params.id.toString();

            // Call the generate-schedule API endpoint with POST method
            const response = await fetch(
                `/api/generate-schedule?scheduleId=${scheduleId}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to generate schedule: ${response.status} ${response.statusText}`
                );
            }

            const data: ScheduleResponse = await response.json();

            // Save stats for potential display
            if (data.stats) {
                setGenerationStats(data.stats);
            }

            // Process the generated schedule and update the timetable
            if (data.schedule && Array.isArray(data.schedule)) {
                // Clear the current schedule
                setSchedule({});

                // Create new schedule data structures
                const newSchedule: TimetableGrid = {};
                const newAssignedCourses: TimetableCourse[] = [];

                // Process each assignment from the API
                data.schedule.forEach((assignment: ScheduleAssignment) => {
                    const {
                        sectionId,
                        courseCode,
                        courseTitle,
                        instructorName,
                        day,
                        startTime,
                        endTime,
                        classroomCode,
                        courseColor, // Make sure this is included in your API response
                    } = assignment;

                    // Find the classroom ID by code
                    const classroom = classrooms.find(
                        (c) => c.code === classroomCode
                    );
                    if (!classroom) {
                        console.warn(
                            `Classroom with code ${classroomCode} not found`
                        );
                        return;
                    }

                    // Find the start time index
                    const startIndex = timeSlots.findIndex(
                        (ts) =>
                            getTimeSlotKey(ts) === startTime ||
                            ts.startTime === startTime
                    );
                    if (startIndex === -1) {
                        console.warn(`Time slot ${startTime} not found`);
                        return;
                    }

                    // Find the end time index
                    const endIndex = timeSlots.findIndex(
                        (ts) =>
                            ts.time_slot === endTime || ts.endTime === endTime
                    );
                    if (endIndex === -1) {
                        console.warn(`End time slot ${endTime} not found`);
                        return;
                    }

                    // Calculate duration based on start and end times
                    const duration = endIndex - startIndex + 1;

                    // Use the color from the API if available
                    // Use the original color from the course if available
                    const colorClassName =
                        courseColor && colors_class[courseColor]
                            ? colors_class[courseColor]
                            : getConsistentCourseColor(courseCode);

                    // Create course object with consistent color
                    const course: TimetableCourse = {
                        sectionId,
                        code: courseCode,
                        name: courseTitle,
                        instructor: instructorName,
                        duration,
                        day,
                        startTime,
                        endTime,
                        classroom: classroom.id.toString(),
                        color: colorClassName,
                        originalColor: courseColor,
                        section: sectionId.toString(),
                        room: classroomCode,
                    };

                    // Add to assigned courses
                    newAssignedCourses.push(course);

                    // Add to schedule grid for display
                    for (let i = 0; i < duration; i++) {
                        if (startIndex + i >= timeSlots.length) break;

                        const currentTimeSlot = getTimeSlotKey(
                            timeSlots[startIndex + i]
                        );
                        const key = `${day}-${classroom.id}-${currentTimeSlot}`;

                        newSchedule[key] = {
                            ...course,
                            isStart: i === 0,
                            isMiddle: i > 0 && i < duration - 1,
                            isEnd: i === duration - 1,
                            colspan: i === 0 ? duration : 0,
                        };
                    }
                });

                // Update state with new schedule and assigned courses
                setSchedule(newSchedule);
                setAssignedCourses(newAssignedCourses);

                // Update available courses (remove assigned courses)
                const assignedIds = new Set(
                    newAssignedCourses.map((c) => c.sectionId)
                );
                setAvailableCourses((prev) =>
                    prev.filter((c) => !assignedIds.has(c.sectionId))
                );

                setScheduleGenerated(true);
            } else {
                console.error("Invalid schedule data format", data);
                alert("Failed to process the generated schedule data.");
            }
        } catch (error) {
            console.error("Error generating schedule:", error);
            alert(
                `Error generating schedule: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        } finally {
            setIsGeneratingSchedule(false);
        }
    };

    // Handle course delete - updated to use sectionId approach
    const handleRemoveCourse = async () => {
        const { day, classroomId, timeSlot } = cellToDelete;
        const key = `${day}-${classroomId}-${timeSlot}`;
        const course = schedule[key];

        if (!course) return;

        // Close dialog first for better UX
        setIsDialogOpen(false);

        try {
            // Call the DELETE API to remove the assignment from the database
            const response = await fetch("/api/assign-time-slots", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sectionId: course.sectionId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error ||
                        `HTTP ${response.status}: ${response.statusText}`
                );
            }

            const result = await response.json();
            console.log("Course removed successfully:", result);

            // If API call successful, update the local state
            const courseId = course.sectionId;

            // Create a new schedule without this course
            const newSchedule = { ...schedule };
            Object.keys(newSchedule).forEach((scheduleKey) => {
                if (newSchedule[scheduleKey].sectionId === courseId) {
                    delete newSchedule[scheduleKey];
                }
            });
            setSchedule(newSchedule);

            // Return the course to available courses list with a clean state
            // Create a clean version without timetable-specific properties
            const cleanCourse: TimetableCourse = {
                code: course.code,
                name: course.name,
                color: course.color,
                duration: course.duration,
                instructor: course.instructor,
                sectionId: course.sectionId,
                section: course.section,
                room: course.room,
                // Remove timetable-specific properties by not including them
            };

            // Only add back to available courses if it's not already there
            if (!availableCourses.some((c) => c.sectionId === courseId)) {
                setAvailableCourses((prev) => [...prev, cleanCourse]);
            }

            // Remove from assigned courses
            setAssignedCourses((prev) =>
                prev.filter((c) => c.sectionId !== courseId)
            );

            // Optional: Show success message
            // toast.success(`Course ${course.code} removed successfully`);
        } catch (error) {
            console.error("Error removing course:", error);

            // Show user-friendly error message
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to remove course from timetable";

            alert(`Error: ${errorMessage}`);

            // Reopen dialog if there was an error
            setIsDialogOpen(true);

            // Optionally, you could show a toast notification instead:
            // toast.error(`Failed to remove course: ${errorMessage}`);
        }
    };

    return (
        <div className="relative min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Classroom View Timetable</h2>
                <div className="flex gap-4">
                    <Button
                        onClick={generateSchedule}
                        disabled={
                            isGeneratingSchedule || classrooms.length === 0
                        }
                        variant="outline"
                    >
                        {isGeneratingSchedule
                            ? "Generating..."
                            : "Auto-Generate Schedule"}
                    </Button>
                    <Button onClick={saveAllAssignments}>Save All</Button>
                </div>
            </div>

            {/* Optional: Show generation results */}
            {scheduleGenerated && generationStats && (
                <div className="bg-green-50 border border-green-200 text-green-800 p-3 mb-4 rounded">
                    <p>
                        Schedule generated successfully!{" "}
                        {generationStats.scheduledAssignments} classes were
                        scheduled out of {generationStats.totalSections}{" "}
                        sections.
                    </p>
                    <p className="text-sm mt-1">
                        You can still make manual adjustments by dragging
                        courses.
                    </p>
                </div>
            )}

            {/* Full week timetable */}
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] mb-40">
                <div className="inline-block min-w-full">
                    <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-blue-200">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium  text-gray-700 uppercase tracking-wider w-24 border">
                                        Classroom
                                    </th>
                                    {days.map((day) => (
                                        <th
                                            key={day}
                                            colSpan={timeSlots.length}
                                            className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border "
                                        >
                                            {day}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider w-24 border">
                                        Time
                                    </th>
                                    {/* Course hours related - time slot headers */}
                                    {days.map((day) =>
                                        timeSlots.map((slot) => (
                                            <th
                                                key={`${day}-${getTimeSlotKey(
                                                    slot
                                                )}`}
                                                className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border "
                                            >
                                                {slot.time_slot ||
                                                    slot.startTime}
                                            </th>
                                        ))
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {classrooms.map((classroom, index) => (
                                    <tr
                                        key={classroom.id}
                                        className={
                                            index % 2 === 0
                                                ? "bg-white"
                                                : "bg-white"
                                        }
                                    >
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium border text-gray-700">
                                            {classroom.code}
                                        </td>
                                        {days.map((day) =>
                                            timeSlots.map((slot) => {
                                                const slotKey =
                                                    getTimeSlotKey(slot);
                                                const key = `${day}-${classroom.id}-${slotKey}`;
                                                const course = schedule[key];

                                                // Skip cells that are part of a multi-hour course but not the start
                                                if (course && !course.isStart) {
                                                    return null;
                                                }

                                                return (
                                                    <td
                                                        key={`${day}-${classroom.id}-${slotKey}`}
                                                        className="px-1 py-1 whitespace-nowrap text-xs border"
                                                        colSpan={
                                                            course?.colspan || 1
                                                        }
                                                        onDragOver={
                                                            handleDragOver
                                                        }
                                                        onDrop={() =>
                                                            handleDrop(
                                                                day,
                                                                classroom.id.toString(),
                                                                slotKey
                                                            )
                                                        }
                                                    >
                                                        {course ? (
                                                            <div
                                                                className={`${course.color} p-1 rounded cursor-pointer text-center border shadow-sm transition-all font-medium`}
                                                                onClick={() =>
                                                                    handleCourseClick(
                                                                        day,
                                                                        classroom.id.toString(),
                                                                        slotKey,
                                                                        course
                                                                    )
                                                                }
                                                                draggable
                                                                onDragStart={() =>
                                                                    handleDragStart(
                                                                        course
                                                                    )
                                                                }
                                                            >
                                                                {course.code}
                                                            </div>
                                                        ) : (
                                                            <div className="h-6 w-full" />
                                                        )}
                                                    </td>
                                                );
                                            })
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Draggable courses section with real data from API - only showing available courses */}
            <div
                className={`fixed bottom-0 left-0 right-0 bg-white p-4 rounded-t-lg shadow-lg z-50 border-t ${
                    isDraggingToAvailable ? "bg-blue-100" : ""
                }`}
                onDragOver={handleAvailableDragOver}
                onDragLeave={handleAvailableDragLeave}
                onDrop={handleAvailableDrop}
            >
                <div className="max-w-9xl mx-auto">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <span className="">Available Courses</span>
                        {isDraggingToAvailable && (
                            <span className="ml-2 text-blue-500 animate-pulse">
                                (Drop Here to Return Course)
                            </span>
                        )}
                    </h3>
                    {isLoading ? (
                        <div className="text-center py-4">
                            Loading courses...
                        </div>
                    ) : availableCourses.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                            All courses have been assigned to the timetable
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 gap-4 max-h-[20vh] overflow-y-auto p-2">
                            {availableCourses.map((course) => (
                                <div
                                    key={course.sectionId}
                                    className={`${course.color} p-3 rounded-lg shadow cursor-move hover:shadow-md transition-all border`}
                                    draggable
                                    onDragStart={() => handleDragStart(course)}
                                >
                                    <h4 className="font-bold text-gray-800">
                                        {course.code}
                                    </h4>
                                    <p className="text-sm font-medium">
                                        {course.name}
                                    </p>
                                    <p className="text-xs mt-1 text-gray-700">
                                        Duration: {course.duration} hour
                                        {course.duration > 1 ? "s" : ""}
                                    </p>
                                    <p className="text-xs mt-1 truncate text-gray-700">
                                        Instructor: {course.instructor}
                                    </p>
                                    <p className="text-xs mt-1 truncate text-gray-700">
                                        Section: {course.section || "N/A"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Course details dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            Course Details
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCourse && (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div
                                    className={`w-full h-1 ${selectedCourse.color
                                        .replace("hover:", "")
                                        .replace("border-", "")}`}
                                ></div>
                                <h3 className="font-bold text-lg">
                                    {selectedCourse.code}: {selectedCourse.name}
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Duration:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.duration} hour(s)
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Instructor:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.instructor}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Room:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.room}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Time:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.day},{" "}
                                            {selectedCourse.startTime} -{" "}
                                            {selectedCourse.endTime}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Section:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.section}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleRemoveCourse}
                                >
                                    Remove
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
