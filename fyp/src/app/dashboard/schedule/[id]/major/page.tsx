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

// Define a more specific type for majors being added to the DB, excluding UI-only fields
type MajorCreatePayload = Omit<Major, "id" | "numberOfYears" | "years">;

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

            if (!Array.isArray(data)) {
                console.error("Expected array but got:", typeof data);
                setStatusMessage({
                    text: "Invalid data format received from server.",
                    type: "error",
                });
                return;
            }

            // Group majors by their derived base name
            const majorGroups: Record<string, Major[]> = data.reduce(
                (groups: Record<string, Major[]>, major: Major) => {
                    if (
                        !major ||
                        typeof major.name !== "string" ||
                        major.year === null
                    ) {
                        // Skip if not a year-specific entry
                        console.warn(
                            "Skipping major with missing/invalid name or non-year entry:",
                            major
                        );
                        return groups;
                    }
                    // Derive base name by stripping " Year X"
                    const baseName = major.name.replace(/\s+Year\s+\d+$/, "");
                    if (!groups[baseName]) {
                        groups[baseName] = [];
                    }
                    groups[baseName].push(major);
                    return groups;
                },
                {}
            );

            // Construct "conceptual" unique majors from the groups
            const uniqueMajors = Object.keys(majorGroups)
                .map((baseName) => {
                    const majorGroup = majorGroups[baseName];
                    if (!majorGroup || majorGroup.length === 0) return null; // Should not happen

                    // Sort by year to pick a consistent representative entry (e.g., Year 1)
                    majorGroup.sort(
                        (a, b) => (a.year || Infinity) - (b.year || Infinity)
                    );
                    const representativeYearEntry = majorGroup[0]; // e.g., the "Year 1" entry

                    const years = majorGroup
                        .map((m: Major) => m.year as number)
                        .sort((a, b) => a - b);

                    // Derive base short tag from the representative entry's short tag
                    // e.g., "CS1" -> "CS"
                    const baseShortTag =
                        representativeYearEntry.shortTag.replace(/\d+$/, "");

                    return {
                        id: representativeYearEntry.id, // Use ID of a constituent entry (e.g., Year 1)
                        name: baseName, // Derived base name
                        shortTag: baseShortTag, // Derived base short tag
                        numberOfYears: years.length,
                        years: years,
                        scheduleId: representativeYearEntry.scheduleId, // Essential for subsequent API calls
                    };
                })
                .filter(Boolean) as Major[]; // Filter out any nulls

            setMajors(uniqueMajors);
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

    const openAddDialog = () => {
        resetForm();
        setIsAddDialogOpen(true);
    };

    const handleAddMajor = async () => {
        try {
            const scheduleId = params.id;
            if (!scheduleId) {
                throw new Error("Schedule ID is missing");
            }

            if (!formData.name || !formData.shortTag) {
                setStatusMessage({
                    text: "Name and short tag are required",
                    type: "error",
                });
                return;
            }

            const trimmedName = formData.name.trim();
            const trimmedShortTag = formData.shortTag.trim();

            const majorsToAdd: MajorCreatePayload[] = [];

            // 2. Add year-specific majors
            for (let i = 1; i <= formData.numberOfYears; i++) {
                majorsToAdd.push({
                    name: `${trimmedName} Year ${i}`, // e.g., "Computer Science Year 1"
                    shortTag: `${trimmedShortTag}${i}`, // e.g., "CS1"
                    year: i,
                    scheduleId: Number(scheduleId),
                });
            }

            const response = await fetch("/api/majors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ majors: majorsToAdd }), // API should handle creating multiple
            });

            const responseText = await response.text();
            if (!response.ok) {
                console.error(
                    "Server response on add:",
                    response.status,
                    responseText
                );
                throw new Error(
                    `Failed to create majors: ${response.status} ${response.statusText} - ${responseText}`
                );
            }

            await fetchMajors();
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

    async function handleEditMajor(
        selectedMajor: Major | null,
        formData: MajorFormData,
        setStatusMessage: (
            msg: { text: string; type: "success" | "error" } | null
        ) => void,
        fetchMajors: () => Promise<void>,
        setIsEditDialogOpen: (isOpen: boolean) => void,
        resetForm: () => void
    ) {
        if (!selectedMajor || !selectedMajor.scheduleId) {
            setStatusMessage({
                text: "No major selected or schedule ID is missing for editing.",
                type: "error",
            });
            return;
        }

        try {
            const scheduleId = selectedMajor.scheduleId; // From the conceptual major

            if (!formData.name || !formData.shortTag) {
                setStatusMessage({
                    text: "Name and short tag are required",
                    type: "error",
                });
                return;
            }

            const newBaseName = formData.name.trim();
            const newBaseShortTag = formData.shortTag.trim();

            // Fetch existing *year-specific* DB entries for the *original base name* of the major.
            // `selectedMajor.name` holds the original base name (e.g., "Computer Science").
            // The API GET /api/majors?name=<BASE_NAME>&scheduleId=<ID> must be able to
            // return all actual database records like "Computer Science Year 1", "Computer Science Year 2", etc.
            const fetchResponse = await fetch(
                `/api/majors?name=${encodeURIComponent(
                    selectedMajor.name
                )}&scheduleId=${scheduleId}`,
                {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                }
            );

            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                throw new Error(
                    `Failed to fetch major details for editing: ${fetchResponse.status} ${errorText}`
                );
            }
            const existingDbEntries: Major[] = await fetchResponse.json(); // These are year-specific DB records

            // ---- THIS IS THE KEY DIFFERENCE: WE NO LONGER LOOK FOR A `year: null` RECORD ----
            // The old code had:
            // const oldBaseMajorInDb = existingDbEntries.find((m) => m.year === null);
            // if (!oldBaseMajorInDb) { /* ... throw error ... */ }
            // This is removed.

            const updates: MajorUpdate[] = [];
            const newYearSpecificMajorsToAdd: MajorCreatePayload[] = [];
            const yearsToDeleteIds: number[] = [];

            // Get a set of years that currently exist in the DB for this major
            const existingDbYears = new Set(
                existingDbEntries
                    .map((m) => m.year)
                    .filter((y) => y !== null) as number[] // Ensure we only consider actual years
            );

            // Iterate over the year-specific entries found in the database
            existingDbEntries.forEach((dbEntry) => {
                if (dbEntry.year === null) {
                    // This case should ideally not happen if your API is correctly
                    // returning only year-specific entries for the given base name.
                    // If it does, you might want to log it or handle it.
                    console.warn(
                        "Encountered a null-year entry during edit processing:",
                        dbEntry
                    );
                    return;
                }

                if (
                    dbEntry.year !== null &&
                    dbEntry.year !== undefined &&
                    dbEntry.year > formData.numberOfYears
                ) {
                    // This year is no longer needed (e.g., major changed from 4 years to 3 years)
                    yearsToDeleteIds.push(dbEntry.id);
                } else {
                    // This year still exists, update its name/shortTag
                    updates.push({
                        id: dbEntry.id,
                        name: `${newBaseName} Year ${dbEntry.year}`,
                        shortTag: `${newBaseShortTag}${dbEntry.year}`,
                        year: dbEntry.year ?? null, // Keep the year as is
                    });
                }
            });

            // Add new year-specific entries if numberOfYears increased
            for (let i = 1; i <= formData.numberOfYears; i++) {
                if (!existingDbYears.has(i)) {
                    newYearSpecificMajorsToAdd.push({
                        name: `${newBaseName} Year ${i}`,
                        shortTag: `${newBaseShortTag}${i}`,
                        year: i,
                        scheduleId: Number(scheduleId), // Ensure scheduleId is correctly passed
                    });
                }
            }

            // --- Database Operations ---
            if (updates.length > 0) {
                const updateResponse = await fetch("/api/majors", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    // API needs to handle an array of update objects, each with id, name, shortTag, year
                    body: JSON.stringify({ updates }),
                });
                const updateResponseText = await updateResponse.text();
                if (!updateResponse.ok) {
                    throw new Error(
                        `Failed to update majors: ${updateResponse.status} ${updateResponseText}`
                    );
                }
            }

            if (newYearSpecificMajorsToAdd.length > 0) {
                const addResponse = await fetch("/api/majors", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        majors: newYearSpecificMajorsToAdd,
                    }), // API creates multiple year-specific
                });
                const addResponseText = await addResponse.text();
                if (!addResponse.ok) {
                    throw new Error(
                        `Failed to add new year majors: ${addResponse.status} ${addResponseText}`
                    );
                }
            }

            if (yearsToDeleteIds.length > 0) {
                const deleteResponse = await fetch("/api/majors", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids: yearsToDeleteIds }), // API deletes by array of IDs
                });
                const deleteResponseText = await deleteResponse.text();
                if (!deleteResponse.ok) {
                    throw new Error(
                        `Failed to delete excess year majors: ${deleteResponse.status} ${deleteResponseText}`
                    );
                }
            }

            await fetchMajors(); // Refresh the list
            setIsEditDialogOpen(false); // Close the dialog
            resetForm(); // Reset form data
            setStatusMessage({
                text: "Major updated successfully",
                type: "success",
            });
        } catch (error: unknown) {
            console.error("Error updating major:", error);
            setStatusMessage({
                text: `Failed to update major: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                type: "error",
            });
        }
    }

    async function handleDeleteMajor(
        selectedMajor: Major | null,
        setSelectedMajor: React.Dispatch<React.SetStateAction<Major | null>>,
        setIsDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>,
        fetchMajors: () => Promise<void>,
        setStatusMessage: React.Dispatch<
            React.SetStateAction<{
                text: string;
                type: "success" | "error";
            } | null>
        >
    ) {
        if (!selectedMajor) {
            setStatusMessage({
                text: "No major selected for deletion.",
                type: "error",
            });
            return;
        }

        // Ensure scheduleId is present on the selectedMajor object.
        // This scheduleId is crucial for fetching the correct set of year-specific entries.
        const scheduleId = selectedMajor.scheduleId;
        if (!scheduleId) {
            setStatusMessage({
                text: "Schedule ID is missing from the selected major. Cannot proceed with deletion.",
                type: "error",
            });
            console.error(
                "Schedule ID missing on selectedMajor for deletion:",
                selectedMajor
            );
            return;
        }

        try {
            // Fetch ALL year-specific DB entries associated with this conceptual major's base name.
            // The API GET /api/majors?name=<BASE_NAME>&scheduleId=<ID> must
            // return all database records like "Computer Science Year 1", "Computer Science Year 2", etc.
            // based on the selectedMajor.name (which is the base name, e.g., "Computer Science").
            const response = await fetch(
                `/api/majors?name=${encodeURIComponent(
                    selectedMajor.name
                )}&scheduleId=${scheduleId}`,
                {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Failed to fetch major details for deletion: ${response.status} ${errorText}`
                );
            }

            const majorsToDeleteInDb: Major[] = await response.json(); // These are the actual year-specific DB records

            if (!majorsToDeleteInDb || majorsToDeleteInDb.length === 0) {
                // This means no year-specific entries were found in the DB for this base name.
                // It could be they were already deleted, or there's an issue with the base name matching.
                setStatusMessage({
                    text: `No year-specific entries found in the database for "${selectedMajor.name}". They may have already been deleted.`,
                    type: "success", // Changed from "info" to match the allowed types
                });
                await fetchMajors(); // Refresh the list in the UI
                setIsDeleteDialogOpen(false);
                setSelectedMajor(null);
                return;
            }

            // Collect the IDs of all the year-specific database records to be deleted.
            const majorIdsToDelete = majorsToDeleteInDb.map((m) => m.id);

            const deleteResponse = await fetch("/api/majors", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: majorIdsToDelete }), // API must handle an array of IDs
            });

            const deleteResponseText = await deleteResponse.text();
            if (!deleteResponse.ok) {
                throw new Error(
                    `Failed to delete major entries: ${deleteResponse.status} ${deleteResponseText}`
                );
            }

            await fetchMajors(); // Refresh the list of majors in the UI
            setIsDeleteDialogOpen(false);
            setSelectedMajor(null); // Clear the selected major
            setStatusMessage({
                text: `Major "${selectedMajor.name}" and all its year entries deleted successfully.`,
                type: "success",
            });
        } catch (error: unknown) {
            console.error("Error deleting major:", error);
            setStatusMessage({
                text: `Failed to delete major: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                type: "error",
            });
        }
    }

    const resetForm = () => {
        setFormData({
            name: "",
            shortTag: "",
            numberOfYears: 4,
        });
        setSelectedMajor(null);
    };

    const openEditDialog = (major: Major) => {
        // major is the conceptual major
        resetForm();
        setSelectedMajor(major);
        // major.name is base name, major.shortTag is base short tag
        setFormData({
            name: major.name,
            shortTag: major.shortTag,
            numberOfYears: major.numberOfYears || 4, // Ensure numberOfYears is present
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (major: Major) => {
        setSelectedMajor(major);
        setIsDeleteDialogOpen(true);
    };

    const getYearShortTags = (major: Major) => {
        // major is the conceptual major
        if (!major || !major.shortTag) return "";
        const baseTag = major.shortTag; // This is already the base tag, e.g., "CS"

        const yearTags = [];
        // Use major.years if available (actual years present), otherwise generate from numberOfYears
        const yearsToDisplay =
            major.years && major.years.length > 0
                ? major.years
                : Array.from(
                      { length: major.numberOfYears || 0 }, // Default to 0 if undefined
                      (_, i) => i + 1
                  );

        for (const year of yearsToDisplay) {
            yearTags.push(`${baseTag}${year}`);
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
                            <Label htmlFor="shortTag">Short Tag (Base)</Label>
                            <Input
                                id="shortTag"
                                name="shortTag"
                                value={formData.shortTag}
                                onChange={handleInputChange}
                                placeholder="CS"
                            />
                            <span className="text-sm text-gray-500">
                                Enter only the major code (e.g., CS for Computer
                                Science). Year numbers will be appended
                                automatically.
                            </span>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="numberOfYears">
                                Number of Years
                            </Label>
                            <Select
                                onValueChange={handleYearsChange}
                                defaultValue={formData.numberOfYears.toString()}
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
                                <p>
                                    Base Name:{" "}
                                    <span className="font-semibold">
                                        {formData.name || "[Not set]"}
                                    </span>
                                </p>
                                <p>
                                    Base Short Tag:{" "}
                                    <span className="font-semibold">
                                        {formData.shortTag || "[Not set]"}
                                    </span>
                                </p>
                                <p className="font-medium mt-1">
                                    Generated Year Entries:
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {formData.name &&
                                    formData.shortTag &&
                                    formData.numberOfYears > 0 ? (
                                        Array.from(
                                            { length: formData.numberOfYears },
                                            (_, i) => i + 1
                                        ).map((year) => (
                                            <span
                                                key={year}
                                                className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                                            >
                                                {`${formData.name} Year ${year}`}{" "}
                                                ({`${formData.shortTag}${year}`}
                                                )
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-500">
                                            Enter name, short tag, and select
                                            years.
                                        </span>
                                    )}
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
                            <Label htmlFor="edit-shortTag">
                                Short Tag (Base)
                            </Label>
                            <Input
                                id="edit-shortTag"
                                name="shortTag"
                                value={formData.shortTag}
                                onChange={handleInputChange}
                            />
                            <span className="text-sm text-gray-500">
                                Enter only the major code (e.g., CS for Computer
                                Science). Year numbers will be appended
                                automatically.
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
                            <p className="font-medium">Preview of Changes:</p>
                            <div className="mt-1">
                                <p>
                                    New Base Name:{" "}
                                    <span className="font-semibold">
                                        {formData.name || "[Not set]"}
                                    </span>
                                </p>
                                <p>
                                    New Base Short Tag:{" "}
                                    <span className="font-semibold">
                                        {formData.shortTag || "[Not set]"}
                                    </span>
                                </p>
                                <p className="font-medium mt-1">
                                    Generated Year Entries (
                                    {formData.numberOfYears} years):
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {formData.name &&
                                    formData.shortTag &&
                                    formData.numberOfYears > 0 ? (
                                        Array.from(
                                            { length: formData.numberOfYears },
                                            (_, i) => i + 1
                                        ).map((year) => (
                                            <span
                                                key={year}
                                                className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                                            >
                                                {`${formData.name} Year ${year}`}
                                                ({`${formData.shortTag}${year}`}
                                                )
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-500">
                                            Enter name, short tag, and select
                                            years.
                                        </span>
                                    )}
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
                        <Button
                            onClick={() =>
                                handleEditMajor(
                                    selectedMajor,
                                    formData,
                                    setStatusMessage,
                                    fetchMajors,
                                    setIsEditDialogOpen,
                                    resetForm
                                )
                            }
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        <p>
                            Are you sure you want to delete this major and all
                            its associated year entries?
                        </p>
                        <p className="font-medium mt-2">
                            {selectedMajor?.name}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            This will delete the base major and all{" "}
                            {selectedMajor?.numberOfYears || 0} year-specific
                            entries.
                        </p>
                        <div className="mt-2">
                            <p className="text-sm">
                                Short tags that will be deleted (example):
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
                            onClick={() =>
                                handleDeleteMajor(
                                    selectedMajor,
                                    setSelectedMajor,
                                    setIsDeleteDialogOpen,
                                    fetchMajors,
                                    setStatusMessage
                                )
                            }
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
