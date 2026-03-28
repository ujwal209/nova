"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutGrid, Globe, Bot, FileText, Table, Calendar as CalendarIcon, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const APPS = [
  { icon: Globe, label: "Browser", href: "/browser" },
  { icon: Bot, label: "Agent", href: "/agent" },
  { icon: FileText, label: "Docs", href: "/docs" },
  { icon: Table, label: "Todos", href: "/todo" },
  { icon: CalendarIcon, label: "Calendar", href: "/calendar" }
];

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [showAppsMenu, setShowAppsMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const appsMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // 1. ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  useEffect(() => {
    const supabase = createClient();
    
    // Check initial session
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    // Listen for auth changes (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Handle clicking outside of dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (appsMenuRef.current && !appsMenuRef.current.contains(event.target as Node)) {
        setShowAppsMenu(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setShowProfileMenu(false);
    router.push('/login');
  };

  // 2. EARLY RETURN PLACED *AFTER* ALL HOOKS HAVE BEEN CALLED
  // HIDE NAVBAR ON AUTH AND ONBOARDING
  const authPaths = ['/login', '/signup', '/onboarding'];
  if (authPaths.includes(pathname)) return null;

  // 3. RENDER UI
  return (
    <header 
      className="flex items-center justify-between p-4 px-6 shrink-0 bg-white dark:bg-zinc-950 z-50 relative border-b border-zinc-200 dark:border-zinc-800 w-full transition-colors h-16 sm:h-20"
      style={{ fontFamily: "'Google Sans', 'Outfit', sans-serif" }}
    >
      {/* STRICT FONT ENFORCEMENT */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Outfit:wght@100..900&display=swap');
        * { font-family: 'Google Sans', 'Outfit', sans-serif !important; }
      `}} />

      {/* Left Section: Sleek Text Logo */}
      <div 
        className="flex items-center gap-2 cursor-pointer group z-10" 
        onClick={() => router.push('/')}
      >
        <span className="text-2xl sm:text-3xl font-black tracking-tighter bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-zinc-100 dark:to-zinc-500 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
          Nova.
        </span>
      </div>

      {/* Center Section: Desktop Nav Links (Absolute centered) */}
      {user && (
        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8">
          {APPS.map((app) => {
            const isActive = pathname.startsWith(app.href);
            return (
              <div
                key={app.label}
                onClick={() => router.push(app.href)}
                className={cn(
                  "flex items-center gap-2 text-[14px] font-bold cursor-pointer transition-all hover:text-zinc-950 dark:hover:text-zinc-50",
                  isActive ? "text-zinc-950 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
                )}
              >
                <app.icon className={cn("w-4 h-4", isActive ? "opacity-100" : "opacity-70")} />
                {app.label}
              </div>
            );
          })}
        </nav>
      )}

      {/* Right Section: Mobile App Launcher & Auth */}
      <div className="flex items-center gap-4 z-10">
        {loading ? (
          <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        ) : user ? (
          <>
            {/* Mobile App Launcher (Hidden on Desktop) */}
            <div ref={appsMenuRef} className="relative md:hidden">
              <div 
                onClick={() => setShowAppsMenu(!showAppsMenu)} 
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer transition-colors text-zinc-600 dark:text-zinc-400"
              >
                <LayoutGrid className="w-5 h-5" />
              </div>
              
              {showAppsMenu && (
                <div className="absolute top-full right-0 mt-3 w-[280px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 p-4">
                  <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                    {APPS.map((app, idx) => (
                      <div key={idx} onClick={() => { router.push(app.href); setShowAppsMenu(false); }} className="flex flex-col items-center gap-2 cursor-pointer group">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-950 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
                          <app.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-400">{app.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar & Profile Dropdown */}
            <div ref={profileMenuRef} className="relative">
              <Avatar 
                className="w-9 h-9 cursor-pointer ring-2 ring-zinc-100 dark:ring-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-950 dark:bg-zinc-50 transition-all hover:scale-105"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <AvatarImage src={user.user_metadata?.avatar_url || ""} />
                <AvatarFallback className="bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950 font-bold">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>

              {showProfileMenu && (
                <div className="absolute top-full right-0 mt-3 w-56 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 p-2">
                  {/* User Email/Info Header */}
                  <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">Signed In As</p>
                    <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
                      {user.email}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => { router.push('/profile'); setShowProfileMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
                    >
                      <User className="w-4 h-4" /> Profile
                    </button>
                    <button 
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <button 
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950 font-semibold rounded-full shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}