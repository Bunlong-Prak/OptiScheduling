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
        const existingInstructor = instructors.find(
            (instructor) =>
                instructor.email === email.trim() &&
                (!selectedInstructor || instructor.id !== selectedInstructor.id)
        );

        if (existingInstructor) {
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
        type: string = "text"
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
                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                        validationErrors[name as keyof ValidationErrors]
                            ? "border-red-300 focus:border-red-500 animate-pulse"
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

            // Validate form data with Zod
            const validatedData = instructorSchema.parse({
                first_name: formData.first_name,
                last_name: formData.last_name,
                gender: formData.gender,
                email: formData.email,
                phone_number: formData.phone_number,
            });

            // Check if email already exists (excluding current instructor)
            const existingInstructor = instructors.find(
                (instructor) =>
                    instructor.email === validatedData.email &&
                    instructor.id !== selectedInstructor.id
            );

            if (existingInstructor) {
                showErrorMessage(
                    "Email Already Exists",
                    "Another instructor with this email already exists"
                );
                return;
            }

            const apiData = {
                id: selectedInstructor.id,
                instructor_id: formData.instructor_id,
                first_name: validatedData.first_name,
                last_name: validatedData.last_name,
                gender: validatedData.gender,
                email: validatedData.email,
                phone_number: validatedData.phone_number || "",
            };

            const scheduleId = params.id;
            const response = await fetch(
                `/api/instructors/?scheduleId=${scheduleId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(apiData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to update instructor"
                );
            }

            await fetchInstructors();
            setIsEditDialogOpen(false);
            resetForm();
            showSuccessMessage(
                "Instructor Updated Successfully",
                `${formData.first_name} ${formData.last_name} has been updated successfully.`
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
                console.error("Error updating instructor:", error);
                showErrorMessage(
                    "Failed to Update Instructor",
                    error instanceof Error
                        ? error.message
                        : "Failed to update instructor. Please try again."
                );
            }
        }
    };

    const handleDeleteInstructor = async () => {
        if (!selectedInstructor) return;

        const instructorName = `${selectedInstructor.first_name} ${selectedInstructor.last_name}`;

        try {
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
        }
    };

    // Clear all instructors function
    const handleClearAllInstructors = async () => {
        const instructorCount = instructors.length;

        try {
            const scheduleId = params.id;
            // Delete all instructors one by one
            const deletePromises = instructors.map((instructor) =>
                fetch(`/api/instructors/?scheduleId=${scheduleId}`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                })
            );

            await Promise.all(deletePromises);
            await fetchInstructors();
            setIsClearAllDialogOpen(false);
            showSuccessMessage(
                "All Instructors Deleted",
                `Successfully deleted ${instructorCount} instructors`
            );
        } catch (error) {
            console.error("Error clearing all instructors:", error);
            showErrorMessage(
                "Failed to Delete All Instructors",
                "Failed to delete all instructors. Please try again."
            );
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

                        await new Promise((resolve) =>
                            setTimeout(resolve, 100)
                        );
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
    };

    // Include instructor_id in edit dialog
    const openEditDialog = async (instructor: Instructor) => {
        resetForm();
        setSelectedInstructor(instructor);
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

    const openDeleteDialog = (instructor: Instructor) => {
        setSelectedInstructor(instructor);
        setIsDeleteDialogOpen(true);
    };

    const openAddDialog = () => {
        resetForm();
        setIsAddDialogOpen(true);
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
                            onClick={() => setIsImportDialogOpen(true)}
                            variant="outline"
                            className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs px-3 py-1.5 rounded-md"
                        >
                            <Upload className="mr-1 h-3 w-3" /> Import CSV
                        </Button>
                        <Button
                            onClick={downloadInstructorsCSV}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={instructors.length === 0}
                        >
                            <Download className="mr-1 h-3 w-3" /> Export CSV
                        </Button>
                        <Button
                            onClick={openAddDialog}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                        >
                            <Plus className="mr-1 h-3 w-3" /> New Instructor
                        </Button>
                        <Button
                            onClick={() => setIsClearAllDialogOpen(true)}
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
                                "Enter instructor ID (optional)"
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
                            {renderFormField(
                                "edit-instructor_id",
                                "instructor_id",
                                "Instructor ID",
                                formData.instructor_id,
                                "Enter instructor ID (optional)"
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                {renderFormField(
                                    "edit-first_name",
                                    "first_name",
                                    "First Name",
                                    formData.first_name,
                                    "Enter first name",
                                    true
                                )}
                                {renderFormField(
                                    "edit-last_name",
                                    "last_name",
                                    "Last Name",
                                    formData.last_name,
                                    "Enter last name",
                                    true
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
                                "edit-email",
                                "email",
                                "Email",
                                formData.email,
                                "Enter email address",
                                true,
                                "email"
                            )}

                            {renderFormField(
                                "edit-phone_number",
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
                                    setIsEditDialogOpen(false);
                                }}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleEditInstructor}
                                disabled={hasValidationErrors()}
                                className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-sm px-3 py-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                Save
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
                            <p className="text-sm text-gray-600 mb-2">
                                Are you sure you want to delete this instructor?
                            </p>
                            <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                                {selectedInstructor?.first_name}{" "}
                                {selectedInstructor?.last_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                This action cannot be undone.
                            </p>
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
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5"
                            >
                                Delete
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
                            <p className="text-sm text-gray-600 mb-2">
                                Are you sure you want to delete all{" "}
                                {instructors.length} instructors?
                            </p>
                            <p className="text-xs text-red-600 font-medium">
                                This action cannot be undone.
                            </p>
                        </div>

                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsClearAllDialogOpen(false)}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleClearAllInstructors}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5"
                            >
                                Delete All
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
