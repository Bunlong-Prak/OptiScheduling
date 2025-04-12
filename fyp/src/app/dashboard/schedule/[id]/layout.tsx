"use client";

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