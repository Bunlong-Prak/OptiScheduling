import { z } from "zod";

const timeSlotSchema = z.object({
    startTime: z
        .string()
        .min(1, {
            message: "Start time is required",
        })
        .max(100, {
            message: "Start time cannot exceed 100 characters",
        }),

    endTime: z
        .string()
        .min(1, {
            message: "End time is required",
        })
        .max(100, {
            message: "End time cannot exceed 100 characters",
        }),
});

export const createScheduleSchema = z
    .object({
        id: z.number().int().positive().optional(),

        name: z
            .string()
            .min(1, { message: "Schedule name is required" })
            .max(100, {
                message: "Schedule name cannot exceed 100 characters",
            }),

        startDate: z.coerce.date({
            required_error: "Start date is required",
            invalid_type_error: "Start date must be a valid date",
        }),

        // End Date: Required and must be after start date
        endDate: z.coerce.date({
            required_error: "End date is required",
            invalid_type_error: "End date must be a valid date",
        }),

        numberOfTimeSlots: z.number().int().positive(),
        timeSlots: z
            .array(timeSlotSchema)
            .min(1, { message: "At least one time slot is required" }),
        // User ID: Optional, to associate schedule with a user
        userId: z.string().min(1).max(100),
    })
    .refine((data) => data.endDate > data.startDate, {
        message: "End date must be after start date",
        path: ["endDate"],
    });

// Schema for editing an existing schedule
export const editScheduleSchema = z
    .object({
        // ID: Required for updates
        id: z.number({
            required_error: "ID is required",
        }),

        // Name: Required, string
        name: z
            .string()
            .min(1, { message: "Schedule name is required" })
            .max(100, {
                message: "Schedule name cannot exceed 100 characters",
            }),

        // Start Date: Required
        startDate: z.coerce.date({
            required_error: "Start date is required",
            invalid_type_error: "Start date must be a valid date",
        }),

        // End Date: Required and must be after start date
        endDate: z.coerce.date({
            required_error: "End date is required",
            invalid_type_error: "End date must be a valid date",
        }),

        // User ID: Optional, to associate schedule with a user
        userId: z.string().min(1).max(100),
    })
    .refine((data) => data.endDate > data.startDate, {
        message: "End date must be after start date",
        path: ["endDate"],
    });

// Schema for deleting a schedule
export const deleteScheduleSchema = z.object({
    // ID: Required for deletion
    id: z.number({
        required_error: "ID is required",
    }),
});
