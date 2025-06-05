"use client";

import type { Instructor, InstructorFormData } from "@/app/types";
import CustomPagination from "@/components/custom/pagination"; // Importing the Pagination component
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
import type React from "react";
import { useEffect, useState } from "react";
import Papa from 'papaparse';

const ITEMS_PER_PAGE = 10; // Define how many items to show per page

export default function InstructorsView() {
    const [instructors, setInstructors] = useState<Instructor[]>([]);
   
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);
    const [selectedInstructor, setSelectedInstructor] =
        useState<Instructor | null>(null);
    const [formData, setFormData] = useState<InstructorFormData>({
        first_name: "",
        last_name: "",
        gender: "",
        email: "",
        phone_number: "",
    });
    const [currentPage, setCurrentPage] = useState(1); // Add current page state

    // Fetch instructors from API
    const fetchInstructors = async () => {
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/instructors/?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch instructors");
            }
            const data = await response.json();
            setInstructors(data);
            // Reset to first page when data changes
            setCurrentPage(1);
        } catch (error) {
            console.error("Error fetching instructors:", error);
            setStatusMessage({
                text: "Failed to load instructors. Please try again.",
                type: "error",
            });
        }
    };

    // Add these to your existing state variables
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
interface CSVInstructorRow {
    first_name: string;
    last_name: string;
    gender: string;
    email: string;
    phone_number: string;
}
// Validation function
const validateInstructorData = (row: any, rowIndex: number): CSVInstructorRow | string => {
    const errors: string[] = [];
    
    // Check required fields
    if (!row.first_name || typeof row.first_name !== 'string' || row.first_name.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: First name is required`);
    }
    
    if (!row.last_name || typeof row.last_name !== 'string' || row.last_name.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Last name is required`);
    }
    
    if (!row.email || typeof row.email !== 'string' || row.email.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Email is required`);
    } else {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row.email.trim())) {
            errors.push(`Row ${rowIndex + 1}: Invalid email format`);
        }
    }
    
    if (!row.gender || typeof row.gender !== 'string' || row.gender.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Gender is required`);
    } else {
        const validGenders = ['Male', 'Female', 'male', 'female'];
        if (!validGenders.includes(row.gender.trim())) {
            errors.push(`Row ${rowIndex + 1}: Gender must be 'Male' or 'Female'`);
        }
    }
    
    if (row.phone_number && typeof row.phone_number !== 'string') {
        errors.push(`Row ${rowIndex + 1}: Phone number must be a string`);
    }
    
    if (errors.length > 0) {
        return errors.join(', ');
    }
    
    // Return cleaned data
    return {
        first_name: row.first_name.trim(),
        last_name: row.last_name.trim(),
        gender: row.gender.trim().charAt(0).toUpperCase() + row.gender.trim().slice(1).toLowerCase(), // Normalize to "Male" or "Female"
        email: row.email.trim().toLowerCase(),
        phone_number: row.phone_number ? row.phone_number.trim() : '',
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
            transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
            complete: async (results) => {
                const csvData = results.data as any[];
                const validInstructors: CSVInstructorRow[] = [];
                const errors: string[] = [];

                // Validate each row
                csvData.forEach((row, index) => {
                    const validationResult = validateInstructorData(row, index);
                    if (typeof validationResult === 'string') {
                        errors.push(validationResult);
                    } else {
                        validInstructors.push(validationResult);
                    }
                });

                setImportProgress(prev => ({
                    ...prev,
                    total: validInstructors.length,
                    errors: errors,
                }));

                if (validInstructors.length === 0) {
                    setStatusMessage({
                        text: "No valid instructors found in the CSV file",
                        type: "error",
                    });
                    setImportProgress(prev => ({ ...prev, isImporting: false }));
                    return;
                }

                // Import valid instructors
                let completed = 0;
                const importErrors: string[] = [...errors];

                for (const instructor of validInstructors) {
                    try {
                        const apiData = {
                            firstName: instructor.first_name,
                            lastName: instructor.last_name,
                            gender: instructor.gender,
                            email: instructor.email,
                            phoneNumber: instructor.phone_number,
                            scheduleId: Number(scheduleId),
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
                                `Failed to import ${instructor.first_name} ${instructor.last_name}: ${
                                    errorData.error || 'Unknown error'
                                }`
                            );
                        } else {
                            completed++;
                        }
                    } catch (error) {
                        importErrors.push(
                            `Failed to import ${instructor.first_name} ${instructor.last_name}: ${
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
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Final update
                setImportProgress(prev => ({ ...prev, isImporting: false }));

                // Refresh the instructor list
                await fetchInstructors();

                // Show completion message
                if (completed > 0) {
                    setStatusMessage({
                        text: `Successfully imported ${completed} instructor(s)${
                            importErrors.length > 0 ? ` with ${importErrors.length} error(s)` : ''
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
                setImportProgress(prev => ({ ...prev, isImporting: false }));
            },
        });
    } catch (error) {
        console.error("Import error:", error);
        setStatusMessage({
            text: "Failed to import instructors. Please try again.",
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

// Download CSV with current instructors data
const downloadInstructorsCSV = () => {
    // Create CSV header
    const headers = ['first_name', 'last_name', 'gender', 'email', 'phone_number'];
    
    // Convert instructors data to CSV rows
    const csvRows = instructors.map(instructor => [
        instructor.first_name,
        instructor.last_name,
        instructor.gender,
        instructor.email,
        instructor.phone_number || ''
    ]);
    
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
    link.setAttribute('download', `instructors_export_${today}.csv`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setStatusMessage({
        text: `Exported ${instructors.length} instructors to CSV`,
        type: "success",
    });
};

// Download empty CSV template for new imports
const downloadEmptyTemplate = () => {
    const csvContent = `first_name,last_name,gender,email,phone_number
John,Smith,Male,john.smith@email.com,555-123-4567
Jane,Doe,Female,jane.doe@email.com,555-987-6543`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'instructors_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const params = useParams();

    const handleAddInstructor = async () => {
        try {
            // Prepare data for API
            const scheduleId = params.id;
            const apiData = {
                firstName: formData.first_name,
                lastName: formData.last_name,
                gender: formData.gender,
                email: formData.email,
                phoneNumber: formData.phone_number,
                scheduleId: Number(scheduleId),
            };

            const response = await fetch("/api/instructors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                throw new Error("Failed to create instructor");
            }

            // Refresh the instructor list
            await fetchInstructors();

            // Close dialog and reset form
            setIsAddDialogOpen(false);
            resetForm();

            setStatusMessage({
                text: "Instructor added successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error adding instructor:", error);
            setStatusMessage({
                text: "Failed to add instructor. Please try again.",
                type: "error",
            });
        }
    };

    const handleEditInstructor = async () => {
        if (!selectedInstructor) return;

        try {
            const apiData = {
                id: selectedInstructor.id,
                firstName: formData.first_name,
                lastName: formData.last_name,
                gender: formData.gender,
                email: formData.email,
                phoneNumber: formData.phone_number,
            };

            console.log("Sending update data:", apiData);

            const response = await fetch("/api/instructors", {
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
                    responseData.error || "Failed to update instructor"
                );
            }

            console.log("Update successful:", responseData);

            await fetchInstructors();
            setIsEditDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Instructor updated successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error updating instructor:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to update instructor. Please try again.",
                type: "error",
            });
        }
    };
    const handleDeleteInstructor = async () => {
        if (!selectedInstructor) return;

        try {
            const apiData = {
                id: selectedInstructor.id,
            };
            const response = await fetch("/api/instructors", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                throw new Error("Failed to delete instructor");
            }

            // Refresh the instructor list
            await fetchInstructors();

            // Close dialog
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

    const resetForm = () => {
        setFormData({
            first_name: "",
            last_name: "",
            gender: "",
            email: "",
            phone_number: "",
        });
        setSelectedInstructor(null);
    };

    const openEditDialog = (instructor: Instructor) => {
        resetForm(); // Reset first to clear any previous data
        setSelectedInstructor(instructor);
        setFormData({
            first_name: instructor.first_name,
            last_name: instructor.last_name,
            gender: instructor.gender,
            email: instructor.email,
            phone_number: instructor.phone_number,
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (instructor: Instructor) => {
        setSelectedInstructor(instructor);
        setIsDeleteDialogOpen(true);
    };

    // Function to handle opening the add dialog
    const openAddDialog = () => {
        resetForm(); // Ensure form is clean before opening
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
    <h2 className="text-xl font-bold">Instructors</h2>
    <div className="flex gap-2">
        <Button
            onClick={downloadInstructorsCSV}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
            disabled={instructors.length === 0}
        >
            <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
        <Button
            onClick={() => setIsImportDialogOpen(true)}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
        >
            <Upload className="mr-2 h-4 w-4" /> Import CSV
        </Button>
        <Button
            onClick={openAddDialog}
            className="bg-green-600 hover:bg-green-700"
        >
            <Plus className="mr-2 h-4 w-4" /> New Instructor
        </Button>
    </div>
</div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border p-2 bg-gray-100 text-left">
                                ID
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                FIRST NAME
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                LAST NAME
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                GENDER
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                EMAIL
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                PHONE
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {instructors.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="border p-4 text-center"
                                >
                                    No instructors found. Add a new instructor
                                    to get started.
                                </td>
                            </tr>
                        ) : (
                            paginatedInstructors.map((instructor) => (
                                <tr key={instructor.id}>
                                    <td className="border p-2">
                                        {instructor.id}
                                    </td>
                                    <td className="border p-2">
                                        {instructor.first_name}
                                    </td>
                                    <td className="border p-2">
                                        {instructor.last_name}
                                    </td>
                                    <td className="border p-2">
                                        {instructor.gender}
                                    </td>
                                    <td className="border p-2">
                                        {instructor.email}
                                    </td>
                                    <td className="border p-2">
                                        {instructor.phone_number}
                                    </td>
                                    <td className="border p-2">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    openEditDialog(instructor)
                                                }
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    openDeleteDialog(instructor)
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

            {/* Add pagination if we have instructors */}
            {instructors.length > 0 && (
                <CustomPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}

            {/* Add Instructor Dialog */}
            <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsAddDialogOpen(open);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Instructor</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="first_name">First Name</Label>
                                <Input
                                    id="first_name"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input
                                    id="last_name"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) =>
                                    handleSelectChange("gender", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">
                                        Female
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone_number">Phone</Label>
                            <Input
                                id="phone_number"
                                name="phone_number"
                                value={formData.phone_number}
                                onChange={handleInputChange}
                            />
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
                        <Button onClick={handleAddInstructor}>
                            Add Instructor
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Instructor</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-first_name">
                                    First Name
                                </Label>
                                <Input
                                    id="edit-first_name"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-last_name">
                                    Last Name
                                </Label>
                                <Input
                                    id="edit-last_name"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-gender">Gender</Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) =>
                                    handleSelectChange("gender", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">
                                        Female
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                                id="edit-email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-phone_number">Phone</Label>
                            <Input
                                id="edit-phone_number"
                                name="phone_number"
                                value={formData.phone_number}
                                onChange={handleInputChange}
                            />
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
                        <Button onClick={handleEditInstructor}>
                            Save Changes
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Instructor</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>Are you sure you want to delete this instructor?</p>
                        <p className="font-medium mt-2">
                            {selectedInstructor?.first_name}{" "}
                            {selectedInstructor?.last_name}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedInstructor(null);
                                setIsDeleteDialogOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteInstructor}
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
    <DialogContent className="max-w-md">
        <DialogHeader>
            <DialogTitle>Import Instructors from CSV</DialogTitle>
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
            CSV should contain columns: first_name, last_name, gender, email, phone_number
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
                <div className="max-h-32 overflow-y-auto">
                    <p className="text-sm font-medium text-red-600 mb-1">Errors:</p>
                    <div className="text-xs space-y-1">
                        {importProgress.errors.map((error, index) => (
                            <p key={index} className="text-red-600">{error}</p>
                        ))}
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
