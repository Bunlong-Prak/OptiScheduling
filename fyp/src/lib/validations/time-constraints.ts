// File: lib/validations/time-constraints.ts
import { z } from "zod";

// Schema for creating a new time constraint
export const createInstructorConstraintSchema = z.object({
    instructorId: z.number({
        required_error: "Instructor ID is required",
        invalid_type_error: "Instructor ID must be a number",
    }),
    day: z.string({
        required_error: "Day is required",
    }),
    timeSlots: z
        .array(z.string(), {
            required_error: "Time slots are required",
        })
        .min(1, "At least one time slot must be selected"),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
        invalid_type_error: "Schedule ID must be a number",
    }),
});

// Schema for editing an existing time constraint
export const editInstructorConstraintSchema = z.object({
    instructorId: z.number({
        required_error: "Instructor ID is required",
        invalid_type_error: "Instructor ID must be a number",
    }),
    day: z.string({
        required_error: "Day is required",
    }),
    timeSlots: z
        .array(z.string(), {
            required_error: "Time slots are required",
        })
        .min(1, "At least one time slot must be selected"),
    scheduleId: z
        .number({
            required_error: "Schedule ID is required",
            invalid_type_error: "Schedule ID must be a number",
        })
        .optional(),
});

// Schema for deleting a time constraint
export const deleteInstructorConstraintSchema = z.object({
    instructorId: z.number({
        required_error: "Instructor ID is required",
        invalid_type_error: "Instructor ID must be a number",
    }),
    day: z
        .string({
            required_error: "Day is required",
        })
        .optional(),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
        invalid_type_error: "Schedule ID must be a number",
    }),
});

// Schema for the formatted time constraint data returned to the frontend
export const timeConstraintSchema = z.object({
    id: z.number(),
    instructor_id: z.number(),
    day_of_the_week: z.string(),
    time_period: z.array(z.string()),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
});

export type TimeConstraint = z.infer<typeof timeConstraintSchema>;
export type CreateInstructorConstraintInput = z.infer<
    typeof createInstructorConstraintSchema
>;
export type EditInstructorConstraintInput = z.infer<
    typeof editInstructorConstraintSchema
>;
export type DeleteInstructorConstraintInput = z.infer<
    typeof deleteInstructorConstraintSchema
>;
