"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, Plus, Trash } from "lucide-react"
import type { Instructor, InstructorFormData } from "../../../types"

// Mock data for instructors
const initialInstructors: Instructor[] = [
  {
    id: 1,
    first_name: "Flordeliza P.",
    last_name: "PONCIO",
    gender: "Female",
    email: "flordeliza.poncio@paragon.edu.kh",
    phone_number: "012-345-678",
  },
  {
    id: 2,
    first_name: "Abdulkasim",
    last_name: "Akhmedov",
    gender: "Male",
    email: "abdulkasim.akhmedov@paragon.edu.kh",
    phone_number: "012-345-679",
  },
  {
    id: 3,
    first_name: "Nora",
    last_name: "Patron",
    gender: "Female",
    email: "nora.patron@paragon.edu.kh",
    phone_number: "012-345-680",
  },
]

export function InstructorsView() {
  const [instructors, setInstructors] = useState<Instructor[]>(initialInstructors)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)
  const [formData, setFormData] = useState<InstructorFormData>({
    first_name: "",
    last_name: "",
    gender: "",
    email: "",
    phone_number: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleAddInstructor = () => {
    const newInstructor: Instructor = {
      id: Math.max(0, ...instructors.map((i) => i.id)) + 1,
      first_name: formData.first_name,
      last_name: formData.last_name,
      gender: formData.gender,
      email: formData.email,
      phone_number: formData.phone_number,
    }

    setInstructors([...instructors, newInstructor])
    setIsAddDialogOpen(false)
    resetForm()
  }

  const handleEditInstructor = () => {
    if (!selectedInstructor) return

    const updatedInstructors = instructors.map((instructor) => {
      if (instructor.id === selectedInstructor.id) {
        return {
          ...instructor,
          first_name: formData.first_name,
          last_name: formData.last_name,
          gender: formData.gender,
          email: formData.email,
          phone_number: formData.phone_number,
        }
      }
      return instructor
    })

    setInstructors(updatedInstructors)
    setIsEditDialogOpen(false)
    resetForm()
  }

  const handleDeleteInstructor = () => {
    if (!selectedInstructor) return

    const updatedInstructors = instructors.filter((instructor) => instructor.id !== selectedInstructor.id)
    setInstructors(updatedInstructors)
    setIsDeleteDialogOpen(false)
  }

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      gender: "",
      email: "",
      phone_number: "",
    })
    setSelectedInstructor(null)
  }

  const openEditDialog = (instructor: Instructor) => {
    setSelectedInstructor(instructor)
    setFormData({
      first_name: instructor.first_name,
      last_name: instructor.last_name,
      gender: instructor.gender,
      email: instructor.email,
      phone_number: instructor.phone_number,
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (instructor: Instructor) => {
    setSelectedInstructor(instructor)
    setIsDeleteDialogOpen(true)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Instructors</h2>
        <Button onClick={() => setIsAddDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" /> New Instructor
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-gray-100 text-left">ID</th>
              <th className="border p-2 bg-gray-100 text-left">FIRST NAME</th>
              <th className="border p-2 bg-gray-100 text-left">LAST NAME</th>
              <th className="border p-2 bg-gray-100 text-left">GENDER</th>
              <th className="border p-2 bg-gray-100 text-left">EMAIL</th>
              <th className="border p-2 bg-gray-100 text-left">PHONE</th>
              <th className="border p-2 bg-gray-100 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {instructors.map((instructor) => (
              <tr key={instructor.id}>
                <td className="border p-2">{instructor.id}</td>
                <td className="border p-2">{instructor.first_name}</td>
                <td className="border p-2">{instructor.last_name}</td>
                <td className="border p-2">{instructor.gender}</td>
                <td className="border p-2">{instructor.email}</td>
                <td className="border p-2">{instructor.phone_number}</td>
                <td className="border p-2">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(instructor)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(instructor)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Instructor Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Instructor</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" name="first_name" value={formData.first_name} onChange={handleInputChange} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" name="last_name" value={formData.last_name} onChange={handleInputChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={formData.gender} onValueChange={(value) => handleSelectChange("gender", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone</Label>
              <Input id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleInputChange} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddInstructor}>Add Instructor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Instructor Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Instructor</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-first_name">First Name</Label>
                <Input
                  id="edit-first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-last_name">Last Name</Label>
                <Input id="edit-last_name" name="last_name" value={formData.last_name} onChange={handleInputChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-gender">Gender</Label>
              <Select value={formData.gender} onValueChange={(value) => handleSelectChange("gender", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" name="email" type="email" value={formData.email} onChange={handleInputChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone_number">Phone</Label>
              <Input
                id="edit-phone_number"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditInstructor}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Instructor Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Instructor</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p>Are you sure you want to delete this instructor?</p>
            <p className="font-medium mt-2">
              {selectedInstructor?.first_name} {selectedInstructor?.last_name}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteInstructor}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

