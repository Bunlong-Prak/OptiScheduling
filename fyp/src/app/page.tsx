import { getAuthUser } from "@/auth/server/action";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default async function Home() {
  const authUser = await getAuthUser();
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#2F2F85] rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">O</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  OptiScheduling System
                </h1>
                <span className="text-xs text-gray-500">Smart Scheduling Solution</span>
              </div>
            </div>
            
            {authUser ? (
              <Link href="/dashboard">
                <Button className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#2F2F85] hover:bg-[#3F3F8F] rounded transition-colors">
                  <Image
                    src="/image/google.png"
                    alt="Google logo"
                    width={18}
                    height={18}
                    className="mr-2"
                  />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/api/oauth/google">
                <Button className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#2F2F85] hover:bg-[#3F3F8F] rounded transition-colors">
                  <Image
                    src="/image/google.png"
                    alt="Google logo"
                    width={18}
                    height={18}
                    className="mr-2"
                  />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center px-6 lg:px-8">
        <div className="max-w-6xl w-full py-12 flex flex-col lg:flex-row gap-12 items-center">
          <div className="flex-1 space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                OptiScheduling: Smart Scheduling for
                <span className="block text-[#2F2F85] mt-2">
                  Paragon International University
                </span>
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Automate course scheduling, manage instructor availability, and optimize 
                resource allocation with ease. Reduce conflicts, save time, and improve 
                efficiency across your institution.
              </p>
            </div>
            
         
          </div>
          
          <div className="flex-1 flex justify-center">
            <div className="relative">
              <Image
                src="/image/paragonlogo.png"
                alt="Paragon University Logo"
                width={200}
                height={200}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 px-6 lg:px-8 py-6">
        <div className="text-center text-sm text-gray-500">
          Copyright © All Rights Reserved. 2025, PARAGON International University
        </div>
      </footer>
    </div>
  );
}