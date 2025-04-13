import { getAuthUser } from "@/auth/server/action";
import { Link } from "lucide-react";
import { redirect } from "next/navigation";
import type React from "react";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const authUser = await getAuthUser();
    console.log(authUser);
    if (!authUser) {
        return redirect("/?message=You must be logged in to access this page");
    }

    return (
        <div className="w-full min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <a
                            href="/dashboard"
                            className="flex items-center space-x-2"
                        >
                            <h1 className="text-xl font-bold">
                                OptiScheduling System
                            </h1>
                        </a>
                        <nav className="flex space-x-4">
                            <a
                                href="/dashboard"
                                className="text-gray-600 hover:text-gray-900"
                            >
                                Dashboard
                            </a>
                            <Link
                                href="/"
                                className="text-red-600 hover:text-red-900"
                            >
                                Logout
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>
            <main className="px-4 sm:px-6 lg:px-4 py-6 w-full">{children}</main>
        </div>
    );
}
