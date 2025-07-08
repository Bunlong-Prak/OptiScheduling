"use client";

import type { Instructor, InstructorFormData } from "@/app/types";
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
    instructorSchema,
    validateAgainstExistingEmails,
    validateInstructorsWithUniqueEmails,
} from "@/lib/validations/instructors";
import { Download, Pencil, Plus, Trash, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import type React from "react";
import { useEffect, useState } from "react";
import { z } from "zod";

const ITEMS_PER_PAGE = 20;

export default function InstructorsView() {
    const params = useParams();
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);
    const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
    const [formData, setFormData] = useState<InstructorFormData>({
        instructor_id: "",
        first_name: "",
        last_name: "",
        gender: "",
        email: "",
        phone_number: "",
    });
    const [currentPage, setCurrentPage] = useState(1);

    // Import state
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

    // Fetch instructors from API
    const fetchInstructors = async () => {
        try {
            const scheduleId = params.id;
            const response = await fetch(`/api/instructors/?scheduleId=${scheduleId}`);
            if (!response.ok) {
                throw new Error("Failed to fetch instructors");
            }
            const data = await response.json();
            setInstructors(data);
            setCurrentPage(1);
        } catch (error) {
            console.error("Error fetching instructors:", error);
            setStatusMessage({
                text: "Failed to load instructors. Please try again.",
                type: "error",
            });
        }
    };

    // Load instructors on component mount
    useEffect(() => {
        fetchInstructors();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    // FIXED: Add Instructor with consistent field mapping
    const handleAddInstructor = async () => {
        try {
            // Validate form data with Zod
            const validatedData = instructorSchema.parse({
                first_name: formData.first_name,
                last_name: formData.last_name,
                gender: formData.gender,
                email: formData.email,
                phone_number: formData.phone_number,
            });

            // Check if email already exists
            const existingInstructor = instructors.find(
                (instructor) =>
                    instructor.email === validatedData.email
            );

            if (existingInstructor) {
                setStatusMessage({
                    text: "An instructor with this email already exists",
                    type: "error",
                });
                return;
            }

            const scheduleId = params.id;
            // FIXED: Consistent API data structure
            const apiData = {
                instructor_id: formData.instructor_id || "", // Include instructor_id
                first_name: validatedData.first_name,
                last_name: validatedData.last_name,
                gender: validatedData.gender,
                email: validatedData.email,
                phone_number: validatedData.phone_number || "",
                schedule_id: Number(scheduleId), // Use schedule_id to match database
            };

            const response = await fetch("/api/instructors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create instructor");
            }

            await fetchInstructors();
            setIsAddDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Instructor added successfully",
                type: "success",
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorMessage = error.errors
                    .map((err) => `${err.path.join(".")}: ${err.message}`)
                    .join(", ");
                setStatusMessage({
                    text: `Validation error: ${errorMessage}`,
                    type: "error",
                });
            } else {
                console.error("Error adding instructor:", error);
                setStatusMessage({
                    text: error instanceof Error ? error.message : "Failed to add instructor. Please try again.",
                    type: "error",
                });
            }
        }
    };

    // FIXED: Edit Instructor with consistent field mapping
    const handleEditInstructor = async () => {
        if (!selectedInstructor) return;

        try {
            // Validate form data with Zod
            const validatedData = instructorSchema.parse({
                first_name: formData.first_name,
                last_name: formData.last_name,
                gender: formData.gender,
                email: formData.email,
                phone_number: formData.phone_number,
            });

            // Check if email already exists (excluding current instructor)
            const existingInstructor = instructors.find(
                (instructor) =>
                    instructor.email === validatedData.email&&
                    instructor.id !== selectedInstructor.id
            );

            if (existingInstructor) {
                setStatusMessage({
                    text: "Another instructor with this email already exists",
                    type: "error",
                });
                return;
            }

            // FIXED: Consistent API data structure
            const apiData = {
                id: selectedInstructor.id,
                instructor_id: formData.instructor_id,
                first_name: validatedData.first_name,
                last_name: validatedData.last_name,
                gender: validatedData.gender,
                email: validatedData.email,
                phone_number: validatedData.phone_number || "",
            };

            const response = await fetch("/api/instructors", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update instructor");
            }

            await fetchInstructors();
            setIsEditDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Instructor updated successfully",
                type: "success",
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorMessage = error.errors
                    .map((err) => `${err.path.join(".")}: ${err.message}`)
                    .join(", ");
                setStatusMessage({
                    text: `Validation error: ${errorMessage}`,
                    type: "error",
                });
            } else {
                console.error("Error updating instructor:", error);
                setStatusMessage({
                    text: error instanceof Error ? error.message : "Failed to update instructor. Please try again.",
                    type: "error",
                });
            }
        }
    };

    const handleDeleteInstructor = async () => {
        if (!selectedInstructor) return;

        try {
            const response = await fetch("/api/instructors", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id: selectedInstructor.id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete instructor");
            }

            await fetchInstructors();
            setIsDeleteDialogOpen(false);
            setSelectedInstructor(null);
            setStatusMessage({
                text: "Instructor deleted successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error deleting instructor:", error);
            setStatusMessage({
                text: "Failed to delete instructor. Please try again.",
                type: "error",
            });
        }
    };

    // FIXED: Import CSV function with proper validation and field mapping
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
                transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
                complete: async (results) => {
                    const csvData = results.data as any[];
                    
                    // Manual validation for CSV data
                    const validInstructors: any[] = [];
                    const errors: string[] = [];

                    for (let i = 0; i < csvData.length; i++) {
                        const row = csvData[i];
                        const rowNumber = i + 1;

                        // Validate required fields
                        if (!row.first_name?.trim()) {
                            errors.push(`Row ${rowNumber}: First name is required`);
                            continue;
                        }
                        if (!row.last_name?.trim()) {
                            errors.push(`Row ${rowNumber}: Last name is required`);
                            continue;
                        }
                        if (!row.email?.trim()) {
                            errors.push(`Row ${rowNumber}: Email is required`);
                            continue;
                        }
                        if (!row.gender?.trim()) {
                            errors.push(`Row ${rowNumber}: Gender is required`);
                            continue;
                        }

                        // Validate email format
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(row.email.trim())) {
                            errors.push(`Row ${rowNumber}: Invalid email format`);
                            continue;
                        }

                        // Validate gender
                        const validGenders = ["Male", "Female", "male", "female"];
                        if (!validGenders.includes(row.gender.trim())) {
                            errors.push(`Row ${rowNumber}: Gender must be 'Male' or 'Female'`);
                            continue;
                        }

                        // Check for duplicate emails in CSV
                        const duplicateInCsv = validInstructors.find(
                            (existing) => existing.email=== row.email.trim()
                        );
                        if (duplicateInCsv) {
                            errors.push(`Row ${rowNumber}: Duplicate email in CSV: ${row.email}`);
                            continue;
                        }

                        // Check against existing instructors
                        const existingInstructor = instructors.find(
                            (instructor) => instructor.email === row.email.trim()
                        );
                        if (existingInstructor) {
                            errors.push(`Row ${rowNumber}: Email already exists in system: ${row.email}`);
                            continue;
                        }

                        // Add valid instructor
                        validInstructors.push({
                            instructor_id: row.instructor_id?.trim() || "",
                            first_name: row.first_name.trim(),
                            last_name: row.last_name.trim(),
                            gender: row.gender.trim().charAt(0).toUpperCase() + row.gender.trim().slice(1).toLowerCase(),
                            email: row.email.trim(),
                            phone_number: row.phone_number?.trim() || "",
                        });
                    }

                    setImportProgress((prev) => ({
                        ...prev,
                        total: validInstructors.length,
                        errors,
                    }));

                    if (validInstructors.length === 0) {
                        setStatusMessage({
                            text: "No valid instructors found in the CSV file",
                            type: "error",
                        });
                        setImportProgress((prev) => ({ ...prev, isImporting: false }));
                        return;
                    }

                    // Import valid instructors
                    let completed = 0;
                    const importErrors: string[] = [...errors];

                    for (const instructor of validInstructors) {
                        try {
                            const apiData = {
                                instructor_id: instructor.instructor_id,
                                first_name: instructor.first_name,
                                last_name: instructor.last_name,
                                gender: instructor.gender,
                                email: instructor.email,
                                phone_number: instructor.phone_number,
                                schedule_id: Number(scheduleId),
                            };

                            const response = await fetch("/api/instructors", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(apiData),
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                importErrors.push(
                                    `Failed to import ${instructor.first_name} ${instructor.last_name}: ${errorData.error || "Unknown error"}`
                                );
                            } else {
                                completed++;
                            }
                        } catch (error) {
                            importErrors.push(
                                `Failed to import ${instructor.first_name} ${instructor.last_name}: ${
                                    error instanceof Error ? error.message : "Unknown error"
                                }`
                            );
                        }

                        setImportProgress((prev) => ({
                            ...prev,
                            completed: completed,
                            errors: importErrors,
                        }));

                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }

                    setImportProgress((prev) => ({ ...prev, isImporting: false }));
                    await fetchInstructors();

                    if (completed > 0) {
                        setStatusMessage({
                            text: `Successfully imported ${completed} instructor(s)${
                                importErrors.length > 0 ? ` with ${importErrors.length} error(s)` : ""
                            }`,
                            type: completed === validInstructors.length ? "success" : "error",
                        });
                    } else {
                        setStatusMessage({
                            text: "Failed to import any instructors",
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
                    setImportProgress((prev) => ({ ...prev, isImporting: false }));
                },
            });
        } catch (error) {
            console.error("Import error:", error);
            setStatusMessage({
                text: "Failed to import instructors. Please try again.",
                type: "error",
            });
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
        }
    };

    // FIXED: Export CSV function with all fields
    const downloadInstructorsCSV = () => {
        // FIXED: Include all fields including instructor_id
        const headers = [
            "instructor_id",
            "first_name", 
            "last_name",
            "gender",
            "email",
            "phone_number",
        ];

        const csvRows = instructors.map((instructor) => [
            instructor.instructor_id || "",
            instructor.first_name,
            instructor.last_name,
            instructor.gender,
            instructor.email,
            instructor.phone_number || "",
        ]);

        const allRows = [headers, ...csvRows];
        const csvContent = allRows
            .map((row) =>
                row
                    .map((field) => {
                        const fieldStr = String(field || "");
                        if (fieldStr.includes(",") || fieldStr.includes('"') || fieldStr.includes("\n")) {
                            return `"${fieldStr.replace(/"/g, '""')}"`;
                        }
                        return fieldStr;
                    })
                    .join(",")
            )
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);

        const today = new Date().toISOString().split("T")[0];
        link.setAttribute("download", `instructors_export_${today}.csv`);

        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setStatusMessage({
            text: `Exported ${instructors.length} instructors to CSV`,
            type: "success",
        });
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
                setStatusMessage({
                    text: "Please select a valid CSV file",
                    type: "error",
                });
                event.target.value = "";
                return;
            }
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

    const resetForm = () => {
        setFormData({
            instructor_id: "",
            first_name: "",
            last_name: "",
            gender: "",
            email: "",
            phone_number: "",
        });
        setSelectedInstructor(null);
    };

    // FIXED: Include instructor_id in edit dialog
    const openEditDialog = (instructor: Instructor) => {
        resetForm();
        setSelectedInstructor(instructor);
        setFormData({
            instructor_id: instructor.instructor_id || "",
            first_name: instructor.first_name,
            last_name: instructor.last_name,
            gender: instructor.gender,
            email: instructor.email,
            phone_number: instructor.phone_number || "",
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (instructor: Instructor) => {
        setSelectedInstructor(instructor);
        setIsDeleteDialogOpen(true);
    };

    const openAddDialog = () => {
        resetForm();
        setIsAddDialogOpen(true);
    };

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
    const totalPages = Math.ceil(instructors.length / ITEMS_PER_PAGE);
    const paginatedInstructors = instructors.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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
                    <h2 className="text-lg font-semibold text-gray-900">Instructors</h2>
                    <p className="text-xs text-gray-600">Manage instructor information and details</p>
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
                        onClick={downloadInstructorsCSV}
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-3 py-1.5 rounded-md"
                        disabled={instructors.length === 0}
                    >
                        <Download className="mr-1 h-3 w-3" /> Export CSV
                    </Button>
                    <Button
                        onClick={openAddDialog}
                        className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                    >
                        <Plus className="mr-1 h-3 w-3" /> New Instructor
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[#2F2F85] text-white">
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">No.</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Instructor ID</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">First Name</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Last Name</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-20">Gender</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Email</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Phone</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-20">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {instructors.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-sm">
                                        <div className="space-y-1">
                                            <div>No instructors found</div>
                                            <div className="text-xs">Add a new instructor to get started.</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedInstructors.map((instructor, index) => (
                                    <tr
                                        key={instructor.id}
                                        className={`hover:bg-gray-50 transition-colors ${
                                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                                        }`}
                                    >
                                        <td className="px-3 py-2 text-xs text-gray-600 font-medium">
                                            {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                        </td>
                                        <td className="px-3 py-2 text-xs font-medium text-gray-900">
                                            {instructor.instructor_id || "-"}
                                        </td>
                                        <td className="px-3 py-2 text-xs font-medium text-gray-900">{instructor.first_name}</td>
                                        <td className="px-3 py-2 text-xs font-medium text-gray-900">{instructor.last_name}</td>
                                        <td className="px-3 py-2 text-xs text-gray-900">{instructor.gender}</td>
                                        <td className="px-3 py-2 text-xs text-gray-900">{instructor.email}</td>
                                        <td className="px-3 py-2 text-xs text-gray-900">{instructor.phone_number || "-"}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-gray-500 hover:text-[#2F2F85] hover:bg-gray-100"
                                                    onClick={() => openEditDialog(instructor)}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => openDeleteDialog(instructor)}
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
            {instructors.length > 0 && (
                <div className="flex justify-center">
                    <CustomPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}

            {/* Add Instructor Dialog */}
            <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsAddDialogOpen(open);
                }}
            >
                <DialogContent className="bg-white max-w-lg">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">Add New Instructor</DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="instructor_id" className="text-sm font-medium text-gray-700">
                                Instructor ID
                            </Label>
                            <Input
                                id="instructor_id"
                                name="instructor_id"
                                value={formData.instructor_id}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                placeholder="Enter instructor ID (optional)"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">
                                    First Name *
                                </Label>
                                <Input
                                    id="first_name"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                    placeholder="Enter first name"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">
                                    Last Name *
                                </Label>
                                <Input
                                    id="last_name"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                    placeholder="Enter last name"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="gender" className="text-sm font-medium text-gray-700">
                                Gender *
                            </Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) => handleSelectChange("gender", value)}
                            >
                                <SelectTrigger className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm">
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                                Email *
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                placeholder="Enter email address"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone_number" className="text-sm font-medium text-gray-700">
                                Phone Number
                            </Label>
                            <Input
                                id="phone_number"
                                name="phone_number"
                                value={formData.phone_number}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                placeholder="Enter phone number"
                            />
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
                            onClick={handleAddInstructor}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                        >
                            Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Instructor Dialog */}
            <Dialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsEditDialogOpen(open);
                }}
            >
                <DialogContent className="bg-white max-w-lg">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">Edit Instructor</DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-instructor_id" className="text-sm font-medium text-gray-700">
                                Instructor ID
                            </Label>
                            <Input
                                id="edit-instructor_id"
                                name="instructor_id"
                                value={formData.instructor_id}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                placeholder="Enter instructor ID (optional)"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-first_name" className="text-sm font-medium text-gray-700">
                                    First Name *
                                </Label>
                                <Input
                                    id="edit-first_name"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-last_name" className="text-sm font-medium text-gray-700">
                                    Last Name *
                                </Label>
                                <Input
                                    id="edit-last_name"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleInputChange}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-gender" className="text-sm font-medium text-gray-700">
                                Gender *
                            </Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) => handleSelectChange("gender", value)}
                            >
                                <SelectTrigger className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm">
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-email" className="text-sm font-medium text-gray-700">
                                Email *
                            </Label>
                            <Input
                                id="edit-email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-phone_number" className="text-sm font-medium text-gray-700">
                                Phone Number
                            </Label>
                            <Input
                                id="edit-phone_number"
                                name="phone_number"
                                value={formData.phone_number}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                            />
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
                            onClick={handleEditInstructor}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Instructor Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (!open) setSelectedInstructor(null);
                    setIsDeleteDialogOpen(open);
                }}
            >
                <DialogContent className="bg-white max-w-md">
                    <DialogHeader className="border-b border-gray-200 pb-3">
                        <DialogTitle className="text-lg font-semibold text-gray-900">Delete Instructor</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p className="text-sm text-gray-600 mb-2">
                            Are you sure you want to delete this instructor?
                        </p>
                        <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                            {selectedInstructor?.first_name} {selectedInstructor?.last_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">This action cannot be undone.</p>
                    </div>

                    <DialogFooter className="border-t border-gray-200 pt-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedInstructor(null);
                                setIsDeleteDialogOpen(false);
                            }}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeleteInstructor}
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
                            Import Instructors from CSV
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="csv-file" className="text-sm font-medium text-gray-700">
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
                                CSV should contain columns: instructor_id (optional), first_name, last_name, gender, email, phone_number
                            </p>
                        </div>

                        {importFile && (
                            <div className="text-xs bg-gray-50 p-2 rounded border">
                                <p>
                                    <strong>Selected file:</strong> {importFile.name}
                                </p>
                                <p>
                                    <strong>Size:</strong> {(importFile.size / 1024).toFixed(2)} KB
                                </p>
                            </div>
                        )}

                        {importProgress.isImporting && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span>Progress:</span>
                                    <span>
                                        {importProgress.completed} / {importProgress.total}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-[#2F2F85] h-2 rounded-full transition-all duration-300"
                                        style={{
                                            width:
                                                importProgress.total > 0
                                                    ? `${(importProgress.completed / importProgress.total) * 100}%`
                                                    : "0%",
                                        }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {importProgress.errors.length > 0 && (
                            <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded border border-red-200">
                                <p className="text-xs font-medium text-red-600 mb-1">Errors:</p>
                                <div className="text-xs space-y-1">
                                    {importProgress.errors.map((error, index) => (
                                        <p key={index} className="text-red-600">
                                            {error}
                                        </p>
                                    ))}
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
                            {importProgress.isImporting ? "Importing..." : "Import"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}