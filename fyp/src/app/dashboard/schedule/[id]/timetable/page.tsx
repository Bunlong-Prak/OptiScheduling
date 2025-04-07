"use client";

import { Course as ApiCourse } from "@/app/types";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";

// Mock data for the timetable
const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

import {
    CellToDelete,
    Classroom,
    CourseHour,
    Schedule,
    TimetableCourse,
} from "@/app/types";
import { useParams } from "next/navigation";
// Initial schedule data (empty object)
const initialSchedule: Schedule = {};

// Map of color classes to use for courses

import { colors_class } from "@/components/custom/colors";
export default function TimetableView() {
    const [schedule, setSchedule] = useState<Schedule>(initialSchedule);
    const [draggedCourse, setDraggedCourse] = useState<TimetableCourse | null>(
        null
    );
    const [selectedCourse, setSelectedCourse] =
        useState<TimetableCourse | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [cellToDelete, setCellToDelete] = useState<CellToDelete>({
        day: "",
        classroomId: "",
        timeSlot: "",
        timeSlotId: 0, // Related to course hour
    });

    // State for holding real courses from API
    const [availableCourses, setAvailableCourses] = useState<TimetableCourse[]>(
        []
    );
    const [assignedCourses, setAssignedCourses] = useState<TimetableCourse[]>(
        []
    );
    const [isLoading, setIsLoading] = useState(true);

    // Add state to track if dragging to available courses area
    const [isDraggingToAvailable, setIsDraggingToAvailable] = useState(false);

    // New state for time slots from database - course hours related
    const [timeSlots, setTimeSlots] = useState<CourseHour[]>([]);

    // State for classrooms from database
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);

    // Default time slots for fallback - course hours related
    const defaultTimeSlots = [
        { id: 1, time_slot: "8:00" },
        { id: 2, time_slot: "9:00" },
        { id: 3, time_slot: "10:00" },
        { id: 4, time_slot: "11:00" },
        { id: 5, time_slot: "12:00" },
        { id: 6, time_slot: "13:00" },
        { id: 7, time_slot: "14:00" },
        { id: 8, time_slot: "15:00" },
        { id: 9, time_slot: "16:00" },
        { id: 10, time_slot: "17:00" },
    ];
    const params = useParams();

    // Fetch time slots and classrooms from API
    useEffect(() => {
        // Fetch course hours - commented out
        /*
        const fetchTimeSlots = async () => {
            try {
                const response = await fetch("/api/course-hours");
                if (response.ok) {
                    const data: CourseHour[] = await response.json();
                    setTimeSlots(data);
                } else {
                    console.error("Failed to fetch course hours");
                    setTimeSlots(defaultTimeSlots);
                }
            } catch (error) {
                console.error("Error fetching course hours:", error);
                setTimeSlots(defaultTimeSlots);
            }
        };
        */

        // Use default time slots directly instead of fetching
        setTimeSlots(defaultTimeSlots);

        const fetchClassrooms = async () => {
            try {
                const scheduleId = params.id;
                const response = await fetch(
                    `/api/classrooms?scheduleId=${scheduleId}`
                );
                if (response.ok) {
                    const data = await response.json();
                    // Use classrooms directly without adding extra fields
                    setClassrooms(data);
                } else {
                    console.error("Failed to fetch classrooms");
                    setClassrooms([]);
                }
            } catch (error) {
                console.error("Error fetching classrooms:", error);
                setClassrooms([]);
            }
        };

        // fetchTimeSlots(); - commented out, not fetching course hours
        fetchClassrooms();
    }, []);

    // Fetch real courses from API
    useEffect(() => {
        const fetchCourses = async () => {
            setIsLoading(true);
            try {
                const response = await fetch("/api/courses");
                if (response.ok) {
                    const coursesData: ApiCourse[] = await response.json();

                    // Transform API courses to the format needed for the timetable
                    // Keep all sections instead of filtering out duplicates
                    const transformedCourses = coursesData.map((course) => ({
                        code: course.code,
                        sectionId: course.sectionId, // Add sectionId for uniqueness
                        name: course.title,
                        color: colors_class[course.color] || "bg-gray-200", // Use color mapping or fallback
                        duration: course.duration,
                        instructor: `${course.firstName || ""} ${
                            course.lastName || ""
                        }`.trim(),
                        section: course.section,
                        room: course.classroom || "TBA",
                        uniqueId: `${course.code}-${course.section}`, // Create a uniqueId combining code and section
                    }));

                    // No more filtering out duplicates by course code
                    setAvailableCourses(transformedCourses);
                } else {
                    console.error("Failed to fetch courses");
                    // Fallback to empty array if API fails
                    setAvailableCourses([]);
                }
            } catch (error) {
                console.error("Error fetching courses:", error);
                setAvailableCourses([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCourses();
    }, []);

    // Handle drag start
    const handleDragStart = (course: TimetableCourse) => {
        setDraggedCourse(course);
    };

    // Handle drag over
    const handleDragOver = (
        e: React.DragEvent<HTMLTableCellElement | HTMLDivElement>
    ) => {
        e.preventDefault();
    };

    // Handle drag over for available courses section
    const handleAvailableDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(true);
    };

    // Handle drag leave for available courses section
    const handleAvailableDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(false);
    };

    // Handle drop for available courses
    const handleAvailableDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(false);

        if (!draggedCourse) return;

        // Only process if the course is from the timetable (has day property)
        if (draggedCourse.day) {
            // Remove course from the timetable
            removeCourseFromTimetable(draggedCourse);
        }
    };

    // Function to remove a course from the timetable and return it to available courses
    const removeCourseFromTimetable = (course: TimetableCourse) => {
        if (!course.day || !course.classroom || !course.startTime) return;

        // Find all keys for this course in the schedule
        const newSchedule = { ...schedule };

        // Remove all occurrences of this course ID from schedule
        Object.keys(newSchedule).forEach((key) => {
            if (newSchedule[key].sectionId === course.sectionId) {
                delete newSchedule[key];
            }
        });

        setSchedule(newSchedule);

        // Return the course to available courses list
        // Create a clean version without timetable-specific properties
        const cleanCourse = {
            code: course.code,
            name: course.name,
            color: course.color,
            duration: course.duration,
            instructor: course.instructor,
            sectionId: course.sectionId,
            section: course.section,
            room: course.room,
        };

        // Only add back to available courses if it's not already there
        if (!availableCourses.some((c) => c.sectionId === course.sectionId)) {
            setAvailableCourses((prev) => [...prev, cleanCourse]);
        }

        // Remove from assigned courses
        setAssignedCourses((prev) =>
            prev.filter((c) => c.sectionId !== course.sectionId)
        );
    };

    const getTimeSlotId = (timeSlotStr: string): number => {
        const index = timeSlots.findIndex((ts) => ts.time_slot === timeSlotStr);
        return index !== -1 ? index + 1 : 0;
    };

    // Handle drop - completely rewritten to prevent duplication
    const handleDrop = (day: string, classroomId: string, timeSlot: string) => {
        if (!draggedCourse || timeSlots.length === 0) return;

        // Get time slot ID - course hours related
        const timeSlotId = getTimeSlotId(timeSlot);
        if (timeSlotId === 0) {
            console.error(`Time slot ${timeSlot} not found in database`);
            return;
        }

        // Check if the time slot is already occupied
        const key = `${day}-${classroomId}-${timeSlot}`;
        const existingCourse = schedule[key];

        // If dropping on the same course, do nothing
        if (
            existingCourse &&
            existingCourse.sectionId === draggedCourse.sectionId
        ) {
            return;
        }

        // If dropping on a different course, show conflict message
        if (
            existingCourse &&
            existingCourse.sectionId !== draggedCourse.sectionId
        ) {
            alert(
                "This time slot is already occupied. Please choose another slot."
            );
            return;
        }

        // Check if there's enough space for the course duration
        const timeSlotIndex = timeSlots.findIndex(
            (ts) => ts.time_slot === timeSlot
        );
        if (timeSlotIndex + draggedCourse.duration > timeSlots.length) {
            alert("Not enough time slots available for this course duration.");
            return;
        }

        // Check for conflicts in subsequent time slots
        for (let i = 1; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;
            const nextTimeSlot = timeSlots[timeSlotIndex + i].time_slot;
            const nextKey = `${day}-${classroomId}-${nextTimeSlot}`;
            if (
                schedule[nextKey] &&
                schedule[nextKey].sectionId !== draggedCourse.sectionId
            ) {
                alert(
                    "There's a conflict with another course in subsequent time slots."
                );
                return;
            }
        }

        // Create a new schedule and remove all instances of the dragged course
        const newSchedule = { ...schedule };
        Object.keys(newSchedule).forEach((scheduleKey) => {
            if (
                newSchedule[scheduleKey].sectionId === draggedCourse.sectionId
            ) {
                delete newSchedule[scheduleKey];
            }
        });

        // Calculate end time
        const endTimeIndex = timeSlotIndex + draggedCourse.duration - 1;
        const endTimeSlot =
            endTimeIndex < timeSlots.length
                ? timeSlots[endTimeIndex].time_slot
                : timeSlots[timeSlots.length - 1].time_slot;

        // Create course with assignment data
        const assignedCourse = {
            ...draggedCourse,
            day: day,
            startTime: timeSlot,
            endTime: endTimeSlot,
            courseHoursId: timeSlotId,
            classroom: classroomId,
        };

        // Add the course to all its new time slots
        for (let i = 0; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;
            const currentTimeSlot = timeSlots[timeSlotIndex + i].time_slot;
            const currentKey = `${day}-${classroomId}-${currentTimeSlot}`;

            newSchedule[currentKey] = {
                ...assignedCourse,
                isStart: i === 0,
                isMiddle: i > 0 && i < draggedCourse.duration - 1,
                isEnd: i === draggedCourse.duration - 1,
                colspan: i === 0 ? draggedCourse.duration : 0,
            };
        }

        // Update schedule state
        setSchedule(newSchedule);

        // Handle assignment lists based on where the course came from
        const isFromAvailable = !draggedCourse.day;

        if (isFromAvailable) {
            // Remove from available courses
            setAvailableCourses((prev) =>
                prev.filter(
                    (course) => course.sectionId !== draggedCourse.sectionId
                )
            );

            // Add to assigned courses
            setAssignedCourses((prev) => [
                ...prev.filter((c) => c.sectionId !== draggedCourse.sectionId),
                assignedCourse,
            ]);
        } else {
            // Just update the position in assigned courses
            setAssignedCourses((prev) => {
                const filtered = prev.filter(
                    (c) => c.sectionId !== draggedCourse.sectionId
                );
                return [...filtered, assignedCourse];
            });
        }
    };

    // Handle course click - updated to use classroom instead of major
    const handleCourseClick = (
        day: string,
        classroomId: string,
        timeSlot: string,
        course: TimetableCourse
    ) => {
        setSelectedCourse(course);
        const timeSlotId = getTimeSlotId(timeSlot); // Course hours related
        setCellToDelete({ day, classroomId, timeSlot, timeSlotId });
        setIsDialogOpen(true);
    };

    // Handle course delete - simplified to use course ID approach
    // const handleDeleteCourse = () => {
    //     const { day, classroomId, timeSlot } = cellToDelete;
    //     const key = `${day}-${classroomId}-${timeSlot}`;
    //     const course = schedule[key];

    //     if (!course) return;

    //     // Get the course ID to remove
    //     const courseId = course.id;

    //     // Create a new schedule without this course
    //     const newSchedule = { ...schedule };
    //     Object.keys(newSchedule).forEach((scheduleKey) => {
    //         if (newSchedule[scheduleKey].id === courseId) {
    //             delete newSchedule[scheduleKey];
    //         }
    //     });

    //     setSchedule(newSchedule);

    //     // Return the course to available courses list
    //     // Create a clean version without timetable-specific properties
    //     const cleanCourse = {
    //         id: course.id,
    //         name: course.name,
    //         color: course.color,
    //         duration: course.duration,
    //         instructor: course.instructor,
    //         section: course.section,
    //         room: course.room,
    //     };

    //     // Only add back to available courses if it's not already there
    //     if (!availableCourses.some((c) => c.id === course.id)) {
    //         setAvailableCourses((prev) => [...prev, cleanCourse]);
    //     }

    //     // Remove from assigned courses
    //     setAssignedCourses((prev) => prev.filter((c) => c.id !== course.id));

    //     setIsDialogOpen(false);
    // };

    // Function to save the timetable to the database - updated for classroom
    // const saveTimetable = async () => {
    //     // Extract all assigned courses from the schedule
    //     const assignmentsToSave = assignedCourses.map((course) => ({
    //         courseId: course.id,
    //         day: course.day,
    //         classroomId: course.classroom,
    //         courseHoursId: course.courseHoursId, // Course hours related
    //         // Add any other fields needed for your API
    //     }));

    //     try {
    //         // Send to your API endpoint
    //         const response = await fetch("/api/save-timetable", {
    //             method: "POST",
    //             headers: {
    //                 "Content-Type": "application/json",
    //             },
    //             body: JSON.stringify({ assignments: assignmentsToSave }),
    //         });

    //         if (response.ok) {
    //             alert("Timetable saved successfully!");
    //         } else {
    //             alert("Failed to save timetable");
    //         }
    //     } catch (error) {
    //         console.error("Error saving timetable:", error);
    //         alert("Error saving timetable");
    //     }
    // };

    return (
        <div className="relative min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Timetable</h2>
                <div className="space-x-2">
                    <Button>Export Timetable</Button>
                </div>
            </div>

            {/* Full week timetable */}
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] mb-40">
                <div className="inline-block min-w-full">
                    <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-blue-200">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium  text-gray-700 uppercase tracking-wider w-24 border">
                                        Classroom
                                    </th>
                                    {days.map((day) => (
                                        <th
                                            key={day}
                                            colSpan={timeSlots.length}
                                            className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border "
                                        >
                                            {day}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider w-24 border">
                                        Time
                                    </th>
                                    {/* Course hours related - time slot headers */}
                                    {days.map((day) =>
                                        timeSlots.map((slot) => (
                                            <th
                                                key={`${day}-${slot.time_slot}`}
                                                className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border "
                                            >
                                                {slot.time_slot}
                                            </th>
                                        ))
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {classrooms.map((classroom, index) => (
                                    <tr
                                        key={classroom.id}
                                        className={
                                            index % 2 === 0
                                                ? "bg-white"
                                                : "bg-white"
                                        }
                                    >
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium border text-gray-700">
                                            {classroom.code}
                                        </td>
                                        {days.map((day) =>
                                            timeSlots.map((slot) => {
                                                const key = `${day}-${classroom.id}-${slot.time_slot}`;
                                                const course = schedule[key];

                                                // Skip cells that are part of a multi-hour course but not the start
                                                if (course && !course.isStart) {
                                                    return null;
                                                }

                                                return (
                                                    <td
                                                        key={`${day}-${classroom.id}-${slot.time_slot}`}
                                                        className="px-1 py-1 whitespace-nowrap text-xs border"
                                                        colSpan={
                                                            course?.colspan || 1
                                                        }
                                                        onDragOver={
                                                            handleDragOver
                                                        }
                                                        onDrop={() =>
                                                            handleDrop(
                                                                day,
                                                                classroom.id.toString(),
                                                                slot.time_slot
                                                            )
                                                        }
                                                    >
                                                        {course ? (
                                                            <div
                                                                className={`${course.color} p-1 rounded cursor-pointer text-center border shadow-sm transition-all font-medium`}
                                                                onClick={() =>
                                                                    handleCourseClick(
                                                                        day,
                                                                        classroom.id.toString(),
                                                                        slot.time_slot,
                                                                        course
                                                                    )
                                                                }
                                                                draggable
                                                                onDragStart={() =>
                                                                    handleDragStart(
                                                                        course
                                                                    )
                                                                }
                                                            >
                                                                {course.code}
                                                                {" Section: "}
                                                                {
                                                                    course.sectionId
                                                                }
                                                            </div>
                                                        ) : (
                                                            <div className="h-6 w-full" />
                                                        )}
                                                    </td>
                                                );
                                            })
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Draggable courses section with real data from API - only showing available courses */}
            <div
                className={`fixed bottom-0 left-0 right-0 bg-white p-4 rounded-t-lg shadow-lg z-50 border-t ${
                    isDraggingToAvailable ? "bg-blue-100" : ""
                }`}
                onDragOver={handleAvailableDragOver}
                onDragLeave={handleAvailableDragLeave}
                onDrop={handleAvailableDrop}
            >
                <div className="max-w-9xl mx-auto">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <span className="">Available Courses</span>
                        {isDraggingToAvailable && (
                            <span className="ml-2 text-blue-500 animate-pulse">
                                (Drop Here to Return Course)
                            </span>
                        )}
                    </h3>
                    {isLoading ? (
                        <div className="text-center py-4">
                            Loading courses...
                        </div>
                    ) : availableCourses.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                            All courses have been assigned to the timetable
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 gap-4 max-h-[20vh] overflow-y-auto p-2">
                            {availableCourses.map((course) => (
                                <div
                                    key={course.sectionId}
                                    className={`${course.color} p-3 rounded-lg shadow cursor-move hover:shadow-md transition-all border`}
                                    draggable
                                    onDragStart={() => handleDragStart(course)}
                                >
                                    <h4 className="font-bold text-gray-800">
                                        {course.code}
                                    </h4>
                                    <p className="text-sm font-medium">
                                        {course.name}
                                    </p>
                                    <p className="text-xs mt-1 text-gray-700">
                                        Duration: {course.duration} hour
                                        {course.duration > 1 ? "s" : ""}
                                    </p>
                                    <p className="text-xs mt-1 truncate text-gray-700">
                                        Instructor: {course.instructor}
                                    </p>
                                    <p className="text-xs mt-1 truncate text-gray-700">
                                        Section: {course.section || "N/A"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Course details dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            Course Details
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCourse && (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div
                                    className={`w-full h-1 ${selectedCourse.color
                                        .replace("hover:", "")
                                        .replace("border-", "")}`}
                                ></div>
                                <h3 className="font-bold text-lg">
                                    {selectedCourse.code}: {selectedCourse.name}
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Duration:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.duration} hour(s)
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Instructor:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.instructor}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Room:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.room}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Time:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.day},{" "}
                                            {selectedCourse.startTime} -{" "}
                                            {selectedCourse.endTime}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Classroom:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.classroom}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="destructive"
                                    // onClick={handleDeleteCourse}
                                >
                                    Remove
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
