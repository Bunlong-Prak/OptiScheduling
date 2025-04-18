"use client";

import { Course as ApiCourse } from "@/app/types";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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

import {
    CellToDelete,
    Classroom,
    CourseHour,
    Schedule,
    ScheduleAssignment,
    ScheduleResponse,
    TimetableCourse,
} from "@/app/types";
import { colors_class } from "@/components/custom/colors";
import { useParams } from "next/navigation";
// Initial schedule data (empty object)
const initialSchedule: Schedule = {};

export default function TimetableView() {
    const [schedule, setSchedule] = useState<Schedule>(initialSchedule);
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
    const [isSaving, setIsSaving] = useState(false);

    // Add state to track if dragging to available courses area
    const [isDraggingToAvailable, setIsDraggingToAvailable] = useState(false);

    // New state for time slots from database - course hours related
    const [timeSlots, setTimeSlots] = useState<CourseHour[]>([]);

    // State for classrooms from database
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    // Add these new state variables to your existing useState declarations
    // Add these new state variables to your existing useState declarations
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
    // Default time slots for fallback - course hours related
    const defaultTimeSlots = [
        { id: 1, time_slot: "8:00" },
        { id: 2, time_slot: "9:00" },
        { id: 3, time_slot: "10:00" },
        { id: 4, time_slot: "11:00" },
        { id: 5, time_slot: "12:00" },
        { id: 6, time_slot: "13:00" },
        { id: 7, time_slot: "14:00" },
        { id: 8, time_slot: "15:00" },
        { id: 9, time_slot: "16:00" },
        { id: 10, time_slot: "17:00" },
    ];
    const params = useParams();

    // Fetch time slots and classrooms from API
    useEffect(() => {
        // Use default time slots directly instead of fetching
        setTimeSlots(defaultTimeSlots);

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

        // fetchTimeSlots(); - commented out, not fetching course hours
        fetchClassrooms();
    }, []);

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
                    const coursesData: ApiCourse[] = await response.json();

                    // Transform API courses to the format needed for the timetable
                    // Keep all sections instead of filtering out duplicates
                    const transformedCourses = coursesData.map((course) => ({
                        code: course.code,
                        sectionId: course.sectionId, // Add sectionId for uniqueness
                        name: course.title,
                        color: colors_class[course.color],
                        duration: course.duration,
                        instructor: `${course.firstName || ""} ${
                            course.lastName || ""
                        }`.trim(),
                        section: course.section,
                        room: course.classroom || "TBA",
                        uniqueId: `${course.code}-${course.section}`, // Create a uniqueId combining code and section
                    }));

                    // No more filtering out duplicates by course code
                    setAvailableCourses(transformedCourses);
                } else {
                    console.error("Failed to fetch courses");
                    // Fallback to empty array if API fails
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
    }, []);

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
                console.log("Raw assignments data:", assignmentsData);

                // Process the assignments data to create schedule
                const newSchedule: Record<string, any> = {};
                const newAssignedCourses: TimetableCourse[] = [];

                assignmentsData.forEach((assignment: any) => {
                    // Extract data from the API response
                    const sectionId = assignment.sectionId?.toString() || "";
                    const classroomCode = assignment.classroom; // This is classroom CODE not ID
                    const code = assignment.code;
                    const title = assignment.title || code; // Fallback to code if title is missing
                    const firstName = assignment.firstName;
                    const lastName = assignment.lastName;
                    const day = assignment.day;

                    // Parse the time slot - extract start time from formats like "13:00 - 15:00"
                    let timeSlot = assignment.timeSlot;
                    let endTimeFromRange = null;

                    if (timeSlot && timeSlot.includes(" - ")) {
                        const parts = timeSlot.split(" - ");
                        timeSlot = parts[0].trim();
                        endTimeFromRange = parts[1].trim(); // Store end time for later use
                    }

                    // Use specified duration or calculate from range
                    let duration = parseInt(assignment.duration || 3, 10);

                    // Skip invalid assignments
                    if (!sectionId || !day || !timeSlot) {
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

                    // If classroom not found, log error and continue
                    if (!classroom) {
                        console.warn(
                            `Classroom with code ${classroomCode} not found. Available classrooms:`,
                            classrooms.map((c) => `${c.id}: ${c.code}`)
                        );
                        return;
                    }

                    const classroomId = classroom.id.toString();

                    // Instructor name from firstName and lastName
                    const instructorName =
                        firstName && lastName
                            ? `${firstName} ${lastName}`
                            : "TBA";

                    // Deterministic color based on course code
                    const colorIndex =
                        code.charCodeAt(0) % Object.keys(colors_class).length;
                    const colorClassName =
                        Object.values(colors_class)[colorIndex];

                    // Find the time slot index
                    const startIndex = timeSlots.findIndex(
                        (ts) => ts.time_slot === timeSlot
                    );

                    // Debug the time slot matching
                    if (startIndex === -1) {
                        console.warn(
                            `Time slot "${timeSlot}" not found for course ${code}. Available time slots:`,
                            timeSlots.map((ts) => ts.time_slot)
                        );
                        return;
                    }

                    // If we have an end time from the range, try to use it for more accurate duration
                    if (endTimeFromRange) {
                        const endIndex = timeSlots.findIndex(
                            (ts) => ts.time_slot === endTimeFromRange
                        );
                        if (endIndex !== -1) {
                            // Calculate duration from start to end time slot
                            duration = endIndex - startIndex + 1;
                            console.log(
                                `Calculated duration for ${code}: ${duration} hours (${timeSlot} to ${endTimeFromRange})`
                            );
                        }
                    }

                    // Calculate endTime safely
                    const actualDuration = Math.min(
                        duration,
                        timeSlots.length - startIndex
                    );
                    const endTimeIndex = Math.min(
                        startIndex + actualDuration - 1,
                        timeSlots.length - 1
                    );
                    const endTime = timeSlots[endTimeIndex].time_slot;

                    // Create the course object
                    const course = {
                        sectionId: sectionId,
                        code: code,
                        name: title,
                        instructor: instructorName,
                        duration: actualDuration,
                        day: day,
                        startTime: timeSlot,
                        endTime: endTime,
                        classroom: classroomId,
                        color: colorClassName,
                        section: sectionId.toString(),
                        room: classroomCode,
                        courseHours: timeSlot,
                    };

                    console.log("Processing course for schedule:", course);

                    // Add to assigned courses if not already there
                    if (
                        !newAssignedCourses.some(
                            (c) =>
                                c.sectionId === sectionId &&
                                c.day === day &&
                                c.startTime === timeSlot
                        )
                    ) {
                        newAssignedCourses.push({ ...course });
                    }

                    // Add to schedule grid
                    for (let i = 0; i < actualDuration; i++) {
                        if (startIndex + i >= timeSlots.length) break;

                        const currentTimeSlot =
                            timeSlots[startIndex + i].time_slot;
                        const key = `${day}-${classroomId}-${currentTimeSlot}`;

                        console.log(`Adding to schedule with key: ${key}`);

                        newSchedule[key] = {
                            ...course,
                            isStart: i === 0,
                            isMiddle: i > 0 && i < actualDuration - 1,
                            isEnd: i === actualDuration - 1,
                            colspan: i === 0 ? actualDuration : 0,
                        };
                    }
                });

                console.log("Final processed schedule:", newSchedule);
                console.log("Final assigned courses:", newAssignedCourses);

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
        if (assignedCourses.length === 0) {
            alert("No courses to save!");
            return;
        }

        setIsSaving(true);
        try {
            // Prepare data for API
            const assignmentsData = assignedCourses.map((course) => ({
                sectionId: course.sectionId,
                day: course.day,
                startTime: course.startTime,
                endTime: course.endTime,
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
        } finally {
            setIsSaving(false);
        }
    };

    // Function to export timetable
    const exportTimetable = () => {
        // Implement export functionality
        alert("Export functionality to be implemented");
    };

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
        const index = timeSlots.findIndex((ts) => ts.time_slot === timeSlotStr);
        return index !== -1 ? index + 1 : 0;
    };

    // Handle drop - completely rewritten to prevent duplication
    const handleDrop = (day: string, classroomId: string, timeSlot: string) => {
        if (!draggedCourse || timeSlots.length === 0) return;

        // Get time slot ID - course hours related
        const timeSlotId = getTimeSlotId(timeSlot);
        if (timeSlotId === 0) {
            console.error(`Time slot ${timeSlot} not found in database`);
            return;
        }

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

        // Check if there's enough space for the course duration
        const timeSlotIndex = timeSlots.findIndex(
            (ts) => ts.time_slot === timeSlot
        );
        if (timeSlotIndex + draggedCourse.duration > timeSlots.length) {
            alert("Not enough time slots available for this course duration.");
            return;
        }

        // Check for conflicts in subsequent time slots
        for (let i = 1; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;
            const nextTimeSlot = timeSlots[timeSlotIndex + i].time_slot;
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
                ? timeSlots[endTimeIndex].time_slot
                : timeSlots[timeSlots.length - 1].time_slot;

        // Create course with assignment data
        const assignedCourse = {
            ...draggedCourse,
            day: day,
            startTime: timeSlot,
            endTime: endTimeSlot,
            courseHoursId: timeSlotId,
            classroom: classroomId,
        };

        // Add the course to all its new time slots
        for (let i = 0; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;
            const currentTimeSlot = timeSlots[timeSlotIndex + i].time_slot;
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

        // Handle assignment lists based on where the course came from
        const isFromAvailable = !draggedCourse.day;

        if (isFromAvailable) {
            // Remove from available courses
            setAvailableCourses((prev) =>
                prev.filter(
                    (course) => course.sectionId !== draggedCourse.sectionId
                )
            );

            // Add to assigned courses
            setAssignedCourses((prev) => [
                ...prev.filter((c) => c.sectionId !== draggedCourse.sectionId),
                assignedCourse,
            ]);
        } else {
            // Just update the position in assigned courses
            setAssignedCourses((prev) => {
                const filtered = prev.filter(
                    (c) => c.sectionId !== draggedCourse.sectionId
                );
                return [...filtered, assignedCourse];
            });
        }

        // No longer saving to database immediately on drop
        // The save happens when the user clicks "Save All"
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
                const newSchedule: Schedule = {};
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
                        (ts) => ts.time_slot === startTime
                    );
                    if (startIndex === -1) {
                        console.warn(`Time slot ${startTime} not found`);
                        return;
                    }

                    // Find the end time index
                    const endIndex = timeSlots.findIndex(
                        (ts) => ts.time_slot === endTime
                    );
                    if (endIndex === -1) {
                        console.warn(`End time slot ${endTime} not found`);
                        return;
                    }

                    // Calculate duration based on start and end times
                    const duration = endIndex - startIndex + 1;

                    // Deterministic color based on course code to ensure consistency
                    const colorKey =
                        courseCode.charCodeAt(0) %
                        Object.keys(colors_class).length;
                    const colorClassName =
                        Object.values(colors_class)[colorKey];

                    // Create course object
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
                        section: sectionId.toString(), // Using sectionId as section identifier
                        room: classroomCode,
                        // Remove uniqueId as it's not in the TimetableCourse type
                    };

                    // Add to assigned courses
                    newAssignedCourses.push(course);

                    // Add to schedule grid for display
                    for (let i = 0; i < duration; i++) {
                        if (startIndex + i >= timeSlots.length) break;

                        const timeSlot = timeSlots[startIndex + i].time_slot;
                        const key = `${day}-${classroom.id}-${timeSlot}`;

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
    const handleRemoveCourse = () => {
        const { day, classroomId, timeSlot } = cellToDelete;
        const key = `${day}-${classroomId}-${timeSlot}`;
        const course = schedule[key];

        if (!course) return;

        // Get the course sectionId to remove
        const courseId = course.sectionId;

        // Create a new schedule without this course
        const newSchedule = { ...schedule };
        Object.keys(newSchedule).forEach((scheduleKey) => {
            if (newSchedule[scheduleKey].sectionId === courseId) {
                delete newSchedule[scheduleKey];
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
        };

        // Only add back to available courses if it's not already there
        if (!availableCourses.some((c) => c.sectionId === courseId)) {
            setAvailableCourses((prev) => [...prev, cleanCourse]);
        }

        // Remove from assigned courses
        setAssignedCourses((prev) =>
            prev.filter((c) => c.sectionId !== courseId)
        );

        setIsDialogOpen(false);
    };

    console.log("Schedule at render time:", schedule);

    return (
        <div className="relative min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Timetable</h2>
                <div className="space-x-2">
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
                    <Button>Export Timetable</Button>
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
                                                key={`${day}-${slot.time_slot}`}
                                                className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border "
                                            >
                                                {slot.time_slot}
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
                                                const key = `${day}-${classroom.id}-${slot.time_slot}`;
                                                const course = schedule[key];

                                                // Skip cells that are part of a multi-hour course but not the start
                                                if (course && !course.isStart) {
                                                    return null;
                                                }

                                                return (
                                                    <td
                                                        key={`${day}-${classroom.id}-${slot.time_slot}`}
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
                                                                slot.time_slot
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
                                                                        slot.time_slot,
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
