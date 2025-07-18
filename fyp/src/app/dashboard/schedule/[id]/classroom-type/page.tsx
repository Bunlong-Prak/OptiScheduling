"use client";

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
import { Textarea } from "@/components/ui/textarea";
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
    description?: string;
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

export default function ClassroomTypeView() {
    const [classroomTypes, setClassroomTypes] = useState<ClassroomType[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // New message system
    const [messages, setMessages] = useState<Message[]>([]);
    const messageTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    const [selectedClassroomType, setSelectedClassroomType] =
        useState<ClassroomType | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
    });

    // Add validation state
    const [validationErrors, setValidationErrors] = useState<{
        name?: string;
        description?: string;
    }>({});

    const [currentPage, setCurrentPage] = useState(1);
    const params = useParams();

    const [clearAllSummary, setClearAllSummary] = useState<{
        undeletableClassroomTypes: {
            classroomType: ClassroomType;
            reason: string;
        }[];
        deletableClassroomTypes: ClassroomType[];
        isChecking: boolean;
        isDeleting: boolean;
    }>({
        undeletableClassroomTypes: [],
        deletableClassroomTypes: [],
        isChecking: false,
        isDeleting: false,
    });

    const openClearAllDialog = async () => {
        setIsClearAllDialogOpen(true);
        setClearAllSummary({
            deletableClassroomTypes: [],
            undeletableClassroomTypes: [],
            isChecking: true,
            isDeleting: false,
        });

        const undeletable: { classroomType: ClassroomType; reason: string }[] = [];
        const deletableClassroomTypes: ClassroomType[] = [];

        for (const classroomType of classroomTypes) {
            const assignmentCheck = await checkClassroomTypeAssignments(
                classroomType.name
            );
            if (assignmentCheck.hasAssignments) {
                undeletable.push({
                    classroomType,
                    reason: assignmentCheck.info,
                });
            } else {
                deletableClassroomTypes.push(classroomType);
            }
        }

        setClearAllSummary({
            deletableClassroomTypes,
            undeletableClassroomTypes: undeletable,
            isDeleting: false,
            isChecking: false,
        });
    };

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

    // Load classroom types on component mount
    useEffect(() => {
        fetchClassroomTypes();
    }, []);

    const fetchClassroomTypes = async () => {
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/classroom-types?scheduleId=${scheduleId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch classroom types");
            }

            const data = await response.json();
            setClassroomTypes(data);
            setCurrentPage(1);
        } catch (error) {
            console.error("Error fetching classroom types:", error);
            showErrorMessage(
                "Failed to Load Classroom Types",
                "Failed to load classroom types. Please try again."
            );
        }
    };

    // Real-time validation function
    const validateForm = (name: string, description: string) => {
        const errors: { name?: string; description?: string } = {};

        // Validate name
        if (!name.trim()) {
            errors.name = "Name is required";
        } else if (name.trim().length < 2) {
            errors.name = "Name must be at least 2 characters long";
        } else if (name.trim().length > 100) {
            errors.name = "Name must be less than 100 characters";
        } else {
            // Check for duplicate names (case-insensitive)
            const isDuplicate = classroomTypes.some((type) => {
                // For edit mode, exclude the current item being edited
                if (
                    selectedClassroomType &&
                    type.id === selectedClassroomType.id
                ) {
                    return false;
                }
                return (
                    type.name.toLowerCase().trim() === name.toLowerCase().trim()
                );
            });

            if (isDuplicate) {
                errors.name = "A classroom type with this name already exists";
            }
        }

        // Validate description (optional but if provided, check length)
        if (description && description.trim().length > 500) {
            errors.description = "Description must be less than 500 characters";
        }

        return errors;
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        const updatedFormData = {
            ...formData,
            [name]: value,
        };

        setFormData(updatedFormData);

        // Real-time validation
        const errors = validateForm(
            updatedFormData.name,
            updatedFormData.description
        );
        setValidationErrors(errors);
    };

    const openAddDialog = () => {
        resetForm();
        setIsAddDialogOpen(true);
    };

    const handleAddClassroomType = async () => {
        // Final validation before submission
        const errors = validateForm(formData.name, formData.description);
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        try {
            const scheduleId = params.id;
            const apiData = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                scheduleId: Number(scheduleId),
            };

            const response = await fetch("/api/classroom-types", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to create classroom type"
                );
            }

            await fetchClassroomTypes();
            setIsAddDialogOpen(false);
            resetForm();

            showSuccessMessage(
                "Classroom Type Added Successfully",
                `${formData.name} has been added successfully.`
            );
        } catch (error) {
            console.error("Error adding classroom type:", error);
            showErrorMessage(
                "Failed to Add Classroom Type",
                error instanceof Error
                    ? error.message
                    : "Failed to add classroom type. Please try again."
            );
        }
    };

    const handleEditClassroomType = async () => {
        if (!selectedClassroomType) return;

        // Prevent editing if classroom type has assignments
        if (hasAssignedClassrooms) {
            showErrorMessage(
                "Cannot Edit Classroom Type",
                "This classroom type is assigned to classrooms and cannot be edited. Please remove all classroom assignments first."
            );
            return;
        }

        // Final validation before submission
        const errors = validateForm(formData.name, formData.description);
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        try {
            const apiData = {
                id: selectedClassroomType.id,
                name: formData.name.trim(),
                description: formData.description.trim() || null,
            };

            const response = await fetch("/api/classroom-types", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error("Update failed:", responseData);
                throw new Error(
                    responseData.error || "Failed to update classroom type"
                );
            }

            await fetchClassroomTypes();
            setIsEditDialogOpen(false);
            resetForm();
            showSuccessMessage(
                "Classroom Type Updated Successfully",
                `${formData.name} has been updated successfully.`
            );
        } catch (error) {
            console.error("Error updating classroom type:", error);
            showErrorMessage(
                "Failed to Update Classroom Type",
                error instanceof Error
                    ? error.message
                    : "Failed to update classroom type. Please try again."
            );
        }
    };

    const handleDeleteClassroomType = async () => {
        if (!selectedClassroomType) return;

        // Prevent deletion if classroom type has assignments
        if (hasAssignedClassrooms) {
            showErrorMessage(
                "Cannot Delete Classroom Type",
                "This classroom type is assigned to classrooms and cannot be deleted. Please remove all classroom assignments first."
            );
            return;
        }

        const classroomTypeName = selectedClassroomType.name;

        try {
            const apiData = {
                id: selectedClassroomType.id,
            };
            const response = await fetch("/api/classroom-types", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                throw new Error("Failed to delete classroom type");
            }

            await fetchClassroomTypes();
            setIsDeleteDialogOpen(false);
            setSelectedClassroomType(null);

            showSuccessMessage(
                "Classroom Type Deleted Successfully",
                `${classroomTypeName} has been deleted successfully.`
            );
        } catch (error) {
            console.error("Error deleting classroom type:", error);
            showErrorMessage(
                "Failed to Delete Classroom Type",
                "Failed to delete classroom type. Please try again."
            );
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
        });
        setValidationErrors({});
        setSelectedClassroomType(null);
        setHasAssignedClassrooms(false);
        setAssignedClassroomsInfo("");
    };

    const openEditDialog = async (classroomType: ClassroomType) => {
        resetForm();
        setSelectedClassroomType(classroomType);

        // Check for classroom type assignments by name
        const assignmentCheck = await checkClassroomTypeAssignments(
            classroomType.name
        );
        setHasAssignedClassrooms(assignmentCheck.hasAssignments);
        setAssignedClassroomsInfo(assignmentCheck.info);

        setFormData({
            name: classroomType.name,
            description: classroomType.description || "",
        });
        setIsEditDialogOpen(true);
    };
    const openDeleteDialog = async (classroomType: ClassroomType) => {
        setSelectedClassroomType(classroomType);

        // Check for classroom type assignments by name
        const assignmentCheck = await checkClassroomTypeAssignments(
            classroomType.name
        );
        setHasAssignedClassrooms(assignmentCheck.hasAssignments);
        setAssignedClassroomsInfo(assignmentCheck.info);

        setIsDeleteDialogOpen(true);
    };

    // Check if form is valid (no errors and required fields filled)
    const isFormValid = () => {
        return (
            formData.name.trim() !== "" &&
            Object.keys(validationErrors).length === 0
        );
    };

    // Add these state variables to your existing state in ClassroomTypeView component
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
    interface CSVClassroomTypeRow {
        name: string;
        description?: string;
    }

    // Validation function for classroom type CSV data
    const validateClassroomTypeData = (
        row: any,
        rowIndex: number
    ): CSVClassroomTypeRow | string => {
        const errors: string[] = [];

        // Check required fields
        if (
            !row.name ||
            typeof row.name !== "string" ||
            row.name.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Classroom type name is required`);
        }

        if (errors.length > 0) {
            return errors.join(", ");
        }

        // Return cleaned data
        return {
            name: row.name.trim(),
            description: row.description ? row.description.trim() : undefined,
        };
    };

    const [hasAssignedClassrooms, setHasAssignedClassrooms] =
        useState<boolean>(false);
    const [isCheckingAssignments, setIsCheckingAssignments] =
        useState<boolean>(false);
    const [assignedClassroomsInfo, setAssignedClassroomsInfo] =
        useState<string>("");

    // Add this function to check if a classroom type is assigned to any classrooms
    const checkClassroomTypeAssignments = async (
        classroomTypeName: string
    ): Promise<{ hasAssignments: boolean; info: string }> => {
        try {
            setIsCheckingAssignments(true);
            const scheduleId = params.id;

            // Fetch classrooms for this schedule to check for classroom type assignments
            const response = await fetch(
                `/api/classrooms/?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch classrooms");
            }

            const classrooms = await response.json();

            // Check if any classroom is assigned to this classroom type by name
            const assignedClassrooms = classrooms.filter((classroom: any) => {
                return (
                    classroom.type &&
                    classroom.type.toLowerCase() ===
                        classroomTypeName.toLowerCase()
                );
            });

            if (assignedClassrooms.length > 0) {
                const classroomNames = assignedClassrooms
                    .map((classroom: any) => classroom.name)
                    .join(", ");
                return {
                    hasAssignments: true,
                    info: `This classroom type is assigned to ${assignedClassrooms.length} classroom(s): ${classroomNames}`,
                };
            }

            return { hasAssignments: false, info: "" };
        } catch (error) {
            console.error("Error checking classroom type assignments:", error);
            return { hasAssignments: false, info: "" };
        } finally {
            setIsCheckingAssignments(false);
        }
    };

    // Main import function
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
            // Parse CSV file
            Papa.parse(importFile, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) =>
                    header.trim().toLowerCase().replace(/\s+/g, "_"),
                complete: async (results) => {
                    const csvData = results.data as any[];
                    const validClassroomTypes: CSVClassroomTypeRow[] = [];
                    const errors: string[] = [];

                    // Validate each row
                    csvData.forEach((row, index) => {
                        const validationResult = validateClassroomTypeData(
                            row,
                            index
                        );
                        if (typeof validationResult === "string") {
                            errors.push(validationResult);
                        } else {
                            // Check for duplicate names in the CSV
                            const duplicateInCsv = validClassroomTypes.some(
                                (type) =>
                                    type.name.toLowerCase() ===
                                    validationResult.name.toLowerCase()
                            );
                            if (duplicateInCsv) {
                                errors.push(
                                    `Row ${
                                        index + 1
                                    }: Duplicate classroom type name "${
                                        validationResult.name
                                    }" in CSV`
                                );
                            } else {
                                // Check for existing names in database
                                const existingType = classroomTypes.some(
                                    (type) =>
                                        type.name.toLowerCase() ===
                                        validationResult.name.toLowerCase()
                                );
                                if (existingType) {
                                    errors.push(
                                        `Row ${
                                            index + 1
                                        }: Classroom type name "${
                                            validationResult.name
                                        }" already exists in the system`
                                    );
                                } else {
                                    validClassroomTypes.push(validationResult);
                                }
                            }
                        }
                    });

                    setImportProgress((prev) => ({
                        ...prev,
                        total: validClassroomTypes.length,
                        errors: errors,
                    }));

                    if (validClassroomTypes.length === 0) {
                        showErrorMessage(
                            "No Valid Classroom Types",
                            "No valid classroom types found in the CSV file"
                        );
                        setImportProgress((prev) => ({
                            ...prev,
                            isImporting: false,
                        }));
                        return;
                    }

                    // Import valid classroom types
                    let completed = 0;
                    const importErrors: string[] = [...errors];

                    for (const classroomType of validClassroomTypes) {
                        try {
                            const apiData = {
                                name: classroomType.name,
                                description: classroomType.description || null,
                                scheduleId: Number(scheduleId),
                            };

                            const response = await fetch(
                                "/api/classroom-types",
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify(apiData),
                                }
                            );

                            if (!response.ok) {
                                const errorData = await response.text();
                                importErrors.push(
                                    `Failed to import ${classroomType.name}: ${
                                        errorData || "Unknown error"
                                    }`
                                );
                            } else {
                                completed++;
                            }
                        } catch (error) {
                            importErrors.push(
                                `Failed to import ${classroomType.name}: ${
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
                        await new Promise((resolve) => setTimeout(resolve, 10));
                    }

                    // Final update
                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));

                    // Refresh the classroom types list
                    await fetchClassroomTypes();

                    // Show completion message
                    if (completed > 0) {
                        showSuccessMessage(
                            "Import Completed",
                            `Successfully imported ${completed} classroom type(s)${
                                importErrors.length > 0
                                    ? ` with ${importErrors.length} error(s)`
                                    : ""
                            }`
                        );
                    } else {
                        showErrorMessage(
                            "Import Failed",
                            "Failed to import any classroom types"
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
                "Failed to import classroom types. Please try again."
            );
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
        }
    };

    // File selection handler
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImportFile(file);
        } else {
            showErrorMessage(
                "No File Selected",
                "Please select a valid CSV file"
            );
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

    // Download CSV with current classroom types data
    const downloadClassroomTypesCSV = () => {
        try {
            // Create CSV header
            const headers = ["name", "description"];

            // Convert classroom types data to CSV rows
            const csvRows = classroomTypes.map((type) => [
                type.name,
                type.description || "",
            ]);

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
            link.setAttribute(
                "download",
                `classroom_types_export_${today}.csv`
            );

            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSuccessMessage(
                "Export Successful",
                `Exported ${classroomTypes.length} classroom types to CSV`
            );
        } catch (error) {
            console.error("Error exporting CSV:", error);
            showErrorMessage(
                "Export Failed",
                "Failed to export classroom types. Please try again."
            );
        }
    };

    const [searchQuery, setSearchQuery] = useState("");

    // Filter classroom types based on search query
    const filteredClassroomTypes = classroomTypes.filter(
        (type) =>
            type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (type.description &&
                type.description
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()))
    );

    // Calculate pagination values with filtered data
    const totalPages = Math.ceil(
        filteredClassroomTypes.length / ITEMS_PER_PAGE
    );
    const paginatedClassroomTypes = filteredClassroomTypes.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);

    // Add this function with your other handler functions
    const handleClearAllClassroomTypes = async () => {
        const {
            deletableClassroomTypes,
            undeletableClassroomTypes,
        } = clearAllSummary;

        if (deletableClassroomTypes.length === 0) {
            showErrorMessage(
                "Cannot Clear All Classroom Types",
                "All classroom types have assignments or other issues preventing deletion. Please resolve them first."
            );
            setIsClearAllDialogOpen(false);
            return;
        }

        setClearAllSummary((prev) => ({ ...prev, isDeleting: true }));

        try {
            const deletePromises = deletableClassroomTypes.map((classroomType) =>
                fetch("/api/classroom-types", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id: classroomType.id }),
                })
            );

            await Promise.all(deletePromises);
            await fetchClassroomTypes();

            showSuccessMessage(
                "Classroom Types Cleared",
                `Successfully deleted ${
                    deletableClassroomTypes.length
                } classroom type(s).${
                    undeletableClassroomTypes.length > 0
                        ? ` ${undeletableClassroomTypes.length} classroom type(s) could not be deleted.`
                        : ""
                }`
            );
        } catch (error) {
            console.error("Error clearing all classroom types:", error);
            showErrorMessage(
                "Failed to Delete Classroom Types",
                "Failed to delete some classroom types. Please try again."
            );
        } finally {
            setClearAllSummary((prev) => ({ ...prev, isDeleting: false }));
            setIsClearAllDialogOpen(false);
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
                            Classroom Types
                        </h2>
                        <p className="text-xs text-gray-600">
                            Manage classroom type categories
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setIsImportDialogOpen(true)}
                            variant="outline"
                            className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs px-3 py-1.5 rounded-md"
                        >
                            <Download className="mr-1 h-3 w-3" /> Import CSV
                        </Button>
                        <Button
                            onClick={downloadClassroomTypesCSV}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={classroomTypes.length === 0}
                        >
                            <Upload className="mr-1 h-3 w-3" /> Export CSV
                        </Button>

                        <Button
                            onClick={openAddDialog}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                        >
                            <Plus className="h-3 w-3" /> New Classroom Type
                        </Button>
                        <Button
                            onClick={openClearAllDialog}
                            variant="outline"
                            className="border-red-600 text-red-600 hover:bg-red-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={classroomTypes.length === 0}
                        >
                            <Trash className="mr-1 h-3 w-3" /> Clear All
                        </Button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search classroom types by name or description..."
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
                                        Name
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-20">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {classroomTypes.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-3 py-8 text-center text-gray-500 text-sm"
                                        >
                                            <div className="space-y-1">
                                                <div>
                                                    {searchQuery
                                                        ? `No classroom types found for "${searchQuery}"`
                                                        : "No classroom types found"}
                                                </div>
                                                <div className="text-xs">
                                                    {searchQuery
                                                        ? "Try a different search term"
                                                        : "Add a new classroom type to get started."}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedClassroomTypes.map(
                                        (classroomType, index) => (
                                            <tr
                                                key={classroomType.id}
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
                                                    {classroomType.name}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-600">
                                                    {classroomType.description ||
                                                        "-"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-500 hover:text-[#2F2F85] hover:bg-gray-100"
                                                            onClick={() =>
                                                                openEditDialog(
                                                                    classroomType
                                                                )
                                                            }
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() =>
                                                                openDeleteDialog(
                                                                    classroomType
                                                                )
                                                            }
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
                {filteredClassroomTypes.length > 0 && totalPages > 1 && (
                    <div className="flex justify-center">
                        <CustomPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}

                {/* Add Classroom Type Dialog */}
                <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) resetForm();
                        setIsAddDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-lg">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Add New Classroom Type
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="name"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Computer Lab"
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.name
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                />
                                {validationErrors.name && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-red-500 text-xs">
                                            ❌
                                        </span>
                                        <p className="text-xs text-red-600 font-medium">
                                            {validationErrors.name}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="description"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Description
                                </Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Enter classroom type description (optional)"
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm min-h-[80px] ${
                                        validationErrors.description
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                />
                                {validationErrors.description && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-red-500 text-xs">
                                            ❌
                                        </span>
                                        <p className="text-xs text-red-600 font-medium">
                                            {validationErrors.description}
                                        </p>
                                    </div>
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
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddClassroomType}
                                disabled={!isFormValid()}
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                Add
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Classroom Type Dialog */}
                <Dialog
                    open={isEditDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) resetForm();
                        setIsEditDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-lg">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Edit Classroom Type
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            {/* Warning message when classroom type has assignments */}
                            {hasAssignedClassrooms && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-600 text-sm">
                                            🚫
                                        </span>
                                        <p className="text-sm text-red-800 font-medium">
                                            This classroom type cannot be edited
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-700 mt-1 ml-6">
                                        {assignedClassroomsInfo}. Please remove
                                        all classroom assignments before editing
                                        this classroom type.
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
                                            Checking for classroom
                                            assignments...
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-name"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="edit-name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Enter classroom type name"
                                    disabled={
                                        hasAssignedClassrooms ||
                                        isCheckingAssignments
                                    }
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.name
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    } ${
                                        hasAssignedClassrooms ||
                                        isCheckingAssignments
                                            ? "bg-gray-100 cursor-not-allowed opacity-60"
                                            : ""
                                    }`}
                                />
                                {validationErrors.name && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-red-500 text-xs">
                                            ❌
                                        </span>
                                        <p className="text-xs text-red-600 font-medium">
                                            {validationErrors.name}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-description"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Description
                                </Label>
                                <Textarea
                                    id="edit-description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Enter classroom type description (optional)"
                                    disabled={
                                        hasAssignedClassrooms ||
                                        isCheckingAssignments
                                    }
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm min-h-[80px] ${
                                        validationErrors.description
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    } ${
                                        hasAssignedClassrooms ||
                                        isCheckingAssignments
                                            ? "bg-gray-100 cursor-not-allowed opacity-60"
                                            : ""
                                    }`}
                                />
                                {validationErrors.description && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-red-500 text-xs">
                                            ❌
                                        </span>
                                        <p className="text-xs text-red-600 font-medium">
                                            {validationErrors.description}
                                        </p>
                                    </div>
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
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleEditClassroomType}
                                disabled={
                                    !isFormValid() ||
                                    hasAssignedClassrooms ||
                                    isCheckingAssignments
                                }
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {hasAssignedClassrooms ? "Cannot Edit" : "Save"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                {/* Delete Classroom Type Dialog */}
                <Dialog
                    open={isDeleteDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) setSelectedClassroomType(null);
                        setIsDeleteDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Delete Classroom Type
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4">
                            {/* Warning message when classroom type has assignments */}
                            {hasAssignedClassrooms && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-600 text-sm">
                                            🚫
                                        </span>
                                        <p className="text-sm text-red-800 font-medium">
                                            This classroom type cannot be
                                            deleted
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-700 mt-1 ml-6">
                                        {assignedClassroomsInfo}. Please remove
                                        all classroom assignments before
                                        deleting this classroom type.
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
                                            Checking for classroom
                                            assignments...
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Only show confirmation text if no assignments */}
                            {!hasAssignedClassrooms &&
                                !isCheckingAssignments && (
                                    <>
                                        <p className="text-sm text-gray-600 mb-2">
                                            Are you sure you want to delete this
                                            classroom type?
                                        </p>
                                        <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                                            {selectedClassroomType?.name}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-2">
                                            This action cannot be undone.
                                        </p>
                                    </>
                                )}

                            {/* Show classroom type info even when disabled */}
                            {hasAssignedClassrooms && (
                                <div className="mt-4">
                                    <p className="text-sm text-gray-600 mb-2">
                                        Classroom Type Details:
                                    </p>
                                    <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                                        {selectedClassroomType?.name}
                                    </p>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedClassroomType(null);
                                    setIsDeleteDialogOpen(false);
                                }}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteClassroomType}
                                disabled={
                                    hasAssignedClassrooms ||
                                    isCheckingAssignments
                                }
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {hasAssignedClassrooms
                                    ? "Cannot Delete"
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
                                Import Classroom Types from CSV
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
                                    CSV should contain columns: name,
                                    description (optional)
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
                                        Errors:
                                    </p>
                                    <div className="text-xs space-y-1">
                                        {importProgress.errors.map(
                                            (error, index) => (
                                                <p
                                                    key={index}
                                                    className="text-red-600"
                                                >
                                                    {error}
                                                </p>
                                            )
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

                {/* Clear All Dialog */}
                <Dialog
                    open={isClearAllDialogOpen}
                    onOpenChange={setIsClearAllDialogOpen}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Clear All Classroom Types
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4">
                            {clearAllSummary.isChecking ? (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-600 text-sm">
                                            ℹ️
                                        </span>
                                        <p className="text-sm text-blue-800">
                                            Checking for classroom type assignments and conflicts...
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Are you sure you want to proceed with clearing classroom types?
                                    </p>
                                    <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border mb-2">
                                        {`Total classroom types to be deleted: ${clearAllSummary.deletableClassroomTypes.length}`}
                                    </p>

                                    {clearAllSummary.undeletableClassroomTypes.length > 0 && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
                                            <p className="text-sm text-red-800 font-medium mb-2">
                                                The following {clearAllSummary.undeletableClassroomTypes.length} classroom type(s) cannot be deleted:
                                            </p>
                                            <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                                                {clearAllSummary.undeletableClassroomTypes.map((item, index) => (
                                                    <li key={index}>
                                                        <span className="font-semibold">
                                                            {item.classroomType.name}:
                                                        </span>{" "}
                                                        {item.reason}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <p className="text-xs text-red-600 font-medium">
                                        This action cannot be undone for deleted classroom types.
                                    </p>
                                </>
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsClearAllDialogOpen(false)}
                                disabled={clearAllSummary.isChecking || clearAllSummary.isDeleting}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleClearAllClassroomTypes}
                                disabled={
                                    clearAllSummary.isChecking ||
                                    clearAllSummary.deletableClassroomTypes.length === 0 ||
                                    clearAllSummary.isDeleting
                                }
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {clearAllSummary.isChecking
                                    ? "Checking..."
                                    : clearAllSummary.isDeleting
                                    ? `Deleting ${clearAllSummary.deletableClassroomTypes.length} classroom type(s)...`
                                    : clearAllSummary.deletableClassroomTypes.length > 0
                                    ? `Delete ${clearAllSummary.deletableClassroomTypes.length} Classroom Type(s)`
                                    : "No Classroom Types to Delete"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
