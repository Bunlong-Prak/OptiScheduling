"use client";

import { useState } from "react";
import TimetableViewClassroom from "@/app/dashboard/schedule/[id]/timetable/timetable-classroom-view";
import MajorView from "@/app/dashboard/schedule/[id]/timetable/timetable-major-view";
import ViewToggleButton from "@/components/custom/view-toggle";

export default function TimetablePage() {
  const [currentView, setCurrentView] = useState<'classroom' | 'major'>('classroom');

  return (
    <div>
      {/* Top controls */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Timetable</h2>
        <ViewToggleButton 
          currentView={currentView} 
          onViewChange={setCurrentView} 
        />
      </div>

      {currentView === 'classroom' ? <TimetableViewClassroom /> : <MajorView />}
    </div>
  );
}