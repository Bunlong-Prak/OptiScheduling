import { google } from "@/auth/oauth/google";
import { IS_PRODUCTION } from "@/utils";
import * as arctic from "arctic";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const state = arctic.generateState();
    const codeVerifier = arctic.generateCodeVerifier();
    const scopes = ["openid", "profile", "email"];
    const url = google.createAuthorizationURL(state, codeVerifier, scopes);

    const cookieStore = await cookies();
    cookieStore.set("google_oauth_state", state, {
        path: "/",
        httpOnly: true,
        secure: IS_PRODUCTION,
        maxAge: 60 * 10, // 10 minutes
        sameSite: "lax",
    });
    cookieStore.set("google_code_verifier", codeVerifier, {
        path: "/",
        httpOnly: true,
        secure: IS_PRODUCTION,
        maxAge: 60 * 10, // 10 minutes
        sameSite: "lax",
    });

    return NextResponse.redirect(url);
}
