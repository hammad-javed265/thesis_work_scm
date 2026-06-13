"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { User } from "next-auth";

export default function Header({ user }: { user?: User }) {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    if (pathname === "/login") return null;

    return (
        <header className="flex items-center justify-between px-10 py-3 bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 transition-all duration-300">
            <div className="flex items-center gap-4">
                <div className="w-32 hover:opacity-90 transition-opacity">
                    <img src="/Stylo-logo.png" alt="Stylo Logo" className="w-full h-auto cursor-pointer" />
                </div>
            </div>

            <nav className="flex gap-4 p-1 bg-gray-100/50 rounded-full border border-gray-200/50 backdrop-blur-sm">
                <Link
                    href="/"
                    className={`px-5 py-2 text-[14px] font-medium rounded-full transition-all duration-300 ${isActive("/")
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-600 hover:text-blue-600 hover:bg-white/50"
                        }`}
                >
                    Initial Push
                </Link>
                <Link
                    href="/ml-planner"
                    className={`px-5 py-2 text-[14px] font-medium rounded-full transition-all duration-300 ${isActive("/ml-planner")
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-600 hover:text-blue-600 hover:bg-white/50"
                        }`}
                >
                    ML Assortment Planner
                </Link>
            </nav>

            <div className="flex items-center gap-4">
                {user ? (
                    <div className="flex items-center gap-4 pl-4 border-l border-gray-200/50">
                        <div className="flex items-center gap-3 group cursor-pointer">
                            {user.image && (
                                <div className="relative">
                                    <img
                                        src={user.image}
                                        alt={user.name || "User"}
                                        className="w-9 h-9 rounded-full border-2 border-white shadow-sm group-hover:shadow-md transition-all duration-300 ring-2 ring-transparent group-hover:ring-blue-100"
                                    />
                                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                                </div>
                            )}
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                                    {user.name}
                                </span>
                                <span className="text-[10px] text-gray-500 font-medium tracking-wide">
                                    User
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white text-xs font-semibold py-2 px-5 rounded-full shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1"
                        >
                            Logout
                        </button>
                    </div>
                ) : (
                    <Link
                        href="/login"
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                        Sign In
                    </Link>
                )}
            </div>
        </header>
    );
}
