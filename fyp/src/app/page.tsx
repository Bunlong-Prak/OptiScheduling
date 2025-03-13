import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col">
            <header className="bg-gray-200 p-4 flex justify-between items-center">
                <div className="text-2xl font-bold">OptiScheduling System</div>
                <Link href="/dashboard">
                    <Button className="bg-black hover:bg-gray-800 text-white flex items-center gap-2">
                        <Image
                            src=""
                            alt="Google logo"
                            width={20}
                            height={20}
                        />
                        Sign In
                    </Button>
                </Link>
            </header>

            <main className="flex-1 flex items-center justify-center">
                <div className="max-w-3xl w-full px-4 py-8 flex flex-col md:flex-row gap-8 items-center">
                    <div className="flex-1 space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold">
                                OptiScheduling: Smart Scheduling for{" "}
                                <span className="text-indigo-700">
                                    Paragon International University
                                </span>
                            </h2>
                            <p className="text-gray-700">
                                Automate course scheduling, manage instructor
                                availability, and optimize resource allocation
                                with ease. Reduce conflicts, save time, and
                                improve efficiency.
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 flex justify-center">
                        <Image
                            src=""
                            alt="Paragon University Logo"
                            width={300}
                            height={300}
                            className="object-contain"
                        />
                    </div>
                </div>
            </main>

            <footer className="bg-white p-4 text-center text-sm text-gray-600 border-t">
                Copyright © All Rights Reserved. 2025, PARAGON International
                University
            </footer>
        </div>
    );
}
