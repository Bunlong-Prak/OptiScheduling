"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Plus, Trash } from "lucide-react";
import type {
    TimeConstraint,
    TimeConstraintFormData,
    Instructor,
} from "../../../types";
import CustomPagination from "@/components/custom/pagination"; // Import the pagination component

// Mock data for time slots and days
const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];
const timeSlots = [
    "8:00 - 9:30",
    "9:45 - 11:15",
    "11:30 - 1:00",
    "1:15 - 2:45",
    "3:00 - 4:30",
    "4:45 - 6:15",
];

// Mock data for instructors
const instructors: Instructor[] = [
    {
        id: 1,
        first_name: "Flordeliza P.",
        last_name: "PONCIO",
        gender: "Female",
        email: "flordeliza.poncio@paragon.edu.kh",
        phone_number: "012-345-678",
    },
    {
        id: 2,
        first_name: "Abdulkasim",
        last_name: "Akhmedov",
        gender: "Male",
        email: "abdulkasim.akhmedov@paragon.edu.kh",
        phone_number: "012-345-679",
    },
    {
        id: 3,
        first_name: "Nora",
        last_name: "Patron",
        gender: "Female",
        email: "nora.patron@paragon.edu.kh",
        phone_number: "012-345-680",
    },
];

// Mock data for time constraints - added more to demonstrate pagination
const initialTimeConstraints: TimeConstraint[] = [
    {
        id: 1,
        instructor_id: 1,
        day_of_the_week: "Monday",
        time_period: ["8:00 - 9:30"],
    },
    {
        id: 2,
        instructor_id: 2,
        day_of_the_week: "Wednesday",
        time_period: ["1:15 - 2:45"],
    },
    {
        id: 3,
        instructor_id: 3,
        day_of_the_week: "Friday",
        time_period: ["4:45 - 6:15"],
    },
    {
        id: 4,
        instructor_id: 1,
        day_of_the_week: "Tuesday",
        time_period: ["9:45 - 11:15"],
    },
    {
        id: 5,
        instructor_id: 2,
        day_of_the_week: "Thursday",
        time_period: ["3:00 - 4:30"],
    },
    {
        id: 6,
        instructor_id: 3,
        day_of_the_week: "Monday",
        time_period: ["11:30 - 1:00"],
    },
    {
        id: 7,
        instructor_id: 1,
        day_of_the_week: "Wednesday",
        time_period: ["8:00 - 9:30"],
    },
    {
        id: 8,
        instructor_id: 2,
        day_of_the_week: "Friday",
        time_period: ["9:45 - 11:15"],
    },
    {
        id: 9,
        instructor_id: 3,
        day_of_the_week: "Tuesday",
        time_period: ["1:15 - 2:45"],
    },
];

// Define how many items to show per page
const ITEMS_PER_PAGE = 6;

export function TimeConstraintView() {
    const [timeConstraints, setTimeConstraints] = useState<TimeConstraint[]>(
        initialTimeConstraints
    );
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedConstraint, setSelectedConstraint] =
        useState<TimeConstraint | null>(null);
    const [formData, setFormData] = useState<TimeConstraintFormData>({
        day_of_the_week: "",
        time_period: [],
        instructor_id: 0,
    });
    const [currentPage, setCurrentPage] = useState(1);

    // Calculate pagination values
    const totalPages = Math.ceil(timeConstraints.length / ITEMS_PER_PAGE);
    const paginatedConstraints = timeConstraints.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleSelectChange = (name: string, value: string) => {
        if (name === "instructor_id") {
            setFormData({
                ...formData,
                [name]: Number.parseInt(value),
            });
        } else if (name === "time_period") {
            setFormData({
                ...formData,
                [name]: [value],
            });
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }
    };

    const handleAddConstraint = () => {
        const newConstraint: TimeConstraint = {
            id: Math.max(0, ...timeConstraints.map((c) => c.id)) + 1,
            instructor_id: formData.instructor_id,
            day_of_the_week: formData.day_of_the_week,
            time_period: formData.time_period,
        };

        setTimeConstraints([...timeConstraints, newConstraint]);
        setIsAddDialogOpen(false);
        resetForm();
    };

    const handleEditConstraint = () => {
        if (!selectedConstraint) return;

        const updatedConstraints = timeConstraints.map((constraint) => {
            if (constraint.id === selectedConstraint.id) {
                return {
                    ...constraint,
                    instructor_id: formData.instructor_id,
                    day_of_the_week: formData.day_of_the_week,
                    time_period: formData.time_period,
                };
            }
            return constraint;
        });

        setTimeConstraints(updatedConstraints);
        setIsEditDialogOpen(false);
        resetForm();
    };

    const handleDeleteConstraint = () => {
        if (!selectedConstraint) return;

        const updatedConstraints = timeConstraints.filter(
            (constraint) => constraint.id !== selectedConstraint.id
        );
        setTimeConstraints(updatedConstraints);
        setIsDeleteDialogOpen(false);

        // Check if we need to adjust the current page after deletion
        if (
            updatedConstraints.length > 0 &&
            currentPage > Math.ceil(updatedConstraints.length / ITEMS_PER_PAGE)
        ) {
            setCurrentPage(
                Math.ceil(updatedConstraints.length / ITEMS_PER_PAGE)
            );
        }
    };

    const resetForm = () => {
        setFormData({
            day_of_the_week: "",
            time_period: [],
            instructor_id: 0,
        });
        setSelectedConstraint(null);
    };

    const openEditDialog = (constraint: TimeConstraint) => {
        setSelectedConstraint(constraint);
        setFormData({
            day_of_the_week: constraint.day_of_the_week,
            time_period: constraint.time_period,
            instructor_id: constraint.instructor_id,
        });
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

            {timeConstraints.length === 0 ? (
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
                                            <p className="text-sm text-gray-500">
                                                {constraint.day_of_the_week},{" "}
                                                {constraint.time_period.join(
                                                    ", "
                                                )}
                                            </p>
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

                    {/* Add pagination if there are more items than fit on a page */}
                    {timeConstraints.length > ITEMS_PER_PAGE && (
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Time Constraint</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="instructor_id">Instructor</Label>
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
                            <Label htmlFor="day_of_the_week">Day</Label>
                            <Select
                                value={formData.day_of_the_week}
                                onValueChange={(value) =>
                                    handleSelectChange("day_of_the_week", value)
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

                        <div className="space-y-2">
                            <Label htmlFor="time_period">Time Slot</Label>
                            <Select
                                value={formData.time_period[0] || ""}
                                onValueChange={(value) =>
                                    handleSelectChange("time_period", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select time slot" />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeSlots.map((slot) => (
                                        <SelectItem key={slot} value={slot}>
                                            {slot}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsAddDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleAddConstraint}>
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
                            <Label htmlFor="edit-day_of_the_week">Day</Label>
                            <Select
                                value={formData.day_of_the_week}
                                onValueChange={(value) =>
                                    handleSelectChange("day_of_the_week", value)
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

                        <div className="space-y-2">
                            <Label htmlFor="edit-time_period">Time Slot</Label>
                            <Select
                                value={formData.time_period[0] || ""}
                                onValueChange={(value) =>
                                    handleSelectChange("time_period", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select time slot" />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeSlots.map((slot) => (
                                        <SelectItem key={slot} value={slot}>
                                            {slot}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsEditDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleEditConstraint}>
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
                            <p className="font-medium mt-2">
                                {getInstructorName(
                                    selectedConstraint.instructor_id
                                )}{" "}
                                - {selectedConstraint.day_of_the_week},{" "}
                                {selectedConstraint.time_period.join(", ")}
                            </p>
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
