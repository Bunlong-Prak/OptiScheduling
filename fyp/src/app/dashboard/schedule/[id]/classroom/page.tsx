"use client";

import { Classroom } from "@/app/types";
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
import { Pencil, Plus, Trash } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
// import type { Classroom, ClassroomFormData } from "../../../types;
import { ClassroomFormData } from "@/app/types";
import { useParams } from "next/navigation";
import Papa from 'papaparse';
import { Download, Upload } from "lucide-react";

interface ClassroomType {
    id: number;
    name: string;
}

const ITEMS_PER_PAGE = 10;

export default function ClassroomView() {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
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
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isTypesLoading, setIsTypesLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error" | "info";
    } | null>(null);
    const params = useParams();
    // Fetch classroom types from API
    const fetchClassroomTypes = async () => {
        try {
            setIsTypesLoading(true);
            const scheduleId = params.id; // Assuming scheduleId is passed as a URL parameter
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
            // Removed error status message for initial load
        } finally {
            setIsTypesLoading(false);
        }
    };

    // Fetch classrooms from API
    const fetchClassrooms = async () => {
        setIsLoading(true);
        const scheduleId = params.id; // Assuming scheduleId is passed as a URL parameter
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
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleAddClassroom = async () => {
        setIsLoading(true);
        try {
            const scheduleId = params.id; // Get the current schedule ID
            
            // Prepare data for API - NOW INCLUDING scheduleId
            const apiData = {
                code: formData.code,
                type: formData.type,
                capacity: Number.parseInt(formData.capacity),
                scheduleId: scheduleId, // Add this line!
            };
            
            const response = await fetch("/api/classrooms", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });
            
            if (!response.ok) {
                throw new Error("Failed to create classroom");
            }
            
            // Refresh the classroom list
            await fetchClassrooms();
            // Close dialog and reset form
            setIsAddDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Classroom added successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error adding classroom:", error);
            setStatusMessage({
                text: "Failed to add classroom. Please try again.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEditClassroom = async () => {
        if (!selectedClassroom) return;
    
        setIsLoading(true);
        try {
            const scheduleId = params.id; // Get the current schedule ID
            
            // Prepare data for API - NOW INCLUDING scheduleId
            const apiData = {
                id: selectedClassroom.id,
                code: formData.code,
                type: formData.type,
                capacity: Number.parseInt(formData.capacity),
                scheduleId: scheduleId, // Add this line!
            };
            
            const response = await fetch(`/api/classrooms/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });
            
            if (!response.ok) {
                throw new Error("Failed to update classroom");
            }
            
            // Refresh the classroom list
            await fetchClassrooms();
            // Close dialog and reset form
            setIsEditDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Classroom updated successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error updating classroom:", error);
            setStatusMessage({
                text: "Failed to update classroom. Please try again.",
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
            const scheduleId = params.id; // Get the current schedule ID
            
            const apiData = {
                id: selectedClassroom.id,
                scheduleId: scheduleId, // Add this line!
            };
            
            const response = await fetch(`/api/classrooms/`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });
            
            if (!response.ok) {
                throw new Error("Failed to delete classroom");
            }
            
            // Refresh the classroom list
            await fetchClassrooms();
            // Close dialog
            setIsDeleteDialogOpen(false);
            setStatusMessage({
                text: "Classroom deleted successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error deleting classroom:", error);
            setStatusMessage({
                text: "Failed to delete classroom. Please try again.",
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
        setSelectedClassroom(null);
    };

    const openEditDialog = (classroom: Classroom) => {
        setSelectedClassroom(classroom);
        setFormData({
            code: classroom.code,
            type: classroom.type,
            capacity: classroom.capacity.toString(),
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (classroom: Classroom) => {
        setSelectedClassroom(classroom);
        setIsDeleteDialogOpen(true);
    };

    const totalPages = Math.ceil(classrooms.length / ITEMS_PER_PAGE);
    const paginatedClassrooms = classrooms.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    // Add these state variables to your existing state in ClassroomView component
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
interface CSVClassroomRow {
    code: string;
    type: string;
    capacity: string;
}

// Validation function for classroom CSV data
const validateClassroomData = (row: any, rowIndex: number): CSVClassroomRow | string => {
    const errors: string[] = [];
    
    // Check required fields
    if (!row.code || typeof row.code !== 'string' || row.code.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Classroom code is required`);
    }
    
    if (!row.type || typeof row.type !== 'string' || row.type.trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Classroom type is required`);
    } else {
        // Check if classroom type exists in the system
        const typeExists = classroomTypes.some(type => 
            type.name.toLowerCase() === row.type.trim().toLowerCase()
        );
        if (!typeExists) {
            errors.push(`Row ${rowIndex + 1}: Classroom type "${row.type.trim()}" does not exist in the system`);
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
    
    if (errors.length > 0) {
        return errors.join(', ');
    }
    
    // Return cleaned data
    return {
        code: row.code.trim(),
        type: row.type.trim(),
        capacity: row.capacity.toString(),
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
                const validClassrooms: CSVClassroomRow[] = [];
                const errors: string[] = [];

                // Validate each row
                csvData.forEach((row, index) => {
                    const validationResult = validateClassroomData(row, index);
                    if (typeof validationResult === 'string') {
                        errors.push(validationResult);
                    } else {
                        // Check for duplicate codes in the CSV
                        const duplicateInCsv = validClassrooms.some(classroom => 
                            classroom.code.toLowerCase() === validationResult.code.toLowerCase()
                        );
                        if (duplicateInCsv) {
                            errors.push(`Row ${index + 1}: Duplicate classroom code "${validationResult.code}" in CSV`);
                        } else {
                            // Check for existing codes in database
                            const existingClassroom = classrooms.some(classroom => 
                                classroom.code.toLowerCase() === validationResult.code.toLowerCase()
                            );
                            if (existingClassroom) {
                                errors.push(`Row ${index + 1}: Classroom code "${validationResult.code}" already exists in the system`);
                            } else {
                                validClassrooms.push(validationResult);
                            }
                        }
                    }
                });

                setImportProgress(prev => ({
                    ...prev,
                    total: validClassrooms.length,
                    errors: errors,
                }));

                if (validClassrooms.length === 0) {
                    setStatusMessage({
                        text: "No valid classrooms found in the CSV file",
                        type: "error",
                    });
                    setImportProgress(prev => ({ ...prev, isImporting: false }));
                    return;
                }

                // Import valid classrooms
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
                                    errorData.error || 'Unknown error'
                                }`
                            );
                        } else {
                            completed++;
                        }
                    } catch (error) {
                        importErrors.push(
                            `Failed to import ${classroom.code}: ${
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

                // Refresh the classroom list
                await fetchClassrooms();

                // Show completion message
                if (completed > 0) {
                    setStatusMessage({
                        text: `Successfully imported ${completed} classroom(s)${
                            importErrors.length > 0 ? ` with ${importErrors.length} error(s)` : ''
                        }`,
                        type: completed === validClassrooms.length ? "success" : "error",
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
                setImportProgress(prev => ({ ...prev, isImporting: false }));
            },
        });
    } catch (error) {
        console.error("Import error:", error);
        setStatusMessage({
            text: "Failed to import classrooms. Please try again.",
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

// Download CSV with current classrooms data
const downloadClassroomsCSV = () => {
    try {
        // Create CSV header
        const headers = ['code', 'type', 'capacity'];
        
        // Convert classrooms data to CSV rows
        const csvRows = classrooms.map(classroom => [
            classroom.code,
            classroom.type,
            classroom.capacity.toString()
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
        link.setAttribute('download', `classrooms_export_${today}.csv`);
        
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setStatusMessage({
            text: `Exported ${classrooms.length} classrooms to CSV`,
            type: "success",
        });
    } catch (error) {
        console.error('Error exporting CSV:', error);
        setStatusMessage({
            text: "Failed to export classrooms. Please try again.",
            type: "error",
        });
    }
};




    return (
        <div>
            {statusMessage && (
                <div
                    className={`mb-4 p-3 rounded-md ${
                        statusMessage.type === "success"
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-red-100 text-red-700 border border-red-200"
                    }`}
                >
                    {statusMessage.text}
                </div>
            )}

           {/* Updated Header Section */}
<div className="flex justify-between items-center mb-6">
    <h2 className="text-xl font-bold">Classrooms</h2>
    <div className="flex gap-2">
    <Button
            onClick={() => setIsImportDialogOpen(true)}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
            disabled={isLoading}
        >
            <Upload className="mr-2 h-4 w-4" /> Import CSV
        </Button>
  
        <Button
            onClick={downloadClassroomsCSV}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
            disabled={classrooms.length === 0 || isLoading}
        >
            <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      
        <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700"
            disabled={isLoading}
        >
            <Plus className="mr-2 h-4 w-4" /> New Classroom
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
                                NAME
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                TYPE
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                CAPACITY
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="border p-2 text-center"
                                >
                                    Loading...
                                </td>
                            </tr>
                        ) : paginatedClassrooms.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="border p-2 text-center"
                                >
                                    No classrooms found
                                </td>
                            </tr>
                        ) : (
                            paginatedClassrooms.map((classroom) => (
                                <tr key={classroom.id}>
                                    <td className="border p-2">
                                        {classroom.id}
                                    </td>
                                    <td className="border p-2">
                                        {classroom.code}
                                    </td>
                                    <td className="border p-2">
                                        {classroom.type}
                                    </td>
                                    <td className="border p-2">
                                        {classroom.capacity}
                                    </td>
                                    <td className="border p-2">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    openEditDialog(classroom)
                                                }
                                                disabled={isLoading}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    openDeleteDialog(classroom)
                                                }
                                                disabled={isLoading}
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

            {classrooms.length > 0 && (
                <CustomPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}

            {/* Add Classroom Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Classroom</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Classroom Code</Label>
                            <Input
                                id="code"
                                name="code"
                                value={formData.code}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) =>
                                    handleSelectChange("type", value)
                                }
                            >
                                <SelectTrigger>
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
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="capacity">Capacity</Label>
                            <Input
                                id="capacity"
                                name="capacity"
                                type="number"
                                value={formData.capacity}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsAddDialogOpen(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddClassroom}
                            disabled={isLoading}
                        >
                            {isLoading ? "Adding..." : "Add Classroom"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Classroom Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Classroom</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-code">Classroom Code</Label>
                            <Input
                                id="edit-code"
                                name="code"
                                value={formData.code}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-type">Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) =>
                                    handleSelectChange("type", value)
                                }
                            >
                                <SelectTrigger>
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
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-capacity">Capacity</Label>
                            <Input
                                id="edit-capacity"
                                name="capacity"
                                type="number"
                                value={formData.capacity}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsEditDialogOpen(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleEditClassroom}
                            disabled={isLoading}
                        >
                            {isLoading ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Classroom Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Classroom</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>Are you sure you want to delete this classroom?</p>
                        <p className="font-medium mt-2">
                            {selectedClassroom?.code} ({selectedClassroom?.type}
                            )
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteClassroom}
                            disabled={isLoading}
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
    <DialogContent className="max-w-md">
        <DialogHeader>
            <DialogTitle>Import Classrooms from CSV</DialogTitle>
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
                        CSV should contain columns: code, type, capacity
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
