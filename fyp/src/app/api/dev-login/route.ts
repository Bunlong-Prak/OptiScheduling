import { createSessionAndCookie } from "@/auth/server/session";
import { getSessionCookieName, isLocalhost } from "@/auth";
import { IS_PRODUCTION } from "@/utils";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    try {
        const sessionId = await createSessionAndCookie({
            email: "demo@paragoniu.edu.kh",
            firstName: "Demo",
            lastName: "Admin",
            avatarUrl: null,
        });

        const res = NextResponse.redirect(new URL("/dashboard", request.url));
        const isSecure = IS_PRODUCTION && !isLocalhost();
        res.cookies.set(getSessionCookieName(), sessionId, {
            httpOnly: true,
            sameSite: "lax",
            secure: isSecure,
            path: "/",
            maxAge: 7 * 24 * 60 * 60,
        });
        return res;
    } catch (error) {
        console.error("Failed demo login:", error);
        return NextResponse.redirect(new URL("/?error=demo_login_failed", request.url));
    }
}
