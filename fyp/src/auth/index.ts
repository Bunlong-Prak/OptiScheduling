import { users } from "@/drizzle/schema";
import { IS_PRODUCTION } from "@/utils";

export const SALT_ROUNDS = 10;
export const SESSION_COOKIE_NAME = "OptiScheduling";
// Convert session name to __Secure-prefix-type if in production
export function getSessionCookieName(): string {
    return IS_PRODUCTION
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
