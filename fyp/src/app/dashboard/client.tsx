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
import { BookOpen, Pencil, Plus, Trash, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
        numTimeSlots: 0,
        timeSlots: [] as { startTime: string; endTime: string }[],
    });
    const [isLoading, setIsLoading] = useState(true);

    // Fetch schedules when component mounts
    useEffect(() => {
        fetchSchedules();
    }, []);

    // Update timeSlots array when numTimeSlots changes
    useEffect(() => {
        if (formData.numTimeSlots > formData.timeSlots.length) {
            // Add more timeSlot pairs
            const newTimeSlots = [...formData.timeSlots];
            for (
                let i = formData.timeSlots.length;
                i < formData.numTimeSlots;
                i++
            ) {
                newTimeSlots.push({ startTime: "", endTime: "" });
            }
            setFormData({
                ...formData,
                timeSlots: newTimeSlots,
            });
        } else if (formData.numTimeSlots < formData.timeSlots.length) {
            // Remove excess timeSlot pairs
            setFormData({
                ...formData,
                timeSlots: formData.timeSlots.slice(0, formData.numTimeSlots),
            });
        }
    }, [formData.numTimeSlots]);

    const fetchCourseCount = async (scheduleId: string) => {
        try {
            const response = await fetch(
                `/api/courses?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch courses");
            }
            const data = await response.json();
            return data.length;
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

    const fetchSchedules = async () => {
        setIsLoading(true);
        const userId = authUser.id; // Assuming authUser has an id property
        try {
            const response = await fetch(`/api/schedules?userId=${userId}`);
            if (!response.ok) {
                throw new Error("Failed to fetch schedules");
            }
            const data = await response.json();

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
                        startDate: startDateStr, // Already formatted as "15 Jan, 2025"
                        endDate: endDateStr || startDateStr, // Use endDateStr if available, otherwise use startDateStr
                        courses: courseCount,
                        instructors: instructorCount,
                        timeSlots: schedule.timeSlots || [],
                    };
                })
            );

            setSchedules(processedSchedules);
        } catch (error) {
            console.error("Error fetching schedules:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        if (name === "numTimeSlots") {
            // Allow empty string (when deleting) or valid numbers
            if (value === "") {
                setFormData({
                    ...formData,
                    [name]: 0,
                });
            } else {
                // Parse the number and ensure it's a valid positive integer
                const numValue = parseInt(value);
                // Add maximum limit of 24 time slots
                if (!isNaN(numValue) && numValue >= 0 && numValue <= 24) {
                    setFormData({
                        ...formData,
                        [name]: numValue,
                    });
                }
            }
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }
    };

    const handleTimeSlotChange = (
        index: number,
        field: "startTime" | "endTime",
        value: string
    ) => {
        const updatedTimeSlots = [...formData.timeSlots];
        updatedTimeSlots[index][field] = value;
        setFormData({
            ...formData,
            timeSlots: updatedTimeSlots,
        });
    };

    const resetForm = () => {
        setFormData({
            name: "",
            startDate: "",
            endDate: "",
            numTimeSlots: 0,
            timeSlots: [],
        });
    };

    const openEditDialog = (scheduleId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to schedule detail
        const schedule = schedules.find((s) => s.id === scheduleId);
        if (schedule) {
            setSelectedScheduleId(scheduleId);
            setFormData({
                name: schedule.name,
                startDate: schedule.startDate,
                endDate: schedule.endDate,
                numTimeSlots: schedule.timeSlots?.length || 0,
                timeSlots: schedule.timeSlots || [],
            });
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

    const handleCreateSchedule = async () => {
        try {
            // Prepare data for API
            const apiData = {
                name: formData.name,
                startDate: formData.startDate,
                endDate: formData.endDate,
                numberOfTimeSlots: formData.numTimeSlots,
                timeSlots: formData.timeSlots,
                userId: authUser.id, // Replace with actual user ID
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
                timeSlots: formData.timeSlots,
                userId: authUser.id,
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

    // Generate placeholder based on index
    const getTimePlaceholder = (index: number, isStartTime: boolean) => {
        const baseHour = 8 + index; // Start from 08:00 and increment by 1 hour for each index
        const hour = isStartTime ? baseHour : baseHour + 1; // End time is start time + 1
        return hour < 10 ? `0${hour}:00` : `${hour}:00`; // Format with leading zero if needed
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
                            className="border rounded-md p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => navigateToSchedule(schedule.id)}
                        >
                            <div className="flex items-start justify-between ">
                                <div>
                                    <h2 className="text-lg font-medium">
                                        {schedule.name}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {schedule.startDate}{" "}
                                        {schedule.endDate
                                            ? `- ${schedule.endDate}`
                                            : ""}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) =>
                                            openEditDialog(schedule.id, e)
                                        }
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) =>
                                            openDeleteDialog(schedule.id, e)
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
                                {schedule.timeSlots &&
                                    schedule.timeSlots.length > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <span>
                                                {schedule.timeSlots.length}{" "}
                                                TimeSlots
                                            </span>
                                        </div>
                                    )}
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
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Schedule</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Schedule Name</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Schedule 1"
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
                                    placeholder="5 May 2025"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="endDate">End Date</Label>
                                <Input
                                    id="endDate"
                                    name="endDate"
                                    placeholder="5 May 2026"
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* TimeSlot input */}
                        <div className="space-y-2">
                            <Label htmlFor="numTimeSlots">
                                Number of TimeSlots
                            </Label>
                            <Input
                                id="numTimeSlots"
                                name="numTimeSlots"
                                type="number"
                                min="0"
                                placeholder="Enter number of timeSlots needed"
                                value={formData.numTimeSlots}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Dynamic timeSlot inputs */}
                        {formData.timeSlots.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="font-medium text-sm">
                                    TimeSlots
                                </h3>
                                {formData.timeSlots.map((timeSlot, index) => (
                                    <div
                                        key={index}
                                        className="grid grid-cols-2 gap-4 p-3 border rounded-md"
                                    >
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor={`startTime-${index}`}
                                            >
                                                Start Time #{index + 1}
                                            </Label>
                                            <Input
                                                id={`startTime-${index}`}
                                                placeholder={getTimePlaceholder(
                                                    index,
                                                    true
                                                )}
                                                value={timeSlot.startTime}
                                                onChange={(e) =>
                                                    handleTimeSlotChange(
                                                        index,
                                                        "startTime",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`endTime-${index}`}>
                                                End Time #{index + 1}
                                            </Label>
                                            <Input
                                                id={`endTime-${index}`}
                                                placeholder={getTimePlaceholder(
                                                    index,
                                                    false
                                                )}
                                                value={timeSlot.endTime}
                                                onChange={(e) =>
                                                    handleTimeSlotChange(
                                                        index,
                                                        "endTime",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Schedule</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Schedule Name</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                placeholder="Schedule 1"
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
                                    placeholder="10 May 2025"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-endDate">End Date</Label>
                                <Input
                                    id="edit-endDate"
                                    name="endDate"
                                    placeholder="10 May 2026"
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* TimeSlot input */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-numTimeSlots">
                                Number of TimeSlots
                            </Label>
                            <Input
                                id="edit-numTimeSlots"
                                name="numTimeSlots"
                                type="number"
                                min="0"
                                placeholder="Enter number of timeSlots needed"
                                value={formData.numTimeSlots}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Dynamic timeSlot inputs */}
                        {formData.timeSlots.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="font-medium text-sm">
                                    TimeSlots
                                </h3>
                                {formData.timeSlots.map((timeSlot, index) => (
                                    <div
                                        key={index}
                                        className="grid grid-cols-2 gap-4 p-3 border rounded-md"
                                    >
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor={`edit-startTime-${index}`}
                                            >
                                                Start Time #{index + 1}
                                            </Label>
                                            <Input
                                                id={`edit-startTime-${index}`}
                                                placeholder={getTimePlaceholder(
                                                    index,
                                                    true
                                                )}
                                                value={timeSlot.startTime}
                                                onChange={(e) =>
                                                    handleTimeSlotChange(
                                                        index,
                                                        "startTime",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor={`edit-endTime-${index}`}
                                            >
                                                End Time #{index + 1}
                                            </Label>
                                            <Input
                                                id={`edit-endTime-${index}`}
                                                placeholder={getTimePlaceholder(
                                                    index,
                                                    false
                                                )}
                                                value={timeSlot.endTime}
                                                onChange={(e) =>
                                                    handleTimeSlotChange(
                                                        index,
                                                        "endTime",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
