import { instructors } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Define the schema for instructor data validation
const instructorSchema = z.object({
    id: z.number({
        required_error: "ID is required",
    }),
    firstName: z
        .string({
            required_error: "First name is required",
        })
        .min(1, "First name cannot be empty"),
    lastName: z
        .string({
            required_error: "Last name is required",
        })
        .min(1, "Last name cannot be empty"),
    gender: z
        .string({
            required_error: "Gender is required",
        })
        .min(1, "Gender cannot be empty"),
    email: z
        .string({
            required_error: "Email is required",
        })
        .email("Invalid email format"),
    phoneNumber: z.string().optional(),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate request body against schema
        const validatedData = instructorSchema.parse(body);

        const { id, firstName, lastName, gender, email, phoneNumber } =
            validatedData;

        const updatedInstructor = await db
            .update(instructors)
            .set({
                firstName,
                lastName,
                gender,
                email,
                phoneNumber,
            })
            .where(eq(instructors.id, id));

        return new Response(JSON.stringify(updatedInstructor), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        console.error("Error in update:", error);

        // Handle Zod validation errors specifically
        if (error instanceof z.ZodError) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Validation error",
                    details: error.errors,
                }),
                {
                    status: 400, // Bad Request for validation errors
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    }
}
