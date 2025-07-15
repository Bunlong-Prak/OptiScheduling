"use client";

import type React from "react";

import type { Major, MajorFormData } from "@/app/types";
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
import { useEffect, useRef, useState } from "react";

const ITEMS_PER_PAGE = 20;

// Define a more specific type for majors being added to the DB
type MajorCreatePayload = {
    name: string;
    shortTag: string;
    scheduleId: number;
};

// Define a type for major updates
type MajorUpdate = {
    id: number;
    name: string;
    shortTag: string;
};

// Validation errors type
type ValidationErrors = {
    name?: string;
    shortTag?: string;
};

// Message types
type MessageType = "success" | "error";

type Message = {
    id: string;
    type: MessageType;
    title: string;
    description: string;
};

export default function MajorView() {
    const [searchQuery, setSearchQuery] = useState("");
    const [majors, setMajors] = useState<Major[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // New enhanced message system
    const [messages, setMessages] = useState<Message[]>([]);
    const messageTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    const [selectedMajor, setSelectedMajor] = useState<Major | null>(null);
    const [formData, setFormData] = useState<MajorFormData>({
        name: "",
        shortTag: "",
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
        {}
    );
    const [touchedFields, setTouchedFields] = useState<{
        name: boolean;
        shortTag: boolean;
    }>({ name: false, shortTag: false });
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

    // Load majors on component mount
    useEffect(() => {
        fetchMajors();
    }, [params]); // Add params as a dependency since it's used in fetchMajors

    // Real-time validation effect
    useEffect(() => {
        validateForm();
    }, [formData, majors, selectedMajor, touchedFields]);

    // Validation function
    const validateForm = () => {
        const errors: ValidationErrors = {};

        // Validate name - only show errors if field has been touched
        if (touchedFields.name) {
            if (formData.name.trim() === "") {
                errors.name = "Major name is required";
            } else {
                // Check for duplicate names (case-insensitive)
                const isDuplicateName = majors.some((major) => {
                    // If editing, exclude the current major from duplicate check
                    if (selectedMajor && major.id === selectedMajor.id) {
                        return false;
                    }
                    return (
                        major.name.toLowerCase() ===
                        formData.name.trim().toLowerCase()
                    );
                });

                if (isDuplicateName) {
                    errors.name = "A major with this name already exists";
                }
            }
        }

        // Validate short tag - only show errors if field has been touched
        if (touchedFields.shortTag) {
            if (formData.shortTag.trim() === "") {
                errors.shortTag = "Short tag is required";
            } else {
                // Check for duplicate short tags (case-insensitive)
                const isDuplicateTag = majors.some((major) => {
                    // If editing, exclude the current major from duplicate check
                    if (selectedMajor && major.id === selectedMajor.id) {
                        return false;
                    }
                    return (
                        major.shortTag.toLowerCase() ===
                        formData.shortTag.trim().toLowerCase()
                    );
                });

                if (isDuplicateTag) {
                    errors.shortTag =
                        "A major with this short tag already exists";
                }
            }
        }

        setValidationErrors(errors);
    };

    // Check if form is valid
    const isFormValid = () => {
        return (
            Object.keys(validationErrors).length === 0 &&
            formData.name.trim() !== "" &&
            formData.shortTag.trim() !== ""
        );
    };

    //search functionality
    // Filter majors based on search query
    const filteredMajors = majors.filter(
        (major) =>
            major.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            major.shortTag.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Calculate pagination values with filtered data
    const totalPages = Math.ceil(filteredMajors.length / ITEMS_PER_PAGE);
    const paginatedMajors = filteredMajors.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    // Fetch majors
    const fetchMajors = async () => {
        try {
            const scheduleId = params.id;
            if (!scheduleId) {
                console.error("Schedule ID is undefined");
                showErrorMessage(
                    "Missing Schedule ID",
                    "Please check the URL and try again."
                );
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
                const errorData = await response.text();
                console.error("Server response:", errorData);
                throw new Error(
                    `Failed to fetch majors: ${response.status} ${response.statusText}`
                );
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                console.error("Expected array but got:", typeof data);
                showErrorMessage(
                    "Invalid Data Format",
                    "Received invalid data format from server."
                );
                return;
            }

            setMajors(data);
            setCurrentPage(1);
        } catch (error: unknown) {
            console.error("Error fetching majors:", error);
            showErrorMessage(
                "Failed to Load Majors",
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred"
            );
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });

        // Mark field as touched when user starts typing
        setTouchedFields((prev) => ({
            ...prev,
            [name]: true,
        }));
    };

    const openAddDialog = () => {
        resetForm();
        setIsAddDialogOpen(true);
    };

    const handleAddMajor = async () => {
        // Double-check validation before submitting
        if (!isFormValid()) {
            showErrorMessage(
                "Validation Error",
                "Please fix the validation errors before submitting"
            );
            return;
        }

        try {
            const scheduleId = params.id;
            if (!scheduleId) {
                throw new Error("Schedule ID is missing");
            }

            const trimmedName = formData.name.trim();
            const trimmedShortTag = formData.shortTag.trim();

            const majorToAdd: MajorCreatePayload = {
                name: trimmedName,
                shortTag: trimmedShortTag,
                scheduleId: Number(scheduleId),
            };

            const response = await fetch("/api/majors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(majorToAdd),
            });

            const responseText = await response.text();
            if (!response.ok) {
                console.error(
                    "Server response on add:",
                    response.status,
                    responseText
                );
                throw new Error(
                    `Failed to create major: ${response.status} ${response.statusText} - ${responseText}`
                );
            }

            await fetchMajors();
            setIsAddDialogOpen(false);
            resetForm();
            showSuccessMessage(
                "Major Added Successfully",
                `${trimmedName} has been added successfully.`
            );
        } catch (error: unknown) {
            console.error("Error adding major:", error);
            showErrorMessage(
                "Failed to Add Major",
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred"
            );
        }
    };

    const handleEditMajor = async () => {
        if (!selectedMajor || !selectedMajor.id) {
            showErrorMessage(
                "No Major Selected",
                "Please select a major to edit."
            );
            return;
        }

        // Double-check validation before submitting
        if (!isFormValid()) {
            showErrorMessage(
                "Validation Error",
                "Please fix the validation errors before submitting"
            );
            return;
        }

        try {
            const update: MajorUpdate = {
                id: selectedMajor.id,
                name: formData.name.trim(),
                shortTag: formData.shortTag.trim(),
            };

            const updateResponse = await fetch("/api/majors", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(update),
            });

            const updateResponseText = await updateResponse.text();
            if (!updateResponse.ok) {
                throw new Error(
                    `Failed to update major: ${updateResponse.status} ${updateResponseText}`
                );
            }

            await fetchMajors(); // Refresh the list
            setIsEditDialogOpen(false); // Close the dialog
            resetForm(); // Reset form data
            showSuccessMessage(
                "Major Updated Successfully",
                `${formData.name.trim()} has been updated successfully.`
            );
        } catch (error: unknown) {
            console.error("Error updating major:", error);
            showErrorMessage(
                "Failed to Update Major",
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred"
            );
        }
    };

    const handleDeleteMajor = async () => {
        if (!selectedMajor || !selectedMajor.id) {
            showErrorMessage(
                "No Major Selected",
                "Please select a major to delete."
            );
            return;
        }

        const majorName = selectedMajor.name;

        try {
            const deleteResponse = await fetch("/api/majors", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: selectedMajor.id }),
            });

            const deleteResponseText = await deleteResponse.text();
            if (!deleteResponse.ok) {
                throw new Error(
                    `Failed to delete major: ${deleteResponse.status} ${deleteResponseText}`
                );
            }

            await fetchMajors(); // Refresh the list of majors in the UI
            setIsDeleteDialogOpen(false);
            setSelectedMajor(null); // Clear the selected major
            showSuccessMessage(
                "Major Deleted Successfully",
                `${majorName} has been deleted successfully.`
            );
        } catch (error: unknown) {
            console.error("Error deleting major:", error);
            showErrorMessage(
                "Failed to Delete Major",
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred"
            );
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            shortTag: "",
        });
        setSelectedMajor(null);
        setValidationErrors({});
        setTouchedFields({ name: false, shortTag: false });
    };

    const openEditDialog = (major: Major) => {
        resetForm();
        setSelectedMajor(major);
        setFormData({
            name: major.name,
            shortTag: major.shortTag,
        });
        // Mark fields as touched since they have existing values
        setTouchedFields({ name: true, shortTag: true });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (major: Major) => {
        setSelectedMajor(major);
        setIsDeleteDialogOpen(true);
    };

    //import and export start from here

    // Add these state variables to your existing state in MajorView component
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
    interface CSVMajorRow {
        name: string;
        shortTag: string;
    }

    // Validation function for major CSV data
    const validateMajorData = (
        row: any,
        rowIndex: number
    ): CSVMajorRow | string => {
        const errors: string[] = [];

        // Check required fields
        if (
            !row.name ||
            typeof row.name !== "string" ||
            row.name.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Major name is required`);
        }

        if (
            !row.short_tag ||
            typeof row.short_tag !== "string" ||
            row.short_tag.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Short tag is required`);
        }

        if (errors.length > 0) {
            return errors.join(", ");
        }

        // Return cleaned data
        return {
            name: row.name.trim(),
            shortTag: row.short_tag.trim(),
        };
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
                    const validMajors: CSVMajorRow[] = [];
                    const errors: string[] = [];

                    // Validate each row
                    csvData.forEach((row, index) => {
                        const validationResult = validateMajorData(row, index);
                        if (typeof validationResult === "string") {
                            errors.push(validationResult);
                        } else {
                            // Check for duplicate names in the CSV
                            const duplicateInCsv = validMajors.some(
                                (major) =>
                                    major.name.toLowerCase() ===
                                    validationResult.name.toLowerCase()
                            );
                            if (duplicateInCsv) {
                                errors.push(
                                    `Row ${index + 1}: Duplicate major name "${
                                        validationResult.name
                                    }" in CSV`
                                );
                            } else {
                                // Check for duplicate short tags in the CSV
                                const duplicateTagInCsv = validMajors.some(
                                    (major) =>
                                        major.shortTag.toLowerCase() ===
                                        validationResult.shortTag.toLowerCase()
                                );
                                if (duplicateTagInCsv) {
                                    errors.push(
                                        `Row ${
                                            index + 1
                                        }: Duplicate short tag "${
                                            validationResult.shortTag
                                        }" in CSV`
                                    );
                                } else {
                                    // Check for existing names in database
                                    const existingMajorName = majors.some(
                                        (major) =>
                                            major.name.toLowerCase() ===
                                            validationResult.name.toLowerCase()
                                    );
                                    if (existingMajorName) {
                                        errors.push(
                                            `Row ${index + 1}: Major name "${
                                                validationResult.name
                                            }" already exists in the system`
                                        );
                                    } else {
                                        // Check for existing short tags in database
                                        const existingMajorTag = majors.some(
                                            (major) =>
                                                major.shortTag.toLowerCase() ===
                                                validationResult.shortTag.toLowerCase()
                                        );
                                        if (existingMajorTag) {
                                            errors.push(
                                                `Row ${index + 1}: Short tag "${
                                                    validationResult.shortTag
                                                }" already exists in the system`
                                            );
                                        } else {
                                            validMajors.push(validationResult);
                                        }
                                    }
                                }
                            }
                        }
                    });

                    setImportProgress((prev) => ({
                        ...prev,
                        total: validMajors.length,
                        errors: errors,
                    }));

                    if (validMajors.length === 0) {
                        showErrorMessage(
                            "No Valid Majors",
                            "No valid majors found in the CSV file"
                        );
                        setImportProgress((prev) => ({
                            ...prev,
                            isImporting: false,
                        }));
                        return;
                    }

                    // Import valid majors
                    let completed = 0;
                    const importErrors: string[] = [...errors];

                    for (const major of validMajors) {
                        try {
                            const apiData: MajorCreatePayload = {
                                name: major.name,
                                shortTag: major.shortTag,
                                scheduleId: Number(scheduleId),
                            };

                            const response = await fetch("/api/majors", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(apiData),
                            });

                            if (!response.ok) {
                                const errorData = await response.text();
                                importErrors.push(
                                    `Failed to import ${major.name}: ${
                                        errorData || "Unknown error"
                                    }`
                                );
                            } else {
                                completed++;
                            }
                        } catch (error) {
                            importErrors.push(
                                `Failed to import ${major.name}: ${
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
                            setTimeout(resolve, 100)
                        );
                    }

                    // Final update
                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));

                    // Refresh the major list
                    await fetchMajors();

                    // Show completion message
                    if (completed > 0) {
                        showSuccessMessage(
                            "Import Completed",
                            `Successfully imported ${completed} major(s)${
                                importErrors.length > 0
                                    ? ` with ${importErrors.length} error(s)`
                                    : ""
                            }`
                        );
                    } else {
                        showErrorMessage(
                            "Import Failed",
                            "Failed to import any majors"
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
                "Failed to import majors. Please try again."
            );
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
        }
    };

    // File selection handler
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

    // Download CSV with current majors data
    const downloadMajorsCSV = () => {
        try {
            // Create CSV header
            const headers = ["name", "short_tag"];

            // Convert majors data to CSV rows
            const csvRows = filteredMajors.map((major) => [
                major.name,
                major.shortTag,
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
            link.setAttribute("download", `majors_export_${today}.csv`);

            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSuccessMessage(
                "Export Successful",
                `Exported ${filteredMajors.length} majors to CSV`
            );
        } catch (error) {
            console.error("Error exporting CSV:", error);
            showErrorMessage(
                "Export Failed",
                "Failed to export majors. Please try again."
            );
        }
    };
    // Add this state variable with your other useState declarations
    const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);

    // Add this function with your other handler functions
    const handleClearAllMajors = async () => {
        const majorCount = majors.length;

        try {
            // Delete all majors one by one
            const deletePromises = majors.map((major) =>
                fetch("/api/majors", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id: major.id }),
                })
            );

            await Promise.all(deletePromises);
            await fetchMajors();
            setIsClearAllDialogOpen(false);
            showSuccessMessage(
                "All Majors Deleted",
                `Successfully deleted ${majorCount} majors`
            );
        } catch (error) {
            console.error("Error clearing all majors:", error);
            showErrorMessage(
                "Failed to Delete All Majors",
                "Failed to delete all majors. Please try again."
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
                            Majors
                        </h2>
                        <p className="text-xs text-gray-600">
                            Manage academic majors and programs
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
                            onClick={downloadMajorsCSV}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={majors.length === 0}
                        >
                            <Download className="mr-1 h-3 w-3" /> Export CSV
                        </Button>
                        <Button
                            onClick={openAddDialog}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                        >
                            <Plus className="mr-1 h-3 w-3" /> New Major
                        </Button>
                        <Button
                            onClick={() => setIsClearAllDialogOpen(true)}
                            variant="outline"
                            className="border-red-600 text-red-600 hover:bg-red-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={majors.length === 0}
                        >
                            <Trash className="mr-1 h-3 w-3" /> Clear All
                        </Button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search majors by name or short tag..."
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
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-24">
                                        Short Tag
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-20">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {majors.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-3 py-8 text-center text-gray-500 text-sm"
                                        >
                                            <div className="space-y-1">
                                                <div>
                                                    {searchQuery
                                                        ? `No majors found for "${searchQuery}"`
                                                        : "No majors found"}
                                                </div>
                                                <div className="text-xs">
                                                    {searchQuery
                                                        ? "Try a different search term"
                                                        : "Add a new major to get started."}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedMajors.map((major, index) => (
                                        <tr
                                            key={major.id}
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
                                                {major.name}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-gray-900">
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                    {major.shortTag}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-gray-500 hover:text-[#2F2F85] hover:bg-gray-100"
                                                        onClick={() =>
                                                            openEditDialog(
                                                                major
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
                                                                major
                                                            )
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
                {filteredMajors.length > 0 && totalPages > 1 && (
                    <div className="flex justify-center">
                        <CustomPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}

                {/* Add Major Dialog */}
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
                                Add New Major
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="name"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Major Name
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Computer Science"
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.name
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                />
                                {validationErrors.name && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {validationErrors.name}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="shortTag"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Short Tag
                                </Label>
                                <Input
                                    id="shortTag"
                                    name="shortTag"
                                    value={formData.shortTag}
                                    onChange={handleInputChange}
                                    placeholder="CS"
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.shortTag
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                />
                                {validationErrors.shortTag && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {validationErrors.shortTag}
                                    </p>
                                )}
                                <span className="text-xs text-gray-500">
                                    Enter a short code for the major (e.g., CS
                                    for Computer Science).
                                </span>
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
                                onClick={handleAddMajor}
                                disabled={!isFormValid()}
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                Add
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Major Dialog */}
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
                                Edit Major
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-name"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Major Name
                                </Label>
                                <Input
                                    id="edit-name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.name
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                />
                                {validationErrors.name && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {validationErrors.name}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-shortTag"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Short Tag
                                </Label>
                                <Input
                                    id="edit-shortTag"
                                    name="shortTag"
                                    value={formData.shortTag}
                                    onChange={handleInputChange}
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.shortTag
                                            ? "border-red-300 focus:border-red-500 animate-pulse"
                                            : ""
                                    }`}
                                />
                                {validationErrors.shortTag && (
                                    <p className="text-xs text-red-600 font-medium">
                                        {validationErrors.shortTag}
                                    </p>
                                )}
                                <span className="text-xs text-gray-500">
                                    Enter a short code for the major (e.g., CS
                                    for Computer Science).
                                </span>
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
                                onClick={handleEditMajor}
                                disabled={!isFormValid()}
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                Save
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Major Dialog */}
                <Dialog
                    open={isDeleteDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) setSelectedMajor(null);
                        setIsDeleteDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Delete Major
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Are you sure you want to delete this major?
                            </p>
                            <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                                {selectedMajor?.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                This action cannot be undone.
                            </p>
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedMajor(null);
                                    setIsDeleteDialogOpen(false);
                                }}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteMajor}
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
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Import Majors from CSV
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
                                    CSV should contain columns: name, short_tag
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

                {/* Clear All Dialog */}
                <Dialog
                    open={isClearAllDialogOpen}
                    onOpenChange={setIsClearAllDialogOpen}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Clear All Majors
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Are you sure you want to delete all{" "}
                                {majors.length} majors?
                            </p>
                            <p className="text-xs text-red-600 font-medium">
                                This action cannot be undone.
                            </p>
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsClearAllDialogOpen(false)}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleClearAllMajors}
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
