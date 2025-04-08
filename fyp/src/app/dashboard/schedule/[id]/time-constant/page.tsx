"use client";

import type {
    Instructor,
    TimeConstraint,
    TimeConstraintFormData,
} from "@/app/types";
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

// Define default time slots if the API call fails
const DEFAULT_TIME_SLOTS = [
    "8:00 AM - 9:00 AM",
    "9:00 AM - 10:00 AM",
    "10:00 AM - 11:00 AM",
    "11:00 AM - 12:00 PM",
    "12:00 PM - 1:00 PM",
    "1:00 PM - 2:00 PM",
    "2:00 PM - 3:00 PM",
    "3:00 PM - 4:00 PM",
    "4:00 PM - 5:00 PM",
    "5:00 PM - 6:00 PM",
];

// Days of the week
const DAYS_OF_WEEK = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

export default function TimeConstraintView() {
    const [timeConstraints, setTimeConstraints] = useState<TimeConstraint[]>(
        []
    );
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedConstraint, setSelectedConstraint] =
        useState<TimeConstraint | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({
        text: "",
        type: "", // "success", "error", "info"
    });
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [timeSlots, setTimeSlots] = useState(DEFAULT_TIME_SLOTS);
    const params = useParams();

    // New state for enhanced form with multiple days
    const [enhancedFormData, setEnhancedFormData] = useState({
        instructor_id: 0,
        dayConstraints: DAYS_OF_WEEK.map((day) => ({
            day,
            selected: false,
            timeSlots: [] as string[],
        })),
    });

    // Calculate pagination values
    const totalPages = Math.ceil(timeConstraints.length / ITEMS_PER_PAGE);
    const paginatedConstraints = timeConstraints.slice(
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
    }, []);

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

            // Clear any status messages after successful fetch
            if (statusMessage.text) {
                setTimeout(() => {
                    setStatusMessage({ text: "", type: "" });
                }, 3000); // Clear message after 3 seconds
            }
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

    const loadConstraintForEdit = (constraint: TimeConstraint) => {
        // Keep the existing day constraints but update the selected one
        const updatedDayConstraints = [...enhancedFormData.dayConstraints];
        const dayIndex = updatedDayConstraints.findIndex(
            (day) => day.day === constraint.day_of_the_week
        );

        if (dayIndex !== -1) {
            // Update the selected day's info
            updatedDayConstraints[dayIndex] = {
                ...updatedDayConstraints[dayIndex],
                selected: true,
                timeSlots: [...constraint.time_period],
            };
        }

        setEnhancedFormData({
            instructor_id: constraint.instructor_id,
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
                    throw new Error("Failed to create constraint");
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
                text: "Failed to add constraints. Please try again.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditConstraint = async () => {
        if (!selectedConstraint) return;

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
                instructorId: selectedConstraint.instructor_id,
                day: selectedConstraint.day_of_the_week,
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
                throw new Error(
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
                    throw new Error(
                        "Failed to update constraint: could not create new constraints"
                    );
                }
            }

            await fetchConstraints();
            setIsEditDialogOpen(false);
            resetForm();

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
        if (!selectedConstraint) return;

        setIsLoading(true);
        try {
            const scheduleId = params.id;
            const apiData = {
                instructorId: selectedConstraint.instructor_id,
                day: selectedConstraint.day_of_the_week,
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
                throw new Error("Failed to delete constraint");
            }

            await fetchConstraints();
            setIsDeleteDialogOpen(false);
            setSelectedConstraint(null);

            setStatusMessage({
                text: "Constraint deleted successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error deleting constraint:", error);
            setStatusMessage({
                text: "Failed to delete constraint. Please try again.",
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
    };

    // Open edit dialog
    const openEditDialog = (constraint: TimeConstraint) => {
        setSelectedConstraint(constraint);
        loadConstraintForEdit(constraint);
        setIsEditDialogOpen(true);
    };

    // Open delete dialog
    const openDeleteDialog = (constraint: TimeConstraint) => {
        setSelectedConstraint(constraint);
        setIsDeleteDialogOpen(true);
    };

    // Get instructor name by ID
    const getInstructorName = (instructorId: number) => {
        const instructor = instructors.find((i) => i.id === instructorId);
        return instructor
            ? `${instructor.first_name} ${instructor.last_name}`
            : "Unknown";
    };

    // Check if a time slot is available for a given instructor and day
    const isTimeSlotAvailable = (timeSlot: string, dayName: string) => {
        if (!enhancedFormData.instructor_id || !dayName) {
            return true;
        }

        // For edit mode, exclude the current constraint from checking
        const existingConstraints = timeConstraints.filter((constraint) => {
            if (selectedConstraint && constraint.id === selectedConstraint.id) {
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
                className={`status-message ${
                    statusMessage.type
                } p-3 mb-4 rounded-md ${
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

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Time Constraints</h2>
                <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Constraint
                </Button>
            </div>

            {/* Display status message */}
            <StatusMessageDisplay />

            {/* Display loading state */}
            {isLoading && (
                <div className="text-center p-4">
                    <p>Loading...</p>
                </div>
            )}

            {!isLoading && timeConstraints.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                    No time constraints added yet
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedConstraints.map((constraint) => (
                            <Card key={constraint.id}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold">
                                                {getInstructorName(
                                                    constraint.instructor_id
                                                )}
                                            </h3>
                                            <p className="text-sm text-gray-600 font-medium mt-1">
                                                {constraint.day_of_the_week}
                                            </p>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {constraint.time_period?.map(
                                                    (time, index) => (
                                                        <Badge
                                                            key={index}
                                                            variant="outline"
                                                            className="text-xs flex items-center"
                                                        >
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            {time}
                                                        </Badge>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    openEditDialog(constraint)
                                                }
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    openDeleteDialog(constraint)
                                                }
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Add pagination if there are items to display */}
                    {timeConstraints.length > 0 && (
                        <div className="mt-6">
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
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Add Time Constraint</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="instructor_id">Instructor</Label>
                            <Select
                                value={
                                    enhancedFormData.instructor_id
                                        ? enhancedFormData.instructor_id.toString()
                                        : ""
                                }
                                onValueChange={handleInstructorChange}
                            >
                                <SelectTrigger>
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
                            <Label>Days</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 border rounded-md p-3">
                                {enhancedFormData.dayConstraints.map(
                                    (dayConstraint, index) => (
                                        <div
                                            key={dayConstraint.day}
                                            className="flex items-center space-x-2"
                                        >
                                            <Checkbox
                                                id={`day-${dayConstraint.day}`}
                                                checked={dayConstraint.selected}
                                                onCheckedChange={(checked) =>
                                                    handleDaySelection(
                                                        index,
                                                        checked as boolean
                                                    )
                                                }
                                            />
                                            <label
                                                htmlFor={`day-${dayConstraint.day}`}
                                                className="text-sm"
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
                                <Label>Time Slots by Day</Label>
                                <Tabs
                                    defaultValue={
                                        enhancedFormData.dayConstraints.find(
                                            (d) => d.selected
                                        )?.day
                                    }
                                >
                                    <TabsList className="w-full flex overflow-x-auto">
                                        {enhancedFormData.dayConstraints
                                            .filter((day) => day.selected)
                                            .map((day) => (
                                                <TabsTrigger
                                                    key={day.day}
                                                    value={day.day}
                                                    className="flex-1"
                                                >
                                                    {day.day}
                                                    {day.timeSlots.length >
                                                        0 && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="ml-2"
                                                        >
                                                            {
                                                                day.timeSlots
                                                                    .length
                                                            }
                                                        </Badge>
                                                    )}
                                                </TabsTrigger>
                                            ))}
                                    </TabsList>

                                    {enhancedFormData.dayConstraints
                                        .filter((day) => day.selected)
                                        .map((day, dayIndex) => {
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
                                                    <div className="border rounded-md p-3">
                                                        <div className="grid grid-cols-2 gap-2">
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
                                                                            className={`flex items-center space-x-2 p-2 rounded ${
                                                                                isDisabled
                                                                                    ? "bg-gray-100 opacity-60"
                                                                                    : isSelected
                                                                                    ? "bg-blue-50"
                                                                                    : ""
                                                                            }`}
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
                                                                                className={`text-sm ${
                                                                                    isDisabled
                                                                                        ? "text-gray-400"
                                                                                        : ""
                                                                                }`}
                                                                            >
                                                                                {
                                                                                    slot
                                                                                }
                                                                            </label>
                                                                        </div>
                                                                    );
                                                                }
                                                            )}
                                                        </div>

                                                        {/* Show selected time slots */}
                                                        {day.timeSlots.length >
                                                            0 && (
                                                            <div className="mt-4">
                                                                <Label className="text-sm text-gray-500">
                                                                    Selected
                                                                    Time Slots:
                                                                </Label>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {day.timeSlots.map(
                                                                        (
                                                                            slot,
                                                                            index
                                                                        ) => (
                                                                            <Badge
                                                                                key={
                                                                                    index
                                                                                }
                                                                                className="flex items-center gap-1 pr-1"
                                                                            >
                                                                                {
                                                                                    slot
                                                                                }
                                                                                <X
                                                                                    className="h-3 w-3 cursor-pointer ml-1"
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

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsAddDialogOpen(false);
                                resetForm();
                            }}
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
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Edit Time Constraint</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-instructor_id">
                                Instructor
                            </Label>
                            <Select
                                value={enhancedFormData.instructor_id.toString()}
                                onValueChange={handleInstructorChange}
                            >
                                <SelectTrigger>
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

                        {/* Day selection with checkboxes - just like in Add dialog */}
                        <div className="space-y-2">
                            <Label>Days</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 border rounded-md p-3">
                                {enhancedFormData.dayConstraints.map(
                                    (dayConstraint, index) => (
                                        <div
                                            key={dayConstraint.day}
                                            className="flex items-center space-x-2"
                                        >
                                            <Checkbox
                                                id={`edit-day-${dayConstraint.day}`}
                                                checked={dayConstraint.selected}
                                                onCheckedChange={(checked) =>
                                                    handleDaySelection(
                                                        index,
                                                        checked as boolean
                                                    )
                                                }
                                            />
                                            <label
                                                htmlFor={`edit-day-${dayConstraint.day}`}
                                                className="text-sm"
                                            >
                                                {dayConstraint.day}
                                            </label>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Tabs for each selected day - just like in Add dialog */}
                        {enhancedFormData.dayConstraints.some(
                            (day) => day.selected
                        ) && (
                            <div className="space-y-2">
                                <Label>Time Slots by Day</Label>
                                <Tabs
                                    defaultValue={
                                        enhancedFormData.dayConstraints.find(
                                            (d) => d.selected
                                        )?.day
                                    }
                                >
                                    <TabsList className="w-full flex overflow-x-auto">
                                        {enhancedFormData.dayConstraints
                                            .filter((day) => day.selected)
                                            .map((day) => (
                                                <TabsTrigger
                                                    key={day.day}
                                                    value={day.day}
                                                    className="flex-1"
                                                >
                                                    {day.day}
                                                    {day.timeSlots.length >
                                                        0 && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="ml-2"
                                                        >
                                                            {
                                                                day.timeSlots
                                                                    .length
                                                            }
                                                        </Badge>
                                                    )}
                                                </TabsTrigger>
                                            ))}
                                    </TabsList>

                                    {enhancedFormData.dayConstraints
                                        .filter((day) => day.selected)
                                        .map((day, dayIndex) => {
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
                                                    <div className="border rounded-md p-3">
                                                        <div className="grid grid-cols-2 gap-2">
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
                                                                            className={`flex items-center space-x-2 p-2 rounded ${
                                                                                isDisabled
                                                                                    ? "bg-gray-100 opacity-60"
                                                                                    : isSelected
                                                                                    ? "bg-blue-50"
                                                                                    : ""
                                                                            }`}
                                                                        >
                                                                            <Checkbox
                                                                                id={`edit-time-${day.day}-${slot}`}
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
                                                                                htmlFor={`edit-time-${day.day}-${slot}`}
                                                                                className={`text-sm ${
                                                                                    isDisabled
                                                                                        ? "text-gray-400"
                                                                                        : ""
                                                                                }`}
                                                                            >
                                                                                {
                                                                                    slot
                                                                                }
                                                                            </label>
                                                                        </div>
                                                                    );
                                                                }
                                                            )}
                                                        </div>

                                                        {/* Show selected time slots */}
                                                        {day.timeSlots.length >
                                                            0 && (
                                                            <div className="mt-4">
                                                                <Label className="text-sm text-gray-500">
                                                                    Selected
                                                                    Time Slots:
                                                                </Label>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {day.timeSlots.map(
                                                                        (
                                                                            slot,
                                                                            index
                                                                        ) => (
                                                                            <Badge
                                                                                key={
                                                                                    index
                                                                                }
                                                                                className="flex items-center gap-1 pr-1"
                                                                            >
                                                                                {
                                                                                    slot
                                                                                }
                                                                                <X
                                                                                    className="h-3 w-3 cursor-pointer ml-1"
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

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsEditDialogOpen(false);
                                resetForm();
                            }}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleEditConstraint}
                            disabled={
                                isLoading ||
                                !enhancedFormData.instructor_id ||
                                !selectedConstraint ||
                                getSelectedDaysCount() === 0
                            }
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Time Constraint</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>
                            Are you sure you want to delete this time
                            constraint?
                        </p>
                        {selectedConstraint && (
                            <div>
                                <p className="font-medium mt-2">
                                    {getInstructorName(
                                        selectedConstraint.instructor_id
                                    )}{" "}
                                    - {selectedConstraint.day_of_the_week}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {selectedConstraint.time_period.map(
                                        (time, index) => (
                                            <Badge
                                                key={index}
                                                variant="outline"
                                            >
                                                {time}
                                            </Badge>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConstraint}
                            disabled={isLoading}
                        >
                            {isLoading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
