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
import type {
    Course,
    CourseFormData,
    Instructor,
    Classroom,
    Major,
    Section,
} from "../../../types";

// Mock data for instructors
const instructors: Instructor[] = [
    {
        id: 1,
        first_name: "Flordeliza P.",
        last_name: "PONCIO",
        gender: "Female",
        email: "flordeliza.poncio@paragon.edu.kh",
        phone_number: "012-345-678",
    },
    {
        id: 2,
        first_name: "Abdulkasim",
        last_name: "Akhmedov",
        gender: "Male",
        email: "abdulkasim.akhmedov@paragon.edu.kh",
        phone_number: "012-345-679",
    },
    {
        id: 3,
        first_name: "Nora",
        last_name: "Patron",
        gender: "Female",
        email: "nora.patron@paragon.edu.kh",
        phone_number: "012-345-680",
    },
];

// Mock data for classrooms
const classrooms: Classroom[] = [
    { id: 111, name: "111", type: "Computer Lab", capacity: 30 },
    { id: 304, name: "304", type: "Lecture Room", capacity: 40 },
    { id: 404, name: "404", type: "Lecture Room", capacity: 50 },
];

// Mock data for majors
const majors: Major[] = [
    { id: 1, name: "Computer Science", short_tag: "CS" },
    { id: 2, name: "Civil Engineering", short_tag: "CE" },
    { id: 3, name: "Industrial Engineering", short_tag: "IE" },
];

// Mock data for sections
const sections: Section[] = [
    { id: 1, number: 1 },
    { id: 2, number: 2 },
    { id: 3, number: 3 },
];

// Mock data for courses
const initialCourses: Course[] = [
    {
        id: 1,
        title: "Introduction to Programming",
        type: "Lecture",
        code: "CS125",
        // grade_type: "Letter",
        color: "blue",
        // description: "Introduction to programming concepts and practices",
        section_id: 1,
        major_id: 1,
        instructor_id: 1,
        classroom_id: 111,
    },
    {
        id: 2,
        title: "CALCULUS 1",
        type: "Lecture",
        code: "MATH131",
        // grade_type: "Letter",
        color: "green",
        // description: "Introduction to calculus",
        section_id: 2,
        major_id: 2,
        instructor_id: 2,
        classroom_id: 404,
    },
    {
        id: 3,
        title: "Final Year Project 1",
        type: "Project",
        code: "CS401",
        // grade_type: "Letter",
        color: "yellow",
        // description: "First part of the final year project",
        section_id: 3,
        major_id: 3,
        instructor_id: 3,
        classroom_id: 304,
    },
];

export function CoursesView() {
    const [courses, setCourses] = useState<Course[]>(initialCourses);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [formData, setFormData] = useState<CourseFormData>({
        title: "",
        type: "",
        code: "",
        color: "",
        section_id: 0,
        major_id: 0,
        instructor_id: 0,
        classroom_id: 0,
    });

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleSelectChange = (name: string, value: string) => {
        if (["section_id", "major_id", "instructor_id"].includes(name)) {
            setFormData({
                ...formData,
                [name]: Number.parseInt(value),
            });
        } else if (name === "classroom_id") {
            setFormData({
                ...formData,
                [name]: Number.parseInt(value),
            });
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }
    };

    const handleAddCourse = () => {
        const newCourse: Course = {
            id: Math.max(0, ...courses.map((c) => c.id)) + 1,
            title: formData.title,
            type: formData.type,
            code: formData.code,

            color: formData.color || "blue",
            //   description: "Introduction to programming concepts and practices",
            section_id: formData.section_id,
            major_id: formData.major_id,
            instructor_id: formData.instructor_id,
            classroom_id: formData.classroom_id,
        };

        setCourses([...courses, newCourse]);
        setIsAddDialogOpen(false);
        resetForm();
    };

    const handleEditCourse = () => {
        if (!selectedCourse) return;

        const updatedCourses = courses.map((course) => {
            if (course.id === selectedCourse.id) {
                return {
                    ...course,
                    title: formData.title,
                    type: formData.type,
                    code: formData.code,
                    grade_type: "Letter",
                    color: formData.color,
                    description:
                        "Introduction to programming concepts and practices",
                    section_id: formData.section_id,
                    major_id: formData.major_id,
                    instructor_id: formData.instructor_id,
                    classroom_id: formData.classroom_id,
                };
            }
            return course;
        });

        setCourses(updatedCourses);
        setIsEditDialogOpen(false);
        resetForm();
    };

    const handleDeleteCourse = () => {
        if (!selectedCourse) return;

        const updatedCourses = courses.filter(
            (course) => course.id !== selectedCourse.id
        );
        setCourses(updatedCourses);
        setIsDeleteDialogOpen(false);
    };

    const resetForm = () => {
        setFormData({
            title: "",
            type: "",
            code: "",
            color: "",
            section_id: 0,
            major_id: 0,
            instructor_id: 0,
            classroom_id: 0,

        });
        setSelectedCourse(null);
    };

    const openEditDialog = (course: Course) => {
        setSelectedCourse(course);
        setFormData({
            title: course.title,
            type: course.type,
            code: course.code,
            color: course.color,
            section_id: course.section_id,
            major_id: course.major_id,
            instructor_id: course.instructor_id,
            classroom_id: course.classroom_id,
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (course: Course) => {
        setSelectedCourse(course);
        setIsDeleteDialogOpen(true);
    };

    const getInstructorName = (instructorId: number) => {
        const instructor = instructors.find((i) => i.id === instructorId);
        return instructor
            ? `${instructor.first_name} ${instructor.last_name}`
            : "Unknown";
    };

    const getClassroomName = (classroomId: number) => {
        const classroom = classrooms.find((c) => c.id === classroomId);
        return classroom ? classroom.name : "Unknown";
    };

    const getMajorTag = (majorId: number) => {
        const major = majors.find((m) => m.id === majorId);
        return major ? major.short_tag : "Unknown";
    };

    const getSectionNumber = (sectionId: number) => {
        const section = sections.find((s) => s.id === sectionId);
        return section ? section.number : 0;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Courses</h2>
                <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <Plus className="mr-2 h-4 w-4" /> New Course
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border p-2 bg-gray-100 text-left">
                                CODE
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                TITLE
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                SECTION
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                INSTRUCTOR
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                CLASSROOM
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                MAJOR
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                TYPE
                            </th>
                            <th className="border p-2 bg-gray-100 text-left">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map((course) => (
                            <tr key={course.id}>
                                <td className="border p-2">{course.code}</td>
                                <td className="border p-2">{course.title}</td>
                                <td className="border p-2">
                                    {getSectionNumber(course.section_id)}
                                </td>
                                <td className="border p-2">
                                    {getInstructorName(course.instructor_id)}
                                </td>
                                <td className="border p-2">
                                    {getClassroomName(course.classroom_id)}
                                </td>
                                <td className="border p-2">
                                    {getMajorTag(course.major_id)}
                                </td>
                                <td className="border p-2">{course.type}</td>
                                <td className="border p-2">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                openEditDialog(course)
                                            }
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                openDeleteDialog(course)
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

            {/* Add Course Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Course</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Course Code</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="title">Course Name</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Course Type</Label>
                                <Input
                                    id="type"
                                    name="type"
                                    value={formData.type}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="section_id">Section</Label>
                                <Select
                                    value={
                                        formData.section_id
                                            ? formData.section_id.toString()
                                            : ""
                                    }
                                    onValueChange={(value) =>
                                        handleSelectChange("section_id", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map((section) => (
                                            <SelectItem
                                                key={section.id}
                                                value={section.id.toString()}
                                            >
                                                Section {section.number}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="major_id">Major</Label>
                                <Select
                                    value={
                                        formData.major_id
                                            ? formData.major_id.toString()
                                            : ""
                                    }
                                    onValueChange={(value) =>
                                        handleSelectChange("major_id", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select major" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {majors.map((major) => (
                                            <SelectItem
                                                key={major.id}
                                                value={major.id.toString()}
                                            >
                                                {major.name} ({major.short_tag})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="instructor_id">
                                    Instructor
                                </Label>
                                <Select
                                    value={
                                        formData.instructor_id
                                            ? formData.instructor_id.toString()
                                            : ""
                                    }
                                    onValueChange={(value) =>
                                        handleSelectChange(
                                            "instructor_id",
                                            value
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select instructor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {instructors.map((instructor) => (
                                            <SelectItem
                                                key={instructor.id}
                                                value={instructor.id.toString()}
                                            >
                                                {instructor.first_name}{" "}
                                                {instructor.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="classroom_id">Classroom</Label>
                                <Select
                                    value={
                                        formData.classroom_id
                                            ? formData.classroom_id.toString()
                                            : ""
                                    }
                                    onValueChange={(value) =>
                                        handleSelectChange(
                                            "classroom_id",
                                            value
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select classroom" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classrooms.map((classroom) => (
                                            <SelectItem
                                                key={classroom.id}
                                                value={classroom.id.toString()}
                                            >
                                                {classroom.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="color">Color</Label>
                                <Select
                                    value={formData.color}
                                    onValueChange={(value) =>
                                        handleSelectChange("color", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select color" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="blue">
                                            Blue
                                        </SelectItem>
                                        <SelectItem value="green">
                                            Green
                                        </SelectItem>
                                        <SelectItem value="yellow">
                                            Yellow
                                        </SelectItem>
                                        <SelectItem value="red">Red</SelectItem>
                                        <SelectItem value="purple">
                                            Purple
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsAddDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleAddCourse}>Add Course</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Course Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Course</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-code">Course Code</Label>
                                <Input
                                    id="edit-code"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-title">Course Name</Label>
                                <Input
                                    id="edit-title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-type">Course Type</Label>
                                <Input
                                    id="edit-type"
                                    name="type"
                                    value={formData.type}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-section_id">Section</Label>
                                <Select
                                    value={
                                        formData.section_id
                                            ? formData.section_id.toString()
                                            : ""
                                    }
                                    onValueChange={(value) =>
                                        handleSelectChange("section_id", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map((section) => (
                                            <SelectItem
                                                key={section.id}
                                                value={section.id.toString()}
                                            >
                                                Section {section.number}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-major_id">Major</Label>
                                <Select
                                    value={
                                        formData.major_id
                                            ? formData.major_id.toString()
                                            : ""
                                    }
                                    onValueChange={(value) =>
                                        handleSelectChange("major_id", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select major" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {majors.map((major) => (
                                            <SelectItem
                                                key={major.id}
                                                value={major.id.toString()}
                                            >
                                                {major.name} ({major.short_tag})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-instructor_id">
                                    Instructor
                                </Label>
                                <Select
                                    value={
                                        formData.instructor_id
                                            ? formData.instructor_id.toString()
                                            : ""
                                    }
                                    onValueChange={(value) =>
                                        handleSelectChange(
                                            "instructor_id",
                                            value
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select instructor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {instructors.map((instructor) => (
                                            <SelectItem
                                                key={instructor.id}
                                                value={instructor.id.toString()}
                                            >
                                                {instructor.first_name}{" "}
                                                {instructor.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-classroom_id">
                                    Classroom
                                </Label>
                                <Select
                                    value={
                                        formData.classroom_id
                                            ? formData.classroom_id.toString()
                                            : ""
                                    }
                                    onValueChange={(value) =>
                                        handleSelectChange(
                                            "classroom_id",
                                            value
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select classroom" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classrooms.map((classroom) => (
                                            <SelectItem
                                                key={classroom.id}
                                                value={classroom.id.toString()}
                                            >
                                                {classroom.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-color">Color</Label>
                                <Select
                                    value={formData.color}
                                    onValueChange={(value) =>
                                        handleSelectChange("color", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select color" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="blue">
                                            Blue
                                        </SelectItem>
                                        <SelectItem value="green">
                                            Green
                                        </SelectItem>
                                        <SelectItem value="yellow">
                                            Yellow
                                        </SelectItem>
                                        <SelectItem value="red">Red</SelectItem>
                                        <SelectItem value="purple">
                                            Purple
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsEditDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleEditCourse}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Course Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Course</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>Are you sure you want to delete this course?</p>
                        <p className="font-medium mt-2">
                            {selectedCourse?.code}: {selectedCourse?.title}
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
                            onClick={handleDeleteCourse}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
