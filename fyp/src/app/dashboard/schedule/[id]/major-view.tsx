"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Trash } from "lucide-react";
import type { Major, MajorFormData } from "../../../types";
import CustomPagination from "@/components/custom/pagination"; // Import the pagination component

// Mock data for majors - let's add more to demonstrate pagination
const initialMajors: Major[] = [
    { id: 1, name: "Computer Science", short_tag: "CS" },
    { id: 2, name: "Civil Engineering", short_tag: "CE" },
    { id: 3, name: "Industrial Engineering", short_tag: "IE" },
    { id: 4, name: "Mechanical Engineering", short_tag: "ME" },
    { id: 5, name: "Electrical Engineering", short_tag: "EE" },
    { id: 6, name: "Chemical Engineering", short_tag: "ChE" },
    { id: 7, name: "Business Administration", short_tag: "BA" },
    { id: 8, name: "Economics", short_tag: "ECON" },
    { id: 9, name: "Mathematics", short_tag: "MATH" },
    { id: 10, name: "Physics", short_tag: "PHYS" },
    { id: 11, name: "Chemistry", short_tag: "CHEM" },
    { id: 12, name: "Biology", short_tag: "BIO" },
];

const ITEMS_PER_PAGE = 5; // Define how many items to show per page

export function MajorView() {
    const [majors, setMajors] = useState<Major[]>(initialMajors);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedMajor, setSelectedMajor] = useState<Major | null>(null);
    const [formData, setFormData] = useState<MajorFormData>({
        name: "",
        short_tag: "",
    });
    const [currentPage, setCurrentPage] = useState(1);

    // Calculate pagination values
    const totalPages = Math.ceil(majors.length / ITEMS_PER_PAGE);
    const paginatedMajors = majors.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleAddMajor = () => {
        const newMajor: Major = {
            id: Math.max(0, ...majors.map((m) => m.id)) + 1,
            name: formData.name,
            short_tag: formData.short_tag,
        };

        setMajors([...majors, newMajor]);
        setIsAddDialogOpen(false);
        resetForm();
    };

    const handleEditMajor = () => {
        if (!selectedMajor) return;

        const updatedMajors = majors.map((major) => {
            if (major.id === selectedMajor.id) {
                return {
                    ...major,
                    name: formData.name,
                    short_tag: formData.short_tag,
                };
            }
            return major;
        });

        setMajors(updatedMajors);
        setIsEditDialogOpen(false);
        resetForm();
    };

    const handleDeleteMajor = () => {
        if (!selectedMajor) return;

        const updatedMajors = majors.filter(
            (major) => major.id !== selectedMajor.id
        );
        setMajors(updatedMajors);
        setIsDeleteDialogOpen(false);

        // Check if we need to adjust the current page after deletion
        if (
            updatedMajors.length > 0 &&
            currentPage > Math.ceil(updatedMajors.length / ITEMS_PER_PAGE)
        ) {
            setCurrentPage(Math.ceil(updatedMajors.length / ITEMS_PER_PAGE));
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
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Majors</h2>
                <Button
                    onClick={() => setIsAddDialogOpen(true)}
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
                        {paginatedMajors.map((major) => (
                            <tr key={major.id}>
                                <td className="border p-2">{major.id}</td>
                                <td className="border p-2">{major.name}</td>
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
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add pagination */}
            {majors.length > ITEMS_PER_PAGE && (
                <CustomPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}

            {/* Add Major Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                            onClick={() => setIsAddDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleAddMajor}>Add Major</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Major Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                            onClick={() => setIsEditDialogOpen(false)}
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
                onOpenChange={setIsDeleteDialogOpen}
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
                            onClick={() => setIsDeleteDialogOpen(false)}
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
