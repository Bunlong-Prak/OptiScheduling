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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pencil, Plus, Trash, Check, ChevronsUpDown } from "lucide-react";
import type {
    Course,
    CourseFormData,
    Instructor,
    Classroom,
    Major,
} from "@/app/types";
import Pagination from "@/components/custom/pagination";

// Interface for section-classroom pairs
interface SectionClassroomPair {
    id: number;
    section_id: number;
    classroom_id: number;
}

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
    { id: 111, code: "111", type: "Computer Lab", capacity: 30 },
    { id: 304, code: "304", type: "Lecture Room", capacity: 40 },
    { id: 404, code: "404", type: "Lecture Room", capacity: 50 },
];

// Mock data for majors
const majors: Major[] = [
    { id: 1, name: "Computer Science", short_tag: "CS" },
    { id: 2, name: "Civil Engineering", short_tag: "CE" },
    { id: 3, name: "Industrial Engineering", short_tag: "IE" },
];

// Mock data for courses
const initialCourses: Course[] = [
    {
        id: 1,
        title: "Introduction to Programming",
        type: "Lecture",
        code: "CS125",
        color: "blue",
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
        color: "green",
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
        color: "yellow",
        section_id: 3,
        major_id: 3,
        instructor_id: 3,
        classroom_id: 304,
    },
];

export default function CoursesView() {
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
    const [sectionClassrooms, setSectionClassrooms] = useState<
        SectionClassroomPair[]
    >([]);
    const [instructorOpen, setInstructorOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentSection, setCurrentSection] = useState("");
    const [currentClassroom, setCurrentClassroom] = useState("");
    const itemsPerPage = 5;

    const totalPages = Math.ceil(courses.length / itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

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
        if (["major_id", "instructor_id", "classroom_id"].includes(name)) {
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
        // Make sure we have at least one section/classroom pair
        if (sectionClassrooms.length === 0) {
            return;
        }

        // Create base course with first section/classroom pair
        const baseSection = sectionClassrooms[0];

        const newCourse: Course = {
            id: Math.max(0, ...courses.map((c) => c.id)) + 1,
            title: formData.title,
            type: formData.type || "Lecture",
            code: formData.code,
            color: formData.color || "blue",
            section_id: baseSection.section_id,
            major_id: formData.major_id,
            instructor_id: formData.instructor_id,
            classroom_id: baseSection.classroom_id,
        };

        const newCourses = [newCourse];

        // Create additional courses for each additional section/classroom pair
        if (sectionClassrooms.length > 1) {
            for (let i = 1; i < sectionClassrooms.length; i++) {
                const pair = sectionClassrooms[i];
                const additionalCourse = {
                    ...newCourse,
                    id:
                        Math.max(
                            0,
                            ...courses.map((c) => c.id),
                            ...newCourses.map((c) => c.id)
                        ) + 1,
                    section_id: pair.section_id,
                    classroom_id: pair.classroom_id,
                };
                newCourses.push(additionalCourse);
            }
        }

        setCourses([...courses, ...newCourses]);
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
                    type: formData.type || course.type,
                    code: formData.code,
                    color: formData.color,
                    section_id: sectionClassrooms[0].section_id,
                    major_id: formData.major_id,
                    instructor_id: formData.instructor_id,
                    classroom_id: sectionClassrooms[0].classroom_id,
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
        setSectionClassrooms([]);
        setCurrentSection("");
        setCurrentClassroom("");
    };

    const addSectionClassroom = () => {
        if (currentSection && currentClassroom) {
            const newPair = {
                id: sectionClassrooms.length + 1,
                section_id: parseInt(currentSection),
                classroom_id: parseInt(currentClassroom),
            };

            setSectionClassrooms([...sectionClassrooms, newPair]);

            // Reset section and classroom inputs
            setCurrentSection("");
            setCurrentClassroom("");
        }
    };

    const removeSectionClassroom = (id: number) => {
        setSectionClassrooms(
            sectionClassrooms.filter((pair) => pair.id !== id)
        );
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
        return classroom ? classroom.code : "Unknown";
    };

    const getMajorTag = (majorId: number) => {
        const major = majors.find((m) => m.id === majorId);
        return major ? major.short_tag : "Unknown";
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

        // Initialize with the current section/classroom
        setSectionClassrooms([
            {
                id: 1,
                section_id: course.section_id,
                classroom_id: course.classroom_id,
            },
        ]);

        setIsEditDialogOpen(true);
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
                                    {course.section_id}
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

                        <div className="space-y-2">
                            <Label htmlFor="instructor_id">Instructor</Label>
                            <Popover
                                open={instructorOpen}
                                onOpenChange={setInstructorOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={instructorOpen}
                                        className="w-full justify-between"
                                    >
                                        {formData.instructor_id
                                            ? getInstructorName(
                                                  formData.instructor_id
                                              )
                                            : "Select instructor..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput placeholder="Search instructor..." />
                                        <CommandEmpty>
                                            No instructor found.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {instructors.map((instructor) => (
                                                <CommandItem
                                                    key={instructor.id}
                                                    value={`${instructor.first_name} ${instructor.last_name}`}
                                                    onSelect={() => {
                                                        handleSelectChange(
                                                            "instructor_id",
                                                            instructor.id.toString()
                                                        );
                                                        setInstructorOpen(
                                                            false
                                                        );
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 ${
                                                            formData.instructor_id ===
                                                            instructor.id
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        }`}
                                                    />
                                                    {instructor.first_name}{" "}
                                                    {instructor.last_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Section and Classroom pairs - Improved UI */}
                        <div className="space-y-6">
                            <div>
                                <Label className="text-base font-medium">
                                    Sections and Classrooms
                                </Label>
                                <p className="text-sm text-gray-500 mt-1">
                                    Assign classrooms to course sections
                                </p>
                            </div>

                            {sectionClassrooms.length > 0 && (
                                <div className="space-y-2 mb-2">
                                    {sectionClassrooms.map((pair) => (
                                        <Card
                                            key={pair.id}
                                            className="p-3 flex justify-between items-center"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <Badge
                                                    variant="outline"
                                                    className="bg-blue-50"
                                                >
                                                    Section {pair.section_id}
                                                </Badge>
                                                <span className="text-gray-400">
                                                    →
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="bg-gray-50"
                                                >
                                                    Room{" "}
                                                    {getClassroomName(
                                                        pair.classroom_id
                                                    )}
                                                </Badge>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    removeSectionClassroom(
                                                        pair.id
                                                    )
                                                }
                                                className="h-8 w-8"
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-end gap-3">
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="section">Section</Label>
                                    <Input
                                        id="section"
                                        type="number"
                                        placeholder="Enter section number"
                                        min="1"
                                        value={currentSection}
                                        onChange={(e) =>
                                            setCurrentSection(e.target.value)
                                        }
                                    />
                                </div>

                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="classroom">Classroom</Label>
                                    <Select
                                        value={currentClassroom}
                                        onValueChange={setCurrentClassroom}
                                    >
                                        <SelectTrigger id="classroom">
                                            <SelectValue placeholder="Select classroom" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {classrooms.map((classroom) => (
                                                <SelectItem
                                                    key={classroom.id}
                                                    value={classroom.id.toString()}
                                                >
                                                    {classroom.code} (
                                                    {classroom.type})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={addSectionClassroom}
                                    disabled={
                                        !currentSection || !currentClassroom
                                    }
                                    className="flex-shrink-0"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add
                                </Button>
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
                        <Button
                            onClick={handleAddCourse}
                            disabled={
                                sectionClassrooms.length === 0 ||
                                !formData.title ||
                                !formData.code ||
                                !formData.major_id ||
                                !formData.instructor_id
                            }
                        >
                            Add Course
                        </Button>
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

                        <div className="space-y-2">
                            <Label htmlFor="edit-instructor_id">
                                Instructor
                            </Label>
                            <Popover
                                open={instructorOpen}
                                onOpenChange={setInstructorOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={instructorOpen}
                                        className="w-full justify-between"
                                    >
                                        {formData.instructor_id
                                            ? getInstructorName(
                                                  formData.instructor_id
                                              )
                                            : "Select instructor..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput placeholder="Search instructor..." />
                                        <CommandEmpty>
                                            No instructor found.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {instructors.map((instructor) => (
                                                <CommandItem
                                                    key={instructor.id}
                                                    value={`${instructor.first_name} ${instructor.last_name}`}
                                                    onSelect={() => {
                                                        handleSelectChange(
                                                            "instructor_id",
                                                            instructor.id.toString()
                                                        );
                                                        setInstructorOpen(
                                                            false
                                                        );
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 ${
                                                            formData.instructor_id ===
                                                            instructor.id
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        }`}
                                                    />
                                                    {instructor.first_name}{" "}
                                                    {instructor.last_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Section and Classroom pairs - Improved UI */}
                        <div className="space-y-6">
                            <div>
                                <Label className="text-base font-medium">
                                    Sections and Classrooms
                                </Label>
                                <p className="text-sm text-gray-500 mt-1">
                                    Assign classrooms to course sections
                                </p>
                            </div>

                            {sectionClassrooms.length > 0 && (
                                <div className="space-y-2 mb-2">
                                    {sectionClassrooms.map((pair) => (
                                        <Card
                                            key={pair.id}
                                            className="p-3 flex justify-between items-center"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <Badge
                                                    variant="outline"
                                                    className="bg-blue-50"
                                                >
                                                    Section {pair.section_id}
                                                </Badge>
                                                <span className="text-gray-400">
                                                    →
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="bg-gray-50"
                                                >
                                                    Room{" "}
                                                    {getClassroomName(
                                                        pair.classroom_id
                                                    )}
                                                </Badge>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    removeSectionClassroom(
                                                        pair.id
                                                    )
                                                }
                                                className="h-8 w-8"
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-end gap-3">
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="edit-section">
                                        Section
                                    </Label>
                                    <Input
                                        id="edit-section"
                                        type="number"
                                        placeholder="Enter section number"
                                        min="1"
                                        value={currentSection}
                                        onChange={(e) =>
                                            setCurrentSection(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="edit-classroom">
                                        Classroom
                                    </Label>
                                    <Select
                                        value={currentClassroom}
                                        onValueChange={setCurrentClassroom}
                                    >
                                        <SelectTrigger id="edit-classroom">
                                            <SelectValue placeholder="Select classroom" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {classrooms.map((classroom) => (
                                                <SelectItem
                                                    key={classroom.id}
                                                    value={classroom.id.toString()}
                                                >
                                                    {classroom.code} (
                                                    {classroom.type})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={addSectionClassroom}
                                    disabled={
                                        !currentSection || !currentClassroom
                                    }
                                    className="flex-shrink-0"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add
                                </Button>
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
