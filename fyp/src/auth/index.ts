import { users } from "@/drizzle/schema";
import { IS_PRODUCTION } from "@/utils";

export const SALT_ROUNDS = 10;
export const SESSION_COOKIE_NAME = "OptiScheduling";

export function isLocalhost(): boolean {
    const domain = process.env.DOMAIN || "";
    return domain.includes("localhost") || domain.includes("127.0.0.1") || !IS_PRODUCTION;
}

// Convert session name to __Secure-prefix-type if in production and not localhost
export function getSessionCookieName(): string {
    return IS_PRODUCTION && !isLocalhost()
        ? `__Secure-${SESSION_COOKIE_NAME}`
        : `${SESSION_COOKIE_NAME}`;
}

export type AuthUser = Pick<
    typeof users.$inferSelect,
    "email" | "id" | "firstName" | "lastName" | "avatarUrl"
> & {
    sessionId: string;
};

export type AuthUserResult = AuthUser | null;
