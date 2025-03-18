"use server";

import { cache } from "react";

import { users } from "@/drizzle/schema";
import { createScopedLogger } from "@/utils/logger";
import { AuthUserResult } from "..";
import { getSessionIdFromCookie } from "./cookie";
import {
    createSessionAndCookie,
    invalidateSession,
    validateSession,
} from "./session";

const logger = createScopedLogger("src:auth:action");

export const getAuthUser = cache(async (): Promise<AuthUserResult> => {
    try {
        const sessionId = await getSessionIdFromCookie();
        if (!sessionId) {
            logger.debug("Session id from cookie not found");
            return null;
        }

        const result = await validateSession(sessionId);
        if (!result) {
            logger.debug("Session is invalid or expired");
            return null;
        }

        return result.user;
    } catch (error) {
        logger.error("Error getting auth user", error);
    }

    return null;
});

export async function login(
    data: Omit<typeof users.$inferSelect, "id">
): Promise<boolean> {
    try {
        const sessionId = await createSessionAndCookie(data);
        if (!sessionId) {
            logger.debug("Failed to create session");
            return false;
        }

        return true;
    } catch (error) {
        logger.error("Error logging in", error);
    }

    return false;
}

export async function logout(): Promise<void> {
    try {
        const sessionId = await getSessionIdFromCookie();
        if (!sessionId) {
            logger.debug("Session id from cookie not found");
            return;
        }

        await invalidateSession(sessionId);
    } catch (error) {
        logger.error("Error logging out", error);
    }
}
