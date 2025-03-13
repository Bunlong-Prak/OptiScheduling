"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock data for timetable
const timeSlots = [
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
  "9:00 PM",
  "10:00 PM",
]
const days = ["MON", "TUES", "WED", "THU", "FRI", "SAT", "SUN"]

// Mock courses for drag and drop
const availableCourses = [
  {
    id: "cs125",
    code: "CS125",
    name: "Introduction to Programming",
    instructor: "Flordeliza P. PONCIO",
    classroom: "111",
    major: "CS",
    section: 1,
  },
  {
    id: "math131",
    code: "MATH131",
    name: "CALCULUS 1",
    instructor: "Abdulkasim Akhmedov",
    classroom: "404",
    major: "CE",
    section: 2,
  },
  {
    id: "cs401",
    code: "CS401",
    name: "Final Year Project 1",
    instructor: "Nora Patron",
    classroom: "304",
    major: "IE",
    section: 3,
  },
]

// Mock schedule data
const initialSchedule = {
  "MON-8:00 AM": {
    id: "cs125",
    code: "CS125",
    name: "Introduction to Programming",
    instructor: "Flordeliza P. PONCIO",
    classroom: "111",
    major: "CS",
    section: 1,
  },
  "WED-1:00 PM": {
    id: "math131",
    code: "MATH131",
    name: "CALCULUS 1",
    instructor: "Abdulkasim Akhmedov",
    classroom: "404",
    major: "CE",
    section: 2,
  },
  "FRI-11:00 AM": {
    id: "cs401",
    code: "CS401",
    name: "Final Year Project 1",
    instructor: "Nora Patron",
    classroom: "304",
    major: "IE",
    section: 3,
  },
}

export function TimetableView() {
  const [schedule, setSchedule] = useState(initialSchedule)
  const [draggedCourse, setDraggedCourse] = useState<any>(null)
  const [selectedCourse, setSelectedCourse] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleDragStart = (course: any) => {
    setDraggedCourse(course)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (day: string, timeSlot: string) => {
    if (draggedCourse) {
      const key = `${day}-${timeSlot}`

      // Check for conflicts
      const hasConflict = Object.entries(schedule).some(([slotKey, course]) => {
        const [slotDay, slotTime] = slotKey.split("-")
        return slotTime === timeSlot && slotDay !== day && (course as any).instructor === draggedCourse.instructor
      })

      if (hasConflict) {
        alert("Conflict detected: This instructor is already teaching at this time in another room.")
        return
      }

      setSchedule({
        ...schedule,
        [key]: draggedCourse,
      })
      setDraggedCourse(null)
    }
  }

  const handleCourseClick = (course: any) => {
    setSelectedCourse(course)
    setIsDialogOpen(true)
  }

  const removeCourse = (day: string, timeSlot: string) => {
    const key = `${day}-${timeSlot}`
    const newSchedule = { ...schedule }
    delete newSchedule[key]
    setSchedule(newSchedule)
    setIsDialogOpen(false)
  }

  return (
    <div>
      <Tabs defaultValue="week">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="week">Week View</TabsTrigger>
            <TabsTrigger value="day">Day View</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="week" className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-200 p-2 bg-gray-50 font-medium"></th>
                  {days.map((day) => (
                    <th key={day} className="border border-gray-200 p-2 bg-gray-50 font-medium">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((timeSlot) => (
                  <tr key={timeSlot}>
                    <td className="border border-gray-200 p-2 bg-gray-50 font-medium w-20">{timeSlot}</td>
                    {days.map((day) => {
                      const key = `${day}-${timeSlot}`
                      const course = schedule[key as keyof typeof schedule]

                      return (
                        <td
                          key={`${day}-${timeSlot}`}
                          className="border border-gray-200 p-1 h-24 align-top"
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(day, timeSlot)}
                        >
                          {course ? (
                            <div
                              className={`p-2 rounded text-sm h-full cursor-pointer ${
                                course.major === "CS"
                                  ? "bg-blue-100"
                                  : course.major === "CE"
                                    ? "bg-green-100"
                                    : "bg-yellow-100"
                              }`}
                              onClick={() => handleCourseClick(course)}
                            >
                              <div className="font-bold">{course.code}</div>
                              <div className="text-xs truncate">{course.name}</div>
                              <div className="text-xs mt-1">Room: {course.classroom}</div>
                              <div className="text-xs mt-1 truncate">{course.instructor}</div>
                            </div>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Available Courses</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableCourses.map((course) => (
                <Card key={course.id} draggable onDragStart={() => handleDragStart(course)} className="cursor-move">
                  <CardContent className="p-4">
                    <div className="font-bold">{course.code}</div>
                    <div className="text-sm">{course.name}</div>
                    <div className="text-xs mt-1">Room: {course.classroom}</div>
                    <div className="text-xs mt-1">{course.instructor}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="day">
          <div className="p-8 text-center text-gray-500">Day view is under development</div>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Course Details</DialogTitle>
          </DialogHeader>

          {selectedCourse && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg">
                  {selectedCourse.code}: {selectedCourse.name}
                </h3>
                <p className="text-sm">Section: {selectedCourse.section}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Instructor</p>
                  <p className="text-sm">{selectedCourse.instructor}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Classroom</p>
                  <p className="text-sm">{selectedCourse.classroom}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Major</p>
                  <p className="text-sm">{selectedCourse.major}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    // Find the key for this course
                    const key = Object.entries(schedule).find(
                      ([_, course]) => (course as any).id === selectedCourse.id,
                    )?.[0]

                    if (key) {
                      const [day, timeSlot] = key.split("-")
                      removeCourse(day, timeSlot)
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

