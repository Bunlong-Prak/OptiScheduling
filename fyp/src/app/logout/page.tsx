"use client";
import { logout } from "@/auth/server/action";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Logout() {
    const router = useRouter();

    useEffect(() => {
        const logoutUser = async () => {
            await logout();
            router.push("/?message=You have been logged out successfully");
        };
        logoutUser();
    }, []);

    return (
        <div className="flex items-center justify-center h-screen text-gray-600">
            Logging out...
        </div>
    );
}
