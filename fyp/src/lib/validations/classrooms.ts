import { z } from "zod";

// Define the classroom schema using Zod
export const createClassroomSchema = z.object({
    // Name: Required, string, max 255 chars
    code: z
        .string()
        .min(1, { message: "Classroom name is required" })
        .max(255, { message: "Classroom name cannot exceed 255 characters" }),

    // Type: Required, string, max 50 chars
    type: z
        .string()
        .min(1, { message: "Classroom type is required" })
        .max(50, { message: "Classroom type cannot exceed 50 characters" }),

    // Capacity: Required, positive integer
    capacity: z
        .number()
        .int({ message: "Capacity must be a whole number" })
        .positive({ message: "Capacity must be a positive number" }),
});

export const editClassroomSchema = z.object({
    // ID: Optional for creation (auto-incremented by DB), required for updates
    id: z.number({
        required_error: "ID is required",
    }),

    // Name: Required, string, max 255 chars
    code: z
        .string()
        .min(1, { message: "Classroom name is required" })
        .max(255, { message: "Classroom name cannot exceed 255 characters" }),

    // Type: Required, string, max 50 chars
    type: z
        .string()
        .min(1, { message: "Classroom type is required" })
        .max(50, { message: "Classroom type cannot exceed 50 characters" }),

    // Capacity: Required, positive integer
    capacity: z
        .number()
        .int({ message: "Capacity must be a whole number" })
        .positive({ message: "Capacity must be a positive number" }),
});

export const deleteClassroomSchema = z.object({
    // ID: Optional for creation (auto-incremented by DB), required for updates
    id: z.number({
        required_error: "ID is required",
    }),
});
