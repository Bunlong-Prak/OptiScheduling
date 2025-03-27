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
import { Pencil, Plus, Trash } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

interface ClassroomType {
    id: number;
    name: string;
}

const ITEMS_PER_PAGE = 5;

export function ClassroomTypeView() {
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
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

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

    // Calculate pagination values
    const totalPages = Math.ceil(classroomTypes.length / ITEMS_PER_PAGE);
    const paginatedClassroomTypes = classroomTypes.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const fetchClassroomTypes = async () => {
        try {
            setIsLoading(true);
            const response = await fetch("/api/classroom-types");

            if (!response.ok) {
                throw new Error("Failed to fetch classroom types");
            }

            const data = await response.json();
            setClassroomTypes(data);
            // Reset to first page when data changes
            setCurrentPage(1);
        } catch (error) {
            console.error("Error fetching classroom types:", error);
            setStatusMessage({
                text: "Failed to load classroom types. Please try again.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    // Function to handle opening the add dialog
    const openAddDialog = () => {
        resetForm(); // Ensure form is clean before opening
        setIsAddDialogOpen(true);
    };

    const handleAddClassroomType = async () => {
        try {
            // Prepare data for API
            const apiData = {
                name: formData.name,
            };

            const response = await fetch("/api/classroom-types", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                throw new Error("Failed to create classroom type");
            }

            // Refresh the classroom types list
            await fetchClassroomTypes();

            // Close dialog and reset form
            setIsAddDialogOpen(false);
            resetForm();

            setStatusMessage({
                text: "Classroom type added successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error adding classroom type:", error);
            setStatusMessage({
                text: "Failed to add classroom type. Please try again.",
                type: "error",
            });
        }
    };

    const handleEditClassroomType = async () => {
        if (!selectedClassroomType) return;

        try {
            const apiData = {
                id: selectedClassroomType.id,
                name: formData.name,
            };

            console.log("Sending update data:", apiData);

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

            console.log("Update successful:", responseData);

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

            // Refresh the classroom type list
            await fetchClassroomTypes();

            // Close dialog
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
        });
        setSelectedClassroomType(null);
    };

    const openEditDialog = (classroomType: ClassroomType) => {
        resetForm(); // Reset first to clear any previous data
        setSelectedClassroomType(classroomType);
        setFormData({
            name: classroomType.name,
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (classroomType: ClassroomType) => {
        setSelectedClassroomType(classroomType);
        setIsDeleteDialogOpen(true);
    };

    return (
        <div>
            {isLoading ? (
                <div className="flex justify-center my-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            ) : (
                <>
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
                        <h2 className="text-xl font-bold">Classroom Types</h2>
                        <Button
                            onClick={openAddDialog}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Plus className="mr-2 h-4 w-4" /> New Classroom Type
                        </Button>
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
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {classroomTypes.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="border p-4 text-center"
                                        >
                                            No classroom types found. Add a new
                                            classroom type to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedClassroomTypes.map(
                                        (classroomType) => (
                                            <tr key={classroomType.id}>
                                                <td className="border p-2">
                                                    {classroomType.id}
                                                </td>
                                                <td className="border p-2">
                                                    {classroomType.name}
                                                </td>
                                                <td className="border p-2">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                openEditDialog(
                                                                    classroomType
                                                                )
                                                            }
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                openDeleteDialog(
                                                                    classroomType
                                                                )
                                                            }
                                                        >
                                                            <Trash className="h-4 w-4" />
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

                    {/* Add pagination if we have classroom types */}
                    {classroomTypes.length > 0 && (
                        <CustomPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </>
            )}

            {/* Add Classroom Type Dialog */}
            <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsAddDialogOpen(open);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Classroom Type</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                name="name"
                                value={formData.name}
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
                        <Button
                            onClick={handleAddClassroomType}
                            disabled={!formData.name}
                        >
                            Add Classroom Type
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Classroom Type</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                value={formData.name}
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
                        <Button
                            onClick={handleEditClassroomType}
                            disabled={!formData.name}
                        >
                            Save Changes
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Classroom Type</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>
                            Are you sure you want to delete this classroom type?
                        </p>
                        <p className="font-medium mt-2">
                            {selectedClassroomType?.name}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedClassroomType(null);
                                setIsDeleteDialogOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteClassroomType}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
