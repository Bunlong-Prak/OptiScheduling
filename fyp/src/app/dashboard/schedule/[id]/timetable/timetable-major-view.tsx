"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { colors_class } from "@/components/custom/colors"; // Ensure this path is correct
import { useParams } from "next/navigation";
import {
    Major,
    CourseHour,
    Course as CourseType,
    TimetableCourse,
    Schedule as ScheduleType,
} from "@/app/types";

const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

// Custom interface for time slots (since CourseHour doesn't fully match our needs)
interface TimeSlot extends CourseHour {
    time_slot?: string;
}

// Extended TimetableCourse with additional fields needed for this view
interface ExtendedTimetableCourse extends TimetableCourse {
    major?: string;
    room?: string;
    year?: number;
    subtext?: string;
}

// Custom mapping type for our schedule
interface MajorSchedule {
    [key: string]: ExtendedTimetableCourse;
}

// Interface for major year display rows
interface MajorYearDisplayRow {
    id: string;
    displayName: string;
    majorName: string;
    year: number;
    originalMajorId: number;
}

export default function MajorView() {
    const params = useParams();

    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [allMajors, setAllMajors] = useState<Major[]>([]);
    const [majorYearDisplayRows, setMajorYearDisplayRows] = useState<
        MajorYearDisplayRow[]
    >([]);
    const [allCoursesData, setAllCoursesData] = useState<CourseType[]>([]);
    const [schedule, setSchedule] = useState<MajorSchedule>({});
    const [availableCourses, setAvailableCourses] = useState<
        ExtendedTimetableCourse[]
    >([]);

    const [draggedCourse, setDraggedCourse] =
        useState<ExtendedTimetableCourse | null>(null);
    const [selectedCourse, setSelectedCourse] =
        useState<ExtendedTimetableCourse | null>(null);
    const [isDraggingToAvailable, setIsDraggingToAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isGeneratingSchedule, setIsGeneratingSchedule] =
        useState<boolean>(false);
    const [scheduleGenerated, setScheduleGenerated] = useState<boolean>(false);

    const getTimeSlotKey = useCallback((timeSlot: TimeSlot | string) => {
        if (typeof timeSlot === "string") return timeSlot;
        if (timeSlot.startTime) return timeSlot.startTime;
        if (timeSlot.time_slot) return timeSlot.time_slot;
        return String(timeSlot.id);
    }, []);

    useEffect(() => {
        const fetchTimeSlots = async () => {
            if (!params.id) return;
            try {
                const response = await fetch(`/api/schedules`);
                if (response.ok) {
                    const schedulesData = await response.json();
                    const currentSchedule = schedulesData.find(
                        (s: { id: { toString: () => string | string[] } }) =>
                            s.id.toString() === params.id
                    );
                    if (currentSchedule && currentSchedule.timeSlots) {
                        const apiTimeSlots = currentSchedule.timeSlots.map(
                            (slot: CourseHour) => {
                                const formattedSlot: TimeSlot = {
                                    id: slot.id,
                                    display_slot: slot.display_slot,
                                    time_slot:
                                        slot.time_slot ||
                                        (slot.startTime && slot.endTime
                                            ? `${slot.startTime}-${slot.endTime}`
                                            : slot.startTime),
                                    startTime: slot.startTime,
                                    endTime: slot.endTime,
                                };
                                if (
                                    !slot.startTime &&
                                    !slot.endTime &&
                                    slot.time_slot &&
                                    slot.time_slot.includes("-")
                                ) {
                                    const [startTime, endTime] = slot.time_slot
                                        .split("-")
                                        .map((time) => time.trim());
                                    formattedSlot.startTime = startTime;
                                    formattedSlot.endTime = endTime;
                                }
                                return formattedSlot;
                            }
                        );
                        setTimeSlots(apiTimeSlots);
                    } else {
                        console.error(
                            "No time slots found for schedule",
                            params.id
                        );
                    }
                } else {
                    console.error("Failed to fetch schedules for time slots");
                }
            } catch (error) {
                console.error("Error fetching time slots:", error);
            }
        };
        if (params.id) fetchTimeSlots();
    }, [params.id]);

    useEffect(() => {
        const fetchMajorsAndPrepareRows = async () => {
            if (!params.id) return;
            try {
                const response = await fetch(
                    `/api/majors?scheduleId=${params.id}`
                );
                if (!response.ok)
                    throw new Error(
                        `Failed to fetch majors: ${response.statusText}`
                    );

                const data: Major[] = await response.json();
                setAllMajors(data);

                const baseMajorsMap: Map<string, Major> = new Map();
                data.forEach((major) => {
                    const baseName = major.name
                        .replace(/\s+Year\s+\d+$/, "")
                        .trim();
                    if (
                        !baseMajorsMap.has(baseName) ||
                        (baseMajorsMap.get(baseName)!.year !== undefined &&
                            major.year === undefined)
                    ) {
                        baseMajorsMap.set(baseName, {
                            ...major,
                            name: baseName,
                            numberOfYears:
                                major.numberOfYears ||
                                baseMajorsMap.get(baseName)?.numberOfYears ||
                                4,
                        });
                    } else {
                        const existing = baseMajorsMap.get(baseName)!;
                        if (
                            major.numberOfYears &&
                            (!existing.numberOfYears ||
                                major.numberOfYears > existing.numberOfYears)
                        ) {
                            existing.numberOfYears = major.numberOfYears;
                        }
                    }
                });

                const processedRows: MajorYearDisplayRow[] = [];
                Array.from(baseMajorsMap.values()).forEach((baseMajor) => {
                    const numYears = baseMajor.numberOfYears || 4;
                    for (let y = 1; y <= numYears; y++) {
                        processedRows.push({
                            id: `${baseMajor.id}-${y}`,
                            displayName: `${
                                baseMajor.shortTag ||
                                baseMajor.name.substring(0, 3).toUpperCase()
                            }${y}`,
                            majorName: baseMajor.name,
                            year: y,
                            originalMajorId: baseMajor.id,
                        });
                    }
                });
                processedRows.sort((a, b) => {
                    if (a.majorName < b.majorName) return -1;
                    if (a.majorName > b.majorName) return 1;
                    return a.year - b.year;
                });
                setMajorYearDisplayRows(processedRows);
            } catch (error) {
                console.error(
                    "Error fetching majors or processing rows:",
                    error
                );
            }
        };
        if (params.id) fetchMajorsAndPrepareRows();
    }, [params.id]);

    const loadInitialData = useCallback(async () => {
        if (
            !params.id ||
            timeSlots.length === 0 ||
            majorYearDisplayRows.length === 0
        ) {
            if (
                params.id &&
                timeSlots.length > 0 &&
                majorYearDisplayRows.length > 0
            )
                setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const scheduleId = params.id;
            const coursesResponse = await fetch(
                `/api/courses?scheduleId=${scheduleId}`
            );
            if (!coursesResponse.ok) throw new Error("Failed to fetch courses");
            const fetchedCourses: CourseType[] = await coursesResponse.json();
            setAllCoursesData(fetchedCourses);

            const assignmentsResponse = await fetch(
                `/api/assign-time-slots?scheduleId=${scheduleId}`
            );
            if (!assignmentsResponse.ok)
                throw new Error("Failed to fetch assignments");
            const assignmentsData: any[] = await assignmentsResponse.json();

            const newSchedule: MajorSchedule = {};
            const assignedCourseSectionIds = new Set<string | number>();

            assignmentsData.forEach((assignment) => {
                let targetRow: MajorYearDisplayRow | undefined = undefined;
                if (assignment.major) {
                    const majorNameMatch = assignment.major.match(
                        /^(.*?)(\s+Year\s+(\d+))?$/
                    );
                    if (majorNameMatch) {
                        const assignmentMajorBaseName =
                            majorNameMatch[1].trim();
                        const assignmentYear = majorNameMatch[3]
                            ? parseInt(majorNameMatch[3], 10)
                            : null;
                        targetRow = majorYearDisplayRows.find(
                            (row) =>
                                row.majorName.toLowerCase() ===
                                    assignmentMajorBaseName.toLowerCase() &&
                                (assignmentYear === null ||
                                    row.year === assignmentYear)
                        );
                    }
                }
                if (!targetRow && assignment.section) {
                    const sectionPrefixMatch =
                        assignment.section.match(/^([A-Za-z]+)(\d)/);
                    if (sectionPrefixMatch) {
                        const sectionMajorTag =
                            sectionPrefixMatch[1].toUpperCase();
                        const sectionYear = parseInt(sectionPrefixMatch[2], 10);
                        targetRow = majorYearDisplayRows.find(
                            (row) =>
                                row.displayName.startsWith(sectionMajorTag) &&
                                row.year === sectionYear
                        );
                    }
                }

                if (!targetRow || !assignment.day || !assignment.startTime)
                    return;

                const courseDetails: Partial<CourseType> =
                    fetchedCourses.find(
                        (c) => c.sectionId === assignment.sectionId
                    ) || {};
                const fullCourseData: ExtendedTimetableCourse = {
                    sectionId: assignment.sectionId,
                    code: courseDetails.code || assignment.code || "N/A",
                    name:
                        courseDetails.title ||
                        courseDetails.name ||
                        assignment.title ||
                        assignment.name,
                    color:
                        colors_class[
                            (courseDetails.color ||
                                assignment.color) as keyof typeof colors_class
                        ] || colors_class.default,
                    instructor: `${
                        assignment.firstName || courseDetails.firstName || ""
                    } ${
                        assignment.lastName || courseDetails.lastName || ""
                    }`.trim(),
                    duration: parseInt(
                        String(
                            courseDetails.duration || assignment.duration || "1"
                        ),
                        10
                    ),
                    section: courseDetails.section || assignment.section || "",
                    year: targetRow.year,
                    major: targetRow.majorName,
                    day: assignment.day,
                    startTime: assignment.startTime,
                    endTime: assignment.endTime,
                    room: assignment.classroom || courseDetails.classroom || "",
                    subtext: courseDetails.subtext || assignment.subtext,
                };

                const startIndex = timeSlots.findIndex(
                    (ts) =>
                        getTimeSlotKey(ts) === assignment.startTime ||
                        ts.startTime === assignment.startTime
                );
                if (startIndex === -1) return;

                for (let i = 0; i < fullCourseData.duration; i++) {
                    if (startIndex + i >= timeSlots.length) break;
                    const currentTimeSlotKey = getTimeSlotKey(
                        timeSlots[startIndex + i]
                    );
                    const scheduleKey = `${targetRow.id}-${assignment.day}-${currentTimeSlotKey}`;
                    newSchedule[scheduleKey] = {
                        ...fullCourseData,
                        isStart: i === 0,
                        isMiddle: i > 0 && i < fullCourseData.duration - 1,
                        isEnd: i === fullCourseData.duration - 1,
                        colspan: i === 0 ? fullCourseData.duration : 0,
                    };
                }
                assignedCourseSectionIds.add(fullCourseData.sectionId);
            });
            setSchedule(newSchedule);

            const unassigned = fetchedCourses
                .filter(
                    (course) => !assignedCourseSectionIds.has(course.sectionId)
                )
                .map((course) => {
                    let displayYear = 1;
                    if (
                        course.section &&
                        /[A-Za-z]+(\d+)/.test(course.section)
                    ) {
                        const match = course.section.match(/[A-Za-z]+(\d+)/);
                        if (match && match[1])
                            displayYear = parseInt(match[1], 10);
                    } else if (
                        course.major &&
                        /Year\s+(\d+)/.test(course.major)
                    ) {
                        const match = course.major.match(/Year\s+(\d+)/);
                        if (match && match[1])
                            displayYear = parseInt(match[1], 10);
                    }
                    return {
                        sectionId: course.sectionId,
                        code: course.code,
                        name: course.title,
                        color:
                            colors_class[
                                course.color as keyof typeof colors_class
                            ] || colors_class.default,
                        year: displayYear,
                        instructor: `${course.firstName || ""} ${
                            course.lastName || ""
                        }`.trim(),
                        duration: course.duration,
                        section: course.section,
                        room: course.classroom,
                    } as ExtendedTimetableCourse;
                });
            setAvailableCourses(unassigned);
        } catch (error) {
            console.error("Error loading initial schedule data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [params.id, timeSlots, majorYearDisplayRows, getTimeSlotKey]);

    useEffect(() => {
        if (
            params.id &&
            timeSlots.length > 0 &&
            majorYearDisplayRows.length > 0
        ) {
            loadInitialData();
        } else if (!params.id) {
            setIsLoading(false); // No ID, nothing to load
        }
    }, [params.id, timeSlots, majorYearDisplayRows, loadInitialData]);

    const handleDragStart = (course: ExtendedTimetableCourse) =>
        setDraggedCourse(course);
    const handleDragOver = (e: React.DragEvent<HTMLElement>) =>
        e.preventDefault();
    const handleAvailableDragOver = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(true);
    };
    const handleAvailableDragLeave = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(false);
    };

    const removeCourseFromScheduleState = (
        courseIdToRemove: string | number,
        currentSchedule: MajorSchedule
    ) => {
        const updatedSchedule = { ...currentSchedule };
        Object.keys(updatedSchedule).forEach((key) => {
            if (updatedSchedule[key].sectionId === courseIdToRemove)
                delete updatedSchedule[key];
        });
        return updatedSchedule;
    };

    const handleAvailableDrop = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        setIsDraggingToAvailable(false);
        if (!draggedCourse || !draggedCourse.day) return;

        const originalCourseData = allCoursesData.find(
            (c) => c.sectionId === draggedCourse.sectionId
        );
        if (originalCourseData) {
            setSchedule((prevSchedule) =>
                removeCourseFromScheduleState(
                    draggedCourse.sectionId,
                    prevSchedule
                )
            );
            let displayYear = draggedCourse.year || 1; // Use year from dragged course or default
            if (
                originalCourseData.major &&
                /Year\s+(\d+)/.test(originalCourseData.major)
            ) {
                const match = originalCourseData.major.match(/Year\s+(\d+)/);
                if (match && match[1]) displayYear = parseInt(match[1], 10);
            }
            const courseForAvailableList: ExtendedTimetableCourse = {
                // Cast to ExtendedTimetableCourse, ensure all necessary fields are present
                ...(originalCourseData as unknown as ExtendedTimetableCourse), // This assumes originalCourseData is compatible
                color:
                    colors_class[
                        originalCourseData.color as keyof typeof colors_class
                    ] || colors_class.default,
                instructor: `${originalCourseData.firstName || ""} ${
                    originalCourseData.lastName || ""
                }`.trim(),
                year: displayYear,
                day: undefined,
                startTime: undefined,
                endTime: undefined,
                isStart: undefined,
                isMiddle: undefined,
                isEnd: undefined,
                colspan: undefined,
            };
            if (
                !availableCourses.some(
                    (c) => c.sectionId === courseForAvailableList.sectionId
                )
            ) {
                setAvailableCourses((prev) => [
                    ...prev,
                    courseForAvailableList,
                ]);
            }
        }
        setDraggedCourse(null);
    };

    const handleDrop = (
        majorYearRowId: string,
        day: string,
        timeSlotKey: string
    ) => {
        if (!draggedCourse || timeSlots.length === 0) return;
        const targetRowInfo = majorYearDisplayRows.find(
            (r) => r.id === majorYearRowId
        );
        if (!targetRowInfo) return;

        const timeSlotIndex = timeSlots.findIndex(
            (ts) => getTimeSlotKey(ts) === timeSlotKey
        );
        if (timeSlotIndex === -1) return;

        for (let i = 0; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) {
                alert("Course duration exceeds available time slots.");
                return;
            }
            const nextTimeSlotKeyToCheck = getTimeSlotKey(
                timeSlots[timeSlotIndex + i]
            );
            const nextScheduleKey = `${majorYearRowId}-${day}-${nextTimeSlotKeyToCheck}`;
            if (
                schedule[nextScheduleKey] &&
                schedule[nextScheduleKey].sectionId !== draggedCourse.sectionId
            ) {
                alert("Conflict with another course.");
                return;
            }
        }

        let newSchedule = removeCourseFromScheduleState(
            draggedCourse.sectionId,
            schedule
        );
        const endTimeIndex = timeSlotIndex + draggedCourse.duration - 1;
        const actualEndTimeSlot =
            timeSlots[Math.min(endTimeIndex, timeSlots.length - 1)];
        const assignedCourse: ExtendedTimetableCourse = {
            ...draggedCourse,
            day,
            year: targetRowInfo.year,
            major: targetRowInfo.majorName,
            startTime:
                timeSlots[timeSlotIndex].startTime ||
                getTimeSlotKey(timeSlots[timeSlotIndex]),
            endTime:
                actualEndTimeSlot.endTime ||
                actualEndTimeSlot.time_slot?.split("-")[1]?.trim() ||
                actualEndTimeSlot.time_slot,
            room: draggedCourse.room || (draggedCourse as any).classroom, // Handle potential classroom field
            subtext: draggedCourse.subtext,
        };

        for (let i = 0; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;
            const currentTimeSlot = getTimeSlotKey(
                timeSlots[timeSlotIndex + i]
            );
            const currentScheduleKey = `${majorYearRowId}-${day}-${currentTimeSlot}`;
            newSchedule[currentScheduleKey] = {
                ...assignedCourse,
                isStart: i === 0,
                isMiddle: i > 0 && i < draggedCourse.duration - 1,
                isEnd: i === draggedCourse.duration - 1,
                colspan: i === 0 ? draggedCourse.duration : 0,
            };
        }
        setSchedule(newSchedule);
        setAvailableCourses((prev) =>
            prev.filter((c) => c.sectionId !== draggedCourse.sectionId)
        );
        setDraggedCourse(null);
    };

    const handleCourseClick = (courseInSchedule: ExtendedTimetableCourse) => {
        setSelectedCourse(courseInSchedule);
        setIsDialogOpen(true);
    };

    const handleRemoveCourseDialog = () => {
        if (!selectedCourse || !selectedCourse.day) return;
        const originalCourseData = allCoursesData.find(
            (c) => c.sectionId === selectedCourse.sectionId
        );
        if (originalCourseData) {
            setSchedule((prevSchedule) =>
                removeCourseFromScheduleState(
                    selectedCourse.sectionId,
                    prevSchedule
                )
            );
            let displayYear = selectedCourse.year || 1;
            if (
                originalCourseData.major &&
                /Year\s+(\d+)/.test(originalCourseData.major)
            ) {
                const match = originalCourseData.major.match(/Year\s+(\d+)/);
                if (match && match[1]) displayYear = parseInt(match[1], 10);
            }
            const courseForAvailableList: ExtendedTimetableCourse = {
                sectionId: originalCourseData.sectionId,
                code: originalCourseData.code,
                name: originalCourseData.title,
                color:
                    colors_class[
                        originalCourseData.color as keyof typeof colors_class
                    ] || colors_class.default,
                instructor: `${originalCourseData.firstName || ""} ${
                    originalCourseData.lastName || ""
                }`.trim(),
                duration: originalCourseData.duration,
                section: originalCourseData.section,
                year: displayYear,
                room: originalCourseData.classroom,
            };
            if (
                !availableCourses.some(
                    (c) => c.sectionId === courseForAvailableList.sectionId
                )
            ) {
                setAvailableCourses((prev) => [
                    ...prev,
                    courseForAvailableList,
                ]);
            }
        }
        setIsDialogOpen(false);
        setSelectedCourse(null);
    };

    const saveAllAssignments = async () => {
        const assignmentsToSave: any[] = [];
        Object.values(schedule).forEach((course) => {
            if (course.isStart && course.day && course.startTime) {
                assignmentsToSave.push({
                    sectionId: course.sectionId,
                    day: course.day,
                    startTime: course.startTime,
                    endTime: course.endTime,
                    classroom: course.room || (course as any).classroom || null, // Handle potential classroom field
                });
            }
        });
        try {
            const response = await fetch("/api/assign-time-slots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scheduleId: params.id,
                    assignments: assignmentsToSave,
                }),
            });
            if (response.ok) alert("All assignments saved successfully!");
            else {
                const errorData = await response.json();
                alert(`Failed to save: ${errorData.error || "Unknown"}`);
            }
        } catch (error) {
            console.error("Error saving:", error);
            alert(
                `Error saving: ${
                    error instanceof Error ? error.message : "Unknown"
                }`
            );
        }
    };

    const generateSchedule = async () => {
        if (!params.id) {
            alert("Schedule ID missing");
            return;
        }
        setIsGeneratingSchedule(true);
        try {
            const response = await fetch(
                `/api/generate-schedule?scheduleId=${params.id}`,
                { method: "POST" }
            );
            if (!response.ok)
                throw new Error(`Failed to generate: ${response.statusText}`);
            setScheduleGenerated(true);
            await loadInitialData(); // Reload data after generation
        } catch (error) {
            console.error("Error generating:", error);
            alert(
                `Error generating: ${
                    error instanceof Error ? error.message : "Unknown"
                }`
            );
        } finally {
            setIsGeneratingSchedule(false);
        }
    };

    if (
        isLoading &&
        majorYearDisplayRows.length === 0 &&
        timeSlots.length === 0
    ) {
        return (
            <div className="text-center py-12">
                Loading schedule configuration...
            </div>
        );
    }

    return (
        <div className="relative min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Major Timetable</h2>
                <div className="flex gap-2">
                    <Button
                        onClick={generateSchedule}
                        variant="outline"
                        disabled={isGeneratingSchedule}
                    >
                        {isGeneratingSchedule
                            ? "Generating..."
                            : "Auto-Generate Schedule"}
                    </Button>
                    <Button onClick={saveAllAssignments}>Save All</Button>
                </div>
            </div>

            {scheduleGenerated && (
                <div className="bg-green-50 border border-green-200 text-green-800 p-3 mb-4 rounded">
                    <p>
                        Schedule generated successfully! You can still make
                        manual adjustments by dragging courses.
                    </p>
                </div>
            )}

            {(majorYearDisplayRows.length === 0 || timeSlots.length === 0) &&
            !isLoading ? (
                <div className="text-center py-8 text-gray-500">
                    {majorYearDisplayRows.length === 0
                        ? "No majors configured. "
                        : ""}
                    {timeSlots.length === 0 ? "No time slots configured." : ""}
                </div>
            ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] mb-40">
                    <div className="inline-block min-w-full">
                        <div className="border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-blue-200">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-24 border">
                                            Major/Yr
                                        </th>
                                        {days.map((day) => (
                                            <th
                                                key={day}
                                                colSpan={timeSlots.length}
                                                className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border"
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
                                            timeSlots.map((slot) => (
                                                <th
                                                    key={`${day}-${getTimeSlotKey(
                                                        slot
                                                    )}`}
                                                    className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border"
                                                >
                                                    {slot.time_slot ||
                                                        slot.startTime}
                                                </th>
                                            ))
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {majorYearDisplayRows.map((row, index) => (
                                        <tr
                                            key={row.id}
                                            className={
                                                index % 2 === 0
                                                    ? "bg-white"
                                                    : "bg-white"
                                            }
                                        >
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium border text-gray-700">
                                                {row.displayName}
                                            </td>
                                            {days.map((day) =>
                                                timeSlots.map((slot) => {
                                                    const slotKey =
                                                        getTimeSlotKey(slot);
                                                    const scheduleCellKey = `${row.id}-${day}-${slotKey}`;
                                                    const course =
                                                        schedule[
                                                            scheduleCellKey
                                                        ];

                                                    if (
                                                        course &&
                                                        !course.isStart
                                                    )
                                                        return null;

                                                    return (
                                                        <td
                                                            key={`${row.id}-${day}-${slotKey}`}
                                                            className="px-1 py-1 whitespace-nowrap text-xs border"
                                                            colSpan={
                                                                course?.colspan ||
                                                                1
                                                            }
                                                            onDragOver={
                                                                handleDragOver
                                                            }
                                                            onDrop={() =>
                                                                handleDrop(
                                                                    row.id,
                                                                    day,
                                                                    slotKey
                                                                )
                                                            }
                                                        >
                                                            {course ? (
                                                                <div
                                                                    className={`${course.color} p-1 rounded cursor-pointer text-center border shadow-sm transition-all font-medium`}
                                                                    onClick={() =>
                                                                        handleCourseClick(
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
                                                                    <div className="font-semibold truncate">
                                                                        {
                                                                            course.code
                                                                        }
                                                                    </div>
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
            )}

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
                                    {selectedCourse.code}:{" "}
                                    {selectedCourse.name ||
                                        (selectedCourse as any).title}
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
                                            {selectedCourse.instructor || "N/A"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Room:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.room ||
                                                (selectedCourse as any)
                                                    .classroom ||
                                                "TBA"}
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
                                            Section:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.section || "N/A"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Year Context:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.year}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Major Context:
                                        </span>
                                        <span className="text-sm font-medium">
                                            {selectedCourse.major}
                                        </span>
                                    </div>
                                    {selectedCourse.subtext && (
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">
                                                Details:
                                            </span>
                                            <span className="text-sm font-medium">
                                                {selectedCourse.subtext}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <DialogFooter className="flex justify-end gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleRemoveCourseDialog}
                                >
                                    Remove
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
