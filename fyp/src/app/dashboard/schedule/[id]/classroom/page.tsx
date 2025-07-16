"use client";

import { Classroom, ClassroomFormData } from "@/app/types";
import CustomPagination from "@/components/custom/pagination";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CheckCircle,
    Download,
    Pencil,
    Plus,
    Search,
    Trash,
    Upload,
    X,
    XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface ClassroomType {
    id: number;
    name: string;
}

interface FormErrors {
    location?: string;
    name?: string;
    code?: string;
    type?: string;
    capacity?: string;
}

const ITEMS_PER_PAGE = 20;

// Message types
type MessageType = "success" | "error";

type Message = {
    id: string;
    type: MessageType;
    title: string;
    description: string;
};

export default function ClassroomView() {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [sortedClassrooms, setSortedClassrooms] = useState<Classroom[]>([]);
    const [classroomTypes, setClassroomTypes] = useState<ClassroomType[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedClassroom, setSelectedClassroom] =
        useState<Classroom | null>(null);
    const [formData, setFormData] = useState<ClassroomFormData>({
        name: "",
        location: "",
        code: "",
        type: "",
        capacity: "",
    });
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isTypesLoading, setIsTypesLoading] = useState(false);

    // New enhanced message system
    const [messages, setMessages] = useState<Message[]>([]);
    const messageTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    const params = useParams();

    // Cleanup function for message timers
    useEffect(() => {
        return () => {
            // Clear all timers when component unmounts
            messageTimersRef.current.forEach((timer) => {
                clearTimeout(timer);
            });
            messageTimersRef.current.clear();
        };
    }, []);

    // Enhanced message utility functions
    const clearAllMessages = () => {
        // Clear all existing timers
        messageTimersRef.current.forEach((timer) => {
            clearTimeout(timer);
        });
        messageTimersRef.current.clear();

        // Clear all messages
        setMessages([]);
    };

    const addMessage = (
        type: MessageType,
        title: string,
        description: string
    ) => {
        // Clear any existing messages first to prevent duplicates
        clearAllMessages();

        const newMessage: Message = {
            id: Date.now().toString(),
            type,
            title,
            description,
        };

        setMessages([newMessage]); // Only set this one message

        // Set auto-removal timer
        const timer = setTimeout(() => {
            removeMessage(newMessage.id);
        }, 5000);

        messageTimersRef.current.set(newMessage.id, timer);
    };

    const removeMessage = (messageId: string) => {
        // Clear the timer for this message
        const timer = messageTimersRef.current.get(messageId);
        if (timer) {
            clearTimeout(timer);
            messageTimersRef.current.delete(messageId);
        }

        // Remove the message
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    };

    const showSuccessMessage = (title: string, description: string) => {
        addMessage("success", title, description);
    };

    const showErrorMessage = (title: string, description: string) => {
        addMessage("error", title, description);
    };

    // Message component
    const MessageBanner = ({ message }: { message: Message }) => (
        <div
            className={`max-w-md p-4 rounded-lg shadow-xl border-l-4 transition-all duration-300 ease-in-out ${
                message.type === "success"
                    ? "bg-green-50 border-green-500 text-green-800"
                    : "bg-red-50 border-red-500 text-red-800"
            }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    {message.type === "success" ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                        <h4 className="font-semibold text-sm">
                            {message.title}
                        </h4>
                        <p className="text-sm mt-1 opacity-90">
                            {message.description}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => removeMessage(message.id)}
                    className={`ml-2 p-1 rounded-full hover:bg-opacity-20 transition-colors flex-shrink-0 ${
                        message.type === "success"
                            ? "hover:bg-green-600"
                            : "hover:bg-red-600"
                    }`}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );

    // Sort classrooms by room number in ascending order
    const sortClassrooms = (classroomList: Classroom[]): Classroom[] => {
        return [...classroomList].sort((a, b) => {
            // Extract numeric parts for proper sorting
            const aNumeric = parseInt(a.code.replace(/\D/g, "")) || 0;
            const bNumeric = parseInt(b.code.replace(/\D/g, "")) || 0;

            // If numeric parts are different, sort by number
            if (aNumeric !== bNumeric) {
                return aNumeric - bNumeric;
            }

            // If numeric parts are same, sort alphabetically
            return a.code.localeCompare(b.code);
        });
    };

    // Update sorted classrooms whenever classrooms change
    useEffect(() => {
        setSortedClassrooms(sortClassrooms(classrooms));
    }, [classrooms]);

    // Validate classroom code for duplicates
    const validateClassroomCode = (
        code: string,
        excludeId?: number
    ): string | null => {
        if (!code.trim()) {
            return "Classroom code is required";
        }

        if (code.length > 255) {
            return "Classroom code cannot exceed 255 characters";
        }

        const codeRegex = /^[A-Za-z0-9\-_\.]+$/;
        if (!codeRegex.test(code)) {
            return "Classroom code can only contain letters, numbers, hyphens, underscores, and periods";
        }

        // Check for duplicates in current classroom list
        const isDuplicate = classrooms.some(
            (classroom) =>
                classroom.code.toLowerCase().trim() ===
                    code.toLowerCase().trim() && classroom.id !== excludeId
        );

        if (isDuplicate) {
            return "This classroom code already exists";
        }

        return null;
    };

    // Validate form data
    const validateForm = (isEdit: boolean = false): boolean => {
        const errors: FormErrors = {};

        // Validate name
        if (!(formData.name ?? "").trim()) {
            errors.name = "Classroom name is required";
        } else if ((formData.name ?? "").length > 255) {
            errors.name = "Classroom name cannot exceed 255 characters";
        }

        // Validate location
        if (!formData.location.trim()) {
            errors.location = "Location is required";
        } else if (formData.location.length > 255) {
            errors.location = "Location cannot exceed 255 characters";
        }

        // Validate code
        const codeError = validateClassroomCode(
            formData.code,
            isEdit ? selectedClassroom?.id : undefined
        );
        if (codeError) {
            errors.code = codeError;
        }

        // Validate type
        if (!formData.type.trim()) {
            errors.type = "Classroom type is required";
        }

        // Validate capacity
        const capacity = Number.parseInt(formData.capacity);
        if (!formData.capacity.trim()) {
            errors.capacity = "Capacity is required";
        } else if (isNaN(capacity) || capacity <= 0) {
            errors.capacity = "Capacity must be a positive number";
        } else if (capacity > 100) {
            errors.capacity = "Capacity cannot exceed 100";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Fetch classroom types from API
    const fetchClassroomTypes = async () => {
        try {
            setIsTypesLoading(true);
            const scheduleId = params.id;
            const response = await fetch(
                `/api/classroom-types?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch classroom types");
            }
            const data = await response.json();
            setClassroomTypes(data);
        } catch (error) {
            console.error("Error fetching classroom types:", error);
            showErrorMessage(
                "Failed to Load Classroom Types",
                "Could not load classroom types. Please try again."
            );
        } finally {
            setIsTypesLoading(false);
        }
    };

    const [hasAssignedCourses, setHasAssignedCourses] =
        useState<boolean>(false);
    const [isCheckingAssignments, setIsCheckingAssignments] =
        useState<boolean>(false);
    const [assignedCoursesInfo, setAssignedCoursesInfo] = useState<string>("");

    // Add this function to fetch assigned courses
    const fetchAssignedCourses = async (scheduleId: string) => {
        try {
            const response = await fetch(
                `/api/assign-time-slots/?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch assigned courses");
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(
                `Error fetching assigned courses for schedule ${scheduleId}:`,
                error
            );
            return [];
        }
    };

    const checkClassroomAssignments = async (
        classroomId: number
    ): Promise<{ hasAssignments: boolean; info: string }> => {
        try {
            setIsCheckingAssignments(true);
            const scheduleId = params.id as string;

            // Fetch assigned courses for this schedule
            const assignedCourses = await fetchAssignedCourses(scheduleId);

            // Check if any course is assigned to this classroom by ID
            const coursesUsingClassroom = assignedCourses.filter(
                (course: any) => {
                    return course.classroomId === classroomId;
                }
            );

            if (coursesUsingClassroom.length > 0) {
                const courseNames = coursesUsingClassroom
                    .map(
                        (course: any) =>
                            course.title ||
                            course.courseName ||
                            course.name ||
                            `Course ID: ${course.id}`
                    )
                    .join(", ");
                return {
                    hasAssignments: true,
                    info: `This classroom is assigned to ${coursesUsingClassroom.length} course(s): ${courseNames}`,
                };
            }

            return { hasAssignments: false, info: "" };
        } catch (error) {
            console.error("Error checking classroom assignments:", error);
            return { hasAssignments: false, info: "" };
        } finally {
            setIsCheckingAssignments(false);
        }
    };

    // Fetch classrooms from API
    const fetchClassrooms = async () => {
        setIsLoading(true);
        const scheduleId = params.id;
        try {
            const response = await fetch(
                `/api/classrooms?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch classrooms");
            }
            const data = await response.json();
            setClassrooms(data);
        } catch (error) {
            console.error("Error fetching classrooms:", error);
            showErrorMessage(
                "Failed to Load Classrooms",
                "Could not load classrooms. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClassrooms();
        fetchClassroomTypes();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });

        // Clear specific field error when user starts typing
        if (formErrors[name as keyof FormErrors]) {
            setFormErrors({
                ...formErrors,
                [name]: undefined,
            });
        }

        // Real-time validation for classroom code
        if (name === "code") {
            const codeError = validateClassroomCode(
                value,
                isEditDialogOpen ? selectedClassroom?.id : undefined
            );
            if (codeError) {
                setFormErrors({
                    ...formErrors,
                    code: codeError,
                });
            }
        }

        // Real-time validation for other fields
        if (name === "location" && !value.trim()) {
            setFormErrors({
                ...formErrors,
                location: "Location is required",
            });
        }

        if (name === "name" && !value.trim()) {
            setFormErrors({
                ...formErrors,
                name: "Classroom name is required",
            });
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData({
            ...formData,
            [name]: value,
        });

        // Clear field error when user makes a selection
        if (formErrors[name as keyof FormErrors]) {
            setFormErrors({
                ...formErrors,
                [name]: undefined,
            });
        }
    };

    const handleAddClassroom = async () => {
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        try {
            const scheduleId = params.id;

            const apiData = {
                code: formData.code.trim(),
                name: (formData.name ?? "").trim(),
                location: formData.location.trim(),
                type: formData.type,
                capacity: Number.parseInt(formData.capacity),
                scheduleId: scheduleId,
            };

            const response = await fetch("/api/classrooms", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to create classroom"
                );
            }

            await fetchClassrooms();
            setIsAddDialogOpen(false);
            resetForm();
            showSuccessMessage(
                "Classroom Added Successfully",
                `Classroom ${formData.code} has been added successfully.`
            );
        } catch (error) {
            console.error("Error adding classroom:", error);
            showErrorMessage(
                "Failed to Add Classroom",
                error instanceof Error
                    ? error.message
                    : "Failed to add classroom. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClassroom = async () => {
        if (!selectedClassroom || !validateForm(true)) {
            return;
        }

        // Prevent editing if classroom has assignments
        if (hasAssignedCourses) {
            showErrorMessage(
                "Cannot Edit Classroom",
                "This classroom is assigned to courses and cannot be edited. Please remove all course assignments first."
            );
            return;
        }

        setIsLoading(true);
        try {
            const scheduleId = params.id;

            const apiData = {
                id: selectedClassroom.id,
                code: formData.code.trim(),
                name: (formData.name ?? "").trim(),
                location: formData.location.trim(),
                type: formData.type,
                capacity: Number.parseInt(formData.capacity),
                scheduleId: scheduleId,
            };

            const response = await fetch(`/api/classrooms/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to update classroom"
                );
            }

            await fetchClassrooms();
            setIsEditDialogOpen(false);
            resetForm();
            showSuccessMessage(
                "Classroom Updated Successfully",
                `Classroom ${formData.code} has been updated successfully.`
            );
        } catch (error) {
            console.error("Error updating classroom:", error);
            showErrorMessage(
                "Failed to Update Classroom",
                error instanceof Error
                    ? error.message
                    : "Failed to update classroom. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClassroom = async () => {
        if (!selectedClassroom) return;

        // Prevent deletion if classroom has assignments
        if (hasAssignedCourses) {
            showErrorMessage(
                "Cannot Delete Classroom",
                "This classroom is assigned to courses and cannot be deleted. Please remove all course assignments first."
            );
            return;
        }

        const classroomCode = selectedClassroom.code;

        setIsLoading(true);
        try {
            const scheduleId = params.id;

            const apiData = {
                id: selectedClassroom.id,
                scheduleId: scheduleId,
            };

            const response = await fetch(
                `/api/classrooms?scheduleId={scheduleId}`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(apiData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to delete classroom"
                );
            }

            await fetchClassrooms();
            setIsDeleteDialogOpen(false);
            showSuccessMessage(
                "Classroom Deleted Successfully",
                `Classroom ${classroomCode} has been deleted successfully.`
            );
        } catch (error) {
            console.error("Error deleting classroom:", error);
            showErrorMessage(
                "Failed to Delete Classroom",
                error instanceof Error
                    ? error.message
                    : "Failed to delete classroom. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            location: "",
            name: "",
            code: "",
            type: "",
            capacity: "",
        });
        setFormErrors({});
        setSelectedClassroom(null);
        setHasAssignedCourses(false);
        setAssignedCoursesInfo("");
    };
    const openEditDialog = async (classroom: Classroom) => {
        setSelectedClassroom(classroom);

        // Check for classroom assignments by ID
        const assignmentCheck = await checkClassroomAssignments(classroom.id);
        setHasAssignedCourses(assignmentCheck.hasAssignments);
        setAssignedCoursesInfo(assignmentCheck.info);

        setFormData({
            location: classroom.location,
            name: classroom.name,
            code: classroom.code,
            type: classroom.type,
            capacity: classroom.capacity.toString(),
        });
        setFormErrors({});
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = async (classroom: Classroom) => {
        setSelectedClassroom(classroom);

        // Check for classroom assignments by ID
        const assignmentCheck = await checkClassroomAssignments(classroom.id);
        setHasAssignedCourses(assignmentCheck.hasAssignments);
        setAssignedCoursesInfo(assignmentCheck.info);

        setIsDeleteDialogOpen(true);
    };

    // CSV Import functionality (keeping existing implementation but using sorted classrooms)
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

    interface CSVClassroomRow {
        code: string;
        name: string;
        location: string;
        type: string;
        capacity: string;
    }

    const validateClassroomData = (
        row: any,
        rowIndex: number
    ): CSVClassroomRow | string => {
        const errors: string[] = [];

        if (
            !row.code ||
            typeof row.code !== "string" ||
            row.code.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Classroom code is required`);
        } else {
            const codeError = validateClassroomCode(row.code.trim());
            if (codeError) {
                errors.push(`Row ${rowIndex + 1}: ${codeError}`);
            }
        }

        if (
            !row.name ||
            typeof row.name !== "string" ||
            row.name.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Classroom name is required`);
        }

        if (
            !row.location ||
            typeof row.location !== "string" ||
            row.location.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Location is required`);
        }

        if (
            !row.type ||
            typeof row.type !== "string" ||
            row.type.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Classroom type is required`);
        } else {
            const typeExists = classroomTypes.some(
                (type) =>
                    type.name.toLowerCase() === row.type.trim().toLowerCase()
            );
            if (!typeExists) {
                errors.push(
                    `Row ${
                        rowIndex + 1
                    }: Classroom type "${row.type.trim()}" does not exist in the system`
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
            } else if (capacityNum > 100) {
                errors.push(`Row ${rowIndex + 1}: Capacity cannot exceed 100`);
            }
        }

        if (errors.length > 0) {
            return errors.join(", ");
        }

        return {
            code: row.code.trim(),
            name: row.name.trim(),
            location: row.location.trim(),
            type: row.type.trim(),
            capacity: row.capacity.toString(),
        };
    };

    const handleImportCSV = async () => {
        if (!importFile) {
            showErrorMessage(
                "No File Selected",
                "Please select a CSV file to import"
            );
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
            Papa.parse(importFile, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) =>
                    header.trim().toLowerCase().replace(/\s+/g, "_"),
                complete: async (results) => {
                    const csvData = results.data as any[];
                    const validClassrooms: CSVClassroomRow[] = [];
                    const errors: string[] = [];

                    csvData.forEach((row, index) => {
                        const validationResult = validateClassroomData(
                            row,
                            index
                        );
                        if (typeof validationResult === "string") {
                            errors.push(validationResult);
                        } else {
                            const duplicateInCsv = validClassrooms.some(
                                (classroom) =>
                                    classroom.code.toLowerCase() ===
                                    validationResult.code.toLowerCase()
                            );
                            if (duplicateInCsv) {
                                errors.push(
                                    `Row ${
                                        index + 1
                                    }: Duplicate classroom code "${
                                        validationResult.code
                                    }" in CSV`
                                );
                            } else {
                                validClassrooms.push(validationResult);
                            }
                        }
                    });

                    setImportProgress((prev) => ({
                        ...prev,
                        total: validClassrooms.length,
                        errors: errors,
                    }));

                    if (validClassrooms.length === 0) {
                        showErrorMessage(
                            "No Valid Classrooms",
                            "No valid classrooms found in the CSV file"
                        );
                        setImportProgress((prev) => ({
                            ...prev,
                            isImporting: false,
                        }));
                        return;
                    }

                    let completed = 0;
                    const importErrors: string[] = [...errors];

                    for (const classroom of validClassrooms) {
                        try {
                            const apiData = {
                                code: classroom.code,
                                name: classroom.name,
                                location: classroom.location,
                                type: classroom.type,
                                capacity: Number.parseInt(classroom.capacity),
                                scheduleId: scheduleId,
                            };

                            const response = await fetch("/api/classrooms", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(apiData),
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                importErrors.push(
                                    `Failed to import ${classroom.code}: ${
                                        errorData.error || "Unknown error"
                                    }`
                                );
                            } else {
                                completed++;
                            }
                        } catch (error) {
                            importErrors.push(
                                `Failed to import ${classroom.code}: ${
                                    error instanceof Error
                                        ? error.message
                                        : "Unknown error"
                                }`
                            );
                        }

                        setImportProgress((prev) => ({
                            ...prev,
                            completed: completed,
                            errors: importErrors,
                        }));

                        await new Promise((resolve) =>
                            setTimeout(resolve, 30)
                        );
                    }

                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));
                    await fetchClassrooms();

                    if (completed > 0) {
                        showSuccessMessage(
                            "Import Completed",
                            `Successfully imported ${completed} classroom(s)${
                                importErrors.length > 0
                                    ? ` with ${importErrors.length} error(s)`
                                    : ""
                            }`
                        );
                    } else {
                        showErrorMessage(
                            "Import Failed",
                            "Failed to import any classrooms"
                        );
                    }
                },
                error: (error) => {
                    console.error("CSV parsing error:", error);
                    showErrorMessage(
                        "CSV Parse Error",
                        "Failed to parse CSV file. Please check the file format."
                    );
                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));
                },
            });
        } catch (error) {
            console.error("Import error:", error);
            showErrorMessage(
                "Import Failed",
                "Failed to import classrooms. Please try again."
            );
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
                showErrorMessage(
                    "Invalid File Type",
                    "Please select a valid CSV file"
                );
                event.target.value = "";
                return;
            }
            setImportFile(file);
        } else {
            showErrorMessage(
                "No File Selected",
                "Please select a valid CSV file"
            );
            event.target.value = "";
        }
    };

    const resetImportState = () => {
        setImportFile(null);
        setImportProgress({
            total: 0,
            completed: 0,
            errors: [],
            isImporting: false,
        });
    };

    const downloadClassroomsCSV = () => {
        try {
            const headers = ["code", "name", "location", "type", "capacity"];

            const csvRows = filteredClassrooms.map((classroom) => [
                classroom.code,
                classroom.name,
                classroom.location,
                classroom.type,
                classroom.capacity.toString(),
            ]);

            const allRows = [headers, ...csvRows];

            const csvContent = allRows
                .map((row) =>
                    row
                        .map((field) => {
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

            const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
            });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);

            const today = new Date().toISOString().split("T")[0];
            link.setAttribute("download", `classrooms_export_${today}.csv`);

            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSuccessMessage(
                "Export Successful",
                `Exported ${filteredClassrooms.length} classrooms to CSV`
            );
        } catch (error) {
            console.error("Error exporting CSV:", error);
            showErrorMessage(
                "Export Failed",
                "Failed to export classrooms. Please try again."
            );
        }
    };

    //search function start here
    const [searchQuery, setSearchQuery] = useState("");
    // Filter classrooms based on search query
    const filteredClassrooms = sortedClassrooms.filter(
        (classroom) =>
            classroom.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            classroom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            classroom.location
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
            classroom.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Calculate pagination values with filtered data
    const totalPages = Math.ceil(filteredClassrooms.length / ITEMS_PER_PAGE);
    const paginatedClassrooms = filteredClassrooms.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    //clear all classroom start here
    // Add this state variable with your other useState declarations
    const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);

    // Add this function with your other handler functions
    const handleClearAllClassrooms = async () => {
        const classroomCount = classrooms.length;

        try {
            const scheduleId = params.id;
            let deletedCount = 0;
            let errorCount = 0;

            // Delete all classrooms one by one
            for (const classroom of classrooms) {
                try {
                    const response = await fetch("/api/classrooms", {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            id: classroom.id,
                            scheduleId: scheduleId,
                        }),
                    });

                    if (response.ok) {
                        deletedCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                }
            }

            await fetchClassrooms();
            setIsClearAllDialogOpen(false);

            if (deletedCount === classroomCount) {
                showSuccessMessage(
                    "All Classrooms Deleted",
                    `Successfully deleted ${deletedCount} classrooms`
                );
            } else if (deletedCount > 0) {
                showErrorMessage(
                    "Partial Deletion",
                    `Deleted ${deletedCount} classrooms. ${errorCount} classrooms couldn't be deleted (they're being used in course schedules)`
                );
            } else {
                showErrorMessage(
                    "Deletion Failed",
                    "No classrooms could be deleted. They're all being used in course schedules."
                );
            }
        } catch (error) {
            console.error("Error clearing all classrooms:", error);
            showErrorMessage(
                "Failed to Delete All Classrooms",
                "Failed to delete classrooms. Please try again."
            );
        }
    };

    return (
        <>
            {/* Messages - OUTSIDE the main content flow */}
            {messages.length > 0 && (
                <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
                    <div className="pointer-events-auto space-y-2">
                        {messages.map((message) => (
                            <MessageBanner key={message.id} message={message} />
                        ))}
                    </div>
                </div>
            )}

            {/* Main content - completely separate */}
            <div className="space-y-4">
                {/* Page Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Classrooms
                        </h2>
                        <p className="text-xs text-gray-600">
                            Manage classroom details and capacity (sorted by
                            room number)
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setIsImportDialogOpen(true)}
                            variant="outline"
                            className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={isLoading}
                        >
                            <Upload className="mr-1 h-3 w-3" /> Import CSV
                        </Button>
                        <Button
                            onClick={downloadClassroomsCSV}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={
                                filteredClassrooms.length === 0 || isLoading
                            }
                        >
                            <Download className="mr-1 h-3 w-3" /> Export CSV
                        </Button>
                        <Button
                            onClick={() => setIsAddDialogOpen(true)}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                            disabled={isLoading}
                        >
                            <Plus className="mr-1 h-3 w-3" /> New Classroom
                        </Button>
                        <Button
                            onClick={() => setIsClearAllDialogOpen(true)}
                            variant="outline"
                            className="border-red-600 text-red-600 hover:bg-red-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={classrooms.length === 0 || isLoading}
                        >
                            <Trash className="mr-1 h-3 w-3" /> Clear All
                        </Button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search classrooms by code, name, location, or type..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-10 pr-10 py-2 border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm rounded-md"
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSearchQuery("");
                                setCurrentPage(1);
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* Compact Table Container */}
                <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#2F2F85] text-white">
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                        No.
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Code
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Location
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-20">
                                        Capacity
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-20">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {isLoading ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-3 py-8 text-center text-gray-500 text-sm"
                                        >
                                            Loading...
                                        </td>
                                    </tr>
                                ) : paginatedClassrooms.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-3 py-8 text-center text-gray-500 text-sm"
                                        >
                                            <div className="space-y-1">
                                                <div>
                                                    {searchQuery
                                                        ? `No classrooms found for "${searchQuery}"`
                                                        : "No classrooms found"}
                                                </div>
                                                <div className="text-xs">
                                                    {searchQuery
                                                        ? "Try a different search term"
                                                        : "Add a new classroom to get started."}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedClassrooms.map(
                                        (classroom, index) => (
                                            <tr
                                                key={classroom.id}
                                                className={`hover:bg-gray-50 transition-colors ${
                                                    index % 2 === 0
                                                        ? "bg-white"
                                                        : "bg-gray-50"
                                                }`}
                                            >
                                                <td className="px-3 py-2 text-xs text-gray-600 font-medium">
                                                    {(currentPage - 1) *
                                                        ITEMS_PER_PAGE +
                                                        index +
                                                        1}
                                                </td>
                                                <td className="px-3 py-2 text-xs font-medium text-gray-900">
                                                    {classroom.code}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-900">
                                                    {classroom.name}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-900">
                                                    {classroom.location}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-900">
                                                    {classroom.type}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-900">
                                                    {classroom.capacity}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-500 hover:text-[#2F2F85] hover:bg-gray-100"
                                                            onClick={() =>
                                                                openEditDialog(
                                                                    classroom
                                                                )
                                                            }
                                                            disabled={isLoading}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() =>
                                                                openDeleteDialog(
                                                                    classroom
                                                                )
                                                            }
                                                            disabled={isLoading}
                                                        >
                                                            <Trash className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                {filteredClassrooms.length > 0 && totalPages > 1 && (
                    <div className="flex justify-center">
                        <CustomPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}

                {/* Add Classroom Dialog */}
                <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) resetForm();
                        setIsAddDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Add New Classroom
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="code"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Classroom Code{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="code"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        formErrors.code
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                    placeholder="Enter classroom code (e.g., 101, 119)"
                                />
                                {formErrors.code && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.code}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="name"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Classroom Name{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        formErrors.name
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                    placeholder="Enter classroom name"
                                />
                                {formErrors.name && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.name}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="location"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Location{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="location"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        formErrors.location
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                    placeholder="Enter location"
                                />
                                {formErrors.location && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.location}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="type"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Type <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value) =>
                                        handleSelectChange("type", value)
                                    }
                                >
                                    <SelectTrigger
                                        className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                            formErrors.type
                                                ? "border-red-300 focus:border-red-500 animate-pulse"
                                                : ""
                                        }`}
                                    >
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isTypesLoading ? (
                                            <SelectItem
                                                value="loading"
                                                disabled
                                            >
                                                Loading classroom types...
                                            </SelectItem>
                                        ) : classroomTypes.length === 0 ? (
                                            <SelectItem value="none" disabled>
                                                No classroom types available
                                            </SelectItem>
                                        ) : (
                                            classroomTypes.map((type) => (
                                                <SelectItem
                                                    key={type.id}
                                                    value={type.name}
                                                >
                                                    {type.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {formErrors.type && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.type}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="capacity"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Capacity{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="capacity"
                                    name="capacity"
                                    type="number"
                                    value={formData.capacity}
                                    onChange={handleInputChange}
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        formErrors.capacity
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                    placeholder="Enter capacity (1-100)"
                                    min="1"
                                    max="100"
                                />
                                {formErrors.capacity && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.capacity}
                                    </p>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    resetForm();
                                    setIsAddDialogOpen(false);
                                }}
                                disabled={isLoading}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddClassroom}
                                disabled={
                                    isLoading ||
                                    Object.values(formErrors).some(
                                        (error) => error !== undefined
                                    )
                                }
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {isLoading ? "Adding..." : "Add"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Classroom Dialog */}
                <Dialog
                    open={isEditDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) resetForm();
                        setIsEditDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Edit Classroom
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            {/* Warning message when classroom has assignments */}
                            {hasAssignedCourses && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-600 text-sm">
                                            🚫
                                        </span>
                                        <p className="text-sm text-red-800 font-medium">
                                            This classroom cannot be edited
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-700 mt-1 ml-6">
                                        {assignedCoursesInfo}. Please remove all
                                        course assignments before editing this
                                        classroom.
                                    </p>
                                </div>
                            )}

                            {isCheckingAssignments && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-600 text-sm">
                                            ℹ️
                                        </span>
                                        <p className="text-sm text-blue-800">
                                            Checking for course assignments...
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-code"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Classroom Code{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="edit-code"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                    disabled={
                                        hasAssignedCourses ||
                                        isCheckingAssignments
                                    }
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        formErrors.code
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    } ${
                                        hasAssignedCourses ||
                                        isCheckingAssignments
                                            ? "bg-gray-100 cursor-not-allowed opacity-60"
                                            : ""
                                    }`}
                                    placeholder="Enter classroom code (e.g., 101, 2A1)"
                                />
                                {formErrors.code && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.code}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-name"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Classroom Name{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="edit-name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    disabled={
                                        hasAssignedCourses ||
                                        isCheckingAssignments
                                    }
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        formErrors.name
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    } ${
                                        hasAssignedCourses ||
                                        isCheckingAssignments
                                            ? "bg-gray-100 cursor-not-allowed opacity-60"
                                            : ""
                                    }`}
                                    placeholder="Enter classroom name"
                                />
                                {formErrors.name && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.name}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-location"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Location{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="edit-location"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    disabled={
                                        hasAssignedCourses ||
                                        isCheckingAssignments
                                    }
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        formErrors.location
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    } ${
                                        hasAssignedCourses ||
                                        isCheckingAssignments
                                            ? "bg-gray-100 cursor-not-allowed opacity-60"
                                            : ""
                                    }`}
                                    placeholder="Enter location"
                                />
                                {formErrors.location && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.location}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-type"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Type <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value) =>
                                        handleSelectChange("type", value)
                                    }
                                    disabled={
                                        hasAssignedCourses ||
                                        isCheckingAssignments
                                    }
                                >
                                    <SelectTrigger
                                        className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                            formErrors.type
                                                ? "border-red-300 focus:border-red-500 animate-pulse"
                                                : ""
                                        } ${
                                            hasAssignedCourses ||
                                            isCheckingAssignments
                                                ? "bg-gray-100 cursor-not-allowed opacity-60"
                                                : ""
                                        }`}
                                    >
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isTypesLoading ? (
                                            <SelectItem
                                                value="loading"
                                                disabled
                                            >
                                                Loading classroom types...
                                            </SelectItem>
                                        ) : classroomTypes.length === 0 ? (
                                            <SelectItem value="none" disabled>
                                                No classroom types available
                                            </SelectItem>
                                        ) : (
                                            classroomTypes.map((type) => (
                                                <SelectItem
                                                    key={type.id}
                                                    value={type.name}
                                                >
                                                    {type.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {formErrors.type && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.type}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-capacity"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Capacity{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="edit-capacity"
                                    name="capacity"
                                    type="number"
                                    value={formData.capacity}
                                    onChange={handleInputChange}
                                    disabled={
                                        hasAssignedCourses ||
                                        isCheckingAssignments
                                    }
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        formErrors.capacity
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    } ${
                                        hasAssignedCourses ||
                                        isCheckingAssignments
                                            ? "bg-gray-100 cursor-not-allowed opacity-60"
                                            : ""
                                    }`}
                                    placeholder="Enter capacity (1-100)"
                                    min="1"
                                    max="100"
                                />
                                {formErrors.capacity && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {formErrors.capacity}
                                    </p>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    resetForm();
                                    setIsEditDialogOpen(false);
                                }}
                                disabled={isLoading}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleEditClassroom}
                                disabled={
                                    isLoading ||
                                    Object.values(formErrors).some(
                                        (error) => error !== undefined
                                    ) ||
                                    hasAssignedCourses ||
                                    isCheckingAssignments
                                }
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {hasAssignedCourses
                                    ? "Cannot Edit"
                                    : isLoading
                                    ? "Saving..."
                                    : "Save"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                {/* Delete Classroom Dialog */}
                <Dialog
                    open={isDeleteDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) setSelectedClassroom(null);
                        setIsDeleteDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Delete Classroom
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4">
                            {/* Warning message when classroom has assignments */}
                            {hasAssignedCourses && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-600 text-sm">
                                            🚫
                                        </span>
                                        <p className="text-sm text-red-800 font-medium">
                                            This classroom cannot be deleted
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-700 mt-1 ml-6">
                                        {assignedCoursesInfo}. Please remove all
                                        course assignments before deleting this
                                        classroom.
                                    </p>
                                </div>
                            )}

                            {isCheckingAssignments && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-600 text-sm">
                                            ℹ️
                                        </span>
                                        <p className="text-sm text-blue-800">
                                            Checking for course assignments...
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Only show confirmation text if no assignments */}
                            {!hasAssignedCourses && !isCheckingAssignments && (
                                <>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Are you sure you want to delete this
                                        classroom?
                                    </p>
                                    <div className="bg-gray-50 p-3 rounded border space-y-1">
                                        <p className="font-medium text-sm text-gray-900">
                                            <span className="text-gray-600">
                                                Code:
                                            </span>{" "}
                                            {selectedClassroom?.code}
                                        </p>
                                        <p className="text-sm text-gray-700">
                                            <span className="text-gray-600">
                                                Name:
                                            </span>{" "}
                                            {selectedClassroom?.name}
                                        </p>
                                        <p className="text-sm text-gray-700">
                                            <span className="text-gray-600">
                                                Location:
                                            </span>{" "}
                                            {selectedClassroom?.location}
                                        </p>
                                        <p className="text-sm text-gray-700">
                                            <span className="text-gray-600">
                                                Type:
                                            </span>{" "}
                                            {selectedClassroom?.type}
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        This action cannot be undone.
                                    </p>
                                </>
                            )}

                            {/* Show classroom info even when disabled */}
                            {hasAssignedCourses && (
                                <div className="mt-4">
                                    <p className="text-sm text-gray-600 mb-2">
                                        Classroom Details:
                                    </p>
                                    <div className="bg-gray-50 p-3 rounded border space-y-1">
                                        <p className="font-medium text-sm text-gray-900">
                                            <span className="text-gray-600">
                                                Code:
                                            </span>{" "}
                                            {selectedClassroom?.code}
                                        </p>
                                        <p className="text-sm text-gray-700">
                                            <span className="text-gray-600">
                                                Name:
                                            </span>{" "}
                                            {selectedClassroom?.name}
                                        </p>
                                        <p className="text-sm text-gray-700">
                                            <span className="text-gray-600">
                                                Location:
                                            </span>{" "}
                                            {selectedClassroom?.location}
                                        </p>
                                        <p className="text-sm text-gray-700">
                                            <span className="text-gray-600">
                                                Type:
                                            </span>{" "}
                                            {selectedClassroom?.type}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedClassroom(null);
                                    setIsDeleteDialogOpen(false);
                                }}
                                disabled={isLoading}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteClassroom}
                                disabled={
                                    isLoading ||
                                    hasAssignedCourses ||
                                    isCheckingAssignments
                                }
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {hasAssignedCourses
                                    ? "Cannot Delete"
                                    : isLoading
                                    ? "Deleting..."
                                    : "Delete"}
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
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Import Classrooms from CSV
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
                                    CSV should contain columns: code, name,
                                    location, type, capacity
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
                                <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded border border-red-200">
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
                                                {importProgress.errors.length -
                                                    10}{" "}
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
                                disabled={
                                    !importFile || importProgress.isImporting
                                }
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                            >
                                {importProgress.isImporting
                                    ? "Importing..."
                                    : "Import"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Clear All Classrooms Dialog */}
                <Dialog
                    open={isClearAllDialogOpen}
                    onOpenChange={setIsClearAllDialogOpen}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Clear All Classrooms
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Are you sure you want to delete all{" "}
                                {classrooms.length} classrooms?
                            </p>
                            <p className="text-xs text-red-600 font-medium">
                                This action cannot be undone.
                            </p>
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsClearAllDialogOpen(false)}
                                disabled={isLoading}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleClearAllClassrooms}
                                disabled={isLoading}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5"
                            >
                                Delete All
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
