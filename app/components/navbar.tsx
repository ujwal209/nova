"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  LayoutGrid, Search, FileText, Table, 
  Calendar as CalendarIcon, LogOut, User,
  Bell, Settings, Sparkles, Globe, Bot
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { getProfile, signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Hide Navbar on Auth pages
  const isAuthPage = pathname?.startsWith('/login') || 
                     pathname?.startsWith('/signup') || 
                     pathname?.startsWith('/verify') || 
                     pathname?.startsWith('/onboarding');
  
  // Also maybe hide on landing page if preferred, but user asked for "common navbar"
  // Let's keep it visible on landing but with a login button if not logged in.

  useEffect(() => {
    async function loadUser() {
      try {
        const profile = await getProfile();
        setUser(profile);
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [pathname]);

  if (isAuthPage) return null;

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    router.push('/login');
  };

  const navItems = [
    { name: "Browser", href: "/browser", icon: Globe, color: "text-blue-500" },
    { name: "Agent", href: "/agent", icon: Bot, color: "text-indigo-500" },
    { name: "Docs", href: "/docs", icon: FileText, color: "text-sky-500" },
    { name: "Sheets", href: "/sheets", icon: Table, color: "text-emerald-500" },
    { name: "Calendar", href: "/calendar", icon: CalendarIcon, color: "text-orange-500" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-[#ECF4FF]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group" 
          onClick={() => router.push('/')}
        >
          <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
            <span className="font-black text-lg">N</span>
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900 hidden sm:block">Nova</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-white/50 p-1 rounded-2xl border border-[#DDEBFF] shadow-sm">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-bold transition-all",
                pathname === item.href 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <item.icon className={cn("w-4 h-4", pathname === item.href ? item.color : "text-slate-400")} />
              {item.name}
            </button>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-[#DDEBFF] rounded-xl hidden sm:flex">
            <Bell className="w-5 h-5" />
          </Button>
          
          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

          {loading ? (
             <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="w-9 h-9 cursor-pointer ring-2 ring-white shadow-sm border border-slate-200 transition-transform hover:scale-105">
                  <AvatarImage src={user.avatar_url || ""} />
                  <AvatarFallback className="bg-blue-600 text-white font-bold">
                    {user.full_name?.charAt(0) || user.username?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-xl border-[#DDEBFF]">
                <DropdownMenuLabel className="font-bold px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-slate-900">{user.full_name || "Nova User"}</span>
                    <span className="text-[11px] text-slate-400 font-medium truncate">{user.username ? `@${user.username}` : "Member"}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem onClick={() => router.push('/onboarding')} className="rounded-xl px-3 py-2 cursor-pointer focus:bg-[#ECF4FF] focus:text-blue-600 font-bold">
                  <Settings className="w-4 h-4 mr-2" /> Preferences
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="rounded-xl px-3 py-2 cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600 font-bold">
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button 
              onClick={() => router.push('/login')}
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded-full shadow-md hover:bg-blue-700 transition-all border-none"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
