"use client";

import { Classroom, Course, Instructor, Major } from "@/app/types";
import {
    colors,
    ColorSelectItem,
    ColorSelectTrigger,
    getColorName,
    getColorNameFromHex,
    getHexFromColorName,
} from "@/components/custom/colors";
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
import {
    Check,
    ChevronsUpDown,
    Download,
    Pencil,
    Plus,
    Trash,
    Upload,
} from "lucide-react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import { useEffect, useState } from "react";

// Number of courses to show per page
const ITEMS_PER_PAGE = 20;

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
    // Update sections state structure to include status
    const [sections, setSections] = useState<
        {
            id: number;
            section_id: string;
            instructor_id?: string;
            instructor_name?: string;
            status: string; // Add this
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
            id: Date.now(),
            section_id: currentSection,
            instructor_id: currentInstructor?.id ?? undefined,
            instructor_name: currentInstructor?.name ?? undefined,
            status: "offline", // Add this line
        };

        setSections([...sections, newSection]);
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
    // Add this function after updateSectionInstructor
    const updateSectionStatus = (sectionId: number, status: string) => {
        setSections(
            sections.map((section) =>
                section.id === sectionId
                    ? { ...section, status: status }
                    : section
            )
        );
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
                status: item.status || "offline", // CORRECT
            }));

            // Create API payload with the base course data, the major, and schedule ID
            const apiData = {
                code: formData.code,
                title: formData.title,
                majorsList: [selectedMajor], // Send as an array with one element
                color: getHexFromColorName(formData.color), // Convert to hex
                // status: formData.status,
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
                instructorId: item.instructor_id
                    ? String(item.instructor_id)
                    : null,
                status: item.status || "offline",
            }));
            // Pre-validate all required fields
            if (
                !formData.title ||
                !formData.code ||
                !selectedMajor ||
                !formData.color
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
                color: getHexFromColorName(formData.color), // Convert to hex
                // status: formData.status,
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
            color: course.color ? course.color.toString() : "",
            duration: course.duration,
            capacity: course.capacity,
            section: course.section,
            status: course.status || "offline",
        });

        const instructorName = `${course.firstName || ""} ${
            course.lastName || ""
        }`.trim();

        setSections([
            {
                id: 1,
                section_id: course.section,
                instructor_id: course.instructorId
                    ? String(course.instructorId)
                    : undefined, // Convert to string
                instructor_name:
                    instructorName !== "" ? instructorName : undefined,
                status: course.status || "offline",
            },
        ]);

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
    const validateCourseData = (
        row: any,
        rowIndex: number
    ): CSVCourseRow | string => {
        const errors: string[] = [];

        // Check required fields
        if (
            !row.code ||
            typeof row.code !== "string" ||
            row.code.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Course code is required`);
        }

        if (
            !row.title ||
            typeof row.title !== "string" ||
            row.title.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Course title is required`);
        }

        if (
            !row.major ||
            typeof row.major !== "string" ||
            row.major.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Major is required`);
        } else {
            // Check if major exists in the system
            const majorExists = majors.some(
                (major) =>
                    major.name.toLowerCase() === row.major.trim().toLowerCase()
            );
            if (!majorExists) {
                errors.push(
                    `Row ${
                        rowIndex + 1
                    }: Major "${row.major.trim()}" does not exist in the system`
                );
            }
        }

        if (
            !row.color ||
            typeof row.color !== "string" ||
            row.color.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Color is required`);
        } else {
            // Validate color exists in the colors array
            const colorExists = colors.includes(row.color.trim());
            if (!colorExists) {
                errors.push(
                    `Row ${
                        rowIndex + 1
                    }: Color "${row.color.trim()}" is not valid`
                );
            }
        }

        if (
            !row.status ||
            typeof row.status !== "string" ||
            row.status.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Status is required`);
        } else {
            const validStatuses = ["online", "offline"];
            if (!validStatuses.includes(row.status.trim().toLowerCase())) {
                errors.push(
                    `Row ${rowIndex + 1}: Status must be 'online' or 'offline'`
                );
            }
        }

        if (!row.duration) {
            errors.push(`Row ${rowIndex + 1}: Duration is required`);
        } else {
            const durationNum = Number(row.duration);
            if (isNaN(durationNum) || durationNum <= 0) {
                errors.push(
                    `Row ${
                        rowIndex + 1
                    }: Duration must be a valid positive number`
                );
            }
        }

        if (!row.capacity) {
            errors.push(`Row ${rowIndex + 1}: Capacity is required`);
        } else {
            const capacityNum = Number(row.capacity);
            if (isNaN(capacityNum) || capacityNum <= 0) {
                errors.push(
                    `Row ${
                        rowIndex + 1
                    }: Capacity must be a valid positive number`
                );
            }
        }

        if (
            !row.section ||
            typeof row.section !== "string" ||
            row.section.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Section is required`);
        }

        // Validate instructor if provided
        if (
            row.instructor_name &&
            typeof row.instructor_name === "string" &&
            row.instructor_name.trim() !== ""
        ) {
            const instructorExists = instructors.some(
                (instructor) =>
                    `${instructor.first_name} ${instructor.last_name}`.toLowerCase() ===
                    row.instructor_name.trim().toLowerCase()
            );
            if (!instructorExists) {
                errors.push(
                    `Row ${
                        rowIndex + 1
                    }: Instructor "${row.instructor_name.trim()}" does not exist in the system`
                );
            }
        }

        if (errors.length > 0) {
            return errors.join(", ");
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
            instructor_name: row.instructor_name
                ? row.instructor_name.trim()
                : undefined,
        };
    };

    // Group courses by code for import
    const groupCoursesByCode = (validCourses: CSVCourseRow[]) => {
        const grouped = new Map<string, CSVCourseRow[]>();

        validCourses.forEach((course) => {
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
                transformHeader: (header) =>
                    header.trim().toLowerCase().replace(/\s+/g, "_"),
                complete: async (results) => {
                    const csvData = results.data as any[];
                    const validCourses: CSVCourseRow[] = [];
                    const errors: string[] = [];

                    // Validate each row
                    csvData.forEach((row, index) => {
                        const validationResult = validateCourseData(row, index);
                        if (typeof validationResult === "string") {
                            errors.push(validationResult);
                        } else {
                            validCourses.push(validationResult);
                        }
                    });

                    // Group courses by code to handle multiple sections
                    const groupedCourses = groupCoursesByCode(validCourses);

                    // Check for duplicate codes in existing courses
                    for (const [courseCode, courseSections] of groupedCourses) {
                        const existingCourse = courses.some(
                            (course) => course.code.toLowerCase() === courseCode
                        );
                        if (existingCourse) {
                            errors.push(
                                `Course code "${courseSections[0].code}" already exists in the system`
                            );
                            // Remove from valid courses
                            validCourses.splice(
                                validCourses.findIndex(
                                    (c) => c.code.toLowerCase() === courseCode
                                ),
                                courseSections.length
                            );
                        }
                    }

                    setImportProgress((prev) => ({
                        ...prev,
                        total: groupedCourses.size,
                        errors: errors,
                    }));

                    if (groupedCourses.size === 0) {
                        setStatusMessage({
                            text: "No valid courses found in the CSV file",
                            type: "error",
                        });
                        setImportProgress((prev) => ({
                            ...prev,
                            isImporting: false,
                        }));
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
                            const sectionsList = courseSections.map(
                                (courseSection) => {
                                    let instructorId = null;
                                    if (courseSection.instructor_name) {
                                        const instructor = instructors.find(
                                            (inst) =>
                                                `${inst.first_name} ${inst.last_name}`.toLowerCase() ===
                                                courseSection.instructor_name!.toLowerCase()
                                        );
                                        instructorId = instructor
                                            ? instructor.id.toString()
                                            : null;
                                    }

                                    return {
                                        section: courseSection.section,
                                        instructorId: instructorId,
                                        status: courseSection.status,
                                    };
                                }
                            );

                            const apiData = {
                                code: baseCourse.code,
                                title: baseCourse.title,
                                majorsList: [baseCourse.major],
                                color: getHexFromColorName(formData.color), // Convert to hex
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
                                    `Failed to import course ${
                                        baseCourse.code
                                    }: ${errorData.error || "Unknown error"}`
                                );
                            } else {
                                completed++;
                            }
                        } catch (error) {
                            importErrors.push(
                                `Failed to import course ${courseCode}: ${
                                    error instanceof Error
                                        ? error.message
                                        : "Unknown error"
                                }`
                            );
                        }

                        // Update progress
                        setImportProgress((prev) => ({
                            ...prev,
                            completed: completed,
                            errors: importErrors,
                        }));

                        // Small delay to prevent overwhelming the server
                        await new Promise((resolve) =>
                            setTimeout(resolve, 200)
                        );
                    }

                    // Final update
                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));

                    // Refresh the course list
                    await fetchData();

                    // Show completion message
                    if (completed > 0) {
                        setStatusMessage({
                            text: `Successfully imported ${completed} course(s)${
                                importErrors.length > 0
                                    ? ` with ${importErrors.length} error(s)`
                                    : ""
                            }`,
                            type:
                                completed === groupedCourses.size
                                    ? "success"
                                    : "error",
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
                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));
                },
            });
        } catch (error) {
            console.error("Import error:", error);
            setStatusMessage({
                text: "Failed to import courses. Please try again.",
                type: "error",
            });
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
        }
    };

    // File selection handler
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === "text/csv") {
            setImportFile(file);
        } else {
            setStatusMessage({
                text: "Please select a valid CSV file",
                type: "error",
            });
            event.target.value = ""; // Reset file input
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
            const headers = [
                "code",
                "title",
                "major",
                "color",
                "status",
                "duration",
                "capacity",
                "section",
                "instructor_name",
            ];

            // Convert courses data to CSV rows (one row per section)
            const csvRows: string[][] = [];

            courses.forEach((course) => {
                const instructorName =
                    `${course.firstName || ""} ${
                        course.lastName || ""
                    }`.trim() || "";

                // Convert hex color back to color name for CSV
                const colorName = getColorNameFromHex(course.color || "");

                csvRows.push([
                    course.code,
                    course.title,
                    course.major || "",
                    colorName,
                    course.status || "offline",
                    course.duration.toString(),
                    course.capacity.toString(),
                    course.section,
                    instructorName,
                ]);
            });

            // Combine headers and data
            const allRows = [headers, ...csvRows];

            // Convert to CSV string
            const csvContent = allRows
                .map((row) =>
                    row
                        .map((field) => {
                            // Escape quotes and wrap in quotes if field contains comma, quote, or newline
                            const fieldStr = String(field || "");
                            if (
                                fieldStr.includes(",") ||
                                fieldStr.includes('"') ||
                                fieldStr.includes("\n")
                            ) {
                                return `"${fieldStr.replace(/"/g, '""')}"`;
                            }
                            return fieldStr;
                        })
                        .join(",")
                )
                .join("\n");

            // Create and download file
            const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
            });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);

            // Generate filename with current date
            const today = new Date().toISOString().split("T")[0];
            link.setAttribute("download", `courses_export_${today}.csv`);

            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setStatusMessage({
                text: `Exported ${courses.length} courses to CSV`,
                type: "success",
            });
        } catch (error) {
            console.error("Error exporting CSV:", error);
            setStatusMessage({
                text: "Failed to export courses. Please try again.",
                type: "error",
            });
        }
    };

    return (
        <div className="space-y-4">
            {statusMessage && (
                <div
                    className={`p-3 rounded border text-sm ${
                        statusMessage.type === "success"
                            ? "bg-green-50 text-green-800 border-green-200"
                            : "bg-red-50 text-red-800 border-red-200"
                    }`}
                >
                    {statusMessage.text}
                </div>
            )}

            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Courses
                    </h2>
                    <p className="text-xs text-gray-600">
                        Manage courses, sections, and instructors
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => setIsImportDialogOpen(true)}
                        variant="outline"
                        className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs px-3 py-1.5 rounded-md"
                    >
                        <Upload className="mr-1 h-3 w-3" /> Import CSV
                    </Button>
                    <Button
                        onClick={downloadCoursesCSV}
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-3 py-1.5 rounded-md"
                        disabled={courses.length === 0}
                    >
                        <Download className="mr-1 h-3 w-3" /> Export CSV
                    </Button>
                    <Button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                    >
                        <Plus className="mr-1 h-3 w-3" /> New Course
                    </Button>
                </div>
            </div>

            {/* Compact Table Container */}
            <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-[#2F2F85] text-white">
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                    Code
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                    Title
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                    Section
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                    Instructor
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-25">
                                    Major
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                    Duration
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                    Capacity
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                    Status
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {courses.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-3 py-8 text-center text-gray-500 text-sm"
                                    >
                                        <div className="space-y-1">
                                            <div>No courses found</div>
                                            <div className="text-xs">
                                                Add a new course to get started.
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedCourses.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-3 py-8 text-center text-gray-500 text-sm"
                                    >
                                        No courses found on this page.
                                    </td>
                                </tr>
                            ) : (
                                paginatedCourses.map((course, index) => (
                                    <tr
                                        key={course.sectionId}
                                        className={`hover:bg-gray-50 transition-colors ${
                                            index % 2 === 0
                                                ? "bg-white"
                                                : "bg-gray-50"
                                        }`}
                                    >
                                        <td className="px-2 py-2 text-xs font-medium text-gray-900">
                                            {course.code}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-900">
                                            {course.title}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-900">
                                            {course.section}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-900">
                                            {`${course.firstName || ""} ${
                                                course.lastName || ""
                                            }`.trim() || "—"}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-900">
                                            {course.major || "—"}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-900">
                                            {course.duration}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-900">
                                            {course.capacity}
                                        </td>
                                        <td className="px-2 py-2">
                                            <span
                                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                                    course.status === "online"
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-gray-100 text-gray-800"
                                                }`}
                                            >
                                                {course.status}
                                            </span>
                                        </td>
                                        <td className="px-2 py-2">
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-gray-500 hover:text-[#2F2F85] hover:bg-gray-100"
                                                    onClick={() =>
                                                        openEditDialog(course)
                                                    }
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() =>
                                                        openDeleteDialog(course)
                                                    }
                                                >
                                                    <Trash className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {courses.length > 0 && (
                <div className="flex justify-center">
                    <CustomPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}

            {/* Add Course Dialog */}
            <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsAddDialogOpen(open);
                }}
            >
                <DialogContent className="bg-white max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Add New Course
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="code"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Course Code
                                </Label>
                                <Input
                                    id="code"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                    placeholder="CS101"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="title"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Course Name
                                </Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                    placeholder="Introduction to Programming"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="major"
                                className="text-sm font-medium text-gray-700"
                            >
                                Major
                            </Label>
                            <Select
                                value={selectedMajor}
                                onValueChange={setSelectedMajor}
                            >
                                <SelectTrigger className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm">
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

                        <div className="grid  gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="color"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Color
                                </Label>
                                <Select
                                    value={formData?.color || ""}
                                    onValueChange={(value) =>
                                        handleSelectChange("color", value)
                                    }
                                >
                                    <ColorSelectTrigger
                                        value={formData?.color}
                                        placeholder="Select color"
                                    />
                                    <SelectContent>
                                        {colors.map((color) => (
                                            <ColorSelectItem
                                                key={color}
                                                color={color}
                                            >
                                                {getColorName(color)}
                                            </ColorSelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="duration"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Duration (hours)
                                </Label>
                                <Input
                                    id="duration"
                                    name="duration"
                                    type="number"
                                    min="1"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="capacity"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Capacity
                                </Label>
                                <Input
                                    id="capacity"
                                    name="capacity"
                                    type="number"
                                    min="1"
                                    value={formData.capacity}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                />
                            </div>
                        </div>

                        {/* Sections */}
                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium text-gray-700">
                                    Sections
                                </Label>
                                <p className="text-xs text-gray-600 mt-1">
                                    Add course sections with instructors
                                </p>
                            </div>

                            {sections.length > 0 && (
                                <div className="space-y-2">
                                    {sections.map((section) => (
                                        <div
                                            key={section.id}
                                            className="p-3 border border-gray-200 rounded bg-gray-50"
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
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
                                                    className="h-6 w-6 text-gray-500 hover:text-red-600"
                                                >
                                                    <Trash className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <div className="mt-2">
                                                <Label className="text-xs text-gray-700">
                                                    Instructor
                                                </Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full justify-between mt-1 text-sm border-gray-300"
                                                        >
                                                            {section.instructor_name ||
                                                                "Select instructor..."}
                                                            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
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
                                                                                className={`mr-2 h-3 w-3 ${
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
                                            <div className="mt-2">
                                                <Label className="text-xs text-gray-700">
                                                    Status
                                                </Label>
                                                <Select
                                                    value={
                                                        section.status ||
                                                        "offline"
                                                    }
                                                    onValueChange={(value) =>
                                                        updateSectionStatus(
                                                            section.id,
                                                            value
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger className="mt-1 text-sm border-gray-300">
                                                        <SelectValue />
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
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="section"
                                            className="text-sm font-medium text-gray-700"
                                        >
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
                                            className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="section-instructor"
                                            className="text-sm font-medium text-gray-700"
                                        >
                                            Instructor
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
                                                    className="w-full justify-between border-gray-300 text-sm"
                                                >
                                                    {currentInstructor?.name ||
                                                        "Select instructor..."}
                                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
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
                                                                        className={`mr-2 h-3 w-3 ${
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
                                    className="w-full bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm"
                                >
                                    <Plus className="h-3 w-3 mr-2" /> Add
                                    Section
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t border-gray-200 pt-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                resetForm();
                                setIsAddDialogOpen(false);
                            }}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
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
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                        >
                            Add Course
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Course Dialog - Complete */}
            <Dialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsEditDialogOpen(open);
                }}
            >
                <DialogContent className="bg-white max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Edit Course
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-code"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Course Code
                                </Label>
                                <Input
                                    id="edit-code"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-title"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Course Name
                                </Label>
                                <Input
                                    id="edit-title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="edit-major"
                                className="text-sm font-medium text-gray-700"
                            >
                                Major
                            </Label>
                            <Select
                                value={selectedMajor}
                                onValueChange={setSelectedMajor}
                            >
                                <SelectTrigger className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm">
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-color"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Color
                                </Label>
                                <Select
                                    value={formData?.color || ""}
                                    onValueChange={(value) =>
                                        handleSelectChange("color", value)
                                    }
                                >
                                    <ColorSelectTrigger
                                        value={formData?.color}
                                        placeholder="Select color"
                                    />
                                    <SelectContent>
                                        {colors.map((color) => (
                                            <ColorSelectItem
                                                key={color}
                                                color={color}
                                            >
                                                {getColorName(color)}
                                            </ColorSelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-duration"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Duration (hours)
                                </Label>
                                <Input
                                    id="edit-duration"
                                    name="duration"
                                    type="number"
                                    min="1"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-capacity"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Capacity
                                </Label>
                                <Input
                                    id="edit-capacity"
                                    name="capacity"
                                    type="number"
                                    min="1"
                                    value={formData.capacity}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                />
                            </div>
                        </div>

                        {/* Section list with instructors - Edit Dialog */}
                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium text-gray-700">
                                    Sections
                                </Label>
                                <p className="text-xs text-gray-600 mt-1">
                                    Add course sections with instructors
                                </p>
                            </div>

                            {sections.length > 0 && (
                                <div className="space-y-2">
                                    {sections.map((section) => (
                                        <div
                                            key={section.id}
                                            className="p-3 border border-gray-200 rounded bg-gray-50"
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
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
                                                    className="h-6 w-6 text-gray-500 hover:text-red-600"
                                                >
                                                    <Trash className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <div className="mt-2">
                                                <Label className="text-xs text-gray-700">
                                                    Instructor
                                                </Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full justify-between mt-1 text-sm border-gray-300"
                                                        >
                                                            {section.instructor_name ||
                                                                "Select instructor..."}
                                                            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
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
                                                                                setCurrentInstructorOpen(
                                                                                    false
                                                                                );
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={`mr-2 h-3 w-3 ${
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
                                            <div className="mt-2">
                                                <Label className="text-xs text-gray-700">
                                                    Status
                                                </Label>
                                                <Select
                                                    value={
                                                        section.status ||
                                                        "offline"
                                                    }
                                                    onValueChange={(value) =>
                                                        updateSectionStatus(
                                                            section.id,
                                                            value
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger className="mt-1 text-sm border-gray-300">
                                                        <SelectValue />
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
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="edit-section"
                                            className="text-sm font-medium text-gray-700"
                                        >
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
                                            className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="edit-section-instructor"
                                            className="text-sm font-medium text-gray-700"
                                        >
                                            Instructor
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
                                                    className="w-full justify-between border-gray-300 text-sm"
                                                >
                                                    {currentInstructor?.name ||
                                                        "Select instructor..."}
                                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
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
                                                                        className={`mr-2 h-3 w-3 ${
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
                                    className="w-full bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm"
                                >
                                    <Plus className="h-3 w-3 mr-2" /> Add
                                    Section
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t border-gray-200 pt-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                resetForm();
                                setIsEditDialogOpen(false);
                            }}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
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
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
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
                <DialogContent className="bg-white max-w-md">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Delete Course
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-gray-600 mb-2">
                            Are you sure you want to delete this course?
                        </p>
                        <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                            {selectedCourse?.code}: {selectedCourse?.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            This action cannot be undone.
                        </p>
                    </div>
                    <DialogFooter className="border-t border-gray-200 pt-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedCourse(null);
                                setIsDeleteDialogOpen(false);
                            }}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeleteCourse}
                            className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5"
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
                <DialogContent className="bg-white max-w-lg">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Import Courses from CSV
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <Label
                                htmlFor="csv-file"
                                className="text-sm font-medium text-gray-700"
                            >
                                Select CSV File
                            </Label>
                            <Input
                                id="csv-file"
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                disabled={importProgress.isImporting}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm mt-1"
                            />
                            <p className="text-xs text-gray-600 mt-1">
                                CSV should contain columns: code, title, major,
                                color, status, duration, capacity, section
                                (number), instructor_name
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                                Note: Section should be a number (1, 2, 3,
                                etc.). Multiple rows with the same course code
                                will be treated as different sections.
                            </p>
                        </div>

                        {importFile && (
                            <div className="text-xs bg-gray-50 p-2 rounded border">
                                <p>
                                    <strong>Selected file:</strong>{" "}
                                    {importFile.name}
                                </p>
                                <p>
                                    <strong>Size:</strong>{" "}
                                    {(importFile.size / 1024).toFixed(2)} KB
                                </p>
                            </div>
                        )}

                        {importProgress.isImporting && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span>Progress:</span>
                                    <span>
                                        {importProgress.completed} /{" "}
                                        {importProgress.total}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-[#2F2F85] h-2 rounded-full transition-all duration-300"
                                        style={{
                                            width:
                                                importProgress.total > 0
                                                    ? `${
                                                          (importProgress.completed /
                                                              importProgress.total) *
                                                          100
                                                      }%`
                                                    : "0%",
                                        }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {importProgress.errors.length > 0 && (
                            <div className="max-h-40 overflow-y-auto bg-red-50 p-2 rounded border border-red-200">
                                <p className="text-xs font-medium text-red-600 mb-1">
                                    Errors ({importProgress.errors.length}):
                                </p>
                                <div className="text-xs space-y-1">
                                    {importProgress.errors
                                        .slice(0, 10)
                                        .map((error, index) => (
                                            <p
                                                key={index}
                                                className="text-red-600"
                                            >
                                                {error}
                                            </p>
                                        ))}
                                    {importProgress.errors.length > 10 && (
                                        <p className="text-red-600 font-medium">
                                            ... and{" "}
                                            {importProgress.errors.length - 10}{" "}
                                            more errors
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="border-t border-gray-200 pt-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                resetImportState();
                                setIsImportDialogOpen(false);
                            }}
                            disabled={importProgress.isImporting}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleImportCSV}
                            disabled={!importFile || importProgress.isImporting}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                        >
                            {importProgress.isImporting
                                ? "Importing..."
                                : "Import"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
