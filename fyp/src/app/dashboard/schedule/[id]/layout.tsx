"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ScheduleLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const pathname = usePathname();
    const scheduleId = params.id as string;

    // Mock data for schedule details
    const schedule = {
        id: scheduleId,
        name: `Schedules 1 2023-2024`,
        startDate: "Jan 5, 2025",
        endDate: "May 15, 2025",
    };

    const navigationItems = [
        { name: "Timetable", href: "timetable" },
        { name: "Courses", href: "courses" },
        { name: "Instructors", href: "instructors" },
        { name: "Classroom", href: "classroom" },
        { name: "Major", href: "major" },
        { name: "Time Constraints", href: "time-constraints" },
        { name: "Classroom Type", href: "classroom-type" },
    ];

    return (
        <div>
            <div className="w-full flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{schedule.name}</h1>
                    <p className="text-gray-500">
                        {schedule.startDate} - {schedule.endDate}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Generate Schedule
                    </Button>
                    <Button
                        variant="outline"
                        className="bg-blue-500 text-white hover:bg-blue-600"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-2"
                        >
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="border-b mb-4">
                <nav className="flex space-x-4">
                    {navigationItems.map((item) => {
                        const href = `/dashboard/schedule/${scheduleId}/${item.href}`;
                        const isActive = pathname === href;
                        return (
                            <Link
                                key={item.href}
                                href={href}
                                className={`px-3 py-2 text-sm font-medium border-b-2 ${
                                    isActive
                                        ? "border-indigo-600 text-indigo-600"
                                        : "border-transparent hover:border-gray-300"
                                }`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {children}
        </div>
    );
} 