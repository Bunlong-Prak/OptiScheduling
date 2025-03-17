"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Mail } from "lucide-react";

// Mock admin data
type Admin = {
    id: string;
    email: string;
    name: string;
    addedOn: string;
};

const initialAdmins: Admin[] = [
    {
        id: "1",
        email: "admin@paragon.edu.kh",
        name: "System Administrator",
        addedOn: "2023-01-15",
    },
    {
        id: "2",
        email: "dean@paragon.edu.kh",
        name: "Faculty Dean",
        addedOn: "2023-03-22",
    },
    {
        id: "3",
        email: "registrar@paragon.edu.kh",
        name: "University Registrar",
        addedOn: "2023-05-10",
    },
];

export function AdminManagement() {
    const [admins, setAdmins] = useState<Admin[]>(initialAdmins);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
    const [newAdminEmail, setNewAdminEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [message, setMessage] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);

    const handleAddAdmin = () => {
        // Validate email
        if (!newAdminEmail) {
            setEmailError("Email is required");
            return;
        }

        if (!newAdminEmail.includes("@")) {
            setEmailError("Please enter a valid email address");
            return;
        }

        // Check if admin already exists
        if (admins.some((admin) => admin.email === newAdminEmail)) {
            setEmailError("This email already has admin access");
            return;
        }

        // Add new admin
        const newAdmin: Admin = {
            id: Date.now().toString(),
            email: newAdminEmail,
            name: newAdminEmail.split("@")[0], // Simple name extraction from email
            addedOn: new Date().toISOString().split("T")[0],
        };

        setAdmins([...admins, newAdmin]);
        setNewAdminEmail("");
        setIsAddDialogOpen(false);
        setMessage({
            text: `${newAdminEmail} has been granted access to the system`,
            type: "success",
        });

        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
    };

    const handleRemoveAdmin = () => {
        if (!selectedAdmin) return;

        // Remove admin
        setAdmins(admins.filter((admin) => admin.id !== selectedAdmin.id));
        setSelectedAdmin(null);
        setIsDeleteDialogOpen(false);
        setMessage({
            text: `${selectedAdmin.email} no longer has access to the system`,
            type: "error",
        });

        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
    };

    const openDeleteDialog = (admin: Admin) => {
        setSelectedAdmin(admin);
        setIsDeleteDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {message && (
                <div
                    className={`p-4 rounded-md ${
                        message.type === "success"
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                    } fixed top-4 right-4 z-50 shadow-md transition-opacity duration-300 ease-in-out`}
                >
                    {message.text}
                </div>
            )}
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">System Administrators</h2>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Administrator
                </Button>
            </div>

            <div className="border rounded-md">
                <div className="grid grid-cols-3 bg-gray-100 p-4 font-medium border-b">
                    <div>Name</div>
                    <div>Email</div>
                    <div>Added On</div>
                </div>

                {admins.map((admin) => (
                    <div
                        key={admin.id}
                        className="grid grid-cols-3 p-4 border-b items-center"
                    >
                        <div>{admin.name}</div>
                        <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-2 text-gray-500" />
                            {admin.email}
                        </div>
                        <div className="flex justify-between items-center">
                            <span>{admin.addedOn}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(admin)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}

                {admins.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No administrators found
                    </div>
                )}
            </div>

            {/* Add Admin Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Administrator</DialogTitle>
                        <DialogDescription>
                            Enter the Google account email to grant system
                            access
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Google Account Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="email@example.com"
                                value={newAdminEmail}
                                onChange={(e) => {
                                    setNewAdminEmail(e.target.value);
                                    setEmailError("");
                                }}
                            />
                            {emailError && (
                                <p className="text-sm text-red-500">
                                    {emailError}
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsAddDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleAddAdmin}>
                            Add Administrator
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Admin Alert Dialog */}
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Remove Administrator
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove system access for{" "}
                            {selectedAdmin?.email}? This action cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveAdmin}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            Remove Access
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
