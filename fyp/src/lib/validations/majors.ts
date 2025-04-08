import { z } from "zod";

export const createMajorSchema = z.object({
    // ID: Optional for creation (auto-incremented by DB)
    id: z.number().int().positive().optional(),

    // Name: Required, string, max 100 chars
    name: z
        .string()
        .min(1, { message: "Major name is required" })
        .max(100, { message: "Major name cannot exceed 100 characters" }),

    // Short Tag: Required, string, max 10 chars
    shortTag: z
        .string()
        .min(1, { message: "Short tag is required" })
        .max(10, { message: "Short tag cannot exceed 10 characters" }),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
    }),
});

export const editMajorSchema = z.object({
    // ID: Required for updates
    id: z.number({
        required_error: "ID is required",
    }),

    // Name: Required, string, max 100 chars
    name: z
        .string()
        .min(1, { message: "Major name is required" })
        .max(100, { message: "Major name cannot exceed 100 characters" }),

    // Short Tag: Required, string, max 10 chars
    shortTag: z
        .string()
        .min(1, { message: "Short tag is required" })
        .max(10, { message: "Short tag cannot exceed 10 characters" }),
});

export const deleteMajorSchema = z.object({
    // ID: Required for deletion
    id: z.number({
        required_error: "ID is required",
    }),
});
