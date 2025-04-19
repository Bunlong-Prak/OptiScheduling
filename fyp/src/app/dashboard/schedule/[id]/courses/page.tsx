"use client";

import { Classroom, Course, Instructor, Major } from "@/app/types";
import CustomPagination from "@/components/custom/pagination";
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

import { colors, getColorName } from "@/components/custom/colors";
// Number of courses to show per page
const ITEMS_PER_PAGE = 10;

export default function CoursesView() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [majors, setMajors] = useState<Major[]>([]);
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [sections, setSections] = useState<
        { id: number; section_id: string }[]
    >([]);
    const [currentSection, setCurrentSection] = useState("");
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
    });

    const [instructorOpen, setInstructorOpen] = useState(false);
    // const [isLoading, setIsLoading] = useState(true);

    // Clear status message after 5 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    // Fetch all data on component mount
    useEffect(() => {
        fetchData();
    }, []);

    // Update total pages when courses or items per page changes
    useEffect(() => {
        setTotalPages(Math.ceil(courses.length / ITEMS_PER_PAGE));
    }, [courses]);

    // Get current courses
    const paginatedCourses = courses.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const params = useParams();

    const fetchData = async () => {
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
                throw new Error(errorData.error || "Failed to fetch courses");
            }

            const coursesData = await response.json();
            setCourses(coursesData);

            // Reset to first page when data changes
            setCurrentPage(1);

            // Calculate total pages
            setTotalPages(Math.ceil(coursesData.length / ITEMS_PER_PAGE));

            // Fetch majors
            const majorsRes = await fetch(
                `/api/majors?scheduleId=${scheduleId}`
            );
            if (majorsRes.ok) {
                const majorsData = await majorsRes.json();
                setMajors(majorsData);
            }

            // Fetch instructors
            const instructorsRes = await fetch(
                `/api/instructors?scheduleId=${scheduleId}`
            );
            if (instructorsRes.ok) {
                const instructorsData = await instructorsRes.json();
                setInstructors(instructorsData);
            }

            // Fetch classrooms
            const classroomsRes = await fetch(
                `/api/classrooms?scheduleId=${scheduleId}`
            );
            if (classroomsRes.ok) {
                const classroomsData = await classroomsRes.json();
                setClassrooms(classroomsData);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            setStatusMessage({
                text: "Failed to load courses. Please try again.",
                type: "error",
            });
        }
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

    const handleAddCourse = async () => {
        // Make sure we have at least one section
        if (sections.length === 0) {
            return;
        }
        try {
            const scheduleId = params.id;

            // Create an array of sections
            const sectionsList = sections.map((item) => ({
                section: item.section_id,
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
                sections: sectionsList,
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
                await fetchData();
                setIsAddDialogOpen(false);
                resetForm();
                setStatusMessage({
                    text: "Course added successfully",
                    type: "success",
                });
            } else {
                const error = await response.json();
                console.error("Error adding courses:", error);
                setStatusMessage({
                    text: "Failed to add course. Please try again.",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error adding courses:", error);
            setStatusMessage({
                text: "Failed to add course. Please try again.",
                type: "error",
            });
        }
    };

    const handleEditCourse = async () => {
        // Make sure we have at least one section
        if (sections.length === 0) {
            setStatusMessage({
                text: "At least one section is required",
                type: "error",
            });
            return;
        }

        try {
            // Ensure all required fields have values and proper types
            if (!selectedCourse?.sectionId) {
                setStatusMessage({
                    text: "Missing section ID",
                    type: "error",
                });
                return;
            }

            // Ensure sectionId is a number (API expects number)
            const sectionId =
                typeof selectedCourse.sectionId === "number"
                    ? selectedCourse.sectionId
                    : Number(selectedCourse.sectionId);

            if (isNaN(sectionId)) {
                setStatusMessage({
                    text: "Invalid section ID format",
                    type: "error",
                });
                return;
            }

            // Create an array of sections
            const sectionsList = sections.map((item) => ({
                section: item.section_id,
            }));

            // Convert instructorId to string safely, without using trim()
            const instructorId =
                formData.instructorId !== null &&
                formData.instructorId !== undefined
                    ? String(formData.instructorId)
                    : "";

            if (!instructorId) {
                setStatusMessage({
                    text: "Instructor ID is required",
                    type: "error",
                });
                return;
            }

            // Pre-validate all required fields
            if (
                !formData.title ||
                !formData.code ||
                !formData.major ||
                !formData.color
            ) {
                setStatusMessage({
                    text: "All course fields are required",
                    type: "error",
                });
                return;
            }

            // Create API payload with the base course data and the sectionId from the selectedCourse
            const apiData = {
                sectionId: sectionId,
                code: formData.code,
                title: formData.title,
                major: formData.major,
                color: formData.color,
                instructor: instructorId,
                duration: Number(formData.duration) || 1,
                capacity: Number(formData.capacity) || 1,
                sections: sectionsList,
            };

            console.log("Sending to API:", apiData);

            const response = await fetch("/api/courses", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            // Handle the response
            let responseData;
            const responseText = await response.text();

            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch (e) {
                console.error("Error parsing response:", e);
                responseData = { error: "Invalid response format" };
            }

            if (!response.ok) {
                console.error("API Error Response:", responseData);

                // Handle validation errors specifically
                if (
                    responseData.error === "Validation failed" &&
                    responseData.details
                ) {
                    // Format validation errors into a readable message
                    const errorMessages = Array.isArray(responseData.details)
                        ? responseData.details
                              .map((err: { message: string }) => err.message)
                              .join(", ")
                        : JSON.stringify(responseData.details);

                    throw new Error(`Validation failed: ${errorMessages}`);
                }

                throw new Error(
                    responseData.error || "Failed to update course"
                );
            }

            // Refresh course list after editing
            await fetchData();
            setIsEditDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Course updated successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error editing course:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to update course. Please try again.",
                type: "error",
            });
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
                setStatusMessage({
                    text: "Course deleted successfully",
                    type: "success",
                });
            } else {
                const error = await response.json();
                console.error("Error deleting course:", error);
                setStatusMessage({
                    text: "Failed to delete course. Please try again.",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error deleting course:", error);
            setStatusMessage({
                text: "Failed to delete course. Please try again.",
                type: "error",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            code: "",
            major: "",
            color: "",
            instructorId: "",
            instructorName: "",
            duration: 0,
            capacity: 0,
            section: "",
        });
        setSelectedCourse(null);
        setSections([]);
        setCurrentSection("");
    };

    const addSection = () => {
        if (currentSection) {
            const newSection = {
                id: sections.length + 1,
                section_id: currentSection,
            };

            setSections([...sections, newSection]);

            // Reset section input
            setCurrentSection("");
        }
    };

    const removeSection = (id: number) => {
        setSections(sections.filter((section) => section.id !== id));
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
        });

        // Initialize with the current section
        setSections([
            {
                id: 1,
                section_id: course.section,
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
                <h2 className="text-xl font-bold">Courses</h2>
                <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <Plus className="mr-2 h-4 w-4" /> New Course
                </Button>
            </div>

            <>
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
                            {courses.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="border p-4 text-center text-gray-500"
                                    >
                                        No courses found. Add a new course to
                                        get started.
                                    </td>
                                </tr>
                            ) : paginatedCourses.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="border p-4 text-center text-gray-500"
                                    >
                                        No courses found on this page.
                                    </td>
                                </tr>
                            ) : (
                                paginatedCourses.map((course) => (
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
                                            }`.trim() || "—"}
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Add pagination if we have courses */}
                {courses.length > 0 && (
                    <div className="mt-4">
                        <CustomPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </>

            {/* Add Course Dialog */}
            <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsAddDialogOpen(open);
                }}
            >
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
                                    value={formData?.color || ""}
                                    onValueChange={(value) =>
                                        handleSelectChange("color", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select color" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colors.map((color) => (
                                            <SelectItem
                                                key={color}
                                                value={color}
                                            >
                                                {getColorName(color)}
                                            </SelectItem>
                                        ))}
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

                        {/* Section list */}
                        <div className="space-y-6">
                            <div>
                                <Label className="text-base font-medium">
                                    Sections
                                </Label>
                                <p className="text-sm text-gray-500 mt-1">
                                    Add course sections
                                </p>
                            </div>

                            {sections.length > 0 && (
                                <div className="space-y-2 mb-2">
                                    {sections.map((section) => (
                                        <div
                                            key={section.id}
                                            className="p-3 border rounded-md flex justify-between items-center"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <span className="bg-blue-50 px-2 py-1 rounded-md text-sm">
                                                    Section {section.section_id}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    removeSection(section.id)
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

                                <Button
                                    onClick={addSection}
                                    disabled={!currentSection}
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
                            onClick={() => {
                                resetForm();
                                setIsAddDialogOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddCourse}
                            disabled={
                                !formData.title ||
                                !formData.code ||
                                !formData.major ||
                                !formData.instructorId ||
                                sections.length === 0
                            }
                        >
                            Add Course
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Course Dialog */}
            <Dialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsEditDialogOpen(open);
                }}
            >
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
                                <Label htmlFor="color">Color</Label>
                                <Select
                                    value={formData?.color || ""}
                                    onValueChange={(value) =>
                                        handleSelectChange("color", value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select color" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colors.map((color) => (
                                            <SelectItem
                                                key={color}
                                                value={color}
                                            >
                                                {color.charAt(0).toUpperCase() +
                                                    color.slice(1)}
                                            </SelectItem>
                                        ))}
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

                        <div className="grid grid-cols-2 gap-4">
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
                                <Label htmlFor="edit-capacity">Capacity</Label>
                                <Input
                                    id="edit-capacity"
                                    name="capacity"
                                    type="number"
                                    min="1"
                                    value={formData.capacity}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* Section list */}
                        <div className="space-y-6">
                            <div>
                                <Label className="text-base font-medium">
                                    Sections
                                </Label>
                                <p className="text-sm text-gray-500 mt-1">
                                    Add course sections
                                </p>
                            </div>

                            {sections.length > 0 && (
                                <div className="space-y-2 mb-2">
                                    {sections.map((section) => (
                                        <div
                                            key={section.id}
                                            className="p-3 border rounded-md flex justify-between items-center"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <span className="bg-blue-50 px-2 py-1 rounded-md text-sm">
                                                    Section {section.section_id}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    removeSection(section.id)
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

                                <Button
                                    onClick={addSection}
                                    disabled={!currentSection}
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
                            onClick={() => {
                                resetForm();
                                setIsEditDialogOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleEditCourse}
                            disabled={
                                !formData.title ||
                                !formData.code ||
                                !formData.major ||
                                !formData.instructorId ||
                                sections.length === 0
                            }
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Course Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (!open) setSelectedCourse(null);
                    setIsDeleteDialogOpen(open);
                }}
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
                            onClick={() => {
                                setSelectedCourse(null);
                                setIsDeleteDialogOpen(false);
                            }}
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
