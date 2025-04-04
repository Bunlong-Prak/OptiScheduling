"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Course as ApiCourse } from "@/app/types";

// Mock data for the timetable
const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

const timeSlots = [
    "8:00",
    "9:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
];

// Major groups with years
const majorGroups = [
    { id: "ARC1", name: "Architecture Year 1", color: "bg-gray-100" },
    { id: "CE1", name: "Civil Engineering Year 1", color: "bg-gray-100" },
    { id: "IE1", name: "Industrial Engineering Year 1", color: "bg-gray-100" },
    { id: "CS1", name: "Computer Science Year 1", color: "bg-gray-100" },
    {
        id: "MIS1",
        name: "Management Information Systems Year 1",
        color: "bg-gray-100",
    },
    { id: "DAD1", name: "Digital Art & Design Year 1", color: "bg-gray-100" },
    { id: "ECON1", name: "Economics Year 1", color: "bg-gray-100" },
    { id: "BAF1", name: "Banking & Finance Year 1", color: "bg-gray-100" },
    {
        id: "BUS1",
        name: "Business Administration Year 1",
        color: "bg-gray-100",
    },
    {
        id: "ITL1",
        name: "International Tourism & Hospitality Year 1",
        color: "bg-gray-100",
    },
    { id: "IR1", name: "International Relations Year 1", color: "bg-gray-100" },
    // ... rest of the major groups remain the same
];

// Define our course type for the timetable
type TimetableCourse = {
    id: string;
    name: string;
    color: string;
    duration: number;
    instructor: string;
    room: string;
    isStart?: boolean;
    isMiddle?: boolean;
    isEnd?: boolean;
    colspan?: number;
};

type Schedule = Record<string, TimetableCourse>;

type CellToDelete = {
    day: string;
    majorId: string;
    timeSlot: string;
};

// Initial schedule data (empty object instead of dummy data)
const initialSchedule: Schedule = {};

// Map of color classes to use for courses
const colorMap: Record<string, string> = {
    "blue": "bg-blue-200",
    "green": "bg-green-200",
    "red": "bg-red-200",
    "yellow": "bg-yellow-200",
    "purple": "bg-purple-200",
    "orange": "bg-orange-200",
    "pink": "bg-pink-200",
    "indigo": "bg-indigo-200",
};

export default function TimetableView() {
    const [schedule, setSchedule] = useState<Schedule>(initialSchedule);
    const [draggedCourse, setDraggedCourse] = useState<TimetableCourse | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<TimetableCourse | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [cellToDelete, setCellToDelete] = useState<CellToDelete>({
        day: "",
        majorId: "",
        timeSlot: "",
    });
    
    // State for holding real courses from API
    const [courses, setCourses] = useState<TimetableCourse[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch real courses from API
    useEffect(() => {
        const fetchCourses = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/courses');
                if (response.ok) {
                    const coursesData: ApiCourse[] = await response.json();
                    
                    // Transform API courses to the format needed for the timetable
                    const transformedCourses = coursesData.map(course => ({
                        id: course.code,
                        name: course.title,
                        color: colorMap[course.color] || "bg-gray-200", // Use color mapping or fallback
                        duration: course.duration,
                        instructor: `${course.firstName || ''} ${course.lastName || ''}`.trim(),
                        room: course.classroom || 'TBA',
                    }));
                    
                    // Remove duplicates (courses with same code)
                    const uniqueCourses = Array.from(
                        new Map(transformedCourses.map(course => [course.id, course])).values()
                    );
                    
                    setCourses(uniqueCourses);
                } else {
                    console.error('Failed to fetch courses');
                    // Fallback to empty array if API fails
                    setCourses([]);
                }
            } catch (error) {
                console.error('Error fetching courses:', error);
                setCourses([]);
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
    const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
        e.preventDefault();
    };

    // Handle drop
    const handleDrop = (day: string, majorId: string, timeSlot: string) => {
        if (!draggedCourse) return;

        // Check if the time slot is already occupied
        const key = `${day}-${majorId}-${timeSlot}`;
        const existingCourse = schedule[key];

        // If dropping on the same course, do nothing
        if (existingCourse && existingCourse.id === draggedCourse.id) {
            return;
        }

        // If dropping on a different course, show conflict message
        if (existingCourse && existingCourse.id !== draggedCourse.id) {
            alert(
                "This time slot is already occupied. Please choose another slot."
            );
            return;
        }

        // Check if there's enough space for the course duration
        const timeSlotIndex = timeSlots.indexOf(timeSlot);
        if (timeSlotIndex + draggedCourse.duration > timeSlots.length) {
            alert("Not enough time slots available for this course duration.");
            return;
        }

        // Check for conflicts in subsequent time slots
        for (let i = 1; i < draggedCourse.duration; i++) {
            const nextTimeSlot = timeSlots[timeSlotIndex + i];
            const nextKey = `${day}-${majorId}-${nextTimeSlot}`;
            if (schedule[nextKey]) {
                alert(
                    "There's a conflict with another course in subsequent time slots."
                );
                return;
            }
        }

        // Find and remove the old course slots
        const newSchedule = { ...schedule };
        const oldKeys = Object.keys(newSchedule).filter((key) => {
            const oldCourse = newSchedule[key];
            return oldCourse.id === draggedCourse.id;
        });

        // Remove old slots
        oldKeys.forEach((key) => {
            delete newSchedule[key];
        });

        // Add the course to all its new time slots
        for (let i = 0; i < draggedCourse.duration; i++) {
            const currentTimeSlot = timeSlots[timeSlotIndex + i];
            const currentKey = `${day}-${majorId}-${currentTimeSlot}`;

            newSchedule[currentKey] = {
                ...draggedCourse,
                isStart: i === 0,
                isMiddle: i > 0 && i < draggedCourse.duration - 1,
                isEnd: i === draggedCourse.duration - 1,
                colspan: i === 0 ? draggedCourse.duration : 0,
            };
        }

        setSchedule(newSchedule);
    };

    // Handle course click
    const handleCourseClick = (
        day: string,
        majorId: string,
        timeSlot: string,
        course: TimetableCourse
    ) => {
        setSelectedCourse(course);
        setCellToDelete({ day, majorId, timeSlot });
        setIsDialogOpen(true);
    };

    // Handle course delete - removed confirmation dialog
    const handleDeleteCourse = () => {
        const { day, majorId, timeSlot } = cellToDelete;
        const key = `${day}-${majorId}-${timeSlot}`;
        const course = schedule[key];

        if (!course) return;

        // Find all keys for this course
        const keysToDelete = [];
        const timeSlotIndex = timeSlots.indexOf(timeSlot);

        // If it's the start of a course, delete all subsequent slots
        if (course.isStart) {
            for (let i = 0; i < course.duration; i++) {
                const currentTimeSlot = timeSlots[timeSlotIndex + i];
                keysToDelete.push(`${day}-${majorId}-${currentTimeSlot}`);
            }
        }
        // If it's in the middle or end, find the start and delete from there
        else {
            // Find the start time slot
            let startIndex = timeSlotIndex;
            while (startIndex > 0) {
                const prevTimeSlot = timeSlots[startIndex - 1];
                const prevKey = `${day}-${majorId}-${prevTimeSlot}`;
                if (!schedule[prevKey] || schedule[prevKey].isStart) {
                    break;
                }
                startIndex--;
            }

            // Get the course at the start position
            const startTimeSlot = timeSlots[startIndex];
            const startKey = `${day}-${majorId}-${startTimeSlot}`;
            const startCourse = schedule[startKey];

            // Delete all slots for this course
            if (startCourse) {
                for (let i = 0; i < startCourse.duration; i++) {
                    const currentTimeSlot = timeSlots[startIndex + i];
                    keysToDelete.push(`${day}-${majorId}-${currentTimeSlot}`);
                }
            }
        }

        // Remove all keys from the schedule
        const newSchedule = { ...schedule };
        keysToDelete.forEach((key) => {
            delete newSchedule[key];
        });

        setSchedule(newSchedule);
        setIsDialogOpen(false);
    };

    return (
        <div className="relative min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Timetable</h2>
                <Button>Export Timetable</Button>
            </div>

            {/* Full week timetable */}
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] mb-40">
                <div className="inline-block min-w-full">
                    <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 border">
                                        Major
                                    </th>
                                    {days.map((day) => (
                                        <th
                                            key={day}
                                            colSpan={timeSlots.length}
                                            className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border"
                                        >
                                            {day}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 border">
                                        Time
                                    </th>
                                    {days.map((day) =>
                                        timeSlots.map((time) => (
                                            <th
                                                key={`${day}-${time}`}
                                                className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border"
                                            >
                                                {time}
                                            </th>
                                        ))
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {majorGroups.map((group) => (
                                    <tr key={group.id}>
                                        <td
                                            className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${group.color} border`}
                                        >
                                            {group.id}
                                        </td>
                                        {days.map((day) =>
                                            timeSlots.map((time) => {
                                                const key = `${day}-${group.id}-${time}`;
                                                const course = schedule[key];

                                                // Skip cells that are part of a multi-hour course but not the start
                                                if (course && !course.isStart) {
                                                    return null;
                                                }

                                                return (
                                                    <td
                                                        key={`${day}-${group.id}-${time}`}
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
                                                                group.id,
                                                                time
                                                            )
                                                        }
                                                    >
                                                        {course ? (
                                                            <div
                                                                className={`${course.color} p-1 rounded cursor-pointer text-center`}
                                                                onClick={() =>
                                                                    handleCourseClick(
                                                                        day,
                                                                        group.id,
                                                                        time,
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
                                                                {course.id}
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

            {/* Draggable courses section with real data from API */}
            <div className="fixed bottom-0 left-0 right-0 bg-white p-4 rounded-t-lg shadow-lg z-50 border-t">
                <div className="max-w-9xl mx-auto">
                    <h3 className="text-lg font-semibold mb-4">
                        Available Courses
                    </h3>
                    {isLoading ? (
                        <div className="text-center py-4">Loading courses...</div>
                    ) : courses.length === 0 ? (
                        <div className="text-center py-4">No courses available</div>
                    ) : (
                        <div className="grid grid-cols-6 gap-4 max-h-[20vh] overflow-y-auto">
                            {courses.map((course) => (
                                <div
                                    key={course.id}
                                    className={`${course.color} p-3 rounded-lg shadow cursor-move hover:shadow-md transition-shadow`}
                                    draggable
                                    onDragStart={() => handleDragStart(course)}
                                >
                                    <h4 className="font-bold">{course.id}</h4>
                                    <p className="text-sm">{course.name}</p>
                                    <p className="text-xs mt-1">
                                        Duration: {course.duration} hour
                                        {course.duration > 1 ? "s" : ""}
                                    </p>
                                    <p className="text-xs mt-1 truncate">
                                        Instructor: {course.instructor}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Course details dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Course Details</DialogTitle>
                    </DialogHeader>

                    {selectedCourse && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-bold text-lg">
                                    {selectedCourse.id}: {selectedCourse.name}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Duration: {selectedCourse.duration} hour(s)
                                </p>
                                <p className="text-sm text-gray-600">
                                    Instructor: {selectedCourse.instructor}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Room: {selectedCourse.room}
                                </p>
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
                                    onClick={handleDeleteCourse}
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