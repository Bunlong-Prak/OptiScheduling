"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, Home, LogOut} from "lucide-react"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold tracking-tight">OptiScheduling</h2>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <nav className="flex flex-col gap-1 px-2">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-gray-200 ${pathname === "/dashboard" ? "bg-gray-200 font-medium" : ""}`}
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </Link>
          <Link
            href="/dashboard/admin"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-gray-200 ${pathname.startsWith("/dashboard/schedules") ? "bg-gray-200 font-medium" : ""}`}
          >
            <Calendar className="h-4 w-4" />
            <span>Admin</span>
          </Link>
        
        </nav>
      </div>
      <div className="border-t p-4">
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/">
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Link>
        </Button>
      </div>
    </div>
  )
}

