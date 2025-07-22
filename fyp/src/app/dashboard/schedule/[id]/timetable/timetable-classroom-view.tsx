"use client";

import {
    CellToDelete,
    Classroom,
    Course,
    CourseHour,
    isAssignedCourse,
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
import { MAX_TIMESLOTS } from "@/lib/utils";
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    ChevronDown,
    Download,
    Plus,
    Search,
    X,
    XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

// Extended type to support multiple courses in one cell
interface CombinedTimetableCourse extends TimetableCourse {
    combinedCourses?: TimetableCourse[];
    isCombined?: boolean;
}

type TimetableGrid = Record<string, CombinedTimetableCourse>;

const initialSchedule: TimetableGrid = {};
interface SchedulingError {
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
        attempted_day?: string;
        attempted_time?: string;
        attempted_classroom?: string;
    };
}

interface EnhancedScheduleResponse {
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
}
interface CourseSplitConfig {
    course: TimetableCourse;
    splits: number[];
}

interface InstructorTimeConstraint {
    id: number;
    instructor_id: number;
    day_of_the_week: string;
    time_period: string[];
    firstName: string;
    lastName: string;
}

interface DragState {
    isDragOver: boolean;
    isValidDrop: boolean;
}

interface CellDragState {
    [key: string]: DragState;
}

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
        useState<CombinedTimetableCourse | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [cellToDelete, setCellToDelete] = useState<CellToDelete>({
        day: "",
        classroomId: "",
        timeSlot: "",
        timeSlotId: 0,
    });
    const [hoveredCell, setHoveredCell] = useState<{
        day: string;
        time: string;
        classroom: string;
        index: number;
    } | null>(null);

    const [availableCourses, setAvailableCourses] = useState<TimetableCourse[]>(
        []
    );
    const [assignedCourses, setAssignedCourses] = useState<TimetableCourse[]>(
        []
    );
    const [isLoading, setIsLoading] = useState(true);
    const [isDraggingToAvailable, setIsDraggingToAvailable] = useState(false);
    const [timeSlots, setTimeSlots] = useState<CourseHour[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [isGeneratingSchedule, setIsGeneratingSchedule] =
        useState<boolean>(false);

    const [schedulingWarnings, setSchedulingWarnings] = useState<string[]>([]);
    const [scheduleGenerated, setScheduleGenerated] = useState<boolean>(false);
    const [generationStats, setGenerationStats] = useState<{
        totalCourses: number;
        totalSections: number;
        scheduledAssignments: number;
        constraintsApplied: number;
    } | null>(null);
    const [cellDragStates, setCellDragStates] = useState<{
        [key: string]: { isDragOver: boolean; isValidDrop: boolean };
    }>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);
    const [courseSplitConfig, setCourseSplitConfig] =
        useState<CourseSplitConfig | null>(null);
    const [splitDurations, setSplitDurations] = useState<number[]>([]);
    const [instructorConstraints, setInstructorConstraints] = useState<
        InstructorTimeConstraint[]
    >([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageIdCounter, setMessageIdCounter] = useState(0);
    const [originalCourseColors, setOriginalCourseColors] = useState<
        Map<string, { color: string; originalColor?: string }>
    >(new Map());

    // New state for course combining
    const [selectedCourseForCombining, setSelectedCourseForCombining] =
        useState<TimetableCourse | null>(null);
    const [isCombiningMode, setIsCombiningMode] = useState(false);
    type MessageType = "success" | "error";

    type Message = {
        id: string;
        type: MessageType;
        description: string;
    };

    const messageTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // Cleanup function for message timers
    useEffect(() => {
        return () => {
            // Clear all timers when component unmounts
            messageTimersRef.current.forEach((timer) => {
                clearTimeout(timer);
            });
            messageTimersRef.current.clear();
        };
    }, []);

    // Enhanced message utility functions
    const clearAllMessages = () => {
        // Clear all existing timers
        messageTimersRef.current.forEach((timer) => {
            clearTimeout(timer);
        });
        messageTimersRef.current.clear();

        // Clear all messages
        setMessages([]);
    };

    const removeMessage = (messageId: string) => {
        // Clear the timer for this message
        const timer = messageTimersRef.current.get(messageId);
        if (timer) {
            clearTimeout(timer);
            messageTimersRef.current.delete(messageId);
        }

        // Remove the message
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    };

    const addMessage = (type: MessageType, description: string) => {
        // Clear any existing messages first to prevent duplicates
        clearAllMessages();

        const newMessage: Message = {
            id: Date.now().toString(),
            type,
            description,
        };

        setMessages([newMessage]); // Only set this one message

        // Set auto-removal timer
        const timer = setTimeout(() => {
            removeMessage(newMessage.id);
        }, 5000);

        messageTimersRef.current.set(newMessage.id, timer);
    };

    const showSuccessMessage = (description: string) => {
        addMessage("success", description);
    };

    const showErrorMessage = (description: string) => {
        addMessage("error", description);
    };

    // Message component
    const MessageBanner = ({ message }: { message: Message }) => (
        <div
            className={`max-w-md p-4 rounded-lg shadow-xl border-l-4 transition-all duration-300 ease-in-out ${
                message.type === "success"
                    ? "bg-green-50 border-green-500 text-green-800"
                    : "bg-red-50 border-red-500 text-red-800"
            }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    {message.type === "success" ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                        <p className="text-sm mt-1 opacity-90">
                            {message.description}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => removeMessage(message.id)}
                    className={`ml-2 p-1 rounded-full hover:bg-opacity-20 transition-colors flex-shrink-0 ${
                        message.type === "success"
                            ? "hover:bg-green-600"
                            : "hover:bg-red-600"
                    }`}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
    const params = useParams();

    const normalizeTimeSlot = useCallback((timeSlot: any) => {
        if (!timeSlot) return "";

        if (typeof timeSlot === "string") {
            return timeSlot
                .replace(/\s+/g, "")
                .replace(/(\d{1,2}):(\d{2})/g, (match, hour, minute) => {
                    return `${hour.padStart(2, "0")}:${minute}`;
                });
        }

        if (timeSlot.startTime && timeSlot.endTime) {
            const start = normalizeTime(timeSlot.startTime);
            const end = normalizeTime(timeSlot.endTime);
            return `${start}-${end}`;
        }

        if (timeSlot.time_slot) {
            return normalizeTimeSlot(timeSlot.time_slot);
        }

        return timeSlot.toString();
    }, []);

    const normalizeTime = (time: any) => {
        if (!time) return "";

        const cleaned = time.toString().replace(/\s+/g, "");
        const match = cleaned.match(/(\d{1,2}):(\d{2})/);

        if (match) {
            const [, hour, minute] = match;
            return `${hour.padStart(2, "0")}:${minute}`;
        }

        return cleaned;
    };

    const getTimeSlotKey = (timeSlot: any): string => {
        if (typeof timeSlot === "string") {
            return timeSlot;
        }

        if (timeSlot.startTime) {
            return timeSlot.startTime;
        }

        if (timeSlot.time_slot) {
            return timeSlot.time_slot;
        }

        return timeSlot.toString();
    };

    const areTimeSlotsConsecutive = (slots: any[]): boolean => {
        if (!slots || slots.length < 2) return false;

        for (let i = 0; i < slots.length - 1; i++) {
            const currentSlot = slots[i];
            const nextSlot = slots[i + 1];

            let currentEndTime, nextStartTime;

            if (currentSlot.endTime) {
                currentEndTime = currentSlot.endTime;
            } else if (
                currentSlot.time_slot &&
                currentSlot.time_slot.includes("-")
            ) {
                currentEndTime = currentSlot.time_slot.split("-")[1].trim();
            } else {
                return false;
            }

            if (nextSlot.startTime) {
                nextStartTime = nextSlot.startTime;
            } else if (nextSlot.time_slot && nextSlot.time_slot.includes("-")) {
                nextStartTime = nextSlot.time_slot.split("-")[0].trim();
            } else {
                return false;
            }

            if (currentEndTime !== nextStartTime) {
                return false;
            }
        }

        return true;
    };

    // Helper function to format decimals to 2 places
    const formatDecimal = (value: number): number => {
        return Math.round(value * 100) / 100;
    };

    // Helper function to format decimals to 2 places as string
    const formatDecimalString = (value: number): string => {
        return value.toFixed(2);
    };

    const parseTimeSlot = (timeSlotStr: any) => {
        const normalized = normalizeTimeSlot(timeSlotStr);

        if (!normalized || !normalized.includes("-")) {
            return { startTime: normalized, endTime: normalized };
        }

        const [startTime, endTime] = normalized.split("-");
        return { startTime, endTime };
    };

    const checkInstructorConstraints = (
        course: TimetableCourse,
        day: string,
        timeSlotIndex: number,
        duration: number,
        targetClassroomId: string // Add target classroom parameter
    ): { isValid: boolean; conflictMessage?: string } => {
        const instructorName = course.instructor.trim();

        console.log("=== INSTRUCTOR CONSTRAINT CHECK ===");
        console.log("Course:", course.code);
        console.log("Instructor:", instructorName);
        console.log("Day:", day);
        console.log("Target Classroom ID:", targetClassroomId);
        console.log("Time slot index:", timeSlotIndex);
        console.log("Duration:", duration);

        // Check predefined instructor time constraints (unavailable times)
        const matchingConstraints = instructorConstraints.filter(
            (constraint) => {
                const constraintInstructorName =
                    `${constraint.firstName} ${constraint.lastName}`.trim();
                const nameMatch = constraintInstructorName === instructorName;
                const dayMatch = constraint.day_of_the_week === day;
                return nameMatch && dayMatch;
            }
        );

        if (matchingConstraints.length > 0) {
            const instructorConstraint = matchingConstraints[0];

            for (let i = 0; i < duration; i++) {
                if (timeSlotIndex + i >= timeSlots.length) break;

                const timeSlotObject = timeSlots[timeSlotIndex + i];
                const timeRepresentations = [
                    timeSlotObject.startTime,
                    timeSlotObject.time_slot,
                    getTimeSlotKey(timeSlotObject),
                ].filter(Boolean);

                for (const timeRep of timeRepresentations) {
                    if (instructorConstraint.time_period.includes(timeRep)) {
                        console.log("❌ Instructor unavailable at this time");
                        return {
                            isValid: false,
                            conflictMessage: `Instructor ${instructorName} is not available on ${day} at ${timeRep}`,
                        };
                    }
                }

                for (const timePeriod of instructorConstraint.time_period) {
                    if (timePeriod.includes("-")) {
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
                                    "❌ Instructor unavailable during this time period"
                                );
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

        // Check for instructor conflicts with existing courses
        console.log(
            "=== CHECKING INSTRUCTOR CONFLICTS WITH EXISTING COURSES ==="
        );

        // Calculate the time range for the course being placed
        const newCourseStartIndex = timeSlotIndex;
        const newCourseEndIndex = timeSlotIndex + duration - 1;

        console.log(`New course time range: slot ${newCourseStartIndex} to ${newCourseEndIndex} (duration: ${duration})`);

        // Collect all time slots occupied by the instructor, considering split durations
        const occupiedTimeSlots = new Map<number, { course: TimetableCourse; classroomId: string }>();
        
        Object.entries(schedule).forEach(([scheduleKey, scheduledCourse]) => {
            // Skip self
            if (scheduledCourse.id === course.id) {
                return;
            }

            // Check if it's the same day
            if (scheduledCourse.day !== day) {
                return;
            }

            // Check if it's the same instructor
            const scheduledInstructor = scheduledCourse.instructor.trim();
            if (scheduledInstructor !== instructorName) {
                return;
            }

            // Extract classroom and time slot from schedule key
            const keyParts = scheduleKey.split("-");
            const scheduleClassroomId = keyParts[keyParts.length - 2];
            const timeSlotKey = keyParts[keyParts.length - 1];

            // Find the time slot index for this scheduled course segment
            const timeSlotIndex = timeSlots.findIndex(ts => 
                getTimeSlotKey(ts) === timeSlotKey
            );
            
            if (timeSlotIndex !== -1) {
                // Each schedule entry represents a single time slot, so record it
                occupiedTimeSlots.set(timeSlotIndex, {
                    course: scheduledCourse,
                    classroomId: scheduleClassroomId
                });
                
                console.log(`Instructor ${instructorName} is busy at slot ${timeSlotIndex} (${timeSlotKey}) teaching ${scheduledCourse.code} in classroom ${scheduleClassroomId}`);
            }
        });

        console.log(`Found ${occupiedTimeSlots.size} occupied time slots for instructor ${instructorName} on ${day}`);

        // Check for conflicts with each time slot the new course would occupy
        for (let slotOffset = 0; slotOffset < duration; slotOffset++) {
            const checkSlotIndex = newCourseStartIndex + slotOffset;
            
            if (checkSlotIndex >= timeSlots.length) {
                console.log(`⚠️ Time slot ${checkSlotIndex} is beyond available slots`);
                break;
            }

            const occupiedSlot = occupiedTimeSlots.get(checkSlotIndex);
            
            if (occupiedSlot) {
                const existingCourse = occupiedSlot.course;
                const existingClassroomId = occupiedSlot.classroomId;
                
                // Check if it's the same classroom and we're trying to combine courses
                const isSameClassroom = existingClassroomId === targetClassroomId;
                
                console.log(`❌ INSTRUCTOR CONFLICT DETECTED at slot ${checkSlotIndex}`);
                console.log("Existing course:", existingCourse.code);
                console.log("New course:", course.code);
                console.log("Same classroom:", isSameClassroom);
                console.log("Existing classroom ID:", existingClassroomId);
                console.log("Target classroom ID:", targetClassroomId);

                if (isSameClassroom) {
                    // Same classroom - check if this is for course combining (exact same time range)
                    const isExactSameTimeRange = newCourseStartIndex === timeSlotIndex && 
                                               newCourseEndIndex === (timeSlotIndex + duration - 1);
                    
                    if (isExactSameTimeRange) {
                        console.log("✅ Same classroom and exact same time range - allowing for course combining");
                        continue; // This specific slot is allowed for combining
                    } else {
                        return {
                            isValid: false,
                            conflictMessage: `Instructor ${instructorName} is already teaching ${existingCourse.code} during an overlapping time period in the same classroom on ${day}. Courses can only be combined if they have identical start and end times.`,
                        };
                    }
                } else {
                    // Different classrooms - instructor cannot be in two places at once
                    const conflictClassroom = classrooms.find(
                        (c) => c.id.toString() === existingClassroomId
                    );
                    
                    return {
                        isValid: false,
                        conflictMessage: `Instructor ${instructorName} is already teaching ${existingCourse.code} in ${
                            conflictClassroom?.code || "another classroom"
                        } at this time on ${day}. Cannot teach in multiple classrooms simultaneously.`,
                    };
                }
            } else {
                console.log(`✅ Time slot ${checkSlotIndex} is free for instructor ${instructorName}`);
            }
        }

        console.log("✅ All instructor constraints passed");
        return { isValid: true };
    };
    // New function to combine courses
    const combineCourses = (
        existingCourse: CombinedTimetableCourse,
        newCourse: TimetableCourse
    ): CombinedTimetableCourse => {
        const combinedCourses = existingCourse.combinedCourses || [];

        // Verify instructors are the same before combining
        if (existingCourse.instructor.trim() !== newCourse.instructor.trim()) {
            throw new Error(
                "Cannot combine courses with different instructors"
            );
        }

        return {
            ...existingCourse,
            isCombined: true,
            combinedCourses: [...combinedCourses, newCourse],
            // Update display name to show combination
            name: `${existingCourse.name} + ${newCourse.name}`,
            code: `${existingCourse.code} + ${newCourse.code}`,
            // Keep the same instructor since they must be the same
            instructor: existingCourse.instructor,
        };
    };

    // New function to check if courses can be combined
    const canCombineCourses = (
        course1: TimetableCourse,
        course2: TimetableCourse,
        day: string,
        timeSlotIndex: number
    ): { canCombine: boolean; reason?: string } => {
        console.log("=== CHECKING IF COURSES CAN BE COMBINED ===");
        console.log(
            "Course 1:",
            course1.code,
            "Instructor:",
            course1.instructor
        );
        console.log(
            "Course 2:",
            course2.code,
            "Instructor:",
            course2.instructor
        );

        // Check if instructors are the same
        const instructor1 = course1.instructor.trim();
        const instructor2 = course2.instructor.trim();

        if (instructor1 !== instructor2) {
            console.log("❌ Cannot combine: Different instructors");
            return {
                canCombine: false,
                reason: "Cannot combine courses with different instructors",
            };
        }

        // Check if durations match
        if (course1.duration !== course2.duration) {
            console.log("❌ Cannot combine: Different durations");
            return {
                canCombine: false,
                reason: "Cannot combine courses with different durations",
            };
        }

        console.log("✅ Courses can be combined: Same instructor and duration");

        // Since instructors are the same, we can skip individual instructor constraint checks
        // The combined course will have the same instructor, so constraints will be the same
        return { canCombine: true };
    };

    const handleCourseClick = (course: TimetableCourse) => {
        if (course.duration > 1) {
            setCourseSplitConfig({ course, splits: [] });
            setSplitDurations([course.duration]);
            setIsSplitDialogOpen(true);
        }
    };

    const filteredSchedule = useMemo(() => {
        if (!searchQuery.trim()) {
            return schedule;
        }

        const query = searchQuery.toLowerCase().trim();
        const filtered: TimetableGrid = {};

        Object.entries(schedule).forEach(([key, course]) => {
            const matchesSearch = (c: TimetableCourse) =>
                c.code.toLowerCase().includes(query) ||
                c.name.toLowerCase().includes(query) ||
                c.instructor.toLowerCase().includes(query) ||
                c.section.toLowerCase().includes(query);

            if (matchesSearch(course)) {
                filtered[key] = course;
            } else if (course.combinedCourses) {
                const hasMatch = course.combinedCourses.some(matchesSearch);
                if (hasMatch) {
                    filtered[key] = course;
                }
            }
        });

        return filtered;
    }, [schedule, searchQuery]);

    useEffect(() => {
        setIsSearchActive(searchQuery.trim().length > 0);
    }, [searchQuery]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const clearSearch = () => {
        setSearchQuery("");
    };

    const fetchInstructorConstraints = async () => {
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/time-constraints?scheduleId=${scheduleId}`
            );

            if (response.ok) {
                const constraintsData = await response.json();
                setInstructorConstraints(constraintsData);
            } else {
                console.error("Failed to fetch instructor constraints");
            }
        } catch (error) {
            console.error("Error fetching instructor constraints:", error);
        }
    };

    const fetchTimeSlots = async () => {
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/schedule-time-slots?scheduleId=${scheduleId}`
            );

            if (response.ok) {
                const schedulesData = await response.json();
                const currentSchedule = schedulesData.find(
                    (s: any) => s.id.toString() === scheduleId
                );

                if (currentSchedule && currentSchedule.timeSlots) {
                    const apiTimeSlots = currentSchedule.timeSlots.map(
                        (slot: any) => {
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

                            if (
                                !slot.startTime &&
                                !slot.endTime &&
                                slot.time_slot &&
                                slot.time_slot.includes("-")
                            ) {
                                const parsed = parseTimeSlot(slot.time_slot);
                                formattedSlot.startTime = parsed.startTime;
                                formattedSlot.endTime = parsed.endTime;
                            }

                            return formattedSlot;
                        }
                    );

                    const isConsecutive = areTimeSlotsConsecutive(apiTimeSlots);
                    setTimeSlots(apiTimeSlots);
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

                const virtualOnlineClassrooms = [
                    { id: -1, code: "Online", capacity: 999 },
                    { id: -2, code: "Online", capacity: 999 },
                    { id: -3, code: "Online", capacity: 999 },
                    { id: -4, code: "Online", capacity: 999 },
                    { id: -5, code: "Online", capacity: 999 },
                ];

                setClassrooms([...data, ...virtualOnlineClassrooms]);
            }
        } catch (error) {
            console.error("Error fetching classrooms:", error);
        }
    };

    const fetchCourses = async () => {
        setIsLoading(true);
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/courses?scheduleId=${scheduleId}`
            );
            if (response.ok) {
                const coursesData: Course[] = await response.json();

                const colorMap = new Map<
                    string,
                    { color: string; originalColor?: string }
                >();

                const transformedCourses = coursesData.map((course: any) => {
                    const colorClassName =
                        colors_class[course.color] ||
                        getConsistentCourseColor(course.code);

                    colorMap.set(course.code, {
                        color: colorClassName,
                        originalColor: course.color,
                    });

                    const isOnlineCourse =
                        course.status === "online" || course.isOnline === true;

                    return {
                        id: course.id,
                        code: course.code,
                        sectionId: course.sectionId,
                        name: course.title,
                        color: colorClassName,
                        duration: course.separatedDuration || course.duration,
                        instructor: `${course.firstName || ""} ${
                            course.lastName || ""
                        }`.trim(),
                        section: course.section,
                        room: isOnlineCourse ? "Online" : course.classroom,
                        uniqueId: `${course.code}-${course.section}-${course.id}`,
                        majors: course.major || [],
                        originalColor: course.color,
                        status: isOnlineCourse ? "online" : "offline",
                        isOnline: isOnlineCourse,
                        day: course.day,
                        timeSlot: course.timeSlot,
                        capacity: course.capacity,
                    };
                });

                console.log("Transformed courses:", transformedCourses);

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

    useEffect(() => {
        if (params.id) {
            Promise.all([
                fetchInstructorConstraints(),
                fetchTimeSlots(),
                fetchClassrooms(),
                fetchCourses(),
            ]);
        }
    }, [params.id]);

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
                console.log("=== FETCH TIMETABLE ASSIGNMENTS DEBUG ===");
                console.log("Raw assignments data:", assignmentsData);
                console.log("Raw assignments count:", assignmentsData.length);

                // 🔥 CRITICAL FIX: Only collect course IDs that are PROPERLY SAVED in database
                // Courses with day, timeslot, and null classroom should remain in available courses
                const properlySavedCourseIds = new Set<number>();

                console.log("=== RAW ASSIGNMENT DEBUG ===");
                console.log("Assignment keys:", Object.keys(assignmentsData[0] || {}));
                assignmentsData.slice(0, 3).forEach((assignment, index) => {
                    console.log(`Assignment ${index}:`, {
                        id: assignment.id,
                        code: assignment.code,
                        day: assignment.day,
                        timeSlot: assignment.timeSlot,
                        startTime: assignment.startTime,
                        classroom: assignment.classroom,
                        classroomId: assignment.classroomId,
                        isOnline: assignment.isOnline,
                        status: assignment.status,
                    });
                });

                // First pass: collect only course IDs that have complete assignment data
                assignmentsData.forEach((assignment: any) => {
                    if (assignment.id) {
                        const hasDay =
                            assignment.day && assignment.day.trim() !== "";
                        const hasTimeSlot =
                            assignment.timeSlot || assignment.startTime;
                        
                        // For online courses, check if classroomId is a negative number OR if the course is marked as online
                        // For physical courses, check if classroom name exists
                        const isOnlineCourse = (assignment.classroomId && assignment.classroomId < 0) || 
                                             assignment.isOnline || 
                                             assignment.status === "online" ||
                                             (assignment.classroom === null && assignment.classroomId === null);
                        
                        const hasValidClassroom = isOnlineCourse || 
                            (assignment.classroom && assignment.classroom !== null && assignment.classroom.trim() !== "");

                        // Only consider it properly saved if it has complete assignment data
                        if (hasDay && hasTimeSlot && hasValidClassroom) {
                            properlySavedCourseIds.add(assignment.id);
                            console.log(
                                `Found PROPERLY SAVED course ID: ${
                                    assignment.id
                                } (${assignment.code}) - Day: ${
                                    assignment.day
                                }, Time: ${
                                    assignment.timeSlot || assignment.startTime
                                }, Classroom: ${
                                    isOnlineCourse ? `Online (ID: ${assignment.classroomId})` : assignment.classroom
                                }, IsOnline: ${isOnlineCourse}`
                            );
                        } else {
                            console.log(
                                `Found INCOMPLETE assignment (keeping in available): ${
                                    assignment.id
                                } (${assignment.code}) - Day: ${
                                    assignment.day
                                }, Time: ${
                                    assignment.timeSlot || assignment.startTime
                                }, Classroom: ${
                                    assignment.classroom ||
                                    assignment.classroomId
                                }, IsOnline: ${isOnlineCourse}, HasValidClassroom: ${hasValidClassroom}`
                            );
                        }
                    }
                });

                console.log(
                    "=== COLLECTED PROPERLY SAVED COURSE IDS FROM DATABASE ==="
                );
                console.log(
                    "Total properly saved course IDs:",
                    properlySavedCourseIds.size
                );
                console.log(
                    "Properly saved course IDs:",
                    Array.from(properlySavedCourseIds).sort()
                );

                // Process assignments for display (with auto-combining)
                const newSchedule: TimetableGrid = {};
                const newAssignedCourses: TimetableCourse[] = [];

                const processedAssignments =
                    autoCombineCourses(assignmentsData);
                console.log(
                    "Processed assignments after auto-combine:",
                    processedAssignments.length
                );

                processedAssignments.forEach((assignment: any) => {
                    const courseHourId = assignment.id;
                    const sectionId = assignment.sectionId;
                    const classroomCode = assignment.classroom;
                    const code = assignment.code;
                    const title = assignment.title || code;
                    const firstName = assignment.firstName;
                    const lastName = assignment.lastName;
                    const day = assignment.day;
                    const originalColor = assignment.color;
                    const isOnline =
                        assignment.isOnline || assignment.classroomId === null;

                    // Handle combined courses
                    const isCombined = assignment.isCombined || false;
                    const combinedCourses = assignment.combinedCourses || [];

                    const colorClassName =
                        originalColor && colors_class[originalColor]
                            ? colors_class[originalColor]
                            : getConsistentCourseColor(code);

                    let startTime = assignment.startTime;
                    let endTime = assignment.endTime;

                    if (!startTime && assignment.timeSlot) {
                        const timeSlot = assignment.timeSlot;
                        if (timeSlot.includes(" - ")) {
                            const parts = timeSlot.split(" - ");
                            startTime = parts[0].trim();
                            endTime = parts[1].trim();
                        } else {
                            startTime = timeSlot;
                        }
                    }

                    const originalDuration = parseFloat(
                        assignment.separatedDuration ||
                            assignment.duration ||
                            "1"
                    );

                    if (!courseHourId || !day || !startTime) {
                        console.warn(
                            "Skipping invalid assignment:",
                            assignment
                        );
                        return;
                    }

                    let classroom;
                    let classroomId;

                    if (isOnline) {
                        // For online courses, use the stored classroomId if it's a virtual classroom ID
                        if (assignment.classroomId && assignment.classroomId < 0) {
                            const virtualClassroom = classrooms.find(
                                (c) => c.id === assignment.classroomId
                            );
                            if (virtualClassroom) {
                                classroom = virtualClassroom;
                                classroomId = virtualClassroom.id.toString();
                            } else {
                                // Fallback to first available virtual classroom
                                const fallbackVirtualClassroom = classrooms.find(
                                    (c) => c.id < 0
                                );
                                if (fallbackVirtualClassroom) {
                                    classroom = fallbackVirtualClassroom;
                                    classroomId = fallbackVirtualClassroom.id.toString();
                                } else {
                                    classroomId = "-1";
                                    classroom = {
                                        id: -1,
                                        code: "Online",
                                        capacity: 999,
                                    };
                                }
                            }
                        } else {
                            // Legacy online courses without virtual classroom ID, distribute across available virtual classrooms
                            const virtualClassrooms = classrooms.filter((c) => c.id < 0);
                            if (virtualClassrooms.length > 0) {
                                // Use course ID to consistently assign to a virtual classroom
                                const virtualClassroomIndex = courseHourId % virtualClassrooms.length;
                                const selectedVirtualClassroom = virtualClassrooms[virtualClassroomIndex];
                                classroom = selectedVirtualClassroom;
                                classroomId = selectedVirtualClassroom.id.toString();
                                console.log(`🔄 Distributed online course ${code} (ID: ${courseHourId}) to virtual classroom ${selectedVirtualClassroom.id}`);
                            } else {
                                classroomId = "-1";
                                classroom = {
                                    id: -1,
                                    code: "Online",
                                    capacity: 999,
                                };
                                console.log(`⚠️ No virtual classrooms available, using fallback for ${code}`);
                            }
                        }
                    } else {
                        classroom = classrooms.find(
                            (c) => c.code === classroomCode
                        );
                        if (!classroom) {
                            console.warn(
                                `Classroom with code ${classroomCode} not found.`
                            );
                            return;
                        }
                        classroomId = classroom.id.toString();
                    }

                    const instructorName =
                        firstName && lastName
                            ? `${firstName} ${lastName}`
                            : "TBA";

                    const startIndex = timeSlots.findIndex((ts) => {
                        if (
                            ts.startTime === startTime ||
                            getTimeSlotKey(ts) === startTime
                        ) {
                            return true;
                        }
                        if (ts.startTime && ts.endTime) {
                            const slotStart = parseInt(ts.startTime);
                            const slotEnd = parseInt(ts.endTime);
                            const start = parseInt(startTime);
                            return slotStart <= start && start < slotEnd;
                        }
                        return false;
                    });

                    if (startIndex === -1) {
                        console.warn(
                            `Time slot "${startTime}" not found for course ${code}`
                        );
                        return;
                    }

                    let slotsToSpan;
                    let calculatedEndTime;

                    if (endTime) {
                        const endIndex = timeSlots.findIndex((ts) => {
                            if (ts.endTime === endTime) return true;
                            if (ts.startTime && ts.endTime) {
                                const slotStart = parseInt(ts.startTime);
                                const slotEnd = parseInt(ts.endTime);
                                const end = parseInt(endTime);
                                return slotStart < end && end <= slotEnd;
                            }
                            return false;
                        });

                        if (endIndex !== -1) {
                            slotsToSpan = endIndex - startIndex + 1;
                            calculatedEndTime = endTime;
                        } else {
                            slotsToSpan = calculateSlotsNeeded(
                                originalDuration,
                                timeSlots,
                                startIndex
                            );
                            calculatedEndTime = calculateEndTime(
                                startTime,
                                originalDuration
                            );
                        }
                    } else {
                        slotsToSpan = calculateSlotsNeeded(
                            originalDuration,
                            timeSlots,
                            startIndex
                        );
                        calculatedEndTime = calculateEndTime(
                            startTime,
                            originalDuration
                        );
                    }

                    const maxSlotsAvailable = timeSlots.length - startIndex;
                    slotsToSpan = Math.min(slotsToSpan, maxSlotsAvailable);

                    // Create course object with combined course information
                    const course: CombinedTimetableCourse = {
                        id: courseHourId,
                        capacity: assignment.capacity,
                        sectionId: sectionId,
                        code: isCombined ? assignment.combinedCodes : code,
                        name: isCombined ? assignment.combinedTitles : title,
                        instructor: instructorName,
                        duration: originalDuration,
                        day: day,
                        startTime: startTime,
                        endTime: calculatedEndTime,
                        classroom: classroomId,
                        color: colorClassName,
                        section:
                            assignment.sectionNumber ||
                            assignment.section_number ||
                            "N/A",
                        room: isOnline ? "Online" : classroomCode,
                        originalColor: originalColor,
                        isOnline: isOnline,
                        // Combined course properties
                        isCombined: isCombined,
                        combinedCourses: isCombined
                            ? combinedCourses.map((combined: any) => ({
                                  id: combined.id,
                                  code: combined.code,
                                  name: combined.title || combined.code,
                                  capacity: combined.capacity,
                                  color: colorClassName,
                                  duration: parseFloat(
                                      combined.separatedDuration ||
                                          combined.duration ||
                                          "1"
                                  ),
                                  instructor: instructorName,
                                  sectionId: combined.sectionId,
                                  section:
                                      combined.sectionNumber ||
                                      combined.section_number ||
                                      "N/A",
                                  room: isOnline ? "Online" : classroomCode,
                                  originalColor: combined.color,
                                  isOnline: isOnline,
                                  status: isOnline ? "online" : "offline",
                              }))
                            : undefined,
                    };

                    if (
                        !newAssignedCourses.some(
                            (c) =>
                                c.id === courseHourId &&
                                c.day === day &&
                                c.startTime === startTime
                        )
                    ) {
                        newAssignedCourses.push({ ...course });
                    }

                    const dayValue = assignment.day?.trim();
                    const classroomIdValue = isOnline
                        ? classroomId  // Use the actual virtual classroom ID
                        : classroom.id.toString();

                    for (let i = 0; i < slotsToSpan; i++) {
                        if (startIndex + i >= timeSlots.length) break;

                        const currentTimeSlot = getTimeSlotKey(
                            timeSlots[startIndex + i]
                        );
                        const key = `${dayValue}-${classroomIdValue}-${currentTimeSlot}`;

                        newSchedule[key] = {
                            ...course,
                            isStart: i === 0,
                            isMiddle: i > 0 && i < slotsToSpan - 1,
                            isEnd: i === slotsToSpan - 1,
                            colspan: i === 0 ? slotsToSpan : 0,
                        };
                    }
                });

                setSchedule(newSchedule);
                setAssignedCourses(newAssignedCourses);

                // 🔥 CRITICAL FIX: Only filter out courses that are PROPERLY SAVED in database
                // This should only happen when we have properly saved course IDs from the database
                if (properlySavedCourseIds.size > 0) {
                    console.log(
                        "=== FILTERING AVAILABLE COURSES BASED ON PROPERLY SAVED COURSES ==="
                    );
                    console.log(
                        "Available courses before filtering:",
                        availableCourses.length
                    );
                    console.log(
                        "Available courses list:",
                        availableCourses.map((c) => `${c.code} (ID: ${c.id})`)
                    );

                    setAvailableCourses((prevAvailable) => {
                        const filtered = prevAvailable.filter((course) => {
                            const isProperlySaved = properlySavedCourseIds.has(
                                course.id
                            );
                            if (isProperlySaved) {
                                console.log(
                                    `❌ Filtering out PROPERLY SAVED course: ${course.code} (ID: ${course.id})`
                                );
                            } else {
                                console.log(
                                    `✅ Keeping available course: ${course.code} (ID: ${course.id})`
                                );
                            }
                            return !isProperlySaved;
                        });

                        console.log(
                            "Available courses after filtering:",
                            filtered.length
                        );
                        console.log(
                            "Remaining available courses:",
                            filtered.map((c) => `${c.code} (ID: ${c.id})`)
                        );
                        return filtered;
                    });
                }

                console.log("=== FINAL FETCH RESULTS ===");
                console.log(
                    "Schedule entries created:",
                    Object.keys(newSchedule).length
                );
                console.log("Assigned courses:", newAssignedCourses.length);
                console.log(
                    "Properly saved courses in database:",
                    properlySavedCourseIds.size
                );
                console.log("=== FETCH TIMETABLE ASSIGNMENTS COMPLETE ===");
            } catch (error) {
                console.error("Error fetching timetable assignments:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (timeSlots.length > 0 && classrooms.length > 0) {
            fetchTimetableAssignments();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id, timeSlots, classrooms]);

    const calculateSlotsNeeded = useCallback(
        (durationHours: number, timeSlots: any[], startIndex: number) => {
            if (timeSlots.length === 0 || startIndex >= timeSlots.length)
                return 1;

            const firstSlotDuration = getSlotDurationHours(timeSlots[0]);
            const allSlotsUniform = timeSlots.every(
                (slot) => getSlotDurationHours(slot) === firstSlotDuration
            );

            if (allSlotsUniform) {
                return Math.ceil(durationHours / firstSlotDuration);
            } else {
                let hoursRemaining = durationHours;
                let slotsNeeded = 0;

                for (
                    let i = startIndex;
                    i < timeSlots.length && hoursRemaining > 0;
                    i++
                ) {
                    const slotDuration = getSlotDurationHours(timeSlots[i]);
                    hoursRemaining -= slotDuration;
                    slotsNeeded++;
                }

                return slotsNeeded;
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const getSlotDurationHours = useCallback((slot: any): number => {
        // Try to get duration from time_slot field first
        if (slot.time_slot && slot.time_slot.includes("-")) {
            const [start, end] = slot.time_slot
                .split("-")
                .map((t: string) => t.trim());
            const startHour = parseTimeToHours(start);
            const endHour = parseTimeToHours(end);
            return endHour - startHour;
        }

        // Try startTime and endTime fields
        if (slot.startTime && slot.endTime) {
            const startHour = parseTimeToHours(slot.startTime);
            const endHour = parseTimeToHours(slot.endTime);
            return endHour - startHour;
        }

        // Default to 1 hour if no duration info available
        return 1;
    }, []);

    const ErrorBanner = ({
        errors,
        warnings,
    }: {
        errors: SchedulingError[];
        warnings: string[];
    }) => {
        const [isExpanded, setIsExpanded] = useState(false);

        if (errors.length === 0 && warnings.length === 0) return null;

        const errorGroups = groupErrorsByType(errors);
        const totalErrors = errors.length;

        return (
            <div className="mb-6 border border-red-200 rounded-lg bg-red-50">
                {/* Error Summary Header */}
                <div
                    className="p-4 cursor-pointer flex items-center justify-between hover:bg-red-100 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center space-x-3">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <div>
                            <h3 className="font-medium text-red-800">
                                Schedule Generation Issues
                            </h3>
                            <p className="text-sm text-red-600">
                                {totalErrors} course
                                {totalErrors !== 1 ? "s" : ""} could not be
                                scheduled
                                {warnings.length > 0 &&
                                    `, ${warnings.length} warning${
                                        warnings.length !== 1 ? "s" : ""
                                    }`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-red-600 font-medium">
                            Click to {isExpanded ? "hide" : "view"} details
                        </span>
                        <ChevronDown
                            className={`h-4 w-4 text-red-600 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                            }`}
                        />
                    </div>
                </div>

                {/* Expanded Error Details */}
                {isExpanded && (
                    <div className="border-t border-red-200 p-4 space-y-6">
                        {/* Warnings Section */}
                        {warnings.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-yellow-700 mb-3 flex items-center">
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    Warnings ({warnings.length})
                                </h4>
                                <div className="space-y-2">
                                    {warnings.map((warning, index) => (
                                        <div
                                            key={index}
                                            className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800"
                                        >
                                            {warning}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Errors Section */}
                        {Object.entries(errorGroups).map(
                            ([errorType, typeErrors]) => (
                                <div key={errorType}>
                                    <h4 className="font-semibold text-red-700 mb-3 flex items-center">
                                        <XCircle className="w-4 h-4 mr-2" />
                                        {getErrorTypeDisplayName(
                                            errorType as SchedulingError["error_type"]
                                        )}
                                        <span className="ml-2 text-sm font-normal text-red-600">
                                            ({typeErrors.length} course
                                            {typeErrors.length !== 1 ? "s" : ""}
                                            )
                                        </span>
                                    </h4>

                                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                        {typeErrors.map((error) => (
                                            <ErrorCard
                                                key={error.section_id}
                                                error={error}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Individual Error Card Component
    const ErrorCard = ({ error }: { error: SchedulingError }) => {
        const [isDetailExpanded, setIsDetailExpanded] = useState(false);

        return (
            <div className="bg-white border border-red-200 rounded-lg p-4 space-y-3">
                <div className="space-y-2">
                    <div className="flex items-start justify-between">
                        <h5 className="font-medium text-red-800 text-sm">
                            {error.course_code} - {error.section_number}
                        </h5>
                        <div className="flex items-center space-x-1">
                            <div
                                className={`w-2 h-2 rounded-full ${getErrorTypeColor(
                                    error.error_type
                                )}`}
                            />
                        </div>
                    </div>

                    <p className="text-xs text-gray-700 line-clamp-1">
                        {error.course_title}
                    </p>

                    <p className="text-xs text-gray-600">
                        Instructor: {error.instructor_name}
                    </p>

                    <p className="text-xs text-red-700 bg-red-50 p-2 rounded">
                        {error.error_message}
                    </p>
                </div>

                {/* Error Details Toggle */}
                {error.details && Object.keys(error.details).length > 0 && (
                    <div>
                        <button
                            onClick={() =>
                                setIsDetailExpanded(!isDetailExpanded)
                            }
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                            <span>
                                {isDetailExpanded ? "Hide" : "Show"} details
                            </span>
                            <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                    isDetailExpanded ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {isDetailExpanded && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="space-y-1 text-xs">
                                    {error.details.required_capacity && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">
                                                Required Capacity:
                                            </span>
                                            <span className="font-medium">
                                                {
                                                    error.details
                                                        .required_capacity
                                                }{" "}
                                                students
                                            </span>
                                        </div>
                                    )}
                                    {error.details.available_capacity && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">
                                                Available Capacity:
                                            </span>
                                            <span className="font-medium">
                                                {
                                                    error.details
                                                        .available_capacity
                                                }{" "}
                                                students
                                            </span>
                                        </div>
                                    )}
                                    {/* {error.details.conflicting_course && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">
                                                Conflicts with:
                                            </span>
                                            <span className="font-medium">
                                                {
                                                    error.details
                                                        .conflicting_course
                                                }
                                            </span>
                                        </div>
                                    )} */}
                                    {error.details.attempted_day && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">
                                                Attempted Day:
                                            </span>
                                            <span className="font-medium">
                                                {error.details.attempted_day}
                                            </span>
                                        </div>
                                    )}
                                    {error.details.attempted_time && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">
                                                Attempted Time:
                                            </span>
                                            <span className="font-medium">
                                                {error.details.attempted_time}
                                            </span>
                                        </div>
                                    )}
                                    {error.details.attempted_classroom && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">
                                                Attempted Classroom:
                                            </span>
                                            <span className="font-medium">
                                                {
                                                    error.details
                                                        .attempted_classroom
                                                }
                                            </span>
                                        </div>
                                    )}
                                    {error.details.required_duration && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">
                                                Required Duration:
                                            </span>
                                            <span className="font-medium">
                                                {
                                                    error.details
                                                        .required_duration
                                                }{" "}
                                                hours
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Helper function to get error type color
    const getErrorTypeColor = (
        errorType: SchedulingError["error_type"]
    ): string => {
        switch (errorType) {
            case "CAPACITY_CONSTRAINT":
                return "bg-red-500";
            case "TIME_CONSTRAINT":
                return "bg-yellow-500";
            case "INSTRUCTOR_CONFLICT":
                return "bg-orange-500";
            case "NO_AVAILABLE_SLOTS":
                return "bg-purple-500";
            case "NO_CLASSROOM":
                return "bg-blue-500";
            case "DURATION_MISMATCH":
                return "bg-pink-500";
            default:
                return "bg-gray-500";
        }
    };

    const parseTimeToHours = (timeStr: string): number => {
        if (!timeStr) return 0;

        // Handle formats like "08:00", "8:30", "14:45", etc.
        const cleanTime = timeStr.replace(/\s+/g, "");
        const match = cleanTime.match(/(\d{1,2}):(\d{2})/);

        if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            return hours + minutes / 60;
        }

        // If it's just a number, treat as hours
        const numericTime = parseInt(cleanTime, 10);
        if (!isNaN(numericTime)) {
            return numericTime;
        }

        return 0;
    };

    const calculateEndTime = useCallback(
        (startTime: string, durationHours: number) => {
            const startHour = parseInt(startTime);
            return (startHour + durationHours).toString();
        },
        []
    );

    const handleDragStart = (course: TimetableCourse) => {
        setDraggedCourse(course);
        setCellDragStates({});
    };

    const handleAvailableDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(true);
    };

    const handleAvailableDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(false);
    };

    const autoCombineCourses = useCallback(
        (assignmentsData: any[]): any[] => {
            console.log(
                "=== AUTO-COMBINING COURSES WITH SAME INSTRUCTOR AND DURATION ==="
            );
            console.log("Input assignments:", assignmentsData.length);

            // First, normalize all time representations
            const normalizedAssignments = assignmentsData.map((assignment) => {
                const normalizedStartTime = normalizeTimeSlot(
                    assignment.startTime || assignment.timeSlot
                );
                const isOnline =
                    assignment.isOnline || 
                    assignment.status === "online" ||
                    assignment.classroomId === null ||
                    (assignment.classroomId && assignment.classroomId < 0);
                    
                let classroomKey;
                if (isOnline) {
                    // If it already has a virtual classroom ID, use it
                    if (assignment.classroomId && assignment.classroomId < 0) {
                        classroomKey = assignment.classroomId.toString();
                    } else {
                        // Each online course gets its own unique virtual classroom to prevent conflicts
                        // Use the course ID directly to ensure uniqueness
                        const virtualClassroomId = -assignment.id; // Use negative course ID as virtual classroom ID
                        classroomKey = virtualClassroomId.toString();
                    }
                } else {
                    classroomKey = assignment.classroom ||
                      assignment.classroomId?.toString() ||
                      "unknown";
                }
                const day = assignment.day?.trim() || "unknown";

                return {
                    ...assignment,
                    normalizedStartTime,
                    isOnline,
                    classroomKey,
                    day,
                    scheduleKey: `${day}-${classroomKey}-${normalizedStartTime}`,
                };
            });

            // Group by exact schedule key (day + classroom + normalized time)
            const scheduleGroups = new Map<string, any[]>();

            normalizedAssignments.forEach((assignment) => {
                const scheduleKey = assignment.scheduleKey;

                if (!scheduleGroups.has(scheduleKey)) {
                    scheduleGroups.set(scheduleKey, []);
                }
                scheduleGroups.get(scheduleKey)!.push(assignment);
            });

            const combinedAssignments: any[] = [];

            scheduleGroups.forEach((assignments, scheduleKey) => {
                console.log(
                    `Processing schedule key: ${scheduleKey} with ${assignments.length} assignments`
                );

                if (assignments.length === 1) {
                    // Single assignment, no combining needed
                    combinedAssignments.push(assignments[0]);
                    return;
                }

                // For multiple assignments at same time/place, group by instructor and duration
                const instructorDurationGroups = new Map<string, any[]>();

                assignments.forEach((assignment) => {
                    const instructor =
                        `${assignment.firstName || ""} ${
                            assignment.lastName || ""
                        }`.trim() || "TBA";
                    const duration =
                        assignment.separatedDuration ||
                        assignment.duration ||
                        "1";
                    const groupKey = `${instructor}-${duration}`;

                    if (!instructorDurationGroups.has(groupKey)) {
                        instructorDurationGroups.set(groupKey, []);
                    }
                    instructorDurationGroups.get(groupKey)!.push(assignment);
                });

                instructorDurationGroups.forEach(
                    (groupAssignments, groupKey) => {
                        if (groupAssignments.length === 1) {
                            // Single course in this instructor-duration group
                            combinedAssignments.push(groupAssignments[0]);
                        } else {
                            // Multiple courses with same instructor, duration, and schedule - combine them
                            console.log(
                                `🔄 Auto-combining ${groupAssignments.length} courses for ${groupKey} at ${scheduleKey}:`
                            );
                            groupAssignments.forEach((assignment) => {
                                console.log(
                                    `  - ${assignment.code} (ID: ${assignment.id})`
                                );
                            });

                            // Use the first assignment as the base
                            const baseAssignment = groupAssignments[0];
                            const additionalCourses = groupAssignments.slice(1);

                            // Create combined assignment
                            const combinedAssignment = {
                                ...baseAssignment,
                                // Ensure we use the normalized time
                                startTime: baseAssignment.normalizedStartTime
                                    .split("-")[0]
                                    .trim(),
                                timeSlot: baseAssignment.normalizedStartTime,
                                // Mark as combined
                                isCombined: true,
                                combinedCourses: additionalCourses,
                                // Update display information
                                combinedCodes: groupAssignments
                                    .map((a) => a.code)
                                    .join(" + "),
                                combinedTitles: groupAssignments
                                    .map((a) => a.title || a.code)
                                    .join(" + "),
                                combinedIds: groupAssignments.map((a) => a.id),
                            };

                            combinedAssignments.push(combinedAssignment);
                            console.log(
                                `✅ Combined into: ${combinedAssignment.combinedCodes} at ${scheduleKey}`
                            );
                        }
                    }
                );
            });

            console.log(
                `=== AUTO-COMBINE COMPLETE: ${assignmentsData.length} → ${combinedAssignments.length} ===`
            );
            return combinedAssignments;
        },
        [normalizeTimeSlot]
    ); // Add dependencies for useCallback
    const saveAllAssignments = async () => {
        try {
            const validAssignedCourses =
                assignedCourses.filter(isAssignedCourse);

            // Process assignments and separate combined courses
            const assignmentsData: {
                id: any;
                sectionId: any;
                day: string;
                startTime: string;
                endTime: string;
                classroom: string | null;
                isOnline: boolean;
                duration: any;
            }[] = [];

            validAssignedCourses.forEach((course) => {
                const classroomValue = course.classroom;
                const isOnlineClassroom =
                    !isNaN(parseInt(classroomValue)) &&
                    parseInt(classroomValue) < 0;

                // Create assignment data for the main course
                const mainAssignment = {
                    id: course.id,
                    sectionId: course.sectionId,
                    day: course.day,
                    startTime: course.startTime,
                    endTime: course.endTime,
                    classroom: isOnlineClassroom ? classroomValue : classroomValue, // Send the actual classroom ID for both online and physical
                    isOnline: isOnlineClassroom,
                    duration: course.duration,
                };

                // If it's a combined course, we need to save each course separately
                if (course.isCombined && course.combinedCourses) {
                    console.log("=== SAVING COMBINED COURSE SEPARATELY ===");
                    console.log("Main course:", course.code);
                    console.log(
                        "Combined courses:",
                        course.combinedCourses.map((c: { code: any }) => c.code)
                    );

                    // Add the main course (extract original course data from combined)
                    const originalMainCourse = {
                        id: course.id,
                        sectionId: course.sectionId,
                        day: course.day,
                        startTime: course.startTime,
                        endTime: course.endTime,
                        classroom: isOnlineClassroom ? classroomValue : classroomValue, // Send the actual classroom ID
                        isOnline: isOnlineClassroom,
                        duration: course.duration,
                    };
                    assignmentsData.push(originalMainCourse);

                    // Add each combined course separately
                    course.combinedCourses.forEach(
                        (combinedCourse: {
                            id: any;
                            sectionId: any;
                            duration: any;
                        }) => {
                            const combinedAssignment = {
                                id: combinedCourse.id,
                                sectionId: combinedCourse.sectionId,
                                day: course.day, // Use the same schedule details
                                startTime: course.startTime,
                                endTime: course.endTime,
                                classroom: isOnlineClassroom
                                    ? classroomValue // Send the virtual classroom ID for online courses
                                    : classroomValue,
                                isOnline: isOnlineClassroom,
                                duration: combinedCourse.duration,
                            };
                            assignmentsData.push(combinedAssignment);
                        }
                    );

                    console.log(
                        "Separated assignments:",
                        assignmentsData.slice(
                            -1 - course.combinedCourses.length
                        )
                    );
                } else {
                    // Regular single course
                    assignmentsData.push(mainAssignment);
                }
            });

            console.log("=== FINAL ASSIGNMENTS TO SAVE ===");
            console.log("Total assignments:", assignmentsData.length);
            assignmentsData.forEach((assignment, index) => {
                console.log(
                    `${index + 1}. Course ID: ${assignment.id}, Day: ${
                        assignment.day
                    }, Time: ${assignment.startTime}-${assignment.endTime}`
                );
            });

            const scheduleId = params.id;
            const response = await fetch(
                `/api/assign-time-slots?scheduleId=${scheduleId}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(assignmentsData),
                }
            );

            if (response.ok) {
                showSuccessMessage(
                    `Successfully saved ${assignmentsData.length} course assignments!`
                );
            } else {
                const errorData = await response.json();
                console.error("Failed to save assignments:", errorData);
                showErrorMessage(
                    `Failed to save assignments: ${
                        errorData.error || "Unknown error"
                    }`
                );
            }
        } catch (error) {
            console.error("Error saving assignments:", error);
            showErrorMessage(
                `Error saving assignments: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    };

    const handleAvailableDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(false);

        if (!draggedCourse) return;

        if (draggedCourse.day) {
            removeCourseFromTimetable(draggedCourse);
        }
    };

    const removeCourseFromTimetable = (course: TimetableCourse) => {
        if (!course.day || !course.classroom || !course.startTime) return;

        const newSchedule = { ...schedule };
        const coursesToReturn: TimetableCourse[] = [];

        // If it's a combined course, we need to handle it differently
        if (course.isCombined && course.combinedCourses) {
            console.log("=== SEPARATING COMBINED COURSE ===");

            // Get the main course (without combined properties)
            const mainCourse = {
                id: course.id,
                code: course.code.split("+")[0], // Remove the combined code part
                name: course.name.split(" + ")[0], // Remove the combined name part
                capacity: course.capacity,
                color: course.color,
                duration: course.duration,
                instructor: course.instructor,
                sectionId: course.sectionId,
                section: course.section,
                room: course.room,
                originalColor: course.originalColor,
                isOnline: course.isOnline,
                status: course.status,
                // Remove assignment properties
                day: undefined,
                startTime: undefined,
                endTime: undefined,
                classroom: undefined,
                isStart: undefined,
                isMiddle: undefined,
                isEnd: undefined,
                colspan: undefined,
            };

            // Get all combined courses
            const combinedCourses = course.combinedCourses.map(
                (combined: {
                    id: any;
                    code: any;
                    name: any;
                    capacity: any;
                    color: any;
                    duration: any;
                    instructor: any;
                    sectionId: any;
                    section: any;
                    room: any;
                    originalColor: any;
                    isOnline: any;
                    status: any;
                }) => ({
                    id: combined.id,
                    code: combined.code,
                    name: combined.name,
                    capacity: combined.capacity,
                    color: combined.color,
                    duration: combined.duration,
                    instructor: combined.instructor,
                    sectionId: combined.sectionId,
                    section: combined.section,
                    room: combined.room,
                    originalColor: combined.originalColor,
                    isOnline: combined.isOnline,
                    status: combined.status,
                    // Remove assignment properties
                    day: undefined,
                    startTime: undefined,
                    endTime: undefined,
                    classroom: undefined,
                    isStart: undefined,
                    isMiddle: undefined,
                    isEnd: undefined,
                    colspan: undefined,
                })
            );

            coursesToReturn.push(mainCourse, ...combinedCourses);

            console.log(
                "Separated courses:",
                coursesToReturn.map((c) => c.code)
            );
        } else {
            // Regular single course
            const cleanCourse = {
                id: course.id,
                code: course.code,
                capacity: course.capacity,
                name: course.name,
                color: course.color,
                duration: course.duration,
                instructor: course.instructor,
                sectionId: course.sectionId,
                section: course.section,
                room: course.room,
                originalColor: course.originalColor,
                isOnline: course.isOnline,
                status: course.status,
                // Remove assignment properties
                day: undefined,
                startTime: undefined,
                endTime: undefined,
                classroom: undefined,
                isStart: undefined,
                isMiddle: undefined,
                isEnd: undefined,
                colspan: undefined,
            };

            coursesToReturn.push(cleanCourse);
        }

        // Remove the course from schedule (all time slots it occupies)
        Object.keys(newSchedule).forEach((key) => {
            if (newSchedule[key].id === course.id) {
                delete newSchedule[key];
            }
        });

        setSchedule(newSchedule);

        // Add all separated courses back to available courses
        coursesToReturn.forEach((courseToReturn) => {
            if (!availableCourses.some((c) => c.id === courseToReturn.id)) {
                setAvailableCourses((prev) => [...prev, courseToReturn]);
            }
        });
        console.log(
            "Available courses after separation:",
            availableCourses.map((c) => c.code)
        );

        // Remove from assigned courses
        setAssignedCourses((prev) => {
            // Remove the main course and all combined courses
            const filteredAssigned = prev.filter((c) => {
                if (c.id === course.id) return false;
                if (course.isCombined && course.combinedCourses) {
                    return !course.combinedCourses.some(
                        (combined: { id: any }) => combined.id === c.id
                    );
                }
                return true;
            });
            return filteredAssigned;
        });

        // Show success message
        if (course.isCombined && course.combinedCourses) {
            const courseNames = [
                course.code.split("+")[0],
                ...course.combinedCourses.map((c: { code: any }) => c.code),
            ];
            showSuccessMessage(
                `Combined course separated: ${courseNames.join(
                    ", "
                )} returned to available courses`
            );
        } else {
            showSuccessMessage(
                `Course ${course.code} returned to available courses`
            );
        }
    };

    const getTimeSlotId = (timeSlotStr: string): number => {
        const index = timeSlots.findIndex(
            (ts) => getTimeSlotKey(ts) === timeSlotStr
        );
        return index !== -1 ? index + 1 : 0;
    };

    // Shared function to calculate required slots for a course
    const calculateRequiredSlots = (
        course: TimetableCourse,
        timeSlots: CourseHour[],
        startTimeSlotIndex: number,
        schedule: TimetableGrid,
        day: string,
        classroomId: string
    ): {
        slotsNeeded: number;
        consecutiveSlots: Array<{
            index: number;
            slot: any;
            duration: number;
            key: string;
        }>;
        totalDuration: number;
        canAccommodate: boolean;
    } => {
        const courseDurationHours = course.duration;
        let totalAccumulatedDuration = 0;
        let consecutiveSlots = [];
        let canAccommodate = false;

        console.log(`=== CALCULATING REQUIRED SLOTS ===`);
        console.log(
            `Course: ${course.code}, Required: ${courseDurationHours}h`
        );

        // Build consecutive available slots from the starting point
        for (let i = startTimeSlotIndex; i < timeSlots.length; i++) {
            const currentSlot = timeSlots[i];
            const currentSlotDuration = getSlotDurationHours(currentSlot);
            const currentTimeSlot = getTimeSlotKey(currentSlot);
            const currentKey = `${day}-${classroomId}-${currentTimeSlot}`;
            const conflictingCourse = schedule[currentKey];

            console.log(
                `Checking slot ${i}: ${currentTimeSlot} (${currentSlotDuration}h)`
            );

            // Check if this slot is occupied by another course (allow combining)
            if (conflictingCourse && conflictingCourse.id !== course.id) {
                // Check if courses can be combined
                const canCombine = canCombineCourses(
                    course,
                    conflictingCourse,
                    day,
                    i
                );

                if (!canCombine.canCombine) {
                    console.log(
                        `  - Cannot combine with ${conflictingCourse.code}: ${canCombine.reason}`
                    );
                    break;
                }
            }

            // Add this slot to our consecutive chain
            consecutiveSlots.push({
                index: i,
                slot: currentSlot,
                duration: currentSlotDuration,
                key: currentTimeSlot,
            });

            totalAccumulatedDuration += currentSlotDuration;
            console.log(`  - Accumulated: ${totalAccumulatedDuration}h`);

            // Check if we have exactly the required duration
            if (
                Math.abs(totalAccumulatedDuration - courseDurationHours) < 0.01
            ) {
                console.log(`✅ Exact match: ${totalAccumulatedDuration}h`);
                canAccommodate = true;
                break;
            }
        }

        console.log(
            `Result: ${consecutiveSlots.length} slots, ${totalAccumulatedDuration}h total`
        );

        return {
            slotsNeeded: consecutiveSlots.length,
            consecutiveSlots,
            totalDuration: totalAccumulatedDuration,
            canAccommodate,
        };
    };

    // Modified handleDrop to support course combining
    const handleDrop = (day: string, classroomId: string, timeSlot: string) => {
        if (!draggedCourse || timeSlots.length === 0) {
            console.log("No dragged course or time slots");
            return;
        }

        console.log("=== DROP VALIDATION START ===");
        console.log("Drop attempt:", {
            course: draggedCourse.code,
            instructor: draggedCourse.instructor,
            day,
            classroomId,
            timeSlot,
            courseCapacity: draggedCourse.capacity || "not specified",
            classroom: classrooms.find((c) => c.id.toString() === classroomId),
        });

        // 1. ONLINE/OFFLINE VALIDATION
        const isOnlineClassroom = parseInt(classroomId) < 0;
        const isCourseOnline =
            draggedCourse.status === "online" ||
            draggedCourse.isOnline === true ||
            draggedCourse.room === "Online";

        console.log("Online/Offline validation:", {
            isOnlineClassroom,
            isCourseOnline,
            draggedCourseStatus: draggedCourse.status,
            draggedCourseIsOnline: draggedCourse.isOnline,
            draggedCourseRoom: draggedCourse.room,
        });

        if (isCourseOnline && !isOnlineClassroom) {
            console.log(
                "❌ Online course cannot be assigned to physical classroom"
            );
            showErrorMessage(
                "Online courses cannot be assigned to physical classrooms"
            );
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }
        if (!isCourseOnline && isOnlineClassroom) {
            console.log(
                "❌ Physical course cannot be assigned to online classroom"
            );
            showErrorMessage(
                "Physical courses cannot be assigned to online rows"
            );
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }

        // 2. CAPACITY CONSTRAINT VALIDATION - ENHANCED
        console.log("=== CAPACITY VALIDATION IN handleDrop ===");
        if (!isOnlineClassroom) {
            const capacityValidation = validateCapacityConstraints(
                draggedCourse,
                classroomId,
                classrooms
            );

            console.log("Capacity validation result:", capacityValidation);

            if (!capacityValidation.isValid) {
                console.log("❌ Capacity constraint failed - blocking drop");
                showErrorMessage(
                    capacityValidation.conflictMessage ||
                        "Capacity constraint failed"
                );
                setDraggedCourse(null);
                setCellDragStates({});
                return;
            }

            // Show capacity warning if present
            if (capacityValidation.warningMessage) {
                console.log(
                    "⚠️ Capacity warning:",
                    capacityValidation.warningMessage
                );
                // Continue with assignment but show warning
            }

            // Log capacity details for successful validation
            if (capacityValidation.capacityDetails) {
                const {
                    courseCapacity,
                    classroomCapacity,
                    utilizationPercentage,
                } = capacityValidation.capacityDetails;
                console.log("✅ Capacity validation passed:", {
                    courseCapacity,
                    classroomCapacity,
                    utilizationPercentage: utilizationPercentage + "%",
                    availableSeats: classroomCapacity - courseCapacity,
                });
            }
        } else {
            console.log("✅ Skipping capacity validation for online classroom");
        }

        // 3. TIME SLOT VALIDATION
        const matchingTimeSlot = timeSlots.find(
            (ts) => getTimeSlotKey(ts) === timeSlot
        );

        if (!matchingTimeSlot) {
            console.error(`Time slot ${timeSlot} not found`);
            showErrorMessage("Invalid time slot selected");
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }

        const timeSlotIndex = timeSlots.indexOf(matchingTimeSlot);
        const key = `${day}-${classroomId}-${timeSlot}`;
        const existingCourse = schedule[key];

        // 4. COURSE COMBINING VALIDATION
        if (existingCourse && existingCourse.id !== draggedCourse.id) {
            const combineCheck = canCombineCourses(
                draggedCourse,
                existingCourse,
                day,
                timeSlotIndex
            );

            if (!combineCheck.canCombine) {
                showErrorMessage(
                    combineCheck.reason || "Cannot combine these courses"
                );
                setDraggedCourse(null);
                setCellDragStates({});
                return;
            }

            // Check instructor constraints for the combined scenario
            const constraintCheck = checkInstructorConstraints(
                draggedCourse,
                day,
                timeSlotIndex,
                draggedCourse.duration,
                classroomId
            );

            if (!constraintCheck.isValid) {
                showErrorMessage(
                    constraintCheck.conflictMessage ||
                        "Instructor time constraint conflict"
                );
                setDraggedCourse(null);
                setCellDragStates({});
                return;
            }

            // Proceed with combining
            console.log("=== COMBINING COURSES WITH SAME INSTRUCTOR ===");
            console.log(
                `Combining ${draggedCourse.code} (${draggedCourse.instructor}) with ${existingCourse.code} (${existingCourse.instructor})`
            );

            try {
                const combinedCourse = combineCourses(
                    existingCourse,
                    draggedCourse
                );

                // Update schedule with combined course
                const newSchedule = { ...schedule };

                // Remove dragged course from existing positions
                Object.keys(newSchedule).forEach((scheduleKey) => {
                    if (newSchedule[scheduleKey].id === draggedCourse.id) {
                        delete newSchedule[scheduleKey];
                    }
                });

                // Update existing course position with combined course
                const slotCalculation = calculateRequiredSlots(
                    draggedCourse,
                    timeSlots,
                    timeSlotIndex,
                    schedule,
                    day,
                    classroomId
                );

                slotCalculation.consecutiveSlots.forEach((slotInfo, i) => {
                    const currentKey = `${day}-${classroomId}-${slotInfo.key}`;
                    newSchedule[currentKey] = {
                        ...combinedCourse,
                        isStart: i === 0,
                        isMiddle: i > 0 && i < slotCalculation.slotsNeeded - 1,
                        isEnd: i === slotCalculation.slotsNeeded - 1,
                        colspan: i === 0 ? slotCalculation.slotsNeeded : 0,
                    };
                });

                setSchedule(newSchedule);

                // Remove from available courses
                setAvailableCourses((prev) =>
                    prev.filter((course) => course.id !== draggedCourse.id)
                );

                // Update assigned courses
                setAssignedCourses((prev) => {
                    const filtered = prev.filter(
                        (c) => c.id !== draggedCourse.id
                    );
                    const existingIndex = filtered.findIndex(
                        (c) => c.id === existingCourse.id
                    );
                    if (existingIndex !== -1) {
                        filtered[existingIndex] = combinedCourse;
                    } else {
                        filtered.push(combinedCourse);
                    }
                    return filtered;
                });

                setDraggedCourse(null);
                setCellDragStates({});
                setHoveredCell(null);

                // Show success message with capacity info
                let successMessage = `Successfully combined ${draggedCourse.code} with ${existingCourse.code} (same instructor: ${existingCourse.instructor})`;

                if (!isOnlineClassroom) {
                    const capacityValidation = validateCapacityConstraints(
                        draggedCourse,
                        classroomId,
                        classrooms
                    );
                    if (capacityValidation.capacityDetails) {
                        const {
                            courseCapacity,
                            classroomCapacity,
                            utilizationPercentage,
                        } = capacityValidation.capacityDetails;
                        successMessage += ` - Capacity: ${courseCapacity}/${classroomCapacity} students (${utilizationPercentage}%)`;
                    }
                }

                showSuccessMessage(successMessage);
                return;
            } catch (error) {
                console.error("Error combining courses:", error);
                showErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to combine courses"
                );
                setDraggedCourse(null);
                setCellDragStates({});
                return;
            }
        }

        // 5. REGULAR ASSIGNMENT VALIDATION
        console.log("=== REGULAR ASSIGNMENT VALIDATION ===");
        console.log("Matching Time Slot:", matchingTimeSlot);

        const slotCalculation = calculateRequiredSlots(
            draggedCourse,
            timeSlots,
            timeSlotIndex,
            schedule,
            day,
            classroomId
        );

        if (!slotCalculation.canAccommodate) {
            showErrorMessage(
                `Cannot place ${draggedCourse.duration}-hour course here. Need ${draggedCourse.duration}h but only ${slotCalculation.totalDuration}h available consecutively.`
            );
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }

        const slotsNeeded = slotCalculation.slotsNeeded;
        console.log(
            `✅ Consistent slot calculation: ${slotsNeeded} slots needed for ${draggedCourse.duration}h course`
        );

        // 6. VERIFY NO CONFLICTS IN ALL REQUIRED SLOTS
        console.log("=== FINAL CONFLICT CHECK ===");
        for (const slotInfo of slotCalculation.consecutiveSlots) {
            const currentKey = `${day}-${classroomId}-${slotInfo.key}`;
            const conflictingCourse = schedule[currentKey];

            if (
                conflictingCourse &&
                conflictingCourse.id !== draggedCourse.id
            ) {
                // Check if can combine with conflicting course
                const combineCheck = canCombineCourses(
                    draggedCourse,
                    conflictingCourse,
                    day,
                    slotInfo.index
                );

                if (!combineCheck.canCombine) {
                    showErrorMessage(
                        `Cannot place course here. Time slot ${slotInfo.key} is occupied by ${conflictingCourse.code} and cannot be combined: ${combineCheck.reason}`
                    );
                    setDraggedCourse(null);
                    setCellDragStates({});
                    return;
                }
            }
            console.log(`  ✅ Slot ${slotInfo.key} is available or combinable`);
        }

        // 7. INSTRUCTOR CONSTRAINT CHECK
        const constraintCheck = checkInstructorConstraints(
            draggedCourse,
            day,
            timeSlotIndex,
            slotsNeeded,
            classroomId
        );

        if (!constraintCheck.isValid) {
            showErrorMessage(
                constraintCheck.conflictMessage ||
                    "Instructor time constraint conflict"
            );
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }

        // 8. ALL VALIDATIONS PASSED - PROCEED WITH ASSIGNMENT
        console.log(
            "=== ALL VALIDATIONS PASSED - PROCEEDING WITH ASSIGNMENT ==="
        );

        // Remove course from existing positions in schedule
        const newSchedule = { ...schedule };
        Object.keys(newSchedule).forEach((scheduleKey) => {
            if (newSchedule[scheduleKey].id === draggedCourse.id) {
                delete newSchedule[scheduleKey];
            }
        });

        // Calculate end time using the last slot from our consistent calculation
        const lastSlotInfo =
            slotCalculation.consecutiveSlots[
                slotCalculation.consecutiveSlots.length - 1
            ];
        const lastSlot = lastSlotInfo.slot;
        const endTimeSlot =
            lastSlot.endTime ||
            lastSlot.time_slot?.split("-")[1]?.trim() ||
            lastSlot.time_slot;

        console.log(`End time calculated from last slot:`, {
            lastSlotIndex: lastSlotInfo.index,
            lastSlotKey: lastSlotInfo.key,
            endTime: endTimeSlot,
        });

        // Create assigned course object
        const assignedCourse = {
            ...draggedCourse,
            day: day,
            startTime:
                timeSlots[timeSlotIndex].startTime ||
                getTimeSlotKey(timeSlots[timeSlotIndex]),
            endTime: endTimeSlot,
            classroom: classroomId,
            color: draggedCourse.color,
            originalColor: draggedCourse.originalColor,
        };

        // Place course in all required time slots
        console.log(`=== PLACING COURSE IN ${slotsNeeded} SLOTS ===`);
        slotCalculation.consecutiveSlots.forEach((slotInfo, i) => {
            const currentKey = `${day}-${classroomId}-${slotInfo.key}`;
            const existingInSlot = newSchedule[currentKey];

            if (existingInSlot) {
                // Combine with existing course
                const combinedCourse = combineCourses(
                    existingInSlot,
                    assignedCourse
                );
                newSchedule[currentKey] = {
                    ...combinedCourse,
                    isStart: i === 0,
                    isMiddle: i > 0 && i < slotsNeeded - 1,
                    isEnd: i === slotsNeeded - 1,
                    colspan: i === 0 ? slotsNeeded : 0,
                };
            } else {
                console.log(
                    `  Placing in slot ${i + 1}/${slotsNeeded}: ${slotInfo.key}`
                );

                newSchedule[currentKey] = {
                    ...assignedCourse,
                    isStart: i === 0,
                    isMiddle: i > 0 && i < slotsNeeded - 1,
                    isEnd: i === slotsNeeded - 1,
                    colspan: i === 0 ? slotsNeeded : 0,
                };
            }
        });

        // Update state
        setSchedule(newSchedule);

        // Remove from available courses
        setAvailableCourses((prev) =>
            prev.filter((course) => course.id !== draggedCourse.id)
        );

        // Update assigned courses
        const isAlreadyAssigned = assignedCourses.some(
            (c) => c.id === draggedCourse.id
        );

        if (isAlreadyAssigned) {
            setAssignedCourses((prev) => {
                const filtered = prev.filter((c) => c.id !== draggedCourse.id);
                return [...filtered, assignedCourse];
            });
        } else {
            setAssignedCourses((prev) => [...prev, assignedCourse]);
        }

        // Clean up drag state
        setCellDragStates({});
        setDraggedCourse(null);
        setHoveredCell(null);

        // Show success message with capacity information
        const classroom = classrooms.find(
            (c) => c.id.toString() === classroomId
        );
        let successMessage = `${draggedCourse.code} assigned successfully to ${
            classroom?.code || "classroom"
        }`;

        // Add capacity info to success message if available
        if (!isOnlineClassroom) {
            const capacityResult = validateCapacityConstraints(
                draggedCourse,
                classroomId,
                classrooms
            );
            if (capacityResult.capacityDetails) {
                const {
                    courseCapacity,
                    classroomCapacity,
                    utilizationPercentage,
                } = capacityResult.capacityDetails;
                successMessage += ` (${courseCapacity}/${classroomCapacity} students, ${utilizationPercentage}% capacity)`;
            }

            if (capacityResult.warningMessage) {
                successMessage += ` - Warning: ${capacityResult.warningMessage}`;
            }
        }

        showSuccessMessage(successMessage);

        console.log("=== ASSIGNMENT COMPLETED SUCCESSFULLY ===");
        console.log("Course assignment completed:", {
            course: draggedCourse.code,
            assignedTo: `${day} ${timeSlot}`,
            classroom: classroom?.code,
            slotsUsed: slotsNeeded,
            totalDuration: slotCalculation.totalDuration,
            slotDetails: slotCalculation.consecutiveSlots.map(
                (s) => `${s.key}(${s.duration}h)`
            ),
            capacityInfo: !isOnlineClassroom
                ? validateCapacityConstraints(
                      draggedCourse,
                      classroomId,
                      classrooms
                  ).capacityDetails
                : "Online classroom",
        });
    };

    const validateCapacityConstraints = (
        course: TimetableCourse,
        classroomId: string,
        classrooms: Classroom[]
    ): {
        isValid: boolean;
        conflictMessage?: string;
        warningMessage?: string;
        capacityDetails?: {
            courseCapacity: number;
            classroomCapacity: number;
            utilizationPercentage: number;
        };
    } => {
        // Skip capacity check for online classrooms
        const isOnlineClassroom = parseInt(classroomId) < 0;
        if (isOnlineClassroom) {
            console.log("Skipping capacity check for online classroom");
            return { isValid: true };
        }

        // Find the classroom
        const classroom = classrooms.find(
            (c) => c.id.toString() === classroomId
        );
        if (!classroom) {
            console.log("Classroom not found for ID:", classroomId);
            return {
                isValid: false,
                conflictMessage: "Classroom not found",
            };
        }

        // Extract course capacity with multiple fallbacks
        const getCourseCapacity = (course: TimetableCourse): number => {
            const capacityFields = [
                "capacity",
                "enrollmentCount",
                "studentCount",
                "maxStudents",
                "enrollment",
                "classSize",
            ];

            for (const field of capacityFields) {
                const value = (course as any)[field];
                if (value !== undefined && value !== null) {
                    const numValue =
                        typeof value === "string"
                            ? parseInt(value, 10)
                            : Number(value);
                    if (!isNaN(numValue) && numValue >= 0) {
                        console.log(
                            `Found course capacity in field '${field}':`,
                            numValue
                        );
                        return numValue;
                    }
                }
            }

            console.log("No valid course capacity found, defaulting to 0");
            return 0;
        };

        const courseCapacity = getCourseCapacity(course);
        const classroomCapacity = classroom.capacity || 0;

        console.log("Capacity validation details:", {
            course: course.code,
            courseCapacity,
            classroomCapacity,
            classroom: classroom.code,
        });

        // Handle cases where capacity data is missing
        if (courseCapacity === 0 && classroomCapacity === 0) {
            console.log("Both capacities are 0 - allowing with warning");
            return {
                isValid: true,
                warningMessage:
                    "Both course and classroom capacity are not specified - assignment allowed but should be verified manually",
            };
        }

        if (courseCapacity === 0) {
            console.log("Course capacity is 0 - allowing with warning");
            return {
                isValid: true,
                warningMessage: `Course capacity not specified, classroom capacity is ${classroomCapacity} students`,
            };
        }

        if (classroomCapacity === 0) {
            console.log("Classroom capacity is 0 - allowing with warning");
            return {
                isValid: true,
                warningMessage: `Classroom capacity not specified, course requires ${courseCapacity} students`,
            };
        }

        // Calculate utilization percentage
        const utilizationPercentage = Math.round(
            (courseCapacity / classroomCapacity) * 100
        );

        // STRICT capacity validation - this will block the drop
        if (courseCapacity > classroomCapacity) {
            console.log("CAPACITY CONSTRAINT VIOLATION - BLOCKING DROP:", {
                courseCapacity,
                classroomCapacity,
                difference: courseCapacity - classroomCapacity,
            });

            return {
                isValid: false,
                conflictMessage: `Cannot assign course: ${courseCapacity} students required but classroom only has ${classroomCapacity} seats (${
                    courseCapacity - classroomCapacity
                } students over capacity)`,
                capacityDetails: {
                    courseCapacity,
                    classroomCapacity,
                    utilizationPercentage,
                },
            };
        }

        // Success case
        console.log("Capacity validation passed:", {
            courseCapacity,
            classroomCapacity,
            utilizationPercentage,
        });

        return {
            isValid: true,
            capacityDetails: {
                courseCapacity,
                classroomCapacity,
                utilizationPercentage,
            },
        };
    };

    const handleScheduledCourseClick = (
        day: string,
        classroomId: string,
        timeSlot: string,
        course: CombinedTimetableCourse
    ) => {
        setSelectedCourse(course);
        const timeSlotId = getTimeSlotId(timeSlot);
        setCellToDelete({ day, classroomId, timeSlot, timeSlotId });
        setIsDialogOpen(true);
    };

    const generateSchedule = async () => {
        if (!params.id) {
            showErrorMessage("Schedule ID is missing");
            return;
        }

        setIsGeneratingSchedule(true);
        // Clear previous errors and warnings
        setSchedulingErrors([]);
        setSchedulingWarnings([]);

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

            const data: EnhancedScheduleResponse = await response.json();

            // Store errors and warnings for display
            if (data.errors && data.errors.length > 0) {
                setSchedulingErrors(data.errors);
            }
            if (data.warnings && data.warnings.length > 0) {
                setSchedulingWarnings(data.warnings);
            }

            // Update stats if available
            if (data.stats) {
                setGenerationStats(data.stats);
            }

            if (data.schedule && Array.isArray(data.schedule)) {
                // After successful generation, refetch ALL data to ensure consistency
                await refetchAllData();
                setScheduleGenerated(true);

                // Show main success/partial success message
                if (data.success) {
                    showSuccessMessage(
                        `Schedule generated successfully! ${data.stats.scheduledAssignments} courses scheduled. All data refreshed.`
                    );
                } else {
                    const successCount = data.stats.scheduledAssignments;
                    const failedCount = data.stats.failedAssignments;

                    showSuccessMessage(
                        `Partial schedule generated: ${successCount} courses scheduled, ${failedCount} failed. All data refreshed. Check details above.`
                    );
                }
            } else {
                console.error("Invalid schedule data format", data);
                showErrorMessage(
                    "Failed to process the generated schedule data."
                );
            }
        } catch (error) {
            console.error("Error generating schedule:", error);
            showErrorMessage(
                `Error generating schedule: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        } finally {
            setIsGeneratingSchedule(false);
        }
    };
    const clearSchedulingErrors = () => {
        setSchedulingErrors([]);
        setSchedulingWarnings([]);
    };
    const groupErrorsByType = (
        errors: SchedulingError[]
    ): Record<string, SchedulingError[]> => {
        return errors.reduce((groups, error) => {
            const type = error.error_type;
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(error);
            return groups;
        }, {} as Record<string, SchedulingError[]>);
    };

    // Helper function to get user-friendly error type names
    const getErrorTypeDisplayName = (
        errorType: SchedulingError["error_type"]
    ): string => {
        switch (errorType) {
            case "CAPACITY_CONSTRAINT":
                return "Capacity Issues";
            case "TIME_CONSTRAINT":
                return "Time Constraints";
            case "INSTRUCTOR_CONFLICT":
                return "Instructor Conflicts";
            case "NO_AVAILABLE_SLOTS":
                return "No Available Time Slots";
            case "NO_CLASSROOM":
                return "No Classroom Available";
            case "DURATION_MISMATCH":
                return "Duration Mismatches";
            default:
                return "Unknown Errors";
        }
    };

    // Helper function to format error messages with details
    const formatErrorMessage = (error: SchedulingError): string => {
        let message = `${error.course_code} (${error.section_number}): ${error.error_message}`;

        // Add specific details based on error type
        if (error.details) {
            switch (error.error_type) {
                case "CAPACITY_CONSTRAINT":
                    if (
                        error.details.required_capacity &&
                        error.details.available_capacity
                    ) {
                        message += ` (Needs ${error.details.required_capacity} seats, largest classroom has ${error.details.available_capacity})`;
                    }
                    break;

                case "INSTRUCTOR_CONFLICT":
                    if (error.details.conflicting_course) {
                        message += ` (Conflicts with ${error.details.conflicting_course})`;
                    }
                    if (
                        error.details.attempted_day &&
                        error.details.attempted_time
                    ) {
                        message += ` on ${error.details.attempted_day} at ${error.details.attempted_time}`;
                    }
                    break;

                case "TIME_CONSTRAINT":
                    if (
                        error.details.attempted_day &&
                        error.details.attempted_time
                    ) {
                        message += ` (Instructor unavailable on ${error.details.attempted_day} at ${error.details.attempted_time})`;
                    }
                    break;

                case "DURATION_MISMATCH":
                    if (error.details.required_duration) {
                        message += ` (Requires ${
                            error.details.required_duration
                        } hour${
                            error.details.required_duration > 1 ? "s" : ""
                        })`;
                    }
                    break;

                case "NO_AVAILABLE_SLOTS":
                    if (
                        error.details.attempted_classroom &&
                        error.details.attempted_day
                    ) {
                        message += ` (No slots available in ${error.details.attempted_classroom} on ${error.details.attempted_day})`;
                    }
                    break;
            }
        }

        return message;
    };

    // Enhanced error display component (optional - for future use in dialogs)
    const ErrorSummaryDialog = ({
        errors,
        isOpen,
        onClose,
    }: {
        errors: SchedulingError[];
        isOpen: boolean;
        onClose: () => void;
    }) => {
        const errorGroups = groupErrorsByType(errors);

        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center text-red-600">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            Scheduling Errors ({errors.length} courses failed)
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        {Object.entries(errorGroups).map(
                            ([errorType, typeErrors]) => (
                                <div key={errorType} className="space-y-3">
                                    <h3 className="font-semibold text-gray-800 border-b pb-1">
                                        {getErrorTypeDisplayName(
                                            errorType as SchedulingError["error_type"]
                                        )}
                                        <span className="text-sm text-gray-500 ml-2">
                                            ({typeErrors.length} course
                                            {typeErrors.length > 1 ? "s" : ""})
                                        </span>
                                    </h3>

                                    <div className="space-y-2">
                                        {typeErrors.map((error) => (
                                            <div
                                                key={error.section_id}
                                                className="p-3 bg-red-50 border border-red-200 rounded"
                                            >
                                                <div className="font-medium text-red-800">
                                                    {error.course_code} -{" "}
                                                    {error.section_number}
                                                </div>
                                                <div className="text-sm text-red-700 mt-1">
                                                    {error.course_title}
                                                </div>
                                                <div className="text-sm text-red-600 mt-1">
                                                    Instructor:{" "}
                                                    {error.instructor_name}
                                                </div>
                                                <div className="text-sm text-red-800 mt-2">
                                                    {formatErrorMessage(error)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                        <Button onClick={onClose} variant="outline">
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    };

    // Usage in the component:
    // Add these state variables to your component
    const [schedulingErrors, setSchedulingErrors] = useState<SchedulingError[]>(
        []
    );
    const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);

    // // In the generateSchedule function, after receiving the response:
    // // Store the errors for potential dialog display
    // if (data.errors && data.errors.length > 0) {
    //     setSchedulingErrors(data.errors);
    //     // Optionally auto-open error dialog for detailed view
    //     // setTimeout(() => setIsErrorDialogOpen(true), 3000);
    // }

    const fetchTimetableAssignments = useCallback(async () => {
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
            console.log("=== FETCH TIMETABLE ASSIGNMENTS START ===");
            console.log("Raw assignments data:", assignmentsData);
            console.log("Raw assignments count:", assignmentsData.length);

            // Process assignments and auto-combine courses FIRST to determine what's actually placed
            const processedAssignments = autoCombineCourses(assignmentsData);
            console.log(
                "Processed assignments after auto-combine:",
                processedAssignments.length
            );

            // Now process assignments and create schedule entries
            const newSchedule: TimetableGrid = {};
            const newAssignedCourses: TimetableCourse[] = [];
            const actuallyPlacedCourseIds = new Set<number>();

            // Process each assignment and create schedule entries
            processedAssignments.forEach((assignment: any) => {
                const courseHourId = assignment.id;
                const sectionId = assignment.sectionId;
                const classroomCode = assignment.classroom;
                const code = assignment.code;
                const title = assignment.title || code;
                const firstName = assignment.firstName;
                const lastName = assignment.lastName;
                const day = assignment.day;
                const originalColor = assignment.color;
                const isOnline =
                    assignment.isOnline || assignment.classroomId === null;

                // Handle combined courses
                const isCombined = assignment.isCombined || false;
                const combinedCourses = assignment.combinedCourses || [];

                const colorClassName =
                    originalColor && colors_class[originalColor]
                        ? colors_class[originalColor]
                        : getConsistentCourseColor(code);

                let startTime = assignment.startTime;
                let endTime = assignment.endTime;

                if (!startTime && assignment.timeSlot) {
                    const timeSlot = assignment.timeSlot;
                    if (timeSlot.includes(" - ")) {
                        const parts = timeSlot.split(" - ");
                        startTime = parts[0].trim();
                        endTime = parts[1].trim();
                    } else {
                        startTime = timeSlot;
                    }
                }

                const originalDuration = parseFloat(
                    assignment.separatedDuration || assignment.duration || "1"
                );

                if (!courseHourId || !day || !startTime) {
                    console.warn("Skipping invalid assignment:", assignment);
                    return;
                }

                let classroom;
                let classroomId;

                if (isOnline) {
                    const virtualClassroom = classrooms.find((c) => c.id < 0);
                    if (virtualClassroom) {
                        classroom = virtualClassroom;
                        classroomId = virtualClassroom.id.toString();
                    } else {
                        classroomId = "-1";
                        classroom = { id: -1, code: "Online", capacity: 999 };
                    }
                } else {
                    classroom = classrooms.find(
                        (c) => c.code === classroomCode
                    );
                    if (!classroom) {
                        console.warn(
                            `Classroom with code ${classroomCode} not found.`
                        );
                        return;
                    }
                    classroomId = classroom.id.toString();
                }

                const instructorName =
                    firstName && lastName ? `${firstName} ${lastName}` : "TBA";

                const startIndex = timeSlots.findIndex((ts) => {
                    if (
                        ts.startTime === startTime ||
                        getTimeSlotKey(ts) === startTime
                    ) {
                        return true;
                    }
                    if (ts.startTime && ts.endTime) {
                        const slotStart = parseInt(ts.startTime);
                        const slotEnd = parseInt(ts.endTime);
                        const start = parseInt(startTime);
                        return slotStart <= start && start < slotEnd;
                    }
                    return false;
                });

                if (startIndex === -1) {
                    console.warn(
                        `Time slot "${startTime}" not found for course ${code}`
                    );
                    return;
                }

                let slotsToSpan;
                let calculatedEndTime;

                if (endTime) {
                    const endIndex = timeSlots.findIndex((ts) => {
                        if (ts.endTime === endTime) return true;
                        if (ts.startTime && ts.endTime) {
                            const slotStart = parseInt(ts.startTime);
                            const slotEnd = parseInt(ts.endTime);
                            const end = parseInt(endTime);
                            return slotStart < end && end <= slotEnd;
                        }
                        return false;
                    });

                    if (endIndex !== -1) {
                        slotsToSpan = endIndex - startIndex + 1;
                        calculatedEndTime = endTime;
                    } else {
                        slotsToSpan = calculateSlotsNeeded(
                            originalDuration,
                            timeSlots,
                            startIndex
                        );
                        calculatedEndTime = calculateEndTime(
                            startTime,
                            originalDuration
                        );
                    }
                } else {
                    slotsToSpan = calculateSlotsNeeded(
                        originalDuration,
                        timeSlots,
                        startIndex
                    );
                    calculatedEndTime = calculateEndTime(
                        startTime,
                        originalDuration
                    );
                }

                const maxSlotsAvailable = timeSlots.length - startIndex;
                slotsToSpan = Math.min(slotsToSpan, maxSlotsAvailable);

                // Create course object with combined course information
                const course: CombinedTimetableCourse = {
                    id: courseHourId,
                    capacity: assignment.capacity,
                    sectionId: sectionId,
                    code: isCombined ? assignment.combinedCodes : code,
                    name: isCombined ? assignment.combinedTitles : title,
                    instructor: instructorName,
                    duration: originalDuration,
                    day: day,
                    startTime: startTime,
                    endTime: calculatedEndTime,
                    classroom: classroomId,
                    color: colorClassName,
                    section:
                        assignment.sectionNumber ||
                        assignment.section_number ||
                        "N/A",
                    room: isOnline ? "Online" : classroomCode,
                    originalColor: originalColor,
                    isOnline: isOnline,
                    // Combined course properties
                    isCombined: isCombined,
                    combinedCourses: isCombined
                        ? combinedCourses.map((combined: any) => ({
                              id: combined.id,
                              code: combined.code,
                              name: combined.title || combined.code,
                              capacity: combined.capacity,
                              color: colorClassName,
                              duration: parseFloat(
                                  combined.separatedDuration ||
                                      combined.duration ||
                                      "1"
                              ),
                              instructor: instructorName,
                              sectionId: combined.sectionId,
                              section:
                                  combined.sectionNumber ||
                                  combined.section_number ||
                                  "N/A",
                              room: isOnline ? "Online" : classroomCode,
                              originalColor: combined.color,
                              isOnline: isOnline,
                              status: isOnline ? "online" : "offline",
                          }))
                        : undefined,
                };

                // Add to assigned courses if not already present
                if (
                    !newAssignedCourses.some(
                        (c) =>
                            c.id === courseHourId &&
                            c.day === day &&
                            c.startTime === startTime
                    )
                ) {
                    newAssignedCourses.push({ ...course });
                    // Track this course as actually placed
                    actuallyPlacedCourseIds.add(courseHourId);

                    // Also track combined courses if any
                    if (isCombined && combinedCourses) {
                        combinedCourses.forEach((combined: any) => {
                            if (combined.id) {
                                actuallyPlacedCourseIds.add(combined.id);
                            }
                        });
                    }
                }

                // Create schedule entries for all required time slots
                const dayValue = assignment.day?.trim();
                const classroomIdValue = isOnline
                    ? "-1"
                    : classroom.id.toString();
                const timeSlotValue =
                    assignment.startTime?.trim() || startTime?.trim();

                for (let i = 0; i < slotsToSpan; i++) {
                    if (startIndex + i >= timeSlots.length) break;

                    const currentTimeSlot = getTimeSlotKey(
                        timeSlots[startIndex + i]
                    );
                    const key = `${dayValue}-${classroomIdValue}-${currentTimeSlot}`;

                    newSchedule[key] = {
                        ...course,
                        isStart: i === 0,
                        isMiddle: i > 0 && i < slotsToSpan - 1,
                        isEnd: i === slotsToSpan - 1,
                        colspan: i === 0 ? slotsToSpan : 0,
                    };
                }
            });

            // Update state with processed data
            setSchedule(newSchedule);
            setAssignedCourses(newAssignedCourses);

            // 🔥 FILTER AVAILABLE COURSES BASED ON ACTUALLY PLACED COURSES ONLY
            console.log(
                "=== FILTERING AVAILABLE COURSES BASED ON ACTUAL PLACEMENT ==="
            );
            console.log(
                "Actually placed course IDs:",
                Array.from(actuallyPlacedCourseIds).sort()
            );

            setAvailableCourses((prev) => {
                const beforeCount = prev.length;
                const filtered = prev.filter((course) => {
                    const isActuallyPlaced = actuallyPlacedCourseIds.has(
                        course.id
                    );
                    console.log(
                        `Course ${course.code} (ID: ${course.id}): ${
                            isActuallyPlaced
                                ? "PLACED - REMOVING"
                                : "NOT PLACED - KEEPING"
                        }`
                    );
                    return !isActuallyPlaced;
                });

                console.log(
                    `Available courses filtered: ${beforeCount} → ${filtered.length}`
                );
                console.log(
                    "Remaining available courses:",
                    filtered.map((c) => `${c.code} (ID: ${c.id})`)
                );
                return filtered;
            });

            console.log("=== FINAL STATE UPDATE ===");
            console.log(
                "Schedule entries created:",
                Object.keys(newSchedule).length
            );
            console.log("Assigned courses created:", newAssignedCourses.length);
            console.log("=== FETCH TIMETABLE ASSIGNMENTS COMPLETE ===");
        } catch (error) {
            console.error("Error fetching timetable assignments:", error);
        } finally {
            setIsLoading(false);
        }
    }, [
        params.id,
        timeSlots,
        classrooms,
        autoCombineCourses,
        calculateSlotsNeeded,
        calculateEndTime,
        // Remove other function dependencies to reduce re-renders
    ]);

    const refetchAllData = async () => {
        console.log("=== REFETCHING ALL DATA AFTER SCHEDULE GENERATION ===");

        try {
            await Promise.all([
                fetchTimeSlots(),
                fetchCourses(),
                fetchClassrooms(),
                fetchInstructorConstraints(),
            ]);

            // After all base data is refetched, fetch timetable assignments
            // This will automatically update availableCourses by filtering out assigned ones
            await fetchTimetableAssignments();

            console.log("=== ALL DATA REFETCHED SUCCESSFULLY ===");
        } catch (error) {
            console.error("Error during data refetch:", error);
            showErrorMessage(
                "Failed to refresh data after schedule generation"
            );
        }
    };

    const calculateSlotDuration = (slot: any): number => {
        if (slot.time_slot && slot.time_slot.includes("-")) {
            const [start, end] = slot.time_slot
                .split("-")
                .map((t: string) => t.trim());

            const startHour = parseTimeToHours(start);
            const endHour = parseTimeToHours(end);

            console.log("startTime:", start, "-> hours:", startHour);
            console.log("endTime:", end, "-> hours:", endHour);

            const result = endHour - startHour;
            console.log("duration result:", result, "hours");
            return result;
        }

        if (slot.startTime && slot.endTime) {
            const startHour = parseTimeToHours(slot.startTime);
            const endHour = parseTimeToHours(slot.endTime);
            console.log("startTime:", slot.startTime, "-> hours:", startHour);
            console.log("endTime:", slot.endTime, "-> hours:", endHour);
            const result = endHour - startHour;
            console.log("duration result:", result, "hours");
            return result;
        }

        return 1;
    };

    const handleRemoveCourse = async () => {
        const { day, classroomId, timeSlot } = cellToDelete;
        const key = `${day}-${classroomId}-${timeSlot}`;
        const course = schedule[key];

        if (!course) return;

        setIsDialogOpen(false);

        try {
            // If it's a combined course, we need to handle removal differently
            if (course.isCombined && course.combinedCourses) {
                showErrorMessage(
                    "Cannot remove combined course directly. Please remove individual courses first."
                );
                return;
            }

            const response = await fetch("/api/assign-time-slots", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    courseHoursId: course.id,
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

            const courseId = course.id;

            // Remove from schedule
            const newSchedule = { ...schedule };
            Object.keys(newSchedule).forEach((scheduleKey) => {
                if (newSchedule[scheduleKey].id === courseId) {
                    delete newSchedule[scheduleKey];
                }
            });
            setSchedule(newSchedule);

            // Create clean course object to return to available courses
            const cleanCourse: TimetableCourse = {
                id: course.id,
                code: course.code,
                capacity: course.capacity,
                name: course.name,
                color: course.color,
                duration: course.duration,
                instructor: course.instructor,
                sectionId: course.sectionId,
                section: course.section,
                room: course.room,
                originalColor: course.originalColor,
                isOnline: course.isOnline,
                status: course.status,
                // Remove assignment-specific properties
                day: undefined,
                startTime: undefined,
                endTime: undefined,
                classroom: undefined,
                isStart: undefined,
                isMiddle: undefined,
                isEnd: undefined,
                colspan: undefined,
            };

            // Add back to available courses if not already there
            if (!availableCourses.some((c) => c.id === courseId)) {
                setAvailableCourses((prev) => [...prev, cleanCourse]);
            }

            // Remove from assigned courses
            setAssignedCourses((prev) => prev.filter((c) => c.id !== courseId));

            showSuccessMessage(`Course ${course.code} removed successfully`);
        } catch (error) {
            console.error("Error removing course:", error);

            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to remove course from timetable";

            showErrorMessage(`Error: ${errorMessage}`);
            setIsDialogOpen(true);
        }
    };

    const getTimePeriod = (timeSlot: string): number => {
        if (!timeSlot) return 0;
        const timeSlotIndex = timeSlots.findIndex(
            (ts) => getTimeSlotKey(ts) === timeSlot
        );
        return timeSlotIndex !== -1 ? timeSlotIndex + 1 : 0;
    };

    const getDayAbbreviation = (day: string): string => {
        const dayMap: Record<string, string> = {
            Monday: "Mon",
            Tuesday: "Tue",
            Wednesday: "Wed",
            Thursday: "Thu",
            Friday: "Fri",
            Saturday: "Sat",
            Sunday: "Sun",
        };

        return dayMap[day] || day;
    };

    const checkDropValidity = (
        day: string,
        classroomId: string,
        timeSlot: string
    ) => {
        if (!draggedCourse || timeSlots.length === 0) return false;

        const key = `${day}-${classroomId}-${timeSlot}`;
        const existingCourse = schedule[key];

        // Allow dropping in same position
        if (existingCourse && existingCourse.id === draggedCourse.id) {
            return true;
        }

        // Allow combining if courses can be combined
        if (existingCourse && existingCourse.id !== draggedCourse.id) {
            const timeSlotIndex = timeSlots.findIndex(
                (ts) => getTimeSlotKey(ts) === timeSlot
            );
            const combineCheck = canCombineCourses(
                draggedCourse,
                existingCourse,
                day,
                timeSlotIndex
            );
            if (combineCheck.canCombine) {
                return true;
            }
            return false;
        }

        // 1. ONLINE/OFFLINE VALIDATION
        const isOnlineClassroom = parseInt(classroomId) < 0;
        const isCourseOnline =
            draggedCourse.status === "online" ||
            draggedCourse.isOnline === true ||
            draggedCourse.room === "Online";

        if (isCourseOnline && !isOnlineClassroom) {
            console.log(
                "❌ Online course cannot be assigned to physical classroom"
            );
            return false;
        }
        if (!isCourseOnline && isOnlineClassroom) {
            console.log(
                "❌ Physical course cannot be assigned to online classroom"
            );
            return false;
        }

        // 2. CAPACITY CONSTRAINT VALIDATION - FIXED
        console.log("=== CAPACITY VALIDATION IN checkDropValidity ===");
        console.log(
            "Course:",
            draggedCourse.code,
            "Capacity:",
            draggedCourse.capacity
        );
        console.log("Classroom ID:", classroomId);

        // Find the classroom
        const classroom = classrooms.find(
            (c) => c.id.toString() === classroomId
        );
        console.log("Found classroom:", classroom);

        if (!classroom && !isOnlineClassroom) {
            console.log("❌ Classroom not found");
            return false;
        }

        // Skip capacity check for online classrooms
        if (!isOnlineClassroom) {
            const capacityCheck = validateCapacityConstraints(
                draggedCourse,
                classroomId,
                classrooms
            );

            console.log("Capacity check result:", capacityCheck);

            if (!capacityCheck.isValid) {
                console.log(
                    "❌ Capacity constraint failed:",
                    capacityCheck.conflictMessage
                );
                return false;
            }
        }

        // 3. TIME SLOT VALIDATION
        const matchingTimeSlot = timeSlots.find(
            (ts) => getTimeSlotKey(ts) === timeSlot
        );
        if (!matchingTimeSlot) {
            console.log("❌ Time slot not found");
            return false;
        }

        const timeSlotIndex = timeSlots.indexOf(matchingTimeSlot);

        // 4. USE SHARED SLOT CALCULATION FUNCTION
        const slotCalculation = calculateRequiredSlots(
            draggedCourse,
            timeSlots,
            timeSlotIndex,
            schedule,
            day,
            classroomId
        );

        if (!slotCalculation.canAccommodate) {
            console.log(`❌ Cannot accommodate course duration`);
            return false;
        }

        // 5. INSTRUCTOR CONSTRAINT CHECK
        const constraintCheck = checkInstructorConstraints(
            draggedCourse,
            day,
            timeSlotIndex,
            slotCalculation.slotsNeeded,
            classroomId
        );

        if (!constraintCheck.isValid) {
            console.log(
                "❌ Instructor constraint failed:",
                constraintCheck.conflictMessage
            );
            return false;
        }

        console.log(`✅ All validations passed for ${draggedCourse.code}`);
        console.log(`✅ Will use ${slotCalculation.slotsNeeded} slots`);

        return true;
    };

    const [isDragOver, setIsDragOver] = useState(false);

    const handleCellDragOver = (
        e: React.DragEvent<HTMLTableCellElement>,
        day: string,
        classroomId: string,
        timeSlot: string
    ) => {
        e.preventDefault();

        if (!draggedCourse) return;

        const cellKey = `${day}-${classroomId}-${timeSlot}`;
        const isValidDrop = checkDropValidity(day, classroomId, timeSlot);

        setCellDragStates((prev) => ({
            ...prev,
            [cellKey]: {
                isDragOver: true,
                isValidDrop,
            },
        }));
    };

    const handleCellDragLeave = (
        e: React.DragEvent<HTMLTableCellElement>,
        day: string,
        classroomId: string,
        timeSlot: string
    ) => {
        const cellKey = `${day}-${classroomId}-${timeSlot}`;

        setCellDragStates((prev) => ({
            ...prev,
            [cellKey]: {
                isDragOver: false,
                isValidDrop: false,
            },
        }));
    };

    const exportOldSystemFormat = () => {
        try {
            if (!schedule || Object.keys(schedule).length === 0) {
                showErrorMessage(
                    "No schedule data to export. Please generate or create a schedule first."
                );
                return;
            }

            const assignedCourses = Object.values(schedule).filter((course) => {
                const isStart =
                    course.isStart === true || course.isStart === undefined;
                return isStart;
            });

            if (assignedCourses.length === 0) {
                showErrorMessage("No assigned courses found to export.");
                return;
            }

            const csvData: any[] = [];

            const timeslotsMap = new Map<number, (typeof timeSlots)[number]>();
            for (const timeslot of timeSlots) {
                const { totalMinutes } = parseTimeToHoursAndMinutes(
                    timeslot.startTime
                );

                timeslotsMap.set(totalMinutes, timeslot);
            }

            const orderredTimeslotMap = new Map(
                [...timeslotsMap.entries()].sort((a, b) => a[0] - b[0])
            );

            assignedCourses.forEach((course) => {
                const processCourse = (c: TimetableCourse) => {
                    const dayAbbr = getDayAbbreviation(c.day || "");
                    const startPeriod = getTimePeriod(c.startTime || "");
                    const isOnline =
                        !c.room || c.room === "TBA" || c.classroom === "-1";
                    const type = isOnline ? "online" : "offline";

                    const startHours: string[] = [];

                    if (c.startTime) {
                        // max loop depth = MAX_TIMESLOTS

                        let startTime = c.startTime;
                        for (let i = 0; i < MAX_TIMESLOTS; i++) {
                            const { totalMinutes: courseEndTimeInMinutes } =
                                parseTimeToHoursAndMinutes(
                                    c.endTime || "00:00"
                                );

                            const { totalMinutes: startTimeTotalMinutes } =
                                parseTimeToHoursAndMinutes(startTime);
                            const timeSlot = orderredTimeslotMap.get(
                                startTimeTotalMinutes
                            )!;

                            if (
                                startTimeTotalMinutes >= courseEndTimeInMinutes
                            ) {
                                break; // Exit if we've reached the end time
                            }

                            startHours.push(timeSlot.startTime);

                            const { totalMinutes: endTimeTotalMinutes } =
                                parseTimeToHoursAndMinutes(timeSlot.endTime);
                            const durationInMinutes =
                                endTimeTotalMinutes - startTimeTotalMinutes;

                            const keys = [...orderredTimeslotMap.keys()];
                            const currentIndex = keys.indexOf(
                                startTimeTotalMinutes
                            );

                            if (currentIndex === -1) {
                                return null; // Key not found
                            }

                            // Wrap to beginning if at end
                            const nextIndex = currentIndex + 1;
                            if (nextIndex >= keys.length) {
                                break;
                            }
                            startTime = orderredTimeslotMap.get(
                                keys[nextIndex]
                            )!.startTime;
                        }
                    }

                    const periods: string[] = [];

                    const room = isOnline ? "" : `${c.room}`;
                    for (const startHour of startHours) {
                        periods.push(
                            `[${room}.${dayAbbr}.${startHour}.${type}]`
                        );
                    }

                    csvData.push({
                        course_code: c.code,
                        course_name: c.name,
                        instructor: c.instructor,
                        day: c.day,
                        room: c.room || "Online",
                        start_time: c.startTime,
                        end_time: c.endTime,
                        duration: c.duration,
                        format: periods.join(", "),
                    });
                };

                // Process main course
                processCourse(course);

                // Process combined courses if any
                if (course.isCombined && course.combinedCourses) {
                    course.combinedCourses.forEach(processCourse);
                }
            });

            if (csvData.length === 0) {
                showErrorMessage("No data to export after processing.");
                return;
            }

            const headers = [
                "course_code",
                "course_name",
                "instructor",
                "day",
                "room",
                "start_time",
                "end_time",
                "duration",
                "format",
            ];
            const csvRows = [
                headers.join(","),
                ...csvData.map((row) =>
                    headers
                        .map((header) => {
                            const value = row[header] || "";
                            if (
                                value.toString().includes(",") ||
                                value.toString().includes('"')
                            ) {
                                return `"${value
                                    .toString()
                                    .replace(/"/g, '""')}"`;
                            }
                            return value;
                        })
                        .join(",")
                ),
            ];

            const csvContent = csvRows.join("\n");

            const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
            });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);

            const today = new Date().toISOString().split("T")[0];
            link.setAttribute("download", `schedule_export_${today}.csv`);

            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSuccessMessage(
                `Schedule exported successfully! ${csvData.length} courses exported.`
            );
        } catch (error) {
            console.error("Export error:", error);
            showErrorMessage(
                `Failed to export schedule: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    };

    const renderCombinedCourseCell = (course: CombinedTimetableCourse) => {
        if (course.isCombined && course.combinedCourses) {
            return (
                <div className="space-y-1">
                    {/* Main course */}
                    <div className="text-xs font-semibold truncate">
                        {course.code}
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-1">
                <div className="text-xs font-semibold">{course.code}</div>
            </div>
        );
    };

    const renderEnhancedTableCellWithDebug = (
        day: string,
        classroom: Classroom,
        slot: CourseHour
    ) => {
        const slotKey = getTimeSlotKey(slot);
        const key = `${day}-${classroom.id}-${slotKey}`;
        const course = filteredSchedule[key];

        const cellKey = `${day}-${classroom.id}-${slotKey}`;
        const dragState = cellDragStates[cellKey] || {
            isDragOver: false,
            isValidDrop: false,
        };

        if (course && !course.isStart) {
            return null;
        }

        return (
            <td
                key={`${day}-${classroom.id}-${slotKey}`}
                className={`
                px-1 py-1 whitespace-nowrap text-xs border relative min-h-[60px] transition-all duration-200
                ${
                    dragState.isDragOver
                        ? dragState.isValidDrop
                            ? "bg-green-50 border-green-300 shadow-inner"
                            : "bg-red-50 border-red-300"
                        : "hover:bg-gray-50"
                }
            `}
                colSpan={course?.colspan || 1}
                onDragOver={(e) =>
                    handleCellDragOver(e, day, classroom.id.toString(), slotKey)
                }
                onDragLeave={(e) =>
                    handleCellDragLeave(
                        e,
                        day,
                        classroom.id.toString(),
                        slotKey
                    )
                }
                onDrop={() => handleDrop(day, classroom.id.toString(), slotKey)}
                onMouseEnter={() =>
                    draggedCourse &&
                    setHoveredCell({
                        day,
                        time: slotKey,
                        classroom: classroom.id.toString(),
                        index: timeSlots.findIndex(
                            (ts) => getTimeSlotKey(ts) === slotKey
                        ),
                    })
                }
                onMouseLeave={() => setHoveredCell(null)}
            >
                {dragState.isDragOver && !course && (
                    <div
                        className={`
                    absolute inset-0 border-2 border-dashed rounded-sm m-1 flex items-center justify-center text-xs font-medium
                    ${
                        dragState.isValidDrop
                            ? "border-green-400 bg-green-100 text-green-700"
                            : "border-red-400 bg-red-100 text-red-700"
                    }
                `}
                    >
                        {dragState.isValidDrop ? (
                            <div className="flex items-center">
                                <span>Drop {draggedCourse?.code}</span>
                            </div>
                        ) : (
                            <span>Cannot drop here</span>
                        )}
                    </div>
                )}
                {dragState.isDragOver && course && dragState.isValidDrop && (
                    <div className="absolute inset-0 border-2 border-dashed border-blue-400 rounded-sm m-1 flex items-center justify-center text-xs font-medium bg-blue-100 text-blue-700">
                        <div className="flex items-center">
                            <Plus className="w-3 h-3 mr-1" />
                            <span>Combine with {course.code}</span>
                        </div>
                    </div>
                )}
                {dragState.isDragOver &&
                    dragState.isValidDrop &&
                    draggedCourse &&
                    !course && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                            <div
                                // className={`${draggedCourse.color} opacity-60 rounded m-1 p-1 border-2 border-dashed border-blue-400`}

                                className={` opacity-60 rounded m-1 p-1 border-2 border-dashed border-blue-400`}
                                style={{
                                    backgroundColor:
                                        draggedCourse.originalColor,
                                }}
                            >
                                <div className="font-semibold text-xs">
                                    {draggedCourse.code}
                                </div>
                            </div>
                        </div>
                    )}

                {hoveredCell?.day === day &&
                    hoveredCell?.time === slotKey &&
                    hoveredCell?.classroom === classroom.id.toString() &&
                    draggedCourse &&
                    !dragState.isDragOver && (
                        <div className="absolute z-50 -top-2 left-full ml-1 bg-gray-900 text-white shadow-lg p-2 rounded text-xs whitespace-nowrap max-w-xs">
                            <div className="font-semibold mb-1">
                                {draggedCourse.code} - {draggedCourse.duration}
                                hr
                                {draggedCourse.duration > 1 ? "s" : ""}
                            </div>

                            {course && (
                                <div className="text-blue-400 mb-1">
                                    💡 Can combine with {course.code}
                                </div>
                            )}

                            {/* Online/Offline validation */}
                            {(() => {
                                const isOnlineClassroom = classroom.id < 0;
                                const isCourseOnline =
                                    draggedCourse.status === "online" ||
                                    draggedCourse.isOnline === true;

                                if (isCourseOnline && !isOnlineClassroom) {
                                    return (
                                        <div className="text-red-400 mb-1">
                                            ⚠️ Online courses cannot be assigned
                                            to physical classrooms
                                        </div>
                                    );
                                }
                                if (!isCourseOnline && isOnlineClassroom) {
                                    return (
                                        <div className="text-red-400 mb-1">
                                            ⚠️ Physical courses cannot be
                                            assigned to online rows
                                        </div>
                                    );
                                }
                            })()}

                            {/* Capacity validation */}
                            {(() => {
                                const isOnlineClassroom = classroom.id < 0;
                                if (!isOnlineClassroom) {
                                    const capacityCheck =
                                        validateCapacityConstraints(
                                            draggedCourse,
                                            classroom.id.toString(),
                                            classrooms
                                        );

                                    if (!capacityCheck.isValid) {
                                        return (
                                            <div className="text-red-400 mb-1 whitespace-normal">
                                                ⚠️{" "}
                                                {capacityCheck.conflictMessage}
                                            </div>
                                        );
                                    } else if (capacityCheck.capacityDetails) {
                                        const {
                                            courseCapacity,
                                            classroomCapacity,
                                            utilizationPercentage,
                                        } = capacityCheck.capacityDetails;
                                        return (
                                            <div className="text-green-400 mb-1">
                                                ✓ Capacity: {courseCapacity}/
                                                {classroomCapacity} (
                                                {utilizationPercentage}%)
                                            </div>
                                        );
                                    } else if (capacityCheck.warningMessage) {
                                        return (
                                            <div className="text-yellow-400 mb-1 whitespace-normal">
                                                ⚠️{" "}
                                                {capacityCheck.warningMessage}
                                            </div>
                                        );
                                    }
                                }
                            })()}

                            {/* Instructor constraint validation */}
                            {(() => {
                                const check = checkInstructorConstraints(
                                    draggedCourse,
                                    day,
                                    hoveredCell.index,
                                    draggedCourse.duration,
                                    classroom.id.toString()
                                );
                                if (!check.isValid) {
                                    return (
                                        <div className="text-red-400 mb-1 whitespace-normal">
                                            ⚠️ {check.conflictMessage}
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="text-green-400 mb-1">
                                            ✓ Instructor available
                                        </div>
                                    );
                                }
                            })()}

                            {/* Time slots information */}
                            <div className="space-y-0.5">
                                <div className="text-xs text-gray-300 mb-1">
                                    Time slots:
                                </div>
                                {Array.from(
                                    { length: draggedCourse.duration },
                                    (_, i) => {
                                        const slotIndex = hoveredCell.index + i;
                                        if (slotIndex < timeSlots.length) {
                                            const slot = timeSlots[slotIndex];
                                            const occupied =
                                                schedule[
                                                    `${day}-${
                                                        classroom.id
                                                    }-${getTimeSlotKey(slot)}`
                                                ];
                                            return (
                                                <div
                                                    key={i}
                                                    className={
                                                        occupied
                                                            ? "text-yellow-400"
                                                            : "text-green-400"
                                                    }
                                                >
                                                    {slot.time_slot ||
                                                        slot.startTime}{" "}
                                                    {occupied
                                                        ? `(can combine with ${occupied.code})`
                                                        : "✓"}
                                                </div>
                                            );
                                        }
                                        return (
                                            <div
                                                key={i}
                                                className="text-red-400"
                                            >
                                                Out of bounds
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        </div>
                    )}
                {course ? (
                    <div
                        // className={`${
                        //     course.color
                        // } p-1 rounded cursor-pointer text-center border shadow-sm transition-all font-medium hover:shadow-md ${
                        //     course.isCombined ? "border-2 border-blue-400" : ""
                        // }`}
                        className={`p-1 rounded cursor-pointer text-center border shadow-sm transition-all font-medium hover:shadow-md ${
                            course.isCombined ? "border-2 border-blue-400" : ""
                        }`}
                        style={{ backgroundColor: course.originalColor }}
                        onClick={() =>
                            handleScheduledCourseClick(
                                day,
                                classroom.id.toString(),
                                slotKey,
                                course
                            )
                        }
                        draggable
                        onDragStart={() => handleDragStart(course)}
                    >
                        {renderCombinedCourseCell(course)}
                    </div>
                ) : (
                    <div className="h-6 w-full" />
                )}
            </td>
        );
    };

    return (
        <>
            {/* Messages - OUTSIDE the main content flow */}
            {messages.length > 0 && (
                <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
                    <div className="pointer-events-auto space-y-2">
                        {messages.map((message) => (
                            <MessageBanner key={message.id} message={message} />
                        ))}
                    </div>
                </div>
            )}

            <div className="relative min-h-screen pb-80">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Classroom View Timetable
                        </h2>
                        <p className="text-xs text-gray-600 mt-1">
                            Manage and generate classroom schedules - drag
                            courses to combine them
                        </p>
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
                        <Button
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white px-6 py-2.5 rounded font-medium transition-colors"
                            onClick={saveAllAssignments}
                        >
                            Save All
                        </Button>
                        <Button
                            onClick={exportOldSystemFormat}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-purple-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={Object.keys(schedule).length === 0}
                        >
                            <Download className="mr-1 h-3 w-3" /> Export CSV
                        </Button>
                    </div>
                </div>

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

                {/* ERROR BANNER - Add this here */}
                <ErrorBanner
                    errors={schedulingErrors}
                    warnings={schedulingWarnings}
                />

                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-350px)] mb-8">
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
                                            <td
                                                className={`px-4 py-2 whitespace-nowrap text-sm font-medium border ${
                                                    classroom.id < 0
                                                        ? "bg-blue-50 text-blue-700 italic"
                                                        : "text-gray-700"
                                                }`}
                                            >
                                                {classroom.code}
                                            </td>

                                            {days.map((day) =>
                                                timeSlots.map((slot) => {
                                                    return renderEnhancedTableCellWithDebug(
                                                        day,
                                                        classroom,
                                                        slot
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

                <div
                    className={`fixed bottom-0 left-0 right-0 bg-white p-4 rounded-t-lg shadow-lg z-50 border-t ${
                        isDraggingToAvailable ? "bg-blue-100" : ""
                    }`}
                    onDragOver={handleAvailableDragOver}
                    onDragLeave={handleAvailableDragLeave}
                    onDrop={handleAvailableDrop}
                >
                    <div className="max-w-9xl mx-auto h-60">
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
                                {availableCourses.map((course, index) => {
                                    // Add logging for each rendered course
                                    // console.log("Rendering available course:", {
                                    //     availableCourses,
                                    // });
                                    // console.log(
                                    //     `Rendering available course ${index}: ${course.code} (ID: ${course.id})`
                                    // );

                                    return (
                                        <div
                                            key={course.id}
                                            // className={`${course.color} p-3 rounded-lg shadow cursor-pointer hover:shadow-md transition-all border`}
                                            className={`p-3 rounded-lg shadow cursor-pointer hover:shadow-md transition-all border`}
                                            style={{
                                                backgroundColor:
                                                    course.originalColor,
                                            }}
                                            draggable
                                            onDragStart={() =>
                                                handleDragStart(course)
                                            }
                                            onClick={() =>
                                                handleCourseClick(course)
                                            }
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
                                                Section:{" "}
                                                {course.section || "N/A"}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
                        //GG FYP
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
                                        className={`w-full h-1`}
                                        style={{
                                            backgroundColor:
                                                selectedCourse.originalColor,
                                        }}
                                    ></div>

                                    {selectedCourse.isCombined &&
                                    selectedCourse.combinedCourses ? (
                                        <div>
                                            <h3 className="font-bold text-lg mb-2">
                                                Combined Course Assignment
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="border rounded p-3">
                                                    <h4 className="font-semibold text-md">
                                                        Main Course:
                                                    </h4>
                                                    <p className="text-sm">
                                                        {selectedCourse.code}:{" "}
                                                        {selectedCourse.name}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        Instructor:{" "}
                                                        {
                                                            selectedCourse.instructor
                                                        }
                                                    </p>
                                                </div>
                                                {selectedCourse.combinedCourses.map(
                                                    (combined, index) => (
                                                        <div
                                                            key={index}
                                                            className="border rounded p-3 bg-gray-50"
                                                        >
                                                            <h4 className="font-semibold text-md">
                                                                Combined Course{" "}
                                                                {index + 1}:
                                                            </h4>
                                                            <p className="text-sm">
                                                                {combined.code}:{" "}
                                                                {combined.name}
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                Instructor:{" "}
                                                                {
                                                                    combined.instructor
                                                                }
                                                            </p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <h3 className="font-bold text-lg">
                                                {selectedCourse.code}:{" "}
                                                {selectedCourse.name}
                                            </h3>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-muted-foreground">
                                                        Instructor:
                                                    </span>
                                                    <span className="text-sm font-medium">
                                                        {
                                                            selectedCourse.instructor
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">
                                                Duration:
                                            </span>
                                            <span className="text-sm font-medium">
                                                {selectedCourse.duration}{" "}
                                                hour(s)
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
            {schedulingErrors.length > 0 && (
                <ErrorSummaryDialog
                    errors={schedulingErrors}
                    isOpen={isErrorDialogOpen}
                    onClose={() => setIsErrorDialogOpen(false)}
                />
            )}
        </>
    );
}

/**
 *
 * @param time
 * @returns hours, minutes, totalMinutes
 */
function parseTimeToHoursAndMinutes(time: string): {
    hours: number;
    minutes: number;
    totalMinutes: number;
} {
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    return { hours, minutes, totalMinutes };
}

function convertMinutesToHourMinuteFormat(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours < 10 ? "0" : ""}${hours}:${mins < 10 ? "0" : ""}${mins}`;
}
