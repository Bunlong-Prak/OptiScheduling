import { db } from "@/drizzle/db";
import { users } from "@/drizzle/schema";

export const getUserByEmail = async (email: string) => {
    return await db.query.users.findFirst({
        where: (usersTable, { eq }) => eq(usersTable.email, email),
    });
};

export const createUser = async (
    data: Omit<typeof users.$inferSelect, "id">
) => {
    await db.insert(users).values(data);
    return await getUserByEmail(data.email);
};
