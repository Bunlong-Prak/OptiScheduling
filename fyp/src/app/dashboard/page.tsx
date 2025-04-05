"use client";

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
import { BookOpen, Pencil, Plus, Trash, Users } from "lucide-react";
import { useEffect, useState } from "react";

// Type definitions
type Schedule = {
    id: string;
    name: string;
    createdOn: string;
    courses: number;
    instructors: number;
    startDate: string;
    endDate: string;
};

export default function Dashboard() {
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
    });
    const [isLoading, setIsLoading] = useState(true);

    // Fetch schedules when component mounts
    useEffect(() => {
        fetchSchedules();
    }, []);

    const fetchSchedules = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/schedules");
            if (!response.ok) {
                throw new Error("Failed to fetch schedules");
            }
            const data = await response.json();
            setSchedules(
                data.map((schedule) => {
                    // Split the academic_year string into start and end dates
                    const [startDateStr, endDateStr] =
                        schedule.academic_year.split(" - ");

                    return {
                        id: schedule.id.toString(),
                        name: schedule.name,
                        startDate: startDateStr, // Already formatted as "15 Jan, 2025"
                        endDate: endDateStr, // Already formatted as "25 May, 2026"
                    };
                })
            );
        } catch (error) {
            console.error("Error fetching schedules:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const resetForm = () => {
        setFormData({
            name: "",
            startDate: "",
            endDate: "",
        });
    };

    const openEditDialog = (scheduleId: string) => {
        const schedule = schedules.find((s) => s.id === scheduleId);
        if (schedule) {
            setSelectedScheduleId(scheduleId);
            setFormData({
                name: schedule.name,
                startDate: schedule.startDate,
                endDate: schedule.endDate,
            });
            setIsEditDialogOpen(true);
        }
    };

    const openDeleteDialog = (scheduleId: string) => {
        setSelectedScheduleId(scheduleId);
        setIsDeleteDialogOpen(true);
    };

    const handleCreateSchedule = async () => {
        try {
            // Prepare data for API
            const apiData = {
                name: formData.name,
                startDate: formData.startDate,
                endDate: formData.endDate,
                userId: "1", // Replace with actual user ID
            };

            const response = await fetch("/api/schedules", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                throw new Error("Failed to create schedule");
            }

            // Refresh the schedules list
            await fetchSchedules();

            // Close dialog and reset form
            setIsCreateDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error creating schedule:", error);
        }
    };

    const handleEditSchedule = async () => {
        if (!selectedScheduleId) return;

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
                userId: "1", // Replace with actual user ID
            };

            console.log("Sending update data:", apiData);

            const response = await fetch("/api/schedules", {
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
                    responseData.error || "Failed to update schedule"
                );
            }

            console.log("Update successful:", responseData);

            await fetchSchedules();
            setIsEditDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error updating schedule:", error);
        }
    };

    const handleDeleteSchedule = async () => {
        if (!selectedScheduleId) return;

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

            if (!response.ok) {
                throw new Error("Failed to delete schedule");
            }

            // Refresh the schedule list
            await fetchSchedules();

            // Close dialog
            setIsDeleteDialogOpen(false);
            setSelectedScheduleId(null);
        } catch (error) {
            console.error("Error deleting schedule:", error);
        }
    };

    return (
        <div className="space-y-6 max-w-full">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Schedules</h1>
                <Button
                    className=""
                    onClick={() => {
                        resetForm();
                        setIsCreateDialogOpen(true);
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" /> New Schedule
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center p-8">Loading schedules...</div>
            ) : (
                <div className="space-y-4">
                    {schedules.map((schedule) => (
                        <div
                            key={schedule.id}
                            className="border rounded-md p-4 "
                        >
                            <div className="flex items-start justify-between ">
                                <div>
                                    <h2 className="text-lg font-medium">
                                        {schedule.name}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {schedule.startDate} -{" "}
                                        {schedule.endDate}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                            openEditDialog(schedule.id)
                                        }
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                            openDeleteDialog(schedule.id)
                                        }
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-6">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <BookOpen className="h-4 w-4" />
                                    <span>{schedule.courses} Courses</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Users className="h-4 w-4" />
                                    <span>
                                        {schedule.instructors} Instructors
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {schedules.length === 0 && (
                        <div className="text-center p-8 text-gray-500">
                            No schedules found. Create a new schedule to get
                            started.
                        </div>
                    )}
                </div>
            )}

            {/* Create Schedule Dialog */}
            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Schedule</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Schedule Name</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="e.g., Schedule 1 2025-2026"
                                value={formData.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date</Label>
                                <Input
                                    id="startDate"
                                    name="startDate"
                                    placeholder="e.g., Jan 5, 2025"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="endDate">End Date</Label>
                                <Input
                                    id="endDate"
                                    name="endDate"
                                    placeholder="e.g., May 15, 2025"
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsCreateDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleCreateSchedule}>
                            Create Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Schedule Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Schedule</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Schedule Name</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                placeholder="e.g., Schedule 1 2025-2026"
                                value={formData.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-startDate">
                                    Start Date
                                </Label>
                                <Input
                                    id="edit-startDate"
                                    name="startDate"
                                    placeholder="e.g., Jan 5, 2025"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-endDate">End Date</Label>
                                <Input
                                    id="edit-endDate"
                                    name="endDate"
                                    placeholder="e.g., May 15, 2025"
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsEditDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleEditSchedule}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Schedule Dialog */}
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this schedule? This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteSchedule}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
