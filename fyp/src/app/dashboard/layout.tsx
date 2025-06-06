import { getAuthUser } from "@/auth/server/action";
import Link from "next/link";
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
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Corrected: Added the opening Link tag */}
            <Link
              href="/dashboard"
              className="flex items-center space-x-3"
            >
              <div className="w-10 h-10 bg-[#3F3F8F] rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">O</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  OptiScheduling System
                </h1>
                <span className="text-xs text-gray-500">Automated Schedule</span>
              </div>
            </Link> {/* Corrected: Closing Link tag was already there, but now matches */}
            <nav className="flex items-center space-x-6">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-700 hover:text-[#3F3F8F] transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/logout"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Logout
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="px-5 lg:px-5 py-5 max-w-11xl mx-auto">{children}</main>
    </div>
  );
}