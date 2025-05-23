"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
                const response = await fetch('/api/schedules');
                if (!response.ok) {
                    throw new Error("Failed to fetch schedules");
                }
                const allSchedules = await response.json();
                
                // Find the schedule with matching ID
                const currentSchedule = allSchedules.find(
                    (s: any) => s.id.toString() === scheduleId
                );
                
                if (currentSchedule) {
                    // Parse the academic_year string if it contains both start and end dates
                    const [startDateStr, endDateStr] = currentSchedule.academic_year.split(" - ");
                    
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
        { name: "Courses", href: "courses" },
        { name: "Instructors", href: "instructors" },
        { name: "Classroom", href: "classroom" },
        { name: "Major", href: "major" },
        { name: "Time Constraints", href: "time-constraints" },
        { name: "Classroom Type", href: "classroom-type" },
    ];

    // Show loading state while fetching data
    if (isLoading) {
        return (
            <div>
                <div className="w-full flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Loading...</h1>
                        <p className="text-gray-500">Loading schedule details...</p>
                    </div>
                </div>
                <div className="border-b mb-4">
                    <nav className="flex space-x-4">
                        {navigationItems.map((item) => (
                            <div
                                key={item.href}
                                className="px-3 py-2 text-sm font-medium border-b-2 border-transparent text-gray-400"
                            >
                                {item.name}
                            </div>
                        ))}
                    </nav>
                </div>
                {children}
            </div>
        );
    }

    return (
        <div>
            <div className="w-full flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{schedule?.name || "Schedule"}</h1>
                    <p className="text-gray-500">
                        {schedule?.startDate}
                        {schedule?.endDate && schedule.endDate !== schedule.startDate 
                            ? ` - ${schedule.endDate}` 
                            : ""
                        }
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