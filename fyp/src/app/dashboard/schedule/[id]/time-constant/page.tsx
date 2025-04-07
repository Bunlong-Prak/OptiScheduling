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

export default function TimeConstraintView() {
    const [timeConstraints, setTimeConstraints] = useState<TimeConstraint[]>(
        []
    );
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedConstraint, setSelectedConstraint] =
        useState<TimeConstraint | null>(null);
    const [formData, setFormData] = useState<TimeConstraintFormData>({
        day: "",
        time_slots: [],
        instructor_id: 0,
    });
    const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
   
    const [statusMessage, setStatusMessage] = useState({
        text: "",
        type: "", // "success", "error", "info"
    });
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [days] = useState([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ]);
    const [timeSlots, setTimeSlots] = useState(DEFAULT_TIME_SLOTS);

    // Calculate pagination values
    const totalPages = Math.ceil(timeConstraints.length / ITEMS_PER_PAGE);
    const paginatedConstraints = timeConstraints.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Effect to sync selected time slots with formData
    useEffect(() => {
        if (selectedConstraint) {
            setSelectedTimeSlots(selectedConstraint.time_period);
        }
    }, [selectedConstraint]);
    const params = useParams();
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

    // Reset form when the add dialog is closed
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

    const handleSelectChange = (name: string, value: string) => {
        if (name === "instructor_id") {
            setFormData({
                ...formData,
                [name]: Number.parseInt(value),
            });
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }
    };

    const toggleTimeSlot = (timeSlot: string) => {
        setSelectedTimeSlots((prev) => {
            if (prev.includes(timeSlot)) {
                return prev.filter((ts) => ts !== timeSlot);
            } else {
                return [...prev, timeSlot];
            }
        });
    };

    const updateFormTimeSlots = () => {
        setFormData({
            ...formData,
            time_slots: selectedTimeSlots,
        });
    };

    // Update form data whenever selected time slots change
    useEffect(() => {
        updateFormTimeSlots();
    }, [selectedTimeSlots]);
    // Fetch constraints from the API
    const fetchConstraints = async () => {
       
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
        } 
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

    const handleAddConstraint = async () => {
        if (
            !formData.day ||
            formData.time_slots.length === 0 ||
            !formData.instructor_id
        ) {
            setStatusMessage({
                text: "Please fill in all required fields",
                type: "error",
            });
            return;
        }

        
        try {
            const scheduleId = params.id;
            // Prepare data for API
            const apiData = {
                instructorId: formData.instructor_id,
                day: formData.day,
                timeSlots: formData.time_slots,
                scheduleId: Number(scheduleId),
            };

            const response = await fetch("/api/time-constraints", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                throw new Error("Failed to create constraint");
            }

            // Refresh the constraints list
            await fetchConstraints();

            // Close dialog and reset form
            setIsAddDialogOpen(false);
            resetForm();

            setStatusMessage({
                text: "Constraint added successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error adding constraint:", error);
            setStatusMessage({
                text: "Failed to add constraint. Please try again.",
                type: "error",
            });
        } 
    };

    const handleEditConstraint = async () => {
        if (!selectedConstraint) return;

       
        try {
            const apiData = {
                instructorId: formData.instructor_id,
                day: formData.day,
                timeSlots: formData.time_slots,
            };

            console.log("Sending update data:", apiData);

            const response = await fetch("/api/time-constraints", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error("Update failed:", responseData);
                throw new Error(
                    responseData.error || "Failed to update constraint"
                );
            }

            console.log("Update successful:", responseData);

            await fetchConstraints();
            setIsEditDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Constraint updated successfully",
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
        }
    };

    const handleDeleteConstraint = async () => {
        if (!selectedConstraint) return;

        try {
            const apiData = {
                instructorId: selectedConstraint.instructor_id,
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

            // Refresh the constraints list
            await fetchConstraints();

            // Close dialog
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
        } 
    };

    const resetForm = () => {
        setFormData({
            day: "",
            time_slots: [],
            instructor_id: 0,
        });
        setSelectedTimeSlots([]);
        setSelectedConstraint(null);
    };

    const openEditDialog = (constraint: TimeConstraint) => {
        setSelectedConstraint(constraint);
        setFormData({
            day: constraint.day_of_the_week, // Map from existing field
            time_slots: constraint.time_period, // Map from existing field
            instructor_id: constraint.instructor_id,
        });
        setSelectedTimeSlots(constraint.time_period);
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (constraint: TimeConstraint) => {
        setSelectedConstraint(constraint);
        setIsDeleteDialogOpen(true);
    };

    const getInstructorName = (instructorId: number) => {
        const instructor = instructors.find((i) => i.id === instructorId);
        return instructor
            ? `${instructor.first_name} ${instructor.last_name}`
            : "Unknown";
    };

    // Get existing time slots for an instructor on a specific day
    const getInstructorTimeSlots = (instructorId: number, day: string) => {
        const constraints = timeConstraints.filter(
            (constraint) =>
                constraint.instructor_id === instructorId &&
                constraint.day_of_the_week === day
        );
        return constraints.flatMap((constraint) => constraint.time_period);
    };

    // Check if a time slot is already assigned for the selected instructor and day
    const isTimeSlotAvailable = (timeSlot: string) => {
        if (!formData.instructor_id || !formData.day) {
            return true;
        }

        // For edit mode, exclude the current constraint from checking
        const existingConstraints = timeConstraints.filter((constraint) => {
            if (selectedConstraint && constraint.id === selectedConstraint.id) {
                return false;
            }
            return (
                constraint.instructor_id === formData.instructor_id &&
                constraint.day_of_the_week === formData.day // Using the new field name
            );
        });

        const usedTimeSlots = existingConstraints.flatMap(
            (constraint) => constraint.time_period
        );
        return !usedTimeSlots.includes(timeSlot);
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
     

            {/* Add Constraint Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Time Constraint</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="instructor_id">Instructor</Label>
                            <Select
                                value={
                                    formData.instructor_id
                                        ? formData.instructor_id.toString()
                                        : ""
                                }
                                onValueChange={(value) =>
                                    handleSelectChange("instructor_id", value)
                                }
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

                        <div className="space-y-2">
                            <Label htmlFor="day">Day</Label>
                            <Select
                                value={formData.day}
                                onValueChange={(value) =>
                                    handleSelectChange("day", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                                <SelectContent>
                                    {days.map((day) => (
                                        <SelectItem key={day} value={day}>
                                            {day}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Time Slots Selection with Checkboxes - Always show this section */}
                        <div className="space-y-3">
                            <Label>Time Slots</Label>
                            <div className="border rounded-md p-3">
                                <div className="grid grid-cols-2 gap-2">
                                    {timeSlots.map((slot) => {
                                        const isAvailable =
                                            isTimeSlotAvailable(slot);
                                        const isSelected =
                                            selectedTimeSlots.includes(slot);
                                        const isDisabled =
                                            formData.instructor_id > 0 &&
                                            formData.day &&
                                            !isAvailable &&
                                            !isSelected;

                                        return (
                                            <div
                                                key={slot}
                                                className={`flex items-center space-x-2 p-2 rounded ${
                                                    isDisabled
                                                        ? "bg-gray-100 opacity-60"
                                                        : isSelected
                                                        ? "bg-blue-50"
                                                        : ""
                                                }`}
                                            >
                                                <Checkbox
                                                    id={`time-${slot}`}
                                                    checked={isSelected}
                                                    disabled={!!isDisabled}
                                                    onCheckedChange={() =>
                                                        toggleTimeSlot(slot)
                                                    }
                                                />
                                                <label
                                                    htmlFor={`time-${slot}`}
                                                    className={`text-sm ${
                                                        isDisabled
                                                            ? "text-gray-400"
                                                            : ""
                                                    }`}
                                                >
                                                    {slot}
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Show selected time slots */}
                        {selectedTimeSlots.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-sm text-gray-500">
                                    Selected Time Slots:
                                </Label>
                                <div className="flex flex-wrap gap-1">
                                    {selectedTimeSlots.map((slot, index) => (
                                        <Badge
                                            key={index}
                                            className="flex items-center gap-1 pr-1"
                                        >
                                            {slot}
                                            <X
                                                className="h-3 w-3 cursor-pointer ml-1"
                                                onClick={() =>
                                                    toggleTimeSlot(slot)
                                                }
                                            />
                                        </Badge>
                                    ))}
                                </div>
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
                                !formData.day ||
                                selectedTimeSlots.length === 0 ||
                                !formData.instructor_id
                            }
                        >
                            Add Constraint
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Constraint Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Time Constraint</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-instructor_id">
                                Instructor
                            </Label>
                            <Select
                                value={formData.instructor_id.toString()}
                                onValueChange={(value) =>
                                    handleSelectChange("instructor_id", value)
                                }
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

                        <div className="space-y-2">
                            <Label htmlFor="edit-day">Day</Label>
                            <Select
                                value={formData.day}
                                onValueChange={(value) =>
                                    handleSelectChange("day", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                                <SelectContent>
                                    {days.map((day) => (
                                        <SelectItem key={day} value={day}>
                                            {day}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Time Slots Selection with Checkboxes - Always show this section */}
                        <div className="space-y-3">
                            <Label>Time Slots</Label>
                            <div className="border rounded-md p-3">
                                <div className="grid grid-cols-2 gap-2">
                                    {timeSlots.map((slot) => {
                                        const isAvailable =
                                            isTimeSlotAvailable(slot);
                                        const isSelected =
                                            selectedTimeSlots.includes(slot);
                                        const isDisabled =
                                            formData.instructor_id > 0 &&
                                            formData.day &&
                                            !isAvailable &&
                                            !isSelected;

                                        return (
                                            <div
                                                key={slot}
                                                className={`flex items-center space-x-2 p-2 rounded ${
                                                    isDisabled
                                                        ? "bg-gray-100 opacity-60"
                                                        : isSelected
                                                        ? "bg-blue-50"
                                                        : ""
                                                }`}
                                            >
                                                <Checkbox
                                                    id={`edit-time-${slot}`}
                                                    checked={isSelected}
                                                    disabled={!!isDisabled}
                                                    onCheckedChange={() =>
                                                        toggleTimeSlot(slot)
                                                    }
                                                />
                                                <label
                                                    htmlFor={`edit-time-${slot}`}
                                                    className={`text-sm ${
                                                        isDisabled
                                                            ? "text-gray-400"
                                                            : ""
                                                    }`}
                                                >
                                                    {slot}
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Show selected time slots */}
                        {selectedTimeSlots.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-sm text-gray-500">
                                    Selected Time Slots:
                                </Label>
                                <div className="flex flex-wrap gap-1">
                                    {selectedTimeSlots.map((slot, index) => (
                                        <Badge
                                            key={index}
                                            className="flex items-center gap-1 pr-1"
                                        >
                                            {slot}
                                            <X
                                                className="h-3 w-3 cursor-pointer ml-1"
                                                onClick={() =>
                                                    toggleTimeSlot(slot)
                                                }
                                            />
                                        </Badge>
                                    ))}
                                </div>
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
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleEditConstraint}
                            disabled={
                                !formData.day ||
                                selectedTimeSlots.length === 0 ||
                                !formData.instructor_id
                            }
                        >
                            Save Changes
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
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConstraint}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
