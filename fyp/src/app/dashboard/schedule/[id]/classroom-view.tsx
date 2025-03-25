// filepath: d:\Documents\OptiScheduling\fyp\src\app\dashboard\schedule\[id]\classroom-view.tsx
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, Trash } from "lucide-react";
import type { Classroom, ClassroomFormData } from "../../../types";
import CustomPagination from "@/components/custom/pagination"; // Updated import for our custom pagination component

const initialClassrooms: Classroom[] = [
    { id: 1121, name: "1131", type: "Computer Lab", capacity: 30 },
    { id: 3044, name: "3204", type: "Lecture Room", capacity: 40 },
    { id: 4024, name: "4024", type: "Lecture Room", capacity: 50 },
      { id: 321, name: "11123", type: "Computer Lab", capacity: 30 },
    { id: 423, name: "304231", type: "Lecture Room", capacity: 40 },
    { id: 2352, name: "42304", type: "Lecture Room", capacity: 50 },
      { id: 5342, name: "1311", type: "Computer Lab", capacity: 30 },
    { id: 534, name: "3044", type: "Lecture Room", capacity: 40 },
    { id: 644, name: "4034", type: "Lecture Room", capacity: 50 },
      { id: 11551, name: "1151", type: "Computer Lab", capacity: 30 },
    { id: 3045324, name: "3034", type: "Lecture Room", capacity: 40 },
    { id: 4054, name: "4064", type: "Lecture Room", capacity: 50 },
    
];

const ITEMS_PER_PAGE = 10; // Define how many items to show per page

export function ClassroomView() {
    const [classrooms, setClassrooms] = useState<Classroom[]>(initialClassrooms);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
    const [formData, setFormData] = useState<ClassroomFormData>({
        name: "",
        type: "",
        capacity: "",
    });
    const [currentPage, setCurrentPage] = useState(1);

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

    const handleAddClassroom = () => {
        const newClassroom: Classroom = {
            id: Number.parseInt(formData.name),
            name: formData.name,
            type: formData.type,
            capacity: Number.parseInt(formData.capacity),
        };

        setClassrooms([...classrooms, newClassroom]);
        setIsAddDialogOpen(false);
        resetForm();
    };

    const handleEditClassroom = () => {
        if (!selectedClassroom) return;

        const updatedClassrooms = classrooms.map((classroom) => {
            if (classroom.id === selectedClassroom.id) {
                return {
                    ...classroom,
                    name: formData.name,
                    type: formData.type,
                    capacity: Number.parseInt(formData.capacity),
                };
            }
            return classroom;
        });

        setClassrooms(updatedClassrooms);
        setIsEditDialogOpen(false);
        resetForm();
    };

    const handleDeleteClassroom = () => {
        if (!selectedClassroom) return;

        const updatedClassrooms = classrooms.filter(
            (classroom) => classroom.id !== selectedClassroom.id
        );
        setClassrooms(updatedClassrooms);
        setIsDeleteDialogOpen(false);
    };

    const resetForm = () => {
        setFormData({
            name: "",
            type: "",
            capacity: "",
        });
        setSelectedClassroom(null);
    };

    const openEditDialog = (classroom: Classroom) => {
        setSelectedClassroom(classroom);
        setFormData({
            name: classroom.name,
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
    const paginatedClassrooms = classrooms.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Classrooms</h2>
                <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <Plus className="mr-2 h-4 w-4" /> New Classroom
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border p-2 bg-gray-100 text-left">ID</th>
                            <th className="border p-2 bg-gray-100 text-left">NAME</th>
                            <th className="border p-2 bg-gray-100 text-left">TYPE</th>
                            <th className="border p-2 bg-gray-100 text-left">CAPACITY</th>
                            <th className="border p-2 bg-gray-100 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedClassrooms.map((classroom) => (
                            <tr key={classroom.id}>
                                <td className="border p-2">{classroom.id}</td>
                                <td className="border p-2">{classroom.name}</td>
                                <td className="border p-2">{classroom.type}</td>
                                <td className="border p-2">{classroom.capacity}</td>
                                <td className="border p-2">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(classroom)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openDeleteDialog(classroom)}
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

            <CustomPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />

            {/* Add Classroom Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Classroom</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Classroom Name/Number</Label>
                            <Input
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) => handleSelectChange("type", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Lecture Room">Lecture Room</SelectItem>
                                    <SelectItem value="Computer Lab">Computer Lab</SelectItem>
                                    <SelectItem value="Conference Room">Conference Room</SelectItem>
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
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddClassroom}>Add Classroom</Button>
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
                            <Label htmlFor="edit-name">Classroom Name/Number</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-type">Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) => handleSelectChange("type", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Lecture Room">Lecture Room</SelectItem>
                                    <SelectItem value="Computer Lab">Computer Lab</SelectItem>
                                    <SelectItem value="Conference Room">Conference Room</SelectItem>
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
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleEditClassroom}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Classroom Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Classroom</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>Are you sure you want to delete this classroom?</p>
                        <p className="font-medium mt-2">
                            {selectedClassroom?.name} ({selectedClassroom?.type})
                        </p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteClassroom}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}