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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    AlertCircle,
    CheckCircle2,
    Download,
    Minus,
    Plus,
    Search,
    X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

// New type for course split configuration
interface CourseSplitConfig {
    course: TimetableCourse;
    splits: number[];
}

// Add type for instructor time constraints
interface InstructorTimeConstraint {
    id: number;
    instructor_id: number;
    day_of_the_week: string;
    time_period: string[];
    firstName: string;
    lastName: string;
}

// Add type for messages
interface Message {
    id: number;
    type: "success" | "error";
    text: string;
}

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
    const [hoveredCell, setHoveredCell] = useState<{day: string; time: string; classroom: string; index: number} | null>(null);

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

    // NEW: Search functionality state
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchActive, setIsSearchActive] = useState(false);

    // NEW: Course split dialog state
    const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);
    const [courseSplitConfig, setCourseSplitConfig] =
        useState<CourseSplitConfig | null>(null);
    const [splitDurations, setSplitDurations] = useState<number[]>([]);

    // NEW: Instructor time constraints state
    const [instructorConstraints, setInstructorConstraints] = useState<
        InstructorTimeConstraint[]
    >([]);

    // NEW: Messages state
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageIdCounter, setMessageIdCounter] = useState(0);

    const params = useParams();

    // NEW: Function to show messages
    const showMessage = (type: "success" | "error", text: string) => {
        const id = messageIdCounter;
        setMessageIdCounter((prev) => prev + 1);

        const newMessage: Message = { id, type, text };
        setMessages((prev) => [...prev, newMessage]);

        // Auto-remove message after 3 seconds
        setTimeout(() => {
            setMessages((prev) => prev.filter((msg) => msg.id !== id));
        }, 3000);
    };

    // NEW: Function to manually remove message
    const removeMessage = (id: number) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== id));
    };

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

    // NEW: Function to check instructor time constraints and scheduling conflicts
    const checkInstructorConstraints = (
        course: TimetableCourse,
        day: string,
        timeSlotIndex: number,
        duration: number
    ): { isValid: boolean; conflictMessage?: string } => {
        const instructorName = course.instructor.trim();

        console.log("=== CONSTRAINT CHECK DEBUG ===");
        console.log("Course:", course.code);
        console.log("Instructor:", instructorName);
        console.log("Day:", day);
        console.log("Time Slot Index:", timeSlotIndex);
        console.log("Duration:", duration);
        console.log("All Constraints:", instructorConstraints);

        // 1. Check instructor availability constraints (time_period = unavailable times)
        const matchingConstraints = instructorConstraints.filter(
            (constraint) => {
                const constraintInstructorName =
                    `${constraint.firstName} ${constraint.lastName}`.trim();
                const nameMatch = constraintInstructorName === instructorName;
                const dayMatch = constraint.day_of_the_week === day;

                console.log("Checking constraint:");
                console.log(
                    "  - Constraint instructor:",
                    constraintInstructorName
                );
                console.log("  - Course instructor:", instructorName);
                console.log("  - Name match:", nameMatch);
                console.log("  - Constraint day:", constraint.day_of_the_week);
                console.log("  - Drop day:", day);
                console.log("  - Day match:", dayMatch);
                console.log("  - Time periods:", constraint.time_period);

                return nameMatch && dayMatch;
            }
        );

        console.log("Matching constraints found:", matchingConstraints.length);

        if (matchingConstraints.length > 0) {
            const instructorConstraint = matchingConstraints[0];

            // Check each time slot the course would occupy
            for (let i = 0; i < duration; i++) {
                if (timeSlotIndex + i >= timeSlots.length) break;

                const timeSlotObject = timeSlots[timeSlotIndex + i];
                console.log("Checking time slot object:", timeSlotObject);

                // Get all possible time representations
                const timeRepresentations = [
                    timeSlotObject.startTime,
                    timeSlotObject.time_slot,
                    getTimeSlotKey(timeSlotObject),
                ].filter(Boolean); // Remove undefined/null values

                console.log(
                    "Time representations to check:",
                    timeRepresentations
                );
                console.log(
                    "Against constraint time periods:",
                    instructorConstraint.time_period
                );

                // Check if any time representation matches the constraint periods
                for (const timeRep of timeRepresentations) {
                    if (instructorConstraint.time_period.includes(timeRep)) {
                        console.log("🚫 CONSTRAINT VIOLATION FOUND!");
                        console.log("Blocked time:", timeRep);
                        return {
                            isValid: false,
                            conflictMessage: `Instructor ${instructorName} is not available on ${day} at ${timeRep} `,
                        };
                    }
                }

                // Also check if time_period contains time ranges and current time falls within
                for (const timePeriod of instructorConstraint.time_period) {
                    if (timePeriod.includes("-")) {
                        // Handle time ranges like "09:00-10:00"
                        const [periodStart, periodEnd] = timePeriod
                            .split("-")
                            .map((t) => t.trim());

                        for (const timeRep of timeRepresentations) {
                            if (
                                timeRep === periodStart ||
                                (timeSlotObject.startTime >= periodStart &&
                                    timeSlotObject.startTime < periodEnd) ||
                                (timeSlotObject.time_slot &&
                                    timeSlotObject.time_slot.startsWith(
                                        periodStart
                                    ))
                            ) {
                                console.log(
                                    "🚫 CONSTRAINT VIOLATION FOUND IN RANGE!"
                                );
                                console.log("Blocked time range:", timePeriod);
                                console.log("Attempted time:", timeRep);
                                return {
                                    isValid: false,
                                    conflictMessage: `Instructor ${instructorName} is not available on ${day} at ${timeRep} (time constraint)`,
                                };
                            }
                        }
                    }
                }
            }
        }

        // 2. Check if instructor is already teaching another course at the same time
        for (let i = 0; i < duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;

            const currentTimeSlot = getTimeSlotKey(
                timeSlots[timeSlotIndex + i]
            );

            // Check all schedule entries for conflicts with this instructor
            const conflictingCourse = Object.entries(schedule).find(
                ([scheduleKey, scheduledCourse]) => {
                    // Skip if it's the same course (in case of moving an existing course)
                    if (scheduledCourse.sectionId === course.sectionId) {
                        return false;
                    }

                    // Check if the scheduled course is on the same day and same instructor
                    if (
                        scheduledCourse.day === day &&
                        scheduledCourse.instructor.trim() === instructorName
                    ) {
                        // Parse the schedule key to get the time slot
                        const keyParts = scheduleKey.split("-");
                        const scheduleTimeSlot = keyParts[keyParts.length - 1]; // Last part is the time slot

                        // Check if time slots overlap
                        return scheduleTimeSlot === currentTimeSlot;
                    }

                    return false;
                }
            );

            if (conflictingCourse) {
                const [, conflictingScheduledCourse] = conflictingCourse;
                console.log("🚫 SCHEDULING CONFLICT FOUND!");
                return {
                    isValid: false,
                    conflictMessage: `Instructor ${instructorName} is already teaching ${conflictingScheduledCourse.code} on ${day} at ${currentTimeSlot}`,
                };
            }
        }

        console.log("✅ No constraints violated");
        return { isValid: true };
    };

    // NEW: Course split dialog functions
    const handleCourseClick = (course: TimetableCourse) => {
        if (course.duration > 1) {
            setCourseSplitConfig({ course, splits: [] });
            setSplitDurations([course.duration]); // Start with original duration
            setIsSplitDialogOpen(true);
        } else {
            // For 1-hour courses, directly set as draggable
            setDraggedCourse(course);
        }
    };

    const addSplit = () => {
        setSplitDurations((prev) => [...prev, 1]);
    };

    const removeSplit = (index: number) => {
        if (splitDurations.length > 1) {
            setSplitDurations((prev) => prev.filter((_, i) => i !== index));
        }
    };

    const updateSplitDuration = (index: number, value: number) => {
        setSplitDurations((prev) =>
            prev.map((duration, i) =>
                i === index ? Math.max(1, value) : duration
            )
        );
    };

    const getTotalSplitDuration = () => {
        return splitDurations.reduce((sum, duration) => sum + duration, 0);
    };

    const isValidSplit = () => {
        const total = getTotalSplitDuration();
        return total === courseSplitConfig?.course.duration;
    };

    const applySplit = () => {
        if (!courseSplitConfig || !isValidSplit()) return;

        const { course } = courseSplitConfig;

        // Remove original course from available courses
        setAvailableCourses((prev) =>
            prev.filter((c) => c.sectionId !== course.sectionId)
        );

        // Create split courses
        const splitCourses = splitDurations.map((duration, index) => ({
            ...course,
            sectionId: Number.isNaN(Number(course.sectionId))
                ? course.sectionId
                : Number(course.sectionId), // keep as number if possible
            duration: duration,
            uniqueId: `${course.code}-${course.section}-split-${index + 1}`,
            name: `${course.name} (Part ${index + 1})`,
        }));

        // Add split courses to available courses
        setAvailableCourses((prev) => [
            ...prev,
            ...splitCourses.map((split, idx) => ({
                ...split,
                sectionId:
                    typeof split.sectionId === "number"
                        ? split.sectionId * 1000 + idx + 1 // ensure uniqueness and number type
                        : idx + 1, // fallback if not a number
            })),
        ]);

        // Close dialog
        setIsSplitDialogOpen(false);
        setCourseSplitConfig(null);
        setSplitDurations([]);
    };

    const cancelSplit = () => {
        setIsSplitDialogOpen(false);
        setCourseSplitConfig(null);
        setSplitDurations([]);
    };

    // NEW: Filtered schedule based on search query
    const filteredSchedule = useMemo(() => {
        if (!searchQuery.trim()) {
            return schedule;
        }

        const query = searchQuery.toLowerCase().trim();
        const filtered: TimetableGrid = {};

        Object.entries(schedule).forEach(([key, course]) => {
            const matchesSearch =
                course.code.toLowerCase().includes(query) ||
                course.name.toLowerCase().includes(query) ||
                course.instructor.toLowerCase().includes(query) ||
                course.section.toLowerCase().includes(query);

            if (matchesSearch) {
                filtered[key] = course;
            }
        });

        return filtered;
    }, [schedule, searchQuery]);

    // NEW: Check if search has active results
    useEffect(() => {
        setIsSearchActive(searchQuery.trim().length > 0);
    }, [searchQuery]);

    // NEW: Search functionality helpers
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const clearSearch = () => {
        setSearchQuery("");
    };

    // NEW: Fetch instructor time constraints
    useEffect(() => {
        const fetchInstructorConstraints = async () => {
            try {
                const scheduleId = params.id;
                const response = await fetch(
                    `/api/time-constraints?scheduleId=${scheduleId}`
                );

                if (response.ok) {
                    const constraintsData = await response.json();
                    setInstructorConstraints(constraintsData);
                    console.log(
                        "Loaded instructor constraints:",
                        constraintsData
                    );
                } else {
                    console.error("Failed to fetch instructor constraints");
                }
            } catch (error) {
                console.error("Error fetching instructor constraints:", error);
            }
        };

        if (params.id) {
            fetchInstructorConstraints();
        }
    }, [params.id]);

    // Fetch time slots and classrooms from API
    useEffect(() => {
        const fetchTimeSlots = async () => {
            try {
                const scheduleId = params.id;
                const response = await fetch(
                    `/api/schedule-time-slots?scheduleId=${scheduleId}`
                );

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
    // Add this new state to store original course colors
    const [originalCourseColors, setOriginalCourseColors] = useState<
        Map<string, { color: string; originalColor?: string }>
    >(new Map());

    // Update the courses fetch useEffect to store original colors
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

                    // NEW: Create color map to preserve original colors
                    const colorMap = new Map<
                        string,
                        { color: string; originalColor?: string }
                    >();

                    coursesData.forEach((course) => {
                        const sectionId = course.sectionId;

                        if (!coursesBySectionId[sectionId]) {
                            coursesBySectionId[sectionId] = { ...course };
                        }
                    });

                    // Transform for timetable
                    const transformedCourses = Object.values(
                        coursesBySectionId
                    ).map((course: any) => {
                        const colorClassName =
                            colors_class[course.color] ||
                            getConsistentCourseColor(course.code);

                        // Store the color mapping for later use
                        colorMap.set(course.code, {
                            color: colorClassName,
                            originalColor: course.color,
                        });

                        return {
                            code: course.code,
                            sectionId: course.sectionId,
                            name: course.title,
                            color: colorClassName,
                            duration: course.duration,
                            instructor: `${course.firstName || ""} ${
                                course.lastName || ""
                            }`.trim(),
                            section: course.section,
                            room: course.classroom || "TBA",
                            uniqueId: `${course.code}-${course.section}`,
                            majors: course.major || [],
                            originalColor: course.color,
                        };
                    });

                    // Store the color mapping
                    setOriginalCourseColors(colorMap);
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
                showMessage("success", "All assignments saved successfully!");
            } else {
                const errorData = await response.json();
                console.error("Failed to save assignments:", errorData);
                showMessage(
                    "error",
                    `Failed to save assignments: ${
                        errorData.error || "Unknown error"
                    }`
                );
            }
        } catch (error) {
            console.error("Error saving assignments:", error);
            showMessage(
                "error",
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

    // UPDATED: Handle drop with instructor constraint checking
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
            showMessage(
                "error",
                "This time slot is already occupied. Please choose another slot."
            );
            return;
        }

        // CRITICAL FIX: Check if there's enough space for the course duration within the SAME DAY
        // First, calculate how many time slots are left in this day
        const remainingSlots = timeSlots.length - timeSlotIndex;

        if (draggedCourse.duration > remainingSlots) {
            showMessage(
                "error",
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
                showMessage(
                    "error",
                    "There's a conflict with another course in subsequent time slots."
                );
                return;
            }
        }

        // NEW: Check instructor time constraints
        const constraintCheck = checkInstructorConstraints(
            draggedCourse,
            day,
            timeSlotIndex,
            draggedCourse.duration
        );

        if (!constraintCheck.isValid) {
            showMessage(
                "error",
                constraintCheck.conflictMessage ||
                    "Instructor time constraint conflict"
            );
            return;
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

    // Handle course click in timetable - updated to use classroom instead of major
    const handleScheduledCourseClick = (
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

    // UPDATED: generateSchedule function with success message
    const generateSchedule = async () => {
        if (!params.id) {
            showMessage("error", "Schedule ID is missing");
            return;
        }

        setIsGeneratingSchedule(true);

        try {
            const scheduleId = params.id.toString();

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

            if (data.stats) {
                setGenerationStats(data.stats);
            }

            if (data.schedule && Array.isArray(data.schedule)) {
                setSchedule({});

                const newSchedule: TimetableGrid = {};
                const newAssignedCourses: TimetableCourse[] = [];

                const transformedSchedule: ScheduleAssignment[] =
                    data.schedule.map((item: any) => ({
                        sectionId: item.section_id,
                        courseCode: item.course_code,
                        courseTitle: item.course_title,
                        courseColor: item.course_color || "",
                        instructorName: item.instructor_name,
                        day: item.day,
                        startTime: item.start_time,
                        endTime: item.end_time,
                        classroomCode: item.classroom_code,
                    }));

                transformedSchedule.forEach(
                    (assignment: ScheduleAssignment) => {
                        const {
                            sectionId,
                            courseCode,
                            courseTitle,
                            courseColor,
                            instructorName,
                            day,
                            startTime,
                            endTime,
                            classroomCode,
                        } = assignment;

                        const classroom = classrooms.find(
                            (c) => c.code === classroomCode
                        );
                        if (!classroom) {
                            console.warn(
                                `Classroom with code ${classroomCode} not found`
                            );
                            return;
                        }

                        // FIXED COLOR LOGIC: Use stored original colors first
                        let colorClassName: string;
                        let originalColorName: string | undefined;

                        // 1. First try to get the original color from our stored map
                        const storedColor =
                            originalCourseColors.get(courseCode);
                        if (storedColor) {
                            colorClassName = storedColor.color;
                            originalColorName = storedColor.originalColor;
                        }
                        // 2. Then try API color if it exists in our color mapping
                        else if (courseColor && colors_class[courseColor]) {
                            colorClassName = colors_class[courseColor];
                            originalColorName = courseColor;
                        }
                        // 3. Try to find in available courses (though this might be empty)
                        else {
                            const originalCourse = [
                                ...availableCourses,
                                ...assignedCourses,
                            ].find((c) => c.code === courseCode);
                            if (originalCourse) {
                                colorClassName = originalCourse.color;
                                originalColorName =
                                    originalCourse.originalColor;
                            } else {
                                // 4. Last resort: generate consistent color
                                colorClassName =
                                    getConsistentCourseColor(courseCode);
                                originalColorName = courseColor;
                            }
                        }

                        const startIndex = timeSlots.findIndex(
                            (ts) =>
                                getTimeSlotKey(ts) === startTime ||
                                ts.startTime === startTime
                        );
                        if (startIndex === -1) {
                            console.warn(`Time slot ${startTime} not found`);
                            return;
                        }

                        const endIndex = timeSlots.findIndex(
                            (ts) =>
                                getTimeSlotKey(ts) === endTime ||
                                ts.endTime === endTime ||
                                (ts.time_slot &&
                                    ts.time_slot.endsWith(`-${endTime}`))
                        );

                        const duration =
                            endIndex !== -1 ? endIndex - startIndex + 1 : 1;

                        const course: TimetableCourse = {
                            sectionId: sectionId,
                            code: courseCode,
                            name: courseTitle,
                            instructor: instructorName,
                            duration,
                            day,
                            startTime: startTime,
                            endTime: endTime,
                            classroom: classroom.id.toString(),
                            color: colorClassName, // This will now be consistent
                            originalColor: originalColorName,
                            section: sectionId.toString(),
                            room: classroomCode,
                        };

                        newAssignedCourses.push(course);

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
                    }
                );

                setSchedule(newSchedule);
                setAssignedCourses(newAssignedCourses);

                const assignedIds = new Set(
                    newAssignedCourses.map((c) => c.sectionId)
                );
                setAvailableCourses((prev) =>
                    prev.filter((c) => !assignedIds.has(c.sectionId))
                );

                setScheduleGenerated(true);

                // Show success message
                showMessage("success", "Schedule generated successfully!");
            } else {
                console.error("Invalid schedule data format", data);
                showMessage(
                    "error",
                    "Failed to process the generated schedule data."
                );
            }
        } catch (error) {
            console.error("Error generating schedule:", error);
            showMessage(
                "error",
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

            // Show success message
            showMessage(
                "success",
                `Course ${course.code} removed successfully`
            );
        } catch (error) {
            console.error("Error removing course:", error);

            // Show user-friendly error message
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to remove course from timetable";

            showMessage("error", `Error: ${errorMessage}`);

            // Reopen dialog if there was an error
            setIsDialogOpen(true);
        }
    };

// Helper function to convert time to period number
const getTimePeriod = (timeSlot: string): number => {
    if (!timeSlot) return 0;
    const timeSlotIndex = timeSlots.findIndex(ts => getTimeSlotKey(ts) === timeSlot);
    return timeSlotIndex !== -1 ? timeSlotIndex + 1 : 0;
};

// Helper function to convert full day name to abbreviation
const getDayAbbreviation = (day: string): string => {
    const dayMap: Record<string, string> = {
        'Monday': 'Mon',
        'Tuesday': 'Tue', 
        'Wednesday': 'Wed',
        'Thursday': 'Thu',
        'Friday': 'Fri',
        'Saturday': 'Sat',
        'Sunday': 'Sun'
    };
    return dayMap[day] || day;
};

// FIXED: Main export function for old system format as CSV
const exportOldSystemFormat = () => {
    try {
        console.log('=== EXPORT DEBUG START ===');
        console.log('Schedule object:', schedule);
        console.log('Schedule keys:', Object.keys(schedule));
        console.log('Time slots:', timeSlots);
        
        // Check if schedule has data
        if (!schedule || Object.keys(schedule).length === 0) {
            showMessage('error', 'No schedule data to export. Please generate or create a schedule first.');
            return;
        }

        // Get all assigned courses (only start cells to avoid duplicates)
        const assignedCourses = Object.values(schedule).filter(course => {
            const isStart = course.isStart === true || course.isStart === undefined; // Handle both cases
            console.log(`Course ${course.code}: isStart=${course.isStart}, including=${isStart}`);
            return isStart;
        });

        console.log('Assigned courses found:', assignedCourses.length);
        console.log('Assigned courses:', assignedCourses);

        if (assignedCourses.length === 0) {
            showMessage('error', 'No assigned courses found to export.');
            return;
        }

        // Prepare CSV data
        const csvData: any[] = [];
        
        assignedCourses.forEach(course => {
            console.log('Processing course:', course);
            
            const dayAbbr = getDayAbbreviation(course.day || '');
            const startPeriod = getTimePeriod(course.startTime || '');
            const isOnline = !course.room || course.room === 'TBA' || course.room === '';
            const type = isOnline ? 'online' : 'offline';
            
            console.log(`Course ${course.code}: day=${dayAbbr}, startPeriod=${startPeriod}, duration=${course.duration}, type=${type}`);
            
            // Generate periods for the course duration
            const periods: string[] = [];
            for (let i = 0; i < course.duration; i++) {
                const period = startPeriod + i;
                const roomPart = isOnline ? '' : `${course.room}.`;
                const formatStr = `[${roomPart}${dayAbbr}.${period}.${type}]`;
                periods.push(formatStr);
            }
            
            // Add to CSV data
            csvData.push({
                course_code: course.code,
                course_name: course.name,
                instructor: course.instructor,
                day: course.day,
                room: course.room || 'Online',
                start_time: course.startTime,
                end_time: course.endTime,
                duration: course.duration,
                format: periods.join(', ')
            });
        });

        console.log('CSV data prepared:', csvData);

        if (csvData.length === 0) {
            showMessage('error', 'No data to export after processing.');
            return;
        }

        // Convert to CSV string
        const headers = ['course_code', 'course_name', 'instructor', 'day', 'room', 'start_time', 'end_time', 'duration', 'format'];
        const csvRows = [
            headers.join(','),
            ...csvData.map(row => 
                headers.map(header => {
                    const value = row[header] || '';
                    // Escape commas and quotes
                    if (value.toString().includes(',') || value.toString().includes('"')) {
                        return `"${value.toString().replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ];

        const csvContent = csvRows.join('\n');
        console.log('Final CSV content:', csvContent);

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        

        const today = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `schedule_export_${today}.csv`);
        
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('=== EXPORT DEBUG END ===');
        showMessage('success', `Schedule exported successfully! ${csvData.length} courses exported.`);
        
    } catch (error) {
        console.error('Export error:', error);
        showMessage('error', `Failed to export schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
    return (
        <div className="relative min-h-screen">
            <div className="flex justify-between items-center mb-8">
              <div>
            <h2 className="text-lg font-semibold text-gray-900">Classroom View Timetable</h2>
            <p className="text-xs text-gray-600 mt-1">Manage and generate classroom schedules</p>
        </div>
        
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
                    <Button className= " text-white px-6 py-2.5 rounded font-medium transition-colors" onClick={saveAllAssignments}>Save All</Button>
                    <Button
    onClick={exportOldSystemFormat}
    variant="outline"
    className="border-purple-600 text-purple-600 hover:bg-purple-50 text-xs px-3 py-1.5 rounded-md"
    disabled={Object.keys(schedule).length === 0}
>
    <Download className="mr-1 h-3 w-3" /> Export CSV
</Button>
                </div>
            </div>

            {/* NEW: Search Bar */}
            <div className="mb-6 ">
  <div className="relative max-w-md">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none ">
      <Search className="h-5 w-5 text-gray-400" />
    </div>
    <Input
      type="text"
      placeholder="Search courses by code, name, instructor, or section..."
      value={searchQuery}
      onChange={handleSearchChange}
      className="pl-10 pr-10 border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
    />
    {searchQuery && (
      <button
        onClick={clearSearch}
        className="absolute inset-y-0 right-0 pr-3 flex items-center"
      >
        <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
      </button>
    )}
  </div>
  {isSearchActive && (
    <div className="mt-2 text-sm text-gray-600">
      {Object.keys(filteredSchedule).length > 0 ? (
        <>Showing courses matching "{searchQuery}"</>
      ) : (
        <>No courses found matching "{searchQuery}"</>
      )}
    </div>
  )}
</div>

            {/* NEW: Message Display Area */}
            {messages.length > 0 && (
                <div className="mb-4 space-y-2">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                                message.type === "success"
                                    ? "bg-green-50 border-green-200 text-green-800"
                                    : "bg-red-50 border-red-200 text-red-800"
                            }`}
                        >
                            <div className="flex items-center">
                                {message.type === "success" ? (
                                    <CheckCircle2 className="h-5 w-5 mr-2" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 mr-2" />
                                )}
                                <span>{message.text}</span>
                            </div>
                            <button
                                onClick={() => removeMessage(message.id)}
                                className="ml-2 hover:opacity-70"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

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
                                                // UPDATED: Use filtered schedule instead of full schedule
                                                const course =
                                                    filteredSchedule[key];

                                                // Skip cells that are part of a multi-hour course but not the start
                                                if (course && !course.isStart) {
                                                    return null;
                                                }

                                                return (
                                                   <td
    key={`${day}-${classroom.id}-${slotKey}`}
    className="px-1 py-1 whitespace-nowrap text-xs border relative"
    colSpan={course?.colspan || 1}
    onDragOver={handleDragOver}
    onDrop={() => handleDrop(day, classroom.id.toString(), slotKey)}
    onMouseEnter={() => draggedCourse && setHoveredCell({
        day, 
        time: slotKey, 
        classroom: classroom.id.toString(),
        index: timeSlots.findIndex(ts => getTimeSlotKey(ts) === slotKey)
    })}
    onMouseLeave={() => setHoveredCell(null)}
>
{/* Hover preview - shows conflicts and time slots */}
{hoveredCell?.day === day && 
 hoveredCell?.time === slotKey && 
 hoveredCell?.classroom === classroom.id.toString() && 
 draggedCourse && 
 !course && (
    <div className="absolute z-50 -top-2 left-full ml-1 bg-gray-900 text-white shadow-lg p-2 rounded text-xs whitespace-nowrap">
        <div className="font-semibold mb-1">{draggedCourse.code} - {draggedCourse.duration}hr{draggedCourse.duration > 1 ? 's' : ''}</div>
        
        {/* Check constraints */}
        {(() => {
            const check = checkInstructorConstraints(draggedCourse, day, hoveredCell.index, draggedCourse.duration);
            if (!check.isValid) {
                return <div className="text-red-400 mb-1">⚠️ {check.conflictMessage}</div>;
            }
        })()}
        
        {/* Show time slots */}
        <div className="space-y-0.5">
            {Array.from({length: draggedCourse.duration}, (_, i) => {
                const slotIndex = hoveredCell.index + i;
                if (slotIndex < timeSlots.length) {
                    const slot = timeSlots[slotIndex];
                    const occupied = schedule[`${day}-${classroom.id}-${getTimeSlotKey(slot)}`];
                    return (
                        <div key={i} className={occupied ? "text-red-400" : "text-green-400"}>
                            {slot.time_slot || slot.startTime} {occupied ? `(${occupied.code})` : '✓'}
                        </div>
                    );
                }
                return <div key={i} className="text-red-400">Out of bounds</div>;
            })}
        </div>
    </div>
)}
    
    {/* Existing course display code stays the same */}
    {course ? (
        <div
            className={`${course.color} p-1 rounded cursor-pointer text-center border shadow-sm transition-all font-medium`}
            onClick={() => handleScheduledCourseClick(day, classroom.id.toString(), slotKey, course)}
            draggable
            onDragStart={() => handleDragStart(course)}
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
                                    className={`${course.color} p-3 rounded-lg shadow cursor-pointer hover:shadow-md transition-all border`}
                                    draggable
                                    onDragStart={() => handleDragStart(course)}
                                    onClick={() => handleCourseClick(course)}
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
                                    {course.duration > 1 && (
                                        <p className="text-xs mt-1 text-blue-600 font-medium">
                                            Click to split duration
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Course Split Dialog */}
            <Dialog
                open={isSplitDialogOpen}
                onOpenChange={setIsSplitDialogOpen}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            Split Course Duration
                        </DialogTitle>
                    </DialogHeader>

                    {courseSplitConfig && (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div
                                    className={`w-full h-1 ${courseSplitConfig.course.color
                                        .replace("hover:", "")
                                        .replace("border-", "")}`}
                                ></div>
                                <h3 className="font-bold text-lg">
                                    {courseSplitConfig.course.code}:{" "}
                                    {courseSplitConfig.course.name}
                                </h3>
                                <div className="text-sm text-gray-600">
                                    Original Duration:{" "}
                                    {courseSplitConfig.course.duration} hours
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-sm font-medium">
                                    Split into parts:
                                </Label>

                                {splitDurations.map((duration, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2"
                                    >
                                        <Label className="text-sm w-16">
                                            Part {index + 1}:
                                        </Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={duration}
                                            onChange={(e) =>
                                                updateSplitDuration(
                                                    index,
                                                    parseInt(e.target.value) ||
                                                        1
                                                )
                                            }
                                            className="w-20"
                                        />
                                        <span className="text-sm text-gray-500">
                                            hours
                                        </span>
                                        {splitDurations.length > 1 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    removeSplit(index)
                                                }
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addSplit}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Another Part
                                </Button>
                            </div>

                            <div className="text-sm">
                                <div className="flex justify-between">
                                    <span>Total Duration:</span>
                                    <span
                                        className={`font-medium ${
                                            isValidSplit()
                                                ? "text-green-600"
                                                : "text-red-600"
                                        }`}
                                    >
                                        {getTotalSplitDuration()} /{" "}
                                        {courseSplitConfig.course.duration}{" "}
                                        hours
                                    </span>
                                </div>
                                {!isValidSplit() && (
                                    <div className="text-red-600 text-xs mt-1">
                                        Total must equal original duration
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={cancelSplit}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={applySplit}
                                    disabled={!isValidSplit()}
                                >
                                    Split Course
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

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
