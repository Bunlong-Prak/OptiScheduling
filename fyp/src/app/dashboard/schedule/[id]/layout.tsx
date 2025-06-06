"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Schedule } from "@/app/types";

export default function ScheduleLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const pathname = usePathname();
    const scheduleId = params.id as string;

    // State to hold the actual schedule data
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch the actual schedule data
    useEffect(() => {
        
        const fetchSchedule = async () => {
            if (!scheduleId) return;

            try {
                // Fetch all schedules first, then find the one we need
                const response = await fetch(
                    `/api/schedules?=scheduleId=${scheduleId}`
                );
                if (!response.ok) {
                    throw new Error("Failed to fetch schedules");
                }
                const currentSchedule = await response.json();

                if (currentSchedule) {
                    // Parse the academic_year string if it contains both start and end dates
                    const [startDateStr, endDateStr] =
                        currentSchedule.academic_year.split(" - ");

                    setSchedule({
                        id: currentSchedule.id.toString(),
                        name: currentSchedule.name,
                        academic_year: currentSchedule.academic_year,
                        startDate: startDateStr,
                        endDate: endDateStr || startDateStr, // Use endDateStr if available
                    });
                } else {
                    throw new Error("Schedule not found");
                }
            } catch (error) {
                console.error("Error fetching schedule:", error);
                // Fallback to basic data if fetch fails
                setSchedule({
                    id: scheduleId,
                    name: "Schedule",
                    academic_year: "",
                    startDate: "",
                    endDate: "",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchSchedule();
    }, [scheduleId]);

    const navigationItems = [
        { name: "Timetable", href: "timetable" },
        { name: "Instructors", href: "instructors" },
        { name: "Classroom Type", href: "classroom-type" },
        { name: "Classroom", href: "classroom" },
        { name: "Major", href: "major" },
        { name: "Courses", href: "courses" },
        { name: "Time Constraints", href: "time-constraints" },
    ];

    // Show loading state while fetching data
    if (isLoading) {
        return (
            <div className="space-y-6">
                {/* Loading Header */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <div className="w-full flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">Loading...</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Loading schedule details...
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* Loading Navigation */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="border-b border-gray-200">
                        <nav className="flex">
                            {navigationItems.map((item) => (
                                <div
                                    key={item.href}
                                    className="px-6 py-4 text-sm font-medium text-gray-400 border-b-2 border-transparent"
                                >
                                    {item.name}
                                </div>
                            ))}
                        </nav>
                    </div>
                    <div className="p-6">
                        {children}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="w-full flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">
                            {schedule?.name || "Schedule"}
                        </h1>
                        <p className="text-sm text-gray-600 mt-1">
                            {schedule?.startDate}
                            {schedule?.endDate &&
                            schedule.endDate !== schedule.startDate
                                ? ` - ${schedule.endDate}`
                                : ""}
                        </p>
                    </div>
                    <div className="flex gap-2"></div>
                </div>
            </div>
            
            {/* Navigation and Content Container */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Navigation Tabs */}
                <div className="border-b border-gray-200 bg-gray-50">
                    <nav className="flex">
                        {navigationItems.map((item) => {
                            const href = `/dashboard/schedule/${scheduleId}/${item.href}`;
                            const isActive = pathname === href;
                            return (
                                <Link
                                    key={item.href}
                                    href={href}
                                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors relative ${
                                        isActive
                                            ? "border-[#2F2F85] text-[#2F2F85] bg-white"
                                            : "border-transparent text-gray-600 hover:text-[#2F2F85] hover:border-gray-300 hover:bg-white"
                                    }`}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                
                {/* Content Area */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}