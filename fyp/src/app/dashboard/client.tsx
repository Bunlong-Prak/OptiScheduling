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
        numTimeSlots: "" as string | number,
        timeSlots: [] as { startTime: string; endTime: string }[],
    });

    // Persistent state to store all time slot values
    const [persistentTimeSlots, setPersistentTimeSlots] = useState<
        { startTime: string; endTime: string }[]
    >([]);
    const [isLoading, setIsLoading] = useState(true);

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
    }, [formData.numTimeSlots, persistentTimeSlots]);

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
                if (!isNaN(numValue) && numValue >= 0 && numValue <= 24) {
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
            numTimeSlots: "",
            timeSlots: [],
        });
        setPersistentTimeSlots([]);
    };

    const openEditDialog = (scheduleId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to schedule detail
        const schedule = schedules.find((s) => s.id === scheduleId);
        if (schedule) {
            setSelectedScheduleId(scheduleId);
            const timeSlots = schedule.timeSlots || [];
            setFormData({
                name: schedule.name,
                startDate: formatDateForInput(schedule.startDate),
                endDate: formatDateForInput(schedule.endDate),
                numTimeSlots: timeSlots.length,
                timeSlots: timeSlots,
            });
            setPersistentTimeSlots([...timeSlots]);
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

    const validateTimeSlots = (): boolean => {
        // Validate date range
        if (formData.startDate && formData.endDate) {
            const startDate = new Date(formData.startDate);
            const endDate = new Date(formData.endDate);

            if (endDate < startDate) {
                alert("End date cannot be before start date.");
                return false;
            }
        }

        // Validate time slots
        for (let i = 0; i < formData.timeSlots.length; i++) {
            const { startTime, endTime } = formData.timeSlots[i];

            if (startTime && !isCompleteTimeFormat(startTime)) {
                alert(
                    `Please enter a valid start time in HH:MM format for time slot ${
                        i + 1
                    }`
                );
                return false;
            }

            if (endTime && !isCompleteTimeFormat(endTime)) {
                alert(
                    `Please enter a valid end time in HH:MM format for time slot ${
                        i + 1
                    }`
                );
                return false;
            }

            // Check if both times are provided
            if ((startTime && !endTime) || (!startTime && endTime)) {
                alert(
                    `Please provide both start and end times for time slot ${
                        i + 1
                    }`
                );
                return false;
            }

            // Check if end time is after start time
            if (startTime && endTime) {
                const [startHour, startMin] = startTime.split(":").map(Number);
                const [endHour, endMin] = endTime.split(":").map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;

                if (endMinutes <= startMinutes) {
                    alert(
                        `End time must be after start time for time slot ${
                            i + 1
                        }`
                    );
                    return false;
                }
            }
        }
        return true;
    };

    const handleCreateSchedule = async () => {
        if (!validateTimeSlots()) {
            return;
        }

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

        if (!validateTimeSlots()) {
            return;
        }

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
        const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
        return `${formattedHour}:00`; // Format as HH:MM
    };

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">
                            Schedules
                        </h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Manage your academic schedules and time slots
                        </p>
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
                                    <span className="font-medium">
                                        {schedule.courses}
                                    </span>
                                    <span>Courses</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Users className="h-4 w-4 text-purple-600" />
                                    <span className="font-medium">
                                        {schedule.instructors}
                                    </span>
                                    <span>Instructors</span>
                                </div>
                                {schedule.timeSlots &&
                                    schedule.timeSlots.length > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                                                <span className="text-white text-xs">
                                                    ⏰
                                                </span>
                                            </span>
                                            <span className="font-medium">
                                                {schedule.timeSlots.length}
                                            </span>
                                            <span>TimeSlots</span>
                                        </div>
                                    )}
                            </div>
                        </div>
                    ))}

                    {schedules.length === 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
                            <div className="text-gray-500 mb-2">
                                No schedules found
                            </div>
                            <div className="text-sm text-gray-400">
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
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white">
                    <DialogHeader className="border-b border-gray-200 pb-4">
                        <DialogTitle className="text-xl font-semibold text-gray-900">
                            Create New Schedule
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-6 py-6">
                        <div className="space-y-2">
                            <Label
                                htmlFor="name"
                                className="text-sm font-medium text-gray-700"
                            >
                                Schedule Name
                            </Label>
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
                                <Label
                                    htmlFor="startDate"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Start Date
                                </Label>
                                <Input
                                    id="startDate"
                                    name="startDate"
                                    type="date"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="endDate"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    End Date
                                </Label>
                                <Input
                                    id="endDate"
                                    name="endDate"
                                    type="date"
                                    min={formData.startDate || undefined}
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                                />
                            </div>
                        </div>

                        {/* TimeSlot input */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="numTimeSlots"
                                className="text-sm font-medium text-gray-700"
                            >
                                Number of TimeSlots
                            </Label>
                            <Input
                                id="numTimeSlots"
                                name="numTimeSlots"
                                type="number"
                                min="0"
                                max="24"
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
                                <p className="text-sm text-gray-600">
                                    Please enter times in HH:MM format (e.g.,
                                    08:00, 14:30)
                                </p>
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
                                                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white ${
                                                    timeSlot.startTime &&
                                                    !isCompleteTimeFormat(
                                                        timeSlot.startTime
                                                    )
                                                        ? "border-red-300 focus:border-red-500"
                                                        : ""
                                                }`}
                                            />
                                            {timeSlot.startTime &&
                                                !isCompleteTimeFormat(
                                                    timeSlot.startTime
                                                ) && (
                                                    <p className="text-xs text-red-600">
                                                        Enter time in HH:MM
                                                        format
                                                    </p>
                                                )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor={`endTime-${index}`}
                                                className="text-sm font-medium text-gray-700"
                                            >
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
                                                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white ${
                                                    timeSlot.endTime &&
                                                    !isCompleteTimeFormat(
                                                        timeSlot.endTime
                                                    )
                                                        ? "border-red-300 focus:border-red-500"
                                                        : ""
                                                }`}
                                            />
                                            {timeSlot.endTime &&
                                                !isCompleteTimeFormat(
                                                    timeSlot.endTime
                                                ) && (
                                                    <p className="text-xs text-red-600">
                                                        Enter time in HH:MM
                                                        format
                                                    </p>
                                                )}
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
                        <DialogTitle className="text-xl font-semibold text-gray-900">
                            Edit Schedule
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-6 py-6">
                        <div className="space-y-2">
                            <Label
                                htmlFor="edit-name"
                                className="text-sm font-medium text-gray-700"
                            >
                                Schedule Name
                            </Label>
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
                                <Label
                                    htmlFor="edit-startDate"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Start Date
                                </Label>
                                <Input
                                    id="edit-startDate"
                                    name="startDate"
                                    type="date"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-endDate"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    End Date
                                </Label>
                                <Input
                                    id="edit-endDate"
                                    name="endDate"
                                    type="date"
                                    min={formData.startDate || undefined}
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85]"
                                />
                            </div>
                        </div>

                        {/* TimeSlot input */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="edit-numTimeSlots"
                                className="text-sm font-medium text-gray-700"
                            >
                                Number of TimeSlots
                            </Label>
                            <Input
                                id="edit-numTimeSlots"
                                name="numTimeSlots"
                                type="number"
                                min="0"
                                max="24"
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
                                <p className="text-sm text-gray-600">
                                    Please enter times in HH:MM format (e.g.,
                                    08:00, 14:30)
                                </p>
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
                                                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white ${
                                                    timeSlot.startTime &&
                                                    !isCompleteTimeFormat(
                                                        timeSlot.startTime
                                                    )
                                                        ? "border-red-300 focus:border-red-500"
                                                        : ""
                                                }`}
                                            />
                                            {timeSlot.startTime &&
                                                !isCompleteTimeFormat(
                                                    timeSlot.startTime
                                                ) && (
                                                    <p className="text-xs text-red-600">
                                                        Enter time in HH:MM
                                                        format
                                                    </p>
                                                )}
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
                                                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] bg-white ${
                                                    timeSlot.endTime &&
                                                    !isCompleteTimeFormat(
                                                        timeSlot.endTime
                                                    )
                                                        ? "border-red-300 focus:border-red-500"
                                                        : ""
                                                }`}
                                            />
                                            {timeSlot.endTime &&
                                                !isCompleteTimeFormat(
                                                    timeSlot.endTime
                                                ) && (
                                                    <p className="text-xs text-red-600">
                                                        Enter time in HH:MM
                                                        format
                                                    </p>
                                                )}
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
                        <AlertDialogTitle className="text-xl font-semibold text-gray-900">
                            Delete Schedule
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600">
                            Are you sure you want to delete this schedule? This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-gray-300 text-gray-700 hover:bg-gray-50">
                            Cancel
                        </AlertDialogCancel>
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
