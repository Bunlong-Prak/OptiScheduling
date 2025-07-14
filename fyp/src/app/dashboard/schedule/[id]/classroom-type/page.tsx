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
import { Download, Pencil, Plus, Search, Trash, Upload, X } from "lucide-react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import type React from "react";
import { useEffect, useState } from "react";

interface ClassroomType {
    id: number;
    name: string;
    description?: string;
}

const ITEMS_PER_PAGE = 20;

export default function ClassroomTypeView() {
    const [classroomTypes, setClassroomTypes] = useState<ClassroomType[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);
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

    // Load classroom types on component mount
    useEffect(() => {
        fetchClassroomTypes();
    }, []);

    // Clear status message after 5 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    const params = useParams();

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
            setStatusMessage({
                text: "Failed to load classroom types. Please try again.",
                type: "error",
            });
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

            setStatusMessage({
                text: "Classroom type added successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error adding classroom type:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to add classroom type. Please try again.",
                type: "error",
            });
        }
    };

    const handleEditClassroomType = async () => {
        if (!selectedClassroomType) return;

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
            setStatusMessage({
                text: "Classroom type updated successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error updating classroom type:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to update classroom type. Please try again.",
                type: "error",
            });
        }
    };

    const handleDeleteClassroomType = async () => {
        if (!selectedClassroomType) return;

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

            setStatusMessage({
                text: "Classroom type deleted successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error deleting classroom type:", error);
            setStatusMessage({
                text: "Failed to delete classroom type. Please try again.",
                type: "error",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
        });
        setValidationErrors({});
        setSelectedClassroomType(null);
    };

    const openEditDialog = (classroomType: ClassroomType) => {
        resetForm();
        setSelectedClassroomType(classroomType);
        setFormData({
            name: classroomType.name,
            description: classroomType.description || "",
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (classroomType: ClassroomType) => {
        setSelectedClassroomType(classroomType);
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
                        setStatusMessage({
                            text: "No valid classroom types found in the CSV file",
                            type: "error",
                        });
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
                        await new Promise((resolve) =>
                            setTimeout(resolve, 100)
                        );
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
                        setStatusMessage({
                            text: `Successfully imported ${completed} classroom type(s)${
                                importErrors.length > 0
                                    ? ` with ${importErrors.length} error(s)`
                                    : ""
                            }`,
                            type:
                                completed === validClassroomTypes.length
                                    ? "success"
                                    : "error",
                        });
                    } else {
                        setStatusMessage({
                            text: "Failed to import any classroom types",
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
                text: "Failed to import classroom types. Please try again.",
                type: "error",
            });
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
        }
    };

    // File selection handler
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
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

            setStatusMessage({
                text: `Exported ${classroomTypes.length} classroom types to CSV`,
                type: "success",
            });
        } catch (error) {
            console.error("Error exporting CSV:", error);
            setStatusMessage({
                text: "Failed to export classroom types. Please try again.",
                type: "error",
            });
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
        try {
            // Delete all classroom types one by one
            const deletePromises = classroomTypes.map((classroomType) =>
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
            setIsClearAllDialogOpen(false);
            setStatusMessage({
                text: `Successfully deleted ${classroomTypes.length} classroom types`,
                type: "success",
            });
        } catch (error) {
            console.error("Error clearing all classroom types:", error);
            setStatusMessage({
                text: "Failed to delete all classroom types. Please try again.",
                type: "error",
            });
        }
    };

    return (
        <div className="space-y-4">
            {/* Status Message */}
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
                        <Upload className="mr-1 h-3 w-3" /> Import CSV
                    </Button>
                    <Button
                        onClick={downloadClassroomTypesCSV}
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-3 py-1.5 rounded-md"
                        disabled={classroomTypes.length === 0}
                    >
                        <Download className="mr-1 h-3 w-3" /> Export CSV
                    </Button>

                    <Button
                        onClick={openAddDialog}
                        className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                    >
                        <Plus className="h-3 w-3" /> New Classroom Type
                    </Button>
                    <Button
                        onClick={() => setIsClearAllDialogOpen(true)}
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
                                            <div>No classroom types found</div>
                                            <div className="text-xs">
                                                Add a new classroom type to get
                                                started.
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
                                            <td className="px-3 py-2 text-xs text-gray-900">
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
            {filteredClassroomTypes.length > 0 && (
                <div className="flex justify-center">
                    <CustomPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}

            {/* Add Dialog */}
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
                            Add New Classroom Type
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="space-y-4">
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
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.name
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : ""
                                    }`}
                                    placeholder="Enter classroom type name"
                                />
                                {validationErrors.name && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {validationErrors.name}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="description"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Description (Optional)
                                </Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.description
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : ""
                                    }`}
                                    placeholder="Enter classroom type description"
                                    rows={3}
                                />
                                {validationErrors.description && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {validationErrors.description}
                                    </p>
                                )}
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
                            onClick={handleAddClassroomType}
                            disabled={!isFormValid()}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white disabled:bg-gray-300 disabled:cursor-not-allowed text-sm px-3 py-1.5"
                        >
                            Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
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
                            Edit Classroom Type
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="space-y-4">
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
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.name
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : ""
                                    }`}
                                    placeholder="Enter classroom type name"
                                />
                                {validationErrors.name && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {validationErrors.name}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-description"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Description (Optional)
                                </Label>
                                <Textarea
                                    id="edit-description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        validationErrors.description
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : ""
                                    }`}
                                    placeholder="Enter classroom type description"
                                    rows={3}
                                />
                                {validationErrors.description && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {validationErrors.description}
                                    </p>
                                )}
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
                            onClick={handleEditClassroomType}
                            disabled={!isFormValid()}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white disabled:bg-gray-300 disabled:cursor-not-allowed text-sm px-3 py-1.5"
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
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
                        <p className="text-sm text-gray-600 mb-2">
                            Are you sure you want to delete this classroom type?
                        </p>
                        <div className="bg-gray-50 p-3 rounded border space-y-1">
                            <p className="font-medium text-sm text-gray-900">
                                {selectedClassroomType?.name}
                            </p>
                            {selectedClassroomType?.description && (
                                <p className="text-xs text-gray-600">
                                    {selectedClassroomType.description}
                                </p>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            This action cannot be undone.
                        </p>
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
                            className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
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
                        <div className="space-y-2">
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
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                            />
                            <p className="text-xs text-gray-600">
                                CSV should contain columns: name, description
                                (optional)
                            </p>
                        </div>

                        {importFile && (
                            <div className="text-sm bg-gray-50 p-2 rounded border">
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
                                <div className="flex justify-between text-sm">
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
                            <div className="max-h-32 overflow-y-auto">
                                <p className="text-sm font-medium text-red-600 mb-1">
                                    Errors ({importProgress.errors.length}):
                                </p>
                                <div className="text-xs space-y-1 bg-red-50 p-2 rounded border border-red-200">
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
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white disabled:bg-gray-300 text-sm px-3 py-1.5"
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
                        <p className="text-sm text-gray-600 mb-2">
                            Are you sure you want to delete all{" "}
                            {classroomTypes.length} classroom types?
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
                            onClick={handleClearAllClassroomTypes}
                            className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5"
                        >
                            Delete All
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
