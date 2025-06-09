import { z } from "zod";

export const createClassroomTypeSchema = z.object({
    // ID: Optional for creation (auto-incremented by DB)
    id: z.number().int().positive().optional(),
    // Name: Required, string, max 100 chars
    name: z
        .string()
        .min(1, { message: "Classroom type name is required" })
        .max(100, {
            message: "Classroom type name cannot exceed 100 characters",
        }),
    description: z.string().optional().nullable(), // Changed to match edit schema
    scheduleId: z.number({
        required_error: "Schedule ID is required",
    }),
});

export const editClassroomTypeSchema = z.object({
    // ID: Required for updates
    id: z.number({
        required_error: "ID is required",
    }),
    // Name: Required, string, max 100 chars
    name: z
        .string()
        .min(1, { message: "Classroom type name is required" })
        .max(100, {
            message: "Classroom type name cannot exceed 100 characters",
        }),
    description: z.string().optional().nullable(), // Made consistent
});

export const deleteClassroomTypeSchema = z.object({
    // ID: Required for deletion
    id: z.number({
        required_error: "ID is required",
    }),
});
