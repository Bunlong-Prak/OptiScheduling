import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const APP_NAME = "OptiScheduling";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
