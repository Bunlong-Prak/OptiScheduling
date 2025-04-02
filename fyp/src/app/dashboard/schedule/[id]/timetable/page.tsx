"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    { id: "ARC2", name: "Architecture Year 2", color: "bg-gray-100" },
    { id: "CE2", name: "Civil Engineering Year 2", color: "bg-gray-100" },
    { id: "IE2", name: "Industrial Engineering Year 2", color: "bg-gray-100" },
    { id: "CS2", name: "Computer Science Year 2", color: "bg-gray-100" },
    {
        id: "MIS2",
        name: "Management Information Systems Year 2",
        color: "bg-gray-100",
    },
    { id: "DAD2", name: "Digital Art & Design Year 2", color: "bg-gray-100" },
    { id: "ECON2", name: "Economics Year 2", color: "bg-gray-100" },
    { id: "BAF2", name: "Banking & Finance Year 2", color: "bg-gray-100" },
    {
        id: "BUS2",
        name: "Business Administration Year 2",
        color: "bg-gray-100",
    },
    {
        id: "ITL2",
        name: "International Tourism & Hospitality Year 2",
        color: "bg-gray-100",
    },
    { id: "IR2", name: "International Relations Year 2", color: "bg-gray-100" },
    { id: "ARC3", name: "Architecture Year 3", color: "bg-gray-100" },
    { id: "CE3", name: "Civil Engineering Year 3", color: "bg-gray-100" },
    { id: "IE3", name: "Industrial Engineering Year 3", color: "bg-gray-100" },
    { id: "CS3", name: "Computer Science Year 3", color: "bg-gray-100" },
    {
        id: "MIS3",
        name: "Management Information Systems Year 3",
        color: "bg-gray-100",
    },
    { id: "DAD3", name: "Digital Art & Design Year 3", color: "bg-gray-100" },
    { id: "ECON3", name: "Economics Year 3", color: "bg-gray-100" },
    { id: "BAF3", name: "Banking & Finance Year 3", color: "bg-gray-100" },
    {
        id: "BUS3",
        name: "Business Administration Year 3",
        color: "bg-gray-100",
    },
];

// Mock course data with duration
const courses = [
    {
        id: "ENGL101",
        name: "English 101",
        color: "bg-blue-200",
        duration: 3,
        instructor: "Dr. Smith",
        room: "A101",
    },
    {
        id: "MATH131",
        name: "Mathematics 131",
        color: "bg-red-200",
        duration: 2,
        instructor: "Dr. Johnson",
        room: "B202",
    },
    {
        id: "CS125",
        name: "Computer Science 125",
        color: "bg-green-200",
        duration: 3,
        instructor: "Prof. Williams",
        room: "C303",
    },
    {
        id: "ECON102",
        name: "Economics 102",
        color: "bg-yellow-200",
        duration: 1,
        instructor: "Dr. Brown",
        room: "D404",
    },
    {
        id: "PHYS101",
        name: "Physics 101",
        color: "bg-purple-200",
        duration: 2,
        instructor: "Prof. Davis",
        room: "E505",
    },
    {
        id: "BUS110",
        name: "Business 110",
        color: "bg-orange-200",
        duration: 1,
        instructor: "Dr. Miller",
        room: "F606",
    },
    {
        id: "ARC101",
        name: "Architecture 101",
        color: "bg-pink-200",
        duration: 2,
        instructor: "Prof. Wilson",
        room: "G707",
    },
    {
        id: "CE101",
        name: "Civil Engineering 101",
        color: "bg-indigo-200",
        duration: 1,
        instructor: "Dr. Moore",
        room: "H808",
    },
];

type Course = {
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

type Schedule = Record<string, Course>;

type CellToDelete = {
    day: string;
    majorId: string;
    timeSlot: string;
};

// Initial schedule data with dummy courses
const initialSchedule: Schedule = {
    "Monday-ARC1-8:00": { ...courses[0], isStart: true, colspan: 1 }, // ENGL101
    "Monday-CS1-9:00": { ...courses[1], isStart: true, colspan: 2 }, // MATH131
    "Tuesday-IE1-10:00": { ...courses[2], isStart: true, colspan: 3 }, // CS125
    "Wednesday-ECON1-13:00": { ...courses[3], isStart: true, colspan: 1 }, // ECON102
    "Thursday-PHYS101-14:00": { ...courses[4], isStart: true, colspan: 2 }, // PHYS101
    "Friday-BUS110-15:00": { ...courses[5], isStart: true, colspan: 1 }, // BUS110
    "Monday-ARC101-16:00": { ...courses[6], isStart: true, colspan: 2 }, // ARC101
    "Tuesday-CE101-17:00": { ...courses[7], isStart: true, colspan: 1 }, // CE101
};

export default function TimetableView() {
    const [schedule, setSchedule] = useState<Schedule>(initialSchedule);
    const [draggedCourse, setDraggedCourse] = useState<Course | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [cellToDelete, setCellToDelete] = useState<CellToDelete>({
        day: "",
        majorId: "",
        timeSlot: "",
    });

    // Handle drag start
    const handleDragStart = (course: Course) => {
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
        course: Course
    ) => {
        setSelectedCourse(course);
        setCellToDelete({ day, majorId, timeSlot });
        setIsDialogOpen(true);
    };

    // Handle course delete
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
        setIsDeleteDialogOpen(false);
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

            {/* Draggable courses section */}
            <div className="fixed bottom-0 left-0 right-0 bg-white p-4 rounded-t-lg shadow-lg z-50 border-t">
                <div className="max-w-9xl mx-auto">
                    <h3 className="text-lg font-semibold mb-4">
                        Available Courses
                    </h3>
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
                            </div>
                        ))}
                    </div>
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
                                    onClick={() => {
                                        setIsDeleteDialogOpen(true);
                                    }}
                                >
                                    Remove
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog */}
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Course</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove this course from the
                            timetable?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCourse}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
