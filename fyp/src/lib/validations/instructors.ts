import { z } from "zod";

// Single instructor validation schema
export const instructorSchema = z.object({
    first_name: z
        .string()
        .min(1, "First name is required")
        .max(50, "First name must be less than 50 characters")
        .trim(),

    last_name: z
        .string()
        .min(1, "Last name is required")
        .max(50, "Last name must be less than 50 characters")
        .trim(),

    gender: z.enum(["Male", "Female"], {
        errorMap: () => ({
            message: "Gender must be either 'Male' or 'Female'",
        }),
    }),

    email: z
        .string()
        .min(1, "Email is required")
        .email("Invalid email format")
        .toLowerCase()
        .trim(),

    phone_number: z
        .string()
        .min(1, "Phone number must be maximum 1 characters")
        .optional()
        .or(z.literal(""))
        .transform((val) => (val === "" ? undefined : val)),
});

// Array of instructors with unique email validation
export const instructorsArraySchema = z.array(instructorSchema).refine(
    (instructors) => {
        const emails = instructors.map((instructor) => instructor.email);
        const uniqueEmails = new Set(emails);
        return emails.length === uniqueEmails.size;
    },
    {
        message: "All instructor emails must be unique",
        path: ["email"],
    }
);

// For API requests - single instructor with optional ID
export const instructorApiSchema = instructorSchema.extend({
    id: z.number().optional(),
    scheduleId: z.number().positive("Schedule ID is required"),
});

// For CSV import validation with row tracking
export const csvInstructorSchema = instructorSchema.extend({
    rowIndex: z.number().optional(), // For tracking which CSV row had issues
});

// Validation function for CSV import with detailed error reporting
export function validateInstructorsWithUniqueEmails(instructors: unknown[]): {
    validInstructors: z.infer<typeof instructorSchema>[];
    errors: string[];
} {
    const validInstructors: z.infer<typeof instructorSchema>[] = [];
    const errors: string[] = [];
    const emailTracker = new Map<string, number>();

    instructors.forEach((instructor, index) => {
        try {
            // Validate individual instructor
            const validatedInstructor = instructorSchema.parse(instructor);

            // Check for duplicate email
            const email = validatedInstructor.email;
            if (emailTracker.has(email)) {
                errors.push(
                    `Row ${
                        index + 1
                    }: Email '${email}' is already used in row ${
                        emailTracker.get(email)! + 1
                    }`
                );
            } else {
                emailTracker.set(email, index);
                validInstructors.push(validatedInstructor);
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorMessages = error.errors.map(
                    (err) =>
                        `Row ${index + 1}: ${err.path.join(".")} - ${
                            err.message
                        }`
                );
                errors.push(...errorMessages);
            } else {
                errors.push(`Row ${index + 1}: Unknown validation error`);
            }
        }
    });

    return { validInstructors, errors };
}

// Validation function for checking email uniqueness against existing instructors
export function validateAgainstExistingEmails(
    newInstructors: z.infer<typeof instructorSchema>[],
    existingInstructors: { email: string; id?: number }[]
): {
    validInstructors: z.infer<typeof instructorSchema>[];
    errors: string[];
} {
    const validInstructors: z.infer<typeof instructorSchema>[] = [];
    const errors: string[] = [];

    const existingEmails = new Set(
        existingInstructors.map((instructor) => instructor.email.toLowerCase())
    );

    newInstructors.forEach((instructor, index) => {
        if (existingEmails.has(instructor.email.toLowerCase())) {
            errors.push(
                `Row ${index + 1}: Email '${
                    instructor.email
                }' already exists in the system`
            );
        } else {
            validInstructors.push(instructor);
        }
    });

    return { validInstructors, errors };
}

// Type exports
export type Instructor = z.infer<typeof instructorSchema>;
export type InstructorApi = z.infer<typeof instructorApiSchema>;
export type InstructorsArray = z.infer<typeof instructorsArraySchema>;

// Usage examples:

// 1. Validate a single instructor
// const result = instructorSchema.safeParse(instructorData);

// 2. Validate array with unique emails
// const result = instructorsArraySchema.safeParse(instructorsArray);

// 3. Validate CSV import data
// const { validInstructors, errors } = validateInstructorsWithUniqueEmails(csvData);

// 4. Check against existing data
// const { validInstructors, errors } = validateAgainstExistingEmails(newData, existingData);
