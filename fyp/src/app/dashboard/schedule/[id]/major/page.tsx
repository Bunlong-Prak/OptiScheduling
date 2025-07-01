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
import { Download, Pencil, Plus, Trash, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import { useEffect, useState } from "react";

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

export default function MajorView() {
    const [majors, setMajors] = useState<Major[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);
    const [selectedMajor, setSelectedMajor] = useState<Major | null>(null);
    const [formData, setFormData] = useState<MajorFormData>({
        name: "",
        shortTag: "",
    });
    const [currentPage, setCurrentPage] = useState(1);
    const params = useParams();

    // Load majors on component mount
    useEffect(() => {
        fetchMajors();
    }, [params]); // Add params as a dependency since it's used in fetchMajors

    // Clear status message after 5 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    // Calculate pagination values
    const totalPages = Math.ceil(majors.length / ITEMS_PER_PAGE);
    const paginatedMajors = majors.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Fetch majors
    const fetchMajors = async () => {
        try {
            const scheduleId = params.id;
            if (!scheduleId) {
                console.error("Schedule ID is undefined");
                setStatusMessage({
                    text: "Missing schedule ID. Please check the URL.",
                    type: "error",
                });
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
                setStatusMessage({
                    text: "Invalid data format received from server.",
                    type: "error",
                });
                return;
            }

            setMajors(data);
            setCurrentPage(1);
        } catch (error: unknown) {
            console.error("Error fetching majors:", error);
            setStatusMessage({
                text: `Failed to load majors: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                type: "error",
            });
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const openAddDialog = () => {
        resetForm();
        setIsAddDialogOpen(true);
    };

    const handleAddMajor = async () => {
        try {
            const scheduleId = params.id;
            if (!scheduleId) {
                throw new Error("Schedule ID is missing");
            }

            if (!formData.name || !formData.shortTag) {
                setStatusMessage({
                    text: "Name and short tag are required",
                    type: "error",
                });
                return;
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
            setStatusMessage({
                text: "Major added successfully",
                type: "success",
            });
        } catch (error: unknown) {
            console.error("Error adding major:", error);
            setStatusMessage({
                text: `Failed to add major: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                type: "error",
            });
        }
    };

    const handleEditMajor = async () => {
        if (!selectedMajor || !selectedMajor.id) {
            setStatusMessage({
                text: "No major selected for editing.",
                type: "error",
            });
            return;
        }

        try {
            if (!formData.name || !formData.shortTag) {
                setStatusMessage({
                    text: "Name and short tag are required",
                    type: "error",
                });
                return;
            }

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
            setStatusMessage({
                text: "Major updated successfully",
                type: "success",
            });
        } catch (error: unknown) {
            console.error("Error updating major:", error);
            setStatusMessage({
                text: `Failed to update major: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                type: "error",
            });
        }
    };

    const handleDeleteMajor = async () => {
        if (!selectedMajor || !selectedMajor.id) {
            setStatusMessage({
                text: "No major selected for deletion.",
                type: "error",
            });
            return;
        }

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
            setStatusMessage({
                text: `Major "${selectedMajor.name}" deleted successfully.`,
                type: "success",
            });
        } catch (error: unknown) {
            console.error("Error deleting major:", error);
            setStatusMessage({
                text: `Failed to delete major: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                type: "error",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            shortTag: "",
        });
        setSelectedMajor(null);
    };

    const openEditDialog = (major: Major) => {
        resetForm();
        setSelectedMajor(major);
        setFormData({
            name: major.name,
            shortTag: major.shortTag,
        });
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
                        setStatusMessage({
                            text: "No valid majors found in the CSV file",
                            type: "error",
                        });
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
                        setStatusMessage({
                            text: `Successfully imported ${completed} major(s)${
                                importErrors.length > 0
                                    ? ` with ${importErrors.length} error(s)`
                                    : ""
                            }`,
                            type:
                                completed === validMajors.length
                                    ? "success"
                                    : "error",
                        });
                    } else {
                        setStatusMessage({
                            text: "Failed to import any majors",
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
                text: "Failed to import majors. Please try again.",
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

    // Download CSV with current majors data
    const downloadMajorsCSV = () => {
        try {
            // Create CSV header
            const headers = ["name", "short_tag"];

            // Convert majors data to CSV rows
            const csvRows = majors.map((major) => [major.name, major.shortTag]);

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

            setStatusMessage({
                text: `Exported ${majors.length} majors to CSV`,
                type: "success",
            });
        } catch (error) {
            console.error("Error exporting CSV:", error);
            setStatusMessage({
                text: "Failed to export majors. Please try again.",
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
                </div>
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
                                            <div>No majors found</div>
                                            <div className="text-xs">
                                                Add a new major to get started.
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
                                                        openEditDialog(major)
                                                    }
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() =>
                                                        openDeleteDialog(major)
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
            {majors.length > 0 && (
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
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                            />
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
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                            />
                            <span className="text-xs text-gray-500">
                                Enter a short code for the major (e.g., CS for
                                Computer Science).
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
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
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
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                            />
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
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                            />
                            <span className="text-xs text-gray-500">
                                Enter a short code for the major (e.g., CS for
                                Computer Science).
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
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
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
