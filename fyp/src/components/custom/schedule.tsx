"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, Pencil, Plus, Trash, Users } from "lucide-react";
// import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// Define types
interface Schedule {
    id: string;
    name: string;
    createdOn: string;
    courses: number;
    instructors: number;
    startDate: string;
    endDate: string;
    academicYear?: string;
}

export default function Dashboard() {
    // State management
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        startDate: "",
        endDate: "",
        academicYear: "",
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // User ID (would come from authentication in a real app)
    const userId = "1";

    // FETCH - Get all schedules
    const fetchSchedules = async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const response = await fetch(`/api/schedules?userId=${userId}`);
            
            if (!response.ok) {
                throw new Error("Failed to fetch schedules");
            }
            
            const data = await response.json();
            setSchedules(data);
            setSuccessMessage(`${data.length} schedules loaded successfully.`);
            
            // Clear success message after 3 seconds
            setTimeout(() => {
                setSuccessMessage(null);
            }, 3000);
        } catch (err) {
            console.error("Error fetching schedules:", err);
            setError("Failed to load schedules. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch schedules on component mount
    useEffect(() => {
        fetchSchedules();
    }, []);

    // Clear messages after timeout
    useEffect(() => {
        const timeout = setTimeout(() => {
            setSuccessMessage(null);
            setError(null);
        }, 3000);
        
        return () => clearTimeout(timeout);
    }, [successMessage, error]);

    // Form input handler
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    // CREATE - Add new schedule
    const handleCreateSchedule = async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            // Extract academic year from name or use the specific field
            const academicYear = formData.academicYear || 
                formData.name.match(/\d{4}-\d{4}/)?.toString() || 
                `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
            
            // Create new schedule payload
            const scheduleData = {
                name: formData.name,
                academicYear: academicYear,
                userId: userId,
                startDate: formData.startDate,
                endDate: formData.endDate,
            };

            const response = await fetch("/api/schedules", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(scheduleData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create schedule");
            }

            // Show success message
            setSuccessMessage("Schedule created successfully!");

            // Refresh schedules list after creating
            await fetchSchedules();
            
            // Close dialog and reset form
            setIsCreateDialogOpen(false);
            resetForm();
        } catch (err) {
            console.error("Error creating schedule:", err);
            setError("Failed to create schedule. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // UPDATE - Edit existing schedule
    const handleUpdateSchedule = async () => {
        if (!selectedSchedule) return;
        
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const updateData = {
                id: selectedSchedule.id,
                name: formData.name,
                academicYear: formData.academicYear || selectedSchedule.academicYear,
                startDate: formData.startDate,
                endDate: formData.endDate,
            };

            const response = await fetch("/api/schedules", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update schedule");
            }

            // Show success message
            setSuccessMessage("Schedule updated successfully!");

            // Update local state
            setSchedules(schedules.map(schedule => 
                schedule.id === selectedSchedule.id 
                    ? { 
                        ...schedule, 
                        name: formData.name,
                        startDate: formData.startDate,
                        endDate: formData.endDate,
                        academicYear: formData.academicYear || schedule.academicYear
                      } 
                    : schedule
            ));
            
            // Close dialog and reset form
            setIsEditDialogOpen(false);
            resetForm();
        } catch (err) {
            console.error("Error updating schedule:", err);
            setError("Failed to update schedule. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // DELETE - Remove a schedule
    const handleDeleteSchedule = async () => {
        if (!selectedSchedule) return;

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const response = await fetch("/api/schedules", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id: selectedSchedule.id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete schedule");
            }

            // Show success message
            setSuccessMessage("Schedule deleted successfully!");

            // Update local state to avoid refetching
            setSchedules(schedules.filter(schedule => schedule.id !== selectedSchedule.id));
            
            // Close dialog and reset selection
            setIsDeleteDialogOpen(false);
            setSelectedSchedule(null);
        } catch (err) {
            console.error("Error deleting schedule:", err);
            setError("Failed to delete schedule. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Reset form data
    const resetForm = () => {
        setFormData({
            name: "",
            startDate: "",
            endDate: "",
            academicYear: "",
        });
        setSelectedSchedule(null);
    };

    // Open edit dialog and populate form
    const openEditDialog = (schedule: Schedule) => {
        setSelectedSchedule(schedule);
        setFormData({
            name: schedule.name,
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            academicYear: schedule.academicYear || "",
        });
        setIsEditDialogOpen(true);
    };

    // Open delete confirmation dialog
    const openDeleteDialog = (schedule: Schedule) => {
        setSelectedSchedule(schedule);
        setIsDeleteDialogOpen(true);
    };

    return (
        <div className="space-y-6 max-w-full">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Schedules</h1>
                <Button
                    className=""
                    onClick={() => setIsCreateDialogOpen(true)}
                    disabled={isLoading}
                >
                    <Plus className="mr-2 h-4 w-4" /> New Schedule
                </Button>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                    {successMessage}
                </div>
            )}

            <div className="space-y-4">
                {isLoading && schedules.length === 0 ? (
                    <div className="text-center py-8">Loading schedules...</div>
                ) : schedules.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                        No schedules found. Create a new schedule to get started.
                    </div>
                ) : (
                    schedules.map((schedule) => (
                        <div key={schedule.id} className="border rounded-md p-4 ">
                            <div className="flex items-start justify-between ">
                                <div>
                                    <h2 className="text-lg font-medium">
                                        {schedule.name}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        Created On {schedule.createdOn}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {schedule.startDate} - {schedule.endDate}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openEditDialog(schedule)}
                                        disabled={isLoading}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openDeleteDialog(schedule)}
                                        disabled={isLoading}
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
                                    <span>{schedule.instructors} Instructors</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

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

                        <div className="space-y-2">
                            <Label htmlFor="academicYear">Academic Year</Label>
                            <Input
                                id="academicYear"
                                name="academicYear"
                                placeholder="e.g., 2025-2026"
                                value={formData.academicYear}
                                onChange={handleInputChange}
                            />
                            <p className="text-xs text-gray-500">
                                If left empty, academic year will be extracted from the schedule name or set to current year
                            </p>
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
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleCreateSchedule}
                            disabled={isLoading || !formData.name}
                        >
                            {isLoading ? "Creating..." : "Create Schedule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Schedule Dialog */}
            <Dialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
            >
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
                                value={formData.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-academicYear">Academic Year</Label>
                            <Input
                                id="edit-academicYear"
                                name="academicYear"
                                value={formData.academicYear}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-startDate">Start Date</Label>
                                <Input
                                    id="edit-startDate"
                                    name="startDate"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-endDate">End Date</Label>
                                <Input
                                    id="edit-endDate"
                                    name="endDate"
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
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleUpdateSchedule}
                            disabled={isLoading || !formData.name}
                        >
                            {isLoading ? "Saving..." : "Save Changes"}
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
                        <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteSchedule}
                            className="bg-red-500 hover:bg-red-600"
                            disabled={isLoading}
                        >
                            {isLoading ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}