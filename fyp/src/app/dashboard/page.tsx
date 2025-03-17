"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, Pencil, Plus, Trash, Users } from "lucide-react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Mock data for schedules
const initialSchedules = [
  {
    id: "1",
    name: "Schedules 1 2023-2024",
    createdOn: "05/03/2023",
    courses: 24,
    instructors: 15,
    startDate: "Jan 5, 2024",
    endDate: "May 15, 2024",
  },
  {
    id: "2",
    name: "Schedules 1 2024-2025",
    createdOn: "05/03/2024",
    courses: 24,
    instructors: 16,
    startDate: "Jan 5, 2025",
    endDate: "May 15, 2025",
  },
]

export default function Dashboard() {
  const [schedules, setSchedules] = useState(initialSchedules)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleCreateSchedule = () => {
    // Create new schedule
    const newSchedule = {
      id: (Math.max(...schedules.map((s) => Number.parseInt(s.id))) + 1).toString(),
      name: formData.name,
      createdOn: new Date().toLocaleDateString(),
      courses: 0,
      instructors: 0,
      startDate: formData.startDate,
      endDate: formData.endDate,
    }

    setSchedules([...schedules, newSchedule])
    setIsCreateDialogOpen(false)
    resetForm()
  }

  const handleDeleteSchedule = () => {
    if (!selectedScheduleId) return

    setSchedules(schedules.filter((schedule) => schedule.id !== selectedScheduleId))
    setIsDeleteDialogOpen(false)
    setSelectedScheduleId(null)
  }

  const resetForm = () => {
    setFormData({
      name: "",
      startDate: "",
      endDate: "",
    })
  }

  const openDeleteDialog = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId)
    setIsDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schedules</h1>
        <Button className="" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Schedule
        </Button>
      </div>

      <div className="space-y-4">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="border rounded-md p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-medium">{schedule.name}</h2>
                <p className="text-sm text-gray-500">Created On {schedule.createdOn}</p>
                <p className="text-sm text-gray-500">
                  {schedule.startDate} - {schedule.endDate}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/dashboard/schedule/${schedule.id}`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeleteDialog(schedule.id)}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <BookOpen className="h-4 w-4" />
                <span>{schedule.courses} Courses</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Users className="h-4 w-4" />
                <span>{schedule.instructors} Instructors</span>
              </div>
            </div>
          </div>
        ))}

        {schedules.length === 0 && (
          <div className="text-center p-8 text-gray-500">No schedules found. Create a new schedule to get started.</div>
        )}
      </div>

      {/* Create Schedule Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Schedule</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Schedule Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Schedule 1 2025-2026"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  placeholder="e.g., Jan 5, 2025"
                  value={formData.startDate}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  placeholder="e.g., May 15, 2025"
                  value={formData.endDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSchedule}>Create Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Schedule Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this schedule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSchedule} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

