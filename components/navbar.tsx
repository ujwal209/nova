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

  // 1. FIX: Listen to `pathname` changes so the Navbar re-fetches the user 
  // immediately after a client-side redirect from the login page.
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const checkSession = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) {
        setUser(user);
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes (login/logout events from other tabs or actions)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setUser(session?.user || null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [pathname]); // <--- This triggers the dynamic update on navigation

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
    setUser(null);
    router.push('/login');
    router.refresh(); // Clear Next.js client cache
  };

  // 2. EARLY RETURN AFTER HOOKS
  const authPaths = ['/login', '/signup', '/onboarding'];
  if (authPaths.includes(pathname)) return null;

  return (
    <header 
      className="flex items-center justify-between p-4 px-6 shrink-0 bg-white z-50 relative border-b border-zinc-200 w-full transition-colors h-16 sm:h-20"
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
        <span className="text-2xl sm:text-3xl font-black tracking-tighter bg-gradient-to-br from-zinc-900 to-zinc-500 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
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
                  "flex items-center gap-2 text-[14px] font-bold cursor-pointer transition-all hover:text-zinc-900",
                  isActive ? "text-zinc-900" : "text-zinc-400"
                )}
              >
                <app.icon className={cn("w-4 h-4", isActive ? "opacity-100 text-blue-600" : "opacity-70")} />
                {app.label}
              </div>
            );
          })}
        </nav>
      )}

      {/* Right Section: Mobile App Launcher & Auth */}
      <div className="flex items-center gap-4 z-10">
        {loading ? (
          <div className="w-10 h-10 rounded-full bg-zinc-100 animate-pulse" />
        ) : user ? (
          <>
            {/* Mobile App Launcher (Hidden on Desktop) */}
            <div ref={appsMenuRef} className="relative md:hidden">
              <div 
                onClick={() => setShowAppsMenu(!showAppsMenu)} 
                className="p-2.5 rounded-xl hover:bg-zinc-100 cursor-pointer transition-colors text-zinc-600"
              >
                <LayoutGrid className="w-5 h-5" />
              </div>
              
              {showAppsMenu && (
                <div className="absolute top-full right-0 mt-3 w-[280px] bg-white border border-zinc-200 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] z-50 animate-in fade-in slide-in-from-top-4 duration-300 p-4">
                  <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                    {APPS.map((app, idx) => (
                      <div key={idx} onClick={() => { router.push(app.href); setShowAppsMenu(false); }} className="flex flex-col items-center gap-2 cursor-pointer group">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white text-zinc-600 border border-zinc-100 transition-all group-hover:scale-105">
                          <app.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[13px] font-bold text-zinc-500 group-hover:text-zinc-900">{app.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar & Profile Dropdown */}
            <div ref={profileMenuRef} className="relative">
              <Avatar 
                className="w-10 h-10 cursor-pointer ring-2 ring-transparent hover:ring-zinc-200 shadow-sm border border-zinc-200 bg-zinc-50 transition-all hover:scale-105"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <AvatarImage src={user.user_metadata?.avatar_url || ""} />
                <AvatarFallback className="bg-zinc-100 text-zinc-600 font-bold">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>

              {showProfileMenu && (
                <div className="absolute top-full right-0 mt-3 w-64 bg-white border border-zinc-200 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] z-50 animate-in fade-in slide-in-from-top-4 duration-300 p-2.5">
                  {/* User Email/Info Header */}
                  <div className="px-4 py-3 border-b border-zinc-100 mb-1.5">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Signed In As</p>
                    <p className="text-[14px] font-bold text-zinc-900 truncate">
                      {user.email}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => { router.push('/profile'); setShowProfileMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-colors"
                    >
                      <User className="w-4 h-4" /> Profile
                    </button>
                    <button 
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-bold text-red-600 hover:bg-red-50 rounded-2xl transition-colors"
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
            className="px-6 py-2.5 bg-zinc-900 text-white text-[14px] font-bold rounded-full shadow-lg hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}