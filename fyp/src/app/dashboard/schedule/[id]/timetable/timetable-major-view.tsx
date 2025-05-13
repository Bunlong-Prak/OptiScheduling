// "use client";

// import { useState, useEffect } from "react";
// import { Course } from "@/app/types";
// import { Button } from "@/components/ui/button";
// import {
//     Dialog,
//     DialogContent,
//     DialogFooter,
//     DialogHeader,
//     DialogTitle,
// } from "@/components/ui/dialog";
// import { colors_class } from "@/components/custom/colors";
// import { useParams } from "next/navigation";

// const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// export default function MajorView() {
//     const [schedule, setSchedule] = useState({});
//     const [majors, setMajors] = useState([]);
//     const [selectedMajor, setSelectedMajor] = useState(null);
//     const [draggedCourse, setDraggedCourse] = useState(null);
//     const [isDialogOpen, setIsDialogOpen] = useState(false);
//     const [selectedCourse, setSelectedCourse] = useState(null);
//     const [timeSlots, setTimeSlots] = useState([]);
//     const [isLoading, setIsLoading] = useState(true);
//     const [yearCourses, setYearCourses] = useState({
//         1: [],
//         2: [],
//         3: [],
//         4: [],
//         5: [],
//         6: []
//     });
//     const [availableCourses, setAvailableCourses] = useState([]);
//     const [isDraggingToAvailable, setIsDraggingToAvailable] = useState(false);
//     const [filteredMajorId, setFilteredMajorId] = useState(null);
//     const [activeYears, setActiveYears] = useState([]);

//     const params = useParams();

//     // Helper function to get consistent time slot key
//     const getTimeSlotKey = (timeSlot) => {
//         // If it's a time slot string like "8:00-9:00", use it directly
//         if (typeof timeSlot === "string") {
//             return timeSlot;
//         }

//         // If it's an object with startTime, use that
//         if (timeSlot.startTime) {
//             return timeSlot.startTime;
//         }

//         // If it's an object with time_slot, use that
//         if (timeSlot.time_slot) {
//             return timeSlot.time_slot;
//         }

//         return timeSlot.toString();
//     };

//     // Fetch time slots
//     useEffect(() => {
//         const fetchTimeSlots = async () => {
//             try {
//                 const scheduleId = params.id;
//                 const response = await fetch(`/api/schedules`);

//                 if (response.ok) {
//                     const schedulesData = await response.json();
//                     // Find the current schedule by ID
//                     const currentSchedule = schedulesData.find(
//                         (s) => s.id.toString() === scheduleId
//                     );

//                     if (currentSchedule && currentSchedule.timeSlots) {
//                         // Transform API time slots to a consistent format
//                         const apiTimeSlots = currentSchedule.timeSlots.map(
//                             (slot) => {
//                                 const formattedSlot = {
//                                     id: slot.id,
//                                     time_slot:
//                                         slot.time_slot ||
//                                         (slot.startTime && slot.endTime
//                                             ? `${slot.startTime}-${slot.endTime}`
//                                             : slot.startTime),
//                                     startTime: slot.startTime,
//                                     endTime: slot.endTime,
//                                 };

//                                 // If time_slot already has start/end times but not as separate properties
//                                 if (
//                                     !slot.startTime &&
//                                     !slot.endTime &&
//                                     slot.time_slot &&
//                                     slot.time_slot.includes("-")
//                                 ) {
//                                     const [startTime, endTime] = slot.time_slot
//                                         .split("-")
//                                         .map((time) => time.trim());
//                                     formattedSlot.startTime = startTime;
//                                     formattedSlot.endTime = endTime;
//                                 }

//                                 return formattedSlot;
//                             }
//                         );

//                         setTimeSlots(apiTimeSlots);
//                     } else {
//                         console.error("No time slots found for schedule", scheduleId);
//                     }
//                 } else {
//                     console.error("Failed to fetch schedules");
//                 }
//             } catch (error) {
//                 console.error("Error fetching time slots:", error);
//             }
//         };

//         fetchTimeSlots();
//     }, [params.id]);

//     // Fetch majors
//     useEffect(() => {
//         const fetchMajors = async () => {
//             try {
//                 const scheduleId = params.id;
//                 if (!scheduleId) {
//                     console.error("Schedule ID is undefined");
//                     return;
//                 }
                
//                 const response = await fetch(
//                     `/api/majors?scheduleId=${scheduleId}`,
//                     {
//                         method: "GET",
//                         headers: {
//                             "Content-Type": "application/json",
//                         },
//                     }
//                 );

//                 if (!response.ok) {
//                     throw new Error(`Failed to fetch majors: ${response.status} ${response.statusText}`);
//                 }

//                 const data = await response.json();
                
//                 // Group majors by name
//                 const majorGroups = data.reduce((groups, major) => {
//                     if (!major || !major.name) {
//                         return groups;
//                     }
                    
//                     const name = major.name.replace(/\s+Year\s+\d+$/, ''); // Remove "Year X" suffix
//                     if (!groups[name]) {
//                         groups[name] = [];
//                     }
//                     groups[name].push(major);
//                     return groups;
//                 }, {});
                
//                 // Extract unique majors (base entries)
//                 const uniqueMajors = Object.keys(majorGroups).map(name => {
//                     const majorGroup = majorGroups[name];
//                     const baseMajor = majorGroup.find((m) => !m.year) || majorGroup[0];
                    
//                     // Count how many years this major has
//                     const years = majorGroup
//                         .filter((m) => m.year)
//                         .map((m) => m.year)
//                         .sort((a, b) => a - b);
                    
//                     return {
//                         ...baseMajor,
//                         numberOfYears: years.length || 4, // Default to 4 if no years found
//                         years
//                     };
//                 });
                
//                 setMajors(uniqueMajors);
                
//                 // Set the first major as selected by default
//                 if (uniqueMajors.length > 0) {
//                     setSelectedMajor(uniqueMajors[0]);
//                     setFilteredMajorId(uniqueMajors[0].id);
                    
//                     // Set active years for the first major
//                     const yearsArray = [];
//                     for (let i = 1; i <= (uniqueMajors[0].numberOfYears || 4); i++) {
//                         yearsArray.push(i);
//                     }
//                     setActiveYears(yearsArray);
//                 }
//             } catch (error) {
//                 console.error("Error fetching majors:", error);
//             }
//         };

//         fetchMajors();
//     }, [params.id]);

//     // Fetch courses and organize by year
//     useEffect(() => {
//         const fetchCourses = async () => {
//             if (!selectedMajor) return;
            
//             setIsLoading(true);
//             try {
//                 const scheduleId = params.id;
//                 const response = await fetch(
//                     `/api/courses?scheduleId=${scheduleId}`
//                 );
//                 if (response.ok) {
//                     const coursesData = await response.json();

//                     // Group courses by year (extracted from section)
//                     const coursesByYear = {
//                         1: [],
//                         2: [],
//                         3: [],
//                         4: [],
//                         5: [],
//                         6: []
//                     };

//                     // The available courses are those not assigned to the timetable yet
//                     const unassignedCourses = [];

//                     coursesData.forEach(course => {
//                         // Only include courses for the selected major
//                         if (course.major && course.major.includes(selectedMajor.name)) {
//                             // Extract year from the section code or major
//                             // For example, from 'CS1' extract '1', or from 'CS101 Year 2' extract '2'
//                             let year = null;
                            
//                             // Try to extract from section first
//                             if (course.section && /[A-Za-z]+(\d+)/.test(course.section)) {
//                                 const match = course.section.match(/[A-Za-z]+(\d+)/);
//                                 if (match && match[1]) {
//                                     year = parseInt(match[1], 10);
//                                 }
//                             }
                            
//                             // If year is still null, try to extract from major
//                             if (year === null && course.major && /Year\s+(\d+)/.test(course.major)) {
//                                 const match = course.major.match(/Year\s+(\d+)/);
//                                 if (match && match[1]) {
//                                     year = parseInt(match[1], 10);
//                                 }
//                             }
                            
//                             // Default to year 1 if we couldn't extract a year
//                             if (year === null) {
//                                 year = 1;
//                             }
                            
//                             // Ensure year is between 1 and 6
//                             year = Math.min(Math.max(year, 1), 6);
                            
//                             // Add the course to the appropriate year array
//                             if (course.day && course.startTime) {
//                                 // This course is assigned to the timetable
//                                 coursesByYear[year].push({
//                                     ...course,
//                                     color: colors_class[course.color]
//                                 });
//                             } else {
//                                 // This course is not assigned to the timetable
//                                 unassignedCourses.push({
//                                     ...course,
//                                     color: colors_class[course.color],
//                                     year
//                                 });
//                             }
//                         }
//                     });

//                     setYearCourses(coursesByYear);
//                     setAvailableCourses(unassignedCourses);
//                 } else {
//                     console.error("Failed to fetch courses");
//                 }
//             } catch (error) {
//                 console.error("Error fetching courses:", error);
//             } finally {
//                 setIsLoading(false);
//             }
//         };

//         fetchCourses();
//     }, [selectedMajor, params.id]);

//     // Fetch timetable assignments and build schedule data
//     useEffect(() => {
//         const fetchTimetable = async () => {
//             if (!selectedMajor || !timeSlots.length) return;

//             try {
//                 const scheduleId = params.id;
//                 const response = await fetch(
//                     `/api/assign-time-slots?scheduleId=${scheduleId}`
//                 );

//                 if (!response.ok) {
//                     throw new Error(
//                         `Failed to fetch assignments: ${response.status} ${response.statusText}`
//                     );
//                 }

//                 const assignmentsData = await response.json();
                
//                 // Build a structured schedule object
//                 const newSchedule = {};
                
//                 // Process only the assignments that belong to the selected major
//                 assignmentsData.forEach(assignment => {
//                     if (assignment.major && assignment.major.includes(selectedMajor.name)) {
//                         const { day, startTime, code, title, firstName, lastName, section } = assignment;
                        
//                         // Skip invalid assignments
//                         if (!day || !startTime) {
//                             return;
//                         }
                        
//                         // Extract year from section or major
//                         let year = 1; // Default to year 1
                        
//                         if (section && /[A-Za-z]+(\d+)/.test(section)) {
//                             const match = section.match(/[A-Za-z]+(\d+)/);
//                             if (match && match[1]) {
//                                 year = parseInt(match[1], 10);
//                             }
//                         } else if (assignment.major && /Year\s+(\d+)/.test(assignment.major)) {
//                             const match = assignment.major.match(/Year\s+(\d+)/);
//                             if (match && match[1]) {
//                                 year = parseInt(match[1], 10);
//                             }
//                         }
                        
//                         // Ensure year is between 1 and 6
//                         year = Math.min(Math.max(year, 1), 6);
                        
//                         // Create course object
//                         const course = {
//                             ...assignment,
//                             color: colors_class[assignment.color],
//                             instructor: `${firstName || ""} ${lastName || ""}`.trim(),
//                             isStart: true,  // First timeslot
//                             year
//                         };
                        
//                         // Find time slot index
//                         const startIndex = timeSlots.findIndex(ts => {
//                             const tsKey = getTimeSlotKey(ts);
//                             return tsKey === startTime || ts.startTime === startTime;
//                         });
                        
//                         if (startIndex === -1) {
//                             return; // Skip if time slot not found
//                         }
                        
//                         // Parse duration
//                         const duration = parseInt(assignment.duration || "1", 10);
                        
//                         // Create key structure: day-year-timeSlot
//                         for (let i = 0; i < duration; i++) {
//                             if (startIndex + i >= timeSlots.length) break;
                            
//                             const currentTimeSlot = getTimeSlotKey(timeSlots[startIndex + i]);
//                             const key = `${day}-${year}-${currentTimeSlot}`;
                            
//                             newSchedule[key] = {
//                                 ...course,
//                                 isStart: i === 0,
//                                 isMiddle: i > 0 && i < duration - 1,
//                                 isEnd: i === duration - 1,
//                                 colspan: i === 0 ? duration : 0,
//                             };
//                         }
//                     }
//                 });
                
//                 setSchedule(newSchedule);
//             } catch (error) {
//                 console.error("Error fetching timetable assignments:", error);
//             }
//         };
        
//         fetchTimetable();
//     }, [selectedMajor, timeSlots, params.id]);

//     // Handle major selection
//     const handleMajorChange = (majorId) => {
//         const major = majors.find(m => m.id === parseInt(majorId));
//         if (major) {
//             setSelectedMajor(major);
//             setFilteredMajorId(majorId);
            
//             // Set active years for the selected major
//             const yearsArray = [];
//             for (let i = 1; i <= (major.numberOfYears || 4); i++) {
//                 yearsArray.push(i);
//             }
//             setActiveYears(yearsArray);
//         }
//     };

//     // Handle drag start for course movement
//     const handleDragStart = (course) => {
//         setDraggedCourse(course);
//     };

//     // Handle drag over
//     const handleDragOver = (e) => {
//         e.preventDefault();
//     };

//     // Handle drag over for available courses section
//     const handleAvailableDragOver = (e) => {
//         e.preventDefault();
//         setIsDraggingToAvailable(true);
//     };

//     // Handle drag leave for available courses section
//     const handleAvailableDragLeave = (e) => {
//         e.preventDefault();
//         setIsDraggingToAvailable(false);
//     };

//     // Handle dropping a course into the available courses area
//     const handleAvailableDrop = (e) => {
//         e.preventDefault();
//         setIsDraggingToAvailable(false);

//         if (!draggedCourse) return;

//         // Only process if the course is from the timetable (has day property)
//         if (draggedCourse.day) {
//             // Remove course from the timetable
//             removeCourseFromTimetable(draggedCourse);
//         }
//     };

//     // Function to remove a course from the timetable and return it to available courses
//     const removeCourseFromTimetable = (course) => {
//         if (!course.day || !course.startTime) return;

//         // Find all keys for this course in the schedule
//         const newSchedule = { ...schedule };

//         // Remove all occurrences of this course from schedule
//         Object.keys(newSchedule).forEach((key) => {
//             if (newSchedule[key].sectionId === course.sectionId) {
//                 delete newSchedule[key];
//             }
//         });

//         setSchedule(newSchedule);

//         // Return the course to available courses list
//         // Create a clean version without timetable-specific properties
//         const cleanCourse = {
//             code: course.code,
//             name: course.title || course.name,
//             color: course.color,
//             duration: course.duration,
//             instructor: course.instructor,
//             sectionId: course.sectionId,
//             section: course.section,
//             year: course.year || 1,
//             major: course.major
//         };

//         // Only add back to available courses if it's not already there
//         if (!availableCourses.some((c) => c.sectionId === course.sectionId)) {
//             setAvailableCourses((prev) => [...prev, cleanCourse]);
//         }

//         // Create updated year courses
//         const updatedYearCourses = { ...yearCourses };
//         updatedYearCourses[course.year || 1] = updatedYearCourses[course.year || 1].filter(
//             c => c.sectionId !== course.sectionId
//         );
//         setYearCourses(updatedYearCourses);
//     };

//     // Handle dropping a course on a timetable cell
//     const handleDrop = (day, year, timeSlot) => {
//         if (!draggedCourse || timeSlots.length === 0) return;

//         // Find the time slot that matches the drop location
//         const timeSlotIndex = timeSlots.findIndex(
//             (ts) => getTimeSlotKey(ts) === timeSlot
//         );

//         if (timeSlotIndex === -1) {
//             console.error(`Time slot ${timeSlot} not found`);
//             return;
//         }

//         // Check if the time slot is already occupied
//         const key = `${day}-${year}-${timeSlot}`;
//         const existingCourse = schedule[key];

//         // If dropping on the same course, do nothing
//         if (existingCourse && existingCourse.sectionId === draggedCourse.sectionId) {
//             return;
//         }

//         // If dropping on a different course, show conflict message
//         if (existingCourse && existingCourse.sectionId !== draggedCourse.sectionId) {
//             alert("This time slot is already occupied. Please choose another slot.");
//             return;
//         }

//         // Check if there's enough space for the course duration
//         if (timeSlotIndex + draggedCourse.duration > timeSlots.length) {
//             alert("Not enough time slots available for this course duration.");
//             return;
//         }

//         // Check for conflicts in subsequent time slots
//         for (let i = 1; i < draggedCourse.duration; i++) {
//             if (timeSlotIndex + i >= timeSlots.length) break;
//             const nextTimeSlot = getTimeSlotKey(timeSlots[timeSlotIndex + i]);
//             const nextKey = `${day}-${year}-${nextTimeSlot}`;
//             if (schedule[nextKey] && schedule[nextKey].sectionId !== draggedCourse.sectionId) {
//                 alert("There's a conflict with another course in subsequent time slots.");
//                 return;
//             }
//         }

//         // Create a new schedule and remove all instances of the dragged course
//         const newSchedule = { ...schedule };
//         Object.keys(newSchedule).forEach((scheduleKey) => {
//             if (newSchedule[scheduleKey].sectionId === draggedCourse.sectionId) {
//                 delete newSchedule[scheduleKey];
//             }
//         });

//         // Calculate end time
//         const endTimeIndex = timeSlotIndex + draggedCourse.duration - 1;
//         const endTimeSlot =
//             endTimeIndex < timeSlots.length
//                 ? timeSlots[endTimeIndex].endTime ||
//                   timeSlots[endTimeIndex].time_slot?.split("-")[1]?.trim() ||
//                   timeSlots[endTimeIndex].time_slot
//                 : timeSlots[timeSlots.length - 1].endTime ||
//                   timeSlots[timeSlots.length - 1].time_slot?.split("-")[1]?.trim() ||
//                   timeSlots[timeSlots.length - 1].time_slot;

//         // Create course with assignment data
//         const assignedCourse = {
//             ...draggedCourse,
//             day: day,
//             year: year, // Add the year property
//             startTime: 
//                 timeSlots[timeSlotIndex].startTime ||
//                 getTimeSlotKey(timeSlots[timeSlotIndex]),
//             endTime: endTimeSlot
//         };

//         // Add the course to all its new time slots
//         for (let i = 0; i < draggedCourse.duration; i++) {
//             if (timeSlotIndex + i >= timeSlots.length) break;
//             const currentTimeSlot = getTimeSlotKey(timeSlots[timeSlotIndex + i]);
//             const currentKey = `${day}-${year}-${currentTimeSlot}`;

//             newSchedule[currentKey] = {
//                 ...assignedCourse,
//                 isStart: i === 0,
//                 isMiddle: i > 0 && i < draggedCourse.duration - 1,
//                 isEnd: i === draggedCourse.duration - 1,
//                 colspan: i === 0 ? draggedCourse.duration : 0,
//             };
//         }

//         // Update schedule state
//         setSchedule(newSchedule);

//         // Handle assignment lists based on where the course came from
//         const isFromAvailable = !draggedCourse.day;

//         if (isFromAvailable) {
//             // Remove from available courses
//             setAvailableCourses((prev) =>
//                 prev.filter((course) => course.sectionId !== draggedCourse.sectionId)
//             );

//             // Add to year courses
//             const updatedYearCourses = { ...yearCourses };
//             updatedYearCourses[year] = [
//                 ...updatedYearCourses[year].filter(c => c.sectionId !== draggedCourse.sectionId),
//                 assignedCourse
//             ];
//             setYearCourses(updatedYearCourses);
//         } else {
//             // Just update the position in year courses
//             const updatedYearCourses = { ...yearCourses };
//             // Remove from previous year
//             Object.keys(updatedYearCourses).forEach(yearKey => {
//                 updatedYearCourses[yearKey] = updatedYearCourses[yearKey].filter(
//                     c => c.sectionId !== draggedCourse.sectionId
//                 );
//             });
//             // Add to new year
//             updatedYearCourses[year].push(assignedCourse);
//             setYearCourses(updatedYearCourses);
//         }
//     };

//     // Handle course click
//     const handleCourseClick = (day, year, timeSlot, course) => {
//         setSelectedCourse(course);
//         setIsDialogOpen(true);
//     };

//     // Handle course delete
//     const handleRemoveCourse = () => {
//         if (!selectedCourse) return;
//         removeCourseFromTimetable(selectedCourse);
//         setIsDialogOpen(false);
//     };

//     // Save all assignments to the database
//     const saveAllAssignments = async () => {
//         try {
//             // Extract all assigned courses from the schedule
//             const allAssignments = [];
            
//             Object.keys(schedule).forEach(key => {
//                 const course = schedule[key];
//                 if (course.isStart) { // Only process the starting cells to avoid duplicates
//                     allAssignments.push({
//                         sectionId: course.sectionId,
//                         day: course.day,
//                         startTime: course.startTime,
//                         endTime: course.endTime,
//                         classroom: course.classroom,
//                     });
//                 }
//             });
            
//             if (allAssignments.length === 0) {
//                 alert("No courses to save!");
//                 return;
//             }

//             // Send all assignments to API
//             const response = await fetch("/api/assign-time-slots", {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json",
//                 },
//                 body: JSON.stringify(allAssignments),
//             });

//             if (response.ok) {
//                 alert("All assignments saved successfully!");
//             } else {
//                 const errorData = await response.json();
//                 console.error("Failed to save assignments:", errorData);
//                 alert(`Failed to save assignments: ${errorData.error || "Unknown error"}`);
//             }
//         } catch (error) {
//             console.error("Error saving assignments:", error);
//             alert(`Error saving assignments: ${error instanceof Error ? error.message : "Unknown error"}`);
//         }
//     };

//     // Generate schedule automatically
//     const generateSchedule = async () => {
//         if (!params.id) {
//             alert("Schedule ID is missing");
//             return;
//         }

//         try {
//             const scheduleId = params.id.toString();

//             // Call the generate-schedule API endpoint with POST method
//             const response = await fetch(
//                 `/api/generate-schedule?scheduleId=${scheduleId}`,
//                 {
//                     method: "POST",
//                     headers: {
//                         "Content-Type": "application/json",
//                     },
//                 }
//             );

//             if (!response.ok) {
//                 throw new Error(
//                     `Failed to generate schedule: ${response.status} ${response.statusText}`
//                 );
//             }

//             alert("Schedule generated successfully! Refreshing view...");
            
//             // Refresh the current view to display the updated schedule
//             if (selectedMajor) {
//                 handleMajorChange(selectedMajor.id);
//             }
//         } catch (error) {
//             console.error("Error generating schedule:", error);
//             alert(`Error generating schedule: ${error instanceof Error ? error.message : "Unknown error"}`);
//         }
//     };

//     // Switch to classroom view
//     const switchToClassroomView = () => {
//         // This function should navigate to the classroom view
//         window.location.href = `/schedule/${params.id}/timetable`;
//     };

//     return (
//         <div className="relative min-h-screen">
//             <div className="flex justify-between items-center mb-8">
//                 <h2 className="text-2xl font-bold">Major View Timetable</h2>
//                 <div className="space-x-2">
//                     <Button
//                         onClick={generateSchedule}
//                         variant="outline"
//                     >
//                         Auto-Generate Schedule
//                     </Button>
//                     <Button onClick={saveAllAssignments}>Save All</Button>
//                     <Button onClick={switchToClassroomView}>Classroom View</Button>
//                 </div>
//             </div>

//             {/* Major selector */}
//             <div className="mb-4">
//                 <select 
//                     className="border p-2 rounded-md w-64"
//                     value={filteredMajorId || ""}
//                     onChange={(e) => handleMajorChange(e.target.value)}
//                 >
//                     <option value="">Select a Major</option>
//                     {majors.map((major) => (
//                         <option key={major.id} value={major.id}>
//                             {major.name}
//                         </option>
//                     ))}
//                 </select>
//             </div>

//             {isLoading ? (
//                 <div className="text-center py-8">Loading timetable data...</div>
//             ) : selectedMajor ? (
//                 <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] mb-40">
//                     <div className="inline-block min-w-full">
//                         <div className="border rounded-lg overflow-hidden">
//                             <table className="min-w-full divide-y divide-blue-200">
//                                 <thead>
//                                     <tr>
//                                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-24 border">
//                                             Year
//                                         </th>
//                                         {days.map((day) => (
//                                             <th
//                                                 key={day}
//                                                 colSpan={timeSlots.length}
//                                                 className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border"
//                                             >
//                                                 {day}
//                                             </th>
//                                         ))}
//                                     </tr>
//                                     <tr>
//                                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 border">
//                                             Time
//                                         </th>
//                                         {days.map((day) =>
//                                             timeSlots.map((slot) => (
//                                                 <th
//                                                     key={`${day}-${getTimeSlotKey(slot)}`}
//                                                     className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border"
//                                                 >
//                                                     {slot.time_slot || slot.startTime}
//                                                 </th>
//                                             ))
//                                         )}
//                                     </tr>
//                                 </thead>
//                                 <tbody className="bg-white divide-y divide-gray-200">
//                                     {activeYears.map((year) => (
//                                         <tr key={year} className="bg-white">
//                                             <td className="px-4 py-2 whitespace-nowrap text-sm font-medium border text-gray-700">
//                                                 Year {year}
//                                             </td>
//                                             {days.map((day) =>
//                                                 timeSlots.map((slot) => {
//                                                     const slotKey = getTimeSlotKey(slot);
//                                                     const key = `${day}-${year}-${slotKey}`;
//                                                     const course = schedule[key];

//                                                     // Skip cells that are part of a multi-hour course but not the start
//                                                     if (course && !course.isStart) {
//                                                         return null;
//                                                     }

//                                                     return (
//                                                         <td
//                                                             key={`${day}-${year}-${slotKey}`}
//                                                             className="px-1 py-1 whitespace-nowrap text-xs border"
//                                                             colSpan={course?.colspan || 1}
//                                                             onDragOver={handleDragOver}
//                                                             onDrop={() => handleDrop(day, year, slotKey)}
//                                                         >
//                                                             {course ? (
//                                                                 <div
//                                                                     className={`${course.color} p-1 rounded cursor-pointer text-center border shadow-sm transition-all font-medium`}
//                                                                     onClick={() =>
//                                                                         handleCourseClick(
//                                                                             day,
//                                                                             year,
//                                                                             slotKey,
//                                                                             course
//                                                                         )
//                                                                     }
//                                                                     draggable
//                                                                     onDragStart={() =>
//                                                                         handleDragStart(
//                                                                             course
//                                                                         )
//                                                                     }
//                                                                 >
//                                                                     {course.code}
//                                                                 </div>
//                                                             ) : (
//                                                                 <div className="h-6 w-full" />
//                                                             )}
//                                                         </td>
//                                                     );
//                                                 })
//                                             )}
//                                         </tr>
//                                     ))}
//                                 </tbody>
//                             </table>
//                         </div>
//                     </div>
//                 </div>
//             ) : (
//                 <div className="text-center py-8">Please select a major to view the timetable</div>
//             )}

//             {/* Draggable courses section */}
//             <div
//                 className={`fixed bottom-0 left-0 right-0 bg-white p-4 rounded-t-lg shadow-lg z-50 border-t ${
//                     isDraggingToAvailable ? "bg-blue-100" : ""
//                 }`}
//                 onDragOver={handleAvailableDragOver}
//                 onDragLeave={handleAvailableDragLeave}
//                 onDrop={handleAvailableDrop}
//             >
//                 <div className="max-w-9xl mx-auto">
//                     <h3 className="text-lg font-semibold mb-4 flex items-center">
//                         <span className="">Available Courses</span>
//                         {isDraggingToAvailable && (
//                             <span className="ml-2 text-blue-500 animate-pulse">
//                                 (Drop Here to Return Course)
//                             </span>
//                         )}
//                     </h3>
//                     {isLoading ? (
//                         <div className="text-center py-4">
//                             Loading courses...
//                         </div>
//                     ) : availableCourses.length === 0 ? (
//                         <div className="text-center py-4 text-gray-500">
//                             All courses have been assigned to the timetable
//                         </div>
//                     ) : (
//                         <div className="grid grid-cols-6 gap-4 max-h-[20vh] overflow-y-auto p-2">
//                             {availableCourses.map((course) => (
//                                 <div
//                                     key={course.sectionId}
//                                     className={`${course.color} p-3 rounded-lg shadow cursor-move hover:shadow-md transition-all border`}
//                                     draggable
//                                     onDragStart={() => handleDragStart(course)}
//                                 >
//                                     <h4 className="font-bold text-gray-800">
//                                         {course.code}
//                                     </h4>
//                                     <p className="text-sm font-medium">
//                                         {course.name}
//                                     </p>
//                                     <p className="text-xs mt-1 text-gray-700">
//                                         Duration: {course.duration} hour
//                                         {course.duration > 1 ? "s" : ""}
//                                     </p>
//                                     <p className="text-xs mt-1 truncate text-gray-700">
//                                         Instructor: {course.instructor}
//                                     </p>
//                                     <p className="text-xs mt-1 truncate text-gray-700">
//                                         Section: {course.section || "N/A"}
//                                     </p>
//                                     <p className="text-xs mt-1 truncate text-gray-700">
//                                         Year: {course.year || 1}
//                                     </p>
//                                 </div>
//                             ))}
//                         </div>
//                     )}
//                 </div>
//             </div>

//             {/* Course details dialog */}
//             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
//                 <DialogContent className="sm:max-w-md">
//                     <DialogHeader>
//                         <DialogTitle className="text-xl font-bold">
//                             Course Details
//                         </DialogTitle>
//                     </DialogHeader>

//                     {selectedCourse && (
//                         <div className="space-y-4">
//                             <div className="space-y-3">
//                                 <div
//                                     className={`w-full h-1 ${selectedCourse.color
//                                         .replace("hover:", "")
//                                         .replace("border-", "")}`}
//                                 ></div>
//                                 <h3 className="font-bold text-lg">
//                                     {selectedCourse.code}: {selectedCourse.name || selectedCourse.title}
//                                 </h3>
//                                 <div className="space-y-2">
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-muted-foreground">
//                                             Duration:
//                                         </span>
//                                         <span className="text-sm font-medium">
//                                             {selectedCourse.duration} hour(s)
//                                         </span>
//                                     </div>
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-muted-foreground">
//                                             Instructor:
//                                         </span>
//                                         <span className="text-sm font-medium">
//                                             {selectedCourse.instructor}
//                                         </span>
//                                     </div>
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-muted-foreground">
//                                             Room:
//                                         </span>
//                                         <span className="text-sm font-medium">
//                                             {selectedCourse.room || "TBA"}
//                                         </span>
//                                     </div>
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-muted-foreground">
//                                             Time:
//                                         </span>
//                                         <span className="text-sm font-medium">
//                                             {selectedCourse.day},{" "}
//                                             {selectedCourse.startTime} -{" "}
//                                             {selectedCourse.endTime}
//                                         </span>
//                                     </div>
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-muted-foreground">
//                                             Section:
//                                         </span>
//                                         <span className="text-sm font-medium">
//                                             {selectedCourse.section}
//                                         </span>
//                                     </div>
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-muted-foreground">
//                                             Year:
//                                         </span>
//                                         <span className="text-sm font-medium">
//                                             {selectedCourse.year}
//                                         </span>
//                                     </div>
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-muted-foreground">
//                                             Major:
//                                         </span>
//                                         <span className="text-sm font-medium">
//                                             {selectedCourse.major}
//                                         </span>
//                                     </div>
//                                 </div>
//                             </div>

//                             <div className="flex justify-end gap-2">
//                                 <Button
//                                     variant="outline"
//                                     onClick={() => setIsDialogOpen(false)}
//                                 >
//                                     Close
//                                 </Button>
//                                 <Button
//                                     variant="destructive"
//                                     onClick={handleRemoveCourse}
//                                 >
//                                     Remove
//                                 </Button>
//                             </div>
//                         </div>
//                     )}
//                 </DialogContent>
//             </Dialog>
//         </div>
//     );
// }