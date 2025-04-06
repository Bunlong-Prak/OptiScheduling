"use client";

import { Classroom, Course, Instructor, Major } from "@/app/types";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown, Pencil, Plus, Trash } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// Define types based on API structure

export default function CoursesView() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [majors, setMajors] = useState<Major[]>([]);
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [sectionClassrooms, setSectionClassrooms] = useState<
        { id: number; section_id: string; classroom_id: string }[]
    >([]);
    const [currentSection, setCurrentSection] = useState("");
    const [currentClassroom, setCurrentClassroom] = useState("");
    const [formData, setFormData] = useState({
        title: "",
        code: "",
        major: "",
        color: "",
        instructorId: "", // Store ID instead of name
        instructorName: "", // Keep name for display purposes
        duration: 0,
        capacity: 0,
        section: "",
        classroom: "",
    });

    const [instructorOpen, setInstructorOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch all data on component mount
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch courses
                const scheduleId = params.id;
                const response = await fetch(
                    `/api/courses?scheduleId=${scheduleId}`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("API error:", errorData);
                    throw new Error(
                        errorData.error || "Failed to fetch courses"
                    );
                }

                const coursesData = await response.json();
                setCourses(coursesData);

                // Fetch majors
                const majorsRes = await fetch("/api/majors");
                if (majorsRes.ok) {
                    const majorsData = await majorsRes.json();
                    setMajors(majorsData);
                }

                // Fetch instructors
                const instructorsRes = await fetch("/api/instructors");
                if (instructorsRes.ok) {
                    const instructorsData = await instructorsRes.json();
                    setInstructors(instructorsData);
                }

                // Fetch classrooms
                const classroomsRes = await fetch("/api/classrooms");
                if (classroomsRes.ok) {
                    const classroomsData = await classroomsRes.json();
                    setClassrooms(classroomsData);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

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
        if (name === "duration") {
            setFormData({
                ...formData,
                [name]: parseInt(value),
            });
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }
    };
    const params = useParams();

    const handleAddCourse = async () => {
        // Make sure we have at least one section/classroom pair
        if (sectionClassrooms.length === 0) {
            return;
        }
        try {
            const scheduleId = params.id;

            // Create an array of section/classroom pairs
            const sections = sectionClassrooms.map((pair) => ({
                section: pair.section_id,
                classroom: pair.classroom_id,
            }));

            // Create API payload with the base course data, all sections, and schedule ID
            const apiData = {
                code: formData.code,
                title: formData.title,
                major: formData.major,
                color: formData.color,
                instructor: formData.instructorId, // Send ID instead of name
                duration: Number(formData.duration),
                capacity: Number(formData.capacity),
                sectionClassroom: sections,
                scheduleId: Number(scheduleId), // Add schedule ID from URL
            };

            const response = await fetch("/api/courses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (response.ok) {
                // Refresh course list after adding
                const refreshResponse = await fetch(
                    `/api/courses?scheduleId=${scheduleId}`
                );
                if (refreshResponse.ok) {
                    const refreshedCourses = await refreshResponse.json();
                    setCourses(refreshedCourses);
                }
                setIsAddDialogOpen(false);
                resetForm();
            } else {
                const error = await response.json();
                console.error("Error adding courses:", error);
            }
        } catch (error) {
            console.error("Error adding courses:", error);
        }
    };

    const handleEditCourse = async () => {
        // Make sure we have at least one section/classroom pair
        if (sectionClassrooms.length === 0) {
            return;
        }

        try {
            // Create an array of section/classroom pairs
            const sections = sectionClassrooms.map((pair) => ({
                section: pair.section_id,
                classroom: pair.classroom_id,
            }));

            // Create API payload with the base course data and the sectionId from the selectedCourse
            const apiData = {
                sectionId: selectedCourse?.sectionId,
                code: formData.code,
                title: formData.title,
                major: formData.major,
                color: formData.color,
                instructor: formData.instructorId, // FIXED: Using instructor ID
                duration: Number(formData.duration),
                capacity: Number(formData.capacity),
                sectionClassroom: sections,
            };
            console.log("Sending to API:", apiData);
            const response = await fetch("/api/courses", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (response.ok) {
                // Refresh course list after editing
                const refreshResponse = await fetch("/api/courses");
                if (refreshResponse.ok) {
                    const refreshedCourses = await refreshResponse.json();
                    setCourses(refreshedCourses);
                }
                setIsEditDialogOpen(false);
                resetForm();
            } else {
                const error = await response.json();
                console.error("Error editing course:", error);
                // Optional: Display error to user
            }
        } catch (error) {
            console.error("Error editing course:", error);
        }
    };

    const handleDeleteCourse = async () => {
        if (!selectedCourse?.sectionId) return;

        try {
            const response = await fetch("/api/courses", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sectionId: selectedCourse.sectionId,
                }),
            });

            if (response.ok) {
                // Update local state to remove the deleted course
                setCourses(
                    courses.filter(
                        (course) =>
                            course.sectionId !== selectedCourse.sectionId
                    )
                );
                setIsDeleteDialogOpen(false);
                resetForm();
            } else {
                const error = await response.json();
                console.error("Error deleting course:", error);
                // Handle error feedback to user
            }
        } catch (error) {
            console.error("Error deleting course:", error);
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            code: "",
            major: "",
            color: "",
            instructorId: "", // FIXED: New structure
            instructorName: "", // FIXED: New structure
            duration: 0,
            capacity: 0,
            section: "",
            classroom: "",
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
                section_id: currentSection,
                classroom_id: currentClassroom,
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

    const openEditDialog = (course: Course) => {
        setSelectedCourse(course);
        setFormData({
            title: course.title,
            code: course.code,
            major: course.major,
            color: course.color,
            instructorId: course.instructorId || "", // Use instructor ID
            instructorName: `${course.firstName || ""} ${
                course.lastName || ""
            }`.trim(), // Use full name for display
            duration: course.duration,
            capacity: course.capacity,
            section: course.section,
            classroom: course.classroom,
        });

        // Initialize with the current section/classroom
        setSectionClassrooms([
            {
                id: 1,
                section_id: course.section,
                classroom_id: course.classroom,
            },
        ]);

        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (course: Course) => {
        setSelectedCourse(course);
        setIsDeleteDialogOpen(true);
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

            {isLoading ? (
                <div>Loading courses...</div>
            ) : (
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
                                    Capacity
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.map((course) => (
                                <tr key={course.sectionId}>
                                    <td className="border p-2">
                                        {course.code}
                                    </td>
                                    <td className="border p-2">
                                        {course.title}
                                    </td>
                                    <td className="border p-2">
                                        {course.section}
                                    </td>
                                    <td className="border p-2">
                                        {`${course.firstName || ""} ${
                                            course.lastName || ""
                                        }`}
                                    </td>
                                    <td className="border p-2">
                                        {course.classroom}
                                    </td>
                                    <td className="border p-2">
                                        {course.major}
                                    </td>
                                    <td className="border p-2">
                                        {course.capacity}
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
            )}

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
                                <Label htmlFor="major">Major</Label>
                                <Select
                                    value={formData.major}
                                    onValueChange={(value) =>
                                        handleSelectChange("major", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select major" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {majors.map((major) => (
                                            <SelectItem
                                                key={major.id}
                                                value={major.name}
                                            >
                                                {major.name}
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
                            <Label htmlFor="instructor">Instructor</Label>
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
                                        {formData.instructorName
                                            ? formData.instructorName
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
                                                    value={`${instructor.first_name} ${instructor.last_name} (ID: ${instructor.id})`}
                                                    onSelect={() => {
                                                        setFormData({
                                                            ...formData,
                                                            instructorId:
                                                                instructor.id.toString(),
                                                            instructorName: `${instructor.first_name} ${instructor.last_name}`,
                                                        });
                                                        setInstructorOpen(
                                                            false
                                                        );
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 ${
                                                            formData.instructorId ===
                                                            instructor.id.toString()
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        }`}
                                                    />
                                                    {instructor.first_name}{" "}
                                                    {instructor.last_name}
                                                    <span className="ml-2 text-xs text-gray-500">
                                                        (ID: {instructor.id})
                                                    </span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="duration">
                                    Duration (hours)
                                </Label>
                                <Input
                                    id="duration"
                                    name="duration"
                                    type="number"
                                    min="1"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="capacity">Capacity</Label>
                                <Input
                                    id="capacity"
                                    name="capacity"
                                    type="number"
                                    min="1"
                                    value={formData.capacity}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* Section and Classroom pairs */}
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
                                        <div
                                            key={pair.id}
                                            className="p-3 border rounded-md flex justify-between items-center"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <span className="bg-blue-50 px-2 py-1 rounded-md text-sm">
                                                    Section {pair.section_id}
                                                </span>
                                                <span className="text-gray-400">
                                                    →
                                                </span>
                                                <span className="bg-gray-50 px-2 py-1 rounded-md text-sm">
                                                    Room {pair.classroom_id}
                                                </span>
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
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-end gap-3">
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="section">Section</Label>
                                    <Input
                                        id="section"
                                        placeholder="Enter section number"
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
                                                    value={classroom.code}
                                                >
                                                    {classroom.code}
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
                                !formData.title ||
                                !formData.code ||
                                !formData.major ||
                                !formData.instructorId || // FIXED: Checking instructor ID
                                sectionClassrooms.length === 0
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
                                <Label htmlFor="edit-major">Major</Label>
                                <Select
                                    value={formData.major}
                                    onValueChange={(value) =>
                                        handleSelectChange("major", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select major" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {majors.map((major) => (
                                            <SelectItem
                                                key={major.id}
                                                value={major.name}
                                            >
                                                {major.name}
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
                            <Label htmlFor="edit-instructor">Instructor</Label>
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
                                        {formData.instructorName
                                            ? formData.instructorName
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
                                                    value={`${instructor.first_name} ${instructor.last_name} (ID: ${instructor.id})`}
                                                    onSelect={() => {
                                                        setFormData({
                                                            ...formData,
                                                            instructorId:
                                                                instructor.id.toString(),
                                                            instructorName: `${instructor.first_name} ${instructor.last_name}`,
                                                        });
                                                        setInstructorOpen(
                                                            false
                                                        );
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 ${
                                                            formData.instructorId ===
                                                            instructor.id.toString()
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        }`}
                                                    />
                                                    {instructor.first_name}{" "}
                                                    {instructor.last_name}
                                                    <span className="ml-2 text-xs text-gray-500">
                                                        (ID: {instructor.id})
                                                    </span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-duration">
                                    Duration (hours)
                                </Label>
                                <Input
                                    id="edit-duration"
                                    name="duration"
                                    type="number"
                                    min="1"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="capacity">Capacity</Label>
                                <Input
                                    id="capacity"
                                    name="capacity"
                                    type="number"
                                    min="1"
                                    value={formData.capacity}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* Section and Classroom pairs */}
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
                                        <div
                                            key={pair.id}
                                            className="p-3 border rounded-md flex justify-between items-center"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <span className="bg-blue-50 px-2 py-1 rounded-md text-sm">
                                                    Section {pair.section_id}
                                                </span>
                                                <span className="text-gray-400">
                                                    →
                                                </span>
                                                <span className="bg-gray-50 px-2 py-1 rounded-md text-sm">
                                                    Room {pair.classroom_id}
                                                </span>
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
                                        </div>
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
                                        placeholder="Enter section number"
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
                                                    value={classroom.code}
                                                >
                                                    {classroom.code}
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
        </div>
    );
}
