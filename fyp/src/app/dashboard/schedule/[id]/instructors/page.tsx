"use client";

import type { Instructor, InstructorFormData } from "@/app/types";
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
import { instructorSchema } from "@/lib/validations/instructors";
import {
    CheckCircle,
    Download,
    Pencil,
    Plus,
    Search,
    Trash,
    Upload,
    X,
    XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

const ITEMS_PER_PAGE = 20;

// Message types
type MessageType = "success" | "error";

type Message = {
    id: string;
    type: MessageType;
    title: string;
    description: string;
};

// Validation state interface
interface ValidationErrors {
    instructor_id?: string;
    first_name?: string;
    last_name?: string;
    gender?: string;
    email?: string;
    phone_number?: string;
}

export default function InstructorsView() {
    const params = useParams();
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);

    // New message system
    const [messages, setMessages] = useState<Message[]>([]);
    const messageTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    const [selectedInstructor, setSelectedInstructor] =
        useState<Instructor | null>(null);
    const [formData, setFormData] = useState<InstructorFormData>({
        instructor_id: "",
        first_name: "",
        last_name: "",
        gender: "",
        email: "",
        phone_number: "",
    });
    const [currentPage, setCurrentPage] = useState(1);

    // Validation errors state
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
        {}
    );

    // Import state
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importProgress, setImportProgress] = useState<{
        total: number;
        completed: number;
        errors: string[];
        isImporting: boolean;
    }>({
        total: 0,
        completed: 0,
        errors: [],
        isImporting: false,
    });

    // Search and pagination state
    const [searchQuery, setSearchQuery] = useState("");

    // State for Clear All Dialog
    const [clearAllSummary, setClearAllSummary] = useState<{
        undeletableInstructors: { instructor: Instructor; reason: string }[];
        deletableInstructors: Instructor[];
        isChecking: boolean;
        isDeleting: boolean;
    }>({
        undeletableInstructors: [],
        deletableInstructors: [],
        isChecking: false,
        isDeleting: false,
    });

    // New state for single instructor deletion progress
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    // Cleanup function for message timers
    useEffect(() => {
        return () => {
            // Clear all timers when component unmounts
            messageTimersRef.current.forEach((timer) => {
                clearTimeout(timer);
            });
            messageTimersRef.current.clear();
        };
    }, []);

    // Enhanced message utility functions
    const clearAllMessages = () => {
        // Clear all existing timers
        messageTimersRef.current.forEach((timer) => {
            clearTimeout(timer);
        });
        messageTimersRef.current.clear();

        // Clear all messages
        setMessages([]);
    };

    const addMessage = (
        type: MessageType,
        title: string,
        description: string
    ) => {
        // Clear any existing messages first to prevent duplicates
        clearAllMessages();

        const newMessage: Message = {
            id: Date.now().toString(),
            type,
            title,
            description,
        };

        setMessages([newMessage]); // Only set this one message

        // Set auto-removal timer
        const timer = setTimeout(() => {
            removeMessage(newMessage.id);
        }, 5000);

        messageTimersRef.current.set(newMessage.id, timer);
    };

    const removeMessage = (messageId: string) => {
        // Clear the timer for this message
        const timer = messageTimersRef.current.get(messageId);
        if (timer) {
            clearTimeout(timer);
            messageTimersRef.current.delete(messageId);
        }

        // Remove the message
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    };

    const showSuccessMessage = (title: string, description: string) => {
        addMessage("success", title, description);
    };

    const showErrorMessage = (title: string, description: string) => {
        addMessage("error", title, description);
    };

    // Message component
    const MessageBanner = ({ message }: { message: Message }) => (
        <div
            className={`max-w-md p-4 rounded-lg shadow-xl border-l-4 transition-all duration-300 ease-in-out ${
                message.type === "success"
                    ? "bg-green-50 border-green-500 text-green-800"
                    : "bg-red-50 border-red-500 text-red-800"
            }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    {message.type === "success" ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                        <h4 className="font-semibold text-sm">
                            {message.title}
                        </h4>
                        <p className="text-sm mt-1 opacity-90">
                            {message.description}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => removeMessage(message.id)}
                    className={`ml-2 p-1 rounded-full hover:bg-opacity-20 transition-colors flex-shrink-0 ${
                        message.type === "success"
                            ? "hover:bg-green-600"
                            : "hover:bg-red-600"
                    }`}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );

    // Real-time validation functions
    const validateInstructorId = async (
        instructorId: string
    ): Promise<string | undefined> => {
        if (!instructorId.trim()) {
            return undefined; // Optional field
        }

        // Check for uniqueness in existing instructors
        const existingInstructor = instructors.find(
            (instructor) =>
                instructor.instructor_id === instructorId.trim() &&
                (!selectedInstructor || instructor.id !== selectedInstructor.id)
        );

        if (existingInstructor) {
            return "Instructor ID already exists";
        }

        return undefined;
    };

    const [hasAssignedCourses, setHasAssignedCourses] =
        useState<boolean>(false);
    const [isCheckingAssignments, setIsCheckingAssignments] =
        useState<boolean>(false);
    const [assignedCoursesInfo, setAssignedCoursesInfo] = useState<string>("");
    const [hasDuplicateName, setHasDuplicateName] = useState<boolean>(false);
    const [duplicateNameInfo, setDuplicateNameInfo] = useState<string>("");

    const checkInstructorNameDuplicate = async (
        firstName: string
    ): Promise<{ hasDuplicate: boolean; info: string }> => {
        try {
            const scheduleId = params.id;

            // Fetch all instructors from API to check for name duplicates
            const response = await fetch(
                `/api/instructors/?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch instructors");
            }

            const apiInstructors = await response.json();

            // Check if any other instructor has the same first and last name combination
            const duplicateInstructor = apiInstructors.find(
                (instructor: any) =>
                    instructor.first_name.toLowerCase().trim() ===
                    firstName.toLowerCase().trim()
            );

            console.log({ duplicateInstructor });

            if (duplicateInstructor) {
                return {
                    hasDuplicate: true,
                    info: `An instructor with the name "${firstName}" already assigned to the course
                    `,
                };
            }

            return { hasDuplicate: false, info: "" };
        } catch (error) {
            console.error("Error checking instructor name duplicate:", error);
            return { hasDuplicate: false, info: "" };
        }
    };

    const checkInstructorAssignments = async (
        instructorId: number
    ): Promise<{ hasAssignments: boolean; info: string }> => {
        try {
            setIsCheckingAssignments(true);
            const scheduleId = params.id;

            // Fetch courses for this schedule to check for instructor assignments
            const response = await fetch(
                `/api/courses/?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch courses");
            }

            const courses = await response.json();

            // Check if any course sections are assigned to this instructor by first name
            const assignedCourses = courses.filter((course: any) => {
                return course.instructorId == instructorId;
            });

            console.log({ assignedCourses });
            if (assignedCourses.length > 0) {
                const courseNames = assignedCourses
                    .map((course: any) => course.title)
                    .join(", ");
                return {
                    hasAssignments: true,
                    info: `This instructor is assigned to ${assignedCourses.length} course(s): ${courseNames}`,
                };
            }

            return { hasAssignments: false, info: "" };
        } catch (error) {
            console.error("Error checking instructor assignments:", error);
            return { hasAssignments: false, info: "" };
        } finally {
            setIsCheckingAssignments(false);
        }
    };
    const validateFirstName = (firstName: string): string | undefined => {
        if (!firstName.trim()) {
            return "First name is required";
        }
        if (firstName.trim().length < 2) {
            return "First name must be at least 2 characters";
        }
        if (!/^[a-zA-Z\s]+$/.test(firstName.trim())) {
            return "First name can only contain letters and spaces";
        }
        return undefined;
    };

    const validateLastName = (lastName: string): string | undefined => {
        if (!lastName.trim()) {
            return "Last name is required";
        }
        if (lastName.trim().length < 2) {
            return "Last name must be at least 2 characters";
        }
        if (!/^[a-zA-Z\s]+$/.test(lastName.trim())) {
            return "Last name can only contain letters and spaces";
        }
        return undefined;
    };

    const validateGender = (gender: string): string | undefined => {
        if (!gender) {
            return "Gender is required";
        }
        return undefined;
    };

    const validateEmail = (email: string): string | undefined => {
        if (!email.trim()) {
            return "Email is required";
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return "Please enter a valid email address";
        }

        // Check for uniqueness
        const existingInstructorEmail = instructors.find(
            (instructor) =>
                instructor.email === email.trim() &&
                (!selectedInstructor || instructor.id !== selectedInstructor.id)
        );

        if (existingInstructorEmail) {
            return "Email already exists";
        }

        return undefined;
    };

    const validatePhoneNumber = (phoneNumber: string): string | undefined => {
        if (!phoneNumber.trim()) {
            return undefined; // Optional field
        }

        // Allow only numbers, spaces, hyphens, parentheses, and plus sign
        const phoneRegex = /^[\d\s\-\(\)\+]+$/;
        if (!phoneRegex.test(phoneNumber.trim())) {
            return "Phone number can only contain numbers and symbols (+ - ( ) space)";
        }

        // Check minimum length (at least 7 digits)
        const digitsOnly = phoneNumber.replace(/[^\d]/g, "");
        if (digitsOnly.length < 7) {
            return "Phone number must contain at least 7 digits";
        }

        // Check for uniqueness
        const existingInstructorPhoneNumber = instructors.find(
            (instructor) =>
                instructor.phone_number === phoneNumber.trim() &&
                (!selectedInstructor || instructor.id !== selectedInstructor.id)
        );

        if (existingInstructorPhoneNumber) {
            return "Phone number already exists";
        }

        return undefined;
    };

    // Real-time validation on form data change
    const validateFormField = async (fieldName: string, value: string) => {
        let error: string | undefined;

        switch (fieldName) {
            case "instructor_id":
                error = await validateInstructorId(value);
                break;
            case "first_name":
                error = validateFirstName(value);
                break;
            case "last_name":
                error = validateLastName(value);
                break;
            case "gender":
                error = validateGender(value);
                break;
            case "email":
                error = validateEmail(value);
                break;
            case "phone_number":
                error = validatePhoneNumber(value);
                break;
        }

        setValidationErrors((prev) => ({
            ...prev,
            [fieldName]: error,
        }));
    };

    // Check if form has any validation errors
    const hasValidationErrors = (): boolean => {
        // Check for existing errors
        const hasErrors = Object.values(validationErrors).some(
            (error) => error !== undefined
        );
        if (hasErrors) return true;

        // Check for required fields
        if (
            !formData.instructor_id.trim() ||
            !formData.first_name.trim() ||
            !formData.last_name.trim() ||
            !formData.gender ||
            !formData.email.trim()
        ) {
            return true;
        }

        return false;
    };

    // Format phone number input to allow only valid characters
    const formatPhoneInput = (value: string): string => {
        // Remove any characters that aren't digits, spaces, hyphens, parentheses, or plus
        return value.replace(/[^\d\s\-\(\)\+]/g, "");
    };

    // Render form field helper function
    const renderFormField = (
        id: string,
        name: string,
        label: string,
        value: string,
        placeholder: string,
        required: boolean = false,
        type: string = "text",
        disabled: boolean = false
    ) => {
        return (
            <div className="space-y-2">
                <Label
                    htmlFor={id}
                    className="text-sm font-medium text-gray-700"
                >
                    {label}{" "}
                    {required && <span className="text-red-500">*</span>}
                </Label>
                <Input
                    id={id}
                    name={name}
                    type={type}
                    value={value}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                        validationErrors[name as keyof ValidationErrors]
                            ? "border-red-300 focus:border-red-500 animate-pulse"
                            : ""
                    } ${
                        disabled
                            ? "bg-gray-100 cursor-not-allowed opacity-60"
                            : ""
                    }`}
                />
                {validationErrors[name as keyof ValidationErrors] && (
                    <div className="flex items-center gap-1">
                        <span className="text-red-500 text-xs">❌</span>
                        <p className="text-xs text-red-600 font-medium">
                            {validationErrors[name as keyof ValidationErrors]}
                        </p>
                    </div>
                )}
            </div>
        );
    };
    // Fetch instructors from API
    const fetchInstructors = async () => {
        try {
            const scheduleId = params.id;
            const response = await fetch(
                `/api/instructors/?scheduleId=${scheduleId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch instructors");
            }
            const data = await response.json();
            setInstructors(data);
            setCurrentPage(1);
        } catch (error) {
            console.error("Error fetching instructors:", error);
            showErrorMessage(
                "Failed to Load Instructors",
                "Failed to load instructors. Please try again."
            );
        }
    };

    // Load instructors on component mount
    useEffect(() => {
        fetchInstructors();
    }, []);

    const handleInputChange = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { name, value } = e.target;

        let processedValue = value;

        // Special formatting for phone number
        if (name === "phone_number") {
            processedValue = formatPhoneInput(value);
        }

        setFormData({
            ...formData,
            [name]: processedValue,
        });

        // Validate field in real-time
        await validateFormField(name, processedValue);
    };

    const handleSelectChange = async (name: string, value: string) => {
        setFormData({
            ...formData,
            [name]: value,
        });

        // Validate field in real-time
        await validateFormField(name, value);
    };

    // Add Instructor with enhanced validation
    const handleAddInstructor = async () => {
        try {
            // Final validation before submit
            if (hasValidationErrors()) {
                showErrorMessage(
                    "Validation Error",
                    "Please fix all validation errors before submitting"
                );
                return;
            }

            // Validate form data with Zod
            const validatedData = instructorSchema.parse({
                first_name: formData.first_name,
                last_name: formData.last_name,
                gender: formData.gender,
                email: formData.email,
                phone_number: formData.phone_number,
            });

            const scheduleId = params.id;
            const apiData = {
                instructor_id: formData.instructor_id || "",
                first_name: validatedData.first_name,
                last_name: validatedData.last_name,
                gender: validatedData.gender,
                email: validatedData.email,
                phone_number: validatedData.phone_number || "",
                schedule_id: Number(scheduleId),
            };

            const response = await fetch(
                `/api/instructors/?scheduleId=${scheduleId}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(apiData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to create instructor"
                );
            }

            await fetchInstructors();
            setIsAddDialogOpen(false);
            resetForm();
            showSuccessMessage(
                "Instructor Added Successfully",
                `${formData.first_name} ${formData.last_name} has been added successfully.`
            );
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorMessage = error.errors
                    .map((err) => `${err.path.join(".")}: ${err.message}`)
                    .join(", ");
                showErrorMessage(
                    "Validation Error",
                    `Validation error: ${errorMessage}`
                );
            } else {
                console.error("Error adding instructor:", error);
                showErrorMessage(
                    "Failed to Add Instructor",
                    error instanceof Error
                        ? error.message
                        : "Failed to add instructor. Please try again."
                );
            }
        }
    };

    // Edit Instructor with enhanced validation
    const handleEditInstructor = async () => {
        if (!selectedInstructor) return;

        try {
            // Final validation before submit
            if (hasValidationErrors()) {
                showErrorMessage(
                    "Validation Error",
                    "Please fix all validation errors before submitting"
                );
                return;
            }

            const apiData = {
                id: selectedInstructor.id,
                instructor_id: formData.instructor_id,
                first_name: formData.first_name,
                last_name: formData.last_name,
                gender: formData.gender,
                email: formData.email,
                phone_number: formData.phone_number,
            };

            const response = await fetch("/api/instructors", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(apiData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to Edit instructor");
            }

            await fetchInstructors();
            setIsEditDialogOpen(false);
            setSelectedInstructor(null);
            showSuccessMessage(
                "Instructor Edited Successfully",
                `Instructor has been edited successfully.`
            );

            // Rest of the existing handleEditInstructor logic...
            // (keeping the existing validation and API call logic)
        } catch (error) {
            console.error(error);
            showErrorMessage(
                "Failed to Edit Instructor",
                "Something went wrong. Please try again later."
            );
        }
    };

    const handleDeleteInstructor = async () => {
        if (!selectedInstructor) return;

        // Prevent deletion if instructor has assignments
        if (hasAssignedCourses) {
            showErrorMessage(
                "Cannot Delete Instructor",
                "This instructor is assigned to courses and cannot be deleted. Please remove all course assignments first."
            );
            return;
        }

        // Prevent deletion if instructor has duplicate name
        if (hasDuplicateName) {
            showErrorMessage(
                "Cannot Delete Instructor",
                "This instructor has a duplicate name in the system and cannot be deleted to maintain data integrity."
            );
            return;
        }

        const instructorName = `${selectedInstructor.first_name} ${selectedInstructor.last_name}`;

        try {
            setIsDeleting(true); // Set deleting state
            const response = await fetch("/api/instructors", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id: selectedInstructor.id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to delete instructor"
                );
            }

            await fetchInstructors();
            setIsDeleteDialogOpen(false);
            setSelectedInstructor(null);
            showSuccessMessage(
                "Instructor Deleted Successfully",
                `${instructorName} has been deleted successfully.`
            );
        } catch (error) {
            console.error("Error deleting instructor:", error);
            showErrorMessage(
                "Failed to Delete Instructor",
                "Failed to delete instructor. Please try again."
            );
        } finally {
            setIsDeleting(false); // Reset deleting state
        }
    };

    // Clear all instructors function
    const handleClearAllInstructors = async () => {
        const { deletableInstructors, undeletableInstructors } =
            clearAllSummary;

        if (deletableInstructors.length === 0) {
            showErrorMessage(
                "Cannot Clear All Instructors",
                "All instructors have assignments or other issues preventing deletion. Please resolve them first."
            );
            setIsClearAllDialogOpen(false);
            return;
        }

        // Start deleting
        setClearAllSummary((prev) => ({ ...prev, isDeleting: true }));

        try {
            const deletePromises = deletableInstructors.map((instructor) =>
                fetch(`/api/instructors`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id: instructor.id }),
                })
            );

            await Promise.all(deletePromises);
            await fetchInstructors();

            showSuccessMessage(
                "Instructors Cleared",
                `Successfully deleted ${
                    deletableInstructors.length
                } instructor(s).${
                    undeletableInstructors.length > 0
                        ? ` ${undeletableInstructors.length} instructor(s) could not be deleted.`
                        : ""
                }`
            );
        } catch (error) {
            console.error("Error clearing all instructors:", error);
            showErrorMessage(
                "Failed to Delete Instructors",
                "Failed to delete some instructors. Please try again."
            );
        } finally {
            setClearAllSummary((prev) => ({ ...prev, isDeleting: false }));
            setIsClearAllDialogOpen(false);
        }
    };
    const downloadInstructorsTemplate = () => {
    try {
        const headers = ["instructor_id", "first_name", "last_name", "gender", "email", "phone_number"];
        const templateData = [
            ["1001", "John", "Smith", "Male", "john.smith@university.edu", "01234567"],
            ["1002", "Jane", "Doe", "Female", "jane.doe@university.edu", "02345678"],
            ["1003", "Mike", "Johnson", "Male", "mike.johnson@university.edu", "03456789"]
        ];

        const allRows = [headers, ...templateData];
        const csvContent = allRows
            .map(row => row
                .map(field => {
                    const fieldStr = String(field || "");
                    if (fieldStr.includes(",") || fieldStr.includes('"') || fieldStr.includes("\n")) {
                        return `"${fieldStr.replace(/"/g, '""')}"`;
                    }
                    return fieldStr;
                })
                .join(",")
            )
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "instructors_template.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showSuccessMessage("Template Downloaded", "Instructors template CSV downloaded successfully");
    } catch (error) {
        showErrorMessage("Download Failed", "Failed to download template. Please try again.");
    }
};
    // Import CSV function with proper validation and field mapping
    const handleImportCSV = async () => {
        if (!importFile) {
            showErrorMessage(
                "No File Selected",
                "Please select a CSV file to import"
            );
            return;
        }

        const scheduleId = params.id;
        setImportProgress({
            total: 0,
            completed: 0,
            errors: [],
            isImporting: true,
        });

        try {
            Papa.parse(importFile, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) =>
                    header.trim().toLowerCase().replace(/\s+/g, "_"),
                complete: async (results) => {
                    const csvData = results.data as any[];

                    // Manual validation for CSV data
                    const validInstructors: any[] = [];
                    const errors: string[] = [];

                    for (let i = 0; i < csvData.length; i++) {
                        const row = csvData[i];
                        const rowNumber = i + 1;

                        // Validate required fields
                        if (!row.first_name?.trim()) {
                            errors.push(
                                `Row ${rowNumber}: First name is required`
                            );
                            continue;
                        }
                        if (!row.last_name?.trim()) {
                            errors.push(
                                `Row ${rowNumber}: Last name is required`
                            );
                            continue;
                        }
                        if (!row.email?.trim()) {
                            errors.push(`Row ${rowNumber}: Email is required`);
                            continue;
                        }
                        if (!row.gender?.trim()) {
                            errors.push(`Row ${rowNumber}: Gender is required`);
                            continue;
                        }

                        // Validate email format
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(row.email.trim())) {
                            errors.push(
                                `Row ${rowNumber}: Invalid email format`
                            );
                            continue;
                        }

                        // Validate gender
                        const validGenders = [
                            "Male",
                            "Female",
                            "male",
                            "female",
                        ];
                        if (!validGenders.includes(row.gender.trim())) {
                            errors.push(
                                `Row ${rowNumber}: Gender must be 'Male' or 'Female'`
                            );
                            continue;
                        }

                        // Check for duplicate emails in CSV
                        const duplicateInCsv = validInstructors.find(
                            (existing) => existing.email === row.email.trim()
                        );
                        if (duplicateInCsv) {
                            errors.push(
                                `Row ${rowNumber}: Duplicate email in CSV: ${row.email}`
                            );
                            continue;
                        }

                        // Check against existing instructors
                        const existingInstructor = instructors.find(
                            (instructor) =>
                                instructor.email === row.email.trim()
                        );
                        if (existingInstructor) {
                            errors.push(
                                `Row ${rowNumber}: Email already exists in system: ${row.email}`
                            );
                            continue;
                        }

                        // Check for duplicate instructor IDs if provided
                        if (row.instructor_id?.trim()) {
                            const duplicateIdInCsv = validInstructors.find(
                                (existing) =>
                                    existing.instructor_id ===
                                    row.instructor_id.trim()
                            );
                            if (duplicateIdInCsv) {
                                errors.push(
                                    `Row ${rowNumber}: Duplicate instructor ID in CSV: ${row.instructor_id}`
                                );
                                continue;
                            }

                            const existingId = instructors.find(
                                (instructor) =>
                                    instructor.instructor_id ===
                                    row.instructor_id.trim()
                            );
                            if (existingId) {
                                errors.push(
                                    `Row ${rowNumber}: Instructor ID already exists: ${row.instructor_id}`
                                );
                                continue;
                            }
                        }

                        // Add valid instructor
                        validInstructors.push({
                            instructor_id: row.instructor_id?.trim() || "",
                            first_name: row.first_name.trim(),
                            last_name: row.last_name.trim(),
                            gender:
                                row.gender.trim().charAt(0).toUpperCase() +
                                row.gender.trim().slice(1).toLowerCase(),
                            email: row.email.trim(),
                            phone_number: row.phone_number?.trim() || "",
                        });
                    }

                    setImportProgress((prev) => ({
                        ...prev,
                        total: validInstructors.length,
                        errors,
                    }));

                    if (validInstructors.length === 0) {
                        showErrorMessage(
                            "No Valid Instructors",
                            "No valid instructors found in the CSV file"
                        );
                        setImportProgress((prev) => ({
                            ...prev,
                            isImporting: false,
                        }));
                        return;
                    }

                    // Import valid instructors
                    let completed = 0;
                    const importErrors: string[] = [...errors];

                    for (const instructor of validInstructors) {
                        try {
                            const apiData = {
                                instructor_id: instructor.instructor_id,
                                first_name: instructor.first_name,
                                last_name: instructor.last_name,
                                gender: instructor.gender,
                                email: instructor.email,
                                phone_number: instructor.phone_number,
                                schedule_id: Number(scheduleId),
                            };

                            const response = await fetch(
                                `/api/instructors/?scheduleId=${scheduleId}`,
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify(apiData),
                                }
                            );

                            if (!response.ok) {
                                const errorData = await response.json();
                                importErrors.push(
                                    `Failed to import ${
                                        instructor.first_name
                                    } ${instructor.last_name}: ${
                                        errorData.error || "Unknown error"
                                    }`
                                );
                            } else {
                                completed++;
                            }
                        } catch (error) {
                            importErrors.push(
                                `Failed to import ${instructor.first_name} ${
                                    instructor.last_name
                                }: ${
                                    error instanceof Error
                                        ? error.message
                                        : "Unknown error"
                                }`
                            );
                        }

                        setImportProgress((prev) => ({
                            ...prev,
                            completed: completed,
                            errors: importErrors,
                        }));

                        await new Promise((resolve) => setTimeout(resolve, 10));
                    }

                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));
                    await fetchInstructors();

                    if (completed > 0) {
                        showSuccessMessage(
                            "Import Completed",
                            `Successfully imported ${completed} instructor(s)${
                                importErrors.length > 0
                                    ? ` with ${importErrors.length} error(s)`
                                    : ""
                            }`
                        );
                    } else {
                        showErrorMessage(
                            "Import Failed",
                            "Failed to import any instructors"
                        );
                    }
                },
                error: (error) => {
                    console.error("CSV parsing error:", error);
                    showErrorMessage(
                        "CSV Parse Error",
                        "Failed to parse CSV file. Please check the file format."
                    );
                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));
                },
            });
        } catch (error) {
            console.error("Import error:", error);
            showErrorMessage(
                "Import Failed",
                "Failed to import instructors. Please try again."
            );
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
        }
    };

    // Export CSV function with all fields
    const downloadInstructorsCSV = () => {
        const headers = [
            "instructor_id",
            "first_name",
            "last_name",
            "gender",
            "email",
            "phone_number",
        ];

        const csvRows = instructors.map((instructor) => [
            instructor.instructor_id || "",
            instructor.first_name,
            instructor.last_name,
            instructor.gender,
            instructor.email,
            instructor.phone_number || "",
        ]);

        const allRows = [headers, ...csvRows];
        const csvContent = allRows
            .map((row) =>
                row
                    .map((field) => {
                        const fieldStr = String(field || "");
                        if (
                            fieldStr.includes(",") ||
                            fieldStr.includes('"') ||
                            fieldStr.includes("\n")
                        ) {
                            return `"${fieldStr.replace(/"/g, '""')}"`;
                        }
                        return fieldStr;
                    })
                    .join(",")
            )
            .join("\n");

        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);

        const today = new Date().toISOString().split("T")[0];
        link.setAttribute("download", `instructors_export_${today}.csv`);

        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showSuccessMessage(
            "Export Successful",
            `Exported ${instructors.length} instructors to CSV`
        );
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
                showErrorMessage(
                    "Invalid File Type",
                    "Please select a valid CSV file"
                );
                event.target.value = "";
                return;
            }
            setImportFile(file);
        } else {
            showErrorMessage(
                "No File Selected",
                "Please select a valid CSV file"
            );
            event.target.value = "";
        }
    };

    const resetImportState = () => {
        setImportFile(null);
        setImportProgress({
            total: 0,
            completed: 0,
            errors: [],
            isImporting: false,
        });
    };

    const resetForm = () => {
        setFormData({
            instructor_id: "",
            first_name: "",
            last_name: "",
            gender: "",
            email: "",
            phone_number: "",
        });
        setValidationErrors({});
        setSelectedInstructor(null);
        setHasAssignedCourses(false); // Add this line
        setAssignedCoursesInfo(""); // Add this line
        setHasDuplicateName(false); // Add this line
        setDuplicateNameInfo(""); // Add this line
    };

    // Include instructor_id in edit dialog
    const openEditDialog = async (instructor: Instructor) => {
        resetForm();
        setSelectedInstructor(instructor);

        // Check for instructor assignments by first name
        const assignmentCheck = await checkInstructorAssignments(instructor.id);
        setHasAssignedCourses(assignmentCheck.hasAssignments);
        setAssignedCoursesInfo(assignmentCheck.info);

        // Check for name duplicates
        // const nameCheck = await checkInstructorNameDuplicate(
        //     instructor.first_name
        // );
        // setHasDuplicateName(nameCheck.hasDuplicate);
        // setDuplicateNameInfo(nameCheck.info);

        setFormData({
            instructor_id: instructor.instructor_id || "",
            first_name: instructor.first_name,
            last_name: instructor.last_name,
            gender: instructor.gender,
            email: instructor.email,
            phone_number: instructor.phone_number || "",
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = async (instructor: Instructor) => {
        setSelectedInstructor(instructor);

        // Check for instructor assignments by first name
        const assignmentCheck = await checkInstructorAssignments(instructor.id);
        setHasAssignedCourses(assignmentCheck.hasAssignments);
        setAssignedCoursesInfo(assignmentCheck.info);

        // Check for name duplicates
        // const nameCheck = await checkInstructorNameDuplicate(
        //     instructor.first_name
        // );
        // setHasDuplicateName(nameCheck.hasDuplicate);
        // setDuplicateNameInfo(nameCheck.info);

        setIsDeleteDialogOpen(true);
    };

    const openAddDialog = () => {
        resetForm();
        setIsAddDialogOpen(true);
    };

    const openClearAllDialog = async () => {
        setIsClearAllDialogOpen(true);
        setClearAllSummary({
            deletableInstructors: [],
            undeletableInstructors: [],
            isChecking: true,
            isDeleting: false,
        });

        const undeletable: { instructor: Instructor; reason: string }[] = [];
        const deletableInstructors: Instructor[] = [];

        for (const instructor of instructors) {
            const assignmentCheck = await checkInstructorAssignments(
                instructor.id
            );
            if (assignmentCheck.hasAssignments) {
                undeletable.push({
                    instructor,
                    reason: assignmentCheck.info,
                });
            } else {
                deletableInstructors.push(instructor);
            }
        }

        setClearAllSummary({
            deletableInstructors,
            undeletableInstructors: undeletable,
            isDeleting: false,
            isChecking: false,
        });
    };

    // Calculate pagination values
    const filteredInstructors = useMemo(() => {
        if (!searchQuery.trim()) return instructors;

        const query = searchQuery.toLowerCase();
        return instructors.filter(
            (instructor) =>
                instructor.first_name.toLowerCase().includes(query) ||
                instructor.last_name.toLowerCase().includes(query) ||
                instructor.email.toLowerCase().includes(query) ||
                (instructor.instructor_id &&
                    instructor.instructor_id.toLowerCase().includes(query)) ||
                (instructor.phone_number &&
                    instructor.phone_number.includes(query))
        );
    }, [instructors, searchQuery]);

    // Update your pagination logic to use filteredInstructors instead of instructors
    const totalPages = Math.ceil(filteredInstructors.length / ITEMS_PER_PAGE);
    const paginatedInstructors = filteredInstructors.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <>
            {/* Messages - OUTSIDE the main content flow */}
            {messages.length > 0 && (
                <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
                    <div className="pointer-events-auto space-y-2">
                        {messages.map((message) => (
                            <MessageBanner key={message.id} message={message} />
                        ))}
                    </div>
                </div>
            )}

            {/* Main content - completely separate */}
            <div className="space-y-4">
                {/* Page Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Instructors
                        </h2>
                        <p className="text-xs text-gray-600">
                            Manage instructor information and details
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button
    onClick={downloadInstructorsTemplate} // Replace XXX with respective function name
    variant="outline"
    className="border-purple-600 text-purple-600 hover:bg-purple-50 text-xs px-3 py-1.5 rounded-md"
>
    <Download className="mr-1 h-3 w-3" /> Download Template
</Button>
                        <Button
                            onClick={() => setIsImportDialogOpen(true)}
                            variant="outline"
                            className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs px-3 py-1.5 rounded-md"
                        >
                            <Download className="mr-1 h-3 w-3" /> Import CSV
                        </Button>
                        <Button
                            onClick={downloadInstructorsCSV}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={instructors.length === 0}
                        >
                            <Upload className="mr-1 h-3 w-3" /> Export CSV
                        </Button>
                        <Button
                            onClick={openAddDialog}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                        >
                            <Plus className="mr-1 h-3 w-3" /> New Instructor
                        </Button>
                        <Button
                            onClick={openClearAllDialog} // Changed to openClearAllDialog
                            variant="outline"
                            className="border-red-600 text-red-600 hover:bg-red-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={instructors.length === 0}
                        >
                            <Trash className="mr-1 h-3 w-3" /> Clear All
                        </Button>
                    </div>
                </div>

                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search instructors by name, email, ID, or phone..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-10 pr-10 py-2 border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm rounded-md"
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSearchQuery("");
                                setCurrentPage(1);
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* Table */}
                <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#2F2F85] text-white">
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                        No.
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Instructor ID
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        First Name
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Last Name
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-20">
                                        Gender
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Phone
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-20">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredInstructors.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="px-3 py-8 text-center text-gray-500 text-sm"
                                        >
                                            <div className="space-y-1">
                                                <div>
                                                    {searchQuery
                                                        ? `No instructors found for "${searchQuery}"`
                                                        : "No instructors found"}
                                                </div>
                                                <div className="text-xs">
                                                    {searchQuery
                                                        ? "Try a different search term"
                                                        : "Add a new instructor to get started."}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedInstructors.map(
                                        (instructor, index) => (
                                            <tr
                                                key={instructor.id}
                                                className={`hover:bg-gray-50 transition-colors ${
                                                    index % 2 === 0
                                                        ? "bg-white"
                                                        : "bg-gray-50"
                                                }`}
                                            >
                                                <td className="px-3 py-2 text-xs text-gray-600 font-medium">
                                                    {(currentPage - 1) *
                                                        ITEMS_PER_PAGE +
                                                        index +
                                                        1}
                                                </td>
                                                <td className="px-3 py-2 text-xs font-medium text-gray-900">
                                                    {instructor.instructor_id ||
                                                        "-"}
                                                </td>
                                                <td className="px-3 py-2 text-xs font-medium text-gray-900">
                                                    {instructor.first_name}
                                                </td>
                                                <td className="px-3 py-2 text-xs font-medium text-gray-900">
                                                    {instructor.last_name}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-900">
                                                    {instructor.gender}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-900">
                                                    {instructor.email}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-900">
                                                    {instructor.phone_number ||
                                                        "-"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-500 hover:text-[#2F2F85] hover:bg-gray-100"
                                                            onClick={() =>
                                                                openEditDialog(
                                                                    instructor
                                                                )
                                                            }
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() =>
                                                                openDeleteDialog(
                                                                    instructor
                                                                )
                                                            }
                                                        >
                                                            <Trash className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                {filteredInstructors.length > 0 && totalPages > 1 && (
                    <div className="flex justify-center">
                        <CustomPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}

                {/* Add Instructor Dialog */}
                <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) resetForm();
                        setIsAddDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-lg">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Add New Instructor
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            {renderFormField(
                                "instructor_id",
                                "instructor_id",
                                "Instructor ID",
                                formData.instructor_id,
                                "Enter instructor ID"
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                {renderFormField(
                                    "first_name",
                                    "first_name",
                                    "First Name",
                                    formData.first_name,
                                    "Enter first name",
                                    true
                                )}
                                {renderFormField(
                                    "last_name",
                                    "last_name",
                                    "Last Name",
                                    formData.last_name,
                                    "Enter last name",
                                    true
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="gender"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Gender{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.gender}
                                    onValueChange={(value) =>
                                        handleSelectChange("gender", value)
                                    }
                                >
                                    <SelectTrigger
                                        className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                            validationErrors.gender
                                                ? "border-red-300 focus:border-red-500 animate-pulse"
                                                : ""
                                        }`}
                                    >
                                        <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">
                                            Male
                                        </SelectItem>
                                        <SelectItem value="Female">
                                            Female
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {validationErrors.gender && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-red-500 text-xs">
                                            ❌
                                        </span>
                                        <p className="text-xs text-red-600 font-medium">
                                            {validationErrors.gender}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {renderFormField(
                                "email",
                                "email",
                                "Email",
                                formData.email,
                                "Enter email address",
                                true,
                                "email"
                            )}

                            {renderFormField(
                                "phone_number",
                                "phone_number",
                                "Phone Number",
                                formData.phone_number,
                                "Enter phone number"
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    resetForm();
                                    setIsAddDialogOpen(false);
                                }}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddInstructor}
                                disabled={hasValidationErrors()}
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                Add
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Instructor Dialog */}
                <Dialog
                    open={isEditDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) resetForm();
                        setIsEditDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-lg">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Edit Instructor
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            {/* {hasAssignedCourses && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-600 text-sm">
                                            🚫
                                        </span>
                                        <p className="text-sm text-red-800 font-medium">
                                            This instructor cannot be edited
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-700 mt-1 ml-6">
                                        {assignedCoursesInfo}. Please remove all
                                        course assignments before editing this
                                        instructor.
                                    </p>
                                </div>
                            )} */}

                            {/* {hasDuplicateName && !hasAssignedCourses && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-600 text-sm">
                                            🚫
                                        </span>
                                        <p className="text-sm text-red-800 font-medium">
                                            This instructor cannot be edited
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-700 mt-1 ml-6">
                                        {duplicateNameInfo}.
                                    </p>
                                </div>
                            )} */}

                            {/* {isCheckingAssignments && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-600 text-sm">
                                            ℹ️
                                        </span>
                                        <p className="text-sm text-blue-800">
                                            Checking for course assignments and
                                            duplicate names...
                                        </p>
                                    </div>
                                </div>
                            )} */}

                            {/* Form fields - all disabled when instructor has assignments or duplicates */}
                            {renderFormField(
                                "edit-instructor_id",
                                "instructor_id",
                                "Instructor ID",
                                formData.instructor_id,
                                "Enter instructor ID",
                                false,
                                "text"
                                // hasAssignedCourses ||
                                //     hasDuplicateName ||
                                //     isCheckingAssignments
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                {renderFormField(
                                    "edit-first_name",
                                    "first_name",
                                    "First Name",
                                    formData.first_name,
                                    "Enter first name",
                                    true,
                                    "text"
                                    // hasAssignedCourses ||
                                    //     hasDuplicateName ||
                                    //     isCheckingAssignments
                                )}
                                {renderFormField(
                                    "edit-last_name",
                                    "last_name",
                                    "Last Name",
                                    formData.last_name,
                                    "Enter last name",
                                    true,
                                    "text"
                                    // hasAssignedCourses ||
                                    //     hasDuplicateName ||
                                    //     isCheckingAssignments
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-gender"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Gender{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.gender}
                                    onValueChange={(value) =>
                                        handleSelectChange("gender", value)
                                    }
                                    // disabled={
                                    //     hasAssignedCourses ||
                                    //     hasDuplicateName ||
                                    //     isCheckingAssignments
                                    // }
                                >
                                    <SelectTrigger
                                    // className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                    //     validationErrors.gender
                                    //         ? "border-red-300 focus:border-red-500 animate-pulse"
                                    //         : ""
                                    // } ${
                                    //     hasAssignedCourses ||
                                    //     hasDuplicateName ||
                                    //     isCheckingAssignments
                                    //         ? "bg-gray-100 cursor-not-allowed opacity-60"
                                    //         : ""
                                    // }`}
                                    >
                                        <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">
                                            Male
                                        </SelectItem>
                                        <SelectItem value="Female">
                                            Female
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {validationErrors.gender && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-red-500 text-xs">
                                            ❌
                                        </span>
                                        <p className="text-xs text-red-600 font-medium">
                                            {validationErrors.gender}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {renderFormField(
                                "edit-email",
                                "email",
                                "Email",
                                formData.email,
                                "Enter email address",
                                true,
                                "email"
                                // hasAssignedCourses ||
                                //     hasDuplicateName ||
                                //     isCheckingAssignments
                            )}

                            {renderFormField(
                                "edit-phone_number",
                                "phone_number",
                                "Phone Number",
                                formData.phone_number,
                                "Enter phone number",
                                false,
                                "text"
                                // hasAssignedCourses ||
                                //     hasDuplicateName ||
                                //     isCheckingAssignments
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    resetForm();
                                    setIsEditDialogOpen(false);
                                }}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleEditInstructor}
                                // disabled={
                                //     hasValidationErrors() ||
                                //     hasAssignedCourses ||
                                //     hasDuplicateName ||
                                //     isCheckingAssignments
                                // }
                                // className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {"Save"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Instructor Dialog */}
                <Dialog
                    open={isDeleteDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) setSelectedInstructor(null);
                        setIsDeleteDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Delete Instructor
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4">
                            {/* Warning message when instructor has assignments */}
                            {hasAssignedCourses && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-600 text-sm">
                                            🚫
                                        </span>
                                        <p className="text-sm text-red-800 font-medium">
                                            This instructor cannot be deleted
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-700 mt-1 ml-6">
                                        {assignedCoursesInfo}. Please remove all
                                        course assignments before deleting this
                                        instructor.
                                    </p>
                                </div>
                            )}

                            {/* Warning message when instructor has duplicate name
                            {hasDuplicateName && !hasAssignedCourses && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-600 text-sm">
                                            🚫
                                        </span>
                                        <p className="text-sm text-red-800 font-medium">
                                            This instructor cannot be deleted
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-700 mt-1 ml-6">
                                        {duplicateNameInfo}.
                                    </p>
                                </div>
                            )}

                            {isCheckingAssignments && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-600 text-sm">
                                            ℹ️
                                        </span>
                                        <p className="text-sm text-blue-800">
                                            Checking for course assignments and
                                            duplicate names...
                                        </p>
                                    </div>
                                </div>
                            )} */}

                            {/* Only show confirmation text if no assignments or duplicates */}
                            {!hasAssignedCourses &&
                                !hasDuplicateName &&
                                !isCheckingAssignments && (
                                    <>
                                        <p className="text-sm text-gray-600 mb-2">
                                            Are you sure you want to delete this
                                            instructor?
                                        </p>
                                        <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                                            {selectedInstructor?.first_name}{" "}
                                            {selectedInstructor?.last_name}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-2">
                                            This action cannot be undone.
                                        </p>
                                    </>
                                )}

                            {/* Show instructor info even when disabled */}
                            {(hasAssignedCourses || hasDuplicateName) && (
                                <div className="mt-4">
                                    <p className="text-sm text-gray-600 mb-2">
                                        Instructor Details:
                                    </p>
                                    <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                                        {selectedInstructor?.first_name}{" "}
                                        {selectedInstructor?.last_name}
                                    </p>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedInstructor(null);
                                    setIsDeleteDialogOpen(false);
                                }}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteInstructor}
                                disabled={
                                    hasAssignedCourses ||
                                    hasDuplicateName ||
                                    isCheckingAssignments ||
                                    isDeleting // Disable if deleting
                                }
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {isDeleting // Show deleting message
                                    ? "Deleting..."
                                    : hasAssignedCourses || hasDuplicateName
                                    ? "Cannot Delete"
                                    : "Delete"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Import CSV Dialog */}
                <Dialog
                    open={isImportDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) resetImportState();
                        setIsImportDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Import Instructors from CSV
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div>
                                <Label
                                    htmlFor="csv-file"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Select CSV File
                                </Label>
                                <Input
                                    id="csv-file"
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileSelect}
                                    disabled={importProgress.isImporting}
                                    className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm mt-1"
                                />
                                <p className="text-xs text-gray-600 mt-1">
                                    CSV should contain columns: instructor_id
                                    (optional), first_name, last_name, gender,
                                    email, phone_number
                                </p>
                            </div>

                            {importFile && (
                                <div className="text-xs bg-gray-50 p-2 rounded border">
                                    <p>
                                        <strong>Selected file:</strong>{" "}
                                        {importFile.name}
                                    </p>
                                    <p>
                                        <strong>Size:</strong>{" "}
                                        {(importFile.size / 1024).toFixed(2)} KB
                                    </p>
                                </div>
                            )}

                            {importProgress.isImporting && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span>Progress:</span>
                                        <span>
                                            {importProgress.completed} /{" "}
                                            {importProgress.total}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-[#2F2F85] h-2 rounded-full transition-all duration-300"
                                            style={{
                                                width:
                                                    importProgress.total > 0
                                                        ? `${
                                                              (importProgress.completed /
                                                                  importProgress.total) *
                                                              100
                                                          }%`
                                                        : "0%",
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {importProgress.errors.length > 0 && (
                                <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded border border-red-200">
                                    <p className="text-xs font-medium text-red-600 mb-1">
                                        Errors:
                                    </p>
                                    <div className="text-xs space-y-1">
                                        {importProgress.errors.map(
                                            (error, index) => (
                                                <p
                                                    key={index}
                                                    className="text-red-600"
                                                >
                                                    {error}
                                                </p>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    resetImportState();
                                    setIsImportDialogOpen(false);
                                }}
                                disabled={importProgress.isImporting}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImportCSV}
                                disabled={
                                    !importFile || importProgress.isImporting
                                }
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5"
                            >
                                {importProgress.isImporting
                                    ? "Importing..."
                                    : "Import"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Clear All Dialog */}
                <Dialog
                    open={isClearAllDialogOpen}
                    onOpenChange={setIsClearAllDialogOpen}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Clear All Instructors
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4">
                            {clearAllSummary.isChecking ? (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-600 text-sm">
                                            ℹ️
                                        </span>
                                        <p className="text-sm text-blue-800">
                                            Checking for instructor assignments
                                            and conflicts...
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Are you sure you want to proceed with
                                        clearing instructors?
                                    </p>
                                    <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border mb-2">
                                        {`Total instructors to be deleted: ${clearAllSummary.deletableInstructors.length}`}
                                    </p>

                                    {clearAllSummary.undeletableInstructors
                                        .length > 0 && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
                                            <p className="text-sm text-red-800 font-medium mb-2">
                                                The following{" "}
                                                {
                                                    clearAllSummary
                                                        .undeletableInstructors
                                                        .length
                                                }{" "}
                                                instructor(s) cannot be deleted:
                                            </p>
                                            <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                                                {clearAllSummary.undeletableInstructors.map(
                                                    (item, index) => (
                                                        <li key={index}>
                                                            <span className="font-semibold">
                                                                {
                                                                    item
                                                                        .instructor
                                                                        .first_name
                                                                }{" "}
                                                                {
                                                                    item
                                                                        .instructor
                                                                        .last_name
                                                                }
                                                                :
                                                            </span>{" "}
                                                            {item.reason}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        </div>
                                    )}

                                    <p className="text-xs text-red-600 font-medium">
                                        This action cannot be undone for deleted
                                        instructors.
                                    </p>
                                </>
                            )}
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsClearAllDialogOpen(false)}
                                disabled={
                                    clearAllSummary.isChecking ||
                                    clearAllSummary.isDeleting
                                }
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleClearAllInstructors}
                                disabled={
                                    clearAllSummary.isChecking ||
                                    clearAllSummary.deletableInstructors
                                        .length === 0 ||
                                    clearAllSummary.isDeleting
                                }
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {clearAllSummary.isChecking
                                    ? "Checking..."
                                    : clearAllSummary.isDeleting
                                    ? `Deleting ${clearAllSummary.deletableInstructors.length} instructor(s)...`
                                    : clearAllSummary.deletableInstructors
                                          .length > 0
                                    ? `Delete ${clearAllSummary.deletableInstructors.length} Instructor(s)`
                                    : "No Instructors to Delete"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
