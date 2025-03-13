import { AppSidebar } from "@/components/custom/app-sidebar"
import type React from "react"


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <div className="w-64 border-r bg-gray-50">
        <AppSidebar />
      </div>
      <div className="flex-1">
        <main className="p-6 w-full">{children}</main>
      </div>
    </div>
  )
}

