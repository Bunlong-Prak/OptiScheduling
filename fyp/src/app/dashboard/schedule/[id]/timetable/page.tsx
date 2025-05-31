"use client";
import TimetableViewClassroom from "@/app/dashboard/schedule/[id]/timetable/timetable-classroom-view";

export default function TimetablePage() {
    return (
        <div>
            {/* Top controls */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Timetable</h2>
            </div>
            <TimetableViewClassroom />
        </div>
    );
}
