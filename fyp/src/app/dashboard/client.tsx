"use client";

import { AuthUser } from "@/auth";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_TIMESLOTS } from "@/lib/utils";
import {
    BookOpen,
    CheckCircle,
    Pencil,
    Plus,
    Trash,
    Users,
    X,
    XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Type definitions
type Schedule = {
    id: string;
    name: string;
    academic_year: string;
    courses: number;
    instructors: number;
    startDate: string;
    endDate: string;
    timeSlots?: {
        startTime: string;
        endTime: string;
    }[];
};

// Message types
type MessageType = "success" | "error";

type Message = {
    id: string;
    type: MessageType;
    title: string;
    description: string;
};

interface DashboardProps {
    authUser: AuthUser;
}

export default function Dashboard({ authUser }: DashboardProps) {
    const router = useRouter();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
        null
    );
    const [formData, setFormData] = useState({
        name: "",
        startDate: "",
        endDate: "",
        numTimeSlots: "" as string | number,
        timeSlots: [] as { startTime: string; endTime: string }[],
    });

    // Message state with better management
    const [messages, setMessages] = useState<Message[]>([]);
    const messageTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // Persistent state to store all time slot values
    const [persistentTimeSlots, setPersistentTimeSlots] = useState<
        { startTime: string; endTime: string }[]
    >([]);
    const [isLoading, setIsLoading] = useState(true);

    // New state for time slot validation errors
    const [timeSlotErrors, setTimeSlotErrors] = useState<{
        [key: number]: string;
    }>({});

    // Loading states for operations
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const isFormValid = (): boolean => {
        // Check required fields
        if (!formData.name.trim()) return false;
        if (!formData.startDate) return false;
        if (!formData.endDate) return false;

        // If numTimeSlots is specified and > 0, validate time slots
        const numSlots =
            typeof formData.numTimeSlots === "string"
                ? formData.numTimeSlots === ""
                    ? 0
                    : parseInt(formData.numTimeSlots)
                : formData.numTimeSlots;

        if (numSlots > 0) {
            // Check that all time slots have both start and end times filled
            for (let i = 0; i < formData.timeSlots.length; i++) {
                const slot = formData.timeSlots[i];

                // If either start or end time is empty, form is invalid
                if (!slot.startTime.trim() || !slot.endTime.trim()) {
                    return false;
                }

                // If time format is incomplete, form is invalid
                if (
                    !isCompleteTimeFormat(slot.startTime) ||
                    !isCompleteTimeFormat(slot.endTime)
                ) {
                    return false;
                }
            }
        }

        return true;
    };

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

    const addMessage = (
        type: MessageType,
        title: string,
        description: string
    ) => {
        // Clear any existing messages first to prevent duplicates
        clearAllMessages();

        const newMessage: Message = {
            id: Date.now().toString(),
            type,
            title,
            description,
        };

        setMessages([newMessage]); // Only set this one message

        // Set auto-removal timer
        const timer = setTimeout(() => {
            removeMessage(newMessage.id);
        }, 5000);

        messageTimersRef.current.set(newMessage.id, timer);
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

    const showSuccessMessage = (title: string, description: string) => {
        addMessage("success", title, description);
    };

    const showErrorMessage = (title: string, description: string) => {
        addMessage("error", title, description);
    };

    // Date conversion utilities
    const formatDateForInput = (dateString: string): string => {
        if (!dateString) return "";

        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return dateString;
        }

        // Try to parse human-readable date format like "15 Jan, 2025"
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split("T")[0];
            }
        } catch (error) {
            console.error("Error parsing date:", error);
        }

        return "";
    };

    const formatDateForDisplay = (dateString: string): string => {
        if (!dateString) return "";

        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                });
            }
        } catch (error) {
            console.error("Error formatting date:", error);
        }

        return dateString;
    };

    // Time validation functions
    const isValidTimeInput = (time: string): boolean => {
        // Allow empty string
        if (time === "") return true;

        // Allow partial input while typing
        const partialPatterns = [
            /^\d{1,2}$/, // Just hour (1 or 2 digits)
            /^\d{1,2}:$/, // Hour with colon
            /^\d{1,2}:\d{1,2}$/, // Full HH:MM format
        ];

        return partialPatterns.some((pattern) => pattern.test(time));
    };

    const isCompleteTimeFormat = (time: string): boolean => {
        if (time === "") return false;
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    };

    const formatTimeInput = (time: string): string => {
        // Auto-format time input
        const numbersOnly = time.replace(/[^\d]/g, "");

        if (numbersOnly.length === 0) return "";
        if (numbersOnly.length <= 2) return numbersOnly;
        if (numbersOnly.length <= 4) {
            return `${numbersOnly.slice(0, 2)}:${numbersOnly.slice(2)}`;
        }

        return `${numbersOnly.slice(0, 2)}:${numbersOnly.slice(2, 4)}`;
    };

    // Enhanced validation functions
    const timeToMinutes = (time: string): number => {
        if (!time || !isCompleteTimeFormat(time)) return -1;
        const [hours, minutes] = time.split(":").map(Number);
        return hours * 60 + minutes;
    };

    const validateTimeSlot = (
        startTime: string,
        endTime: string
    ): { isValid: boolean; error?: string } => {
        // Check if both times are provided when one is provided
        if ((startTime && !endTime) || (!startTime && endTime)) {
            return {
                isValid: false,
                error: "Both start and end times must be provided",
            };
        }

        // If both are empty, that's valid (optional time slot)
        if (!startTime && !endTime) {
            return { isValid: true };
        }

        // Check format
        if (!isCompleteTimeFormat(startTime)) {
            return {
                isValid: false,
                error: "Start time must be in HH:MM format",
            };
        }

        if (!isCompleteTimeFormat(endTime)) {
            return {
                isValid: false,
                error: "End time must be in HH:MM format",
            };
        }

        // Check if end time is after start time
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);

        if (endMinutes <= startMinutes) {
            return {
                isValid: false,
                error: "End time must be after start time",
            };
        }

        return { isValid: true };
    };

    const validateAllTimeSlots = (
        timeSlots: { startTime: string; endTime: string }[]
    ): {
        isValid: boolean;
        errors: { [key: number]: string };
    } => {
        const errors: { [key: number]: string } = {};

        // First validate each individual time slot
        timeSlots.forEach((slot, index) => {
            const validation = validateTimeSlot(slot.startTime, slot.endTime);
            if (!validation.isValid && validation.error) {
                errors[index] = validation.error;
            }
        });

        // Then check for overlaps between consecutive time slots
        for (let i = 0; i < timeSlots.length - 1; i++) {
            const currentSlot = timeSlots[i];
            const nextSlot = timeSlots[i + 1];

            // Skip validation if either slot has errors or is empty
            if (
                errors[i] ||
                errors[i + 1] ||
                !currentSlot.startTime ||
                !currentSlot.endTime ||
                !nextSlot.startTime ||
                !nextSlot.endTime
            ) {
                continue;
            }

            const currentEndMinutes = timeToMinutes(currentSlot.endTime);
            const nextStartMinutes = timeToMinutes(nextSlot.startTime);

            if (nextStartMinutes < currentEndMinutes) {
                errors[i + 1] = `Time slot ${
                    i + 2
                } start time must be after time slot ${i + 1} end time (${
                    currentSlot.endTime
                })`;
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
        };
    };

    const hasAnyErrors = (): boolean => {
        // Check if form is valid first
        if (!isFormValid()) return true;

        // Then check for immediate validation errors
        return hasImmediateErrors();
    };

    // Fetch schedules when component mounts
    useEffect(() => {
        fetchSchedules();
    }, []);

    // Update timeSlots array when numTimeSlots changes, using persistent data
    useEffect(() => {
        const numSlots =
            typeof formData.numTimeSlots === "string"
                ? formData.numTimeSlots === ""
                    ? 0
                    : parseInt(formData.numTimeSlots)
                : formData.numTimeSlots;

        const newTimeSlots: { startTime: string; endTime: string }[] = [];

        for (let i = 0; i < numSlots; i++) {
            // Use persistent data if available, otherwise create empty slot
            if (i < persistentTimeSlots.length) {
                newTimeSlots.push(persistentTimeSlots[i]);
            } else {
                newTimeSlots.push({ startTime: "", endTime: "" });
            }
        }

        setFormData((prev) => ({
            ...prev,
            timeSlots: newTimeSlots,
        }));

        // Clear errors when time slots change
        setTimeSlotErrors({});
    }, [formData.numTimeSlots, persistentTimeSlots]);

    const [hasAssignedCourses, setHasAssignedCourses] =
        useState<boolean>(false);
    const [isCheckingCourses, setIsCheckingCourses] = useState<boolean>(false);

    const fetchAssignedCourses = async (scheduleId: string) => {
        try {
            const response = await fetch(
                `/api/assign-time-slots/?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch assigned courses");
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(
                `Error fetching assigned courses for schedule ${scheduleId}:`,
                error
            );
            return [];
        }
    };
    const checkForAssignedCourses = async (
        scheduleId: string
    ): Promise<boolean> => {
        try {
            setIsCheckingCourses(true);
            const assignedCourses = await fetchAssignedCourses(scheduleId);

            // Check if any assigned course has day, timeslot, and classroomid that are not null
            const hasActiveAssignments = assignedCourses.some(
                (course: any) =>
                    course.day !== null &&
                    course.timeslot !== null &&
                    course.classroomid !== null
            );

            return hasActiveAssignments;
        } catch (error) {
            console.error("Error checking assigned courses:", error);
            return false;
        } finally {
            setIsCheckingCourses(false);
        }
    };
    const fetchCourseCount = async (scheduleId: string) => {
        try {
            const response = await fetch(
                `/api/courses?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch courses");
            }
            const data = await response.json();
            const sectionMap = new Map();

            data.forEach((courseHour: any) => {
                const sectionKey = courseHour.sectionId.toString();

                if (!sectionMap.has(sectionKey)) {
                    // Create a new section entry with the original Course type structure
                    sectionMap.set(sectionKey, {
                        id: courseHour.id,
                        sectionId: courseHour.sectionId,
                        title: courseHour.title,
                        code: courseHour.code,
                        year: courseHour.year,
                        major: courseHour.major,
                        color: courseHour.color,
                        firstName: courseHour.firstName,
                        lastName: courseHour.lastName,
                        instructorId: courseHour.instructorId,
                        duration: courseHour.duration,
                        separatedDuration: courseHour.separatedDuration,
                        capacity: courseHour.capacity,
                        status: courseHour.status,
                        section: courseHour.section,
                        classroom: courseHour.classroom,
                        separatedDurations: [courseHour.separatedDuration],
                        courseHours: [],
                        preferClassRoomTypeId: courseHour.preferClassRoomTypeId,
                        preferClassRoomTypeName:
                            courseHour.preferClassRoomTypeName,
                    });
                } else {
                    // Always add separated duration to existing section
                    const sectionData = sectionMap.get(sectionKey);
                    sectionData.separatedDurations.push(
                        courseHour.separatedDuration
                    );
                }

                // Add this course hour to the section's course hours
                sectionMap.get(sectionKey).courseHours.push({
                    id: courseHour.id,
                    separatedDuration: courseHour.separatedDuration,
                    day: courseHour.day,
                    timeSlot: courseHour.timeSlot,
                });
            });
            const processedCourses = Array.from(sectionMap.values()).map(
                (course) => {
                    // Calculate the total combined separated duration
                    const combinedSeparatedDuration =
                        course.separatedDurations.reduce(
                            (total: number, duration: number) =>
                                total + duration,
                            0
                        );
                    return {
                        ...course,
                        combinedSeparatedDuration,
                        separatedDuration: course.separatedDurations[0],
                        preferClassRoomTypeId: course.preferClassRoomTypeId,
                        preferClassRoomTypeName: course.preferClassRoomTypeName,
                    };
                }
            );
            return processedCourses.length;
        } catch (error) {
            console.error(
                `Error fetching courses for schedule ${scheduleId}:`,
                error
            );
            return 0;
        }
    };

    const fetchInstructorCount = async (scheduleId: string) => {
        try {
            const response = await fetch(
                `/api/instructors?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch instructors");
            }
            const data = await response.json();
            return data.length;
        } catch (error) {
            console.error(
                `Error fetching instructors for schedule ${scheduleId}:`,
                error
            );
            return 0;
        }
    };

    const fetchSchedules = async (silent: boolean = false) => {
        setIsLoading(true);
        const userId = authUser.id;
        try {
            const response = await fetch(`/api/schedules?userId=${userId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch schedules");
            }
            const data = await response.json();

            console.log("Fetched schedules:", data);

            // Create a new array to hold the processed schedules with counts
            const processedSchedules = await Promise.all(
                data.map(async (schedule: Schedule) => {
                    // Split the academic_year string into start and end dates
                    const [startDateStr, endDateStr] =
                        schedule.academic_year.split(" - ");

                    // Fetch course and instructor counts for this schedule
                    const courseCount = await fetchCourseCount(
                        schedule.id.toString()
                    );
                    const instructorCount = await fetchInstructorCount(
                        schedule.id.toString()
                    );

                    return {
                        id: schedule.id.toString(),
                        name: schedule.name,
                        startDate: startDateStr,
                        endDate: endDateStr || startDateStr,
                        courses: courseCount,
                        instructors: instructorCount,
                        timeSlots: schedule.timeSlots || [],
                    };
                })
            );

            setSchedules(processedSchedules);
        } catch (error: any) {
            console.error("Error fetching schedules:", error);
            // Only show error message if not in silent mode
            if (!silent) {
                showErrorMessage(
                    "Failed to Load Schedules",
                    error.message ||
                        "An error occurred while fetching schedules."
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        if (name === "numTimeSlots") {
            // Allow empty string for deletion
            if (value === "") {
                setFormData({
                    ...formData,
                    [name]: "",
                });
            } else {
                // Parse the number and ensure it's a valid positive integer
                const numValue = parseInt(value);
                // Add maximum limit of 24 time slots
                if (
                    !isNaN(numValue) &&
                    numValue >= 0 &&
                    numValue <= MAX_TIMESLOTS
                ) {
                    setFormData({
                        ...formData,
                        [name]: numValue,
                    });
                }
                // If invalid, don't update (keeps previous valid value)
            }
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }
    };

    // Enhanced handleTimeSlotChange with real-time validation
    const handleTimeSlotChange = (
        index: number,
        field: "startTime" | "endTime",
        value: string
    ) => {
        // Validate and format the input
        const formattedValue = formatTimeInput(value);

        if (!isValidTimeInput(formattedValue)) {
            return; // Don't update if invalid format
        }

        // Update persistent state
        const updatedPersistentTimeSlots = [...persistentTimeSlots];

        // Ensure the persistent array is large enough
        while (updatedPersistentTimeSlots.length <= index) {
            updatedPersistentTimeSlots.push({ startTime: "", endTime: "" });
        }

        updatedPersistentTimeSlots[index][field] = formattedValue;
        setPersistentTimeSlots(updatedPersistentTimeSlots);

        // Update current form data
        const updatedTimeSlots = [...formData.timeSlots];
        updatedTimeSlots[index][field] = formattedValue;

        // Validate all time slots after this change
        const validation = validateAllTimeSlots(updatedTimeSlots);

        // Store validation errors in state
        setTimeSlotErrors(validation.errors);

        setFormData({
            ...formData,
            timeSlots: updatedTimeSlots,
        });
    };

    // Modify the resetForm function to also reset the hasAssignedCourses state
    const resetForm = () => {
        setFormData({
            name: "",
            startDate: "",
            endDate: "",
            numTimeSlots: "",
            timeSlots: [],
        });
        setPersistentTimeSlots([]);
        setTimeSlotErrors({});
        setHasAssignedCourses(false); // Add this line
    };

    const openEditDialog = async (scheduleId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to schedule detail
        const schedule = schedules.find((s) => s.id === scheduleId);
        if (schedule) {
            setSelectedScheduleId(scheduleId);

            // Check for assigned courses before opening dialog
            const hasAssignments = await checkForAssignedCourses(scheduleId);
            setHasAssignedCourses(hasAssignments);

            const timeSlots = schedule.timeSlots || [];
            setFormData({
                name: schedule.name,
                startDate: formatDateForInput(schedule.startDate),
                endDate: formatDateForInput(schedule.endDate),
                numTimeSlots: timeSlots.length,
                timeSlots: timeSlots,
            });
            setPersistentTimeSlots([...timeSlots]);
            setTimeSlotErrors({});
            setIsEditDialogOpen(true);
        }
    };

    const openDeleteDialog = (scheduleId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to schedule detail
        setSelectedScheduleId(scheduleId);
        setIsDeleteDialogOpen(true);
    };

    const navigateToSchedule = (scheduleId: string) => {
        router.push(`/dashboard/schedule/${scheduleId}`);
    };

    // Check for any immediate validation errors
    const hasImmediateErrors = (): boolean => {
        // Check for format errors
        for (let i = 0; i < formData.timeSlots.length; i++) {
            const slot = formData.timeSlots[i];
            if (
                (slot.startTime && !isCompleteTimeFormat(slot.startTime)) ||
                (slot.endTime && !isCompleteTimeFormat(slot.endTime))
            ) {
                return true;
            }
        }

        // Check for end time <= start time errors
        for (let i = 0; i < formData.timeSlots.length; i++) {
            const slot = formData.timeSlots[i];
            if (
                slot.startTime &&
                slot.endTime &&
                isCompleteTimeFormat(slot.startTime) &&
                isCompleteTimeFormat(slot.endTime) &&
                timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime)
            ) {
                return true;
            }
        }

        // Check for overlap with previous time slot
        for (let i = 1; i < formData.timeSlots.length; i++) {
            const currentSlot = formData.timeSlots[i];
            const previousSlot = formData.timeSlots[i - 1];
            if (
                currentSlot.startTime &&
                isCompleteTimeFormat(currentSlot.startTime) &&
                previousSlot.endTime &&
                isCompleteTimeFormat(previousSlot.endTime) &&
                timeToMinutes(currentSlot.startTime) <
                    timeToMinutes(previousSlot.endTime)
            ) {
                return true;
            }
        }

        // Check for validation errors from the validation system
        if (Object.keys(timeSlotErrors).length > 0) {
            return true;
        }

        return false;
    };

    // Enhanced validateTimeSlots function
    const validateTimeSlots = (): boolean => {
        // Validate date range
        if (formData.startDate && formData.endDate) {
            const startDate = new Date(formData.startDate);
            const endDate = new Date(formData.endDate);

            if (endDate < startDate) {
                showErrorMessage(
                    "Invalid Date Range",
                    "End date cannot be before start date."
                );
                return false;
            }
        }

        // Check for immediate errors first
        if (hasImmediateErrors()) {
            showErrorMessage(
                "Invalid Time Slots",
                "Please fix the time slot errors before submitting."
            );
            return false;
        }

        // Validate all time slots
        const validation = validateAllTimeSlots(formData.timeSlots);

        if (!validation.isValid) {
            // Show the first error found
            const firstErrorIndex = Object.keys(validation.errors)[0];
            const firstError = validation.errors[parseInt(firstErrorIndex)];
            showErrorMessage(
                "Time Slot Validation Error",
                `Time slot ${parseInt(firstErrorIndex) + 1}: ${firstError}`
            );
            return false;
        }

        return true;
    };

    const handleCreateSchedule = async () => {
        if (!validateTimeSlots()) {
            return;
        }

        if (!formData.name.trim()) {
            showErrorMessage("Validation Error", "Schedule name is required.");
            return;
        }

        if (!formData.startDate) {
            showErrorMessage("Validation Error", "Start date is required.");
            return;
        }

        if (!formData.endDate) {
            showErrorMessage("Validation Error", "End date is required.");
            return;
        }

        setIsCreating(true);
        try {
            // Convert numTimeSlots to number for API
            const numSlots =
                typeof formData.numTimeSlots === "string"
                    ? formData.numTimeSlots === ""
                        ? 0
                        : parseInt(formData.numTimeSlots)
                    : formData.numTimeSlots;

            // Prepare data for API
            const apiData = {
                name: formData.name,
                startDate: formData.startDate,
                endDate: formData.endDate,
                numberOfTimeSlots: numSlots,
                timeSlots: formData.timeSlots,
                userId: authUser.id,
            };

            const response = await fetch("/api/schedules", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            const responseData = await response.json();

            if (!response.ok) {
                if (typeof responseData.error === "string") {
                    throw new Error(
                        responseData.error || "Failed to create schedule"
                    );
                }
                throw new Error(
                    responseData.error[0].message || "Failed to create schedule"
                );
            }

            // Close dialog and reset form first
            setIsCreateDialogOpen(false);
            resetForm();

            // Then refresh and show success message
            await fetchSchedules(true);
            showSuccessMessage(
                "Schedule Created Successfully",
                `Schedule "${formData.name}" has been created successfully.`
            );
        } catch (error: any) {
            console.error("Error creating schedule:", error);
            showErrorMessage(
                "Failed to Create Schedule",
                error.message ||
                    "An error occurred while creating the schedule."
            );
        } finally {
            setIsCreating(false);
        }
    };

    const handleEditSchedule = async () => {
        if (!selectedScheduleId) return;

        if (!validateTimeSlots()) {
            return;
        }

        if (!formData.name.trim()) {
            showErrorMessage("Validation Error", "Schedule name is required.");
            return;
        }

        if (!formData.startDate) {
            showErrorMessage("Validation Error", "Start date is required.");
            return;
        }

        if (!formData.endDate) {
            showErrorMessage("Validation Error", "End date is required.");
            return;
        }

        setIsUpdating(true);
        const scheduleName = formData.name; // Store the name before reset

        try {
            const selectedSchedule = schedules.find(
                (s) => s.id === selectedScheduleId
            );
            if (!selectedSchedule) return;

            const apiData = {
                id: Number(selectedSchedule.id),
                name: formData.name,
                startDate: formData.startDate,
                endDate: formData.endDate,
                timeSlots: formData.timeSlots,
                userId: authUser.id,
            };

            const response = await fetch("/api/schedules", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            const responseData = await response.json();

            if (!response.ok) {
                if (typeof responseData.error === "string") {
                    throw new Error(
                        responseData.error || "Failed to update schedule"
                    );
                }
                throw new Error(
                    responseData.error[0].message || "Failed to update schedule"
                );
            }

            // Close dialog and reset form first
            setIsEditDialogOpen(false);
            resetForm();

            // Then refresh and show success message
            await fetchSchedules(true);
            showSuccessMessage(
                "Schedule Updated Successfully",
                `Schedule "${scheduleName}" has been updated successfully.`
            );
        } catch (error: any) {
            console.error("Error updating schedule:", error);
            showErrorMessage(
                "Failed to Update Schedule",
                error.message ||
                    "An error occurred while updating the schedule."
            );
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteSchedule = async () => {
        if (!selectedScheduleId) return;

        setIsDeleting(true);
        const scheduleToDelete = schedules.find(
            (s) => s.id === selectedScheduleId
        );
        const scheduleName = scheduleToDelete?.name || "Unknown";

        try {
            const apiData = {
                id: Number(selectedScheduleId),
            };

            const response = await fetch("/api/schedules", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(
                    responseData.error || "Failed to delete schedule"
                );
            }

            // Close dialog first
            setIsDeleteDialogOpen(false);
            setSelectedScheduleId(null);

            // Then refresh and show success message
            await fetchSchedules(true);
            showSuccessMessage(
                "Schedule Deleted Successfully",
                `Schedule "${scheduleName}" has been deleted successfully.`
            );
        } catch (error: any) {
            console.error("Error deleting schedule:", error);
            showErrorMessage(
                "Failed to Delete Schedule",
                error.message ||
                    "An error occurred while deleting the schedule."
            );
        } finally {
            setIsDeleting(false);
        }
    };

    // Generate placeholder based on index
    const getTimePlaceholder = (index: number, isStartTime: boolean) => {
        const baseHour = 8 + index; // Start from 08:00 and increment by 1 hour for each index
        const hour = isStartTime ? baseHour : baseHour + 1; // End time is start time + 1
        const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
        return `${formattedHour}:00`; // Format as HH:MM
    };

    // Enhanced time slot input rendering function
    const renderTimeSlotInputs = (dialogType: "create" | "edit") => {
        if (formData.timeSlots.length === 0) return null;

        return (
            <div className='space-y-4'>
                <h3 className='font-semibold text-gray-900 border-b border-gray-200 pb-2'>
                    TimeSlots Configuration
                </h3>
                <p className='text-sm text-gray-600'>
                    Please enter times in HH:MM format (e.g., 08:00, 14:30)
                </p>
                {formData.timeSlots.map((timeSlot, index) => {
                    // Check for end time less than start time
                    const hasEndTimeError =
                        timeSlot.startTime &&
                        timeSlot.endTime &&
                        isCompleteTimeFormat(timeSlot.startTime) &&
                        isCompleteTimeFormat(timeSlot.endTime) &&
                        timeToMinutes(timeSlot.endTime) <=
                            timeToMinutes(timeSlot.startTime);

                    // Check for overlap with previous time slot
                    const hasPreviousOverlap =
                        index > 0 &&
                        timeSlot.startTime &&
                        isCompleteTimeFormat(timeSlot.startTime) &&
                        formData.timeSlots[index - 1].endTime &&
                        isCompleteTimeFormat(
                            formData.timeSlots[index - 1].endTime
                        ) &&
                        timeToMinutes(timeSlot.startTime) <
                            timeToMinutes(
                                formData.timeSlots[index - 1].endTime
                            );

                    return (
                        <div
                            key={index}
                            className='grid grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50'
                        >
                            <div className='space-y-2'>
                                <Label
                                    htmlFor={`${dialogType}-startTime-${index}`}
                                    className='text-sm font-medium text-gray-700'
                                >
                                    Start Time #{index + 1}
                                </Label>
                                <Input
                                    id={`${dialogType}-startTime-${index}`}
                                    placeholder='HH:MM'
                                    value={timeSlot.startTime}
                                    onChange={(e) =>
                                        handleTimeSlotChange(
                                            index,
                                            "startTime",
                                            e.target.value
                                        )
                                    }
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white ${
                                        (timeSlot.startTime &&
                                            !isCompleteTimeFormat(
                                                timeSlot.startTime
                                            )) ||
                                        hasPreviousOverlap ||
                                        (timeSlotErrors[index] &&
                                            timeSlotErrors[index].includes(
                                                "start time"
                                            ))
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                />
                                {/* Immediate error display for start time format */}
                                {timeSlot.startTime &&
                                    !isCompleteTimeFormat(
                                        timeSlot.startTime
                                    ) && (
                                        <div className='flex items-center gap-1'>
                                            <span className='text-red-500 text-xs'>
                                                ⚠️
                                            </span>
                                            <p className='text-xs text-red-600 font-medium'>
                                                Enter time in HH:MM format
                                            </p>
                                        </div>
                                    )}
                                {/* Immediate error for start time overlap with previous slot */}
                                {hasPreviousOverlap && (
                                    <div className='flex items-center gap-1'>
                                        <span className='text-red-500 text-xs'>
                                            ❌
                                        </span>
                                        <p className='text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded'>
                                            Start time must be after time slot{" "}
                                            {index} end time (
                                            {
                                                formData.timeSlots[index - 1]
                                                    .endTime
                                            }
                                            )
                                        </p>
                                    </div>
                                )}
                                {/* Display specific validation errors for start time */}
                                {timeSlotErrors[index] &&
                                    timeSlotErrors[index].includes(
                                        "start time"
                                    ) &&
                                    !hasPreviousOverlap && (
                                        <div className='flex items-center gap-1'>
                                            <span className='text-red-500 text-xs'>
                                                ❌
                                            </span>
                                            <p className='text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded'>
                                                {timeSlotErrors[index]}
                                            </p>
                                        </div>
                                    )}
                            </div>
                            <div className='space-y-2'>
                                <Label
                                    htmlFor={`${dialogType}-endTime-${index}`}
                                    className='text-sm font-medium text-gray-700'
                                >
                                    End Time #{index + 1}
                                </Label>
                                <Input
                                    id={`${dialogType}-endTime-${index}`}
                                    placeholder='HH:MM'
                                    value={timeSlot.endTime}
                                    onChange={(e) =>
                                        handleTimeSlotChange(
                                            index,
                                            "endTime",
                                            e.target.value
                                        )
                                    }
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white ${
                                        (timeSlot.endTime &&
                                            !isCompleteTimeFormat(
                                                timeSlot.endTime
                                            )) ||
                                        hasEndTimeError ||
                                        (timeSlotErrors[index] &&
                                            timeSlotErrors[index].includes(
                                                "end time"
                                            ))
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                />
                                {/* Immediate error display for end time format */}
                                {timeSlot.endTime &&
                                    !isCompleteTimeFormat(timeSlot.endTime) && (
                                        <div className='flex items-center gap-1'>
                                            <span className='text-red-500 text-xs'>
                                                ⚠️
                                            </span>
                                            <p className='text-xs text-red-600 font-medium'>
                                                Enter time in HH:MM format
                                            </p>
                                        </div>
                                    )}
                                {/* Immediate error for end time less than or equal to start time */}
                                {hasEndTimeError && (
                                    <div className='flex items-center gap-1'>
                                        <span className='text-red-500 text-xs'>
                                            ❌
                                        </span>
                                        <p className='text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded'>
                                            End time must be after start time (
                                            {timeSlot.startTime})
                                        </p>
                                    </div>
                                )}
                                {/* Display specific validation errors for end time */}
                                {timeSlotErrors[index] &&
                                    timeSlotErrors[index].includes(
                                        "end time"
                                    ) &&
                                    !hasEndTimeError && (
                                        <div className='flex items-center gap-1'>
                                            <span className='text-red-500 text-xs'>
                                                ❌
                                            </span>
                                            <p className='text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded'>
                                                {timeSlotErrors[index]}
                                            </p>
                                        </div>
                                    )}
                            </div>

                            {/* Show other general time slot validation errors */}
                            {timeSlotErrors[index] &&
                                !timeSlotErrors[index].includes("start time") &&
                                !timeSlotErrors[index].includes("end time") &&
                                !timeSlotErrors[index].includes(
                                    "End time must be after start time"
                                ) &&
                                !hasPreviousOverlap && (
                                    <div className='col-span-2'>
                                        <div className='flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3'>
                                            <span className='text-red-500 text-sm'>
                                                🚫
                                            </span>
                                            <p className='text-sm text-red-700 font-medium'>
                                                {timeSlotErrors[index]}
                                            </p>
                                        </div>
                                    </div>
                                )}
                        </div>
                    );
                })}
            </div>
        );
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
            <div className='flex items-start justify-between'>
                <div className='flex items-start gap-3'>
                    {message.type === "success" ? (
                        <CheckCircle className='h-5 w-5 text-green-600 flex-shrink-0 mt-0.5' />
                    ) : (
                        <XCircle className='h-5 w-5 text-red-600 flex-shrink-0 mt-0.5' />
                    )}
                    <div>
                        <h4 className='font-semibold text-sm'>
                            {message.title}
                        </h4>
                        <p className='text-sm mt-1 opacity-90'>
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
                    <X className='h-4 w-4' />
                </button>
            </div>
        </div>
    );

    return (
        <>
            {messages.length > 0 && (
                <div className='fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none'>
                    <div className='pointer-events-auto space-y-2'>
                        {messages.map((message) => (
                            <MessageBanner key={message.id} message={message} />
                        ))}
                    </div>
                </div>
            )}
            <div className='space-y-8'>
                <div className='bg-white rounded-lg border border-gray-200 p-6 shadow-sm'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <h1 className='text-2xl font-semibold text-gray-900'>
                                Schedules
                            </h1>
                            <p className='text-sm text-gray-600 mt-1'>
                                Manage your academic schedules and time slots
                            </p>
                        </div>
                        <Button
                            className='bg-[#2F2F85] hover:bg-[#3F3F8F] text-white px-6 py-2.5 rounded font-medium transition-colors'
                            onClick={() => {
                                resetForm();
                                setIsCreateDialogOpen(true);
                            }}
                        >
                            <Plus className='mr-2 h-4 w-4' /> New Schedule
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className='bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm'>
                        <div className='text-gray-600'>
                            Loading schedules...
                        </div>
                    </div>
                ) : (
                    <div className='space-y-4'>
                        {schedules.map((schedule) => (
                            <div
                                key={schedule.id}
                                className='bg-white border border-gray-200 rounded-lg p-6 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm'
                                onClick={() => navigateToSchedule(schedule.id)}
                            >
                                <div className='flex items-start justify-between'>
                                    <div className='flex-1'>
                                        <h2 className='text-lg font-semibold text-gray-900 mb-2'>
                                            {schedule.name}
                                        </h2>
                                        <p className='text-sm text-gray-600 mb-4'>
                                            {schedule.startDate}{" "}
                                            {schedule.endDate
                                                ? `- ${schedule.endDate}`
                                                : ""}
                                        </p>
                                    </div>
                                    <div className='flex gap-2 ml-4'>
                                        <Button
                                            variant='ghost'
                                            size='icon'
                                            className='h-9 w-9 text-gray-500 hover:text-[#2F2F85] hover:bg-blue-50'
                                            onClick={(e) =>
                                                openEditDialog(schedule.id, e)
                                            }
                                        >
                                            <Pencil className='h-4 w-4' />
                                        </Button>
                                        <Button
                                            variant='ghost'
                                            size='icon'
                                            className='h-9 w-9 text-gray-500 hover:text-red-600 hover:bg-red-50'
                                            onClick={(e) =>
                                                openDeleteDialog(schedule.id, e)
                                            }
                                        >
                                            <Trash className='h-4 w-4' />
                                        </Button>
                                    </div>
                                </div>

                                <div className='flex items-center gap-8 pt-4 border-t border-gray-100'>
                                    <div className='flex items-center gap-2 text-sm text-gray-600'>
                                        <BookOpen className='h-4 w-4 text-teal-600' />
                                        <span className='font-medium'>
                                            {schedule.courses}
                                        </span>
                                        <span>Courses</span>
                                    </div>
                                    <div className='flex items-center gap-2 text-sm text-gray-600'>
                                        <Users className='h-4 w-4 text-purple-600' />
                                        <span className='font-medium'>
                                            {schedule.instructors}
                                        </span>
                                        <span>Instructors</span>
                                    </div>
                                    {schedule.timeSlots &&
                                        schedule.timeSlots.length > 0 && (
                                            <div className='flex items-center gap-2 text-sm text-gray-600'>
                                                <span className='w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center'>
                                                    <span className='text-white text-xs'>
                                                        ⏰
                                                    </span>
                                                </span>
                                                <span className='font-medium'>
                                                    {schedule.timeSlots.length}
                                                </span>
                                                <span>TimeSlots</span>
                                            </div>
                                        )}
                                </div>
                            </div>
                        ))}

                        {schedules.length === 0 && (
                            <div className='bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm'>
                                <div className='text-gray-500 mb-2'>
                                    No schedules found
                                </div>
                                <div className='text-sm text-gray-400'>
                                    Create a new schedule to get started.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Create Schedule Dialog */}
                <Dialog
                    open={isCreateDialogOpen}
                    onOpenChange={setIsCreateDialogOpen}
                >
                    <DialogContent className='max-w-3xl max-h-[85vh] overflow-y-auto bg-white'>
                        <DialogHeader className='border-b border-gray-200 pb-4'>
                            <DialogTitle className='text-xl font-semibold text-gray-900'>
                                Create New Schedule
                            </DialogTitle>
                        </DialogHeader>

                        <div className='grid gap-6 py-6'>
                            <div className='space-y-2'>
                                <Label
                                    htmlFor='name'
                                    className='text-sm font-medium text-gray-700'
                                >
                                    Schedule Name
                                </Label>
                                <Input
                                    id='name'
                                    name='name'
                                    placeholder='Schedule 1'
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className='border-gray-300 focus:border-[#2F2F85] focus:border-[#2F2F85]'
                                />
                            </div>

                            <div className='grid grid-cols-2 gap-4'>
                                <div className='space-y-2'>
                                    <Label
                                        htmlFor='startDate'
                                        className='text-sm font-medium text-gray-700'
                                    >
                                        Start Date
                                    </Label>
                                    <Input
                                        id='startDate'
                                        name='startDate'
                                        type='date'
                                        value={formData.startDate}
                                        onChange={handleInputChange}
                                        className='border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]'
                                    />
                                </div>

                                <div className='space-y-2'>
                                    <Label
                                        htmlFor='endDate'
                                        className='text-sm font-medium text-gray-700'
                                    >
                                        End Date
                                    </Label>
                                    <Input
                                        id='endDate'
                                        name='endDate'
                                        type='date'
                                        min={
                                            formData.startDate
                                                ? new Date(
                                                      new Date(
                                                          formData.startDate
                                                      ).getTime() + 86400000 // Add 1 day in milliseconds
                                                  )
                                                      .toISOString()
                                                      .split("T")[0]
                                                : undefined
                                        }
                                        value={formData.endDate}
                                        onChange={handleInputChange}
                                        className='border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]'
                                    />
                                </div>
                            </div>

                            {/* TimeSlot input */}
                            <div className='space-y-2'>
                                <Label
                                    htmlFor='numTimeSlots'
                                    className='text-sm font-medium text-gray-700'
                                >
                                    Number of TimeSlots
                                </Label>
                                <Input
                                    id='numTimeSlots'
                                    name='numTimeSlots'
                                    type='number'
                                    min='0'
                                    max={MAX_TIMESLOTS}
                                    placeholder='Enter number of time slots needed'
                                    value={formData.numTimeSlots}
                                    onChange={handleInputChange}
                                    className='border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]'
                                />
                            </div>

                            {/* Dynamic timeSlot inputs */}
                            {renderTimeSlotInputs("create")}
                        </div>

                        <DialogFooter className='border-t border-gray-200 pt-4'>
                            <Button
                                variant='outline'
                                onClick={() => setIsCreateDialogOpen(false)}
                                className='border-gray-300 text-gray-700 hover:bg-gray-50'
                                disabled={isCreating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateSchedule}
                                className='bg-[#2F2F85] hover:bg-[#3F3F8F] text-white'
                                disabled={hasAnyErrors() || isCreating}
                            >
                                {isCreating ? "Creating..." : "Create Schedule"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Schedule Dialog */}
                <Dialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                >
                    <DialogContent className='max-w-3xl max-h-[85vh] overflow-y-auto bg-white'>
                        <DialogHeader className='border-b border-gray-200 pb-4'>
                            <DialogTitle className='text-xl font-semibold text-gray-900'>
                                Edit Schedule
                            </DialogTitle>
                        </DialogHeader>

                        <div className='grid gap-6 py-6'>
                            <div className='space-y-2'>
                                <Label
                                    htmlFor='edit-name'
                                    className='text-sm font-medium text-gray-700'
                                >
                                    Schedule Name
                                </Label>
                                <Input
                                    id='edit-name'
                                    name='name'
                                    placeholder='Schedule 1'
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className='border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]'
                                />
                            </div>

                            <div className='grid grid-cols-2 gap-4'>
                                <div className='space-y-2'>
                                    <Label
                                        htmlFor='edit-startDate'
                                        className='text-sm font-medium text-gray-700'
                                    >
                                        Start Date
                                    </Label>
                                    <Input
                                        id='edit-startDate'
                                        name='startDate'
                                        type='date'
                                        value={formData.startDate}
                                        onChange={handleInputChange}
                                        className='border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]'
                                    />
                                </div>

                                <div className='space-y-2'>
                                    <Label
                                        htmlFor='edit-endDate'
                                        className='text-sm font-medium text-gray-700'
                                    >
                                        End Date
                                    </Label>
                                    <Input
                                        id='edit-endDate'
                                        name='endDate'
                                        type='date'
                                        min={
                                            formData.startDate
                                                ? new Date(
                                                      new Date(
                                                          formData.startDate
                                                      ).getTime() + 86400000 // Add 1 day in milliseconds
                                                  )
                                                      .toISOString()
                                                      .split("T")[0]
                                                : undefined
                                        }
                                        value={formData.endDate}
                                        onChange={handleInputChange}
                                        className='border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]'
                                    />
                                </div>
                            </div>

                            {/* TimeSlot input with conditional disable and warning */}
                            <div className='space-y-2'>
                                <Label
                                    htmlFor='edit-numTimeSlots'
                                    className='text-sm font-medium text-gray-700'
                                >
                                    Number of TimeSlots
                                </Label>

                                {/* Warning message when courses are assigned */}
                                {hasAssignedCourses && (
                                    <div className='bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2'>
                                        <div className='flex items-center gap-2'>
                                            <span className='text-amber-600 text-sm'>
                                                ⚠️
                                            </span>
                                            <p className='text-sm text-amber-800 font-medium'>
                                                Cannot modify timeslots: There
                                                are courses assigned to the
                                                timetable
                                            </p>
                                        </div>
                                        <p className='text-xs text-amber-700 mt-1 ml-6'>
                                            Please remove all course assignments
                                            before changing the number of
                                            timeslots.
                                        </p>
                                    </div>
                                )}

                                <Input
                                    id='edit-numTimeSlots'
                                    name='numTimeSlots'
                                    type='number'
                                    min='0'
                                    max={MAX_TIMESLOTS}
                                    placeholder='Enter number of time slots needed'
                                    value={formData.numTimeSlots}
                                    onChange={handleInputChange}
                                    disabled={
                                        hasAssignedCourses || isCheckingCourses
                                    }
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] ${
                                        hasAssignedCourses
                                            ? "bg-gray-100 cursor-not-allowed opacity-60"
                                            : ""
                                    }`}
                                />

                                {isCheckingCourses && (
                                    <p className='text-xs text-gray-500'>
                                        Checking for assigned courses...
                                    </p>
                                )}
                            </div>

                            {/* Dynamic timeSlot inputs - also disable individual inputs when courses are assigned */}
                            {formData.timeSlots.length > 0 && (
                                <div className='space-y-4'>
                                    <h3 className='font-semibold text-gray-900 border-b border-gray-200 pb-2'>
                                        TimeSlots Configuration
                                    </h3>
                                    {hasAssignedCourses && (
                                        <div className='bg-blue-50 border border-blue-200 rounded-lg p-3'>
                                            <div className='flex items-center gap-2'>
                                                <span className='text-blue-600 text-sm'>
                                                    ℹ️
                                                </span>
                                                <p className='text-sm text-blue-800'>
                                                    Timeslot modifications are
                                                    disabled because courses are
                                                    assigned to this schedule.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <p className='text-sm text-gray-600'>
                                        Please enter times in HH:MM format
                                        (e.g., 08:00, 14:30)
                                    </p>
                                    {formData.timeSlots.map(
                                        (timeSlot, index) => {
                                            // Check for end time less than start time
                                            const hasEndTimeError =
                                                timeSlot.startTime &&
                                                timeSlot.endTime &&
                                                isCompleteTimeFormat(
                                                    timeSlot.startTime
                                                ) &&
                                                isCompleteTimeFormat(
                                                    timeSlot.endTime
                                                ) &&
                                                timeToMinutes(
                                                    timeSlot.endTime
                                                ) <=
                                                    timeToMinutes(
                                                        timeSlot.startTime
                                                    );

                                            // Check for overlap with previous time slot
                                            const hasPreviousOverlap =
                                                index > 0 &&
                                                timeSlot.startTime &&
                                                isCompleteTimeFormat(
                                                    timeSlot.startTime
                                                ) &&
                                                formData.timeSlots[index - 1]
                                                    .endTime &&
                                                isCompleteTimeFormat(
                                                    formData.timeSlots[
                                                        index - 1
                                                    ].endTime
                                                ) &&
                                                timeToMinutes(
                                                    timeSlot.startTime
                                                ) <
                                                    timeToMinutes(
                                                        formData.timeSlots[
                                                            index - 1
                                                        ].endTime
                                                    );

                                            return (
                                                <div
                                                    key={index}
                                                    className={`grid grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg ${
                                                        hasAssignedCourses
                                                            ? "bg-gray-50"
                                                            : "bg-gray-50"
                                                    }`}
                                                >
                                                    <div className='space-y-2'>
                                                        <Label
                                                            htmlFor={`edit-startTime-${index}`}
                                                            className='text-sm font-medium text-gray-700'
                                                        >
                                                            Start Time #
                                                            {index + 1}
                                                        </Label>
                                                        <Input
                                                            id={`edit-startTime-${index}`}
                                                            placeholder='HH:MM'
                                                            value={
                                                                timeSlot.startTime
                                                            }
                                                            onChange={(e) =>
                                                                handleTimeSlotChange(
                                                                    index,
                                                                    "startTime",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            disabled={
                                                                hasAssignedCourses
                                                            }
                                                            className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white ${
                                                                hasAssignedCourses
                                                                    ? "bg-gray-100 cursor-not-allowed opacity-60"
                                                                    : ""
                                                            } ${
                                                                (timeSlot.startTime &&
                                                                    !isCompleteTimeFormat(
                                                                        timeSlot.startTime
                                                                    )) ||
                                                                hasPreviousOverlap ||
                                                                (timeSlotErrors[
                                                                    index
                                                                ] &&
                                                                    timeSlotErrors[
                                                                        index
                                                                    ].includes(
                                                                        "start time"
                                                                    ))
                                                                    ? "border-red-300 focus:border-red-500 animate-pulse"
                                                                    : ""
                                                            }`}
                                                        />
                                                        {/* Error messages remain the same */}
                                                    </div>
                                                    <div className='space-y-2'>
                                                        <Label
                                                            htmlFor={`edit-endTime-${index}`}
                                                            className='text-sm font-medium text-gray-700'
                                                        >
                                                            End Time #
                                                            {index + 1}
                                                        </Label>
                                                        <Input
                                                            id={`edit-endTime-${index}`}
                                                            placeholder='HH:MM'
                                                            value={
                                                                timeSlot.endTime
                                                            }
                                                            onChange={(e) =>
                                                                handleTimeSlotChange(
                                                                    index,
                                                                    "endTime",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            disabled={
                                                                hasAssignedCourses
                                                            }
                                                            className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white ${
                                                                hasAssignedCourses
                                                                    ? "bg-gray-100 cursor-not-allowed opacity-60"
                                                                    : ""
                                                            } ${
                                                                (timeSlot.endTime &&
                                                                    !isCompleteTimeFormat(
                                                                        timeSlot.endTime
                                                                    )) ||
                                                                hasEndTimeError ||
                                                                (timeSlotErrors[
                                                                    index
                                                                ] &&
                                                                    timeSlotErrors[
                                                                        index
                                                                    ].includes(
                                                                        "end time"
                                                                    ))
                                                                    ? "border-red-300 focus:border-red-500 animate-pulse"
                                                                    : ""
                                                            }`}
                                                        />
                                                        {/* Error messages remain the same */}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </div>

                        <DialogFooter className='border-t border-gray-200 pt-4'>
                            <Button
                                variant='outline'
                                onClick={() => setIsEditDialogOpen(false)}
                                className='border-gray-300 text-gray-700 hover:bg-gray-50'
                                disabled={isUpdating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleEditSchedule}
                                className='bg-[#2F2F85] hover:bg-[#3F3F8F] text-white'
                                disabled={hasAnyErrors() || isUpdating}
                            >
                                {isUpdating ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                {/* Delete Schedule Dialog */}
                <AlertDialog
                    open={isDeleteDialogOpen}
                    onOpenChange={setIsDeleteDialogOpen}
                >
                    <AlertDialogContent className='bg-white'>
                        <AlertDialogHeader>
                            <AlertDialogTitle className='text-xl font-semibold text-gray-900'>
                                Delete Schedule
                            </AlertDialogTitle>
                            <AlertDialogDescription className='text-gray-600'>
                                <div className='mb-3'>
                                    <span className='font-semibold text-gray-700 text-base'>
                                        Are you sure you want to delete this
                                        schedule?
                                    </span>
                                    <span className='block text-sm text-gray-700 mt-1'>
                                        This action{" "}
                                        <span className='font-bold text-red-600'>
                                            cannot be undone
                                        </span>
                                        .
                                    </span>
                                </div>
                                {selectedScheduleId &&
                                    (() => {
                                        const schedule = schedules.find(
                                            (s) => s.id === selectedScheduleId
                                        );
                                        if (!schedule) return null;
                                        return (
                                            <div className='bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2'>
                                                <div className='flex flex-col gap-2'>
                                                    <div className='flex items-center gap-2'>
                                                        <BookOpen className='h-4 w-4 text-teal-600' />
                                                        <span className='font-medium'>
                                                            {schedule.courses}
                                                        </span>
                                                        <span className='text-gray-700'>
                                                            Courses
                                                        </span>
                                                    </div>
                                                    <div className='flex items-center gap-2'>
                                                        <Users className='h-4 w-4 text-purple-600' />
                                                        <span className='font-medium'>
                                                            {
                                                                schedule.instructors
                                                            }
                                                        </span>
                                                        <span className='text-gray-700'>
                                                            Instructors
                                                        </span>
                                                    </div>
                                                    {schedule.timeSlots &&
                                                        schedule.timeSlots
                                                            .length > 0 && (
                                                            <div className='flex items-center gap-2'>
                                                                <span className='w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center'>
                                                                    <span className='text-white text-xs'>
                                                                        ⏰
                                                                    </span>
                                                                </span>
                                                                <span className='font-medium'>
                                                                    {
                                                                        schedule
                                                                            .timeSlots
                                                                            .length
                                                                    }
                                                                </span>
                                                                <span className='text-gray-700'>
                                                                    TimeSlots
                                                                </span>
                                                            </div>
                                                        )}
                                                    <div className='flex items-center gap-2'>
                                                        <BookOpen className='h-4 w-4 text-[#2F2F85]' />
                                                        <span className='font-semibold text-gray-800'>
                                                            Schedule title:
                                                        </span>
                                                        <span className='text-gray-900'>
                                                            {schedule.name}
                                                        </span>
                                                    </div>
                                                    <div className='flex items-center gap-2'>
                                                        <span className='inline-flex items-center'>
                                                            <svg
                                                                className='h-4 w-4 text-[#2F2F85] mr-1'
                                                                fill='none'
                                                                stroke='currentColor'
                                                                strokeWidth='2'
                                                                viewBox='0 0 24 24'
                                                            >
                                                                <rect
                                                                    x='3'
                                                                    y='4'
                                                                    width='18'
                                                                    height='18'
                                                                    rx='2'
                                                                    stroke='currentColor'
                                                                />
                                                                <path
                                                                    d='M16 2v4M8 2v4M3 10h18'
                                                                    stroke='currentColor'
                                                                />
                                                            </svg>
                                                        </span>
                                                        <span className='font-semibold text-gray-800'>
                                                            Dates:
                                                        </span>
                                                        <span className='text-gray-900'>
                                                            {formatDateForDisplay(
                                                                schedule.startDate
                                                            )}
                                                            {schedule.endDate
                                                                ? ` - ${formatDateForDisplay(
                                                                      schedule.endDate
                                                                  )}`
                                                                : ""}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                <span className='block text-sm text-red-700 mt-2'>
                                    All associated courses, instructors, and
                                    timeslots will be lost.
                                </span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                className='border-gray-300 text-gray-700 hover:bg-gray-50'
                                disabled={isDeleting}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteSchedule}
                                className='bg-red-600 hover:bg-red-700 text-white'
                                disabled={isDeleting}
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </>
    );
}
