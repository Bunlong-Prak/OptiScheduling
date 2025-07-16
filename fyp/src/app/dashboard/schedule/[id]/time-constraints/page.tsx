"use client";

import type { Instructor, TimeConstraint } from "@/app/types";
import CustomPagination from "@/components/custom/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Check,
    CheckCircle,
    ChevronsUpDown,
    Clock,
    Pencil,
    Plus,
    Trash,
    X,
    XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Define how many items to show per page
const ITEMS_PER_PAGE = 12;

// Days of the week
const DAYS_OF_WEEK = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

// Interface for grouped constraints
interface GroupedConstraint {
    instructor_id: number;
    firstName?: string;
    lastName?: string;
    dayConstraints: {
        id: number;
        day: string;
        timeSlots: string[];
    }[];
}

// Interface for time slots
interface TimeSlot {
    id: number;
    startTime: string;
    endTime: string;
}

export default function TimeConstraintView() {
    const [timeConstraints, setTimeConstraints] = useState<TimeConstraint[]>(
        []
    );
    const [groupedConstraints, setGroupedConstraints] = useState<
        GroupedConstraint[]
    >([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedConstraint, setSelectedConstraint] =
        useState<TimeConstraint | null>(null);
    const [selectedGroupedConstraint, setSelectedGroupedConstraint] =
        useState<GroupedConstraint | null>(null);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [timeSlots, setTimeSlots] = useState<string[]>([]);
    const [apiTimeSlots, setApiTimeSlots] = useState<TimeSlot[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
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

    // State for enhanced form with multiple days
    const [enhancedFormData, setEnhancedFormData] = useState({
        instructor_id: 0,
        dayConstraints: DAYS_OF_WEEK.map((day) => ({
            day,
            selected: false,
            timeSlots: [] as string[],
        })),
    });

    // Group time constraints by instructor
    useEffect(() => {
        if (timeConstraints.length > 0) {
            const grouped: Record<number, GroupedConstraint> = {};

            timeConstraints.forEach((constraint) => {
                const instructorId = constraint.instructor_id;

                if (!grouped[instructorId]) {
                    grouped[instructorId] = {
                        instructor_id: instructorId,
                        firstName: constraint.firstName,
                        lastName: constraint.lastName,
                        dayConstraints: [],
                    };
                }

                grouped[instructorId].dayConstraints.push({
                    id: constraint.id,
                    day: constraint.day_of_the_week,
                    timeSlots: constraint.time_period,
                });
            });

            const groupedArray = Object.values(grouped).map((group) => ({
                ...group,
                dayConstraints: group.dayConstraints.sort(
                    (a, b) =>
                        DAYS_OF_WEEK.indexOf(a.day) -
                        DAYS_OF_WEEK.indexOf(b.day)
                ),
            }));

            setGroupedConstraints(groupedArray);
        } else {
            setGroupedConstraints([]);
        }
    }, [timeConstraints]);

    // Calculate pagination values for grouped constraints
    const totalPages = Math.ceil(groupedConstraints.length / ITEMS_PER_PAGE);
    const paginatedGroupedConstraints = groupedConstraints.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Effect to reset form when the add/edit dialog is closed
    useEffect(() => {
        if (!isAddDialogOpen && !isEditDialogOpen) {
            resetForm();
        }
    }, [isAddDialogOpen, isEditDialogOpen]);

    // Effect to fetch all necessary data on component mount
    useEffect(() => {
        fetchInstructors();
        fetchConstraints();
        fetchTimeSlots();
    }, []);

    // Effect to format time slots when apiTimeSlots changes
    useEffect(() => {
        if (apiTimeSlots.length > 0) {
            const formattedTimeSlots = apiTimeSlots.map((slot) => {
                // Format the time slots in the format "HH:MM AM/PM - HH:MM AM/PM"
                const startTime = slot.startTime;
                const endTime = slot.endTime;
                return `${startTime} - ${endTime}`;
            });
            setTimeSlots(formattedTimeSlots);
        }
    }, [apiTimeSlots]);

    // Helper function to format time string
    const formatTime = (timeString: string) => {
        // Parse the time string to create a Date object
        // Assuming timeString is in format "HH:MM:SS"
        const [hours, minutes] = timeString.split(":").map(Number);

        // Convert to 12-hour format with AM/PM
        const period = hours >= 12 ? "PM" : "AM";
        const hours12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM

        return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
    };

    // Fetch instructors from API
    const fetchInstructors = async () => {
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/instructors?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch instructors");
            }
            const data = await response.json();
            setInstructors(data);
        } catch (error) {
            console.error("Error fetching instructors:", error);
            showErrorMessage(
                "Failed to load instructors. Please refresh the page."
            );
        }
    };

    // Fetch time slots from API
    const fetchTimeSlots = async () => {
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/schedule-time-slots?scheduleId=${scheduleId}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch time slots");
            }

            const data = await response.json();

            // FIXED: Extract timeSlots from the response format
            // The API returns an array with an object containing timeSlots
            if (Array.isArray(data) && data.length > 0 && data[0].timeSlots) {
                // Extract the timeSlots array from the first object
                const timeSlotData = data[0].timeSlots;
                setApiTimeSlots(timeSlotData);
            } else {
                console.warn("No time slots found in response:", data);
                setApiTimeSlots([]);
            }
        } catch (error) {
            console.error("Error fetching time slots:", error);
            showErrorMessage(
                "Failed to load time slots. Please refresh the page."
            );
        }
    };

    // Fetch constraints from the API
    const fetchConstraints = async () => {
        setIsLoading(true);
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/time-constraints?scheduleId=${scheduleId}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch constraints");
            }

            const data = await response.json();
            setTimeConstraints(data);
        } catch (error) {
            console.error("Error fetching constraints:", error);
            showErrorMessage(
                "Failed to load constraints. Please refresh the page."
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Handle instructor selection
    const handleInstructorChange = (value: string) => {
        setEnhancedFormData({
            ...enhancedFormData,
            instructor_id: Number.parseInt(value),
        });
    };

    // Handle day selection
    const handleDaySelection = (dayIndex: number, selected: boolean) => {
        const updatedDayConstraints = [...enhancedFormData.dayConstraints];
        updatedDayConstraints[dayIndex].selected = selected;

        setEnhancedFormData({
            ...enhancedFormData,
            dayConstraints: updatedDayConstraints,
        });
    };

    // Toggle time slot for a specific day
    const toggleDayTimeSlot = (dayIndex: number, timeSlot: string) => {
        const updatedDayConstraints = [...enhancedFormData.dayConstraints];
        const dayTimeSlots = updatedDayConstraints[dayIndex].timeSlots;

        if (dayTimeSlots.includes(timeSlot)) {
            updatedDayConstraints[dayIndex].timeSlots = dayTimeSlots.filter(
                (ts) => ts !== timeSlot
            );
        } else {
            updatedDayConstraints[dayIndex].timeSlots = [
                ...dayTimeSlots,
                timeSlot,
            ];
        }

        setEnhancedFormData({
            ...enhancedFormData,
            dayConstraints: updatedDayConstraints,
        });
    };

    // Remove a time slot from a day
    const removeTimeSlot = (dayIndex: number, timeSlot: string) => {
        const updatedDayConstraints = [...enhancedFormData.dayConstraints];
        updatedDayConstraints[dayIndex].timeSlots = updatedDayConstraints[
            dayIndex
        ].timeSlots.filter((ts) => ts !== timeSlot);

        setEnhancedFormData({
            ...enhancedFormData,
            dayConstraints: updatedDayConstraints,
        });
    };

    // Load constraint for edit (single day)
    const loadConstraintForEdit = (
        instructorId: number,
        day: string,
        timeSlots: string[]
    ) => {
        // Keep the existing day constraints but update the selected one
        const updatedDayConstraints = [...enhancedFormData.dayConstraints];
        const dayIndex = updatedDayConstraints.findIndex((d) => d.day === day);

        if (dayIndex !== -1) {
            // Reset all days first
            updatedDayConstraints.forEach((day) => {
                day.selected = false;
                day.timeSlots = [];
            });

            // Update the selected day's info
            updatedDayConstraints[dayIndex] = {
                ...updatedDayConstraints[dayIndex],
                selected: true,
                timeSlots: [...timeSlots],
            };
        }

        setEnhancedFormData({
            instructor_id: instructorId,
            dayConstraints: updatedDayConstraints,
        });
    };

    // Add new constraints
    const handleAddConstraint = async () => {
        const { instructor_id, dayConstraints } = enhancedFormData;

        // Validate form
        if (!instructor_id) {
            showErrorMessage("Please select an instructor");
            return;
        }

        const selectedDays = dayConstraints.filter((dc) => dc.selected);
        if (selectedDays.length === 0) {
            showErrorMessage("Please select at least one day");
            return;
        }

        const hasEmptyTimeSlots = selectedDays.some(
            (day) => day.timeSlots.length === 0
        );
        if (hasEmptyTimeSlots) {
            showErrorMessage("Please select time slots for all selected days");
            return;
        }

        setIsLoading(true);
        try {
            const scheduleId = params.id;
            // Create an array of requests to send to the API
            const requests = selectedDays.map((dayConstraint) => {
                const apiData = {
                    instructorId: instructor_id,
                    day: dayConstraint.day,
                    timeSlots: dayConstraint.timeSlots,
                    scheduleId: Number(scheduleId),
                };

                return fetch("/api/time-constraints", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(apiData),
                });
            });

            // Execute all requests
            const responses = await Promise.all(requests);

            // Check for errors
            for (const response of responses) {
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(
                        errorData.error || "Failed to create constraint"
                    );
                }
            }

            // Refresh the constraints list
            await fetchConstraints();

            // Close dialog and reset form
            setIsAddDialogOpen(false);
            resetForm();

            showSuccessMessage(
                selectedDays.length > 1
                    ? "Constraints added successfully"
                    : "Constraint added successfully"
            );
        } catch (error) {
            console.error("Error adding constraints:", error);
            showSuccessMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to add constraints. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditConstraint = async () => {
        if (!selectedDay) return;

        const { instructor_id, dayConstraints } = enhancedFormData;

        // Find all selected days (now we support multiple in edit mode)
        const selectedDays = dayConstraints.filter((dc) => dc.selected);
        if (selectedDays.length === 0) {
            showErrorMessage("Please select at least one day");
            return;
        }

        // Check if all selected days have time slots
        const hasEmptyTimeSlots = selectedDays.some(
            (day) => day.timeSlots.length === 0
        );
        if (hasEmptyTimeSlots) {
            showErrorMessage("Please select time slots for all selected days");
            return;
        }

        setIsLoading(true);
        try {
            const scheduleId = params.id;

            // First, delete the original constraint
            const deleteData = {
                instructorId: instructor_id,
                day: selectedDay,
                scheduleId: Number(scheduleId),
            };

            const deleteResponse = await fetch("/api/time-constraints", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(deleteData),
            });

            if (!deleteResponse.ok) {
                const errorData = await deleteResponse.json();
                throw new Error(
                    errorData.error ||
                        "Failed to update constraint: could not remove old constraint"
                );
            }

            // Then create new constraints for all selected days
            const createRequests = selectedDays.map((dayConstraint) => {
                const apiData = {
                    instructorId: instructor_id,
                    day: dayConstraint.day,
                    timeSlots: dayConstraint.timeSlots,
                    scheduleId: Number(scheduleId),
                };

                return fetch("/api/time-constraints", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(apiData),
                });
            });

            // Execute all requests
            const responses = await Promise.all(createRequests);

            // Check for errors
            for (const response of responses) {
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(
                        errorData.error ||
                            "Failed to update constraint: could not create new constraints"
                    );
                }
            }

            await fetchConstraints();
            setIsEditDialogOpen(false);
            resetForm();
            setSelectedDay(null);

            showSuccessMessage(
                selectedDays.length > 1
                    ? "Constraints updated successfully"
                    : "Constraint updated successfully"
            );
        } catch (error) {
            console.error("Error updating constraint:", error);
            showSuccessMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to update constraint. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Delete constraint
    const handleDeleteConstraint = async () => {
        if (!selectedGroupedConstraint || !selectedDay) {
            console.error("Missing required data for delete:", {
                selectedGroupedConstraint,
                selectedDay,
            });
            return;
        }

        setIsLoading(true);
        try {
            const scheduleId = params.id;
            const apiData = {
                instructorId: selectedGroupedConstraint.instructor_id,
                day: selectedDay,
                scheduleId: Number(scheduleId),
            };

            console.log("Sending delete request with data:", apiData); // Debug log

            const response = await fetch("/api/time-constraints", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            // Log the response for debugging
            const responseText = await response.text();
            console.log("Delete response:", response.status, responseText);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = JSON.parse(responseText);
                } catch {
                    errorData = {
                        error: `HTTP ${response.status}: ${responseText}`,
                    };
                }
                throw new Error(
                    errorData.error || "Failed to delete constraint"
                );
            }

            // Parse the response
            const result = JSON.parse(responseText);
            console.log("Delete successful:", result);

            // Refresh the constraints list
            await fetchConstraints();

            // Close dialog and reset state
            setIsDeleteDialogOpen(false);
            setSelectedGroupedConstraint(null);
            setSelectedDay(null);

            showSuccessMessage("Constraint deleted successfully");
        } catch (error) {
            console.error("Error deleting constraint:", error);
            showErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to delete constraint. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Reset the form
    const resetForm = () => {
        setEnhancedFormData({
            instructor_id: 0,
            dayConstraints: DAYS_OF_WEEK.map((day) => ({
                day,
                selected: false,
                timeSlots: [],
            })),
        });
        setSelectedConstraint(null);
        setSelectedGroupedConstraint(null);
        setSelectedDay(null);
    };

    // Open edit dialog
    const openEditDialog = (
        instructorId: number,
        day: string,
        timeSlots: string[]
    ) => {
        setSelectedDay(day);
        loadConstraintForEdit(instructorId, day, timeSlots);
        setIsEditDialogOpen(true);
    };

    // Open delete dialog
    const openDeleteDialog = (
        groupedConstraint: GroupedConstraint,
        day: string
    ) => {
        setSelectedGroupedConstraint(groupedConstraint);
        setSelectedDay(day);
        setIsDeleteDialogOpen(true);
    };

    // Check if a time slot is available for a given instructor and day
    const isTimeSlotAvailable = (timeSlot: string, dayName: string) => {
        if (!enhancedFormData.instructor_id || !dayName) {
            return true;
        }

        // For edit mode, exclude the current constraint
        const existingConstraints = timeConstraints.filter((constraint) => {
            // If we're editing a day, exclude that day's constraints
            if (
                selectedDay === constraint.day_of_the_week &&
                constraint.instructor_id === enhancedFormData.instructor_id
            ) {
                return false;
            }

            return (
                constraint.instructor_id === enhancedFormData.instructor_id &&
                constraint.day_of_the_week === dayName
            );
        });

        const usedTimeSlots = existingConstraints.flatMap(
            (constraint) => constraint.time_period
        );

        return !usedTimeSlots.includes(timeSlot);
    };

    // Get count of selected days with time slots
    const getSelectedDaysCount = () => {
        return enhancedFormData.dayConstraints.filter(
            (day) => day.selected && day.timeSlots.length > 0
        ).length;
    };
    const [open, setOpen] = useState(false);

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
            <div className="space-y-4">
                {/* Page Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Time Constraints
                        </h2>
                        <p className="text-xs text-gray-600">
                            Manage instructor availability and time restrictions
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                    >
                        <Plus className="mr-1 h-3 w-3" /> Add Constraint
                    </Button>
                </div>

                {!isLoading && groupedConstraints.length === 0 ? (
                    <div className="bg-white rounded border border-gray-200 p-12 text-center shadow-sm">
                        <div className="text-gray-500 mb-2">
                            No time constraints added yet
                        </div>
                        <div className="text-sm text-gray-400">
                            Add constraints to manage instructor availability.
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paginatedGroupedConstraints.map(
                                (groupedConstraint) => (
                                    <Card
                                        key={groupedConstraint.instructor_id}
                                        className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <CardContent className="p-4">
                                            {/* Instructor header */}
                                            <div className="mb-3 pb-2 border-b border-gray-200">
                                                <h3 className="font-semibold text-sm text-gray-900">
                                                    {
                                                        groupedConstraint.firstName
                                                    }{" "}
                                                    {groupedConstraint.lastName}
                                                </h3>
                                            </div>

                                            {/* Day constraints */}
                                            <div className="space-y-3">
                                                {groupedConstraint.dayConstraints
                                                    .slice()
                                                    .sort(
                                                        (a, b) =>
                                                            DAYS_OF_WEEK.indexOf(
                                                                a.day
                                                            ) -
                                                            DAYS_OF_WEEK.indexOf(
                                                                b.day
                                                            )
                                                    )
                                                    .map((dayConstraint) => (
                                                        <div
                                                            key={`${groupedConstraint.instructor_id}-${dayConstraint.day}`}
                                                            className="flex justify-between items-start p-2 bg-gray-50 rounded border"
                                                        >
                                                            <div className="flex-1">
                                                                <p className="text-xs font-semibold text-gray-700 mb-2">
                                                                    {
                                                                        dayConstraint.day
                                                                    }
                                                                </p>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {dayConstraint.timeSlots.map(
                                                                        (
                                                                            time,
                                                                            index
                                                                        ) => (
                                                                            <Badge
                                                                                key={
                                                                                    index
                                                                                }
                                                                                variant="outline"
                                                                                className="text-xs bg-white border-gray-300"
                                                                            >
                                                                                <Clock className="h-2 w-2 mr-1" />
                                                                                {
                                                                                    time
                                                                                }
                                                                            </Badge>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1 ml-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 text-gray-500 hover:text-[#2F2F85] hover:bg-gray-100"
                                                                    onClick={() =>
                                                                        openEditDialog(
                                                                            groupedConstraint.instructor_id,
                                                                            dayConstraint.day,
                                                                            dayConstraint.timeSlots
                                                                        )
                                                                    }
                                                                >
                                                                    <Pencil className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                                                    onClick={() =>
                                                                        openDeleteDialog(
                                                                            groupedConstraint,
                                                                            dayConstraint.day
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            )}
                        </div>

                        {/* Pagination */}
                        {groupedConstraints.length > 0 && (
                            <div className="flex justify-center">
                                <CustomPagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        )}
                    </>
                )}

                {/* Add Constraint Dialog */}
                {/* Add Constraint Dialog - Complete with improved time slot selection */}
                <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                >
                    <DialogContent className="bg-white max-w-4xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Add Time Constraint
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="instructor_id"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Instructor
                                </Label>
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={open}
                                            className="w-full justify-between border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                        >
                                            {enhancedFormData.instructor_id
                                                ? instructors.find(
                                                      (instructor) =>
                                                          instructor.id ===
                                                          enhancedFormData.instructor_id
                                                  )?.first_name +
                                                  " " +
                                                  instructors.find(
                                                      (instructor) =>
                                                          instructor.id ===
                                                          enhancedFormData.instructor_id
                                                  )?.last_name
                                                : "Select instructor..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-full p-0"
                                        align="start"
                                    >
                                        <Command>
                                            <CommandInput
                                                placeholder="Search instructors..."
                                                className="h-9"
                                            />
                                            <CommandList>
                                                <CommandEmpty>
                                                    No instructor found.
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {instructors.map(
                                                        (instructor) => (
                                                            <CommandItem
                                                                key={
                                                                    instructor.id
                                                                }
                                                                value={`${instructor.first_name} ${instructor.last_name}`}
                                                                onSelect={() => {
                                                                    handleInstructorChange(
                                                                        instructor.id.toString()
                                                                    );
                                                                    setOpen(
                                                                        false
                                                                    );
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        enhancedFormData.instructor_id ===
                                                                            instructor.id
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                {
                                                                    instructor.first_name
                                                                }{" "}
                                                                {
                                                                    instructor.last_name
                                                                }
                                                            </CommandItem>
                                                        )
                                                    )}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Day selection with checkboxes */}
                            {/* Day selection with checkboxes */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">
                                    Days
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {enhancedFormData.dayConstraints.map(
                                        (dayConstraint, index) => (
                                            <div
                                                key={dayConstraint.day}
                                                className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                                                    dayConstraint.selected
                                                        ? "bg-blue-50 border-blue-200 shadow-sm"
                                                        : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                                }`}
                                                onClick={() =>
                                                    handleDaySelection(
                                                        index,
                                                        !dayConstraint.selected
                                                    )
                                                }
                                            >
                                                <Checkbox
                                                    id={`day-${dayConstraint.day}`}
                                                    checked={
                                                        dayConstraint.selected
                                                    }
                                                    onCheckedChange={(
                                                        checked
                                                    ) =>
                                                        handleDaySelection(
                                                            index,
                                                            checked as boolean
                                                        )
                                                    }
                                                />
                                                <label
                                                    htmlFor={`day-${dayConstraint.day}`}
                                                    className="text-sm font-medium text-gray-700 cursor-pointer flex-1"
                                                >
                                                    {dayConstraint.day}
                                                </label>
                                                {dayConstraint.selected && (
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Tabs for each selected day */}
                            {enhancedFormData.dayConstraints.some(
                                (day) => day.selected
                            ) && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Time Slots by Day
                                    </Label>
                                    <Tabs
                                        defaultValue={
                                            enhancedFormData.dayConstraints.find(
                                                (d) => d.selected
                                            )?.day
                                        }
                                    >
                                        <TabsList className="w-full flex overflow-x-auto bg-gray-100">
                                            {enhancedFormData.dayConstraints
                                                .filter((day) => day.selected)
                                                .map((day) => (
                                                    <TabsTrigger
                                                        key={day.day}
                                                        value={day.day}
                                                        className="flex-1 text-xs"
                                                    >
                                                        {day.day}
                                                        {day.timeSlots.length >
                                                            0 && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="ml-1 text-xs"
                                                            >
                                                                {
                                                                    day
                                                                        .timeSlots
                                                                        .length
                                                                }
                                                            </Badge>
                                                        )}
                                                    </TabsTrigger>
                                                ))}
                                        </TabsList>

                                        {enhancedFormData.dayConstraints
                                            .filter((day) => day.selected)
                                            .map((day) => {
                                                const actualDayIndex =
                                                    enhancedFormData.dayConstraints.findIndex(
                                                        (d) => d.day === day.day
                                                    );

                                                return (
                                                    <TabsContent
                                                        key={day.day}
                                                        value={day.day}
                                                        className="mt-2"
                                                    >
                                                        <div className="border border-gray-200 rounded p-3 bg-white">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {timeSlots.map(
                                                                    (slot) => {
                                                                        const isAvailable =
                                                                            isTimeSlotAvailable(
                                                                                slot,
                                                                                day.day
                                                                            );
                                                                        const isSelected =
                                                                            day.timeSlots.includes(
                                                                                slot
                                                                            );
                                                                        const isDisabled =
                                                                            enhancedFormData.instructor_id >
                                                                                0 &&
                                                                            !isAvailable &&
                                                                            !isSelected;

                                                                        return (
                                                                            <div
                                                                                key={
                                                                                    slot
                                                                                }
                                                                                className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                                                                                    isDisabled
                                                                                        ? "bg-gray-100 opacity-60 border-gray-200 cursor-not-allowed"
                                                                                        : isSelected
                                                                                        ? "bg-blue-50 border-blue-200 shadow-sm"
                                                                                        : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                                                                }`}
                                                                                onClick={() =>
                                                                                    !isDisabled &&
                                                                                    toggleDayTimeSlot(
                                                                                        actualDayIndex,
                                                                                        slot
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Checkbox
                                                                                    id={`time-${day.day}-${slot}`}
                                                                                    checked={
                                                                                        isSelected
                                                                                    }
                                                                                    disabled={
                                                                                        !!isDisabled
                                                                                    }
                                                                                    onCheckedChange={() =>
                                                                                        toggleDayTimeSlot(
                                                                                            actualDayIndex,
                                                                                            slot
                                                                                        )
                                                                                    }
                                                                                />
                                                                                <label
                                                                                    htmlFor={`time-${day.day}-${slot}`}
                                                                                    className={`text-sm font-medium cursor-pointer flex-1 ${
                                                                                        isDisabled
                                                                                            ? "text-gray-400"
                                                                                            : "text-gray-700"
                                                                                    }`}
                                                                                >
                                                                                    {
                                                                                        slot
                                                                                    }
                                                                                </label>
                                                                                {isSelected && (
                                                                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }
                                                                )}
                                                            </div>

                                                            {/* Show selected time slots */}
                                                            {day.timeSlots
                                                                .length > 0 && (
                                                                <div className="mt-4 pt-4 border-t border-gray-200">
                                                                    <Label className="text-xs text-gray-600">
                                                                        Selected
                                                                        Time
                                                                        Slots:
                                                                    </Label>
                                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                                        {day.timeSlots.map(
                                                                            (
                                                                                slot,
                                                                                index
                                                                            ) => (
                                                                                <Badge
                                                                                    key={
                                                                                        index
                                                                                    }
                                                                                    className="flex items-center gap-1 pr-1 text-xs bg-[#2F2F85] hover:bg-[#3F3F8F]"
                                                                                >
                                                                                    {
                                                                                        slot
                                                                                    }
                                                                                    <X
                                                                                        className="h-2 w-2 cursor-pointer ml-1 hover:text-red-200"
                                                                                        onClick={() =>
                                                                                            removeTimeSlot(
                                                                                                actualDayIndex,
                                                                                                slot
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </Badge>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TabsContent>
                                                );
                                            })}
                                    </Tabs>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsAddDialogOpen(false);
                                    resetForm();
                                }}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddConstraint}
                                disabled={
                                    isLoading ||
                                    !enhancedFormData.instructor_id ||
                                    getSelectedDaysCount() === 0
                                }
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                            >
                                {isLoading
                                    ? "Adding..."
                                    : `Add Constraint${
                                          getSelectedDaysCount() > 1 ? "s" : ""
                                      }`}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Constraint Dialog */}
                {/* Edit Constraint Dialog - Complete */}
                <Dialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                >
                    <DialogContent className="bg-white max-w-4xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Edit Time Constraint
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-instructor_id"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Instructor
                                </Label>
                                <Select
                                    value={enhancedFormData.instructor_id.toString()}
                                    onValueChange={handleInstructorChange}
                                    disabled={true}
                                >
                                    <SelectTrigger className="border-gray-300 text-sm bg-gray-50">
                                        <SelectValue placeholder="Select instructor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {instructors.map((instructor) => (
                                            <SelectItem
                                                key={instructor.id}
                                                value={instructor.id.toString()}
                                            >
                                                {instructor.first_name}{" "}
                                                {instructor.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Day selection with checkboxes */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">
                                    Days
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 border border-gray-200 rounded p-3 bg-gray-50">
                                    {enhancedFormData.dayConstraints.map(
                                        (dayConstraint, index) => (
                                            <div
                                                key={dayConstraint.day}
                                                className="flex items-center space-x-2"
                                            >
                                                <Checkbox
                                                    id={`edit-day-${dayConstraint.day}`}
                                                    checked={
                                                        dayConstraint.selected
                                                    }
                                                    onCheckedChange={(
                                                        checked
                                                    ) =>
                                                        handleDaySelection(
                                                            index,
                                                            checked as boolean
                                                        )
                                                    }
                                                />
                                                <label
                                                    htmlFor={`edit-day-${dayConstraint.day}`}
                                                    className="text-xs font-medium text-gray-700"
                                                >
                                                    {dayConstraint.day}
                                                </label>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Tabs for each selected day */}
                            {enhancedFormData.dayConstraints.some(
                                (day) => day.selected
                            ) && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Time Slots by Day
                                    </Label>
                                    <Tabs
                                        defaultValue={
                                            enhancedFormData.dayConstraints.find(
                                                (d) => d.selected
                                            )?.day
                                        }
                                    >
                                        <TabsList className="w-full flex overflow-x-auto bg-gray-100">
                                            {enhancedFormData.dayConstraints
                                                .filter((day) => day.selected)
                                                .map((day) => (
                                                    <TabsTrigger
                                                        key={day.day}
                                                        value={day.day}
                                                        className="flex-1 text-xs"
                                                    >
                                                        {day.day}
                                                        {day.timeSlots.length >
                                                            0 && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="ml-1 text-xs"
                                                            >
                                                                {
                                                                    day
                                                                        .timeSlots
                                                                        .length
                                                                }
                                                            </Badge>
                                                        )}
                                                    </TabsTrigger>
                                                ))}
                                        </TabsList>

                                        {enhancedFormData.dayConstraints
                                            .filter((day) => day.selected)
                                            .map((day) => {
                                                const actualDayIndex =
                                                    enhancedFormData.dayConstraints.findIndex(
                                                        (d) => d.day === day.day
                                                    );

                                                return (
                                                    <TabsContent
                                                        key={day.day}
                                                        value={day.day}
                                                        className="mt-2"
                                                    >
                                                        <div className="border border-gray-200 rounded p-3 bg-white">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {timeSlots.map(
                                                                    (slot) => {
                                                                        const isAvailable =
                                                                            isTimeSlotAvailable(
                                                                                slot,
                                                                                day.day
                                                                            );
                                                                        const isSelected =
                                                                            day.timeSlots.includes(
                                                                                slot
                                                                            );
                                                                        const isDisabled =
                                                                            enhancedFormData.instructor_id >
                                                                                0 &&
                                                                            !isAvailable &&
                                                                            !isSelected;

                                                                        return (
                                                                            <div
                                                                                key={
                                                                                    slot
                                                                                }
                                                                                className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                                                                                    isDisabled
                                                                                        ? "bg-gray-100 opacity-60 border-gray-200 cursor-not-allowed"
                                                                                        : isSelected
                                                                                        ? "bg-blue-50 border-blue-200 shadow-sm"
                                                                                        : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                                                                }`}
                                                                                onClick={() =>
                                                                                    !isDisabled &&
                                                                                    toggleDayTimeSlot(
                                                                                        actualDayIndex,
                                                                                        slot
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Checkbox
                                                                                    id={`time-${day.day}-${slot}`}
                                                                                    checked={
                                                                                        isSelected
                                                                                    }
                                                                                    disabled={
                                                                                        !!isDisabled
                                                                                    }
                                                                                    onCheckedChange={() =>
                                                                                        toggleDayTimeSlot(
                                                                                            actualDayIndex,
                                                                                            slot
                                                                                        )
                                                                                    }
                                                                                />
                                                                                <label
                                                                                    htmlFor={`time-${day.day}-${slot}`}
                                                                                    className={`text-sm font-medium cursor-pointer flex-1 ${
                                                                                        isDisabled
                                                                                            ? "text-gray-400"
                                                                                            : "text-gray-700"
                                                                                    }`}
                                                                                >
                                                                                    {
                                                                                        slot
                                                                                    }
                                                                                </label>
                                                                                {isSelected && (
                                                                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }
                                                                )}
                                                            </div>

                                                            {/* Show selected time slots */}
                                                            {day.timeSlots
                                                                .length > 0 && (
                                                                <div className="mt-4 pt-4 border-t border-gray-200">
                                                                    <Label className="text-xs text-gray-600">
                                                                        Selected
                                                                        Time
                                                                        Slots:
                                                                    </Label>
                                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                                        {day.timeSlots.map(
                                                                            (
                                                                                slot,
                                                                                index
                                                                            ) => (
                                                                                <Badge
                                                                                    key={
                                                                                        index
                                                                                    }
                                                                                    className="flex items-center gap-1 pr-1 text-xs bg-[#2F2F85] hover:bg-[#3F3F8F]"
                                                                                >
                                                                                    {
                                                                                        slot
                                                                                    }
                                                                                    <X
                                                                                        className="h-2 w-2 cursor-pointer ml-1 hover:text-red-200"
                                                                                        onClick={() =>
                                                                                            removeTimeSlot(
                                                                                                actualDayIndex,
                                                                                                slot
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </Badge>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TabsContent>
                                                );
                                            })}
                                    </Tabs>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsEditDialogOpen(false);
                                    resetForm();
                                }}
                                disabled={isLoading}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleEditConstraint}
                                disabled={
                                    isLoading ||
                                    !enhancedFormData.instructor_id ||
                                    getSelectedDaysCount() === 0
                                }
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                            >
                                {isLoading ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Constraint Dialog */}
                <Dialog
                    open={isDeleteDialogOpen}
                    onOpenChange={setIsDeleteDialogOpen}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Delete Time Constraint
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Are you sure you want to delete this time
                                constraint?
                            </p>
                            {selectedGroupedConstraint && selectedDay && (
                                <div className="bg-gray-50 p-3 rounded border">
                                    <p className="font-medium text-sm text-gray-900 mb-2">
                                        {selectedGroupedConstraint.firstName}{" "}
                                        {selectedGroupedConstraint.lastName} -{" "}
                                        {selectedDay}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedGroupedConstraint.dayConstraints
                                            .find(
                                                (dc) => dc.day === selectedDay
                                            )
                                            ?.timeSlots.map((time, index) => (
                                                <Badge
                                                    key={index}
                                                    variant="outline"
                                                    className="text-xs"
                                                >
                                                    {time}
                                                </Badge>
                                            ))}
                                    </div>
                                </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                                This action cannot be undone.
                            </p>
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsDeleteDialogOpen(false);
                                    setSelectedGroupedConstraint(null);
                                    setSelectedDay(null);
                                }}
                                disabled={isLoading}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteConstraint}
                                disabled={isLoading}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5"
                            >
                                {isLoading ? "Deleting..." : "Delete"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
