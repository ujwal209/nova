"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { DateClickArg } from "@fullcalendar/interaction";
import { 
  X, MapPin, AlignLeft, Calendar as CalendarIcon, 
  Clock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Trash2,
  Plus, Bot, Send, Sparkles, Loader2, Menu, LayoutPanelLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";

// Use the exact action we created
import { chatWithCalendarAgent } from "../actions/calendar_agent"; 
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

const supabase = createSupabaseClient();

// --- TYPEWRITER EFFECT FOR AI ---
const TypewriterMarkdown = memo(({ content, isTyping, onComplete }: { content: string, isTyping: boolean, onComplete: () => void }) => {
  const [displayed, setDisplayed] = useState(isTyping ? "" : content);
  useEffect(() => {
    if (!isTyping) { setDisplayed(content); return; }
    let i = 0;
    const interval = setInterval(() => {
      i += 8; 
      if (i >= content.length) { setDisplayed(content); clearInterval(interval); onComplete(); } 
      else { setDisplayed(content.slice(0, i)); }
    }, 10);
    return () => clearInterval(interval);
  }, [content, isTyping, onComplete]);

  return (
    <div className="prose prose-sm max-w-none leading-relaxed text-zinc-800 dark:text-zinc-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayed}</ReactMarkdown>
    </div>
  );
});
TypewriterMarkdown.displayName = "TypewriterMarkdown";

export default function CalendarPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState("dayGridMonth");
  const [currentTitle, setCurrentTitle] = useState("");
  const [miniCalDate, setMiniCalDate] = useState(new Date());

  const calendarRef = useRef<FullCalendar>(null);
  const [userEvents, setUserEvents] = useState<any[]>([]);

  // Layout & Agent State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{id: string, role: string, content: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalStartDate, setModalStartDate] = useState("");
  const [modalStartTime, setModalStartTime] = useState("10:00");
  const [modalEndDate, setModalEndDate] = useState("");
  const [modalEndTime, setModalEndTime] = useState("11:00");
  const [modalIsAllDay, setModalIsAllDay] = useState(false);
  const [modalLocation, setModalLocation] = useState("");
  const [modalDescription, setModalDescription] = useState("");

  const mapEventFromDB = useCallback((dbEvent: any) => ({
    id: dbEvent.id?.toString(),
    title: dbEvent.title,
    start: dbEvent.start_date,
    end: dbEvent.end_date,
    allDay: dbEvent.all_day,
    className: "user-event",
    backgroundColor: dbEvent.color || "#09090b", // PURE BLACK / ZINC Theme
    borderColor: "transparent",
    textColor: "#ffffff",
    extendedProps: {
      location: dbEvent.location,
      description: dbEvent.description,
    }
  }), []);

  const fetchUserEvents = useCallback(async () => {
    try {
      const { data: dbData, error } = await supabase.from('events').select('*');
      if (dbData) setUserEvents(dbData.map(mapEventFromDB));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [mapEventFromDB]);

  useEffect(() => {
    fetchUserEvents();
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [fetchUserEvents]);

  useEffect(() => {
    if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading, isChatOpen]);

  const handleEventDropOrResize = async (info: any) => {
    const id = info.event.id;
    const startStr = info.event.startStr;
    const endStr = info.event.endStr || startStr;
    const allDay = info.event.allDay;

    setUserEvents(prev => prev.map(ev => ev.id === id ? { ...ev, start: startStr, end: endStr, allDay } : ev));
    const { error } = await supabase.from('events').update({ start_date: startStr, end_date: endStr, all_day: allDay }).eq('id', id);
    if (error) info.revert();
  };

  const handleDateClick = (arg: DateClickArg) => {
    setEditingEventId(null);
    setModalTitle("");
    setModalStartDate(arg.dateStr);
    setModalEndDate(arg.dateStr);
    setModalIsAllDay(arg.allDay);
    setModalLocation("");
    setModalDescription("");
    setModalStartTime("10:00");
    setModalEndTime("11:00");
    setIsModalOpen(true);
  };

  const handleEventClick = (info: any) => {
    const ev = info.event;
    setEditingEventId(ev.id);
    setModalTitle(ev.title);
    
    const startD = new Date(ev.start);
    setModalStartDate(startD.toISOString().split("T")[0]);
    setModalStartTime(startD.toTimeString().substring(0, 5));
    
    if (ev.end) {
      const endD = new Date(ev.end);
      setModalEndDate(endD.toISOString().split("T")[0]);
      setModalEndTime(endD.toTimeString().substring(0, 5));
    } else {
      setModalEndDate(startD.toISOString().split("T")[0]);
      setModalEndTime(`${String((startD.getHours() + 1) % 24).padStart(2, '0')}:${startD.toTimeString().substring(3, 5)}`);
    }
    
    setModalIsAllDay(ev.allDay);
    setModalDescription(ev.extendedProps?.description || "");
    setModalLocation(ev.extendedProps?.location || "");
    setIsModalOpen(true);
  };

  const saveEvent = async () => {
    if (!modalTitle.trim()) return;
    const startStr = modalIsAllDay ? modalStartDate : `${modalStartDate}T${modalStartTime}:00`;
    const endStr = modalIsAllDay ? modalEndDate : `${modalEndDate}T${modalEndTime}:00`;

    const dbPayload = {
      title: modalTitle, start_date: startStr, end_date: endStr,
      all_day: modalIsAllDay, color: "#09090b", location: modalLocation, description: modalDescription
    };

    if (editingEventId) {
      setUserEvents(prev => prev.map(ev => ev.id === editingEventId ? { ...ev, ...mapEventFromDB({ id: editingEventId, ...dbPayload }) } : ev));
      setIsModalOpen(false);
      await supabase.from('events').update(dbPayload).eq('id', editingEventId);
    } else {
      setIsModalOpen(false);
      const tempId = `temp-${Date.now()}`;
      setUserEvents(prev => [...prev, mapEventFromDB({ id: tempId, ...dbPayload })]);
      const { data } = await supabase.from('events').insert(dbPayload).select();
      if (data && data[0]) setUserEvents(prev => prev.map(ev => ev.id === tempId ? mapEventFromDB(data[0]) : ev));
    }
  };

  const deleteEvent = async () => {
    if (!editingEventId) return;
    const idToDelete = editingEventId;
    setUserEvents(prev => prev.filter(ev => ev.id !== idToDelete));
    setIsModalOpen(false);
    await supabase.from('events').delete().eq('id', idToDelete);
  };

  // --- AI AGENT LOGIC ---
  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setIsChatLoading(true);
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: userMsg }]);

    try {
      const slimEvents = userEvents.map(e => ({ id: e.id, title: e.title, start: e.start, end: e.end, allDay: e.allDay }));
      const response = await chatWithCalendarAgent(userMsg, JSON.stringify(slimEvents), messages);
      const newMsgId = crypto.randomUUID();
      
      setMessages(prev => [...prev, { id: newMsgId, role: "assistant", content: response.content }]);
      setTypingMessageId(newMsgId);

      if (response.toolAction) {
        const { action, events } = response.toolAction;
        
        if (action === "add_events" && events) {
          const dbPayloads = events.map((ev: any) => ({
            title: ev.title || "New Event", start_date: ev.start_date, end_date: ev.end_date || ev.start_date,
            all_day: ev.all_day || false, location: ev.location, description: ev.description, color: "#09090b"
          }));
          await supabase.from('events').insert(dbPayloads);
          fetchUserEvents();
        } 
        else if (action === "delete_events" && events) {
          for (const ev of events) {
            if (ev.id) await supabase.from('events').delete().eq('id', ev.id);
          }
          fetchUserEvents();
        }
        else if (action === "update_events" && events) {
          for (const ev of events) {
            if (ev.id) {
              const { id, ...updateData } = ev;
              await supabase.from('events').update(updateData).eq('id', id);
            }
          }
          fetchUserEvents();
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Error connecting to AI." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 280 && newWidth < 800) setChatWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
    return () => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); };
  }, [isDragging]);

  const changeView = (view: string) => {
    if (calendarRef.current) { calendarRef.current.getApi().changeView(view); setActiveView(view); }
  };
  
  const syncMiniCal = () => {
    if (calendarRef.current) setMiniCalDate(calendarRef.current.getApi().getDate());
  };

  // View & Year Navigators
  const handleMiniPrev = () => setMiniCalDate(new Date(miniCalDate.getFullYear(), miniCalDate.getMonth() - 1, 1));
  const handleMiniNext = () => setMiniCalDate(new Date(miniCalDate.getFullYear(), miniCalDate.getMonth() + 1, 1));
  const handleMiniYearPrev = () => setMiniCalDate(new Date(miniCalDate.getFullYear() - 1, miniCalDate.getMonth(), 1));
  const handleMiniYearNext = () => setMiniCalDate(new Date(miniCalDate.getFullYear() + 1, miniCalDate.getMonth(), 1));

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const elements = [];
    for (let i = 0; i < date.getDay(); i++) elements.push(null);
    while (date.getMonth() === month) { elements.push(new Date(date)); date.setDate(date.getDate() + 1); }
    return elements;
  };
  
  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-zinc-50 dark:bg-[#09090b]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900 dark:text-zinc-100" />
      </div>
    );
  }

  const miniDays = getDaysInMonth(miniCalDate.getFullYear(), miniCalDate.getMonth());

  return (
    <div 
      className="flex flex-col h-[100dvh] bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden selection:bg-zinc-200 dark:selection:bg-zinc-800"
      style={{ fontFamily: "'Google Sans', 'Outfit', sans-serif" }}
    >
      {/* =========================================
          PREMIUM RESPONSIVE HEADER
          ========================================= */}
      <header className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl relative z-20">
        
        {/* Left Side: Menus & Title */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 sm:p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all text-zinc-500 hidden lg:block"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          
          <div className="flex items-center gap-2 pr-1 sm:pr-4 cursor-pointer" onClick={() => router.push('/')}>
            <LayoutPanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-950 dark:text-white" />
            <span className="text-[13px] sm:text-[15px] font-black uppercase tracking-widest text-zinc-950 dark:text-white hidden sm:block">Calendar</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => { calendarRef.current?.getApi().today(); syncMiniCal(); }}
              className="px-3 sm:px-4 py-1.5 text-[12px] sm:text-[13px] font-bold border border-zinc-200 dark:border-zinc-700 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              Today
            </button>
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-full p-0.5 border border-zinc-200 dark:border-zinc-800">
              <button onClick={() => { calendarRef.current?.getApi().prevYear(); syncMiniCal(); }} className="hidden sm:flex p-1 sm:p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors" title="Previous Year"><ChevronsLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
              <button onClick={() => { calendarRef.current?.getApi().prev(); syncMiniCal(); }} className="p-1 sm:p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors" title="Previous Month"><ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
              <button onClick={() => { calendarRef.current?.getApi().next(); syncMiniCal(); }} className="p-1 sm:p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors" title="Next Month"><ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
              <button onClick={() => { calendarRef.current?.getApi().nextYear(); syncMiniCal(); }} className="hidden sm:flex p-1 sm:p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors" title="Next Year"><ChevronsRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
            </div>
            
            {/* Desktop Full Title */}
            <h1 className="text-[16px] sm:text-[20px] font-black tracking-tight text-zinc-900 dark:text-zinc-100 ml-2 hidden md:block">
              {currentTitle}
            </h1>
          </div>
        </div>

        {/* Right Side: View Switcher & AI */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          
          {/* Desktop Switcher */}
          <div className="hidden md:flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-0.5">
            {[{ id: "dayGridMonth", label: "Month" }, { id: "timeGridWeek", label: "Week" }, { id: "timeGridDay", label: "Day" }].map((view) => (
              <button
                key={view.id}
                onClick={() => changeView(view.id)}
                className={`px-3 py-1 sm:px-4 sm:py-1.5 text-[12px] font-bold rounded-full transition-all ${
                  activeView === view.id ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>

          {/* Mobile "Short" Switcher */}
          <div className="flex md:hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-0.5">
            {[{ id: "dayGridMonth", label: "M" }, { id: "timeGridWeek", label: "W" }, { id: "timeGridDay", label: "D" }].map((view) => (
              <button
                key={view.id}
                onClick={() => changeView(view.id)}
                className={`px-2.5 py-1 text-[11px] font-black rounded-full transition-all ${
                  activeView === view.id ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>

          <Button 
            variant="outline" 
            onClick={() => setIsChatOpen(!isChatOpen)} 
            className={cn(
              "h-8 sm:h-9 px-3 sm:px-4 rounded-full text-[11px] sm:text-[12px] font-bold uppercase tracking-wide transition-all shadow-sm border",
              isChatOpen ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-transparent shadow-inner" : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> 
            <span className="hidden sm:inline">Ask Nova</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </header>

      {/* MOBILE TITLE STRIP (Because it didn't fit cleanly in the top row on tiny screens) */}
      <div className="md:hidden flex items-center justify-center bg-white dark:bg-[#09090b] border-b border-zinc-200 dark:border-zinc-800 py-2 shrink-0">
        <h1 className="text-[15px] font-black tracking-tight text-zinc-900 dark:text-zinc-100">
          {currentTitle}
        </h1>
      </div>

      {/* MOBILE FAB */}
      <button 
        onClick={() => { const now = new Date(); handleDateClick({ dateStr: now.toISOString().split("T")[0], allDay: false } as any); }}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        
        {/* LEFT SIDEBAR (Desktop) */}
        {isSidebarOpen && (
          <div className="hidden lg:flex w-[260px] flex-col shrink-0 px-4 py-6 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]">
            <button 
              onClick={() => { const now = new Date(); handleDateClick({ dateStr: now.toISOString().split("T")[0], allDay: false } as any); }}
              className="flex items-center justify-center gap-3 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 px-5 py-3.5 mb-8 rounded-xl text-[14px] font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all w-full shadow-md group"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              Create Event
            </button>

            {/* Mini Calendar */}
            <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {miniCalDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-0.5">
                  <button onClick={handleMiniYearPrev} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors" title="Previous Year"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={handleMiniPrev} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors" title="Previous Month"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={handleMiniNext} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors" title="Next Month"><ChevronRight className="w-3.5 h-3.5" /></button>
                  <button onClick={handleMiniYearNext} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors" title="Next Year"><ChevronsRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 text-center gap-y-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 mb-1">{day}</div>
                ))}
                {miniDays.map((date, i) => (
                  <div key={i} className="flex items-center justify-center p-0.5">
                    {date ? (
                      <button 
                        onClick={() => { if (calendarRef.current) calendarRef.current.getApi().gotoDate(date); setMiniCalDate(date); }}
                        className={`w-7 h-7 flex items-center justify-center text-[12px] rounded-full transition-colors font-bold
                          ${isToday(date) 
                            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-md' 
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                      >
                        {date.getDate()}
                      </button>
                    ) : <div className="w-7 h-7" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MAIN VIEW */}
        <div className="flex-1 min-w-0 h-full relative z-10 bg-zinc-50 dark:bg-[#09090b]">
          <div className="absolute inset-0 p-2 sm:p-4 calendar-container custom-scrollbar overflow-y-auto overflow-x-hidden">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={false}
              events={userEvents}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventDrop={handleEventDropOrResize}
              eventResize={handleEventDropOrResize}
              editable={true}
              selectable={true}
              eventDurationEditable={true}
              dayMaxEvents={true} 
              height="100%"
              contentHeight="auto"
              datesSet={(arg) => { setCurrentTitle(arg.view.title); syncMiniCal(); }}
            />
          </div>
        </div>

        {/* DRAG RESIZER */}
        {isChatOpen && (
          <div 
            onMouseDown={handleMouseDown}
            style={{ touchAction: 'none' }}
            className={`hidden md:block w-1.5 shrink-0 cursor-col-resize hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors z-30 border-l border-zinc-200 dark:border-zinc-800 ${isDragging ? 'bg-zinc-200 dark:bg-zinc-800' : 'bg-transparent'}`}
          />
        )}

        {/* AI CHAT SIDEBAR (CSS VARIABLE BASED FOR RESPONSIVENESS) */}
        {isChatOpen && (
          <div 
            style={{ '--chat-width': `${chatWidth}px` } as React.CSSProperties}
            className="absolute inset-0 z-50 w-full md:relative md:w-[var(--chat-width)] flex flex-col bg-white dark:bg-zinc-950 shadow-2xl md:shadow-none border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right-full md:slide-in-from-right-0 duration-300 min-h-0 shrink-0 overflow-hidden"
          >
            <div className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50 dark:bg-zinc-950/50 backdrop-blur-md relative z-20">
              <div className="flex items-center gap-2 font-bold text-[14px] text-zinc-950 dark:text-white uppercase tracking-widest">
                <Sparkles className="w-4 h-4 text-zinc-500" />
                Nova Agent
              </div>
              <button onClick={() => setIsChatOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors md:hidden">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar bg-white dark:bg-[#09090b] min-h-0 relative z-0">
              <div className="relative z-10 flex flex-col min-h-full justify-end pb-2">
                {messages.length === 0 && !isChatLoading && (
                  <div className="flex flex-col items-center justify-center text-center pb-10 my-auto text-zinc-500">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center mb-4">
                      <Sparkles className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
                    </div>
                    <p className="text-[15px] font-black text-zinc-800 dark:text-zinc-200 tracking-tight">Schedule Synced</p>
                    <p className="text-[13px] mt-1 font-medium text-zinc-500">I can read your entire calendar. Tell me to "Reschedule my 2PM to tomorrow".</p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex w-full mb-6", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    {msg.role === "user" ? (
                      <div className="bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-[14px] font-medium shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="bg-transparent text-zinc-800 dark:text-zinc-200 py-1 w-full text-[14px]">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                            <Bot className="w-4 h-4 text-zinc-950 dark:text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <TypewriterMarkdown content={msg.content} isTyping={typingMessageId === msg.id} onComplete={() => setTypingMessageId(null)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex w-full animate-in fade-in duration-500 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                        <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                      </div>
                      <div className="text-zinc-500 text-[12px] font-black uppercase tracking-widest pt-1.5">Processing...</div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} className="h-1 shrink-0" />
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#09090b] shrink-0 border-t border-zinc-200 dark:border-zinc-800">
              <form onSubmit={handleChatSubmit} className="flex items-end w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-zinc-950 dark:focus-within:ring-white transition-all overflow-hidden">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
                  placeholder="Ask Nova to schedule..."
                  disabled={isChatLoading}
                  rows={1}
                  className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[14px] font-medium placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none py-3.5 px-4 min-h-[50px] max-h-[150px] custom-scrollbar text-zinc-950 dark:text-zinc-50"
                />
                <button type="submit" disabled={!chatInput.trim() || isChatLoading} className="p-2 m-1.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 disabled:opacity-30 transition-all flex items-center justify-center shrink-0 shadow-sm">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* EVENT MODAL (Monochrome Styling) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-zinc-950/40 dark:bg-zinc-950/80 backdrop-blur-sm p-0 sm:p-4" onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-w-[500px] bg-white dark:bg-[#09090b] rounded-t-3xl sm:rounded-[24px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              <div className="flex items-center gap-1 sm:gap-2">
                {editingEventId && (
                  <>
                    <button onClick={deleteEvent} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"><Trash2 className="w-4.5 h-4.5" /></button>
                    <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
                  </>
                )}
                <Button onClick={saveEvent} className="bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-full px-5 font-bold shadow-md ml-1 text-[13px]">Save</Button>
              </div>
            </div>

            <div className="px-5 sm:px-8 pb-8 pt-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <input type="text" placeholder="Event title" value={modalTitle} onChange={(e) => setModalTitle(e.target.value)} autoFocus className="w-full text-3xl font-black bg-transparent border-b-2 border-transparent focus:border-zinc-950 dark:focus:border-white placeholder-zinc-300 dark:placeholder-zinc-700 outline-none pb-2 transition-colors mb-8 text-zinc-950 dark:text-white" />

              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <Clock className="w-5 h-5 text-zinc-400 shrink-0" />
                  <div className="flex flex-col gap-3 w-full">
                    <div className="flex items-center gap-2">
                      <input type="date" value={modalStartDate} onChange={(e) => { setModalStartDate(e.target.value); if(modalEndDate < e.target.value) setModalEndDate(e.target.value); }} className="px-3 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none font-bold focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all text-sm w-[140px]" />
                      {!modalIsAllDay && <input type="time" value={modalStartTime} onChange={(e) => setModalStartTime(e.target.value)} className="px-3 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none font-bold focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all text-sm w-[110px]" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 font-bold px-1 text-[12px] w-6 text-center">TO</span>
                      {!modalIsAllDay && <input type="time" value={modalEndTime} onChange={(e) => setModalEndTime(e.target.value)} className="px-3 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none font-bold focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all text-sm w-[110px]" />}
                      <input type="date" value={modalEndDate} onChange={(e) => setModalEndDate(e.target.value)} className="px-3 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none font-bold focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all text-sm w-[140px]" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                      <input type="checkbox" checked={modalIsAllDay} onChange={(e) => setModalIsAllDay(e.target.checked)} className="w-4 h-4 rounded text-zinc-950 dark:text-white border-zinc-300 dark:border-zinc-700" />
                      <span className="text-[13px] font-bold text-zinc-600 dark:text-zinc-400">All day</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <MapPin className="w-5 h-5 text-zinc-400 shrink-0" />
                  <Input placeholder="Add location" value={modalLocation} onChange={(e) => setModalLocation(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-white shadow-none font-medium h-11 rounded-xl" />
                </div>

                <div className="flex items-start gap-4">
                  <AlignLeft className="w-5 h-5 text-zinc-400 mt-3 shrink-0" />
                  <textarea rows={4} placeholder="Add description..." value={modalDescription} onChange={(e) => setModalDescription(e.target.value)} className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-[#09090b] focus:border-zinc-950 dark:focus:border-white focus:ring-1 focus:ring-zinc-950 dark:focus:ring-white resize-none outline-none text-[14px] font-medium transition-all custom-scrollbar" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FC OVERRIDES (Strict Zinc Theme + Responsive Popover) */}
      <style dangerouslySetInnerHTML={{__html: `
        .calendar-container .fc-theme-standard .fc-scrollgrid { border: none !important; }
        .calendar-container .fc-theme-standard td, .calendar-container .fc-theme-standard th { border-color: #e4e4e7; }
        .dark .calendar-container .fc-theme-standard td, .dark .calendar-container .fc-theme-standard th { border-color: #27272a; }
        
        .calendar-container .fc-theme-standard th { border-right: none; border-left: none; background-color: transparent; color: #71717a; text-transform: uppercase; font-size: 0.70rem; font-weight: 800; letter-spacing: 0.05em; padding: 10px 0; }
        .dark .calendar-container .fc-theme-standard th { color: #52525b; }
        
        .calendar-container .fc-scrollgrid-section-header > td { border: none !important; }
        .calendar-container .fc-daygrid-day-top { display: flex; flex-direction: row; justify-content: flex-end; padding-top: 6px; padding-right: 6px; }
        
        .calendar-container .fc-daygrid-day-number { color: #3f3f46; font-weight: 700; padding: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; text-decoration: none !important; font-size: 0.85rem; }
        .dark .calendar-container .fc-daygrid-day-number { color: #d4d4d8; }
        
        .calendar-container .fc-daygrid-day { transition: background-color 0.2s ease; }
        .calendar-container .fc-daygrid-day:hover { background-color: #f4f4f5 !important; }
        .dark .calendar-container .fc-daygrid-day:hover { background-color: #18181b !important; }
        
        .calendar-container .fc-day-today { background-color: transparent !important; }
        .calendar-container .fc-day-today .fc-daygrid-day-number { background-color: #09090b; color: white !important; font-weight: 800; border-radius: 9999px; }
        .dark .calendar-container .fc-day-today .fc-daygrid-day-number { background-color: #ffffff; color: #09090b !important; }

        .calendar-container .fc-event { border-radius: 6px; padding: 3px 6px; font-weight: 700; font-size: 0.70rem; margin-top: 3px; box-shadow: none; border: none; cursor: pointer; }
        .calendar-container .fc-event:hover { filter: brightness(0.95); transform: scale(0.99); }
        .calendar-container .fc-timegrid-slot-label-cushion { color: #71717a; font-size: 0.75rem; font-weight: 600; }
        .dark .calendar-container .fc-timegrid-slot-label-cushion { color: #52525b; }
        .calendar-container .fc-timegrid-today { background-color: transparent !important; }
        .fc-header-toolbar { display: none !important; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #d4d4d8; border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #27272a; }
        
        /* THIS PREVENTS STRETCHING AND ADDS A BEAUTIFUL RESPONSIVE POPOVER */
        .fc-daygrid-more-link { font-weight: 800; font-size: 11px; color: #52525b !important; padding: 2px; }
        .dark .fc-daygrid-more-link { color: #a1a1aa !important; }
        
        .fc-popover { 
          background-color: #ffffff !important; 
          border: 1px solid #e4e4e7 !important; 
          border-radius: 16px !important; 
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important; 
          overflow: hidden !important; 
          z-index: 100 !important; 
        }
        .dark .fc-popover { 
          background-color: #09090b !important; 
          border: 1px solid #27272a !important; 
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5) !important; 
        }
        .fc-popover-header { 
          background-color: #f4f4f5 !important; 
          padding: 12px 16px !important; 
          font-weight: 800 !important; 
          font-size: 14px !important; 
          color: #09090b !important; 
        }
        .dark .fc-popover-header { 
          background-color: #18181b !important; 
          color: #ffffff !important; 
        }
        .fc-popover-body { padding: 12px !important; }

        /* Force popover to act like a modal on mobile screens to prevent clipping */
        @media (max-width: 640px) {
          .fc-popover {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 90% !important;
            max-width: 320px !important;
          }
        }
      `}} />
    </div>
  );
}