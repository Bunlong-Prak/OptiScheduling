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
import { Download, Pencil, Plus, Trash, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import type React from "react";
import { useEffect, useState } from "react";

interface ClassroomType {
    id: number;
    name: string;
}

interface FormErrors {
    code?: string;
    type?: string;
    capacity?: string;
}

const ITEMS_PER_PAGE = 20;

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
        code: "",
        type: "",
        capacity: "",
    });
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isTypesLoading, setIsTypesLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error" | "info";
    } | null>(null);
    const params = useParams();

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
        } finally {
            setIsTypesLoading(false);
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
            setStatusMessage({
                text: "Failed to load classrooms. Please try again.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClassrooms();
        fetchClassroomTypes();
    }, []);

    // Clear status message after 3 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage(null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

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
            setStatusMessage({
                text: "Classroom added successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error adding classroom:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to add classroom. Please try again.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClassroom = async () => {
        if (!selectedClassroom || !validateForm(true)) {
            return;
        }

        setIsLoading(true);
        try {
            const scheduleId = params.id;

            const apiData = {
                id: selectedClassroom.id,
                code: formData.code.trim(),
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
            setStatusMessage({
                text: "Classroom updated successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error updating classroom:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to update classroom. Please try again.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClassroom = async () => {
        if (!selectedClassroom) return;

        setIsLoading(true);
        try {
            const scheduleId = params.id;

            const apiData = {
                id: selectedClassroom.id,
                scheduleId: scheduleId,
            };

            const response = await fetch(`/api/classrooms/`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to delete classroom"
                );
            }

            await fetchClassrooms();
            setIsDeleteDialogOpen(false);
            setStatusMessage({
                text: "Classroom deleted successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error deleting classroom:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete classroom. Please try again.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            code: "",
            type: "",
            capacity: "",
        });
        setFormErrors({});
        setSelectedClassroom(null);
    };

    const openEditDialog = (classroom: Classroom) => {
        setSelectedClassroom(classroom);
        setFormData({
            code: classroom.code,
            type: classroom.type,
            capacity: classroom.capacity.toString(),
        });
        setFormErrors({});
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (classroom: Classroom) => {
        setSelectedClassroom(classroom);
        setIsDeleteDialogOpen(true);
    };

    const totalPages = Math.ceil(sortedClassrooms.length / ITEMS_PER_PAGE);
    const paginatedClassrooms = sortedClassrooms.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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
            type: row.type.trim(),
            capacity: row.capacity.toString(),
        };
    };

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
                        setStatusMessage({
                            text: "No valid classrooms found in the CSV file",
                            type: "error",
                        });
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
                            setTimeout(resolve, 100)
                        );
                    }

                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));
                    await fetchClassrooms();

                    if (completed > 0) {
                        setStatusMessage({
                            text: `Successfully imported ${completed} classroom(s)${
                                importErrors.length > 0
                                    ? ` with ${importErrors.length} error(s)`
                                    : ""
                            }`,
                            type:
                                completed === validClassrooms.length
                                    ? "success"
                                    : "error",
                        });
                    } else {
                        setStatusMessage({
                            text: "Failed to import any classrooms",
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
                text: "Failed to import classrooms. Please try again.",
                type: "error",
            });
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImportFile(file);
        } else {
            setStatusMessage({
                text: "Please select a valid CSV file",
                type: "error",
            });
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
            const headers = ["code", "type", "capacity"];

            const csvRows = sortedClassrooms.map((classroom) => [
                classroom.code,
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

            setStatusMessage({
                text: `Exported ${sortedClassrooms.length} classrooms to CSV`,
                type: "success",
            });
        } catch (error) {
            console.error("Error exporting CSV:", error);
            setStatusMessage({
                text: "Failed to export classrooms. Please try again.",
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
                            : statusMessage.type === "error"
                            ? "bg-red-50 text-red-800 border-red-200"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                    }`}
                >
                    {statusMessage.text}
                </div>
            )}

            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Classrooms
                    </h2>
                    <p className="text-xs text-gray-600">
                        Manage classroom details and capacity (sorted by room
                        number)
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
                        disabled={sortedClassrooms.length === 0 || isLoading}
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
                                    Code
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
                                        colSpan={5}
                                        className="px-3 py-8 text-center text-gray-500 text-sm"
                                    >
                                        Loading...
                                    </td>
                                </tr>
                            ) : paginatedClassrooms.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-3 py-8 text-center text-gray-500 text-sm"
                                    >
                                        <div className="space-y-1">
                                            <div>No classrooms found</div>
                                            <div className="text-xs">
                                                Add a new classroom to get
                                                started.
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedClassrooms.map((classroom, index) => (
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {sortedClassrooms.length > 0 && (
                <div className="flex justify-center">
                    <CustomPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}

            {/* Add Classroom Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : ""
                                }`}
                                placeholder="Enter classroom code (e.g., 101, 119)"
                            />
                            {formErrors.code && (
                                <p className="text-xs text-red-600">
                                    {formErrors.code}
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
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : ""
                                    }`}
                                >
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {isTypesLoading ? (
                                        <SelectItem value="loading" disabled>
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
                                <p className="text-xs text-red-600">
                                    {formErrors.type}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="capacity"
                                className="text-sm font-medium text-gray-700"
                            >
                                Capacity <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="capacity"
                                name="capacity"
                                type="number"
                                value={formData.capacity}
                                onChange={handleInputChange}
                                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                    formErrors.capacity
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : ""
                                }`}
                                placeholder="Enter capacity (1-100)"
                                min="1"
                                max="100"
                            />
                            {formErrors.capacity && (
                                <p className="text-xs text-red-600">
                                    {formErrors.capacity}
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="border-t border-gray-200 pt-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsAddDialogOpen(false);
                                resetForm();
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
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                        >
                            {isLoading ? "Adding..." : "Add"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Classroom Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="bg-white max-w-md">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Edit Classroom
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
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
                                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                    formErrors.code
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : ""
                                }`}
                                placeholder="Enter classroom code (e.g., 101, 2A1)"
                            />
                            {formErrors.code && (
                                <p className="text-xs text-red-600">
                                    {formErrors.code}
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
                            >
                                <SelectTrigger
                                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                        formErrors.type
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : ""
                                    }`}
                                >
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {isTypesLoading ? (
                                        <SelectItem value="loading" disabled>
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
                                <p className="text-xs text-red-600">
                                    {formErrors.type}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="edit-capacity"
                                className="text-sm font-medium text-gray-700"
                            >
                                Capacity <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="edit-capacity"
                                name="capacity"
                                type="number"
                                value={formData.capacity}
                                onChange={handleInputChange}
                                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                    formErrors.capacity
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : ""
                                }`}
                                placeholder="Enter capacity (1-100)"
                                min="1"
                                max="100"
                            />
                            {formErrors.capacity && (
                                <p className="text-xs text-red-600">
                                    {formErrors.capacity}
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="border-t border-gray-200 pt-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsEditDialogOpen(false);
                                resetForm();
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
                                )
                            }
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                        >
                            {isLoading ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Classroom Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <DialogContent className="bg-white max-w-md">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Delete Classroom
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p className="text-sm text-gray-600 mb-2">
                            Are you sure you want to delete this classroom?
                        </p>
                        <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                            {selectedClassroom?.code} ({selectedClassroom?.type}
                            )
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            This action cannot be undone.
                        </p>
                    </div>

                    <DialogFooter className="border-t border-gray-200 pt-3">
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isLoading}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeleteClassroom}
                            disabled={isLoading}
                            className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5"
                        >
                            {isLoading ? "Deleting..." : "Delete"}
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
                                CSV should contain columns: code, type, capacity
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
