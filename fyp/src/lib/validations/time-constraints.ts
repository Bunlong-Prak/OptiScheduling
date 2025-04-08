import { z } from "zod";

export const createInstructorConstraintSchema = z.object({
    // instructorId: Required, positive integer
    instructorId: z
        .number()
        .int({ message: "Instructor ID must be a whole number" })
        .positive({ message: "Instructor ID must be a positive number" }),

    // day: Required, string
    day: z
        .string()
        .min(1, { message: "Day is required" })
        .refine(
            (val) =>
                [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ].includes(val),
            { message: "Day must be a valid day of the week" }
        ),

    // timeSlots: Required, array of strings, non-empty
    timeSlots: z
        .array(z.string().min(1, { message: "Time slot cannot be empty" }))
        .min(1, { message: "At least one time slot is required" }),
    scheduleId: z.number({
        required_error: "Schedule ID is required",
    }),
});

export const editInstructorConstraintSchema = z.object({
    instructorId: z
        .number()
        .int({ message: "Instructor ID must be a whole number" })
        .positive({ message: "Instructor ID must be a positive number" }),

    // day: Required, string
    day: z
        .string()
        .min(1, { message: "Day is required" })
        .refine(
            (val) =>
                [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ].includes(val),
            { message: "Day must be a valid day of the week" }
        ),

    // timeSlots: Required, array of strings, non-empty
    timeSlots: z
        .array(z.string().min(1, { message: "Time slot cannot be empty" }))
        .min(1, { message: "At least one time slot is required" }),
});

export const deleteInstructorConstraintSchema = z.object({
    // constraintId: Required, positive integer
    instructorId: z
        .number()
        .int({ message: "Instructor ID must be a whole number" })
        .positive({ message: "Instructor ID must be a positive number" }),
});
