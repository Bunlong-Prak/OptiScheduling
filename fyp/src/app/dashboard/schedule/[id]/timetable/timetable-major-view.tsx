"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { colors_class } from "@/components/custom/colors";
import { useParams } from "next/navigation";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MajorView() {
   // Type definitions
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
     years?: number[];
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
   }
  
   interface Schedule {
     [key: string]: Course;
   }
  
   interface YearCourses {
     [year: number]: Course[];
   }
  
   // State variables
   const [schedule, setSchedule] = useState<Schedule>({});
   const [majors, setMajors] = useState<Major[]>([]);
   const [selectedMajor, setSelectedMajor] = useState<Major | null>(null);
   const [draggedCourse, setDraggedCourse] = useState<Course | null>(null);
   const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
   const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
   const [yearCourses, setYearCourses] = useState<YearCourses>({
     1: [],
     2: [],
     3: [],
     4: [],
     5: [],
     6: []
   });
   const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
   const [isDraggingToAvailable, setIsDraggingToAvailable] = useState(false);
   const [filteredMajorId, setFilteredMajorId] = useState<number | null>(null); // Corrected type
   const [activeYears, setActiveYears] = useState<number[]>([]); // Corrected type
   const [isLoading, setIsLoading] = useState(false);
   const [isDialogOpen, setIsDialogOpen] = useState(false);

   const params = useParams();

   // Helper function to get consistent time slot key
   const getTimeSlotKey = (timeSlot: TimeSlot | string) => { // Added type for timeSlot
     // If it's a time slot string like "8:00-9:00", use it directly
     if (typeof timeSlot === "string") {
         return timeSlot;
     }

     // If it's an object with startTime, use that
     if (timeSlot.startTime) {
         return timeSlot.startTime;
     }

     // If it's an object with time_slot, use that
     if (timeSlot.time_slot) {
         return timeSlot.time_slot;
     }

     return String(timeSlot); // Fallback, ensure string conversion
   };

   // Fetch time slots
   useEffect(() => {
     const fetchTimeSlots = async () => {
       try {
         const scheduleId = params.id;
         const response = await fetch(`/api/schedules`);

         if (response.ok) {
           const schedulesData = await response.json();
           // Find the current schedule by ID
           const currentSchedule = schedulesData.find(
             (s: { id: { toString: () => string | string[]; }; }) => s.id.toString() === scheduleId // Added type for s
           );

           if (currentSchedule && currentSchedule.timeSlots) {
             // Transform API time slots to a consistent format
             const apiTimeSlots = currentSchedule.timeSlots.map(
               (slot: TimeSlot) => { // Added type for slot
                 const formattedSlot: TimeSlot = { // Ensured consistent type
                   id: slot.id,
                   time_slot:
                     slot.time_slot ||
                     (slot.startTime && slot.endTime
                       ? `${slot.startTime}-${slot.endTime}`
                       : slot.startTime),
                   startTime: slot.startTime,
                   endTime: slot.endTime,
                 };

                 // If time_slot already has start/end times but not as separate properties
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
             console.error("No time slots found for schedule", scheduleId);
           }
         } else {
           console.error("Failed to fetch schedules");
         }
       } catch (error) {
         console.error("Error fetching time slots:", error);
       }
     };

     if (params.id) { // Ensure params.id exists before fetching
        fetchTimeSlots();
     }
   }, [params.id]);

   // Fetch majors
   useEffect(() => {
     const fetchMajors = async () => {
       try {
         const scheduleId = params.id;
         if (!scheduleId) {
           console.error("Schedule ID is undefined");
           return;
         }
          
         const response = await fetch(
           `/api/majors?scheduleId=${scheduleId}`,
           {
             method: "GET",
             headers: {
               "Content-Type": "application/json",
             },
           }
         );

         if (!response.ok) {
           throw new Error(`Failed to fetch majors: ${response.status} ${response.statusText}`);
         }

         const data = await response.json();
          
         // Group majors by name
         const majorGroups = data.reduce((groups: {[key: string]: Major[]}, major: Major) => { // Added types
           if (!major || !major.name) {
             return groups;
           }
            
           const name = major.name.replace(/\s+Year\s+\d+$/, ''); // Remove "Year X" suffix
           if (!groups[name]) {
             groups[name] = [];
           }
           groups[name].push(major);
           return groups;
         }, {});
          
         // Extract unique majors (base entries)
         const uniqueMajors: Major[] = Object.keys(majorGroups).map(name => { // Added type
           const majorGroup = majorGroups[name];
           const baseMajor = majorGroup.find((m) => !m.year) || majorGroup[0];
            
           // Count how many years this major has
           const years = majorGroup
             .filter((m) => m.year)
             .map((m) => m.year as number) // Assert m.year is number
             .sort((a, b) => a - b);
            
           return {
             ...baseMajor,
             numberOfYears: years.length || 4, // Default to 4 if no years found
             years
           };
         });
          
         setMajors(uniqueMajors);
          
         // Set the first major as selected by default
         if (uniqueMajors.length > 0) {
           setSelectedMajor(uniqueMajors[0]);
           setFilteredMajorId(uniqueMajors[0].id); 
            
           // Set active years for the first major
           const yearsArray: number[] = []; // Added type
           for (let i = 1; i <= (uniqueMajors[0].numberOfYears || 4); i++) {
             yearsArray.push(i);
           }
           setActiveYears(yearsArray);
         }
       } catch (error) {
         console.error("Error fetching majors:", error);
       }
     };

     if (params.id) { // Ensure params.id exists
        fetchMajors();
     }
   }, [params.id]);

   // Fetch courses and organize by year
   useEffect(() => {
     const fetchCourses = async () => {
       if (!selectedMajor) return;
        
       setIsLoading(true);
       try {
         const scheduleId = params.id;
         const response = await fetch(
           `/api/courses?scheduleId=${scheduleId}`
         );
         if (response.ok) {
           const coursesData = await response.json();

           const coursesByYear: YearCourses = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: []};
           const unassignedCourses: Course[] = [];

           coursesData.forEach((course: Course) => { // Added type for course
             if (course.major && course.major.includes(selectedMajor.name)) {
               let year: number | null = null;
                
               if (course.section && /[A-Za-z]+(\d+)/.test(course.section)) {
                 const match = course.section.match(/[A-Za-z]+(\d+)/);
                 if (match && match[1]) {
                   year = parseInt(match[1], 10);
                 }
               }
                
               if (year === null && course.major && /Year\s+(\d+)/.test(course.major)) {
                 const match = course.major.match(/Year\s+(\d+)/);
                 if (match && match[1]) {
                   year = parseInt(match[1], 10);
                 }
               }
                
               year = year === null ? 1 : Math.min(Math.max(year, 1), 6);
                
               if (course.day && course.startTime) {
                 coursesByYear[year].push({
                   ...course,
                   color: colors_class[course.color as keyof typeof colors_class] || colors_class.default, // Added type safety
                 });
               } else {
                 unassignedCourses.push({
                   ...course,
                   color: colors_class[course.color as keyof typeof colors_class] || colors_class.default, // Added type safety
                   year
                 });
               }
             }
           });

           setYearCourses(coursesByYear);
           setAvailableCourses(unassignedCourses);
         } else {
           console.error("Failed to fetch courses");
         }
       } catch (error) {
         console.error("Error fetching courses:", error);
       } finally {
         setIsLoading(false);
       }
     };
     
     if (selectedMajor && params.id) { // Ensure params.id
        fetchCourses();
     }
   }, [selectedMajor, params.id]);

   // Fetch timetable assignments and build schedule data
   useEffect(() => {
     const fetchTimetable = async () => {
       if (!selectedMajor || !timeSlots.length) return;

       try {
         const scheduleId = params.id;
         const response = await fetch(
           `/api/assign-time-slots?scheduleId=${scheduleId}`
         );

         if (!response.ok) {
           throw new Error(
             `Failed to fetch assignments: ${response.status} ${response.statusText}`
           );
         }

         const assignmentsData = await response.json();
         const newSchedule: Schedule = {};
          
         assignmentsData.forEach((assignment: any) => { // Consider defining a type for assignment
           if (assignment.major && assignment.major.includes(selectedMajor.name)) {
             const { day, startTime, section } = assignment;
              
             if (!day || !startTime) {
               return;
             }
              
             let year = 1;
             if (section && /[A-Za-z]+(\d+)/.test(section)) {
               const match = section.match(/[A-Za-z]+(\d+)/);
               if (match && match[1]) {
                 year = parseInt(match[1], 10);
               }
             } else if (assignment.major && /Year\s+(\d+)/.test(assignment.major)) {
               const match = assignment.major.match(/Year\s+(\d+)/);
               if (match && match[1]) {
                 year = parseInt(match[1], 10);
               }
             }
             year = Math.min(Math.max(year, 1), 6);
              
             const course: Course = { // Assert type
               ...assignment,
               color: colors_class[assignment.color as keyof typeof colors_class] || colors_class.default,
               instructor: `${assignment.firstName || ""} ${assignment.lastName || ""}`.trim(),
               isStart: true,
               year
             };
              
             const startIndex = timeSlots.findIndex(ts => {
               const tsKey = getTimeSlotKey(ts);
               return tsKey === startTime || ts.startTime === startTime;
             });
              
             if (startIndex === -1) {
               return;
             }
              
             const duration = parseInt(assignment.duration || "1", 10);
              
             for (let i = 0; i < duration; i++) {
               if (startIndex + i >= timeSlots.length) break;
                
               const currentTimeSlot = getTimeSlotKey(timeSlots[startIndex + i]);
               const key = `${day}-${year}-${currentTimeSlot}`;
                
               newSchedule[key] = {
                 ...course,
                 isStart: i === 0,
                 isMiddle: i > 0 && i < duration - 1,
                 isEnd: i === duration - 1,
                 colspan: i === 0 ? duration : 0,
               };
             }
           }
         });
          
         setSchedule(newSchedule);
       } catch (error) {
         console.error("Error fetching timetable assignments:", error);
       }
     };
      
     if (selectedMajor && timeSlots.length > 0 && params.id) { // Ensure params.id
        fetchTimetable();
     }
   }, [selectedMajor, timeSlots, params.id]);

   // Handle major selection
   const handleMajorChange = (majorIdValue: string) => { // Renamed for clarity
     const majorId = parseInt(majorIdValue);
     const major = majors.find(m => m.id === majorId);
     if (major) {
       setSelectedMajor(major);
       setFilteredMajorId(majorId);
        
       const yearsArray: number[] = []; // Added type
       for (let i = 1; i <= (major.numberOfYears || 4); i++) {
         yearsArray.push(i);
       }
       setActiveYears(yearsArray);
     }
   };

  // --- CORRECTED FUNCTION DEFINITIONS START ---
  const handleDragStart = (course: Course) => {
    setDraggedCourse(course);
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => { // Added type for event
    e.preventDefault();
  };

  const handleAvailableDragOver = (e: React.DragEvent<HTMLElement>) => { // Added type for event
    e.preventDefault();
    setIsDraggingToAvailable(true);
  };

  const handleAvailableDragLeave = (e: React.DragEvent<HTMLElement>) => { // Added type for event
    e.preventDefault();
    setIsDraggingToAvailable(false);
  };

  const handleAvailableDrop = (e: React.DragEvent<HTMLElement>) => { // Added type for event
    e.preventDefault();
    setIsDraggingToAvailable(false);

    if (!draggedCourse) return;

    if (draggedCourse.day) {
      removeCourseFromTimetable(draggedCourse);
    }
  };

  const handleDrop = (day: string, year: number, timeSlot: string) => {
    if (!draggedCourse || timeSlots.length === 0) return;

    const timeSlotIndex = timeSlots.findIndex(
      (ts) => getTimeSlotKey(ts) === timeSlot
    );

    if (timeSlotIndex === -1) {
      console.error(`Time slot ${timeSlot} not found`);
      return;
    }

    const key = `${day}-${year}-${timeSlot}`;
    const existingCourse = schedule[key];

    if (existingCourse && existingCourse.sectionId === draggedCourse.sectionId) {
      return;
    }

    if (existingCourse && existingCourse.sectionId !== draggedCourse.sectionId) {
      alert("This time slot is already occupied. Please choose another slot.");
      return;
    }

    if (timeSlotIndex + draggedCourse.duration > timeSlots.length) {
      alert("Not enough time slots available for this course duration.");
      return;
    }

    for (let i = 1; i < draggedCourse.duration; i++) {
      if (timeSlotIndex + i >= timeSlots.length) break;
      const nextTimeSlot = getTimeSlotKey(timeSlots[timeSlotIndex + i]);
      const nextKey = `${day}-${year}-${nextTimeSlot}`;
      if (schedule[nextKey] && schedule[nextKey].sectionId !== draggedCourse.sectionId) {
        alert("There's a conflict with another course in subsequent time slots.");
        return;
      }
    }

    const newSchedule = { ...schedule };
    Object.keys(newSchedule).forEach((scheduleKey) => {
      if (newSchedule[scheduleKey].sectionId === draggedCourse.sectionId) {
        delete newSchedule[scheduleKey];
      }
    });

    const endTimeIndex = timeSlotIndex + draggedCourse.duration - 1;
    const endTimeSlot =
      endTimeIndex < timeSlots.length
        ? timeSlots[endTimeIndex].endTime ||
          timeSlots[endTimeIndex].time_slot?.split("-")[1]?.trim() ||
          timeSlots[endTimeIndex].time_slot
        : timeSlots[timeSlots.length - 1].endTime ||
          timeSlots[timeSlots.length - 1].time_slot?.split("-")[1]?.trim() ||
          timeSlots[timeSlots.length - 1].time_slot;

    const assignedCourse: Course = { // Assert type
      ...draggedCourse,
      day: day,
      year: year,
      startTime: 
        timeSlots[timeSlotIndex].startTime ||
        getTimeSlotKey(timeSlots[timeSlotIndex]),
      endTime: endTimeSlot
    };

    for (let i = 0; i < draggedCourse.duration; i++) {
      if (timeSlotIndex + i >= timeSlots.length) break;
      const currentTimeSlot = getTimeSlotKey(timeSlots[timeSlotIndex + i]);
      const currentKey = `${day}-${year}-${currentTimeSlot}`;

      newSchedule[currentKey] = {
        ...assignedCourse,
        isStart: i === 0,
        isMiddle: i > 0 && i < draggedCourse.duration - 1,
        isEnd: i === draggedCourse.duration - 1,
        colspan: i === 0 ? draggedCourse.duration : 0,
      };
    }

    setSchedule(newSchedule);

    const isFromAvailable = !draggedCourse.day;

    if (isFromAvailable) {
      setAvailableCourses((prev) =>
        prev.filter((course) => course.sectionId !== draggedCourse.sectionId)
      );

      const updatedYearCourses = { ...yearCourses };
      updatedYearCourses[year] = [
        ...updatedYearCourses[year].filter(c => c.sectionId !== draggedCourse.sectionId),
        assignedCourse
      ];
      setYearCourses(updatedYearCourses);
    } else {
      const updatedYearCourses = { ...yearCourses };
      Object.keys(updatedYearCourses).forEach(yearKeyStr => { // Ensure yearKey is number for indexing
        const yearKey = parseInt(yearKeyStr);
        updatedYearCourses[yearKey] = updatedYearCourses[yearKey].filter(
          c => c.sectionId !== draggedCourse.sectionId
        );
      });
      updatedYearCourses[year].push(assignedCourse);
      setYearCourses(updatedYearCourses);
    }
  };

  const handleCourseClick = (day: string, year: number, timeSlot: string, course: Course) => {
    setSelectedCourse(course);
    setIsDialogOpen(true);
  };

  const handleRemoveCourse = () => {
    if (!selectedCourse) return;
    removeCourseFromTimetable(selectedCourse);
    setIsDialogOpen(false);
  };
  // --- CORRECTED FUNCTION DEFINITIONS END ---

  // Save all assignments to the database
  const saveAllAssignments = async () => {
    try {
      const allAssignments: any[] = []; // Consider defining a type for assignment payload
      
      Object.keys(schedule).forEach(key => {
        const course = schedule[key];
        if (course.isStart) { 
          allAssignments.push({
            sectionId: course.sectionId,
            day: course.day,
            startTime: course.startTime,
            endTime: course.endTime,
            classroom: course.classroom,
          });
        }
      });
      
      if (allAssignments.length === 0) {
        alert("No courses to save!");
        return;
      }

      const response = await fetch("/api/assign-time-slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(allAssignments),
      });

      if (response.ok) {
        alert("All assignments saved successfully!");
      } else {
        const errorData = await response.json();
        console.error("Failed to save assignments:", errorData);
        alert(`Failed to save assignments: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error saving assignments:", error);
      alert(`Error saving assignments: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Generate schedule automatically
  const generateSchedule = async () => {
    if (!params.id) {
      alert("Schedule ID is missing");
      return;
    }

    try {
      const scheduleId = params.id.toString();
      const response = await fetch(
        `/api/generate-schedule?scheduleId=${scheduleId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to generate schedule: ${response.status} ${response.statusText}`
        );
      }

      alert("Schedule generated successfully! Refreshing view...");
      
      if (selectedMajor) {
        handleMajorChange(selectedMajor.id.toString()); // Pass string as expected
      }
    } catch (error) {
      console.error("Error generating schedule:", error);
      alert(`Error generating schedule: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Switch to classroom view
  const switchToClassroomView = () => {
    window.location.href = `/schedule/${params.id}/timetable`;
  };

  const removeCourseFromTimetable = (course: Course) => {
    if (!course.day || !course.startTime) return;

    const newSchedule = { ...schedule };
    Object.keys(newSchedule).forEach((key) => {
      if (newSchedule[key].sectionId === course.sectionId) {
        delete newSchedule[key];
      }
    });
    setSchedule(newSchedule);

    const cleanCourse: Course = { // Assert type
      code: course.code,
      name: course.title || course.name,
      color: course.color,
      duration: course.duration,
      instructor: course.instructor,
      sectionId: course.sectionId,
      section: course.section,
      year: course.year || 1,
      major: course.major,
      // Ensure all required properties of Course are present or optional
      title: course.title,
      firstName: course.firstName,
      lastName: course.lastName,
      classroom: course.classroom,
      room: course.room,
    };

    if (!availableCourses.some((c) => c.sectionId === course.sectionId)) {
      setAvailableCourses((prev) => [...prev, cleanCourse]);
    }

    const updatedYearCourses = { ...yearCourses };
    const courseYear = course.year || 1;
    if (updatedYearCourses[courseYear]) { // Check if year array exists
        updatedYearCourses[courseYear] = updatedYearCourses[courseYear].filter(
          c => c.sectionId !== course.sectionId
        );
    }
    setYearCourses(updatedYearCourses);
  };

  return (
    <div className="relative min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">Major View Timetable</h2>
        <div className="space-x-2">
          <Button
            onClick={generateSchedule}
            variant="outline"
          >
            Auto-Generate Schedule
          </Button>
          <Button onClick={saveAllAssignments}>Save All</Button>
          <Button onClick={switchToClassroomView}>Classroom View</Button>
        </div>
      </div>

      <div className="mb-4">
        <select 
          className="border p-2 rounded-md w-64"
          value={filteredMajorId === null ? "" : filteredMajorId} // Handle null case for value
          onChange={(e) => handleMajorChange(e.target.value)}
        >
          <option value="">Select a Major</option>
          {majors.map((major) => (
            <option key={major.id} value={major.id}>
              {major.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading timetable data...</div>
      ) : selectedMajor ? (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] mb-40">
          <div className="inline-block min-w-full">
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-blue-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-24 border">
                      Year
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
                          key={`${day}-${getTimeSlotKey(slot)}`}
                          className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border"
                        >
                          {slot.time_slot || slot.startTime}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeYears.map((year) => (
                    <tr key={year} className="bg-white">
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium border text-gray-700">
                        Year {year}
                      </td>
                      {days.map((day) =>
                        timeSlots.map((slot, slotIndex) => { // Added slotIndex for unique key if needed
                          const slotKey = getTimeSlotKey(slot);
                          const key = `${day}-${year}-${slotKey}`;
                          const course = schedule[key];

                          if (course && !course.isStart) {
                            return null;
                          }

                          return (
                            <td
                              key={`${day}-${year}-${slotKey}-${slotIndex}`} // Ensure unique key
                              className="px-1 py-1 whitespace-nowrap text-xs border"
                              colSpan={course?.colspan || 1}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(day, year, slotKey)}
                            >
                              {course ? (
                                <div
                                  className={`${course.color} p-1 rounded cursor-pointer text-center border shadow-sm transition-all font-medium`}
                                  onClick={() =>
                                    handleCourseClick(
                                      day,
                                      year,
                                      slotKey,
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
      ) : (
        <div className="text-center py-8">Please select a major to view the timetable</div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-[20vh] overflow-y-auto p-2"> {/* Adjusted grid cols for responsiveness */}
              {availableCourses.map((course) => (
                <div
                  key={course.sectionId.toString()} // Ensure key is string
                  className={`${course.color} p-3 rounded-lg shadow cursor-move hover:shadow-md transition-all border`}
                  draggable
                  onDragStart={() => handleDragStart(course)}
                >
                  <h4 className="font-bold text-gray-800">
                    {course.code}
                  </h4>
                  <p className="text-sm font-medium">
                    {course.name || course.title} {/* Display name or title */}
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
                  <p className="text-xs mt-1 truncate text-gray-700">
                    Year: {course.year || 1}
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
                    ?.replace("hover:", "")
                    ?.replace("border-", "")}`} // Added optional chaining for safety
                ></div>
                <h3 className="font-bold text-lg">
                  {selectedCourse.code}: {selectedCourse.name || selectedCourse.title}
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
                      {selectedCourse.room || selectedCourse.classroom || "TBA"} {/* Check both room and classroom */}
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
                      {selectedCourse.section}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Year:
                    </span>
                    <span className="text-sm font-medium">
                      {selectedCourse.year}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Major:
                    </span>
                    <span className="text-sm font-medium">
                      {selectedCourse.major}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex justify-end gap-2"> {/* Added DialogFooter for consistency */}
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRemoveCourse}
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