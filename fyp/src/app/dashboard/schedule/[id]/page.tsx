"use client"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileDown, Plus } from "lucide-react"
import { useParams } from "next/navigation"
import { ClassroomView } from "./classroom-view"
// import { TimetableView } from "./timetable-view"
import { CoursesView } from "./courses-view"
import { InstructorsView } from "./instructors-view"
// import { ClassroomView } from "./classroom-view"
import { MajorView } from "./major-view"
import { TimeConstraintView } from "./time-constraint-view"
import { TimetableView } from "./timetable-view"

export default function ScheduleDetail() {
  const params = useParams()
  const scheduleId = params.id as string

  // Mock data for schedule details
  const schedule = {
    id: scheduleId,
    name: `Schedules 1 2023-2024`,
    startDate: "Jan 5, 2025",
    endDate: "May 15, 2025",
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
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
          <Button variant="outline" className="bg-blue-500 text-white hover:bg-blue-600">
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
          <Button variant="outline" className="bg-gray-200 hover:bg-gray-300">
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="timetable">
        <TabsList className="border-b w-full justify-start rounded-none bg-transparent mb-4">
          <TabsTrigger
            value="timetable"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
          >
            Timetable
          </TabsTrigger>
          <TabsTrigger
            value="courses"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
          >
            Courses
          </TabsTrigger>
          <TabsTrigger
            value="instructors"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
          >
            Instructors
          </TabsTrigger>
          <TabsTrigger
            value="classroom"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
          >
            Classroom
          </TabsTrigger>
          <TabsTrigger
            value="major"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
          >
            Major
          </TabsTrigger>
          <TabsTrigger
            value="timeConstant"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
          >
            Time Constant
          </TabsTrigger>
        </TabsList>
   <TabsContent value="classroom">
           <ClassroomView />
         </TabsContent>
           <TabsContent value="instructors">
          <InstructorsView />
        </TabsContent>
           <TabsContent value="courses">
          <CoursesView />
        </TabsContent>
         <TabsContent value="major">
          <MajorView />
        </TabsContent>

        <TabsContent value="timeConstant">
          <TimeConstraintView />
        </TabsContent>
        <TabsContent value="timetable">
          <TimetableView />
        </TabsContent>
        {/* <TabsContent value="timetable">
          <TimetableView />
        </TabsContent>

        <TabsContent value="courses">
          <CoursesView />
        </TabsContent>

        <TabsContent value="instructors">
          <InstructorsView />
        </TabsContent>

      

        <TabsContent value="major">
          <MajorView />
        </TabsContent>

        <TabsContent value="timeConstant">
          <TimeConstraintView />
        </TabsContent> */}
      </Tabs>
    </div>
  )
}

