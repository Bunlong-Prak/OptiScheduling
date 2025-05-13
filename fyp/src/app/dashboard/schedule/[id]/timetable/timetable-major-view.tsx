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

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface TimeSlot {
    id: number;
    time_slot?: string;
    startTime?: string;
    endTime?: string;
}

interface Major {
    id: number;
    name: string;
    shortTag?: string;
    year?: number | null;
    numberOfYears?: number;
}

interface Course {
    sectionId: string | number;
    code: string;
    title?: string;
    name?: string;
    color: string;
    section?: string;
    major?: string;
    instructor?: string;
    firstName?: string;
    lastName?: string;
    duration: number;
    day?: string;
    startTime?: string;
    endTime?: string;
    classroom?: string;
    room?: string;
    year?: number;
    isStart?: boolean;
    isMiddle?: boolean;
    isEnd?: boolean;
    colspan?: number;
    subtext?: string; // Added for potential secondary line display in cell
}

interface Schedule {
    [key: string]: Course;
}

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
    const [majorYearDisplayRows, setMajorYearDisplayRows] = useState<MajorYearDisplayRow[]>([]);
    const [allCoursesData, setAllCoursesData] = useState<Course[]>([]);
    const [schedule, setSchedule] = useState<Schedule>({});
    const [availableCourses, setAvailableCourses] = useState<Course[]>([]);

    const [draggedCourse, setDraggedCourse] = useState<Course | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [isDraggingToAvailable, setIsDraggingToAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

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
                const response = await fetch(`/api/schedules`); // Assuming this fetches schedule config including time slots
                if (response.ok) {
                    const schedulesData = await response.json();
                    const currentSchedule = schedulesData.find(
                        (s: { id: { toString: () => string | string[]; } }) => s.id.toString() === params.id
                    );
                    if (currentSchedule && currentSchedule.timeSlots) {
                        const apiTimeSlots = currentSchedule.timeSlots.map(
                            (slot: TimeSlot) => {
                                const formattedSlot: TimeSlot = {
                                    id: slot.id,
                                    time_slot: slot.time_slot || (slot.startTime && slot.endTime ? `${slot.startTime}-${slot.endTime}` : slot.startTime),
                                    startTime: slot.startTime,
                                    endTime: slot.endTime,
                                };
                                if (!slot.startTime && !slot.endTime && slot.time_slot && slot.time_slot.includes("-")) {
                                    const [startTime, endTime] = slot.time_slot.split("-").map((time) => time.trim());
                                    formattedSlot.startTime = startTime;
                                    formattedSlot.endTime = endTime;
                                }
                                return formattedSlot;
                            }
                        );
                        setTimeSlots(apiTimeSlots);
                    } else {
                        console.error("No time slots found for schedule", params.id);
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
                const response = await fetch(`/api/majors?scheduleId=${params.id}`);
                if (!response.ok) throw new Error(`Failed to fetch majors: ${response.statusText}`);
                
                const data: Major[] = await response.json();
                setAllMajors(data);

                const baseMajorsMap: Map<string, Major> = new Map();
                data.forEach(major => {
                    const baseName = major.name.replace(/\s+Year\s+\d+$/, '').trim();
                    if (!baseMajorsMap.has(baseName) || (baseMajorsMap.get(baseName)!.year !== undefined && major.year === undefined)) {
                        baseMajorsMap.set(baseName, {
                            ...major,
                            name: baseName,
                            numberOfYears: major.numberOfYears || baseMajorsMap.get(baseName)?.numberOfYears || 4 
                        });
                    } else {
                        const existing = baseMajorsMap.get(baseName)!;
                        if (major.numberOfYears && (!existing.numberOfYears || major.numberOfYears > existing.numberOfYears)) {
                            existing.numberOfYears = major.numberOfYears;
                        }
                    }
                });

                const processedRows: MajorYearDisplayRow[] = [];
                Array.from(baseMajorsMap.values()).forEach(baseMajor => {
                    const numYears = baseMajor.numberOfYears || 4;
                    for (let y = 1; y <= numYears; y++) {
                        processedRows.push({
                            id: `${baseMajor.id}-${y}`,
                            displayName: `${baseMajor.shortTag || baseMajor.name.substring(0, 3).toUpperCase()}${y}`,
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
                console.error("Error fetching majors or processing rows:", error);
            }
        };
        if (params.id) fetchMajorsAndPrepareRows();
    }, [params.id]);
    
    const loadInitialData = useCallback(async () => {
        if (!params.id || timeSlots.length === 0 || majorYearDisplayRows.length === 0) {
            if (params.id && (timeSlots.length > 0 && majorYearDisplayRows.length > 0)) setIsLoading(false); // Only set to false if params are there but data is missing
            return;
        }

        setIsLoading(true);
        try {
            const scheduleId = params.id;
            const coursesResponse = await fetch(`/api/courses?scheduleId=${scheduleId}`);
            if (!coursesResponse.ok) throw new Error("Failed to fetch courses");
            const fetchedCourses: Course[] = await coursesResponse.json();
            setAllCoursesData(fetchedCourses);

            const assignmentsResponse = await fetch(`/api/assign-time-slots?scheduleId=${scheduleId}`);
            if (!assignmentsResponse.ok) throw new Error("Failed to fetch assignments");
            const assignmentsData: any[] = await assignmentsResponse.json();

            const newSchedule: Schedule = {};
            const assignedCourseSectionIds = new Set<string | number>();

            assignmentsData.forEach((assignment) => {
                let targetRow: MajorYearDisplayRow | undefined = undefined;
                if (assignment.major) {
                    const majorNameMatch = assignment.major.match(/^(.*?)(\s+Year\s+(\d+))?$/);
                    if (majorNameMatch) {
                        const assignmentMajorBaseName = majorNameMatch[1].trim();
                        const assignmentYear = majorNameMatch[3] ? parseInt(majorNameMatch[3], 10) : null;
                        targetRow = majorYearDisplayRows.find(row =>
                            row.majorName.toLowerCase() === assignmentMajorBaseName.toLowerCase() &&
                            (assignmentYear === null || row.year === assignmentYear)
                        );
                    }
                }
                if (!targetRow && assignment.section) {
                    const sectionPrefixMatch = assignment.section.match(/^([A-Za-z]+)(\d)/);
                    if (sectionPrefixMatch) {
                        const sectionMajorTag = sectionPrefixMatch[1].toUpperCase();
                        const sectionYear = parseInt(sectionPrefixMatch[2], 10);
                        targetRow = majorYearDisplayRows.find(row =>
                            (row.displayName.startsWith(sectionMajorTag) && row.year === sectionYear)
                        );
                    }
                }

                if (!targetRow || !assignment.day || !assignment.startTime) return;

                const courseDetails: Partial<Course> = fetchedCourses.find(c => c.sectionId === assignment.sectionId) || {};
                const fullCourseData: Course = {
                    ...assignment, ...courseDetails, sectionId: assignment.sectionId,
                    code: courseDetails.code || assignment.code || "N/A",
                    name: courseDetails.title || courseDetails.name || assignment.title || assignment.name,
                    color: colors_class[(courseDetails.color || assignment.color) as keyof typeof colors_class] || colors_class.default,
                    instructor: `${assignment.firstName || courseDetails.firstName || ""} ${assignment.lastName || courseDetails.lastName || ""}`.trim(),
                    duration: parseInt(String(courseDetails.duration || assignment.duration || "1"), 10),
                    year: targetRow.year, major: targetRow.majorName,
                    subtext: courseDetails.subtext || assignment.subtext // Capture subtext if available
                };

                const startIndex = timeSlots.findIndex(ts => getTimeSlotKey(ts) === assignment.startTime || ts.startTime === assignment.startTime);
                if (startIndex === -1) return;

                for (let i = 0; i < fullCourseData.duration; i++) {
                    if (startIndex + i >= timeSlots.length) break;
                    const currentTimeSlotKey = getTimeSlotKey(timeSlots[startIndex + i]);
                    const scheduleKey = `${targetRow.id}-${assignment.day}-${currentTimeSlotKey}`;
                    newSchedule[scheduleKey] = {
                        ...fullCourseData, isStart: i === 0,
                        isMiddle: i > 0 && i < fullCourseData.duration - 1,
                        isEnd: i === fullCourseData.duration - 1,
                        colspan: i === 0 ? fullCourseData.duration : 0,
                    };
                }
                assignedCourseSectionIds.add(fullCourseData.sectionId);
            });
            setSchedule(newSchedule);

            const unassigned = fetchedCourses
                .filter(course => !assignedCourseSectionIds.has(course.sectionId))
                .map(course => {
                    let displayYear = 1;
                    if (course.section && /[A-Za-z]+(\d+)/.test(course.section)) {
                        const match = course.section.match(/[A-Za-z]+(\d+)/);
                        if (match && match[1]) displayYear = parseInt(match[1], 10);
                    } else if (course.major && /Year\s+(\d+)/.test(course.major)) {
                        const match = course.major.match(/Year\s+(\d+)/);
                        if (match && match[1]) displayYear = parseInt(match[1], 10);
                    }
                    return {
                        ...course,
                        color: colors_class[course.color as keyof typeof colors_class] || colors_class.default,
                        year: displayYear, 
                        instructor: `${course.firstName || ""} ${course.lastName || ""}`.trim(),
                    };
                });
            setAvailableCourses(unassigned);

        } catch (error) {
            console.error("Error loading initial schedule data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [params.id, timeSlots, majorYearDisplayRows, getTimeSlotKey]);

    useEffect(() => {
        if (params.id && timeSlots.length > 0 && majorYearDisplayRows.length > 0) {
             loadInitialData();
        } else if (!params.id) {
            setIsLoading(false); // No ID, nothing to load
        }
         // If params.id is present but timeSlots or majorYearDisplayRows are not ready,
         // loadInitialData will bail out until they are. setIsLoading(true) is set at the start of loadInitialData.
    }, [params.id, timeSlots, majorYearDisplayRows, loadInitialData]);


    const handleDragStart = (course: Course) => setDraggedCourse(course);
    const handleDragOver = (e: React.DragEvent<HTMLElement>) => e.preventDefault();
    const handleAvailableDragOver = (e: React.DragEvent<HTMLElement>) => { e.preventDefault(); setIsDraggingToAvailable(true); };
    const handleAvailableDragLeave = (e: React.DragEvent<HTMLElement>) => { e.preventDefault(); setIsDraggingToAvailable(false); };

    const removeCourseFromScheduleState = (courseIdToRemove: string | number, currentSchedule: Schedule) => {
        const updatedSchedule = { ...currentSchedule };
        Object.keys(updatedSchedule).forEach((key) => {
            if (updatedSchedule[key].sectionId === courseIdToRemove) delete updatedSchedule[key];
        });
        return updatedSchedule;
    };
    
    const handleAvailableDrop = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault(); setIsDraggingToAvailable(false);
        if (!draggedCourse || !draggedCourse.day) return;

        const originalCourseData = allCoursesData.find(c => c.sectionId === draggedCourse.sectionId);
        if (originalCourseData) {
            setSchedule(prevSchedule => removeCourseFromScheduleState(draggedCourse.sectionId, prevSchedule));
            let displayYear = draggedCourse.year || 1; // Use year from dragged course or default
            if (originalCourseData.major && /Year\s+(\d+)/.test(originalCourseData.major)) {
                 const match = originalCourseData.major.match(/Year\s+(\d+)/);
                 if (match && match[1]) displayYear = parseInt(match[1], 10);
            }
            const courseForAvailableList: Course = {
                ...originalCourseData,
                color: colors_class[originalCourseData.color as keyof typeof colors_class] || colors_class.default,
                instructor: `${originalCourseData.firstName || ""} ${originalCourseData.lastName || ""}`.trim(),
                year: displayYear,
                day: undefined, startTime: undefined, endTime: undefined, isStart: undefined, isMiddle: undefined, isEnd: undefined, colspan: undefined,
            };
            if (!availableCourses.some(c => c.sectionId === courseForAvailableList.sectionId)) {
                 setAvailableCourses(prev => [...prev, courseForAvailableList]);
            }
        }
        setDraggedCourse(null);
    };

    const handleDrop = (majorYearRowId: string, day: string, timeSlotKey: string) => {
        if (!draggedCourse || timeSlots.length === 0) return;
        const targetRowInfo = majorYearDisplayRows.find(r => r.id === majorYearRowId);
        if (!targetRowInfo) return;

        const timeSlotIndex = timeSlots.findIndex(ts => getTimeSlotKey(ts) === timeSlotKey);
        if (timeSlotIndex === -1) return;

        for (let i = 0; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) { alert("Course duration exceeds available time slots."); return; }
            const nextTimeSlotKeyToCheck = getTimeSlotKey(timeSlots[timeSlotIndex + i]);
            const nextScheduleKey = `${majorYearRowId}-${day}-${nextTimeSlotKeyToCheck}`;
            if (schedule[nextScheduleKey] && schedule[nextScheduleKey].sectionId !== draggedCourse.sectionId) {
                alert("Conflict with another course."); return;
            }
        }

        let newSchedule = removeCourseFromScheduleState(draggedCourse.sectionId, schedule);
        const endTimeIndex = timeSlotIndex + draggedCourse.duration - 1;
        const actualEndTimeSlot = timeSlots[Math.min(endTimeIndex, timeSlots.length - 1)];
        const assignedCourse: Course = {
            ...draggedCourse, day: day, year: targetRowInfo.year, major: targetRowInfo.majorName,
            startTime: timeSlots[timeSlotIndex].startTime || getTimeSlotKey(timeSlots[timeSlotIndex]),
            endTime: actualEndTimeSlot.endTime || actualEndTimeSlot.time_slot?.split("-")[1]?.trim() || actualEndTimeSlot.time_slot,
            room: draggedCourse.room || draggedCourse.classroom,
            subtext: draggedCourse.subtext // Preserve subtext if dragged from available
        };

        for (let i = 0; i < draggedCourse.duration; i++) {
            if (timeSlotIndex + i >= timeSlots.length) break;
            const currentTimeSlot = getTimeSlotKey(timeSlots[timeSlotIndex + i]);
            const currentScheduleKey = `${majorYearRowId}-${day}-${currentTimeSlot}`;
            newSchedule[currentScheduleKey] = {
                ...assignedCourse, isStart: i === 0,
                isMiddle: i > 0 && i < draggedCourse.duration - 1,
                isEnd: i === draggedCourse.duration - 1,
                colspan: i === 0 ? draggedCourse.duration : 0,
            };
        }
        setSchedule(newSchedule);
        setAvailableCourses(prev => prev.filter(c => c.sectionId !== draggedCourse.sectionId));
        setDraggedCourse(null);
    };

    const handleCourseClick = (courseInSchedule: Course) => { setSelectedCourse(courseInSchedule); setIsDialogOpen(true); };

    const handleRemoveCourseDialog = () => {
        if (!selectedCourse || !selectedCourse.day) return;
        const originalCourseData = allCoursesData.find(c => c.sectionId === selectedCourse.sectionId);
        if (originalCourseData) {
            setSchedule(prevSchedule => removeCourseFromScheduleState(selectedCourse.sectionId, prevSchedule));
            let displayYear = selectedCourse.year || 1;
             if (originalCourseData.major && /Year\s+(\d+)/.test(originalCourseData.major)) { // Check original major string
                const match = originalCourseData.major.match(/Year\s+(\d+)/);
                if (match && match[1]) displayYear = parseInt(match[1], 10);
            }
            const courseForAvailableList: Course = {
                ...originalCourseData,
                color: colors_class[originalCourseData.color as keyof typeof colors_class] || colors_class.default,
                instructor: `${originalCourseData.firstName || ""} ${originalCourseData.lastName || ""}`.trim(),
                year: displayYear,
                day: undefined, startTime: undefined, endTime: undefined, isStart: undefined, isMiddle: undefined, isEnd: undefined, colspan: undefined,
            };
            if (!availableCourses.some(c => c.sectionId === courseForAvailableList.sectionId)) {
                setAvailableCourses(prev => [...prev, courseForAvailableList]);
            }
        }
        setIsDialogOpen(false); setSelectedCourse(null);
    };

    const saveAllAssignments = async () => {
        const assignmentsToSave: any[] = [];
        Object.values(schedule).forEach(course => {
            if (course.isStart && course.day && course.startTime) {
                assignmentsToSave.push({
                    sectionId: course.sectionId, day: course.day, startTime: course.startTime,
                    endTime: course.endTime, classroom: course.room || course.classroom || null,
                });
            }
        });
        try {
            const response = await fetch("/api/assign-time-slots", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scheduleId: params.id, assignments: assignmentsToSave }),
            });
            if (response.ok) alert("All assignments saved successfully!");
            else { const errorData = await response.json(); alert(`Failed to save: ${errorData.error || "Unknown"}`); }
        } catch (error) { console.error("Error saving:", error); alert(`Error saving: ${error instanceof Error ? error.message : "Unknown"}`); }
    };

    const generateSchedule = async () => {
        if (!params.id) { alert("Schedule ID missing"); return; }
        setIsLoading(true);
        try {
            const response = await fetch(`/api/generate-schedule?scheduleId=${params.id}`, { method: "POST" });
            if (!response.ok) throw new Error(`Failed to generate: ${response.statusText}`);
            alert("Schedule generated! Refreshing view...");
            await loadInitialData();
        } catch (error) { console.error("Error generating:", error); alert(`Error generating: ${error instanceof Error ? error.message : "Unknown"}`); setIsLoading(false); }
    };
    
    const switchToClassroomView = () => window.location.href = `/schedule/${params.id}/timetable`;

    if (isLoading && majorYearDisplayRows.length === 0 && timeSlots.length === 0) {
        return <div className="text-center py-12">Loading schedule configuration...</div>;
    }
    
    return (
        <div className="relative min-h-screen p-2 md:p-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 md:mb-6 gap-2">
                <h2 className="text-lg md:text-xl font-bold">Major Timetable</h2>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={generateSchedule} variant="outline" size="sm" disabled={isLoading}>{isLoading ? "Generating..." : "Auto-Generate"}</Button>
                    <Button onClick={saveAllAssignments} size="sm" disabled={isLoading}>Save All</Button>
                    <Button onClick={switchToClassroomView} size="sm" variant="outline">Classroom View</Button>
                </div>
            </div>

            {(majorYearDisplayRows.length === 0 || timeSlots.length === 0) && !isLoading ? (
                 <div className="text-center py-8 text-gray-500">
                    {majorYearDisplayRows.length === 0 ? "No majors configured. " : ""}
                    {timeSlots.length === 0 ? "No time slots configured." : ""}
                </div>
            ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] mb-28 md:mb-32 shadow-lg rounded-md border border-gray-300">
                    <div className="inline-block min-w-full align-middle">
                        <table className="min-w-full divide-y divide-gray-300">
                             <thead className="bg-gray-100 sticky top-0 z-10">
                               <tr>
                                 <th scope="col" className="px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-b border-gray-300 w-20 min-w-[80px]">
                                   Major/Yr
                                 </th>
                                 {days.map((day) => (
                                   <th scope="col" key={day} colSpan={timeSlots.length} className="px-1 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-b border-gray-300 last:border-r-0">
                                     {day}
                                   </th>
                                 ))}
                               </tr>
                               <tr>
                                 <th scope="col" className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-b border-gray-300">
                                   Time
                                 </th>
                                 {days.map((day) =>
                                   timeSlots.map((slot) => (
                                     <th scope="col" key={`${day}-${getTimeSlotKey(slot)}`} className="px-1 py-1.5 text-center text-[9px] font-medium text-gray-500 uppercase tracking-tighter border-r border-b border-gray-300 whitespace-nowrap last:border-r-0">
                                       {slot.time_slot?.replace(/-/g, '-\u200B') || slot.startTime?.replace(/-/g, '-\u200B')}
                                     </th>
                                   ))
                                 )}
                               </tr>
                             </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {majorYearDisplayRows.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold border-r border-gray-300 text-gray-700 align-middle bg-slate-50 sticky left-0 z-5"> {/* Sticky first column */}
                                            {row.displayName}
                                        </td>
                                        {days.map((day) =>
                                            timeSlots.map((slot, slotIndex) => {
                                                const slotKey = getTimeSlotKey(slot);
                                                const scheduleCellKey = `${row.id}-${day}-${slotKey}`;
                                                const course = schedule[scheduleCellKey];

                                                if (course && !course.isStart) return null;

                                                return (
                                                    <td
                                                        key={`${row.id}-${day}-${slotKey}-${slotIndex}`}
                                                        className={`px-0.5 py-0.5 text-[10px] border-r border-gray-300 relative h-10 ${course ? '' : 'hover:bg-gray-100 transition-colors'}`}
                                                        colSpan={course?.colspan || 1}
                                                        onDragOver={handleDragOver}
                                                        onDrop={() => handleDrop(row.id, day, slotKey)}
                                                    >
                                                        {course ? (
                                                            <div
                                                                className={`${course.color} p-0.5 h-full rounded-sm cursor-pointer text-center shadow-sm transition-all font-medium flex flex-col items-center justify-center text-white text-[10px] leading-tight`}
                                                                onClick={() => handleCourseClick(course)}
                                                                draggable
                                                                onDragStart={() => handleDragStart(course)}
                                                            >
                                                                <div className="font-semibold truncate w-full px-0.5">{course.code}</div>
                                                                {course.subtext && <div className="text-[8px] truncate w-full px-0.5">{course.subtext}</div>}
                                                                {!course.subtext && course.room && <div className="text-[8px] truncate w-full px-0.5">Rm:{course.room}</div>}

                                                            </div>
                                                        ) : ( <div className="h-full w-full" /> )}
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
            )}

            <div
                className={`fixed bottom-0 left-0 right-0 bg-gray-50 p-2 md:p-3 rounded-t-lg shadow-[-2px_-5px_15px_-3px_rgba(0,0,0,0.1)] z-20 border-t-2 border-blue-500 ${isDraggingToAvailable ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
                onDragOver={handleAvailableDragOver} onDragLeave={handleAvailableDragLeave} onDrop={handleAvailableDrop}
            >
                <div className="max-w-screen-xl mx-auto">
                    <h3 className="text-sm md:text-base font-semibold mb-2 flex items-center text-gray-700">
                        Available Courses
                        {isDraggingToAvailable && <span className="ml-2 text-blue-600 animate-pulse text-xs">(Drop to Unassign)</span>}
                    </h3>
                    {isLoading && availableCourses.length === 0 ? (
                        <div className="text-center py-2 text-xs text-gray-500">Loading courses...</div>
                    ) : availableCourses.length === 0 ? (
                        <div className="text-center py-2 text-xs text-gray-500">All courses assigned.</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-1.5 md:gap-2 max-h-[15vh] md:max-h-[18vh] overflow-y-auto p-1">
                            {availableCourses.map((course) => (
                                <div
                                    key={course.sectionId.toString()}
                                    className={`${course.color} p-1.5 rounded-md shadow cursor-move hover:shadow-md transition-all border border-black/20 text-white`}
                                    draggable onDragStart={() => handleDragStart(course)}
                                >
                                    <h4 className="font-bold text-[10px] md:text-xs truncate">{course.code}</h4>
                                    <p className="text-[9px] md:text-[10px] font-medium truncate">{course.name || course.title}</p>
                                    <p className="text-[8px] md:text-[9px] mt-0.5 text-gray-100/80">Dur: {course.duration}h, Yr: {course.year}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-xs md:max-w-sm">
                    <DialogHeader><DialogTitle className="text-lg font-semibold">Course Details</DialogTitle></DialogHeader>
                    {selectedCourse && (
                        <div className="space-y-3 py-1">
                            <div className={`w-full h-1 rounded ${selectedCourse.color?.replace("hover:", "").replace("border-", "")}`}></div>
                            <h3 className="font-semibold text-base">{selectedCourse.code}: {selectedCourse.name || selectedCourse.title}</h3>
                            <div className="space-y-1 text-xs">
                                {[
                                    { label: "Duration", value: `${selectedCourse.duration} hour(s)` },
                                    { label: "Instructor", value: selectedCourse.instructor || "N/A" },
                                    { label: "Room", value: selectedCourse.room || selectedCourse.classroom || "TBA" },
                                    { label: "Time", value: `${selectedCourse.day}, ${selectedCourse.startTime} - ${selectedCourse.endTime}` },
                                    { label: "Section", value: selectedCourse.section || "N/A" },
                                    { label: "Year Context", value: selectedCourse.year },
                                    { label: "Major Context", value: selectedCourse.major },
                                    { label: "Details", value: selectedCourse.subtext || "N/A"}
                                ].map(item => (
                                    <div key={item.label} className="flex justify-between">
                                        <span className="text-gray-500">{item.label}:</span>
                                        <span className="font-medium text-gray-800 text-right">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                            <DialogFooter className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Close</Button>
                                <Button variant="destructive" size="sm" onClick={handleRemoveCourseDialog}>Remove</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}