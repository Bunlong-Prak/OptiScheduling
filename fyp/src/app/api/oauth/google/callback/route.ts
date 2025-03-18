import { google } from "@/auth/oauth/google";
import { login } from "@/auth/server/action";
import { decodeIdToken, OAuth2Tokens } from "arctic";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

type GoogleUser = {
    iss: string;
    azp: string;
    aud: string;
    sub: string;
    at_hash: string;
    name: string;
    picture: string;
    given_name: string;
    family_name: string;
    iat: number;
    exp: number;
    email: string;
};

const fetchGoogleUser = async (accessToken: string): Promise<GoogleUser> => {
    const response = await fetch(
        "https://www.googleapis.com/oauth2/v1/userinfo",
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );
    if (!response.ok) {
        throw new Error("Failed to fetch user info");
    }
    return response.json() as Promise<GoogleUser>;
};

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const storedState = cookieStore.get("google_oauth_state")?.value ?? null;
    const codeVerifier = cookieStore.get("google_code_verifier")?.value ?? null;
    if (
        code === null ||
        state === null ||
        storedState === null ||
        codeVerifier === null
    ) {
        return new Response(null, {
            status: 400,
        });
    }
    if (state !== storedState) {
        return new Response(null, {
            status: 400,
        });
    }

    let tokens: OAuth2Tokens;
    try {
        tokens = await google.validateAuthorizationCode(code, codeVerifier);
    } catch (e) {
        // Invalid code or client credentials
        return new Response(null, {
            status: 400,
        });
    }

    const claims = decodeIdToken(tokens.idToken()) as any;
    const googleUserId = claims.sub as string;

    // const username = claims.name;
    const googleUser = await fetchGoogleUser(tokens.accessToken());

    if (!googleUser.email && !googleUserId) {
        return new Response(null, {
            status: 400,
        });
    }

    //TODO: store oauth provider info

    const loggedIn = await login({
        email: googleUser.email,
        avatarUrl: googleUser.picture,
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
    });

    if (!loggedIn) {
        return new Response(null, {
            status: 500,
        });
    }

    return Response.redirect(new URL("/dashboard", request.nextUrl));
}
