"use client";

import type React from "react";

import type { Major, MajorFormData } from "@/app/types";
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
import { Pencil, Plus, Trash } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const ITEMS_PER_PAGE = 10;
// Add this type definition near the top of your component
type MajorUpdate = {
    id: number;
    name: string;
    shortTag: string; // Use camelCase to match the API
    year: number | null; // Allow both number and null
};

export default function MajorView() {
    const [majors, setMajors] = useState<Major[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);
    const [selectedMajor, setSelectedMajor] = useState<Major | null>(null);
    const [formData, setFormData] = useState<MajorFormData>({
        name: "",
        shortTag: "",
        numberOfYears: 4, // Default to 4 years
    });
    const [currentPage, setCurrentPage] = useState(1);
    const params = useParams();

    // Load majors on component mount
    useEffect(() => {
        fetchMajors();
    }, [params]); // Add params as a dependency since it's used in fetchMajors

    // Clear status message after 5 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    // Calculate pagination values
    const totalPages = Math.ceil(majors.length / ITEMS_PER_PAGE);
    const paginatedMajors = majors.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Fetch only unique majors (filter out year variations)
    const fetchMajors = async () => {
        try {
            const scheduleId = params.id;
            if (!scheduleId) {
                console.error("Schedule ID is undefined");
                setStatusMessage({
                    text: "Missing schedule ID. Please check the URL.",
                    type: "error",
                });
                return;
            }

            // Add a console log to debug the API call
            console.log(`Fetching majors for schedule ID: ${scheduleId}`);

            const response = await fetch(
                `/api/majors?scheduleId=${scheduleId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.text();
                console.error("Server response:", errorData);
                throw new Error(
                    `Failed to fetch majors: ${response.status} ${response.statusText}`
                );
            }

            const data = await response.json();
            console.log("Majors data received:", data);

            if (!Array.isArray(data)) {
                console.error("Expected array but got:", typeof data);
                setStatusMessage({
                    text: "Invalid data format received from server.",
                    type: "error",
                });
                return;
            }

            // Group majors by name
            const majorGroups: Record<string, Major[]> = data.reduce(
                (groups: Record<string, Major[]>, major: Major) => {
                    // Ensure major has a name property before using it
                    if (!major || !major.name) {
                        console.warn(
                            "Skipping major with missing name:",
                            major
                        );
                        return groups;
                    }

                    const name = major.name.replace(/\s+Year\s+\d+$/, ""); // Remove "Year X" suffix
                    if (!groups[name]) {
                        groups[name] = [];
                    }
                    groups[name].push(major);
                    return groups;
                },
                {}
            );

            // Extract unique majors (base entries)
            const uniqueMajors = Object.keys(majorGroups).map((name) => {
                const majorGroup = majorGroups[name];
                const baseMajor =
                    majorGroup.find((m: Major) => !m.year) || majorGroup[0];

                // Count how many years this major has
                const years = majorGroup
                    .filter((m: Major) => m.year)
                    .map((m: Major) => m.year as number)
                    .sort((a, b) => a - b);

                return {
                    ...baseMajor,
                    numberOfYears: years.length || 4, // Default to 4 if no years found
                    years,
                };
            });

            console.log("Processed unique majors:", uniqueMajors);
            setMajors(uniqueMajors);
            // Reset to first page when data changes
            setCurrentPage(1);
        } catch (error: unknown) {
            console.error("Error fetching majors:", error);
            setStatusMessage({
                text: `Failed to load majors: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                type: "error",
            });
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleYearsChange = (value: string) => {
        setFormData({
            ...formData,
            numberOfYears: parseInt(value, 10),
        });
    };

    // Function to handle opening the add dialog
    const openAddDialog = () => {
        resetForm(); // Ensure form is clean before opening
        setIsAddDialogOpen(true);
    };

    const handleAddMajor = async () => {
        try {
            const scheduleId = params.id;
            if (!scheduleId) {
                throw new Error("Schedule ID is missing");
            }

            // Validate form data
            if (!formData.name || !formData.shortTag) {
                setStatusMessage({
                    text: "Name and short tag are required",
                    type: "error",
                });
                return;
            }

            console.log("Adding major with data:", {
                name: formData.name,
                shortTag: formData.shortTag,
                numberOfYears: formData.numberOfYears,
                scheduleId,
            });

            // Create an array for all the majors we need to add
            const majorsToAdd: Omit<Major, "id">[] = [];

            // Add year-specific majors
            for (let i = 1; i <= formData.numberOfYears; i++) {
                majorsToAdd.push({
                    name: `${formData.name} Year ${i}`,
                    shortTag: `${formData.shortTag}${i}`,
                    year: i,
                    scheduleId: Number(scheduleId),
                });
            }

            // Send batch request to add all majors
            const response = await fetch("/api/majors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ majors: majorsToAdd }),
            });

            // Log the full response for debugging
            const responseText = await response.text();
            console.log("Server response:", response.status, responseText);

            // Check if the response was successful
            if (!response.ok) {
                throw new Error(
                    `Failed to create majors: ${response.status} ${response.statusText}`
                );
            }

            // Refresh the major list
            await fetchMajors();

            // Close dialog and reset form
            setIsAddDialogOpen(false);
            resetForm();

            setStatusMessage({
                text: "Major added successfully",
                type: "success",
            });
        } catch (error: unknown) {
            console.error("Error adding major:", error);
            setStatusMessage({
                text: `Failed to add major: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                type: "error",
            });
        }
    };

    const handleEditMajor = async () => {
        if (!selectedMajor) return;

        try {
            const scheduleId = params.id;
            if (!scheduleId) {
                throw new Error("Schedule ID is missing");
            }

            // Validate form data
            if (!formData.name || !formData.shortTag) {
                setStatusMessage({
                    text: "Name and short tag are required",
                    type: "error",
                });
                return;
            }

            console.log(
                "Editing major:",
                selectedMajor,
                "with form data:",
                formData
            );

            // Find all year versions of this major
            const response = await fetch(
                `/api/majors?name=${encodeURIComponent(
                    selectedMajor.name
                )}&scheduleId=${scheduleId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error(
                    "Server response for fetching major details:",
                    errorText
                );
                throw new Error(
                    `Failed to fetch major details: ${response.status} ${response.statusText}`
                );
            }

            const existingMajors = await response.json();
            console.log("Existing majors found:", existingMajors);

            const baseMajor = existingMajors.find(
                (m: Major) => m.year === null
            );

            if (!baseMajor) {
                console.warn(
                    "Could not find base major, will use first major in the list"
                );
                if (existingMajors.length === 0) {
                    throw new Error("No majors found to update");
                }
            }

            // Update base major (or first major if no base is found)
            const baseMajorToUpdate = baseMajor || existingMajors[0];
            const baseMajorUpdate: MajorUpdate = {
                id: baseMajorToUpdate.id,
                name: formData.name,
                shortTag: formData.shortTag, // Using shortTag to match API
                year: null,
            };

            console.log("Base major update:", baseMajorUpdate);

            // Create array of all updates needed
            const updates: MajorUpdate[] = [baseMajorUpdate];

            // Delete majors if we're reducing the number of years
            const yearsToDelete = existingMajors
                .filter(
                    (m: Major) =>
                        typeof m.year === "number" &&
                        m.year > formData.numberOfYears
                )
                .map((m: Major) => m.id);

            if (yearsToDelete.length > 0) {
                console.log("Years to delete:", yearsToDelete);

                const deleteResponse = await fetch("/api/majors", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ ids: yearsToDelete }),
                });

                const deleteResponseText = await deleteResponse.text();
                console.log(
                    "Delete response:",
                    deleteResponse.status,
                    deleteResponseText
                );

                if (!deleteResponse.ok) {
                    throw new Error(
                        `Failed to delete excess year majors: ${deleteResponse.status} ${deleteResponse.statusText}`
                    );
                }
            }

            // Update existing year majors
            const yearsToUpdate = existingMajors.filter(
                (m: Major) =>
                    typeof m.year === "number" &&
                    m.year <= formData.numberOfYears
            );

            console.log("Years to update:", yearsToUpdate);

            yearsToUpdate.forEach((yearMajor: Major) => {
                if (typeof yearMajor.year === "number") {
                    updates.push({
                        id: yearMajor.id,
                        name: `${formData.name} Year ${yearMajor.year}`,
                        shortTag: `${formData.shortTag}${yearMajor.year}`, // Using shortTag consistently
                        year: yearMajor.year,
                    });
                }
            });

            // Add new year majors if we're increasing the number of years
            const existingYears = new Set(
                existingMajors
                    .filter((m: Major) => m.year)
                    .map((m: Major) => m.year)
            );
            const newYears = [];

            for (let i = 1; i <= formData.numberOfYears; i++) {
                if (!existingYears.has(i)) {
                    newYears.push({
                        name: `${formData.name} Year ${i}`,
                        shortTag: `${formData.shortTag}${i}`,
                        year: i,
                        scheduleId: Number(scheduleId),
                    });
                }
            }

            console.log("New years to add:", newYears);

            // Only send update request if there are updates to make
            if (updates.length > 0) {
                console.log("Sending updates:", updates);

                const updateResponse = await fetch("/api/majors", {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ updates }),
                });

                const updateResponseText = await updateResponse.text();
                console.log(
                    "Update response:",
                    updateResponse.status,
                    updateResponseText
                );

                if (!updateResponse.ok) {
                    throw new Error(
                        `Failed to update majors: ${updateResponse.status} ${updateResponse.statusText}`
                    );
                }
            }

            // Add new years if needed
            if (newYears.length > 0) {
                console.log("Adding new years:", newYears);

                const addResponse = await fetch("/api/majors", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ majors: newYears }),
                });

                const addResponseText = await addResponse.text();
                console.log(
                    "Add response:",
                    addResponse.status,
                    addResponseText
                );

                if (!addResponse.ok) {
                    throw new Error(
                        `Failed to add new year majors: ${addResponse.status} ${addResponse.statusText}`
                    );
                }
            }

            await fetchMajors();
            setIsEditDialogOpen(false);
            resetForm();
            setStatusMessage({
                text: "Major updated successfully",
                type: "success",
            });
        } catch (error: unknown) {
            console.error("Error updating major:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to update major. Please try again.",
                type: "error",
            });
        }
    };

    const handleDeleteMajor = async () => {
        if (!selectedMajor) return;

        try {
            const scheduleId = params.id;
            if (!scheduleId) {
                throw new Error("Schedule ID is missing");
            }

            console.log("Deleting major:", selectedMajor);

            // Find all year versions of this major using the same API endpoint as in GET
            const response = await fetch(
                `/api/majors?name=${encodeURIComponent(
                    selectedMajor.name
                )}&scheduleId=${scheduleId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error(
                    "Server response for fetching major details:",
                    errorText
                );
                throw new Error(
                    `Failed to fetch major details: ${response.status} ${response.statusText}`
                );
            }

            const deletedMajors = await response.json();
            console.log("Majors to delete:", deletedMajors);

            if (!Array.isArray(deletedMajors) || deletedMajors.length === 0) {
                throw new Error("No majors found to delete");
            }

            const majorIds = deletedMajors.map((m: Major) => m.id);
            console.log("Major IDs to delete:", majorIds);

            // Delete all related majors
            const deleteResponse = await fetch("/api/majors", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ids: majorIds }),
            });

            const deleteResponseText = await deleteResponse.text();
            console.log(
                "Delete response:",
                deleteResponse.status,
                deleteResponseText
            );

            if (!deleteResponse.ok) {
                throw new Error(
                    `Failed to delete majors: ${deleteResponse.status} ${deleteResponse.statusText}`
                );
            }

            // Refresh the major list
            await fetchMajors();

            // Close dialog
            setIsDeleteDialogOpen(false);
            setSelectedMajor(null);

            setStatusMessage({
                text: "Major deleted successfully",
                type: "success",
            });
        } catch (error: unknown) {
            console.error("Error deleting major:", error);
            setStatusMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete major. Please try again.",
                type: "error",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            shortTag: "",
            numberOfYears: 4,
        });
        setSelectedMajor(null);
    };

    const openEditDialog = (major: Major) => {
        resetForm(); // Reset first to clear any previous data
        setSelectedMajor(major);
        setFormData({
            name: major.name,
            shortTag: major.shortTag,
            numberOfYears: major.numberOfYears || 4,
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (major: Major) => {
        setSelectedMajor(major);
        setIsDeleteDialogOpen(true);
    };

    // Helper function to get year short tags for display
    const getYearShortTags = (major: Major) => {
        if (!major || !major.shortTag) return "";

        const yearTags = [];
        for (let i = 1; i <= (major.numberOfYears || 4); i++) {
            yearTags.push(`${major.shortTag}${i}`);
        }
        return yearTags.join(", ");
    };

    return (
        <div>
            <>
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
                    <h2 className="text-xl font-bold">Majors</h2>
                    <Button
                        onClick={openAddDialog}
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
                                    YEARS
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    SHORT TAGS
                                </th>
                                <th className="border p-2 bg-gray-100 text-left">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {majors.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="border p-4 text-center"
                                    >
                                        No majors found. Add a new major to get
                                        started.
                                    </td>
                                </tr>
                            ) : (
                                paginatedMajors.map((major) => (
                                    <tr key={major.id}>
                                        <td className="border p-2">
                                            {major.id}
                                        </td>
                                        <td className="border p-2">
                                            {major.name}
                                        </td>
                                        <td className="border p-2">
                                            {major.numberOfYears || 4}
                                        </td>
                                        <td className="border p-2">
                                            {getYearShortTags(major)}
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Add pagination if we have majors */}
                {majors.length > 0 && (
                    <CustomPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                )}
            </>

            {/* Add Major Dialog */}
            <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsAddDialogOpen(open);
                }}
            >
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
                                placeholder="Computer Science"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="shortTag">Short Tag</Label>
                            <Input
                                id="shortTag"
                                name="shortTag"
                                value={formData.shortTag}
                                onChange={handleInputChange}
                                placeholder="CS"
                            />
                            <span className="text-sm text-gray-500">
                                Enter only the major code (e.g., CS for Computer
                                Science)
                            </span>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="numberOfYears">
                                Number of Years
                            </Label>
                            <Select
                                onValueChange={handleYearsChange}
                                defaultValue="4"
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select number of years" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 Year</SelectItem>
                                    <SelectItem value="2">2 Years</SelectItem>
                                    <SelectItem value="3">3 Years</SelectItem>
                                    <SelectItem value="4">4 Years</SelectItem>
                                    <SelectItem value="5">5 Years</SelectItem>
                                    <SelectItem value="6">6 Years</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="mt-2 p-2 bg-gray-50 rounded">
                            <p className="font-medium">Preview:</p>
                            <div className="mt-1">
                                <p className="font-medium">{formData.name}</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {Array.from(
                                        { length: formData.numberOfYears },
                                        (_, i) => i + 1
                                    ).map((year) => (
                                        <span
                                            key={year}
                                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded"
                                        >
                                            {formData.shortTag}
                                            {year} (Year {year})
                                        </span>
                                    ))}
                                </div>
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
                        <Button onClick={handleAddMajor}>Add Major</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Major Dialog */}
            <Dialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsEditDialogOpen(open);
                }}
            >
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
                            <Label htmlFor="edit-shortTag">Short Tag</Label>
                            <Input
                                id="edit-shortTag"
                                name="shortTag"
                                value={formData.shortTag}
                                onChange={handleInputChange}
                            />
                            <span className="text-sm text-gray-500">
                                Enter only the major code (e.g., CS for Computer
                                Science)
                            </span>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-numberOfYears">
                                Number of Years
                            </Label>
                            <Select
                                onValueChange={handleYearsChange}
                                value={formData.numberOfYears.toString()}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select number of years" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 Year</SelectItem>
                                    <SelectItem value="2">2 Years</SelectItem>
                                    <SelectItem value="3">3 Years</SelectItem>
                                    <SelectItem value="4">4 Years</SelectItem>
                                    <SelectItem value="5">5 Years</SelectItem>
                                    <SelectItem value="6">6 Years</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="mt-2 p-2 bg-gray-50 rounded">
                            <p className="font-medium">Preview:</p>
                            <div className="mt-1">
                                <p className="font-medium">{formData.name}</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {Array.from(
                                        { length: formData.numberOfYears },
                                        (_, i) => i + 1
                                    ).map((year) => (
                                        <span
                                            key={year}
                                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded"
                                        >
                                            {formData.shortTag}
                                            {year} (Year {year})
                                        </span>
                                    ))}
                                </div>
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
                        <Button onClick={handleEditMajor}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Major Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (!open) setSelectedMajor(null);
                    setIsDeleteDialogOpen(open);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Major</DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p>Are you sure you want to delete this major?</p>
                        <p className="font-medium mt-2">
                            {selectedMajor?.name}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            This will delete all{" "}
                            {selectedMajor?.numberOfYears || 4} years of this
                            major.
                        </p>
                        <div className="mt-2">
                            <p className="text-sm">
                                Short tags that will be deleted:
                            </p>
                            <p className="text-sm font-medium">
                                {selectedMajor &&
                                    getYearShortTags(selectedMajor)}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedMajor(null);
                                setIsDeleteDialogOpen(false);
                            }}
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
