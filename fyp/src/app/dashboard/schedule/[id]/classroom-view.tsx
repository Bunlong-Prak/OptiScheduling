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
import type { Classroom, ClassroomFormData } from "../../../types";

const ITEMS_PER_PAGE = 10;

export function ClassroomView() {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
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
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error" | "info";
    } | null>(null);

    // Fetch classrooms from API
    const fetchClassrooms = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/classrooms");
            if (!response.ok) {
                throw new Error("Failed to fetch classrooms");
            }
            const data = await response.json();
            setClassrooms(data);
            setStatusMessage({
                text: "Classrooms loaded successfully",
                type: "success",
            });
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
            // Prepare data for API
            const apiData = {
                code: formData.code,
                type: formData.type,
                capacity: Number.parseInt(formData.capacity),
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
            // Prepare data for API
            const apiData = {
                id: selectedClassroom.id,
                code: formData.code,
                type: formData.type,
                capacity: Number.parseInt(formData.capacity),
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
            const apiData = {
                id: selectedClassroom.id,
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

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Classrooms</h2>
                <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={isLoading}
                >
                    <Plus className="mr-2 h-4 w-4" /> New Classroom
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
                                    <SelectItem value="Lecture Room">
                                        Lecture Room
                                    </SelectItem>
                                    <SelectItem value="Computer Lab">
                                        Computer Lab
                                    </SelectItem>
                                    <SelectItem value="Conference Room">
                                        Conference Room
                                    </SelectItem>
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
                                    <SelectItem value="Lecture Room">
                                        Lecture Room
                                    </SelectItem>
                                    <SelectItem value="Computer Lab">
                                        Computer Lab
                                    </SelectItem>
                                    <SelectItem value="Conference Room">
                                        Conference Room
                                    </SelectItem>
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
        </div>
    );
}
