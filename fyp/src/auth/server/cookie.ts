"use server";
import { IS_PRODUCTION } from "@/utils";
import { cookies } from "next/headers";
import { getSessionCookieName } from "..";

/*
 * httpOnly: Cookies are only accessible server-side
 * SameSite=Lax: Use Strict for critical websites
 * Secure: Cookies can only be sent over HTTPS (Should be omitted when testing on localhost)
 * Max-Age or Expires: Must be defined to persist cookies
 * Path=/: Cookies can be accessed from all routes
 */

// ExpireAt example: new Date(Date.now() + 1 * WEEK)
export async function setSessionCookie(
    token: string,
    expiresAt: Date
): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.set(getSessionCookieName(), token, {
        httpOnly: true,
        sameSite: "lax",
        secure: IS_PRODUCTION,
        expires: expiresAt,
        path: "/",
    });
}

export async function deleteSessionCookie(): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.set(getSessionCookieName(), "", {
        httpOnly: true,
        sameSite: "lax",
        secure: IS_PRODUCTION,
        maxAge: 0,
        path: "/",
    });
}

export async function getSessionIdFromCookie(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get(getSessionCookieName())?.value;
}
