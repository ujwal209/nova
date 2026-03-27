"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search, 
  HelpCircle, Settings, Menu, Plus, LayoutGrid
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// --- Helper Functions for Date Math ---
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

const formatMonthYear = (date: Date) => {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
};

export default function CalendarPage() {
  const router = useRouter();
  
  // --- State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());

  // --- Live Time Tracker ---
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // --- Navigation Actions ---
  const goToToday = () => setCurrentDate(new Date());
  
  const prevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  // --- Derived Data ---
  const startOfWeek = getStartOfWeek(currentDate);
  
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const hours = Array.from({ length: 24 }, (_, i) => i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`);

  // Calculate current time line position (48px per hour)
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const timeLineTop = (currentHour * 48) + ((currentMinute / 60) * 48);

  // Mini Calendar Calculations
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const monthDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  // --- Dynamic Events (Tied to the viewed week to always look good) ---
  const dynamicEvents = [
    { title: "Design Sync", dayIndex: 1, startHour: 10, duration: 1.5, color: "blue" }, // Monday
    { title: "Product Review", dayIndex: 2, startHour: 14, duration: 2, color: "purple" }, // Tuesday
    { title: "Engineering Standup", dayIndex: 3, startHour: 11.5, duration: 1, color: "green" }, // Wednesday
    { title: "Weekly All-Hands", dayIndex: 5, startHour: 15, duration: 1.5, color: "rose" }, // Friday
  ];

  return (
    <div 
      className="flex flex-col h-screen bg-white dark:bg-[#111111] text-zinc-900 dark:text-zinc-100 overflow-hidden"
      style={{ fontFamily: "'Google Sans', 'Product Sans', sans-serif" }}
    >
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.6); }
      `}} />

      {/* TOP HEADER */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 bg-white/80 dark:bg-[#111111]/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-4">
          <Menu className="w-5 h-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer" />
          <div 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
              <CalendarIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-[20px] text-zinc-700 dark:text-zinc-200 font-medium tracking-tight">Calendar</span>
          </div>
          
          <div className="flex items-center gap-4 ml-6">
            <button 
              onClick={goToToday}
              className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700/80 text-[14px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-[#1f1f1f] hover:border-zinc-300 dark:hover:border-zinc-600 transition-all shadow-sm"
            >
              Today
            </button>
            <div className="flex items-center gap-1 bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 shadow-sm">
              <button onClick={prevWeek} className="p-1.5 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md transition-colors"><ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" /></button>
              <button onClick={nextWeek} className="p-1.5 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md transition-colors"><ChevronRight className="w-4 h-4 text-zinc-600 dark:text-zinc-400" /></button>
            </div>
            <span className="text-[18px] text-zinc-800 dark:text-zinc-100 font-medium ml-2 w-40">
              {formatMonthYear(startOfWeek)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <Search className="w-5 h-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer" />
          <HelpCircle className="w-5 h-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer hidden md:block" />
          <Settings className="w-5 h-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer" />
          
          <select className="bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 text-[14px] font-medium text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 px-3 py-2 rounded-lg cursor-pointer ml-2 outline-none shadow-sm transition-all hidden sm:block">
            <option>Week</option>
            <option>Month</option>
            <option>Day</option>
          </select>
          
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block"></div>
          
          <LayoutGrid className="w-5 h-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer hidden sm:block" />
          
          <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-transparent hover:ring-zinc-200 dark:hover:ring-zinc-700 transition-all ml-1">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>UV</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* SIDEBAR */}
        <div className="hidden lg:flex flex-col w-[260px] border-r border-zinc-200 dark:border-zinc-800/60 p-5 shrink-0 overflow-y-auto custom-scrollbar bg-white dark:bg-[#111111]">
          
          <button className="flex items-center gap-3 bg-white dark:bg-[#1a1a1a] shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-none border border-zinc-200/80 dark:border-zinc-700/80 px-5 py-3.5 rounded-2xl text-[14px] font-medium hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:hover:bg-[#202020] transition-all w-fit group">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4 text-white" />
            </div>
            Create Event
          </button>
          
          {/* DYNAMIC MINI CALENDAR */}
          <div className="mt-8">
            <div className="flex items-center justify-between px-1 mb-4">
              <span className="text-[14px] font-medium text-zinc-800 dark:text-zinc-200">{formatMonthYear(currentDate)}</span>
              <div className="flex gap-1">
                <button onClick={() => {
                  const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d);
                }} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"><ChevronLeft className="w-4 h-4 text-zinc-500" /></button>
                <button onClick={() => {
                  const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d);
                }} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"><ChevronRight className="w-4 h-4 text-zinc-500" /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center text-[11px] text-zinc-500 mb-2 font-medium">
              <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            </div>
            
            <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center text-[12px] text-zinc-700 dark:text-zinc-300">
              {blanks.map(b => <div key={`blank-${b}`} />)}
              {monthDays.map(dayNum => {
                const isToday = isSameDay(new Date(currentYear, currentMonth, dayNum), now);
                const isViewedWeek = weekDates.some(wd => isSameDay(wd, new Date(currentYear, currentMonth, dayNum)));
                
                return (
                  <div key={dayNum} className="flex justify-center">
                    <div className={`w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors
                      ${isToday ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                               : isViewedWeek ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium'
                               : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                      {dayNum}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CALENDAR GRID */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#111111]">
          
          {/* Day Headers */}
          <div className="flex ml-14 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0">
            {weekDates.map((date, i) => {
              const isToday = isSameDay(date, now);
              return (
                <div key={i} className="flex-1 flex flex-col items-center py-4 border-r border-zinc-100 dark:border-zinc-800/30">
                  <span className={`text-[11px] font-semibold tracking-wider ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'}`}>
                    {days[i]}
                  </span>
                  <div className={`text-[24px] mt-1.5 w-11 h-11 flex items-center justify-center rounded-full transition-colors cursor-pointer
                    ${isToday ? 'bg-indigo-600 text-white font-medium shadow-md' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  >
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Grid Workspace */}
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            
            {/* The Current Time Red Line */}
            {weekDates.some(d => isSameDay(d, now)) && (
              <div 
                className="absolute left-14 right-0 flex items-center z-20 pointer-events-none transition-all duration-1000"
                style={{ top: `${timeLineTop}px` }}
              >
                <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                <div className="flex-1 h-[2px] bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              </div>
            )}

            {/* Background Grid */}
            <div className="relative">
              {hours.map((hour, i) => (
                <div key={hour} className="flex h-12 relative group">
                  <div className="w-14 shrink-0 text-right pr-3 relative">
                    {i !== 0 && (
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium relative -top-2.5">{hour}</span>
                    )}
                  </div>
                  <div className="flex-1 flex border-b border-zinc-100 dark:border-zinc-800/40 relative">
                    {days.map((_, dayIdx) => (
                      <div key={dayIdx} className="flex-1 border-r border-zinc-100 dark:border-zinc-800/30 hover:bg-zinc-50 dark:hover:bg-[#161616] transition-colors cursor-pointer" />
                    ))}
                  </div>
                </div>
              ))}

              {/* DYNAMIC EVENTS OVERLAY */}
              {dynamicEvents.map((ev, i) => {
                // Determine colors based on event configuration
                let bg, border, text, timeText;
                if (ev.color === 'blue') { bg = 'bg-blue-100/80 dark:bg-blue-500/10'; border = 'border-blue-200 dark:border-blue-500/20'; text = 'text-blue-800 dark:text-blue-300'; timeText = 'text-blue-600 dark:text-blue-400'; }
                else if (ev.color === 'purple') { bg = 'bg-purple-100/80 dark:bg-purple-500/10'; border = 'border-purple-200 dark:border-purple-500/20'; text = 'text-purple-800 dark:text-purple-300'; timeText = 'text-purple-600 dark:text-purple-400'; }
                else if (ev.color === 'green') { bg = 'bg-emerald-100/80 dark:bg-emerald-500/10'; border = 'border-emerald-200 dark:border-emerald-500/20'; text = 'text-emerald-800 dark:text-emerald-300'; timeText = 'text-emerald-600 dark:text-emerald-400'; }
                else { bg = 'bg-rose-100/80 dark:bg-rose-500/10'; border = 'border-rose-200 dark:border-rose-500/20'; text = 'text-rose-800 dark:text-rose-300'; timeText = 'text-rose-600 dark:text-rose-400'; }

                // Calculate Position & Size
                const topPos = ev.startHour * 48; 
                const height = ev.duration * 48;
                const leftPercentage = (ev.dayIndex / 7) * 100;
                const widthPercentage = 100 / 7;

                // Format Time String
                const sHour = Math.floor(ev.startHour);
                const sMin = (ev.startHour % 1) * 60;
                const eHour = Math.floor(ev.startHour + ev.duration);
                const eMin = ((ev.startHour + ev.duration) % 1) * 60;
                
                const formatTime = (h: number, m: number) => {
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  const hr12 = h % 12 || 12;
                  return `${hr12}${m > 0 ? `:${m}` : ''} ${ampm}`;
                };

                return (
                  <div 
                    key={i}
                    className={`absolute rounded-lg border ${bg} ${border} p-2 shadow-sm z-10 cursor-pointer hover:shadow-md hover:brightness-95 dark:hover:brightness-110 transition-all overflow-hidden`}
                    style={{ 
                      top: `${topPos}px`, 
                      height: `${height}px`,
                      left: `calc(3.5rem + ${leftPercentage}% + 4px)`, 
                      width: `calc(${widthPercentage}% - 8px)`
                    }}
                  >
                    <p className={`text-[12px] font-semibold ${text} leading-tight truncate`}>{ev.title}</p>
                    <p className={`text-[10px] ${timeText} font-medium mt-0.5 truncate`}>
                      {formatTime(sHour, sMin)} - {formatTime(eHour, eMin)}
                    </p>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}