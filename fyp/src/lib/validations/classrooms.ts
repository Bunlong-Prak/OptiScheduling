import { z } from "zod";

// Define the classroom schema using Zod
export const createClassroomSchema = z.object({
    // Code: Required, string, max 255 chars, must be unique
    code: z
        .string()
        .min(1, { message: "Classroom code is required" })
        .max(255, { message: "Classroom code cannot exceed 255 characters" })
        .regex(/^[A-Za-z0-9\-_\.]+$/, {
            message:
                "Classroom code can only contain letters, numbers, hyphens, underscores, and periods",
        }),
    // Type: Required, string, max 50 chars
    type: z
        .string()
        .min(1, { message: "Classroom type is required" })
        .max(50, { message: "Classroom type cannot exceed 50 characters" }),
    // Capacity: Required, positive integer
    capacity: z
        .number()
        .int({ message: "Capacity must be a whole number" })
        .positive({ message: "Capacity must be a positive number" })
        .max(9999, { message: "Capacity cannot exceed 9999" }),
    // Schedule ID: Required for associating with a schedule
    scheduleId: z.string().min(1, { message: "Schedule ID is required" }),
});

export const editClassroomSchema = z.object({
    // ID: Required for updates
    id: z.number({
        required_error: "ID is required",
    }),
    // Code: Required, string, max 255 chars, must be unique
    code: z
        .string()
        .min(1, { message: "Classroom code is required" })
        .max(255, { message: "Classroom code cannot exceed 255 characters" })
        .regex(/^[A-Za-z0-9\-_\.]+$/, {
            message:
                "Classroom code can only contain letters, numbers, hyphens, underscores, and periods",
        }),
    // Type: Required, string, max 50 chars
    type: z
        .string()
        .min(1, { message: "Classroom type is required" })
        .max(50, { message: "Classroom type cannot exceed 50 characters" }),
    // Capacity: Required, positive integer
    capacity: z
        .number()
        .int({ message: "Capacity must be a whole number" })
        .positive({ message: "Capacity must be a positive number" })
        .max(9999, { message: "Capacity cannot exceed 9999" }),
    // Schedule ID: Required for associating with a schedule
    scheduleId: z.string().min(1, { message: "Schedule ID is required" }),
});

export const deleteClassroomSchema = z.object({
    // ID: Required for deletion
    id: z.number({
        required_error: "ID is required",
    }),
    // Schedule ID: Required for associating with a schedule
    scheduleId: z.string().min(1, { message: "Schedule ID is required" }),
});

// Helper function to check for duplicate classroom codes
export const validateUniqueClassroomCode = (
    code: string,
    existingClassrooms: Array<{ id?: number; code: string }>,
    currentClassroomId?: number
): boolean => {
    return !existingClassrooms.some(
        (classroom) =>
            classroom.code.toLowerCase() === code.toLowerCase() &&
            classroom.id !== currentClassroomId
    );
};
