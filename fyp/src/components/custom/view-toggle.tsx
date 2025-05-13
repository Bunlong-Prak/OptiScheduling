"use client";

import { Button } from "@/components/ui/button";

export default function ViewToggleButton({ 
  currentView, 
  onViewChange 
}: { 
  currentView: 'classroom' | 'major',
  onViewChange: (view: 'classroom' | 'major') => void
}) {
  return (
    <div className="flex space-x-2">
      <Button 
        variant={currentView === 'classroom' ? "default" : "outline"}
        onClick={() => onViewChange('classroom')}
      >
        Classroom View
      </Button>
      <Button 
        variant={currentView === 'major' ? "default" : "outline"}
        onClick={() => onViewChange('major')}
      >
        Majors View
      </Button>
    </div>
  );
}