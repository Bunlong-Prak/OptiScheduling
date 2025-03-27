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
import Pagination from "@/components/custom/pagination";

interface ClassroomType {
    id: number;
    name: string;
}

// Mock data for classroom types
const initialClassroomTypes: ClassroomType[] = [
    { id: 1, name: "Computer Lab" },
    { id: 2, name: "Lecture Room" },
    { id: 3, name: "Project Room" },
];

export function ClassroomTypeView() {
    const [classroomTypes, setClassroomTypes] = useState<ClassroomType[]>(initialClassroomTypes);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedClassroomType, setSelectedClassroomType] = useState<ClassroomType | null>(null);
    const [formData, setFormData] = useState({
        name: "",
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const totalPages = Math.ceil(classroomTypes.length / itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleAddClassroomType = () => {
        const newClassroomType: ClassroomType = {
            id: Math.max(0, ...classroomTypes.map((ct) => ct.id)) + 1,
            name: formData.name,
        };

        setClassroomTypes([...classroomTypes, newClassroomType]);
        setIsAddDialogOpen(false);
        resetForm();
    };

    const handleEditClassroomType = () => {
        if (!selectedClassroomType) return;

        const updatedClassroomTypes = classroomTypes.map((classroomType) => {
            if (classroomType.id === selectedClassroomType.id) {
                return {
                    ...classroomType,
                    name: formData.name,
                };
            }
            return classroomType;
        });

        setClassroomTypes(updatedClassroomTypes);
        setIsEditDialogOpen(false);
        resetForm();
    };

    const handleDeleteClassroomType = () => {
        if (!selectedClassroomType) return;

        const updatedClassroomTypes = classroomTypes.filter(
            (classroomType) => classroomType.id !== selectedClassroomType.id
        );
        setClassroomTypes(updatedClassroomTypes);
        setIsDeleteDialogOpen(false);
    };

    const resetForm = () => {
        setFormData({
            name: "",
        });
        setSelectedClassroomType(null);
    };

    const openDeleteDialog = (classroomType: ClassroomType) => {
        setSelectedClassroomType(classroomType);
        setIsDeleteDialogOpen(true);
    };

    const openEditDialog = (classroomType: ClassroomType) => {
        setSelectedClassroomType(classroomType);
        setFormData({
            name: classroomType.name,
        });
        setIsEditDialogOpen(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Classroom Types</h2>
                <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <Plus className="mr-2 h-4 w-4" /> New Classroom Type
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border p-2 bg-gray-100 text-left">Name</th>
                            <th className="border p-2 bg-gray-100 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {classroomTypes.map((classroomType) => (
                            <tr key={classroomType.id}>
                                <td className="border p-2">{classroomType.name}</td>
                                <td className="border p-2">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                openEditDialog(classroomType)
                                            }
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                openDeleteDialog(classroomType)
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

            {/* Add Classroom Type Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                            onClick={() => setIsAddDialogOpen(false)}
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
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                            onClick={() => setIsEditDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleEditClassroomType}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Classroom Type Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Classroom Type</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>Are you sure you want to delete this classroom type?</p>
                        <p className="font-medium mt-2">
                            {selectedClassroomType?.name}
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
                            onClick={handleDeleteClassroomType}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="mt-4">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            </div>
        </div>
    );
} 