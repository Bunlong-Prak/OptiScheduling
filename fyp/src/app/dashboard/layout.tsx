import type React from "react";
import { Link } from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-xl font-bold">
                            OptiScheduling System
                        </h1>
                        <nav className="flex space-x-4">
                            <a
                                href="/dashboard"
                                className="text-gray-600 hover:text-gray-900"
                            >
                                Dashboard
                            </a>
                            <a
                                href="/dashboard/settings"
                                className="text-gray-600 hover:text-gray-900"
                            >
                                Settings
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
            <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">{children}</main>
        </div>
    );
}
