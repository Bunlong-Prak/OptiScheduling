"use server";

import { db } from "@/drizzle/db";
import { sessions, users } from "@/drizzle/schema";

import {
    createSession,
    deleteSession,
    getSession,
    updateSession,
} from "@/repositories/session";
import { createUser, getUserByEmail } from "@/repositories/users";
import moment from "moment";
import { nanoid } from "nanoid";
import { AuthUser } from "..";
import { createScopedLogger } from "../../utils/logger";
import { deleteSessionCookie, setSessionCookie } from "./cookie";

const logger = createScopedLogger("src:auth:session");

const SESSION_EXPIRES_IN = 7; // days
const SESSION_REFRESH_THRESHOLD = 1; // days

export const validateSession = async (
    sessionId: string
): Promise<{
    user: AuthUser;
    session: typeof sessions.$inferSelect;
} | null> => {
    try {
        const session = await getSession(db, sessionId);
        if (!session) {
            logger.debug("Session not found");
            return null;
        }

        const expiresAt = moment(session.expiresAt);
        const now = moment();

        // If the session is expired, invalidate it and return null
        if (expiresAt.isBefore(now)) {
            logger.debug("Session expired");
            await invalidateSession(session.id);
            return null;
        }

        // If the session is about to expire (e.g., less than 1 day left), refresh it
        const refreshThreshold = moment().add(SESSION_REFRESH_THRESHOLD, "day");
        if (expiresAt.isBefore(refreshThreshold)) {
            logger.debug("Session is about to expire, refreshing it");

            // Update the existing session with a new expiration date
            const newExpiresAt = moment()
                .add(SESSION_EXPIRES_IN, "days")
                .toDate();

            // Update session in database
            await updateSession(db, {
                sessionId: session.id,
                expiresAt: newExpiresAt,
            });

            await setSessionCookie(sessionId, newExpiresAt);

            // Don't need to query the database again, just update the session object since we only updated the expiration date
            const { user, ...updatedSession } = session;
            return {
                user: {
                    ...user,
                    sessionId: session.id,
                },
                session: {
                    ...updatedSession,
                    expiresAt: newExpiresAt,
                },
            };
        }

        const { user, ..._session } = session;
        return {
            user: {
                ...user,
                sessionId: session.id,
            },
            session: _session,
        };
    } catch (error) {
        logger.error("Error validating session", error);
        throw new Error("Error validating session");
    }
};

export async function createSessionAndCookie(
    data: Omit<typeof users.$inferSelect, "id">
): Promise<string> {
    let user = await getUserByEmail(data.email);
    if (!user) {
        user = await createUser(data);
    }

    if (!user) {
        throw new Error("Error creating user");
    }

    const sessionId = nanoid(40) satisfies string;
    const expiresIn = moment.duration(SESSION_EXPIRES_IN, "day");
    const expiresAt = moment().add(expiresIn).toDate() satisfies Date;

    try {
        await createSession(db, {
            userId: user.id,
            sessionId,
            expiresAt,
        });
    } catch (error) {
        logger.error("Error creating session", error);
        throw new Error("Error creating session");
    }

    try {
        await setSessionCookie(sessionId, expiresAt);
    } catch (error) {
        logger.error("Error setting session cookie", error);
        throw new Error("Error setting session cookie");
    }

    return sessionId;
}

export async function invalidateSession(sessionId: string) {
    try {
        await deleteSession(db, sessionId);
        await deleteSessionCookie();
    } catch (error) {
        logger.error("Error deleting session", error);
        throw new Error("Error deleting session");
    }
}
