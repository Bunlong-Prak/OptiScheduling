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
import { Pencil, Plus, Trash } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const ITEMS_PER_PAGE = 5;

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
        short_tag: "",
    });
    const [currentPage, setCurrentPage] = useState(1);
    // const [isLoading, setIsLoading] = useState(false);

    // Load majors on component mount
    useEffect(() => {
        fetchMajors();
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
    const totalPages = Math.ceil(majors.length / ITEMS_PER_PAGE);
    const paginatedMajors = majors.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const fetchMajors = async () => {
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/majors?scheduleId=${scheduleId}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch majors");
            }

            const data = await response.json();
            setMajors(data);
            // Reset to first page when data changes
            setCurrentPage(1);
        } catch (error) {
            console.error("Error fetching majors:", error);
            setStatusMessage({
                text: "Failed to load majors. Please try again.",
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

    // Function to handle opening the add dialog
    const openAddDialog = () => {
        resetForm(); // Ensure form is clean before opening
        setIsAddDialogOpen(true);
    };
    const params = useParams();
    const handleAddMajor = async () => {
        try {
            const scheduleId = params.id;
            const apiData = {
                name: formData.name,
                shortTag: formData.short_tag,
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
                throw new Error("Failed to create major");
            }

            // Refresh the major list
            await fetchMajors();

            // Close dialog and reset form
            setIsAddDialogOpen(false);
            resetForm();

            setStatusMessage({
                text: "Major added successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error adding major:", error);
            setStatusMessage({
                text: "Failed to add major. Please try again.",
                type: "error",
            });
        }
    };

    const handleEditMajor = async () => {
        if (!selectedMajor) return;

        try {
            const apiData = {
                id: selectedMajor.id,
                name: formData.name,
                shortTag: formData.short_tag,
            };

            console.log("Sending update data:", apiData);

            const response = await fetch("/api/majors", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error("Update failed:", responseData);
                throw new Error(responseData.error || "Failed to update major");
            }

            console.log("Update successful:", responseData);

            await fetchMajors();
            setIsEditDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Major updated successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error updating major:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to update major. Please try again.",
                type: "error",
            });
        }
    };

    const handleDeleteMajor = async () => {
        if (!selectedMajor) return;

        try {
            const apiData = {
                id: selectedMajor.id,
            };
            const response = await fetch("/api/majors", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                throw new Error("Failed to delete major");
            }

            // Refresh the major list
            await fetchMajors();

            // Close dialog
            setIsDeleteDialogOpen(false);
            setSelectedMajor(null);

            setStatusMessage({
                text: "Major deleted successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error deleting major:", error);
            setStatusMessage({
                text: "Failed to delete major. Please try again.",
                type: "error",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            short_tag: "",
        });
        setSelectedMajor(null);
    };

    const openEditDialog = (major: Major) => {
        resetForm(); // Reset first to clear any previous data
        setSelectedMajor(major);
        setFormData({
            name: major.name,
            short_tag: major.short_tag,
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (major: Major) => {
        setSelectedMajor(major);
        setIsDeleteDialogOpen(true);
    };

    return (
        <div>
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
                    <h2 className="text-xl font-bold">Majors</h2>
                    <Button
                        onClick={openAddDialog}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Major
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
                                    SHORT TAG
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {majors.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="border p-4 text-center"
                                    >
                                        No majors found. Add a new major to get
                                        started.
                                    </td>
                                </tr>
                            ) : (
                                paginatedMajors.map((major) => (
                                    <tr key={major.id}>
                                        <td className="border p-2">
                                            {major.id}
                                        </td>
                                        <td className="border p-2">
                                            {major.name}
                                        </td>
                                        <td className="border p-2">
                                            {major.short_tag}
                                        </td>
                                        <td className="border p-2">
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        openEditDialog(major)
                                                    }
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        openDeleteDialog(major)
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

                {/* Add pagination if we have majors */}
                {majors.length > 0 && (
                    <CustomPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                )}
            </>

            {/* Add Major Dialog */}
            <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsAddDialogOpen(open);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Major</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Major Name</Label>
                            <Input
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="short_tag">Short Tag</Label>
                            <Input
                                id="short_tag"
                                name="short_tag"
                                value={formData.short_tag}
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
                        <Button onClick={handleAddMajor}>Add Major</Button>
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Major</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Major Name</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-short_tag">Short Tag</Label>
                            <Input
                                id="edit-short_tag"
                                name="short_tag"
                                value={formData.short_tag}
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
                        <Button onClick={handleEditMajor}>Save Changes</Button>
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Major</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>Are you sure you want to delete this major?</p>
                        <p className="font-medium mt-2">
                            {selectedMajor?.name} ({selectedMajor?.short_tag})
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedMajor(null);
                                setIsDeleteDialogOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteMajor}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
