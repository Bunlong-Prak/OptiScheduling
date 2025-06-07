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
import { Clock, Pencil, Plus, Trash, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
    const [statusMessage, setStatusMessage] = useState({
        text: "",
        type: "", // "success", "error", "info"
    });
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [timeSlots, setTimeSlots] = useState<string[]>([]);
    const [apiTimeSlots, setApiTimeSlots] = useState<TimeSlot[]>([]);
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

    // Effect to clear status message after a delay
    useEffect(() => {
        if (statusMessage.text) {
            const timer = setTimeout(() => {
                setStatusMessage({ text: "", type: "" });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

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
            setStatusMessage({
                text: "Failed to load instructors. Please refresh the page.",
                type: "error",
            });
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
            setStatusMessage({
                text: "Failed to load time slots. Please refresh the page.",
                type: "error",
            });
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
            setStatusMessage({
                text: "Failed to load constraints. Please refresh the page.",
                type: "error",
            });
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
            setStatusMessage({
                text: "Please select an instructor",
                type: "error",
            });
            return;
        }

        const selectedDays = dayConstraints.filter((dc) => dc.selected);
        if (selectedDays.length === 0) {
            setStatusMessage({
                text: "Please select at least one day",
                type: "error",
            });
            return;
        }

        const hasEmptyTimeSlots = selectedDays.some(
            (day) => day.timeSlots.length === 0
        );
        if (hasEmptyTimeSlots) {
            setStatusMessage({
                text: "Please select time slots for all selected days",
                type: "error",
            });
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

            setStatusMessage({
                text:
                    selectedDays.length > 1
                        ? "Constraints added successfully"
                        : "Constraint added successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error adding constraints:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to add constraints. Please try again.",
                type: "error",
            });
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
            setStatusMessage({
                text: "Please select at least one day",
                type: "error",
            });
            return;
        }

        // Check if all selected days have time slots
        const hasEmptyTimeSlots = selectedDays.some(
            (day) => day.timeSlots.length === 0
        );
        if (hasEmptyTimeSlots) {
            setStatusMessage({
                text: "Please select time slots for all selected days",
                type: "error",
            });
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

            setStatusMessage({
                text:
                    selectedDays.length > 1
                        ? "Constraints updated successfully"
                        : "Constraint updated successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error updating constraint:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to update constraint. Please try again.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Delete constraint
    const handleDeleteConstraint = async () => {
        if (!selectedGroupedConstraint || !selectedDay) return;

        setIsLoading(true);
        try {
            const scheduleId = params.id;
            const apiData = {
                instructorId: selectedGroupedConstraint.instructor_id,
                day: selectedDay,
                scheduleId: Number(scheduleId),
            };

            const response = await fetch("/api/time-constraints", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to delete constraint"
                );
            }

            await fetchConstraints();
            setIsDeleteDialogOpen(false);
            setSelectedGroupedConstraint(null);
            setSelectedDay(null);

            setStatusMessage({
                text: "Constraint deleted successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error deleting constraint:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete constraint. Please try again.",
                type: "error",
            });
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

    // Status message component
    const StatusMessageDisplay = () => {
        if (!statusMessage.text) return null;

        return (
            <div
                className={`status-message p-3 mb-4 rounded-md ${
                    statusMessage.type === "success"
                        ? "bg-green-100 text-green-700"
                        : statusMessage.type === "error"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                }`}
            >
                {statusMessage.text}
            </div>
        );
    };

    // Get count of selected days with time slots
    const getSelectedDaysCount = () => {
        return enhancedFormData.dayConstraints.filter(
            (day) => day.selected && day.timeSlots.length > 0
        ).length;
    };

    // Rest of the component...

    return (
        <div className="space-y-4">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Time Constraints</h2>
                    <p className="text-xs text-gray-600">Manage instructor availability and time restrictions</p>
                </div>
                <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                >
                    <Plus className="mr-1 h-3 w-3" /> Add Constraint
                </Button>
            </div>
    
            {/* Display status message */}
            <StatusMessageDisplay />
    
            {!isLoading && groupedConstraints.length === 0 ? (
                <div className="bg-white rounded border border-gray-200 p-12 text-center shadow-sm">
                    <div className="text-gray-500 mb-2">No time constraints added yet</div>
                    <div className="text-sm text-gray-400">Add constraints to manage instructor availability.</div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedGroupedConstraints.map((groupedConstraint) => (
                            <Card
                                key={groupedConstraint.instructor_id}
                                className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <CardContent className="p-4">
                                    {/* Instructor header */}
                                    <div className="mb-3 pb-2 border-b border-gray-200">
                                        <h3 className="font-semibold text-sm text-gray-900">
                                            {groupedConstraint.firstName} {groupedConstraint.lastName}
                                        </h3>
                                    </div>
    
                                    {/* Day constraints */}
                                    <div className="space-y-3">
                                        {groupedConstraint.dayConstraints
                                            .slice()
                                            .sort(
                                                (a, b) =>
                                                    DAYS_OF_WEEK.indexOf(a.day) -
                                                    DAYS_OF_WEEK.indexOf(b.day)
                                            )
                                            .map((dayConstraint) => (
                                                <div
                                                    key={`${groupedConstraint.instructor_id}-${dayConstraint.day}`}
                                                    className="flex justify-between items-start p-2 bg-gray-50 rounded border"
                                                >
                                                    <div className="flex-1">
                                                        <p className="text-xs font-semibold text-gray-700 mb-2">
                                                            {dayConstraint.day}
                                                        </p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {dayConstraint.timeSlots.map((time, index) => (
                                                                <Badge
                                                                    key={index}
                                                                    variant="outline"
                                                                    className="text-xs bg-white border-gray-300"
                                                                >
                                                                    <Clock className="h-2 w-2 mr-1" />
                                                                    {time}
                                                                </Badge>
                                                            ))}
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
                        ))}
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
<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
    <DialogContent className="bg-white max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b border-gray-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-gray-900">Add Time Constraint</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="instructor_id" className="text-sm font-medium text-gray-700">Instructor</Label>
                <Select
                    value={
                        enhancedFormData.instructor_id
                            ? enhancedFormData.instructor_id.toString()
                            : ""
                    }
                    onValueChange={handleInstructorChange}
                >
                    <SelectTrigger className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm">
                        <SelectValue placeholder="Select instructor" />
                    </SelectTrigger>
                    <SelectContent>
                        {instructors.map((instructor) => (
                            <SelectItem
                                key={instructor.id}
                                value={instructor.id.toString()}
                            >
                                {instructor.first_name} {instructor.last_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Day selection with checkboxes */}
            <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Days</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 border border-gray-200 rounded p-3 bg-gray-50">
                    {enhancedFormData.dayConstraints.map((dayConstraint, index) => (
                        <div
                            key={dayConstraint.day}
                            className="flex items-center space-x-2"
                        >
                            <Checkbox
                                id={`day-${dayConstraint.day}`}
                                checked={dayConstraint.selected}
                                onCheckedChange={(checked) =>
                                    handleDaySelection(index, checked as boolean)
                                }
                            />
                            <label
                                htmlFor={`day-${dayConstraint.day}`}
                                className="text-xs font-medium text-gray-700"
                            >
                                {dayConstraint.day}
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs for each selected day */}
            {enhancedFormData.dayConstraints.some((day) => day.selected) && (
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Time Slots by Day</Label>
                    <Tabs
                        defaultValue={
                            enhancedFormData.dayConstraints.find((d) => d.selected)?.day
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
                                        {day.timeSlots.length > 0 && (
                                            <Badge
                                                variant="secondary"
                                                className="ml-1 text-xs"
                                            >
                                                {day.timeSlots.length}
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
                                                {timeSlots.map((slot) => {
                                                    const isAvailable = isTimeSlotAvailable(slot, day.day);
                                                    const isSelected = day.timeSlots.includes(slot);
                                                    const isDisabled =
                                                        enhancedFormData.instructor_id > 0 &&
                                                        !isAvailable &&
                                                        !isSelected;

                                                    return (
                                                        <div
                                                            key={slot}
                                                            className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                                                                isDisabled
                                                                    ? "bg-gray-100 opacity-60 border-gray-200 cursor-not-allowed"
                                                                    : isSelected
                                                                    ? "bg-blue-50 border-blue-200 shadow-sm"
                                                                    : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                                            }`}
                                                            onClick={() => !isDisabled && toggleDayTimeSlot(actualDayIndex, slot)}
                                                        >
                                                            <Checkbox
                                                                id={`time-${day.day}-${slot}`}
                                                                checked={isSelected}
                                                                disabled={!!isDisabled}
                                                                onCheckedChange={() =>
                                                                    toggleDayTimeSlot(actualDayIndex, slot)
                                                                }
                                                            />
                                                            <label
                                                                htmlFor={`time-${day.day}-${slot}`}
                                                                className={`text-sm font-medium cursor-pointer flex-1 ${
                                                                    isDisabled ? "text-gray-400" : "text-gray-700"
                                                                }`}
                                                            >
                                                                {slot}
                                                            </label>
                                                            {isSelected && (
                                                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Show selected time slots */}
                                            {day.timeSlots.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-gray-200">
                                                    <Label className="text-xs text-gray-600">
                                                        Selected Time Slots:
                                                    </Label>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {day.timeSlots.map((slot, index) => (
                                                            <Badge
                                                                key={index}
                                                                className="flex items-center gap-1 pr-1 text-xs bg-[#2F2F85] hover:bg-[#3F3F8F]"
                                                            >
                                                                {slot}
                                                                <X
                                                                    className="h-2 w-2 cursor-pointer ml-1 hover:text-red-200"
                                                                    onClick={() =>
                                                                        removeTimeSlot(actualDayIndex, slot)
                                                                    }
                                                                />
                                                            </Badge>
                                                        ))}
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
                    : `Add Constraint${getSelectedDaysCount() > 1 ? "s" : ""}`}
            </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
            {/* Edit Constraint Dialog */}
          {/* Edit Constraint Dialog - Complete */}
<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
    <DialogContent className="bg-white max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b border-gray-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-gray-900">Edit Time Constraint</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="edit-instructor_id" className="text-sm font-medium text-gray-700">
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
                                {instructor.first_name} {instructor.last_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Day selection with checkboxes */}
            <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Days</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 border border-gray-200 rounded p-3 bg-gray-50">
                    {enhancedFormData.dayConstraints.map((dayConstraint, index) => (
                        <div
                            key={dayConstraint.day}
                            className="flex items-center space-x-2"
                        >
                            <Checkbox
                                id={`edit-day-${dayConstraint.day}`}
                                checked={dayConstraint.selected}
                                onCheckedChange={(checked) =>
                                    handleDaySelection(index, checked as boolean)
                                }
                            />
                            <label
                                htmlFor={`edit-day-${dayConstraint.day}`}
                                className="text-xs font-medium text-gray-700"
                            >
                                {dayConstraint.day}
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs for each selected day */}
            {enhancedFormData.dayConstraints.some((day) => day.selected) && (
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Time Slots by Day</Label>
                    <Tabs
                        defaultValue={
                            enhancedFormData.dayConstraints.find((d) => d.selected)?.day
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
                                        {day.timeSlots.length > 0 && (
                                            <Badge
                                                variant="secondary"
                                                className="ml-1 text-xs"
                                            >
                                                {day.timeSlots.length}
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
        {timeSlots.map((slot) => {
            const isAvailable = isTimeSlotAvailable(slot, day.day);
            const isSelected = day.timeSlots.includes(slot);
            const isDisabled =
                enhancedFormData.instructor_id > 0 &&
                !isAvailable &&
                !isSelected;

            return (
                <div
                    key={slot}
                    className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        isDisabled
                            ? "bg-gray-100 opacity-60 border-gray-200 cursor-not-allowed"
                            : isSelected
                            ? "bg-blue-50 border-blue-200 shadow-sm"
                            : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                    onClick={() => !isDisabled && toggleDayTimeSlot(actualDayIndex, slot)}
                >
                    <Checkbox
                        id={`time-${day.day}-${slot}`}
                        checked={isSelected}
                        disabled={!!isDisabled}
                        onCheckedChange={() =>
                            toggleDayTimeSlot(actualDayIndex, slot)
                        }
                    />
                    <label
                        htmlFor={`time-${day.day}-${slot}`}
                        className={`text-sm font-medium cursor-pointer flex-1 ${
                            isDisabled ? "text-gray-400" : "text-gray-700"
                        }`}
                    >
                        {slot}
                    </label>
                    {isSelected && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                </div>
            );
        })}
    </div>

    {/* Show selected time slots */}
    {day.timeSlots.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
            <Label className="text-xs text-gray-600">
                Selected Time Slots:
            </Label>
            <div className="flex flex-wrap gap-1 mt-2">
                {day.timeSlots.map((slot, index) => (
                    <Badge
                        key={index}
                        className="flex items-center gap-1 pr-1 text-xs bg-[#2F2F85] hover:bg-[#3F3F8F]"
                    >
                        {slot}
                        <X
                            className="h-2 w-2 cursor-pointer ml-1 hover:text-red-200"
                            onClick={() =>
                                removeTimeSlot(actualDayIndex, slot)
                            }
                        />
                    </Badge>
                ))}
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
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="bg-white max-w-md">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">Delete Time Constraint</DialogTitle>
                    </DialogHeader>
    
                    <div className="py-4">
                        <p className="text-sm text-gray-600 mb-2">
                            Are you sure you want to delete this time constraint?
                        </p>
                        {selectedGroupedConstraint && selectedDay && (
                            <div className="bg-gray-50 p-3 rounded border">
                                <p className="font-medium text-sm text-gray-900 mb-2">
                                    {selectedGroupedConstraint.firstName} {selectedGroupedConstraint.lastName} - {selectedDay}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {selectedGroupedConstraint.dayConstraints
                                        .find((dc) => dc.day === selectedDay)
                                        ?.timeSlots.map((time, index) => (
                                            <Badge key={index} variant="outline" className="text-xs">
                                                {time}
                                            </Badge>
                                        ))}
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">This action cannot be undone.</p>
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
    );
}
