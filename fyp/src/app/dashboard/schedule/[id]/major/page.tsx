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

const ITEMS_PER_PAGE = 10;

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
                                            {major.shortTag}
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
                                placeholder="Computer Science"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="shortTag">Short Tag</Label>
                            <Input
                                id="shortTag"
                                name="shortTag"
                                value={formData.shortTag}
                                onChange={handleInputChange}
                                placeholder="CS"
                            />
                            <span className="text-sm text-gray-500">
                                Enter a short code for the major (e.g., CS for
                                Computer Science).
                            </span>
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
                            <Label htmlFor="edit-shortTag">Short Tag</Label>
                            <Input
                                id="edit-shortTag"
                                name="shortTag"
                                value={formData.shortTag}
                                onChange={handleInputChange}
                            />
                            <span className="text-sm text-gray-500">
                                Enter a short code for the major (e.g., CS for
                                Computer Science).
                            </span>
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
                            {selectedMajor?.name}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            This action cannot be undone.
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
