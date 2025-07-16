"use client";

import { Classroom, Course, Instructor, Major } from "@/app/types";
import {
    colors,
    getColorName,
    getHexFromColorName,
} from "@/components/custom/colors";
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
import {
    Check,
    CheckCircle,
    ChevronsUpDown,
    Download,
    Minus,
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
import { useEffect, useRef, useState } from "react";

// Number of courses to show per page
const ITEMS_PER_PAGE = 20;

type MessageType = "success" | "error";

type Message = {
    id: string;
    type: MessageType;
    title: string;
    description: string;
};

export default function CoursesView() {
    // State variables
    const [courses, setCourses] = useState<Course[]>([]);
    const [majors, setMajors] = useState<Major[]>([]);
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Enhanced message system
    const [messages, setMessages] = useState<Message[]>([]);
    const messageTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

    const [sectionValidationError, setSectionValidationError] =
        useState<string>("");

    // Update sections state structure to include status and split durations
    const [sections, setSections] = useState<
        {
            id: number;
            section_id: string;
            instructor_id?: string;
            instructor_name?: string;
            status: string;
            splitDurations: number[];
            showSplitControls: boolean;
        }[]
    >([]);

    const [currentSection, setCurrentSection] = useState("");
    const [currentInstructor, setCurrentInstructor] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [currentInstructorOpen, setCurrentInstructorOpen] = useState(false);

    const [instructorValidationError, setInstructorValidationError] =
        useState<string>("");

    // State for managing major - updated to handle single selection
    const [selectedMajor, setSelectedMajor] = useState<string>("");

    const [formData, setFormData] = useState<{
        title: string;
        code: string;
        color: string; // This will now store hex values like "#3B82F6"
        duration: number;
        capacity: number;
        section: string;
        status: string;
    }>({
        title: "",
        code: "",
        color: "#3B82F6", // Default hex color
        duration: 0,
        capacity: 0,
        section: "",
        status: "",
    });

    // Message cleanup effect
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

    // Split duration functions for sections
    const updateSectionSplitDuration = (
        sectionId: number,
        index: number,
        duration: number
    ) => {
        console.log(
            `Updating section ${sectionId}, part ${index} to ${duration}`
        );
        const updatedSections = sections.map((section) =>
            section.id === sectionId
                ? {
                      ...section,
                      splitDurations: section.splitDurations.map((d, i) =>
                          i === index ? Number(duration) : d
                      ),
                  }
                : section
        );
        console.log("Updated sections:", updatedSections);
        setSections(updatedSections);
    };

    const addSectionSplit = (sectionId: number) => {
        setSections(
            sections.map((section) =>
                section.id === sectionId
                    ? {
                          ...section,
                          splitDurations: [...section.splitDurations, 1], // Default to 1 hour
                      }
                    : section
            )
        );
    };

    const removeSectionSplit = (sectionId: number, index: number) => {
        setSections(
            sections.map((section) =>
                section.id === sectionId
                    ? {
                          ...section,
                          splitDurations: section.splitDurations.filter(
                              (_, i) => i !== index
                          ),
                      }
                    : section
            )
        );
    };

    const getSectionTotalSplitDuration = (sectionId: number) => {
        const section = sections.find((s) => s.id === sectionId);
        const total = section
            ? section.splitDurations.reduce(
                  (sum, duration) => sum + Number(duration),
                  0
              )
            : 0;
        console.log(
            `Section ${sectionId}: splitDurations =`,
            section?.splitDurations,
            `total = ${total}, formData.duration = ${formData.duration}`
        );
        return total;
    };

    const isSectionSplitValid = (sectionId: number) => {
        const total = getSectionTotalSplitDuration(sectionId);
        const courseDuration = Number(formData.duration);
        const isValid = total === courseDuration;
        console.log(
            `Section ${sectionId}: ${total} === ${courseDuration} = ${isValid}`
        );
        return isValid;
    };

    const toggleSectionSplitControls = (sectionId: number) => {
        setSections(
            sections.map((section) =>
                section.id === sectionId
                    ? {
                          ...section,
                          showSplitControls: !section.showSplitControls,
                          splitDurations: section.showSplitControls
                              ? [formData.duration]
                              : section.splitDurations,
                      }
                    : section
            )
        );
    };

    // Fetch all data on component mount
    useEffect(() => {
        fetchData();
    }, []);

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

            const courseHoursData = await response.json();
            console.log("Original API response:", courseHoursData);

            // Group course hours by sectionId to combine separated durations
            const sectionMap = new Map();

            courseHoursData.forEach((courseHour: any) => {
                const sectionKey = courseHour.sectionId.toString();

                if (!sectionMap.has(sectionKey)) {
                    // Create a new section entry with the original Course type structure
                    sectionMap.set(sectionKey, {
                        id: courseHour.id,
                        sectionId: courseHour.sectionId,
                        title: courseHour.title,
                        code: courseHour.code,
                        year: courseHour.year,
                        major: courseHour.major,
                        color: courseHour.color,
                        firstName: courseHour.firstName,
                        lastName: courseHour.lastName,
                        instructorId: courseHour.instructorId,
                        duration: courseHour.duration,
                        separatedDuration: courseHour.separatedDuration,
                        capacity: courseHour.capacity,
                        status: courseHour.status,
                        section: courseHour.section,
                        classroom: courseHour.classroom,
                        separatedDurations: [courseHour.separatedDuration],
                        courseHours: [],
                    });
                } else {
                    // Always add separated duration to existing section
                    const sectionData = sectionMap.get(sectionKey);
                    sectionData.separatedDurations.push(
                        courseHour.separatedDuration
                    );
                }

                // Add this course hour to the section's course hours
                sectionMap.get(sectionKey).courseHours.push({
                    id: courseHour.id,
                    separatedDuration: courseHour.separatedDuration,
                    day: courseHour.day,
                    timeSlot: courseHour.timeSlot,
                });
            });

            // After grouping, calculate combined separated duration for each section
            const processedCourses = Array.from(sectionMap.values()).map(
                (course) => {
                    // Calculate the total combined separated duration
                    const combinedSeparatedDuration =
                        course.separatedDurations.reduce(
                            (total: number, duration: number) =>
                                total + duration,
                            0
                        );

                    return {
                        ...course,
                        combinedSeparatedDuration,
                        separatedDuration: course.separatedDurations[0],
                    };
                }
            );

            console.log(
                "Processed courses with combined durations:",
                processedCourses
            );

            // Set the processed courses to state
            setCourses(processedCourses);

            // Reset to first page when data changes
            setCurrentPage(1);

            // Calculate total pages
            setTotalPages(Math.ceil(processedCourses.length / ITEMS_PER_PAGE));

            // Fetch majors data
            if (scheduleId !== undefined) {
                await fetchMajors(scheduleId);
                // Fetch instructors data
                await fetchInstructors(scheduleId);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            showErrorMessage(
                "Failed to Load Courses",
                "Failed to load courses. Please try again."
            );
        }
    };

    // Add separate functions for fetching majors and instructors
    const fetchMajors = async (scheduleId: string | string[]) => {
        try {
            const response = await fetch(
                `/api/majors?scheduleId=${scheduleId}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error fetching majors:", errorData);
                throw new Error(errorData.error || "Failed to fetch majors");
            }

            const majorsData = await response.json();
            console.log("Majors data:", majorsData);
            setMajors(majorsData);
        } catch (error) {
            console.error("Error fetching majors:", error);
            showErrorMessage(
                "Failed to Load Majors",
                "Failed to load majors. Please try again."
            );
        }
    };

    const fetchInstructors = async (scheduleId: string | string[]) => {
        try {
            const response = await fetch(
                `/api/instructors?scheduleId=${scheduleId}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error fetching instructors:", errorData);
                throw new Error(
                    errorData.error || "Failed to fetch instructors"
                );
            }

            const instructorsData = await response.json();
            console.log("Instructors data:", instructorsData);
            setInstructors(instructorsData);
        } catch (error) {
            console.error("Error fetching instructors:", error);
            showErrorMessage(
                "Failed to Load Instructors",
                "Failed to load instructors. Please try again."
            );
        }
    };

    const [durationHours, setDurationHours] = useState(0);
    const [durationMinutes, setDurationMinutes] = useState(0);

    // Helper functions for duration conversion
    const convertToDecimalHours = (hours: number, minutes: number) => {
        return hours + minutes / 60;
    };

    const convertFromDecimalHours = (decimalHours: number) => {
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        return { hours, minutes };
    };

    const convertSplitDurationToHoursMinutes = (decimalHours: number) => {
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        return { hours, minutes };
    };

    const convertSplitDurationToDecimal = (hours: number, minutes: number) => {
        return hours + minutes / 60;
    };

    // Update section split duration functions
    const updateSectionSplitDurationHours = (
        sectionId: number,
        index: number,
        hours: number
    ) => {
        const section = sections.find((s) => s.id === sectionId);
        if (!section) return;

        const currentDuration = section.splitDurations[index];
        const { minutes } = convertSplitDurationToHoursMinutes(currentDuration);
        const newDuration = convertSplitDurationToDecimal(hours, minutes);

        console.log(
            `Updating section ${sectionId}, part ${index} hours to ${hours}, total: ${newDuration}`
        );

        const updatedSections = sections.map((section) =>
            section.id === sectionId
                ? {
                      ...section,
                      splitDurations: section.splitDurations.map((d, i) =>
                          i === index ? newDuration : d
                      ),
                  }
                : section
        );
        setSections(updatedSections);
    };

    const updateSectionSplitDurationMinutes = (
        sectionId: number,
        index: number,
        minutes: number
    ) => {
        const section = sections.find((s) => s.id === sectionId);
        if (!section) return;

        const currentDuration = section.splitDurations[index];
        const { hours } = convertSplitDurationToHoursMinutes(currentDuration);
        const newDuration = convertSplitDurationToDecimal(hours, minutes);

        console.log(
            `Updating section ${sectionId}, part ${index} minutes to ${minutes}, total: ${newDuration}`
        );

        const updatedSections = sections.map((section) =>
            section.id === sectionId
                ? {
                      ...section,
                      splitDurations: section.splitDurations.map((d, i) =>
                          i === index ? newDuration : d
                      ),
                  }
                : section
        );
        setSections(updatedSections);
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;

        if (name === "durationHours") {
            const newHours = parseInt(value) || 0;
            setDurationHours(newHours);
            const newDuration = convertToDecimalHours(
                newHours,
                durationMinutes
            );
            setFormData({
                ...formData,
                duration: newDuration,
            });
            setSections(
                sections.map((section) => ({
                    ...section,
                    splitDurations: section.showSplitControls
                        ? section.splitDurations
                        : [newDuration],
                }))
            );
        } else if (name === "durationMinutes") {
            const newMinutes = parseInt(value) || 0;
            setDurationMinutes(newMinutes);
            const newDuration = convertToDecimalHours(
                durationHours,
                newMinutes
            );
            setFormData({
                ...formData,
                duration: newDuration,
            });
            setSections(
                sections.map((section) => ({
                    ...section,
                    splitDurations: section.showSplitControls
                        ? section.splitDurations
                        : [newDuration],
                }))
            );
        } else {
            // Update formData first
            const newFormData = {
                ...formData,
                [name]: value,
            };
            setFormData(newFormData);

            // Trigger real-time validation for code and title with the new value
            if (name === "code" || name === "title") {
                validateFormWithNewData(newFormData);
            }
        }
    };

    const validateFormWithNewData = (newFormData: typeof formData) => {
        const errors: typeof validationErrors = {};

        // Validate major exists - only show "create first" message
        if (!selectedMajor && majors.length === 0) {
            errors.major = "Please create a major first";
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Update the existing validateForm function to use current formData
    const validateForm = () => {
        return validateFormWithNewData(formData);
    };

    const handleMajorChange = (value: string) => {
        setSelectedMajor(value);
        setTimeout(validateForm, 0);
    };

    const handleSectionInputChange = (value: string) => {
        setCurrentSection(value);
        validateCurrentSection(value, currentInstructor);
    };

    const handleInstructorChange = (
        instructor: { id: string; name: string } | null
    ) => {
        setCurrentInstructor(instructor);
        setCurrentInstructorOpen(false);
        validateCurrentSection(currentSection, instructor);
    };

    const handleSelectChange = (name: string, value: string) => {
        if (name === "duration") {
            const newDuration = parseInt(value) || 1;
            setFormData({
                ...formData,
                [name]: newDuration,
            });
            setSections(
                sections.map((section) => ({
                    ...section,
                    splitDurations: section.showSplitControls
                        ? section.splitDurations
                        : [newDuration],
                }))
            );
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }

        // Trigger validation after state update
        setTimeout(validateForm, 0);
    };

    // Function to add a section with instructor
    const addSection = () => {
        if (!validateCurrentSection(currentSection, currentInstructor)) {
            return;
        }

        const newSection = {
            id: Date.now(),
            section_id: currentSection,
            instructor_id: currentInstructor?.id || undefined,
            instructor_name: currentInstructor?.name || undefined,
            status: "offline",
            showSplitControls: false,
            splitDurations: [Number(formData.duration) || 1],
        };

        setSections((prevSections) => [...prevSections, newSection]);
        setCurrentSection("");
        setCurrentInstructor(null);
        setCurrentInstructorOpen(false);
        setSectionValidationError("");
        setInstructorValidationError("");

        // Trigger validation after section is added
        setTimeout(validateForm, 0);
    };

    // Function to update instructor for an existing section
    const updateSectionInstructor = (
        sectionId: number,
        instructorId: string,
        instructorName: string
    ) => {
        console.log(
            "Updating instructor:",
            sectionId,
            instructorId,
            instructorName
        );
        setSections(
            sections.map((section) =>
                section.id === sectionId
                    ? {
                          ...section,
                          instructor_id: instructorId,
                          instructor_name: instructorName,
                      }
                    : section
            )
        );
        setFormData({ ...formData });
    };

    // Add this function after updateSectionInstructor
    const updateSectionStatus = (sectionId: number, status: string) => {
        setSections(
            sections.map((section) =>
                section.id === sectionId
                    ? { ...section, status: status }
                    : section
            )
        );
    };

    const removeSection = (id: number) => {
        setSections(sections.filter((section) => section.id !== id));
        setTimeout(validateForm, 0);
    };

    const [validationErrors, setValidationErrors] = useState<{
        code?: string;
        title?: string;
        major?: string;
        instructor?: string;
        sections?: string;
    }>({});

    const validateCurrentSection = (
        sectionNumber: string,
        instructor: { id: string; name: string } | null = currentInstructor
    ) => {
        // Clear previous errors
        setSectionValidationError("");
        setInstructorValidationError("");

        let isValid = true;

        // Validate section number
        if (!sectionNumber.trim()) {
            // Don't show error for empty section number, just return invalid
            return false;
        }

        const isDuplicateSection = sections.some(
            (section) =>
                section.section_id.toLowerCase() ===
                sectionNumber.trim().toLowerCase()
        );

        if (isDuplicateSection) {
            setSectionValidationError("Section number already exists");
            isValid = false;
        }

        // Validate instructor requirement
        if (instructors.length > 0 && !instructor) {
            setInstructorValidationError("Instructor is required");
            isValid = false;
        }

        return isValid;
    };
    function formatDecimal(value: number): number {
        return Math.floor(value * 100) / 100; // Truncate to 2 decimals, don't round
    }
    const handleAddCourse = async () => {
        // Make sure we have at least one section and a major
        if (sections.length === 0 || !selectedMajor) {
            showErrorMessage(
                "Validation Error",
                sections.length === 0
                    ? "At least one section is required"
                    : "A major is required"
            );
            return;
        }

        // Validate split durations for sections that have split controls enabled
        for (const section of sections) {
            if (section.showSplitControls && !isSectionSplitValid(section.id)) {
                showErrorMessage(
                    "Split Duration Error",
                    `Section ${section.section_id}: Split durations must equal course duration (${formData.duration} hours)`
                );
                return;
            }
        }

        try {
            const scheduleId = params.id;

            // Create an array of sections with instructors and split durations
            const sectionsList = sections.map((item) => ({
                section: item.section_id,
                instructorId: item.instructor_id || null,
                status: item.status || "offline",
                splitDurations: item.showSplitControls
                    ? item.splitDurations.map((duration) => ({
                          separatedDuration: formatDecimal(duration),
                      }))
                    : [{ separatedDuration: formatDecimal(formData.duration) }],
            }));

            // Create API payload with the base course data, the major, and schedule ID
            const apiData = {
                code: formData.code,
                title: formData.title,
                majorsList: [selectedMajor],
                color: formData.color,
                duration: formatDecimal(Number(formData.duration)),
                capacity: Number(formData.capacity),
                sectionsList: sectionsList,
                scheduleId: Number(scheduleId),
            };

            console.log("Sending to API:", apiData);

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
                showSuccessMessage("Course Added", "Course added successfully");
            } else {
                const error = await response.json();
                console.error("Error adding courses:", error);
                showErrorMessage(
                    "Failed to Add Course",
                    "Failed to add course. Please try again."
                );
            }
        } catch (error) {
            console.error("Error adding courses:", error);
            showErrorMessage(
                "Failed to Add Course",
                "Failed to add course. Please try again."
            );
        }
    };

    const handleEditCourse = async () => {
        // Make sure we have at least one section and a major
        if (sections.length === 0 || !selectedMajor) {
            showErrorMessage(
                "Validation Error",
                sections.length === 0
                    ? "At least one section is required"
                    : "A major is required"
            );
            return;
        }

        // Validate split durations for sections that have split controls enabled
        for (const section of sections) {
            if (section.showSplitControls && !isSectionSplitValid(section.id)) {
                showErrorMessage(
                    "Split Duration Error",
                    `Section ${section.section_id}: Split durations must equal course duration (${formData.duration} hours)`
                );
                return;
            }
        }

        try {
            // Ensure all required fields have values and proper types
            if (!selectedCourse?.sectionId) {
                showErrorMessage("Missing Data", "Missing section ID");
                return;
            }

            // Ensure sectionId is a number (API expects number)
            const sectionId =
                typeof selectedCourse.sectionId === "number"
                    ? selectedCourse.sectionId
                    : Number(selectedCourse.sectionId);

            if (isNaN(sectionId)) {
                showErrorMessage("Invalid Data", "Invalid section ID format");
                return;
            }

            // Pre-validate all required fields
            if (
                !formData.title ||
                !formData.code ||
                !selectedMajor ||
                !formData.color
            ) {
                showErrorMessage(
                    "Validation Error",
                    "All course fields are required"
                );
                return;
            }

            // Create API payload
            const apiData = {
                sectionId: sectionId,
                code: formData.code,
                title: formData.title,
                majorsList: [selectedMajor],
                color: formData.color,
                duration: Number(formData.duration) || 1,
                capacity: Number(formData.capacity) || 1,
                sectionsList: sections.map((item) => ({
                    section: item.section_id,
                    instructorId: item.instructor_id || null,
                    status: item.status || "offline",
                    splitDurations: item.showSplitControls
                        ? item.splitDurations.map((duration) => ({
                              separatedDuration: duration,
                          }))
                        : [{ separatedDuration: formData.duration }],
                })),
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
            showSuccessMessage("Course Updated", "Course updated successfully");
        } catch (error) {
            console.error("Error editing course:", error);
            showErrorMessage(
                "Failed to Update Course",
                error instanceof Error
                    ? error.message
                    : "Failed to update course. Please try again."
            );
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
                showSuccessMessage(
                    "Course Deleted",
                    "Course deleted successfully"
                );
            } else {
                const error = await response.json();
                console.error("Error deleting course:", error);
                showErrorMessage(
                    "Failed to Delete Course",
                    "Failed to delete course. Please try again."
                );
            }
        } catch (error) {
            console.error("Error deleting course:", error);
            showErrorMessage(
                "Failed to Delete Course",
                "Failed to delete course. Please try again."
            );
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            code: "",
            color: "#3B82F6", // Default hex color
            duration: 0,
            capacity: 0,
            section: "",
            status: "",
        });
        setDurationHours(0);
        setDurationMinutes(0);
        setSelectedMajor("");
        setSections([]);
        setCurrentSection("");
        setCurrentInstructor(null);
        setCurrentInstructorOpen(false);
        setValidationErrors({});
        setSectionValidationError("");
        setInstructorValidationError("");
    };

    const isFormValid = () => {
        return (
            Object.keys(validationErrors).length === 0 &&
            formData.title.trim() !== "" &&
            formData.code.trim() !== "" &&
            selectedMajor !== "" &&
            sections.length > 0 &&
            !sectionValidationError &&
            !instructorValidationError
        );
    };

    useEffect(() => {
        if (isAddDialogOpen || isEditDialogOpen) {
            validateForm();
        }
    }, [isAddDialogOpen, isEditDialogOpen, courses, majors, instructors]);

    // Instructor validation helper
    const getInstructorValidationMessage = () => {
        if (instructors.length === 0) {
            return "Please create an instructor first";
        }
        return null;
    };

    const openEditDialog = (course: Course) => {
        setSelectedCourse(course);
        const courseDuration = Number(course.duration);
        const { hours, minutes } = convertFromDecimalHours(courseDuration);

        setDurationHours(hours);
        setDurationMinutes(minutes);

        setFormData({
            title: course.title,
            code: course.code,
            color: course.color || "#3B82F6",
            duration: courseDuration,
            capacity: course.capacity,
            section: course.section,
            status: course.status || "offline",
        });

        const instructorName = `${course.firstName || ""} ${
            course.lastName || ""
        }`.trim();

        // Check if this course has separated durations (split durations)
        const hasSeparatedDurations =
            (course as any).separatedDurations &&
            (course as any).separatedDurations.length > 0;

        // Determine if split controls should be shown
        const shouldShowSplitControls =
            hasSeparatedDurations &&
            (course as any).separatedDurations.length > 1;

        // Initialize with existing section data, including separated durations
        const editSection = {
            id: 1,
            section_id: course.section,
            instructor_id: course.instructorId
                ? String(course.instructorId)
                : undefined,
            instructor_name: instructorName !== "" ? instructorName : undefined,
            status: course.status || "offline",
            splitDurations: hasSeparatedDurations
                ? (course as any).separatedDurations
                : [courseDuration],
            showSplitControls: shouldShowSplitControls,
        };

        console.log("Opening edit dialog with section:", editSection);
        console.log(
            "Course separated durations:",
            (course as any).separatedDurations
        );
        setSections([editSection]);

        setSelectedMajor(course.major);

        // Reset the add section form
        setCurrentSection("");
        setCurrentInstructor(null);
        setCurrentInstructorOpen(false);

        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (course: Course) => {
        setSelectedCourse(course);
        setIsDeleteDialogOpen(true);
    };

    // Import/Export state variables
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

    interface CSVCourseRow {
        code: string;
        title: string;
        major: string;
        color: string;
        status: string;
        duration: string;
        separated_duration: string;
        capacity: string;
        section: string;
        classroom?: string;
        instructor_name?: string;
    }

    const validateCourseData = (
        row: any,
        rowIndex: number
    ): CSVCourseRow | string => {
        const errors: string[] = [];
    
        // Check required fields
        if (
            !row.code ||
            typeof row.code !== "string" ||
            row.code.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Course code is required`);
        }
    
        if (
            !row.title ||
            typeof row.title !== "string" ||
            row.title.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Course title is required`);
        }
    
        if (
            !row.major ||
            typeof row.major !== "string" ||
            row.major.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Major is required`);
        } else {
            // Check if major exists (case insensitive)
            const majorExists = majors.some(
                (major) =>
                    major.name.toLowerCase() === row.major.trim().toLowerCase()
            );
            if (!majorExists) {
                errors.push(
                    `Row ${
                        rowIndex + 1
                    }: Major "${row.major.trim()}" does not exist. Available: ${majors
                        .map((m) => m.name)
                        .join(", ")}`
                );
            }
        }
    
        if (
            !row.color ||
            typeof row.color !== "string" ||
            row.color.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Color is required`);
        } else {
            // Validate hex color format or color names
            const colorValue = row.color.trim();
            const isValidHex = /^#[0-9A-F]{6}$/i.test(colorValue);
            const colorExists = colors.some(
                (color) =>
                    getColorName(color).toLowerCase() ===
                    colorValue.toLowerCase()
            );
    
            if (!isValidHex && !colorExists) {
                errors.push(
                    `Row ${
                        rowIndex + 1
                    }: Color "${colorValue}" is not valid. Use hex format (#3B82F6) or color names: ${colors
                        .map((c) => getColorName(c))
                        .join(", ")}`
                );
            }
        }
    
        if (
            !row.status ||
            typeof row.status !== "string" ||
            row.status.trim() === ""
        ) {
            errors.push(`Row ${rowIndex + 1}: Status is required`);
        } else {
            const validStatuses = ["online", "offline"];
            if (!validStatuses.includes(row.status.trim().toLowerCase())) {
                errors.push(
                    `Row ${rowIndex + 1}: Status must be 'online' or 'offline'`
                );
            }
        }
    
        // Validate duration
        const duration = Number(row.duration);
        if (!row.duration || isNaN(duration) || duration <= 0) {
            errors.push(
                `Row ${rowIndex + 1}: Duration must be a valid positive number`
            );
        }
    
        // Validate separated_duration - handle both single values and JSON arrays
        let separatedDurationValue: string = duration.toString(); // Default to duration
        if (row.separated_duration) {
            const separatedDuration = row.separated_duration;
            
            if (typeof separatedDuration === 'string') {
                // Check if it's a JSON array string like "[1.66667, 0.833333]"
                if (separatedDuration.trim().startsWith('[') && separatedDuration.trim().endsWith(']')) {
                    try {
                        const parsedArray = JSON.parse(separatedDuration);
                        if (Array.isArray(parsedArray)) {
                            // Validate each value in the array
                            const hasValidNumbers = parsedArray.every(val => !isNaN(Number(val)) && Number(val) > 0);
                            if (!hasValidNumbers) {
                                errors.push(
                                    `Row ${rowIndex + 1}: Separated duration array contains invalid values`
                                );
                            } else {
                                separatedDurationValue = separatedDuration; // Keep as JSON string
                            }
                        } else {
                            errors.push(
                                `Row ${rowIndex + 1}: Separated duration must be a valid JSON array`
                            );
                        }
                    } catch (e) {
                        errors.push(
                            `Row ${rowIndex + 1}: Separated duration has invalid JSON format`
                        );
                    }
                } else {
                    // Single value
                    const singleValue = Number(separatedDuration);
                    if (isNaN(singleValue) || singleValue <= 0) {
                        errors.push(
                            `Row ${rowIndex + 1}: Separated duration must be a valid positive number`
                        );
                    } else {
                        separatedDurationValue = singleValue.toString();
                    }
                }
            } else {
                // Numeric value
                const numericValue = Number(separatedDuration);
                if (isNaN(numericValue) || numericValue <= 0) {
                    errors.push(
                        `Row ${rowIndex + 1}: Separated duration must be a valid positive number`
                    );
                } else {
                    separatedDurationValue = numericValue.toString();
                }
            }
        }
    
        // Validate capacity
        const capacity = Number(row.capacity);
        if (!row.capacity || isNaN(capacity) || capacity <= 0) {
            errors.push(
                `Row ${rowIndex + 1}: Capacity must be a valid positive number`
            );
        }
    
        // Validate section
        if (!row.section || row.section.toString().trim() === "") {
            errors.push(`Row ${rowIndex + 1}: Section is required`);
        }
    
        // Validate instructor if provided
        if (
            row.instructor_name &&
            typeof row.instructor_name === "string" &&
            row.instructor_name.trim() !== ""
        ) {
            const instructorExists = instructors.some(
                (instructor) =>
                    `${instructor.first_name} ${instructor.last_name}`.toLowerCase() ===
                    row.instructor_name.trim().toLowerCase()
            );
            if (!instructorExists) {
                errors.push(
                    `Row ${
                        rowIndex + 1
                    }: Instructor "${row.instructor_name.trim()}" does not exist. Available: ${instructors
                        .map((i) => `${i.first_name} ${i.last_name}`)
                        .join(", ")}`
                );
            }
        }
    
        if (errors.length > 0) {
            return errors.join("; ");
        }
    
        // Return cleaned data
        return {
            code: row.code.trim(),
            title: row.title.trim(),
            major: row.major.trim(),
            color: row.color.trim(),
            status: row.status.trim().toLowerCase(),
            duration: duration.toString(),
            separated_duration: separatedDurationValue, // This can now be either a single value or JSON array string
            capacity: capacity.toString(),
            section: row.section.toString().trim(),
            classroom: row.classroom ? row.classroom.trim() : undefined,
            instructor_name: row.instructor_name
                ? row.instructor_name.trim()
                : undefined,
        };
    };

    const renderFormField = (
        id: string,
        name: string,
        label: string,
        value: string,
        placeholder: string,
        error?: string,
        additionalMessage?: string
    ) => (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-medium text-gray-700">
                {label}
            </Label>
            <Input
                id={id}
                name={name}
                value={value}
                onChange={handleInputChange}
                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                    error ? "border-red-300 bg-red-50" : ""
                }`}
                placeholder={placeholder}
            />
            {error && (
                <p className="text-xs text-red-600 flex items-center">
                    <svg
                        className="w-3 h-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                    {error}
                </p>
            )}
            {additionalMessage && !error && (
                <p className="text-xs text-amber-600 flex items-center">
                    <svg
                        className="w-3 h-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                    {additionalMessage}
                </p>
            )}
        </div>
    );

    const renderMajorSelect = () => (
        <div className="space-y-2">
            <Label
                htmlFor="major"
                className="text-sm font-medium text-gray-700"
            >
                Major
            </Label>
            <Select value={selectedMajor} onValueChange={handleMajorChange}>
                <SelectTrigger
                    className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                        validationErrors.major ? "border-red-300 bg-red-50" : ""
                    }`}
                >
                    <SelectValue placeholder="Select a major" />
                </SelectTrigger>
                <SelectContent>
                    {majors.map((major) => (
                        <SelectItem key={major.id} value={major.name}>
                            {major.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {validationErrors.major && (
                <p className="text-xs text-red-600 flex items-center">
                    <svg
                        className="w-3 h-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                    {validationErrors.major}
                </p>
            )}
        </div>
    );

    const renderSubmitButton = (isEdit: boolean = false) => (
        <Button
            onClick={isEdit ? handleEditCourse : handleAddCourse}
            disabled={!isFormValid()}
            className={`text-sm px-3 py-1.5 ${
                isFormValid()
                    ? "bg-[#2F2F85] hover:bg-[#3F3F8F] text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
        >
            {isEdit ? "Save Changes" : "Add Course"}
        </Button>
    );

    // Group courses by code for import
    const groupCoursesByCode = (validCourses: CSVCourseRow[]) => {
        const grouped = new Map<string, CSVCourseRow[]>();

        validCourses.forEach((course) => {
            const key = course.code.toLowerCase();
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(course);
        });

        return grouped;
    };

    const handleImportCSV = async () => {
        if (!importFile) {
            showErrorMessage(
                "No File Selected",
                "Please select a CSV file to import"
            );
            return;
        }
    
        const scheduleId = params.id;
        if (!scheduleId) {
            showErrorMessage("Missing Schedule ID", "Schedule ID is missing");
            return;
        }
    
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
                    console.log("Parsed CSV data:", csvData);
    
                    const validCourses: CSVCourseRow[] = [];
                    const errors: string[] = [];
    
                    // Validate each row
                    csvData.forEach((row, index) => {
                        const validationResult = validateCourseData(row, index);
                        if (typeof validationResult === "string") {
                            errors.push(validationResult);
                        } else {
                            validCourses.push(validationResult);
                        }
                    });
    
                    console.log(
                        "Valid courses after validation:",
                        validCourses
                    );
    
                    // Group courses by code to handle multiple sections
                    const groupedCourses = groupCoursesByCode(validCourses);
    
                    // Check for duplicate codes in existing courses
                    const duplicateCodes: string[] = [];
                    for (const [courseCode] of groupedCourses) {
                        const existingCourse = courses.some(
                            (course) =>
                                course.code.toLowerCase() ===
                                courseCode.toLowerCase()
                        );
                        if (existingCourse) {
                            duplicateCodes.push(courseCode);
                            errors.push(
                                `Course code "${courseCode}" already exists in the system`
                            );
                        }
                    }
    
                    // Remove duplicates from grouped courses
                    duplicateCodes.forEach((code) => {
                        groupedCourses.delete(code.toLowerCase());
                    });
    
                    setImportProgress((prev) => ({
                        ...prev,
                        total: groupedCourses.size,
                        errors: errors,
                    }));
    
                    if (groupedCourses.size === 0) {
                        showErrorMessage(
                            "No Valid Courses",
                            errors.length > 0
                                ? `No valid courses to import. ${errors.length} error(s) found.`
                                : "No valid courses found in the CSV file"
                        );
                        setImportProgress((prev) => ({
                            ...prev,
                            isImporting: false,
                        }));
                        return;
                    }
    
                    // Import valid courses
                    let completed = 0;
                    const importErrors: string[] = [...errors];
    
                    for (const [courseCode, courseSections] of groupedCourses) {
                        try {
                            const baseCourse = courseSections[0];
    
                            // Create sections list with instructors and split durations
                            const sectionsList = courseSections.map(
                                (courseSection) => {
                                    let instructorId = null;
                                    if (courseSection.instructor_name) {
                                        const instructor = instructors.find(
                                            (inst) =>
                                                `${inst.first_name} ${inst.last_name}`.toLowerCase() ===
                                                courseSection.instructor_name!.toLowerCase()
                                        );
                                        instructorId = instructor
                                            ? instructor.id.toString()
                                            : null;
                                    }
    
                                    // Parse separated_duration - handle both single values and arrays
                                    let splitDurations;
                                    const separatedDuration = courseSection.separated_duration;
                                    
                                    if (typeof separatedDuration === 'string') {
                                        // Check if it's a JSON array string like "[1.66667, 0.833333]"
                                        if (separatedDuration.trim().startsWith('[') && separatedDuration.trim().endsWith(']')) {
                                            try {
                                                const parsedArray = JSON.parse(separatedDuration);
                                                if (Array.isArray(parsedArray)) {
                                                    splitDurations = parsedArray.map(duration => ({
                                                        separatedDuration: Number(duration)
                                                    }));
                                                } else {
                                                    splitDurations = [{ separatedDuration: Number(separatedDuration) }];
                                                }
                                            } catch (e) {
                                                splitDurations = [{ separatedDuration: Number(separatedDuration) }];
                                            }
                                        } else {
                                            // Single value
                                            splitDurations = [{ separatedDuration: Number(separatedDuration) }];
                                        }
                                    } else {
                                        // Single numeric value
                                        splitDurations = [{ separatedDuration: Number(separatedDuration) }];
                                    }
    
                                    return {
                                        section: courseSection.section,
                                        instructorId: instructorId,
                                        status: courseSection.status,
                                        splitDurations: splitDurations,
                                    };
                                }
                            );
    
                            const apiData = {
                                code: baseCourse.code,
                                title: baseCourse.title,
                                majorsList: [baseCourse.major],
                                color: /^#[0-9A-F]{6}$/i.test(baseCourse.color)
                                    ? baseCourse.color
                                    : getHexFromColorName(baseCourse.color),
                                duration: Number(baseCourse.duration),
                                capacity: Number(baseCourse.capacity),
                                sectionsList: sectionsList,
                                scheduleId: Number(scheduleId),
                            };
    
                            console.log("Sending to API:", apiData);
    
                            const response = await fetch("/api/courses", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(apiData),
                            });
    
                            if (!response.ok) {
                                const errorData = await response.json();
                                console.error("API Error:", errorData);
                                importErrors.push(
                                    `Failed to import course ${
                                        baseCourse.code
                                    }: ${errorData.error || "Unknown error"}`
                                );
                            } else {
                                completed++;
                                console.log(
                                    `Successfully imported course: ${baseCourse.code}`
                                );
                            }
                        } catch (error) {
                            console.error(
                                `Error importing course ${courseCode}:`,
                                error
                            );
                            importErrors.push(
                                `Failed to import course ${courseCode}: ${
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
    
                        await new Promise((resolve) => setTimeout(resolve, 30));
                    }
    
                    setImportProgress((prev) => ({
                        ...prev,
                        isImporting: false,
                    }));
    
                    await fetchData();
    
                    if (completed > 0) {
                        if (completed === groupedCourses.size) {
                            showSuccessMessage(
                                "Import Completed",
                                `Successfully imported ${completed} course(s)`
                            );
                        } else {
                            showErrorMessage(
                                "Import Completed with Errors",
                                `Successfully imported ${completed} course(s) with ${importErrors.length} error(s)`
                            );
                        }
                    } else {
                        showErrorMessage(
                            "Import Failed",
                            "Failed to import any courses. Check the errors above."
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
                "Failed to import courses. Please try again."
            );
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
        }
    };
    // File selection handler
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImportFile(file);
        } else {
            showErrorMessage(
                "No File Selected",
                "Please select a valid CSV file"
            );
            event.target.value = "";
        }
    };

    // Reset import state
    const resetImportState = () => {
        setImportFile(null);
        setImportProgress({
            total: 0,
            completed: 0,
            errors: [],
            isImporting: false,
        });
    };

    const downloadCoursesCSV = () => {
        try {
            // Create CSV header to match the actual Course structure from your API
            const headers = [
                "code",
                "title",
                "major",
                "color",
                "status",
                "duration",
                "separated_duration",
                "capacity",
                "section",
                "classroom",
                "instructor_name",
            ];

            // Convert courses data to CSV rows (one row per section)
            const csvRows: string[][] = [];

            filteredCourses.forEach((course) => {
                // Get instructor name, handling potential undefined values
                const instructorName =
                    course.firstName && course.lastName
                        ? `${course.firstName.trim()} ${course.lastName.trim()}`
                        : "";

                csvRows.push([
                    course.code || "",
                    course.title || "",
                    course.major || "",
                    course.color || "#3B82F6",
                    course.status || "offline",
                    course.duration?.toString() || "1",
                    course.separatedDuration?.toString() ||
                        course.duration?.toString() ||
                        "1",
                    course.capacity?.toString() || "1",
                    course.section || "",
                    course.classroom || "",
                    instructorName,
                ]);
            });

            // Rest of the function remains the same...
            const allRows = [headers, ...csvRows];
            const csvContent = allRows
                .map((row) =>
                    row
                        .map((field) => {
                            const fieldStr = String(field || "");
                            if (
                                fieldStr.includes(",") ||
                                fieldStr.includes('"') ||
                                fieldStr.includes("\n") ||
                                fieldStr.includes("\r")
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
            link.setAttribute("download", `courses_export_${today}.csv`);

            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);

            showSuccessMessage(
                "Export Successful",
                `Successfully exported ${filteredCourses.length} courses to CSV`
            );
        } catch (error) {
            console.error("Error exporting CSV:", error);
            showErrorMessage(
                "Export Failed",
                "Failed to export courses. Please try again."
            );
        }
    };

    // Search functionality
    const [searchQuery, setSearchQuery] = useState("");

    // Filter courses based on search query
    const filteredCourses = courses.filter(
        (course) =>
            course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.major.toLowerCase().includes(searchQuery.toLowerCase()) ||
            `${course.firstName || ""} ${course.lastName || ""}`
                .toLowerCase()
                .includes(searchQuery.toLowerCase())
    );

    // Get current courses for pagination
    const paginatedCourses = filteredCourses.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        setTotalPages(Math.ceil(filteredCourses.length / ITEMS_PER_PAGE));
    }, [filteredCourses]);

    // Clear all courses functionality
    const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);

    const handleClearAllCourses = async () => {
        const scheduleId = params.id;

        if (!scheduleId) {
            showErrorMessage(
                "Missing Schedule ID",
                "Could not find the schedule ID. Action cannot be performed."
            );
            return;
        }

        try {
            const response = await fetch(
                `/api/courses?scheduleId=${scheduleId}`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.ok) {
                await fetchData();
                setIsClearAllDialogOpen(false);
                showSuccessMessage(
                    "All Courses Cleared",
                    "All courses have been successfully cleared."
                );
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to clear courses");
            }
        } catch (error) {
            console.error("Error clearing all courses:", error);
            showErrorMessage(
                "Failed to Clear Courses",
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred while clearing courses."
            );
        }
    };

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

            <div className="space-y-4">
                {/* Page Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Courses
                        </h2>
                        <p className="text-xs text-gray-600">
                            Manage courses, sections, and instructors
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
                            onClick={downloadCoursesCSV}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={courses.length === 0}
                        >
                            <Download className="mr-1 h-3 w-3" /> Export CSV
                        </Button>
                        <Button
                            onClick={() => setIsAddDialogOpen(true)}
                            className="bg-[#2F2F85] hover:bg-[#3F3F8F] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                        >
                            <Plus className="mr-1 h-3 w-3" /> New Course
                        </Button>
                        <Button
                            onClick={() => setIsClearAllDialogOpen(true)}
                            variant="outline"
                            className="border-red-600 text-red-600 hover:bg-red-50 text-xs px-3 py-1.5 rounded-md"
                            disabled={courses.length === 0}
                        >
                            <Trash className="mr-1 h-3 w-3" /> Clear All
                        </Button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search courses by code, title, section, major, or instructor..."
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

                {/* Compact Table Container */}
                <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-[#2F2F85] text-white">
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Code
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Title
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                        Section
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Instructor
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-25">
                                        Major
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                                        Total Duration (per week)
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider ">
                                        Split Duration (per week)
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                        Capacity
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                        Status
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {courses.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={10}
                                            className="px-3 py-8 text-center text-gray-500 text-sm"
                                        >
                                            <div className="space-y-1">
                                                <div>No courses found</div>
                                                <div className="text-xs">
                                                    Add a new course to get
                                                    started.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedCourses.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={10}
                                            className="px-3 py-8 text-center text-gray-500 text-sm"
                                        >
                                            No courses found on this page.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCourses.map((course, index) => (
                                        <tr
                                            key={course.id}
                                            className={`hover:bg-gray-50 transition-colors ${
                                                index % 2 === 0
                                                    ? "bg-white"
                                                    : "bg-gray-50"
                                            }`}
                                        >
                                            <td className="px-2 py-2 text-xs font-medium text-gray-900">
                                                <div className="flex items-center">
                                                    {/* Color indicator */}
                                                    <div
                                                        className="w-3 h-3 rounded-full mr-2 border border-gray-300"
                                                        style={{
                                                            backgroundColor:
                                                                course.color ||
                                                                "#3B82F6",
                                                        }}
                                                        title={
                                                            course.color ||
                                                            "#3B82F6"
                                                        }
                                                    />
                                                    {course.code}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900">
                                                {course.title}
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900">
                                                {course.section}
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900">
                                                {`${course.firstName || ""} ${
                                                    course.lastName || ""
                                                }`.trim() || "—"}
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900">
                                                {course.major || "—"}
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900">
                                                {course.duration}h
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900">
                                                {/* Display separated durations - check if separatedDurations array exists */}
                                                <div className="space-y-1">
                                                    {/* Individual separated durations */}
                                                    <div className="flex flex-wrap gap-1">
                                                        {(course as any)
                                                            .separatedDurations &&
                                                        (course as any)
                                                            .separatedDurations
                                                            .length > 0 ? (
                                                            (
                                                                course as any
                                                            ).separatedDurations.map(
                                                                (
                                                                    duration: number,
                                                                    idx: number
                                                                ) => (
                                                                    <span
                                                                        key={
                                                                            idx
                                                                        }
                                                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800"
                                                                    >
                                                                        {
                                                                            duration
                                                                        }
                                                                        h
                                                                    </span>
                                                                )
                                                            )
                                                        ) : (
                                                            <span className="text-gray-500">
                                                                {
                                                                    course.separatedDuration
                                                                }
                                                                h
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Show combined total when there are multiple separated durations */}
                                                    {(course as any)
                                                        .separatedDurations &&
                                                        (course as any)
                                                            .separatedDurations
                                                            .length > 1}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900">
                                                {course.capacity}
                                            </td>
                                            <td className="px-2 py-2">
                                                <span
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                                        course.status ===
                                                        "online"
                                                            ? "bg-green-100 text-green-800"
                                                            : "bg-gray-100 text-gray-800"
                                                    }`}
                                                >
                                                    {course.status}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-gray-500 hover:text-[#2F2F85] hover:bg-gray-100"
                                                        onClick={() =>
                                                            openEditDialog(
                                                                course
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
                                                                course
                                                            )
                                                        }
                                                    >
                                                        <Trash className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                {filteredCourses.length > 0 && (
                    <div className="flex justify-center">
                        <CustomPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}

                {/* Add Course Dialog */}
                <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) resetForm();
                        setIsAddDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Add New Course
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Course Code Field with Validation */}
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="code"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Course Code
                                    </Label>
                                    <Input
                                        id="code"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleInputChange}
                                        className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                            validationErrors.code
                                                ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                                                : ""
                                        }`}
                                        placeholder="CS101"
                                    />
                                    {validationErrors.code && (
                                        <p className="text-xs text-red-600 flex items-center">
                                            <svg
                                                className="w-3 h-3 mr-1 flex-shrink-0"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            {validationErrors.code}
                                        </p>
                                    )}
                                </div>

                                {/* Course Title Field with Validation */}
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="title"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Course Name
                                    </Label>
                                    <Input
                                        id="title"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                        className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                            validationErrors.title
                                                ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                                                : ""
                                        }`}
                                        placeholder="Introduction to Programming"
                                    />
                                    {validationErrors.title && (
                                        <p className="text-xs text-red-600 flex items-center">
                                            <svg
                                                className="w-3 h-3 mr-1 flex-shrink-0"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            {validationErrors.title}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Major Field with Validation */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="major"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Major
                                </Label>
                                <Select
                                    value={selectedMajor}
                                    onValueChange={handleMajorChange}
                                >
                                    <SelectTrigger
                                        className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                            validationErrors.major
                                                ? "border-red-300 bg-red-50"
                                                : ""
                                        }`}
                                    >
                                        <SelectValue placeholder="Select a major" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {majors.length === 0 ? (
                                            <div className="p-2 text-xs text-gray-500 text-center">
                                                No majors available
                                            </div>
                                        ) : (
                                            majors.map((major) => (
                                                <SelectItem
                                                    key={major.id}
                                                    value={major.name}
                                                >
                                                    {major.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {validationErrors.major && (
                                    <p
                                        className={`text-xs flex items-center ${
                                            validationErrors.major.includes(
                                                "create"
                                            )
                                                ? "text-amber-600"
                                                : "text-red-600"
                                        }`}
                                    >
                                        <svg
                                            className="w-3 h-3 mr-1 flex-shrink-0"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            {validationErrors.major.includes(
                                                "create"
                                            ) ? (
                                                <path
                                                    fillRule="evenodd"
                                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            ) : (
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            )}
                                        </svg>
                                        {validationErrors.major}
                                    </p>
                                )}
                            </div>

                            {/* Color Field */}
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="color"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Color
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        {/* Color picker input */}
                                        <div className="relative">
                                            <input
                                                type="color"
                                                id="color"
                                                name="color"
                                                value={
                                                    formData?.color || "#3B82F6"
                                                }
                                                onChange={(e) => {
                                                    const hexColor =
                                                        e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        color: hexColor,
                                                    });
                                                    setTimeout(validateForm, 0);
                                                }}
                                                className="w-12 h-10 rounded border border-gray-300 cursor-pointer hover:border-gray-400 focus:border-[#2F2F85] focus:ring-1 focus:ring-[#2F2F85]"
                                                style={{
                                                    padding: "2px",
                                                    backgroundColor:
                                                        "transparent",
                                                }}
                                            />
                                            <div
                                                className="absolute inset-1 rounded pointer-events-none"
                                                style={{
                                                    backgroundColor:
                                                        formData?.color ||
                                                        "#3B82F6",
                                                }}
                                            />
                                        </div>

                                        {/* Color value display */}
                                        <div className="flex-1">
                                            <Input
                                                type="text"
                                                value={formData?.color || ""}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value;
                                                    if (
                                                        /^#[0-9A-F]{6}$/i.test(
                                                            value
                                                        ) ||
                                                        value === ""
                                                    ) {
                                                        setFormData({
                                                            ...formData,
                                                            color: value,
                                                        });
                                                        setTimeout(
                                                            validateForm,
                                                            0
                                                        );
                                                    }
                                                }}
                                                placeholder="#3B82F6"
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm font-mono"
                                            />
                                        </div>

                                        {/* Quick color presets */}
                                        <div className="flex gap-1">
                                            {[
                                                "#3B82F6", // Blue
                                                "#EF4444", // Red
                                                "#10B981", // Green
                                                "#F59E0B", // Yellow
                                                "#8B5CF6", // Purple
                                                "#EC4899", // Pink
                                                "#6B7280", // Gray
                                                "#F97316", // Orange
                                            ].map((presetColor) => (
                                                <button
                                                    key={presetColor}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            color: presetColor,
                                                        });
                                                        setTimeout(
                                                            validateForm,
                                                            0
                                                        );
                                                    }}
                                                    className="w-6 h-6 rounded border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F2F85] focus:ring-offset-1"
                                                    style={{
                                                        backgroundColor:
                                                            presetColor,
                                                    }}
                                                    title={presetColor}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Choose a color for this course or enter
                                        a custom hex value
                                    </p>
                                </div>
                            </div>

                            {/* Duration and Capacity Fields */}
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Duration
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor="duration-hours"
                                                className="text-xs text-gray-600"
                                            >
                                                Hours
                                            </Label>
                                            <Input
                                                id="duration-hours"
                                                name="durationHours"
                                                type="number"
                                                min="0"
                                                max="23"
                                                value={durationHours}
                                                onChange={handleInputChange}
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor="duration-minutes"
                                                className="text-xs text-gray-600"
                                            >
                                                Minutes
                                            </Label>
                                            <Input
                                                id="duration-minutes"
                                                name="durationMinutes"
                                                type="number"
                                                min="0"
                                                max="59"
                                                step="5"
                                                value={durationMinutes}
                                                onChange={handleInputChange}
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Total: {durationHours}h{" "}
                                        {durationMinutes}m (
                                        {formData.duration.toFixed(2)} hours)
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="capacity"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Capacity
                                    </Label>
                                    <Input
                                        id="capacity"
                                        name="capacity"
                                        type="number"
                                        min="1"
                                        value={formData.capacity}
                                        onChange={handleInputChange}
                                        className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                    />
                                </div>
                            </div>

                            {/* Sections with Validation */}
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm font-medium text-gray-700">
                                        Sections
                                    </Label>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Add course sections with instructors and
                                        split durations
                                    </p>
                                </div>

                                {/* Add Section Form */}
                                <div className="grid gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="section"
                                                className="text-sm font-medium text-gray-700"
                                            >
                                                Section Number
                                            </Label>
                                            <Input
                                                id="section"
                                                placeholder="Enter section number"
                                                value={currentSection}
                                                onChange={(e) =>
                                                    handleSectionInputChange(
                                                        e.target.value
                                                    )
                                                }
                                                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                                    sectionValidationError
                                                        ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                                                        : ""
                                                }`}
                                            />
                                            {sectionValidationError && (
                                                <p className="text-xs text-red-600 flex items-center">
                                                    <svg
                                                        className="w-3 h-3 mr-1 flex-shrink-0"
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    {sectionValidationError}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="section-instructor"
                                                className="text-sm font-medium text-gray-700"
                                            >
                                                Instructor{" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </Label>
                                            <Popover
                                                open={currentInstructorOpen}
                                                onOpenChange={
                                                    setCurrentInstructorOpen
                                                }
                                            >
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={`w-full justify-between text-sm ${
                                                            instructorValidationError
                                                                ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                                                                : "border-gray-300"
                                                        }`}
                                                        disabled={
                                                            instructors.length ===
                                                            0
                                                        }
                                                    >
                                                        {currentInstructor?.name ||
                                                            "Select instructor..."}
                                                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search instructor..." />
                                                        <CommandEmpty>
                                                            No instructor found.
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {instructors.map(
                                                                (
                                                                    instructor
                                                                ) => (
                                                                    <CommandItem
                                                                        key={
                                                                            instructor.id
                                                                        }
                                                                        value={`${instructor.first_name} ${instructor.last_name}`}
                                                                        onSelect={() => {
                                                                            handleInstructorChange(
                                                                                {
                                                                                    id: instructor.id.toString(),
                                                                                    name: `${instructor.first_name} ${instructor.last_name}`,
                                                                                }
                                                                            );
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={`mr-2 h-3 w-3 ${
                                                                                currentInstructor?.id ===
                                                                                instructor.id.toString()
                                                                                    ? "opacity-100"
                                                                                    : "opacity-0"
                                                                            }`}
                                                                        />
                                                                        {
                                                                            instructor.first_name
                                                                        }{" "}
                                                                        {
                                                                            instructor.last_name
                                                                        }
                                                                    </CommandItem>
                                                                )
                                                            )}
                                                        </CommandGroup>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>

                                            {/* Show instructor validation error */}
                                            {instructorValidationError && (
                                                <p className="text-xs text-red-600 flex items-center">
                                                    <svg
                                                        className="w-3 h-3 mr-1 flex-shrink-0"
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    {instructorValidationError}
                                                </p>
                                            )}

                                            {/* Show warning if no instructors available */}
                                            {instructors.length === 0 && (
                                                <p className="text-xs text-amber-600 flex items-center">
                                                    <svg
                                                        className="w-3 h-3 mr-1 flex-shrink-0"
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    Please create an instructor
                                                    first
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        onClick={addSection}
                                        disabled={
                                            !currentSection.trim() ||
                                            !!sectionValidationError
                                        }
                                        className={`w-full text-sm transition-colors ${
                                            !currentSection.trim() ||
                                            !!sectionValidationError
                                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                                : "bg-[#2F2F85] hover:bg-[#3F3F8F] text-white"
                                        }`}
                                    >
                                        <Plus className="h-3 w-3 mr-2" /> Add
                                        Section
                                    </Button>
                                </div>

                                {/* Existing sections list code - WITH SPLIT DURATION CONTROLS */}
                                {sections.length > 0 && (
                                    <div className="space-y-2">
                                        {sections.map((section) => (
                                            <div
                                                key={section.id}
                                                className="p-3 border border-gray-200 rounded bg-gray-50"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                        Section{" "}
                                                        {section.section_id}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            removeSection(
                                                                section.id
                                                            )
                                                        }
                                                        className="h-6 w-6 text-gray-500 hover:text-red-600"
                                                    >
                                                        <Trash className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <div className="mt-2">
                                                    <Label className="text-xs text-gray-700">
                                                        Instructor
                                                    </Label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                className="w-full justify-between mt-1 text-sm border-gray-300"
                                                            >
                                                                {section.instructor_name ||
                                                                    "Select instructor..."}
                                                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-full p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Search instructor..." />
                                                                <CommandEmpty>
                                                                    No
                                                                    instructor
                                                                    found.
                                                                </CommandEmpty>
                                                                <CommandGroup>
                                                                    {instructors.map(
                                                                        (
                                                                            instructor
                                                                        ) => (
                                                                            <CommandItem
                                                                                key={
                                                                                    instructor.id
                                                                                }
                                                                                value={`${instructor.first_name} ${instructor.last_name}`}
                                                                                onSelect={() => {
                                                                                    updateSectionInstructor(
                                                                                        section.id,
                                                                                        instructor.id.toString(),
                                                                                        `${instructor.first_name} ${instructor.last_name}`
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={`mr-2 h-3 w-3 ${
                                                                                        section.instructor_id ===
                                                                                        instructor.id.toString()
                                                                                            ? "opacity-100"
                                                                                            : "opacity-0"
                                                                                    }`}
                                                                                />
                                                                                {
                                                                                    instructor.first_name
                                                                                }{" "}
                                                                                {
                                                                                    instructor.last_name
                                                                                }
                                                                            </CommandItem>
                                                                        )
                                                                    )}
                                                                </CommandGroup>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>

                                                {/* Split Duration Controls */}
                                                <div className="mt-4 mb-4 space-y-3">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <Label className="text-xs text-gray-700 mr-2">
                                                            Split Duration
                                                        </Label>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                toggleSectionSplitControls(
                                                                    section.id
                                                                )
                                                            }
                                                            className="text-xs ml-2"
                                                        >
                                                            {section.showSplitControls
                                                                ? "Hide Split"
                                                                : "Split Duration"}
                                                        </Button>
                                                    </div>

                                                    {section.showSplitControls && (
                                                        <div className="mt-4 mb-4">
                                                            <div className="text-xs text-gray-600 mb-3">
                                                                Original
                                                                Duration:{" "}
                                                                {durationHours}h{" "}
                                                                {
                                                                    durationMinutes
                                                                }
                                                                m (
                                                                {formData.duration.toFixed(
                                                                    2
                                                                )}{" "}
                                                                hours)
                                                            </div>

                                                            {section.splitDurations.map(
                                                                (
                                                                    duration,
                                                                    index
                                                                ) => {
                                                                    const {
                                                                        hours,
                                                                        minutes,
                                                                    } =
                                                                        convertSplitDurationToHoursMinutes(
                                                                            duration
                                                                        );
                                                                    return (
                                                                        <div
                                                                            key={
                                                                                index
                                                                            }
                                                                            className="flex items-center gap-2 mb-3"
                                                                        >
                                                                            <Label className="text-xs w-12 mr-2">
                                                                                Part{" "}
                                                                                {index +
                                                                                    1}

                                                                                :
                                                                            </Label>

                                                                            {/* Hours Input */}
                                                                            <div className="flex flex-col items-center">
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max="23"
                                                                                    value={
                                                                                        hours
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        updateSectionSplitDurationHours(
                                                                                            section.id,
                                                                                            index,
                                                                                            parseInt(
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            ) ||
                                                                                                0
                                                                                        )
                                                                                    }
                                                                                    className={`w-20 text-xs transition-colors ${
                                                                                        isSectionSplitValid(
                                                                                            section.id
                                                                                        )
                                                                                            ? "border-green-500 bg-green-50 text-green-700 focus:border-green-600"
                                                                                            : "border-red-300 bg-red-50"
                                                                                    }`}
                                                                                    placeholder="0"
                                                                                />
                                                                                <span className="text-xs text-gray-500 mt-1">
                                                                                    h
                                                                                </span>
                                                                            </div>

                                                                            {/* Minutes Input */}
                                                                            <div className="flex flex-col items-center">
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max="59"
                                                                                    step="5"
                                                                                    value={
                                                                                        minutes
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        updateSectionSplitDurationMinutes(
                                                                                            section.id,
                                                                                            index,
                                                                                            parseInt(
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            ) ||
                                                                                                0
                                                                                        )
                                                                                    }
                                                                                    className={`w-20 text-xs transition-colors ${
                                                                                        isSectionSplitValid(
                                                                                            section.id
                                                                                        )
                                                                                            ? "border-green-500 bg-green-50 text-green-700 focus:border-green-600"
                                                                                            : "border-red-300 bg-red-50"
                                                                                    }`}
                                                                                    placeholder="0"
                                                                                />
                                                                                <span className="text-xs text-gray-500 mt-1">
                                                                                    m
                                                                                </span>
                                                                            </div>

                                                                            {/* Total for this part */}
                                                                            <span className="text-xs text-gray-500 mx-2">
                                                                                (
                                                                                {duration.toFixed(
                                                                                    2
                                                                                )}

                                                                                h
                                                                                total)
                                                                            </span>

                                                                            {/* Remove button */}
                                                                            {section
                                                                                .splitDurations
                                                                                .length >
                                                                                1 && (
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={() =>
                                                                                        removeSectionSplit(
                                                                                            section.id,
                                                                                            index
                                                                                        )
                                                                                    }
                                                                                    className="h-6 w-6 p-0 ml-2"
                                                                                >
                                                                                    <Minus className="h-3 w-3" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                }
                                                            )}

                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    addSectionSplit(
                                                                        section.id
                                                                    )
                                                                }
                                                                className="w-full text-xs mt-3 mb-4"
                                                            >
                                                                <Plus className="h-3 w-3 mr-1" />
                                                                Add Another Part
                                                            </Button>

                                                            <div
                                                                className={`text-xs p-3 rounded transition-colors mt-4 ${
                                                                    isSectionSplitValid(
                                                                        section.id
                                                                    )
                                                                        ? "bg-green-100 border border-green-200"
                                                                        : "bg-red-50 border border-red-200"
                                                                }`}
                                                            >
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="mr-2">
                                                                        Total
                                                                        Duration:
                                                                    </span>
                                                                    <span
                                                                        className={`font-bold text-sm ml-2 ${
                                                                            isSectionSplitValid(
                                                                                section.id
                                                                            )
                                                                                ? "text-green-700"
                                                                                : "text-red-700"
                                                                        }`}
                                                                    >
                                                                        {(() => {
                                                                            const totalDecimal =
                                                                                getSectionTotalSplitDuration(
                                                                                    section.id
                                                                                );
                                                                            const {
                                                                                hours: totalHours,
                                                                                minutes:
                                                                                    totalMinutes,
                                                                            } =
                                                                                convertSplitDurationToHoursMinutes(
                                                                                    totalDecimal
                                                                                );
                                                                            return `${totalHours}h ${totalMinutes}m (${totalDecimal.toFixed(
                                                                                2
                                                                            )}) / ${durationHours}h ${durationMinutes}m (${formData.duration.toFixed(
                                                                                2
                                                                            )})`;
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                                {isSectionSplitValid(
                                                                    section.id
                                                                ) ? (
                                                                    <div className="text-green-700 text-xs mt-2 flex items-center">
                                                                        <Check className="h-3 w-3 mr-2" />
                                                                        Duration
                                                                        split is
                                                                        valid
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-red-700 text-xs mt-2">
                                                                        Total
                                                                        must
                                                                        equal
                                                                        course
                                                                        duration
                                                                        (
                                                                        {
                                                                            durationHours
                                                                        }
                                                                        h{" "}
                                                                        {
                                                                            durationMinutes
                                                                        }
                                                                        m)
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-2">
                                                    <Label className="text-xs text-gray-700">
                                                        Status
                                                    </Label>
                                                    <Select
                                                        value={
                                                            section.status ||
                                                            "offline"
                                                        }
                                                        onValueChange={(
                                                            value
                                                        ) =>
                                                            updateSectionStatus(
                                                                section.id,
                                                                value
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="mt-1 text-sm border-gray-300">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="online">
                                                                Online
                                                            </SelectItem>
                                                            <SelectItem value="offline">
                                                                Offline
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                onClick={handleAddCourse}
                                disabled={!isFormValid()}
                                className={`text-sm px-3 py-1.5 transition-colors ${
                                    isFormValid()
                                        ? "bg-[#2F2F85] hover:bg-[#3F3F8F] text-white"
                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                }`}
                            >
                                Add Course
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Course Dialog - Add this after your Add Course Dialog */}
                <Dialog
                    open={isEditDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) resetForm();
                        setIsEditDialogOpen(open);
                    }}
                >
                    <DialogContent className="bg-white max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Edit Course
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Course Code Field with Validation */}
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="edit-code"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Course Code
                                    </Label>
                                    <Input
                                        id="edit-code"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleInputChange}
                                        className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                            validationErrors.code
                                                ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                                                : ""
                                        }`}
                                        placeholder="CS101"
                                    />
                                    {validationErrors.code && (
                                        <p className="text-xs text-red-600 flex items-center">
                                            <svg
                                                className="w-3 h-3 mr-1 flex-shrink-0"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            {validationErrors.code}
                                        </p>
                                    )}
                                </div>

                                {/* Course Title Field with Validation */}
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="edit-title"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Course Name
                                    </Label>
                                    <Input
                                        id="edit-title"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                        className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                            validationErrors.title
                                                ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                                                : ""
                                        }`}
                                        placeholder="Introduction to Programming"
                                    />
                                    {validationErrors.title && (
                                        <p className="text-xs text-red-600 flex items-center">
                                            <svg
                                                className="w-3 h-3 mr-1 flex-shrink-0"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            {validationErrors.title}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Major Field with Validation */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-major"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Major
                                </Label>
                                <Select
                                    value={selectedMajor}
                                    onValueChange={handleMajorChange}
                                >
                                    <SelectTrigger
                                        className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                            validationErrors.major
                                                ? "border-red-300 bg-red-50"
                                                : ""
                                        }`}
                                    >
                                        <SelectValue placeholder="Select a major" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {majors.length === 0 ? (
                                            <div className="p-2 text-xs text-gray-500 text-center">
                                                No majors available
                                            </div>
                                        ) : (
                                            majors.map((major) => (
                                                <SelectItem
                                                    key={major.id}
                                                    value={major.name}
                                                >
                                                    {major.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {validationErrors.major && (
                                    <p
                                        className={`text-xs flex items-center ${
                                            validationErrors.major.includes(
                                                "create"
                                            )
                                                ? "text-amber-600"
                                                : "text-red-600"
                                        }`}
                                    >
                                        <svg
                                            className="w-3 h-3 mr-1 flex-shrink-0"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            {validationErrors.major.includes(
                                                "create"
                                            ) ? (
                                                <path
                                                    fillRule="evenodd"
                                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            ) : (
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            )}
                                        </svg>
                                        {validationErrors.major}
                                    </p>
                                )}
                            </div>

                            {/* Color Field with Color Picker */}
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="edit-color"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Color
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        {/* Color picker input */}
                                        <div className="relative">
                                            <input
                                                type="color"
                                                id="edit-color"
                                                name="color"
                                                value={
                                                    formData?.color || "#3B82F6"
                                                } // Default to blue hex
                                                onChange={(e) => {
                                                    const hexColor =
                                                        e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        color: hexColor,
                                                    });
                                                    // Trigger validation after state update
                                                    setTimeout(validateForm, 0);
                                                }}
                                                className="w-12 h-10 rounded border border-gray-300 cursor-pointer hover:border-gray-400 focus:border-[#2F2F85] focus:ring-1 focus:ring-[#2F2F85]"
                                                style={{
                                                    padding: "2px",
                                                    backgroundColor:
                                                        "transparent",
                                                }}
                                            />
                                            {/* Visual preview of selected color */}
                                            <div
                                                className="absolute inset-1 rounded pointer-events-none"
                                                style={{
                                                    backgroundColor:
                                                        formData?.color ||
                                                        "#3B82F6",
                                                }}
                                            />
                                        </div>

                                        {/* Color value display */}
                                        <div className="flex-1">
                                            <Input
                                                type="text"
                                                value={formData?.color || ""}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value;
                                                    // Validate hex color format
                                                    if (
                                                        /^#[0-9A-F]{6}$/i.test(
                                                            value
                                                        ) ||
                                                        value === ""
                                                    ) {
                                                        setFormData({
                                                            ...formData,
                                                            color: value,
                                                        });
                                                        setTimeout(
                                                            validateForm,
                                                            0
                                                        );
                                                    }
                                                }}
                                                placeholder="#3B82F6"
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm font-mono"
                                            />
                                        </div>

                                        {/* Quick color presets */}
                                        <div className="flex gap-1">
                                            {[
                                                "#3B82F6", // Blue
                                                "#EF4444", // Red
                                                "#10B981", // Green
                                                "#F59E0B", // Yellow
                                                "#8B5CF6", // Purple
                                                "#EC4899", // Pink
                                                "#6B7280", // Gray
                                                "#F97316", // Orange
                                            ].map((presetColor) => (
                                                <button
                                                    key={presetColor}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            color: presetColor,
                                                        });
                                                        setTimeout(
                                                            validateForm,
                                                            0
                                                        );
                                                    }}
                                                    className="w-6 h-6 rounded border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F2F85] focus:ring-offset-1"
                                                    style={{
                                                        backgroundColor:
                                                            presetColor,
                                                    }}
                                                    title={presetColor}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Choose a color for this course or enter
                                        a custom hex value
                                    </p>
                                </div>
                            </div>

                            {/* Duration and Capacity Fields */}
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Duration
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor="edit-duration-hours"
                                                className="text-xs text-gray-600"
                                            >
                                                Hours
                                            </Label>
                                            <Input
                                                id="edit-duration-hours"
                                                name="durationHours"
                                                type="number"
                                                min="0"
                                                max="23"
                                                value={durationHours}
                                                onChange={handleInputChange}
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor="edit-duration-minutes"
                                                className="text-xs text-gray-600"
                                            >
                                                Minutes
                                            </Label>
                                            <Input
                                                id="edit-duration-minutes"
                                                name="durationMinutes"
                                                type="number"
                                                min="0"
                                                max="59"
                                                step="5"
                                                value={durationMinutes}
                                                onChange={handleInputChange}
                                                className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Total: {durationHours}h{" "}
                                        {durationMinutes}m (
                                        {formData.duration.toFixed(2)} hours)
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="edit-capacity"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Capacity
                                    </Label>
                                    <Input
                                        id="edit-capacity"
                                        name="capacity"
                                        type="number"
                                        min="1"
                                        value={formData.capacity}
                                        onChange={handleInputChange}
                                        className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm"
                                    />
                                </div>
                            </div>

                            {/* Sections with Validation - Same as Add Dialog */}
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm font-medium text-gray-700">
                                        Sections
                                    </Label>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Edit course sections with instructors
                                        and split durations
                                    </p>
                                </div>

                                {/* Add Section Form */}
                                <div className="grid gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="edit-section"
                                                className="text-sm font-medium text-gray-700"
                                            >
                                                Section Number
                                            </Label>
                                            <Input
                                                id="edit-section"
                                                placeholder="Enter section number"
                                                value={currentSection}
                                                onChange={(e) =>
                                                    handleSectionInputChange(
                                                        e.target.value
                                                    )
                                                }
                                                className={`border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm ${
                                                    sectionValidationError
                                                        ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                                                        : ""
                                                }`}
                                            />
                                            {sectionValidationError && (
                                                <p className="text-xs text-red-600 flex items-center">
                                                    <svg
                                                        className="w-3 h-3 mr-1 flex-shrink-0"
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    {sectionValidationError}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="edit-section-instructor"
                                                className="text-sm font-medium text-gray-700"
                                            >
                                                Instructor{" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </Label>
                                            <Popover
                                                open={currentInstructorOpen}
                                                onOpenChange={
                                                    setCurrentInstructorOpen
                                                }
                                            >
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={`w-full justify-between text-sm ${
                                                            instructorValidationError
                                                                ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                                                                : "border-gray-300"
                                                        }`}
                                                        disabled={
                                                            instructors.length ===
                                                            0
                                                        }
                                                    >
                                                        {currentInstructor?.name ||
                                                            "Select instructor..."}
                                                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search instructor..." />
                                                        <CommandEmpty>
                                                            No instructor found.
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {instructors.map(
                                                                (
                                                                    instructor
                                                                ) => (
                                                                    <CommandItem
                                                                        key={
                                                                            instructor.id
                                                                        }
                                                                        value={`${instructor.first_name} ${instructor.last_name}`}
                                                                        onSelect={() => {
                                                                            handleInstructorChange(
                                                                                {
                                                                                    id: instructor.id.toString(),
                                                                                    name: `${instructor.first_name} ${instructor.last_name}`,
                                                                                }
                                                                            );
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={`mr-2 h-3 w-3 ${
                                                                                currentInstructor?.id ===
                                                                                instructor.id.toString()
                                                                                    ? "opacity-100"
                                                                                    : "opacity-0"
                                                                            }`}
                                                                        />
                                                                        {
                                                                            instructor.first_name
                                                                        }{" "}
                                                                        {
                                                                            instructor.last_name
                                                                        }
                                                                    </CommandItem>
                                                                )
                                                            )}
                                                        </CommandGroup>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>

                                            {/* Show instructor validation error */}
                                            {instructorValidationError && (
                                                <p className="text-xs text-red-600 flex items-center">
                                                    <svg
                                                        className="w-3 h-3 mr-1 flex-shrink-0"
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    {instructorValidationError}
                                                </p>
                                            )}

                                            {/* Show warning if no instructors available */}
                                            {instructors.length === 0 && (
                                                <p className="text-xs text-amber-600 flex items-center">
                                                    <svg
                                                        className="w-3 h-3 mr-1 flex-shrink-0"
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    Please create an instructor
                                                    first
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        onClick={addSection}
                                        disabled={
                                            !currentSection.trim() ||
                                            !!sectionValidationError
                                        }
                                        className={`w-full text-sm transition-colors ${
                                            !currentSection.trim() ||
                                            !!sectionValidationError
                                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                                : "bg-[#2F2F85] hover:bg-[#3F3F8F] text-white"
                                        }`}
                                    >
                                        <Plus className="h-3 w-3 mr-2" /> Add
                                        Section
                                    </Button>
                                </div>

                                {/* Existing sections list - Same as Add Dialog */}
                                {sections.length > 0 && (
                                    <div className="space-y-2">
                                        {sections.map((section) => (
                                            <div
                                                key={section.id}
                                                className="p-3 border border-gray-200 rounded bg-gray-50"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                        Section{" "}
                                                        {section.section_id}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            removeSection(
                                                                section.id
                                                            )
                                                        }
                                                        className="h-6 w-6 text-gray-500 hover:text-red-600"
                                                    >
                                                        <Trash className="h-3 w-3" />
                                                    </Button>
                                                </div>

                                                <div className="mt-2">
                                                    <Label className="text-xs text-gray-700">
                                                        Instructor
                                                    </Label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                className="w-full justify-between mt-1 text-sm border-gray-300"
                                                            >
                                                                {section.instructor_name ||
                                                                    "Select instructor..."}
                                                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-full p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Search instructor..." />
                                                                <CommandEmpty>
                                                                    No
                                                                    instructor
                                                                    found.
                                                                </CommandEmpty>
                                                                <CommandGroup>
                                                                    {instructors.map(
                                                                        (
                                                                            instructor
                                                                        ) => (
                                                                            <CommandItem
                                                                                key={
                                                                                    instructor.id
                                                                                }
                                                                                value={`${instructor.first_name} ${instructor.last_name}`}
                                                                                onSelect={() => {
                                                                                    updateSectionInstructor(
                                                                                        section.id,
                                                                                        instructor.id.toString(),
                                                                                        `${instructor.first_name} ${instructor.last_name}`
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={`mr-2 h-3 w-3 ${
                                                                                        section.instructor_id ===
                                                                                        instructor.id.toString()
                                                                                            ? "opacity-100"
                                                                                            : "opacity-0"
                                                                                    }`}
                                                                                />
                                                                                {
                                                                                    instructor.first_name
                                                                                }{" "}
                                                                                {
                                                                                    instructor.last_name
                                                                                }
                                                                            </CommandItem>
                                                                        )
                                                                    )}
                                                                </CommandGroup>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>

                                                {/* Split Duration Controls - Same as Add Dialog */}
                                                <div className="mt-4 mb-4 space-y-3">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <Label className="text-xs text-gray-700 mr-2">
                                                            Split Duration
                                                        </Label>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                toggleSectionSplitControls(
                                                                    section.id
                                                                )
                                                            }
                                                            className="text-xs ml-2"
                                                        >
                                                            {section.showSplitControls
                                                                ? "Hide Split"
                                                                : "Split Duration"}
                                                        </Button>
                                                    </div>

                                                    {section.showSplitControls && (
                                                        <div className="mt-4 mb-4">
                                                            <div className="text-xs text-gray-600 mb-3">
                                                                Original
                                                                Duration:{" "}
                                                                {durationHours}h{" "}
                                                                {
                                                                    durationMinutes
                                                                }
                                                                m (
                                                                {formData.duration.toFixed(
                                                                    2
                                                                )}{" "}
                                                                hours)
                                                            </div>

                                                            {section.splitDurations.map(
                                                                (
                                                                    duration,
                                                                    index
                                                                ) => {
                                                                    const {
                                                                        hours,
                                                                        minutes,
                                                                    } =
                                                                        convertSplitDurationToHoursMinutes(
                                                                            duration
                                                                        );
                                                                    return (
                                                                        <div
                                                                            key={
                                                                                index
                                                                            }
                                                                            className="flex items-center gap-2 mb-3"
                                                                        >
                                                                            <Label className="text-xs w-12 mr-2">
                                                                                Part{" "}
                                                                                {index +
                                                                                    1}

                                                                                :
                                                                            </Label>

                                                                            {/* Hours Input */}
                                                                            <div className="flex flex-col items-center">
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max="23"
                                                                                    value={
                                                                                        hours
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        updateSectionSplitDurationHours(
                                                                                            section.id,
                                                                                            index,
                                                                                            parseInt(
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            ) ||
                                                                                                0
                                                                                        )
                                                                                    }
                                                                                    className={`w-20 text-xs transition-colors ${
                                                                                        isSectionSplitValid(
                                                                                            section.id
                                                                                        )
                                                                                            ? "border-green-500 bg-green-50 text-green-700 focus:border-green-600"
                                                                                            : "border-red-300 bg-red-50"
                                                                                    }`}
                                                                                    placeholder="0"
                                                                                />
                                                                                <span className="text-xs text-gray-500 mt-1">
                                                                                    h
                                                                                </span>
                                                                            </div>

                                                                            {/* Minutes Input */}
                                                                            <div className="flex flex-col items-center">
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max="59"
                                                                                    step="5"
                                                                                    value={
                                                                                        minutes
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        updateSectionSplitDurationMinutes(
                                                                                            section.id,
                                                                                            index,
                                                                                            parseInt(
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            ) ||
                                                                                                0
                                                                                        )
                                                                                    }
                                                                                    className={`w-20 text-xs transition-colors ${
                                                                                        isSectionSplitValid(
                                                                                            section.id
                                                                                        )
                                                                                            ? "border-green-500 bg-green-50 text-green-700 focus:border-green-600"
                                                                                            : "border-red-300 bg-red-50"
                                                                                    }`}
                                                                                    placeholder="0"
                                                                                />
                                                                                <span className="text-xs text-gray-500 mt-1">
                                                                                    m
                                                                                </span>
                                                                            </div>

                                                                            {/* Total for this part */}
                                                                            <span className="text-xs text-gray-500 mx-2">
                                                                                (
                                                                                {duration.toFixed(
                                                                                    2
                                                                                )}

                                                                                h
                                                                                total)
                                                                            </span>

                                                                            {/* Remove button */}
                                                                            {section
                                                                                .splitDurations
                                                                                .length >
                                                                                1 && (
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={() =>
                                                                                        removeSectionSplit(
                                                                                            section.id,
                                                                                            index
                                                                                        )
                                                                                    }
                                                                                    className="h-6 w-6 p-0 ml-2"
                                                                                >
                                                                                    <Minus className="h-3 w-3" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                }
                                                            )}

                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    addSectionSplit(
                                                                        section.id
                                                                    )
                                                                }
                                                                className="w-full text-xs mt-3 mb-4"
                                                            >
                                                                <Plus className="h-3 w-3 mr-1" />
                                                                Add Another Part
                                                            </Button>

                                                            <div
                                                                className={`text-xs p-3 rounded transition-colors mt-4 ${
                                                                    isSectionSplitValid(
                                                                        section.id
                                                                    )
                                                                        ? "bg-green-100 border border-green-200"
                                                                        : "bg-red-50 border border-red-200"
                                                                }`}
                                                            >
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="mr-2">
                                                                        Total
                                                                        Duration:
                                                                    </span>
                                                                    <span
                                                                        className={`font-bold text-sm ml-2 ${
                                                                            isSectionSplitValid(
                                                                                section.id
                                                                            )
                                                                                ? "text-green-700"
                                                                                : "text-red-700"
                                                                        }`}
                                                                    >
                                                                        {(() => {
                                                                            const totalDecimal =
                                                                                getSectionTotalSplitDuration(
                                                                                    section.id
                                                                                );
                                                                            const {
                                                                                hours: totalHours,
                                                                                minutes:
                                                                                    totalMinutes,
                                                                            } =
                                                                                convertSplitDurationToHoursMinutes(
                                                                                    totalDecimal
                                                                                );
                                                                            return `${totalHours}h ${totalMinutes}m (${totalDecimal.toFixed(
                                                                                2
                                                                            )}) / ${durationHours}h ${durationMinutes}m (${formData.duration.toFixed(
                                                                                2
                                                                            )})`;
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                                {isSectionSplitValid(
                                                                    section.id
                                                                ) ? (
                                                                    <div className="text-green-700 text-xs mt-2 flex items-center">
                                                                        <Check className="h-3 w-3 mr-2" />
                                                                        Duration
                                                                        split is
                                                                        valid
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-red-700 text-xs mt-2">
                                                                        Total
                                                                        must
                                                                        equal
                                                                        course
                                                                        duration
                                                                        (
                                                                        {
                                                                            durationHours
                                                                        }
                                                                        h{" "}
                                                                        {
                                                                            durationMinutes
                                                                        }
                                                                        m)
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-2">
                                                    <Label className="text-xs text-gray-700">
                                                        Status
                                                    </Label>
                                                    <Select
                                                        value={
                                                            section.status ||
                                                            "offline"
                                                        }
                                                        onValueChange={(
                                                            value
                                                        ) =>
                                                            updateSectionStatus(
                                                                section.id,
                                                                value
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="mt-1 text-sm border-gray-300">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="online">
                                                                Online
                                                            </SelectItem>
                                                            <SelectItem value="offline">
                                                                Offline
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                onClick={handleEditCourse}
                                disabled={!isFormValid()}
                                className={`text-sm px-3 py-1.5 transition-colors ${
                                    isFormValid()
                                        ? "bg-[#2F2F85] hover:bg-[#3F3F8F] text-white"
                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                }`}
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
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Delete Course
                            </DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Are you sure you want to delete this course?
                            </p>
                            <p className="font-medium text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                                {selectedCourse?.code}: {selectedCourse?.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                This action cannot be undone.
                            </p>
                        </div>
                        <DialogFooter className="border-t border-gray-200 pt-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedCourse(null);
                                    setIsDeleteDialogOpen(false);
                                }}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-3 py-1.5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteCourse}
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
                    <DialogContent className="bg-white max-w-lg">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Import Courses from CSV
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
                                <div className="text-xs text-gray-600 mt-2 space-y-2">
                                    <p>
                                        <strong>Required CSV columns:</strong>
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>
                                            <strong>code:</strong> Course code
                                            (e.g., CS101)
                                        </li>
                                        <li>
                                            <strong>title:</strong> Course name
                                        </li>
                                        <li>
                                            <strong>major:</strong> Must match
                                            existing major names
                                        </li>
                                        <li>
                                            <strong>color:</strong> Color name
                                            (e.g., blue, red, green)
                                        </li>
                                        <li>
                                            <strong>status:</strong> "online" or
                                            "offline"
                                        </li>
                                        <li>
                                            <strong>duration:</strong> Course
                                            duration (e.g., 3)
                                        </li>
                                        <li>
                                            <strong>separated_duration:</strong>{" "}
                                            Individual section duration (e.g.,
                                            1.5)
                                        </li>
                                        <li>
                                            <strong>capacity:</strong> Maximum
                                            students (e.g., 30)
                                        </li>
                                        <li>
                                            <strong>section:</strong> Section
                                            identifier (e.g., 1, 2, A, B)
                                        </li>
                                        <li>
                                            <strong>classroom:</strong>{" "}
                                            Classroom name (optional)
                                        </li>
                                        <li>
                                            <strong>instructor_name:</strong>{" "}
                                            Full name (optional, must match
                                            existing instructor)
                                        </li>
                                    </ul>
                                    <div className="bg-blue-50 p-2 rounded border border-blue-200 mt-2">
                                        <p className="text-blue-700 font-medium mb-1">
                                            Notes:
                                        </p>
                                        <p className="text-blue-600 text-xs">
                                            • Multiple rows with same code =
                                            different sections
                                        </p>
                                        <p className="text-blue-600 text-xs">
                                            • separated_duration is for
                                            individual section scheduling
                                        </p>
                                        <p className="text-blue-600 text-xs">
                                            • Status must be exactly "online" or
                                            "offline"
                                        </p>
                                    </div>
                                </div>
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
                                <div className="max-h-40 overflow-y-auto bg-red-50 p-2 rounded border border-red-200">
                                    <p className="text-xs font-medium text-red-600 mb-1">
                                        Errors ({importProgress.errors.length}):
                                    </p>
                                    <div className="text-xs space-y-1">
                                        {importProgress.errors
                                            .slice(0, 10)
                                            .map((error, index) => (
                                                <p
                                                    key={index}
                                                    className="text-red-600"
                                                >
                                                    {error}
                                                </p>
                                            ))}
                                        {importProgress.errors.length > 10 && (
                                            <p className="text-red-600 font-medium">
                                                ... and{" "}
                                                {importProgress.errors.length -
                                                    10}{" "}
                                                more errors
                                            </p>
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
                <Dialog
                    open={isClearAllDialogOpen}
                    onOpenChange={setIsClearAllDialogOpen}
                >
                    <DialogContent className="bg-white max-w-md">
                        <DialogHeader className="border-b border-gray-200 pb-3">
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Clear All Courses
                            </DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Are you sure you want to delete all courses?
                            </p>
                            <p className="text-xs text-red-600 font-medium">
                                This will permanently delete {courses.length}{" "}
                                course(s) and all their sections. This action
                                cannot be undone.
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
                                onClick={handleClearAllCourses}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5"
                            >
                                Clear All
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
