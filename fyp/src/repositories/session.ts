import { DB, getDB } from "@/drizzle/db";
import { sessions } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export const getSession = async (tx: DB, sessionId: string) => {
    const db = getDB(tx);

    return await db.query.sessions.findFirst({
        where: (sessionsTable, { eq }) => eq(sessionsTable.id, sessionId),
        with: {
            user: true,
        },
    });
};

export const createSession = async (
    tx: DB,
    {
        sessionId,
        userId,
        expiresAt,
    }: {
        sessionId: string;
        userId: string;
        expiresAt: Date;
    }
) => {
    const db = getDB(tx);

    return await db.insert(sessions).values({
        id: sessionId,
        userId,
        expiresAt,
    });
};

export const deleteSession = async (tx: DB, sessionId: string) => {
    const db = getDB(tx);

    return await db.delete(sessions).where(eq(sessions.id, sessionId));
};

export const updateSession = async (
    tx: DB,
    {
        sessionId,
        expiresAt,
    }: {
        sessionId: string;
        expiresAt: Date;
    }
) => {
    const db = getDB(tx);

    return await db
        .update(sessions)
        .set({ expiresAt })
        .where(eq(sessions.id, sessionId));
};
