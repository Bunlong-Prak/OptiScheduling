import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Pencil, Trash } from "lucide-react";
import Link from "next/link";

// Mock data for schedules
const schedules = [
    {
        id: "1",
        name: "Schedules 1 2023-2024",
        createdOn: "05/03/2023",
        courses: 24,
        instructors: 15,
    },
    {
        id: "2",
        name: "Schedules 1 2024-2025",
        createdOn: "05/03/2024",
        courses: 24,
        instructors: 16,
    },
];

export default function Dashboard() {
    return (
        <div className="w-full ">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Schedules</h1>
                <Button className="bg-green-600 hover:bg-green-700">
                    <span className="mr-1">+</span> New Schedules
                </Button>
            </div>

            <div className="space-y-4">
                {schedules.map((schedule) => (
                    <Card
                        key={schedule.id}
                        className="border rounded-lg overflow-hidden"
                    >
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold">
                                        {schedule.name}
                                    </h2>
                                    <p className="text-gray-500 text-sm">
                                        Created On {schedule.createdOn}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Link
                                        href={`/dashboard/schedule/${schedule.id}`}
                                    >
                                        <Button variant="ghost" size="icon">
                                            <Pencil className="h-5 w-5" />
                                        </Button>
                                    </Link>
                                    <Button variant="ghost" size="icon">
                                        <Trash className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex justify-between mt-4">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" />
                                    <span>{schedule.courses} Courses</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="lucide lucide-users"
                                    >
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                    <span>
                                        {schedule.instructors} Instructors
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
