"use client";

import { Classroom, Course, Instructor, Major } from "@/app/types";
import CustomPagination from "@/components/custom/pagination";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown, Pencil, Plus, Trash } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { colors, getColorName } from "@/components/custom/colors";
import Papa from 'papaparse';
import { Download, Upload } from "lucide-react";

// Number of courses to show per page
const ITEMS_PER_PAGE = 10;

export default function CoursesView() {
    // State variables
    const [courses, setCourses] = useState<Course[]>([]);
    const [majors, setMajors] = useState<Major[]>([]);
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [sections, setSections] = useState<
        {
            id: number;
            section_id: string;
            instructor_id?: string;
            instructor_name?: string;
        }[]
    >([]);
    const [currentSection, setCurrentSection] = useState("");
    const [currentInstructor, setCurrentInstructor] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [currentInstructorOpen, setCurrentInstructorOpen] = useState(false);

    // State for managing major - updated to handle single selection
    const [selectedMajor, setSelectedMajor] = useState<string>("");

    const [formData, setFormData] = useState({
        title: "",
        code: "",
        color: "",
        duration: 0,
        capacity: 0,
        section: "",
        status: "",
    });

    // Clear status message after 5 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    // Fetch all data on component mount
    useEffect(() => {
        fetchData();
    }, []);

    // Update total pages when courses or items per page changes
    useEffect(() => {
        setTotalPages(Math.ceil(courses.length / ITEMS_PER_PAGE));
    }, [courses]);

    // Get current courses
    const paginatedCourses = courses.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const params = useParams();

    const fetchData = async () => {
        try {
            // Fetch courses
            const scheduleId = params.id;
            const response = await fetch(
                `/api/courses?scheduleId=${scheduleId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API error:", errorData);
                throw new Error(errorData.error || "Failed to fetch courses");
            }

            const coursesData = await response.json();
            console.log("Original API response:", coursesData);

            // Group all courses with the same sectionId
            const combinedCourses = [];
            const sectionIdMap = new Map();

            // First, create a map of courses by sectionId
            coursesData.forEach((course: any) => {
                const sectionIdKey = course.sectionId.toString();

                if (!sectionIdMap.has(sectionIdKey)) {
                    sectionIdMap.set(sectionIdKey, {
                        ...course,
                        major: course.major, // Just store the single major
                    });
                }
            });

            console.log(
                "Grouped by sectionId:",
                Array.from(sectionIdMap.values())
            );

            // Convert map to array for state
            const processedCourses = Array.from(sectionIdMap.values());

            // Set the processed courses to state
            setCourses(processedCourses);

            // Reset to first page when data changes
            setCurrentPage(1);

            // Calculate total pages
            setTotalPages(Math.ceil(processedCourses.length / ITEMS_PER_PAGE));

            // Fetch majors data
            if (scheduleId !== undefined) {
                await fetchMajors(scheduleId);
                // Fetch instructors data
                await fetchInstructors(scheduleId);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            setStatusMessage({
                text: "Failed to load courses. Please try again.",
                type: "error",
            });
        }
    };

    // Add separate functions for fetching majors and instructors
    const fetchMajors = async (scheduleId: string | string[]) => {
        try {
            const response = await fetch(
                `/api/majors?scheduleId=${scheduleId}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error fetching majors:", errorData);
                throw new Error(errorData.error || "Failed to fetch majors");
            }

            const majorsData = await response.json();
            console.log("Majors data:", majorsData);
            setMajors(majorsData);
        } catch (error) {
            console.error("Error fetching majors:", error);
            setStatusMessage({
                text: "Failed to load majors. Please try again.",
                type: "error",
            });
        }
    };

    const fetchInstructors = async (scheduleId: string | string[]) => {
        try {
            const response = await fetch(
                `/api/instructors?scheduleId=${scheduleId}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error fetching instructors:", errorData);
                throw new Error(
                    errorData.error || "Failed to fetch instructors"
                );
            }

            const instructorsData = await response.json();
            console.log("Instructors data:", instructorsData);
            setInstructors(instructorsData);
        } catch (error) {
            console.error("Error fetching instructors:", error);
            setStatusMessage({
                text: "Failed to load instructors. Please try again.",
                type: "error",
            });
        }
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleSelectChange = (name: string, value: string) => {
        if (name === "duration") {
            setFormData({
                ...formData,
                [name]: parseInt(value),
            });
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }
    };

    // Function to add a section with instructor
    const addSection = () => {
        if (!currentSection) return;

        const newSection = {
            id: Date.now(), // Using timestamp for unique ID
            section_id: currentSection,
            instructor_id: currentInstructor?.id ?? undefined,
            instructor_name: currentInstructor?.name ?? undefined,
        };

        setSections([...sections, newSection]);

        // Reset inputs
        setCurrentSection("");
        setCurrentInstructor(null);
    };

    // Function to update instructor for an existing section
    const updateSectionInstructor = (
        sectionId: number,
        instructorId: string,
        instructorName: string
    ) => {
        console.log(
            "Updating instructor:",
            sectionId,
            instructorId,
            instructorName
        );
        setSections(
            sections.map((section) =>
                section.id === sectionId
                    ? {
                          ...section,
                          instructor_id: instructorId,
                          instructor_name: instructorName,
                      }
                    : section
            )
        );
        setFormData({ ...formData });
    };

    const removeSection = (id: number) => {
        setSections(sections.filter((section) => section.id !== id));
    };

    const handleAddCourse = async () => {
        // Make sure we have at least one section and a major
        if (sections.length === 0 || !selectedMajor) {
            setStatusMessage({
                text:
                    sections.length === 0
                        ? "At least one section is required"
                        : "A major is required",
                type: "error",
            });
            return;
        }

        try {
            const scheduleId = params.id;

            // Create an array of sections with instructors
            const sectionsList = sections.map((item) => ({
                section: item.section_id,
                instructorId: item.instructor_id || null,
            }));

            // Create API payload with the base course data, the major, and schedule ID
            const apiData = {
                code: formData.code,
                title: formData.title,
                majorsList: [selectedMajor], // Send as an array with one element
                color: formData.color,
                status: formData.status,
                duration: Number(formData.duration),
                capacity: Number(formData.capacity),
                sectionsList: sectionsList, // Now includes instructor IDs per section
                scheduleId: Number(scheduleId),
            };

            console.log("Sending to API:", apiData);

            const response = await fetch("/api/courses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (response.ok) {
                // Refresh course list after adding
                await fetchData();
                setIsAddDialogOpen(false);
                resetForm();
                setStatusMessage({
                    text: "Course added successfully",
                    type: "success",
                });
            } else {
                const error = await response.json();
                console.error("Error adding courses:", error);
                setStatusMessage({
                    text: "Failed to add course. Please try again.",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error adding courses:", error);
            setStatusMessage({
                text: "Failed to add course. Please try again.",
                type: "error",
            });
        }
    };

    const handleEditCourse = async () => {
        // Make sure we have at least one section and a major
        if (sections.length === 0 || !selectedMajor) {
            setStatusMessage({
                text:
                    sections.length === 0
                        ? "At least one section is required"
                        : "A major is required",
                type: "error",
            });
            return;
        }

        try {
            // Ensure all required fields have values and proper types
            if (!selectedCourse?.sectionId) {
                setStatusMessage({
                    text: "Missing section ID",
                    type: "error",
                });
                return;
            }

            // Ensure sectionId is a number (API expects number)
            const sectionId =
                typeof selectedCourse.sectionId === "number"
                    ? selectedCourse.sectionId
                    : Number(selectedCourse.sectionId);

            if (isNaN(sectionId)) {
                setStatusMessage({
                    text: "Invalid section ID format",
                    type: "error",
                });
                return;
            }

            // Create an array of sections with instructors
            const sectionsList = sections.map((item) => ({
                section: item.section_id,
                instructorId: item.instructor_id || null,
            }));

            // Pre-validate all required fields
            if (
                !formData.title ||
                !formData.code ||
                !selectedMajor ||
                !formData.color ||
                !formData.status
            ) {
                setStatusMessage({
                    text: "All course fields are required",
                    type: "error",
                });
                return;
            }

            // Create API payload with the base course data and the sectionId from the selectedCourse
            const apiData = {
                sectionId: sectionId,
                code: formData.code,
                title: formData.title,
                majorsList: [selectedMajor], // Send as an array with one element
                color: formData.color,
                status: formData.status,
                duration: Number(formData.duration) || 1,
                capacity: Number(formData.capacity) || 1,
                sectionsList: sectionsList, // Now includes instructor IDs per section
            };

            console.log("Sending to API:", apiData);

            const response = await fetch("/api/courses", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            // Handle the response
            let responseData;
            const responseText = await response.text();

            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch (e) {
                console.error("Error parsing response:", e);
                responseData = { error: "Invalid response format" };
            }

            if (!response.ok) {
                console.error("API Error Response:", responseData);

                // Handle validation errors specifically
                if (
                    responseData.error === "Validation failed" &&
                    responseData.details
                ) {
                    // Format validation errors into a readable message
                    const errorMessages = Array.isArray(responseData.details)
                        ? responseData.details
                              .map((err: { message: string }) => err.message)
                              .join(", ")
                        : JSON.stringify(responseData.details);

                    throw new Error(`Validation failed: ${errorMessages}`);
                }

                throw new Error(
                    responseData.error || "Failed to update course"
                );
            }

            // Refresh course list after editing
            await fetchData();
            setIsEditDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Course updated successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error editing course:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to update course. Please try again.",
                type: "error",
            });
        }
    };

    const handleDeleteCourse = async () => {
        if (!selectedCourse?.sectionId) return;

        try {
            const response = await fetch("/api/courses", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sectionId: selectedCourse.sectionId,
                }),
            });

            if (response.ok) {
                // Update local state to remove the deleted course
                setCourses(
                    courses.filter(
                        (course) =>
                            course.sectionId !== selectedCourse.sectionId
                    )
                );
                setIsDeleteDialogOpen(false);
                resetForm();
                setStatusMessage({
                    text: "Course deleted successfully",
                    type: "success",
                });
            } else {
                const error = await response.json();
                console.error("Error deleting course:", error);
                setStatusMessage({
                    text: "Failed to delete course. Please try again.",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error deleting course:", error);
            setStatusMessage({
                text: "Failed to delete course. Please try again.",
                type: "error",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            code: "",
            color: "",
            duration: 0,
            capacity: 0,
            section: "",
            status: "",
        });
        setSelectedCourse(null);
        setSections([]);
        setCurrentSection("");
        setCurrentInstructor(null);
        // Reset major state
        setSelectedMajor("");
    };

    const openEditDialog = (course: Course) => {
        setSelectedCourse(course);
        setFormData({
            title: course.title,
            code: course.code,
            color: course.color ? course.color.toString() : "", // Convert to string
            duration: course.duration,
            capacity: course.capacity,
            section: course.section,
            status: course.status || "offline",
        });

        // Get the instructor for this section
        const instructorName = `${course.firstName || ""} ${
            course.lastName || ""
        }`.trim();

        // Initialize with the current section and its instructor
        setSections([
            {
                id: 1,
                section_id: course.section,
                instructor_id: course.instructorId,
                instructor_name:
                    instructorName !== "" ? instructorName : undefined,
            },
        ]);

        // Initialize with the current major
        setSelectedMajor(course.major);

        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (course: Course) => {
        setSelectedCourse(course);
        setIsDeleteDialogOpen(true);
    };
    // Add these state variables to your existing state in CoursesView component
const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
const [importFile, setImportFile] = useState<File | null>(null);
const [importProgress, setImportProgress] = useState<{
    total: number;
    completed: number;
    errors: string[];
    isImporting: boolean;
}>({
    total: 0,
    completed: 0,
    errors: [],
    isImporting: false,
});

// Types for CSV data
interface CSVCourseRow {
    code: string;
    title: string;
    major: string;
    color: string;
    status: string;
    duration: string;
    capacity: string;
    section: string;
    instructor_name?: string;
}

// Validation function for course CSV data
const validateCourseData = (row: any, rowIndex: number): CSVCourseRow | string => {
    const errors: string[] = [];
    
    // Check required fields
    if (!row.code || typeof row.code !== 'string' || row.code.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Course code is required`);
    }
    
    if (!row.title || typeof row.title !== 'string' || row.title.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Course title is required`);
    }
    
    if (!row.major || typeof row.major !== 'string' || row.major.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Major is required`);
    } else {
        // Check if major exists in the system
        const majorExists = majors.some(major => 
            major.name.toLowerCase() === row.major.trim().toLowerCase()
        );
        if (!majorExists) {
            errors.push(`Row ${rowIndex + 1}: Major "${row.major.trim()}" does not exist in the system`);
        }
    }
    
    if (!row.color || typeof row.color !== 'string' || row.color.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Color is required`);
    } else {
        // Validate color exists in the colors array
        const colorExists = colors.includes(row.color.trim());
        if (!colorExists) {
            errors.push(`Row ${rowIndex + 1}: Color "${row.color.trim()}" is not valid`);
        }
    }
    
    if (!row.status || typeof row.status !== 'string' || row.status.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Status is required`);
    } else {
        const validStatuses = ['online', 'offline'];
        if (!validStatuses.includes(row.status.trim().toLowerCase())) {
            errors.push(`Row ${rowIndex + 1}: Status must be 'online' or 'offline'`);
        }
    }
    
    if (!row.duration) {
        errors.push(`Row ${rowIndex + 1}: Duration is required`);
    } else {
        const durationNum = Number(row.duration);
        if (isNaN(durationNum) || durationNum <= 0) {
            errors.push(`Row ${rowIndex + 1}: Duration must be a valid positive number`);
        }
    }
    
    if (!row.capacity) {
        errors.push(`Row ${rowIndex + 1}: Capacity is required`);
    } else {
        const capacityNum = Number(row.capacity);
        if (isNaN(capacityNum) || capacityNum <= 0) {
            errors.push(`Row ${rowIndex + 1}: Capacity must be a valid positive number`);
        }
    }
    
    if (!row.section || typeof row.section !== 'string' || row.section.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Section is required`);
    }
    
    // Validate instructor if provided
    if (row.instructor_name && typeof row.instructor_name === 'string' && row.instructor_name.trim() !== '') {
        const instructorExists = instructors.some(instructor => 
            `${instructor.first_name} ${instructor.last_name}`.toLowerCase() === row.instructor_name.trim().toLowerCase()
        );
        if (!instructorExists) {
            errors.push(`Row ${rowIndex + 1}: Instructor "${row.instructor_name.trim()}" does not exist in the system`);
        }
    }
    
    if (errors.length > 0) {
        return errors.join(', ');
    }
    
    // Return cleaned data
    return {
        code: row.code.trim(),
        title: row.title.trim(),
        major: row.major.trim(),
        color: row.color.trim(),
        status: row.status.trim().toLowerCase(),
        duration: row.duration.toString(),
        capacity: row.capacity.toString(),
        section: Number(row.section).toString(),
        instructor_name: row.instructor_name ? row.instructor_name.trim() : undefined,
    };
};

// Group courses by code for import
const groupCoursesByCode = (validCourses: CSVCourseRow[]) => {
    const grouped = new Map<string, CSVCourseRow[]>();
    
    validCourses.forEach(course => {
        const key = course.code.toLowerCase();
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(course);
    });
    
    return grouped;
};

// Main import function
const handleImportCSV = async () => {
    if (!importFile) {
        setStatusMessage({
            text: "Please select a CSV file to import",
            type: "error",
        });
        return;
    }

    const scheduleId = params.id;
    
    setImportProgress({
        total: 0,
        completed: 0,
        errors: [],
        isImporting: true,
    });

    try {
        // Parse CSV file
        Papa.parse(importFile, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
            complete: async (results) => {
                const csvData = results.data as any[];
                const validCourses: CSVCourseRow[] = [];
                const errors: string[] = [];

                // Validate each row
                csvData.forEach((row, index) => {
                    const validationResult = validateCourseData(row, index);
                    if (typeof validationResult === 'string') {
                        errors.push(validationResult);
                    } else {
                        validCourses.push(validationResult);
                    }
                });

                // Group courses by code to handle multiple sections
                const groupedCourses = groupCoursesByCode(validCourses);
                
                // Check for duplicate codes in existing courses
                for (const [courseCode, courseSections] of groupedCourses) {
                    const existingCourse = courses.some(course => 
                        course.code.toLowerCase() === courseCode
                    );
                    if (existingCourse) {
                        errors.push(`Course code "${courseSections[0].code}" already exists in the system`);
                        // Remove from valid courses
                        validCourses.splice(validCourses.findIndex(c => c.code.toLowerCase() === courseCode), courseSections.length);
                    }
                }

                setImportProgress(prev => ({
                    ...prev,
                    total: groupedCourses.size,
                    errors: errors,
                }));

                if (groupedCourses.size === 0) {
                    setStatusMessage({
                        text: "No valid courses found in the CSV file",
                        type: "error",
                    });
                    setImportProgress(prev => ({ ...prev, isImporting: false }));
                    return;
                }

                // Import valid courses
                let completed = 0;
                const importErrors: string[] = [...errors];

                for (const [courseCode, courseSections] of groupedCourses) {
                    try {
                        // Use the first section's data as the base course data
                        const baseCourse = courseSections[0];
                        
                        // Create sections list with instructors
                        const sectionsList = courseSections.map(courseSection => {
                            let instructorId = null;
                            if (courseSection.instructor_name) {
                                const instructor = instructors.find(inst => 
                                    `${inst.first_name} ${inst.last_name}`.toLowerCase() === courseSection.instructor_name!.toLowerCase()
                                );
                                instructorId = instructor ? instructor.id.toString() : null;
                            }
                            
                            return {
                                section: courseSection.section,
                                instructorId: instructorId,
                            };
                        });

                        const apiData = {
                            code: baseCourse.code,
                            title: baseCourse.title,
                            majorsList: [baseCourse.major],
                            color: baseCourse.color,
                            status: baseCourse.status,
                            duration: Number(baseCourse.duration),
                            capacity: Number(baseCourse.capacity),
                            sectionsList: sectionsList,
                            scheduleId: Number(scheduleId),
                        };

                        const response = await fetch("/api/courses", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify(apiData),
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            importErrors.push(
                                `Failed to import course ${baseCourse.code}: ${
                                    errorData.error || 'Unknown error'
                                }`
                            );
                        } else {
                            completed++;
                        }
                    } catch (error) {
                        importErrors.push(
                            `Failed to import course ${courseCode}: ${
                                error instanceof Error ? error.message : 'Unknown error'
                            }`
                        );
                    }

                    // Update progress
                    setImportProgress(prev => ({
                        ...prev,
                        completed: completed,
                        errors: importErrors,
                    }));

                    // Small delay to prevent overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                // Final update
                setImportProgress(prev => ({ ...prev, isImporting: false }));

                // Refresh the course list
                await fetchData();

                // Show completion message
                if (completed > 0) {
                    setStatusMessage({
                        text: `Successfully imported ${completed} course(s)${
                            importErrors.length > 0 ? ` with ${importErrors.length} error(s)` : ''
                        }`,
                        type: completed === groupedCourses.size ? "success" : "error",
                    });
                } else {
                    setStatusMessage({
                        text: "Failed to import any courses",
                        type: "error",
                    });
                }
            },
            error: (error) => {
                console.error("CSV parsing error:", error);
                setStatusMessage({
                    text: "Failed to parse CSV file. Please check the file format.",
                    type: "error",
                });
                setImportProgress(prev => ({ ...prev, isImporting: false }));
            },
        });
    } catch (error) {
        console.error("Import error:", error);
        setStatusMessage({
            text: "Failed to import courses. Please try again.",
            type: "error",
        });
        setImportProgress(prev => ({ ...prev, isImporting: false }));
    }
};

// File selection handler
const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
        setImportFile(file);
    } else {
        setStatusMessage({
            text: "Please select a valid CSV file",
            type: "error",
        });
        event.target.value = ''; // Reset file input
    }
};

// Reset import state
const resetImportState = () => {
    setImportFile(null);
    setImportProgress({
        total: 0,
        completed: 0,
        errors: [],
        isImporting: false,
    });
};

// Download CSV with current courses data
const downloadCoursesCSV = () => {
    try {
        // Create CSV header
        const headers = ['code', 'title', 'major', 'color', 'status', 'duration', 'capacity', 'section', 'instructor_name'];
        
        // Convert courses data to CSV rows (one row per section)
        const csvRows: string[][] = [];
        
        courses.forEach(course => {
            const instructorName = `${course.firstName || ""} ${course.lastName || ""}`.trim() || "";
            
            csvRows.push([
                course.code,
                course.title,
                course.major || "",
                course.color || "",
                course.status || "offline",
                course.duration.toString(),
                course.capacity.toString(),
                course.section,
                instructorName
            ]);
        });
        
        // Combine headers and data
        const allRows = [headers, ...csvRows];
        
        // Convert to CSV string
        const csvContent = allRows.map(row => 
            row.map(field => {
                // Escape quotes and wrap in quotes if field contains comma, quote, or newline
                const fieldStr = String(field || '');
                if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
                    return `"${fieldStr.replace(/"/g, '""')}"`;
                }
                return fieldStr;
            }).join(',')
        ).join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        
        // Generate filename with current date
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `courses_export_${today}.csv`);
        
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setStatusMessage({
            text: `Exported ${courses.length} courses to CSV`,
            type: "success",
        });
    } catch (error) {
        console.error('Error exporting CSV:', error);
        setStatusMessage({
            text: "Failed to export courses. Please try again.",
            type: "error",
        });
    }
};


    return (
        <div>
            {statusMessage && (
                <div
                    className={`mb-4 p-3 rounded ${
                        statusMessage.type === "success"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                    }`}
                >
                    {statusMessage.text}
                </div>
            )}

<div className="flex justify-between items-center mb-6">
    <h2 className="text-xl font-bold">Courses</h2>
    <div className="flex gap-2">
    <Button
            onClick={() => setIsImportDialogOpen(true)}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
        >
            <Upload className="mr-2 h-4 w-4" /> Import CSV
        </Button>  
        <Button
            onClick={downloadCoursesCSV}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
            disabled={courses.length === 0}
        >
            <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
     
     
        <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700"
        >
            <Plus className="mr-2 h-4 w-4" /> New Course
        </Button>
    </div>
</div>

            <>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="border p-2 bg-gray-100 text-left">
                                    CODE
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    TITLE
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    SECTION
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    INSTRUCTOR
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    MAJOR
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    Capacity
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    Status
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="border p-4 text-center text-gray-500"
                                    >
                                        No courses found. Add a new course to
                                        get started.
                                    </td>
                                </tr>
                            ) : paginatedCourses.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="border p-4 text-center text-gray-500"
                                    >
                                        No courses found on this page.
                                    </td>
                                </tr>
                            ) : (
                                paginatedCourses.map((course) => (
                                    <tr key={course.sectionId}>
                                        <td className="border p-2">
                                            {course.code}
                                        </td>
                                        <td className="border p-2">
                                            {course.title}
                                        </td>
                                        <td className="border p-2">
                                            {course.section}
                                        </td>
                                        <td className="border p-2">
                                            {`${course.firstName || ""} ${
                                                course.lastName || ""
                                            }`.trim() || "—"}
                                        </td>
                                        <td className="border p-2">
                                            {course.major || "—"}
                                        </td>
                                        <td className="border p-2">
                                            {course.capacity}
                                        </td>
                                        <td className="border p-2">
                                            {course.status}
                                        </td>
                                        <td className="border p-2">
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        openEditDialog(course)
                                                    }
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        openDeleteDialog(course)
                                                    }
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Add pagination if we have courses */}
                {courses.length > 0 && (
                    <div className="mt-4">
                        <CustomPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </>

            {/* Add Course Dialog */}
            <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsAddDialogOpen(open);
                }}
            >
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add New Course</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Course Code</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="title">Course Name</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* Major dropdown - Single select */}
                        <div className="space-y-2">
                            <Label htmlFor="major">Major</Label>
                            <Select
                                value={selectedMajor}
                                onValueChange={setSelectedMajor}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a major" />
                                </SelectTrigger>
                                <SelectContent>
                                    {majors.map((major) => (
                                        <SelectItem
                                            key={major.id}
                                            value={major.name}
                                        >
                                            {major.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* New Status Input */}
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={formData?.status || ""}
                                onValueChange={(value) =>
                                    handleSelectChange("status", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="online">
                                        Online
                                    </SelectItem>
                                    <SelectItem value="offline">
                                        Offline
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="color">Color</Label>
                            <Select
                                value={formData?.color || ""}
                                onValueChange={(value) =>
                                    handleSelectChange("color", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select color" />
                                </SelectTrigger>
                                <SelectContent>
                                    {colors.map((color) => (
                                        <SelectItem key={color} value={color}>
                                            {getColorName(color)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="duration">
                                    Duration (hours)
                                </Label>
                                <Input
                                    id="duration"
                                    name="duration"
                                    type="number"
                                    min="1"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="capacity">Capacity</Label>
                                <Input
                                    id="capacity"
                                    name="capacity"
                                    type="number"
                                    min="1"
                                    value={formData.capacity}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* Section list with instructors */}
                        <div className="space-y-6">
                            <div>
                                <Label className="text-base font-medium">
                                    Sections
                                </Label>
                                <p className="text-sm text-gray-500 mt-1">
                                    Add course sections with instructors
                                </p>
                            </div>

                            {sections.length > 0 && (
                                <div className="space-y-2 mb-2">
                                    {sections.map((section) => (
                                        <div
                                            key={section.id}
                                            className="p-3 border rounded-md"
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="bg-blue-50 px-2 py-1 rounded-md text-sm">
                                                    Section {section.section_id}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        removeSection(
                                                            section.id
                                                        )
                                                    }
                                                    className="h-8 w-8"
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="mt-2">
                                                <Label className="text-sm">
                                                    Instructor
                                                </Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full justify-between mt-1"
                                                        >
                                                            {section.instructor_name ||
                                                                "Select instructor..."}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-full p-0">
                                                        <Command>
                                                            <CommandInput placeholder="Search instructor..." />
                                                            <CommandEmpty>
                                                                No instructor
                                                                found.
                                                            </CommandEmpty>
                                                            <CommandGroup>
                                                                {instructors.map(
                                                                    (
                                                                        instructor
                                                                    ) => (
                                                                        <CommandItem
                                                                            key={
                                                                                instructor.id
                                                                            }
                                                                            value={`${instructor.first_name} ${instructor.last_name}`}
                                                                            onSelect={() => {
                                                                                updateSectionInstructor(
                                                                                    section.id,
                                                                                    instructor.id.toString(),
                                                                                    `${instructor.first_name} ${instructor.last_name}`
                                                                                );
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={`mr-2 h-4 w-4 ${
                                                                                    section.instructor_id ===
                                                                                    instructor.id.toString()
                                                                                        ? "opacity-100"
                                                                                        : "opacity-0"
                                                                                }`}
                                                                            />
                                                                            {
                                                                                instructor.first_name
                                                                            }{" "}
                                                                            {
                                                                                instructor.last_name
                                                                            }
                                                                        </CommandItem>
                                                                    )
                                                                )}
                                                            </CommandGroup>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid gap-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="section">
                                            Section Number
                                        </Label>
                                        <Input
                                            id="section"
                                            placeholder="Enter section number"
                                            value={currentSection}
                                            onChange={(e) =>
                                                setCurrentSection(
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="section-instructor">
                                            Instructor (Optional)
                                        </Label>
                                        <Popover
                                            open={currentInstructorOpen}
                                            onOpenChange={
                                                setCurrentInstructorOpen
                                            }
                                        >
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={
                                                        currentInstructorOpen
                                                    }
                                                    className="w-full justify-between"
                                                >
                                                    {currentInstructor?.name ||
                                                        "Select instructor..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-full p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search instructor..." />
                                                    <CommandEmpty>
                                                        No instructor found.
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {instructors.map(
                                                            (instructor) => (
                                                                <CommandItem
                                                                    key={
                                                                        instructor.id
                                                                    }
                                                                    value={`${instructor.first_name} ${instructor.last_name}`}
                                                                    onSelect={() => {
                                                                        setCurrentInstructor(
                                                                            {
                                                                                id: instructor.id.toString(),
                                                                                name: `${instructor.first_name} ${instructor.last_name}`,
                                                                            }
                                                                        );
                                                                        setCurrentInstructorOpen(
                                                                            false
                                                                        );
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={`mr-2 h-4 w-4 ${
                                                                            currentInstructor?.id ===
                                                                            instructor.id.toString()
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        }`}
                                                                    />
                                                                    {
                                                                        instructor.first_name
                                                                    }{" "}
                                                                    {
                                                                        instructor.last_name
                                                                    }
                                                                </CommandItem>
                                                            )
                                                        )}
                                                    </CommandGroup>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <Button
                                    onClick={addSection}
                                    disabled={!currentSection}
                                    className="w-full mt-2"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add
                                    Section
                                </Button>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    resetForm();
                                    setIsAddDialogOpen(false);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddCourse}
                                disabled={
                                    !formData.title ||
                                    !formData.code ||
                                    !selectedMajor ||
                                    sections.length === 0
                                }
                            >
                                Add Course
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Course Dialog */}
            <Dialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsEditDialogOpen(open);
                }}
            >
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Course</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-code">Course Code</Label>
                                <Input
                                    id="edit-code"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-title">Course Name</Label>
                                <Input
                                    id="edit-title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* Major dropdown - Single select for Edit Dialog */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-major">Major</Label>
                            <Select
                                value={selectedMajor}
                                onValueChange={setSelectedMajor}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a major" />
                                </SelectTrigger>
                                <SelectContent>
                                    {majors.map((major) => (
                                        <SelectItem
                                            key={major.id}
                                            value={major.name}
                                        >
                                            {major.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status field */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-status">Status</Label>
                            <Select
                                value={formData?.status || ""}
                                onValueChange={(value) =>
                                    handleSelectChange("status", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="online">
                                        Online
                                    </SelectItem>
                                    <SelectItem value="offline">
                                        Offline
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-color">Color</Label>
                            <Select
                                value={formData?.color || ""}
                                onValueChange={(value) =>
                                    handleSelectChange("color", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select color" />
                                </SelectTrigger>
                                <SelectContent>
                                    {colors.map((color) => (
                                        <SelectItem key={color} value={color}>
                                            {getColorName(color)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-duration">
                                    Duration (hours)
                                </Label>
                                <Input
                                    id="edit-duration"
                                    name="duration"
                                    type="number"
                                    min="1"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-capacity">Capacity</Label>
                                <Input
                                    id="edit-capacity"
                                    name="capacity"
                                    type="number"
                                    min="1"
                                    value={formData.capacity}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* Section list with instructors - Edit Dialog */}
                        <div className="space-y-6">
                            <div>
                                <Label className="text-base font-medium">
                                    Sections
                                </Label>
                                <p className="text-sm text-gray-500 mt-1">
                                    Add course sections with instructors
                                </p>
                            </div>

                            {sections.length > 0 && (
                                <div className="space-y-2 mb-2">
                                    {sections.map((section) => (
                                        <div
                                            key={section.id}
                                            className="p-3 border rounded-md"
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="bg-blue-50 px-2 py-1 rounded-md text-sm">
                                                    Section {section.section_id}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        removeSection(
                                                            section.id
                                                        )
                                                    }
                                                    className="h-8 w-8"
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="mt-2">
                                                <Label className="text-sm">
                                                    Instructor
                                                </Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full justify-between mt-1"
                                                        >
                                                            {section.instructor_name ||
                                                                "Select instructor..."}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-full p-0">
                                                        <Command>
                                                            <CommandInput placeholder="Search instructor..." />
                                                            <CommandEmpty>
                                                                No instructor
                                                                found.
                                                            </CommandEmpty>
                                                            <CommandGroup>
                                                                {instructors.map(
                                                                    (
                                                                        instructor
                                                                    ) => (
                                                                        <CommandItem
                                                                            key={
                                                                                instructor.id
                                                                            }
                                                                            value={`${instructor.first_name} ${instructor.last_name}`}
                                                                            onSelect={() => {
                                                                                // Make sure this function is being called when clicking an instructor
                                                                                console.log(
                                                                                    "Instructor selected:",
                                                                                    instructor.id,
                                                                                    instructor.first_name,
                                                                                    instructor.last_name
                                                                                );
                                                                                updateSectionInstructor(
                                                                                    section.id,
                                                                                    instructor.id.toString(),
                                                                                    `${instructor.first_name} ${instructor.last_name}`
                                                                                );
                                                                                // Close the popover when selecting an instructor
                                                                                setCurrentInstructorOpen(
                                                                                    false
                                                                                );
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={`mr-2 h-4 w-4 ${
                                                                                    section.instructor_id ===
                                                                                    instructor.id.toString()
                                                                                        ? "opacity-100"
                                                                                        : "opacity-0"
                                                                                }`}
                                                                            />
                                                                            {
                                                                                instructor.first_name
                                                                            }{" "}
                                                                            {
                                                                                instructor.last_name
                                                                            }
                                                                        </CommandItem>
                                                                    )
                                                                )}
                                                            </CommandGroup>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid gap-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-section">
                                            Section Number
                                        </Label>
                                        <Input
                                            id="edit-section"
                                            placeholder="Enter section number"
                                            value={currentSection}
                                            onChange={(e) =>
                                                setCurrentSection(
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit-section-instructor">
                                            Instructor (Optional)
                                        </Label>
                                        <Popover
                                            open={currentInstructorOpen}
                                            onOpenChange={
                                                setCurrentInstructorOpen
                                            }
                                        >
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={
                                                        currentInstructorOpen
                                                    }
                                                    className="w-full justify-between"
                                                >
                                                    {currentInstructor?.name ||
                                                        "Select instructor..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-full p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search instructor..." />
                                                    <CommandEmpty>
                                                        No instructor found.
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {instructors.map(
                                                            (instructor) => (
                                                                <CommandItem
                                                                    key={
                                                                        instructor.id
                                                                    }
                                                                    value={`${instructor.first_name} ${instructor.last_name}`}
                                                                    onSelect={() => {
                                                                        setCurrentInstructor(
                                                                            {
                                                                                id: instructor.id.toString(),
                                                                                name: `${instructor.first_name} ${instructor.last_name}`,
                                                                            }
                                                                        );
                                                                        setCurrentInstructorOpen(
                                                                            false
                                                                        );
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={`mr-2 h-4 w-4 ${
                                                                            currentInstructor?.id ===
                                                                            instructor.id.toString()
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        }`}
                                                                    />
                                                                    {
                                                                        instructor.first_name
                                                                    }{" "}
                                                                    {
                                                                        instructor.last_name
                                                                    }
                                                                </CommandItem>
                                                            )
                                                        )}
                                                    </CommandGroup>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <Button
                                    onClick={addSection}
                                    disabled={!currentSection}
                                    className="w-full mt-2"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add
                                    Section
                                </Button>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    resetForm();
                                    setIsEditDialogOpen(false);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleEditCourse}
                                disabled={
                                    !formData.title ||
                                    !formData.code ||
                                    !selectedMajor ||
                                    sections.length === 0
                                }
                            >
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Course Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (!open) setSelectedCourse(null);
                    setIsDeleteDialogOpen(open);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Course</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>Are you sure you want to delete this course?</p>
                        <p className="font-medium mt-2">
                            {selectedCourse?.code}: {selectedCourse?.title}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedCourse(null);
                                setIsDeleteDialogOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteCourse}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Import CSV Dialog */}
<Dialog
    open={isImportDialogOpen}
    onOpenChange={(open) => {
        if (!open) resetImportState();
        setIsImportDialogOpen(open);
    }}
>
    <DialogContent className="max-w-lg">
        <DialogHeader>
            <DialogTitle>Import Courses from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex-1">
                    <Label htmlFor="csv-file">Select CSV File</Label>
                    <Input
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        disabled={importProgress.isImporting}
                    />
                   <p className="text-sm text-gray-600 mt-1">
    CSV should contain columns: code, title, major, color, status, duration, capacity, section (number), instructor_name
</p>
<p className="text-xs text-blue-600 mt-1">
    Note: Section should be a number (1, 2, 3, etc.). Multiple rows with the same course code will be treated as different sections of the same course.
</p>
                </div>
            </div>

            {importFile && (
                <div className="text-sm">
                    <p><strong>Selected file:</strong> {importFile.name}</p>
                    <p><strong>Size:</strong> {(importFile.size / 1024).toFixed(2)} KB</p>
                </div>
            )}

            {importProgress.isImporting && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Progress:</span>
                        <span>{importProgress.completed} / {importProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                                width: importProgress.total > 0 
                                    ? `${(importProgress.completed / importProgress.total) * 100}%` 
                                    : '0%' 
                            }}
                        ></div>
                    </div>
                </div>
            )}

            {importProgress.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto">
                    <p className="text-sm font-medium text-red-600 mb-1">
                        Errors ({importProgress.errors.length}):
                    </p>
                    <div className="text-xs space-y-1">
                        {importProgress.errors.slice(0, 10).map((error, index) => (
                            <p key={index} className="text-red-600">{error}</p>
                        ))}
                        {importProgress.errors.length > 10 && (
                            <p className="text-red-600 font-medium">
                                ... and {importProgress.errors.length - 10} more errors
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>

        <DialogFooter>
            <Button
                variant="outline"
                onClick={() => {
                    resetImportState();
                    setIsImportDialogOpen(false);
                }}
                disabled={importProgress.isImporting}
            >
                Cancel
            </Button>
            <Button
                onClick={handleImportCSV}
                disabled={!importFile || importProgress.isImporting}
            >
                {importProgress.isImporting ? 'Importing...' : 'Import'}
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
        </div>
    );
}
