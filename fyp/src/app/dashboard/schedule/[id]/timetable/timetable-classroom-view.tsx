"use client";

import {
    CellToDelete,
    Classroom,
    Course,
    CourseHour,
    isAssignedCourse,
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
import { AlertCircle, CheckCircle2, Download, Search, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

type TimetableGrid = Record<string, TimetableCourse>;

const initialSchedule: TimetableGrid = {};

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
        useState<TimetableCourse | null>(null);
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

    const params = useParams();

    const showMessage = (type: "success" | "error", text: string) => {
        const id = messageIdCounter;
        setMessageIdCounter((prev) => prev + 1);

        const newMessage: Message = { id, type, text };
        setMessages((prev) => [...prev, newMessage]);

        setTimeout(() => {
            setMessages((prev) => prev.filter((msg) => msg.id !== id));
        }, 3000);
    };

    const removeMessage = (id: number) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== id));
    };

    const normalizeTimeSlot = (timeSlot: any) => {
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
    };

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

    const formatTimeSlotForDisplay = (timeSlot: any) => {
        const normalized = normalizeTimeSlot(timeSlot);
        if (normalized.includes("-")) {
            return normalized.replace("-", " - ");
        }
        return normalized;
    };

    const areTimeSlotsEqual = (slot1: any, slot2: any) => {
        return normalizeTimeSlot(slot1) === normalizeTimeSlot(slot2);
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
        duration: number
    ): { isValid: boolean; conflictMessage?: string } => {
        const instructorName = course.instructor.trim();

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

        for (let i = 0; i < duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;

            const currentTimeSlot = getTimeSlotKey(
                timeSlots[timeSlotIndex + i]
            );

            const conflictingCourse = Object.entries(schedule).find(
                ([scheduleKey, scheduledCourse]) => {
                    if (scheduledCourse.id === course.id) {
                        return false;
                    }

                    if (
                        scheduledCourse.day === day &&
                        scheduledCourse.instructor.trim() === instructorName
                    ) {
                        const keyParts = scheduleKey.split("-");
                        const scheduleTimeSlot = keyParts[keyParts.length - 1];
                        return scheduleTimeSlot === currentTimeSlot;
                    }

                    return false;
                }
            );

            if (conflictingCourse) {
                const [, conflictingScheduledCourse] = conflictingCourse;
                return {
                    isValid: false,
                    conflictMessage: `Instructor ${instructorName} is already teaching ${conflictingScheduledCourse.code} on ${day} at ${currentTimeSlot}`,
                };
            }
        }

        return { isValid: true };
    };

    const handleCourseClick = (course: TimetableCourse) => {
        if (course.duration > 1) {
            setCourseSplitConfig({ course, splits: [] });
            setSplitDurations([course.duration]);
            setIsSplitDialogOpen(true);
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

        setAvailableCourses((prev) => prev.filter((c) => c.id !== course.id));

        const splitCourses = splitDurations.map((duration, index) => ({
            ...course,
            id: course.id ? course.id * 1000 + index + 1 : index + 1,
            duration: duration,
            uniqueId: `${course.code}-${course.section}-split-${index + 1}`,
            name: `${course.name} (Part ${index + 1})`,
        }));

        setAvailableCourses((prev) => [...prev, ...splitCourses]);

        setIsSplitDialogOpen(false);
        setCourseSplitConfig(null);
        setSplitDurations([]);
    };

    const cancelSplit = () => {
        setIsSplitDialogOpen(false);
        setCourseSplitConfig(null);
        setSplitDurations([]);
    };

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

    useEffect(() => {
        setIsSearchActive(searchQuery.trim().length > 0);
    }, [searchQuery]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const clearSearch = () => {
        setSearchQuery("");
    };

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

    useEffect(() => {
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
                                    const parsed = parseTimeSlot(
                                        slot.time_slot
                                    );
                                    formattedSlot.startTime = parsed.startTime;
                                    formattedSlot.endTime = parsed.endTime;
                                }

                                return formattedSlot;
                            }
                        );

                        const isConsecutive =
                            areTimeSlotsConsecutive(apiTimeSlots);
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
                    ];

                    setClassrooms([...data, ...virtualOnlineClassrooms]);
                }
            } catch (error) {
                console.error("Error fetching classrooms:", error);
            }
        };

        fetchTimeSlots();
        fetchClassrooms();
    }, [params.id]);

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

                    const colorMap = new Map<
                        string,
                        { color: string; originalColor?: string }
                    >();

                    const transformedCourses = coursesData.map(
                        (course: any) => {
                            const colorClassName =
                                colors_class[course.color] ||
                                getConsistentCourseColor(course.code);

                            colorMap.set(course.code, {
                                color: colorClassName,
                                originalColor: course.color,
                            });

                            const isOnlineCourse =
                                course.status === "online" ||
                                course.isOnline === true;

                            return {
                                id: course.id,
                                code: course.code,
                                sectionId: course.sectionId,
                                name: course.title,
                                color: colorClassName,
                                duration:
                                    course.separatedDuration || course.duration,
                                instructor: `${course.firstName || ""} ${
                                    course.lastName || ""
                                }`.trim(),
                                section: course.section,
                                room: isOnlineCourse
                                    ? "Online"
                                    : course.classroom,
                                uniqueId: `${course.code}-${course.section}-${course.id}`,
                                majors: course.major || [],
                                originalColor: course.color,
                                status: isOnlineCourse ? "online" : "offline",
                                isOnline: isOnlineCourse,
                                day: course.day,
                                timeSlot: course.timeSlot,
                                capacity: course.capacity,
                            };
                        }
                    );

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

                const newSchedule: TimetableGrid = {};
                const newAssignedCourses: TimetableCourse[] = [];

                assignmentsData.forEach((assignment: any) => {
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

                    const originalDuration = parseInt(
                        assignment.separatedDuration ||
                            assignment.duration ||
                            "1",
                        10
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
                        const virtualClassroom = classrooms.find(
                            (c) => c.id < 0
                        );
                        if (virtualClassroom) {
                            classroom = virtualClassroom;
                            classroomId = virtualClassroom.id.toString();
                        } else {
                            classroomId = "-1";
                            classroom = {
                                id: -1,
                                code: "Online",
                                capacity: 999,
                            };
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
                            `Time slot "${startTime}" not found for course ${code}. Available time slots:`,
                            timeSlots.map((ts) => ({
                                key: getTimeSlotKey(ts),
                                startTime: ts.startTime,
                                time_slot: ts.time_slot,
                            }))
                        );
                        return;
                    }

                    let slotsToSpan;
                    let calculatedEndTime;

                    if (endTime) {
                        const endIndex = timeSlots.findIndex((ts, index) => {
                            if (ts.endTime === endTime) {
                                return true;
                            }

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

                    const course = {
                        id: courseHourId,
                        capacity: assignment.capacity,
                        sectionId: sectionId,
                        code: code,
                        name: title,
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
                        ? "-1"
                        : classroom.id.toString();
                    const timeSlotValue =
                        assignment.startTime?.trim() || startTime?.trim();

                    const baseKey = `${dayValue}-${classroomIdValue}-${timeSlotValue}`;

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

                const assignedIds = new Set(
                    newAssignedCourses.map((c) => c.id)
                );
                setAvailableCourses((prev) =>
                    prev.filter((c) => !assignedIds.has(c.id))
                );
            } catch (error) {
                console.error("Error fetching timetable assignments:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (timeSlots.length > 0 && classrooms.length > 0) {
            fetchTimetableAssignments();
        }
    }, [params.id, timeSlots, classrooms]);

    const checkCapacityConstraints = (
        course: TimetableCourse,
        classroomId: string
    ): { isValid: boolean; conflictMessage?: string } => {
        // Skip capacity check for online classrooms
        const isOnlineClassroom = parseInt(classroomId) < 0;
        if (isOnlineClassroom) {
            return { isValid: true };
        }

        // Find the classroom
        const classroom = classrooms.find(
            (c) => c.id.toString() === classroomId
        );
        if (!classroom) {
            return {
                isValid: false,
                conflictMessage: "Classroom not found",
            };
        }

        // Get course capacity - check different possible property names
        const courseCapacity = course.capacity;

        // Check if course capacity exceeds classroom capacity
        if (courseCapacity > classroom.capacity) {
            return {
                isValid: false,
                conflictMessage: `Course capacity (${courseCapacity} students) exceeds classroom capacity (${classroom.capacity} students)`,
            };
        }

        return { isValid: true };
    };

    const renderCapacityInfo = (
        course: TimetableCourse,
        classroom: Classroom
    ) => {
        const isOnlineClassroom = classroom.id < 0;
        if (isOnlineClassroom) return null;

        const courseCapacity = course.capacity;

        const capacityCheck = checkCapacityConstraints(
            course,
            classroom.id.toString()
        );

        if (courseCapacity === 0) {
            return (
                <div className="text-yellow-400 mb-1">
                    ⚠️ Course capacity not specified
                </div>
            );
        }

        if (!capacityCheck.isValid) {
            return (
                <div className="text-red-400 mb-1 whitespace-normal">
                    ⚠️ {capacityCheck.conflictMessage}
                </div>
            );
        }

        return (
            <div className="text-green-400 mb-1">
                ✓ Capacity: {courseCapacity}/{classroom.capacity}
            </div>
        );
    };

    function calculateSlotsNeeded(
        durationHours: number,
        timeSlots: any[],
        startIndex: number
    ) {
        if (timeSlots.length === 0 || startIndex >= timeSlots.length) return 1;

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
    }

    const getSlotDurationHours = (slot: any): number => {
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

    const getDropValidationMessage = (
        day: string,
        classroomId: string,
        timeSlot: string
    ): string => {
        if (!draggedCourse || timeSlots.length === 0)
            return "No course selected";

        const isOnlineClassroom = parseInt(classroomId) < 0;
        const isCourseOnline =
            draggedCourse.status === "online" ||
            draggedCourse.isOnline === true;

        if (isCourseOnline && !isOnlineClassroom) {
            return "Online courses cannot be assigned to physical classrooms";
        }
        if (!isCourseOnline && isOnlineClassroom) {
            return "Physical courses cannot be assigned to online rows";
        }

        const matchingTimeSlot = timeSlots.find(
            (ts) => getTimeSlotKey(ts) === timeSlot
        );
        if (!matchingTimeSlot) return "Invalid time slot";

        const slotDuration = getSlotDurationHours(matchingTimeSlot);
        const courseDuration = draggedCourse.duration;

        if (courseDuration < slotDuration) {
            return `Course duration (${courseDuration}h) is shorter than time slot (${slotDuration}h)`;
        }

        return "Cannot drop here";
    };
    function calculateEndTime(startTime: string, durationHours: number) {
        const startHour = parseInt(startTime);
        return (startHour + durationHours).toString();
    }

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

    const saveAllAssignments = async () => {
        try {
            const validAssignedCourses =
                assignedCourses.filter(isAssignedCourse);

            const assignmentsData = validAssignedCourses.map((course) => {
                const classroomValue = course.classroom;
                const isOnlineClassroom =
                    !isNaN(parseInt(classroomValue)) &&
                    parseInt(classroomValue) < 0;

                return {
                    id: course.id,
                    sectionId: course.sectionId,
                    day: course.day,
                    startTime: course.startTime,
                    endTime: course.endTime,
                    classroom: isOnlineClassroom ? null : classroomValue,
                    isOnline: isOnlineClassroom,
                    duration: course.duration,
                };
            });

            const response = await fetch("/api/assign-time-slots", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(assignmentsData),
            });

            if (response.ok) {
                showMessage(
                    "success",
                    `Successfully saved ${assignmentsData.length} course assignments!`
                );
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

        Object.keys(newSchedule).forEach((key) => {
            if (newSchedule[key].id === course.id) {
                delete newSchedule[key];
            }
        });

        setSchedule(newSchedule);

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
            day: undefined,
            startTime: undefined,
            endTime: undefined,
            classroom: undefined,
            isStart: undefined,
            isMiddle: undefined,
            isEnd: undefined,
            colspan: undefined,
        };

        if (!availableCourses.some((c) => c.id === course.id)) {
            setAvailableCourses((prev) => [...prev, cleanCourse]);
        }

        setAssignedCourses((prev) => prev.filter((c) => c.id !== course.id));
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

            // Check if this slot is occupied by another course
            if (conflictingCourse && conflictingCourse.id !== course.id) {
                console.log(
                    `  - Occupied by ${conflictingCourse.code}, stopping`
                );
                break;
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

            // Check if we have enough duration (with small tolerance)
            if (totalAccumulatedDuration >= courseDurationHours) {
                const excess = totalAccumulatedDuration - courseDurationHours;
                const tolerance = 0.25; // 15 minutes

                if (excess <= tolerance) {
                    console.log(`✅ Acceptable excess: ${excess}h`);
                    canAccommodate = true;
                    break;
                } else {
                    console.log(
                        `❌ Too much excess: ${excess}h > ${tolerance}h`
                    );
                    break;
                }
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

    const handleDrop = (day: string, classroomId: string, timeSlot: string) => {
        if (!draggedCourse || timeSlots.length === 0) {
            console.log("No dragged course or time slots");
            return;
        }

        console.log("=== DROP VALIDATION START ===");
        console.log("Drop attempt:", {
            course: draggedCourse.code,
            day,
            classroomId,
            timeSlot,
            courseCapacity: draggedCourse.capacity || "not specified",
            classroom: classrooms.find((c) => c.id.toString() === classroomId),
        });

        // 1. ONLINE/OFFLINE COURSE VALIDATION
        const isOnlineClassroom = parseInt(classroomId) < 0;
        const isCourseOnline =
            draggedCourse.status === "online" ||
            draggedCourse.isOnline === true ||
            draggedCourse.room === "Online";

        if (isCourseOnline && !isOnlineClassroom) {
            console.log(
                "VALIDATION FAILED: Online course to physical classroom"
            );
            showMessage(
                "error",
                "Online courses cannot be assigned to physical classrooms. Please use the Online rows."
            );
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }

        if (!isCourseOnline && isOnlineClassroom) {
            console.log(
                "VALIDATION FAILED: Physical course to online classroom"
            );
            showMessage(
                "error",
                "Physical courses cannot be assigned to online rows. Please use a physical classroom."
            );
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }

        // 2. STRICT CAPACITY CONSTRAINT CHECK - THIS MUST BLOCK THE DROP
        console.log("=== CAPACITY VALIDATION ===");
        const capacityValidationResult = validateCapacityConstraints(
            draggedCourse,
            classroomId,
            classrooms
        );

        // CRITICAL: If capacity validation fails, IMMEDIATELY return and show error
        if (!capacityValidationResult.isValid) {
            console.log("CAPACITY VALIDATION FAILED - BLOCKING DROP");
            console.log(
                "Error message:",
                capacityValidationResult.conflictMessage
            );

            showMessage(
                "error",
                capacityValidationResult.conflictMessage ||
                    "Capacity constraint violation - assignment blocked"
            );

            // Clean up drag state to prevent any further processing
            setDraggedCourse(null);
            setCellDragStates({});
            setHoveredCell(null);
            return; // CRITICAL: This return prevents the drop from proceeding
        }

        // Show warnings for incomplete capacity data but allow assignment
        if (capacityValidationResult.warningMessage) {
            console.log(
                "Capacity warning:",
                capacityValidationResult.warningMessage
            );
            // Note: We're not returning here, so assignment will continue
        }

        // 3. TIME SLOT VALIDATION
        const matchingTimeSlot = timeSlots.find(
            (ts) => getTimeSlotKey(ts) === timeSlot
        );

        if (!matchingTimeSlot) {
            console.error(`Time slot ${timeSlot} not found`);
            showMessage("error", "Invalid time slot selected");
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }

        const timeSlotIndex = timeSlots.indexOf(matchingTimeSlot);
        const key = `${day}-${classroomId}-${timeSlot}`;
        const existingCourse = schedule[key];

        // 4. EXISTING COURSE VALIDATION
        if (existingCourse && existingCourse.id === draggedCourse.id) {
            console.log("Course already in this position");
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }

        if (existingCourse && existingCourse.id !== draggedCourse.id) {
            showMessage(
                "error",
                `This time slot is already occupied by ${existingCourse.code}. Please choose another slot.`
            );
            setDraggedCourse(null);
            setCellDragStates({});
            return;
        }

        console.log("Matching Time Slot:", matchingTimeSlot);

        // 5. USE SHARED SLOT CALCULATION FUNCTION - CRITICAL FOR CONSISTENCY
        console.log("=== USING SHARED SLOT CALCULATION ===");
        const slotCalculation = calculateRequiredSlots(
            draggedCourse,
            timeSlots,
            timeSlotIndex,
            schedule,
            day,
            classroomId
        );

        if (!slotCalculation.canAccommodate) {
            showMessage(
                "error",
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

        // 6. VERIFY NO CONFLICTS IN ALL REQUIRED SLOTS (using calculated consecutive slots)
        console.log("=== FINAL CONFLICT CHECK ===");
        for (const slotInfo of slotCalculation.consecutiveSlots) {
            const currentKey = `${day}-${classroomId}-${slotInfo.key}`;
            const conflictingCourse = schedule[currentKey];

            if (
                conflictingCourse &&
                conflictingCourse.id !== draggedCourse.id
            ) {
                showMessage(
                    "error",
                    `Cannot place course here. Time slot ${slotInfo.key} is occupied by ${conflictingCourse.code}.`
                );
                setDraggedCourse(null);
                setCellDragStates({});
                return;
            }
            console.log(`  ✅ Slot ${slotInfo.key} is available`);
        }

        // 7. INSTRUCTOR CONSTRAINT CHECK
        const constraintCheck = checkInstructorConstraints(
            draggedCourse,
            day,
            timeSlotIndex,
            slotsNeeded
        );

        if (!constraintCheck.isValid) {
            showMessage(
                "error",
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

        // Place course in all required time slots (using our calculated consecutive slots)
        console.log(`=== PLACING COURSE IN ${slotsNeeded} SLOTS ===`);
        slotCalculation.consecutiveSlots.forEach((slotInfo, i) => {
            const currentKey = `${day}-${classroomId}-${slotInfo.key}`;

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

        // Show success message with capacity info
        const classroom = classrooms.find(
            (c) => c.id.toString() === classroomId
        );

        let successMessage = `${draggedCourse.code} assigned successfully to ${
            classroom?.code || "classroom"
        }`;

        // Add capacity info to success message if available
        if (capacityValidationResult.capacityDetails) {
            const { courseCapacity, classroomCapacity, utilizationPercentage } =
                capacityValidationResult.capacityDetails;
            successMessage += ` (${courseCapacity}/${classroomCapacity} students, ${utilizationPercentage}% capacity)`;
        }

        if (capacityValidationResult.warningMessage) {
            successMessage += ` - Warning: ${capacityValidationResult.warningMessage}`;
        }

        showMessage("success", successMessage);

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
            capacityDetails: capacityValidationResult.capacityDetails,
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
        course: TimetableCourse
    ) => {
        setSelectedCourse(course);
        const timeSlotId = getTimeSlotId(timeSlot);
        setCellToDelete({ day, classroomId, timeSlot, timeSlotId });
        setIsDialogOpen(true);
    };

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
                // After successful generation, re-fetch assignments to update the timetable
                await fetchTimetableAssignments();
                setScheduleGenerated(true);
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
    // Make fetchTimetableAssignments a standalone function or move it inside generateSchedule
    // For clarity and reusability, let's make it a regular function and call it in useEffect and generateSchedule
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

            const newSchedule: TimetableGrid = {};
            const newAssignedCourses: TimetableCourse[] = [];

            // Store all assigned course information for filtering
            const assignedCourseKeys = new Set();
            const assignedCourseIds = new Set();

            assignmentsData.forEach((assignment: any) => {
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

                // Track assigned courses
                if (courseHourId) {
                    assignedCourseIds.add(courseHourId);
                }
                if (code && assignment.sectionNumber) {
                    assignedCourseKeys.add(
                        `${code}-${assignment.sectionNumber}`
                    );
                }

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

                const originalDuration = parseInt(
                    assignment.separatedDuration || assignment.duration || "1",
                    10
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
                        classroom = {
                            id: -1,
                            code: "Online",
                            capacity: 999,
                        };
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
                        `Time slot "${startTime}" not found for course ${code}. Available time slots:`,
                        timeSlots.map((ts) => ({
                            key: getTimeSlotKey(ts),
                            startTime: ts.startTime,
                            time_slot: ts.time_slot,
                        }))
                    );
                    return;
                }

                let slotsToSpan;
                let calculatedEndTime;

                if (endTime) {
                    const endIndex = timeSlots.findIndex((ts, index) => {
                        if (ts.endTime === endTime) {
                            return true;
                        }

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

                const course = {
                    id: courseHourId,
                    capacity: assignment.capacity,
                    sectionId: sectionId,
                    code: code,
                    name: title,
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
                    ? "-1"
                    : classroom.id.toString();
                const timeSlotValue =
                    assignment.startTime?.trim() || startTime?.trim();

                const baseKey = `${dayValue}-${classroomIdValue}-${timeSlotValue}`;

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

            // Enhanced filtering logic - remove assigned courses from available courses
            setAvailableCourses((prev) => {
                const filtered = prev.filter((course) => {
                    // Check by course ID
                    if (course.id && assignedCourseIds.has(course.id)) {
                        return false;
                    }

                    // Check by course code and section combination
                    const courseKey = `${course.code}-${course.section}`;
                    if (assignedCourseKeys.has(courseKey)) {
                        return false;
                    }

                    // Check by sectionId if available
                    if (course.sectionId) {
                        const isAssignedBySection = newAssignedCourses.some(
                            (assigned) =>
                                assigned.sectionId === course.sectionId
                        );
                        if (isAssignedBySection) {
                            return false;
                        }
                    }

                    return true;
                });

                console.log("Filtering available courses:");
                console.log("- Original count:", prev.length);
                console.log("- Assigned IDs:", Array.from(assignedCourseIds));
                console.log("- Assigned keys:", Array.from(assignedCourseKeys));
                console.log("- Filtered count:", filtered.length);

                return filtered;
            });
        } catch (error) {
            console.error("Error fetching timetable assignments:", error);
        } finally {
            setIsLoading(false);
        }
    }, [params.id, timeSlots, classrooms]); // Add `useCallback` and its dependencies

    // Dependency on the memoized function

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
            const response = await fetch("/api/assign-time-slots", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: course.id,
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

            const newSchedule = { ...schedule };
            Object.keys(newSchedule).forEach((scheduleKey) => {
                if (newSchedule[scheduleKey].id === courseId) {
                    delete newSchedule[scheduleKey];
                }
            });
            setSchedule(newSchedule);

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
            };

            if (!availableCourses.some((c) => c.id === courseId)) {
                setAvailableCourses((prev) => [...prev, cleanCourse]);
            }

            setAssignedCourses((prev) => prev.filter((c) => c.id !== courseId));
            showMessage(
                "success",
                `Course ${course.code} removed successfully`
            );
        } catch (error) {
            console.error("Error removing course:", error);

            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to remove course from timetable";

            showMessage("error", `Error: ${errorMessage}`);
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

        // Block if slot is occupied by different course
        if (existingCourse && existingCourse.id !== draggedCourse.id) {
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

        // 2. CAPACITY CONSTRAINT VALIDATION
        const capacityCheck = validateCapacityConstraints(
            draggedCourse,
            classroomId,
            classrooms
        );

        if (!capacityCheck.isValid) {
            console.log(
                "❌ Capacity constraint failed:",
                capacityCheck.conflictMessage
            );
            return false;
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
            slotCalculation.slotsNeeded
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
                showMessage(
                    "error",
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
                showMessage("error", "No assigned courses found to export.");
                return;
            }

            const csvData: any[] = [];

            assignedCourses.forEach((course) => {
                const dayAbbr = getDayAbbreviation(course.day || "");
                const startPeriod = getTimePeriod(course.startTime || "");
                const isOnline =
                    !course.room || course.room === "TBA" || course.room === "";
                const type = isOnline ? "online" : "offline";

                const periods: string[] = [];
                for (let i = 0; i < course.duration; i++) {
                    const period = startPeriod + i;
                    const roomPart = isOnline ? "" : `${course.room}.`;
                    const formatStr = `[${roomPart}${dayAbbr}.${period}.${type}]`;
                    periods.push(formatStr);
                }

                csvData.push({
                    course_code: course.code,
                    course_name: course.name,
                    instructor: course.instructor,
                    day: course.day,
                    room: course.room || "Online",
                    start_time: course.startTime,
                    end_time: course.endTime,
                    duration: course.duration,
                    format: periods.join(", "),
                });
            });

            if (csvData.length === 0) {
                showMessage("error", "No data to export after processing.");
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

            showMessage(
                "success",
                `Schedule exported successfully! ${csvData.length} courses exported.`
            );
        } catch (error) {
            console.error("Export error:", error);
            showMessage(
                "error",
                `Failed to export schedule: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
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

                {dragState.isDragOver &&
                    dragState.isValidDrop &&
                    draggedCourse &&
                    !course && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                            <div
                                className={`${draggedCourse.color} opacity-60 rounded m-1 p-1 border-2 border-dashed border-blue-400`}
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
                    !course &&
                    !dragState.isDragOver && (
                        <div className="absolute z-50 -top-2 left-full ml-1 bg-gray-900 text-white shadow-lg p-2 rounded text-xs whitespace-nowrap max-w-xs">
                            <div className="font-semibold mb-1">
                                {draggedCourse.code} - {draggedCourse.duration}
                                hr
                                {draggedCourse.duration > 1 ? "s" : ""}
                            </div>

                            {(() => {
                                const isOnlineClassroom = classroom.id < 0;
                                const isCourseOnline =
                                    draggedCourse.status === "online";

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

                            {(() => {
                                const check = checkInstructorConstraints(
                                    draggedCourse,
                                    day,
                                    hoveredCell.index,
                                    draggedCourse.duration
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
                                                            ? "text-red-400"
                                                            : "text-green-400"
                                                    }
                                                >
                                                    {slot.time_slot ||
                                                        slot.startTime}{" "}
                                                    {occupied
                                                        ? `(${occupied.code})`
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
                        className={`${course.color} p-1 rounded cursor-pointer text-center border shadow-sm transition-all font-medium hover:shadow-md`}
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
                        {course.code}
                    </div>
                ) : (
                    <div className="h-6 w-full" />
                )}
            </td>
        );
    };

    return (
        <div className="relative min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Classroom View Timetable
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">
                        Manage and generate classroom schedules
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
                        className="border-purple-600 text-purple-600 hover:bg-purple-50 text-xs px-3 py-1.5 rounded-md"
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
                                    key={course.id}
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
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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

                            <Dialog
                                open={isSplitDialogOpen}
                                onOpenChange={setIsSplitDialogOpen}
                            >
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>
                                            Split Course Duration
                                        </DialogTitle>
                                    </DialogHeader>

                                    {courseSplitConfig && (
                                        <div className="space-y-4">
                                            <div className="text-sm text-gray-600">
                                                <p>
                                                    <strong>Course:</strong>{" "}
                                                    {
                                                        courseSplitConfig.course
                                                            .code
                                                    }
                                                </p>
                                                <p>
                                                    <strong>
                                                        Total Duration:
                                                    </strong>{" "}
                                                    {
                                                        courseSplitConfig.course
                                                            .duration
                                                    }{" "}
                                                    hours
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">
                                                    Split Configuration:
                                                </label>
                                                {splitDurations.map(
                                                    (duration, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <span className="text-sm">
                                                                Part {index + 1}
                                                                :
                                                            </span>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={duration}
                                                                onChange={(e) =>
                                                                    updateSplitDuration(
                                                                        index,
                                                                        parseInt(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        ) || 1
                                                                    )
                                                                }
                                                                className="w-20"
                                                            />
                                                            <span className="text-sm">
                                                                hour(s)
                                                            </span>
                                                            {splitDurations.length >
                                                                1 && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        removeSplit(
                                                                            index
                                                                        )
                                                                    }
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )
                                                )}
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <Button
                                                    variant="outline"
                                                    onClick={addSplit}
                                                >
                                                    Add Split
                                                </Button>
                                                <div className="text-sm">
                                                    Total:{" "}
                                                    {getTotalSplitDuration()} /{" "}
                                                    {
                                                        courseSplitConfig.course
                                                            .duration
                                                    }{" "}
                                                    hours
                                                </div>
                                            </div>

                                            {!isValidSplit() && (
                                                <div className="text-red-600 text-sm">
                                                    Total split duration must
                                                    equal original course
                                                    duration
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={cancelSplit}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={applySplit}
                                                    disabled={!isValidSplit()}
                                                >
                                                    Apply Split
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </DialogContent>
                            </Dialog>

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
