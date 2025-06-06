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
        return hour < 10 ? `${hour}` : `${hour}`; // Format with leading zero if needed
    };

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Schedules</h1>
                        <p className="text-sm text-gray-600 mt-1">Manage your academic schedules and time slots</p>
                    </div>
                    <Button
                        className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white px-6 py-2.5 rounded font-medium transition-colors"
                        onClick={() => {
                            resetForm();
                            setIsCreateDialogOpen(true);
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Schedule
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
                    <div className="text-gray-600">Loading schedules...</div>
                </div>
            ) : (
                <div className="space-y-4">
                    {schedules.map((schedule) => (
                        <div
                            key={schedule.id}
                            className="bg-white border border-gray-200 rounded-lg p-6 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
                            onClick={() => navigateToSchedule(schedule.id)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                                        {schedule.name}
                                    </h2>
                                    <p className="text-sm text-gray-600 mb-4">
                                        {schedule.startDate}{" "}
                                        {schedule.endDate
                                            ? `- ${schedule.endDate}`
                                            : ""}
                                    </p>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-gray-500 hover:text-[#2F2F85] hover:bg-blue-50"
                                        onClick={(e) =>
                                            openEditDialog(schedule.id, e)
                                        }
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={(e) =>
                                            openDeleteDialog(schedule.id, e)
                                        }
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center gap-8 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <BookOpen className="h-4 w-4 text-teal-600" />
                                    <span className="font-medium">{schedule.courses}</span>
                                    <span>Courses</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Users className="h-4 w-4 text-purple-600" />
                                    <span className="font-medium">{schedule.instructors}</span>
                                    <span>Instructors</span>
                                </div>
                                {schedule.timeSlots &&
                                    schedule.timeSlots.length > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                                                <span className="text-white text-xs">⏰</span>
                                            </span>
                                            <span className="font-medium">{schedule.timeSlots.length}</span>
                                            <span>TimeSlots</span>
                                        </div>
                                    )}
                            </div>
                        </div>
                    ))}

                    {schedules.length === 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
                            <div className="text-gray-500 mb-2">No schedules found</div>
                            <div className="text-sm text-gray-400">Create a new schedule to get started.</div>
                        </div>
                    )}
                </div>
            )}

            {/* Create Schedule Dialog */}
            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
            >
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white">
                    <DialogHeader className="border-b border-gray-200 pb-4">
                        <DialogTitle className="text-xl font-semibold text-gray-900">Create New Schedule</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-6 py-6">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium text-gray-700">Schedule Name</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Schedule 1"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:border-[#2F2F85]"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">Start Date</Label>
                                <Input
                                    id="startDate"
                                    name="startDate"
                                    placeholder="5 May 2025"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:border-[#2F2F85]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="endDate" className="text-sm font-medium text-gray-700">End Date</Label>
                                <Input
                                    id="endDate"
                                    name="endDate"
                                    placeholder="5 May 2026"
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                                />
                            </div>
                        </div>

                        {/* TimeSlot input */}
                        <div className="space-y-2">
                            <Label htmlFor="numTimeSlots" className="text-sm font-medium text-gray-700">
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
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                            />
                        </div>

                        {/* Dynamic timeSlot inputs */}
                        {formData.timeSlots.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">
                                    TimeSlots Configuration
                                </h3>
                                {formData.timeSlots.map((timeSlot, index) => (
                                    <div
                                        key={index}
                                        className="grid grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50"
                                    >
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor={`startTime-${index}`}
                                                className="text-sm font-medium text-gray-700"
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
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`endTime-${index}`} className="text-sm font-medium text-gray-700">
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
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="border-t border-gray-200 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setIsCreateDialogOpen(false)}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleCreateSchedule}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white"
                        >
                            Create Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Schedule Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white">
                    <DialogHeader className="border-b border-gray-200 pb-4">
                        <DialogTitle className="text-xl font-semibold text-gray-900">Edit Schedule</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-6 py-6">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">Schedule Name</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                placeholder="Schedule 1"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-startDate" className="text-sm font-medium text-gray-700">
                                    Start Date
                                </Label>
                                <Input
                                    id="edit-startDate"
                                    name="startDate"
                                    placeholder="10 May 2025"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-endDate" className="text-sm font-medium text-gray-700">End Date</Label>
                                <Input
                                    id="edit-endDate"
                                    name="endDate"
                                    placeholder="10 May 2026"
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                                />
                            </div>
                        </div>

                        {/* TimeSlot input */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-numTimeSlots" className="text-sm font-medium text-gray-700">
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
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                            />
                        </div>

                        {/* Dynamic timeSlot inputs */}
                        {formData.timeSlots.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">
                                    TimeSlots Configuration
                                </h3>
                                {formData.timeSlots.map((timeSlot, index) => (
                                    <div
                                        key={index}
                                        className="grid grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50"
                                    >
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor={`edit-startTime-${index}`}
                                                className="text-sm font-medium text-gray-700"
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
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor={`edit-endTime-${index}`}
                                                className="text-sm font-medium text-gray-700"
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
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="border-t border-gray-200 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setIsEditDialogOpen(false)}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleEditSchedule}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white"
                        >
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
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold text-gray-900">Delete Schedule</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600">
                            Are you sure you want to delete this schedule? This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteSchedule}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}