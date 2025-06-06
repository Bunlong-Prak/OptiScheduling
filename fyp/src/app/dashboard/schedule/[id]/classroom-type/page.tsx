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
import { useParams } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

interface ClassroomType {
    id: number;
    name: string;
}

const ITEMS_PER_PAGE = 15;

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
    });
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

    // Calculate pagination values
    const totalPages = Math.ceil(classroomTypes.length / ITEMS_PER_PAGE);
    const paginatedClassroomTypes = classroomTypes.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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

    const handleAddClassroomType = async () => {
        try {
            const scheduleId = params.id;
            const apiData = {
                name: formData.name,
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
                throw new Error("Failed to create classroom type");
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
        });
        setSelectedClassroomType(null);
    };

    const openEditDialog = (classroomType: ClassroomType) => {
        resetForm();
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
                    <h2 className="text-lg font-semibold text-gray-900">Classroom Types</h2>
                    <p className="text-xs text-gray-600">Manage classroom type categories</p>
                </div>
                <Button
                    onClick={openAddDialog}
                    className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                >
                    <Plus className="h-3 w-3" /> New Classroom Type
                </Button>
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
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-20">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {classroomTypes.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="px-3 py-8 text-center text-gray-500 text-sm"
                                    >
                                        <div className="space-y-1">
                                            <div>No classroom types found</div>
                                            <div className="text-xs">Add a new classroom type to get started.</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedClassroomTypes.map((classroomType, index) => (
                                    <tr 
                                        key={classroomType.id}
                                        className={`hover:bg-gray-50 transition-colors ${
                                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                        }`}
                                    >
                                        <td className="px-3 py-2 text-xs text-gray-600 font-medium">
                                            {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-900">
                                            {classroomType.name}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-gray-500 hover:text-[#2F2F85] hover:bg-gray-100"
                                                    onClick={() => openEditDialog(classroomType)}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => openDeleteDialog(classroomType)}
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
            {classroomTypes.length > 0 && (
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
                        <DialogTitle className="text-lg font-semibold text-gray-900">Add New Classroom Type</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium text-gray-700">Name</Label>
                            <Input
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                placeholder="Enter classroom type name"
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
                            onClick={handleAddClassroomType}
                            disabled={!formData.name}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white disabled:bg-gray-300 text-sm px-3 py-1.5"
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
                        <DialogTitle className="text-lg font-semibold text-gray-900">Edit Classroom Type</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">Name</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                placeholder="Enter classroom type name"
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
                            onClick={handleEditClassroomType}
                            disabled={!formData.name}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white disabled:bg-gray-300 text-sm px-3 py-1.5"
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
                        <DialogTitle className="text-lg font-semibold text-gray-900">Delete Classroom Type</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p className="text-sm text-gray-600 mb-2">
                            Are you sure you want to delete this classroom type?
                        </p>
                        <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                            {selectedClassroomType?.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">This action cannot be undone.</p>
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
        </div>
    );
}