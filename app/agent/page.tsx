"use client";

import { useState, useRef, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import { chatWithMultiAgent } from "../actions/multi_agent";
import { createClient } from "@/lib/supabase/client";

// --- MARKDOWN & LATEX ---
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import 'katex/dist/katex.min.css'; // CRITICAL: Required for LaTeX styling

// --- ICONS ---
import { 
  Send, Search, Plus, MessageSquare, PanelLeftClose, PanelLeftOpen, 
  Settings, Loader2, Copy, Check, Globe, BrainCircuit, Code, 
  PenTool, ListChecks, ChevronDown, User, Sparkles, Trash2, Paperclip, 
  Edit2, RefreshCw, Box
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const supabase = createClient();

type Source = { title: string; link: string; favicon?: string };
type Message = { id: string; role: "user" | "assistant"; content: string; sources?: Source[], agentId?: string };
type ChatSession = { id: string; title: string; updated_at: string };

// --- AGENT DEFINITIONS & DYNAMIC FORMS ---
type FieldDef = { name: string; label: string; type: 'text' | 'autocomplete' | 'date' | 'textarea' | 'select'; placeholder?: string; options?: string[]; colSpan: 1 | 2 };

const AGENTS: { id: string; prefix: string; name: string; desc: string; color: string; bgSoft: string; icon: any; fields: FieldDef[] }[] = [
  { 
    id: "core", prefix: "SYS", name: "Core", icon: Sparkles, desc: "General workspace administrator.", color: "text-slate-700", bgSoft: "bg-slate-100",
    fields: [ { name: "query", label: "Message", type: "textarea", placeholder: "Ask anything, manage tasks, or schedule events...", colSpan: 2 } ]
  },
  { 
    id: "globe", prefix: "TRV", name: "Globe", icon: Globe, desc: "Global travel concierge & flight bookings.", color: "text-blue-700", bgSoft: "bg-blue-50",
    fields: [
      { name: "origin", label: "Origin City", type: "text", placeholder: "e.g., New York (JFK)", colSpan: 1 },
      { name: "destination", label: "Destination City", type: "text", placeholder: "e.g., Paris (CDG)", colSpan: 1 },
      { name: "date", label: "Departure Date", type: "date", colSpan: 1 },
      { name: "preferences", label: "Preferences", type: "text", placeholder: "e.g., Non-stop, Luxury hotels", colSpan: 1 }
    ]
  },
  { 
    id: "scholar", prefix: "RCH", name: "Scholar", icon: BrainCircuit, desc: "Deep web scraper & academic researcher.", color: "text-indigo-700", bgSoft: "bg-indigo-50",
    fields: [
      { name: "topic", label: "Research Topic", type: "text", placeholder: "What subject are we diving into?", colSpan: 2 },
      { name: "depth", label: "Analysis Depth", type: "select", options: ["Quick Summary", "Detailed Analysis", "Exhaustive Report"], colSpan: 1 },
      { name: "sources", label: "Preferred Sources", type: "text", placeholder: "e.g., Academic journals, news", colSpan: 1 }
    ]
  },
  { 
    id: "developer", prefix: "DEV", name: "Developer", icon: Code, desc: "Senior software engineer and debugger.", color: "text-orange-700", bgSoft: "bg-orange-50",
    fields: [
      { name: "stack", label: "Tech Stack", type: "text", placeholder: "e.g., React, Next.js, Python", colSpan: 2 },
      { name: "task", label: "Engineering Task", type: "textarea", placeholder: "Describe the feature, bug, or script...", colSpan: 2 }
    ]
  },
  { 
    id: "scribe", prefix: "CPY", name: "Scribe", icon: PenTool, desc: "Creative copywriter & content strategist.", color: "text-purple-700", bgSoft: "bg-purple-50",
    fields: [
      { name: "topic", label: "Content Topic", type: "textarea", placeholder: "What are we writing about?", colSpan: 2 },
      { name: "tone", label: "Tone of Voice", type: "select", options: ["Professional", "Casual", "Persuasive", "Academic"], colSpan: 1 },
      { name: "format", label: "Format", type: "select", options: ["Email", "Blog Post", "Essay", "Social Media"], colSpan: 1 }
    ]
  },
  { 
    id: "planner", prefix: "MGT", name: "Planner", icon: ListChecks, desc: "Agile project manager and task delegator.", color: "text-emerald-700", bgSoft: "bg-emerald-50",
    fields: [
      { name: "goal", label: "Project Goal", type: "textarea", placeholder: "Describe the massive goal to break down...", colSpan: 2 },
      { name: "deadline", label: "Deadline", type: "text", placeholder: "e.g., End of Q3", colSpan: 2 }
    ]
  }
];

const getAgentDetails = (id: string) => AGENTS.find(a => a.id === id) || AGENTS[0];

// ============================================================================
// CUSTOM SELECT COMPONENT (Enterprise UI)
// ============================================================================
function CustomSelect({ 
  value, onChange, options, placeholder, disabled 
}: { 
  value: string, onChange: (v: string) => void, options: string[], placeholder: string, disabled: boolean 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between bg-white border border-slate-300 rounded-md px-3 py-2 text-[13px] outline-none transition-all shadow-sm",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
          value ? "text-slate-900 font-medium" : "text-slate-400"
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 opacity-70 shrink-0" />
      </button>
      
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-100 custom-scrollbar">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-[13px] transition-colors",
                value === opt ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FAST TYPEWRITER COMPONENT (WITH LATEX SUPPORT)
// ============================================================================
const TypewriterMarkdown = memo(({ content, isTyping, onComplete }: { content: string, isTyping: boolean, onComplete: () => void }) => {
  const [displayed, setDisplayed] = useState(isTyping ? "" : content);
  
  useEffect(() => {
    if (!isTyping) { setDisplayed(content); return; }
    let i = 0;
    const interval = setInterval(() => {
      i += 12; 
      if (i >= content.length) { setDisplayed(content); clearInterval(interval); onComplete(); } 
      else { setDisplayed(content.slice(0, i)); }
    }, 10);
    return () => clearInterval(interval);
  }, [content, isTyping, onComplete]);

  return (
    <div className="prose prose-slate max-w-none text-[14px] leading-relaxed">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkMath]} 
        rehypePlugins={[rehypeKatex]}
      >
        {displayed}
      </ReactMarkdown>
    </div>
  );
});
TypewriterMarkdown.displayName = "TypewriterMarkdown";

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function AgentPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const [activeAgent, setActiveAgent] = useState("core");
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [chatInput, setChatInput] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Edit State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) setIsSidebarCollapsed(true);
      const savedAgent = localStorage.getItem("nova_active_agent");
      if (savedAgent && AGENTS.some(a => a.id === savedAgent)) {
        setActiveAgent(savedAgent);
      }
    }
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUser(data.user); });
    fetchSessions();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, typingMessageId]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node)) setIsAgentMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleAgentChange = (id: string) => {
    setActiveAgent(id);
    localStorage.setItem("nova_active_agent", id);
    setIsAgentMenuOpen(false);
    setFormData({}); 
  };

  const fetchSessions = async () => {
    const { data } = await supabase.from('chat_sessions').select('id, title, updated_at').order('updated_at', { ascending: false });
    if (data) setSessions(data);
    if (data && data.length > 0 && !sessionId) loadSession(data[0].id);
    else if (!sessionId) createNewSession();
  };

  const loadSession = async (id: string) => {
    setSessionId(id);
    const { data } = await supabase.from('chat_messages').select('*').eq('session_id', id).order('created_at', { ascending: true });
    if (data) setMessages(data.map(m => ({ id: m.id, role: m.role, content: m.content, sources: m.sources, agentId: m.agentId })));
    if (window.innerWidth < 768) setIsSidebarCollapsed(true);
  };

  const createNewSession = async () => {
    const { data } = await supabase.from('chat_sessions').insert({ title: 'New Workspace Session' }).select().single();
    if (data) { setSessionId(data.id); setMessages([]); fetchSessions(); }
    if (window.innerWidth < 768) setIsSidebarCollapsed(true);
  };

  const deleteSession = async (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== idToDelete));
    await supabase.from('chat_messages').delete().eq('session_id', idToDelete);
    await supabase.from('chat_sessions').delete().eq('id', idToDelete);
    if (sessionId === idToDelete) {
      const remaining = sessions.filter(s => s.id !== idToDelete);
      if (remaining.length > 0) loadSession(remaining[0].id);
      else createNewSession();
    }
  };

  const handleChatSubmit = async (e?: React.FormEvent, isFormSubmit: boolean = false) => {
    if (e) e.preventDefault();
    if (isLoading || !sessionId) return;

    let userMessage = "";

    if (isFormSubmit) {
      const currentAgentDefs = AGENTS.find(a => a.id === activeAgent)?.fields || [];
      if (activeAgent === "core") {
        userMessage = formData["query"] || "";
      } else {
        userMessage = currentAgentDefs.map(field => {
          const val = formData[field.name];
          return val ? `**${field.label}:** ${val}` : null;
        }).filter(Boolean).join("\n\n"); 
      }
      setFormData({});
    } else {
      userMessage = chatInput.trim();
      setChatInput("");
    }

    if (!userMessage.trim()) return;

    setIsLoading(true);
    const newMessages = [...messages, { id: Date.now().toString(), role: "user" as const, content: userMessage }];
    setMessages(newMessages);

    try {
      const response = await chatWithMultiAgent(userMessage, sessionId, activeAgent);
      const newMessageId = (Date.now() + 1).toString();
      
      setMessages([...newMessages, { 
        id: newMessageId, role: "assistant", content: response.content, sources: response.sources, agentId: activeAgent 
      }]);
      setTypingMessageId(newMessageId); 
      fetchSessions();
    } catch (error) {
      setMessages([...newMessages, { id: Date.now().toString(), role: "assistant", content: "System error: Failed to connect to agent services." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- EDIT AND REGENERATE LOGIC ---
  const handleEditSubmit = async (index: number) => {
    if (!editValue.trim() || isLoading || !sessionId) return;
    
    const newText = editValue.trim();
    setEditingIndex(null);
    setIsLoading(true);

    try {
      // 1. Fetch exact DB IDs to reliably delete subsequent messages
      const { data: dbMessages } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (dbMessages && dbMessages.length > index) {
        const idsToDelete = dbMessages.slice(index).map(m => m.id);
        await supabase.from('chat_messages').delete().in('id', idsToDelete);
      }

      // 2. Optimistically update local state
      const truncatedHistory = messages.slice(0, index);
      const newMessages = [...truncatedHistory, { id: Date.now().toString(), role: "user" as const, content: newText }];
      setMessages(newMessages);

      // 3. Trigger Agent
      const response = await chatWithMultiAgent(newText, sessionId, activeAgent);
      const newMessageId = (Date.now() + 1).toString();
      
      setMessages([...newMessages, { 
        id: newMessageId, role: "assistant", content: response.content, sources: response.sources, agentId: activeAgent 
      }]);
      setTypingMessageId(newMessageId); 
      fetchSessions();

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "System error during regeneration." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentAgent = getAgentDetails(activeAgent);
  const filteredSessions = sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!sessionId) return <div className="flex-1 h-[100dvh] bg-slate-50" />; 

  return (
    <div className="absolute inset-0 flex bg-slate-50 text-slate-900 overflow-hidden font-sans selection:bg-blue-100">
      
      {/* PROFESSIONAL OVERRIDES + LATEX STYLING */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
        
        .prose pre { background-color: #f8fafc; border: 1px solid #e2e8f0; color: #0f172a; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 12px 0; }
        .prose code { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 4px; border-radius: 4px; font-size: 13px; color: #0f172a; }
        
        .prose table { width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #e2e8f0; font-size: 13px; }
        .prose th { background-color: #f8fafc; padding: 10px 16px; text-align: left; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #475569; }
        .prose td { padding: 10px 16px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
        .prose tr:last-child td { border-bottom: none; }

        /* Ensure KaTeX display equations scroll instead of overflowing */
        .prose .math-display { overflow-x: auto; overflow-y: hidden; padding: 8px 0; }
        .prose .katex { font-size: 1.05em; }

        /* Hide native date picker icon to keep it clean */
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; transition: 0.2s; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
      `}} />

      {/* MOBILE OVERLAY */}
      {!isSidebarCollapsed && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/20 transition-opacity" onClick={() => setIsSidebarCollapsed(true)} />
      )}

      {/* SIDEBAR */}
      <aside className={cn(
        "absolute md:relative inset-y-0 left-0 z-50 flex flex-col h-full bg-[#f8f9fa] border-r border-slate-200 transition-all duration-200 ease-in-out shrink-0 shadow-2xl md:shadow-none",
        isSidebarCollapsed ? "-translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-transparent" : "translate-x-0 w-[260px]"
      )}>
        <div className="flex items-center justify-between px-4 h-[56px] shrink-0 border-b border-slate-200 bg-white">
           <div className="flex items-center gap-2.5 cursor-pointer">
              <Box className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-[14px] text-slate-800">Workspace</span>
           </div>
           <button onClick={() => setIsSidebarCollapsed(true)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
             <PanelLeftClose className="w-4 h-4" />
           </button>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f8f9fa]">
           <div className="p-3 shrink-0">
              <button onClick={createNewSession} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md transition-all text-[13px] font-semibold shadow-sm mb-3">
                 <Plus className="w-3.5 h-3.5" /> New Chat
              </button>
              
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-[13px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm"
                />
              </div>
           </div>

           <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">History</div>
           <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar space-y-0.5">
              {filteredSessions.map(session => (
                 <div 
                   key={session.id} onClick={() => loadSession(session.id)}
                   className={cn(
                     "group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-[13px] transition-all border",
                     sessionId === session.id ? "bg-white border-slate-200 shadow-sm text-slate-900 font-medium" : "border-transparent text-slate-600 hover:bg-slate-200/50"
                   )}
                 >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", sessionId === session.id ? "text-blue-600" : "text-slate-400")} />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <button onClick={(e) => deleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-colors" title="Delete Chat">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                 </div>
              ))}
           </div>
        </div>
        
        <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-white shrink-0">
           <div className="flex items-center gap-2.5 overflow-hidden">
             <Avatar className="w-8 h-8 rounded-md shadow-sm border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                <AvatarFallback className="bg-slate-50"><User className="w-3.5 h-3.5 text-slate-400" /></AvatarFallback>
             </Avatar>
             <div className="flex flex-col overflow-hidden">
                <span className="text-[13px] font-semibold text-slate-800 truncate">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User"}
                </span>
             </div>
           </div>
           <button className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors shrink-0">
             <Settings className="w-4 h-4" />
           </button>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-white">
        
        {/* HEADER */}
        <header className="h-[56px] flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            {isSidebarCollapsed && (
              <button onClick={() => setIsSidebarCollapsed(false)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors mr-1">
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            
            <div className="relative" ref={agentMenuRef}>
              <button 
                onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-all text-[13px] font-medium shadow-sm"
              >
                <span className={cn("flex items-center gap-1.5 font-semibold", currentAgent.color)}>
                  <currentAgent.icon className="w-3.5 h-3.5" />
                  {currentAgent.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isAgentMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-[260px] bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-[100]">
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">Select Agent</div>
                  <div className="flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {AGENTS.map(agent => (
                      <button 
                        key={agent.id}
                        onClick={() => handleAgentChange(agent.id)}
                        className={cn(
                          "flex items-start gap-3 px-3 py-2 transition-all text-left group",
                          activeAgent === agent.id ? "bg-blue-50/50" : "hover:bg-slate-50"
                        )}
                      >
                        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-transparent", activeAgent === agent.id ? "bg-white border-blue-100 shadow-sm" : "bg-slate-50")}>
                          <agent.icon className={cn("w-3.5 h-3.5", agent.color)} />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-semibold text-slate-800">{agent.name}</span>
                          <span className="text-[11px] text-slate-500 line-clamp-1">{agent.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* MESSAGE FEED */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 custom-scrollbar min-h-0 relative bg-white">
          <div className="max-w-3xl mx-auto py-8 flex flex-col justify-end min-h-full">
            
            {messages.length === 0 && !isLoading ? (
              // ==========================================
              // CLEAN ENTERPRISE INITIAL STATE
              // ==========================================
              <div className="flex flex-col items-center justify-center w-full my-auto pb-10">
                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mb-4">
                  <currentAgent.icon className={cn("w-6 h-6", currentAgent.color)} />
                </div>
                <h2 className="text-[18px] font-semibold text-slate-800 mb-1">
                  {currentAgent.name} Agent
                </h2>
                <p className="text-[13px] text-slate-500 mb-8 max-w-[400px] text-center">
                  {currentAgent.desc}
                </p>

                {/* FORM LAYOUT */}
                <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm p-5 sm:p-6">
                  <form onSubmit={(e) => handleChatSubmit(e, true)} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentAgent.fields.map((field) => (
                        <div key={field.name} className={cn("flex flex-col gap-1.5", field.colSpan === 2 ? "col-span-1 sm:col-span-2" : "col-span-1")}>
                          <label className="text-[12px] font-semibold text-slate-700">{field.label}</label>
                          
                          {field.type === 'select' ? (
                            <CustomSelect
                              value={formData[field.name] || ""}
                              onChange={(val) => setFormData({ ...formData, [field.name]: val })}
                              options={field.options || []}
                              placeholder="Select..."
                              disabled={isLoading}
                            />
                          ) : field.type === 'date' ? (
                            <input
                              type="date"
                              value={formData[field.name] || ""}
                              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                              disabled={isLoading}
                              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
                            />
                          ) : field.type === 'textarea' ? (
                            <textarea
                              value={formData[field.name] || ""}
                              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(e, true); } }}
                              placeholder={field.placeholder}
                              disabled={isLoading}
                              rows={field.name === 'query' ? 3 : 2}
                              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none shadow-sm custom-scrollbar"
                            />
                          ) : (
                            <input
                              type="text"
                              value={formData[field.name] || ""}
                              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                              placeholder={field.placeholder}
                              disabled={isLoading}
                              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-3 border-t border-slate-100 mt-2">
                      <button 
                        type="submit" 
                        disabled={Object.values(formData).every(v => !v.trim()) || isLoading}
                        className="px-4 py-2 bg-slate-900 text-white rounded-md text-[13px] font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        Submit Request
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              // ==========================================
              // STANDARD FLAT CHAT UI
              // ==========================================
              <div className="space-y-8 pb-4">
                {messages.map((msg, index) => {
                  // Determine which agent icon/styling to use based on the message metadata
                  const msgAgent = getAgentDetails(msg.agentId || activeAgent);
                  
                  return (
                    <div key={msg.id} className={cn("flex flex-col gap-1 w-full group/message", msg.role === 'user' ? "items-end" : "items-start")}>
                      
                      {/* ASSISTANT HEADER */}
                      {msg.role === 'assistant' && (
                         <div className="flex items-center gap-1.5 mb-1 pl-1 opacity-80">
                            <msgAgent.icon className={cn("w-3.5 h-3.5", msgAgent.color)} />
                            <span className="text-[12px] font-semibold text-slate-600">{msgAgent.name}</span>
                         </div>
                      )}

                      {/* SLEEK SOURCE CARDS */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 max-w-full custom-scrollbar">
                          {msg.sources.map((src, i) => {
                            let domain = ""; try { domain = new URL(src.link).hostname; } catch(e) {}
                            return (
                              <a 
                                key={i} href={src.link} target="_blank" rel="noopener noreferrer" 
                                className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-blue-400 p-2 rounded-lg shadow-sm hover:shadow-md transition-all min-w-[200px] max-w-[260px] shrink-0"
                              >
                                <div className="w-7 h-7 rounded bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                  <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} className="w-4 h-4 object-contain" alt="" />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-[12px] font-semibold text-slate-800 truncate">{src.title}</span>
                                  <span className="text-[10px] text-slate-500 truncate">{domain.replace(/^www\./, '')}</span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex w-full items-start gap-3">
                         
                         {/* EDIT STATE FOR USER MESSAGES */}
                         {editingIndex === index ? (
                           <div className="w-full flex flex-col gap-2 max-w-2xl ml-auto border border-blue-200 bg-blue-50/30 p-3 rounded-lg shadow-sm">
                             <textarea 
                               value={editValue}
                               onChange={(e) => setEditValue(e.target.value)}
                               className="w-full bg-white border border-slate-300 rounded-md px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none custom-scrollbar min-h-[80px]"
                               autoFocus
                             />
                             <div className="flex justify-end gap-2 mt-1">
                               <button onClick={() => setEditingIndex(null)} className="px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">Cancel</button>
                               <button onClick={() => handleEditSubmit(index)} className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1.5 shadow-sm">
                                 <RefreshCw className="w-3.5 h-3.5" /> Save & Regenerate
                               </button>
                             </div>
                           </div>
                         ) : (
                           <div className={cn(
                             "px-4 py-3 rounded-lg text-[14px] leading-relaxed relative min-w-0 max-w-[90%] sm:max-w-[85%]", 
                             msg.role === 'user' 
                               ? "bg-slate-100 text-slate-900 ml-auto border border-slate-200" 
                               : "bg-white text-slate-800"
                           )}>
                             {msg.role === 'assistant' ? (
                               <TypewriterMarkdown 
                                 content={msg.content} 
                                 isTyping={typingMessageId === msg.id} 
                                 onComplete={() => setTypingMessageId(null)} 
                               />
                             ) : (
                               <div className="whitespace-pre-wrap">{msg.content}</div>
                             )}
                           </div>
                         )}
                      </div>

                      {/* ACTION BAR */}
                      {typingMessageId !== msg.id && !isLoading && editingIndex !== index && (
                        <div className={cn("flex items-center gap-1 mt-1 opacity-0 group-hover/message:opacity-100 transition-opacity", msg.role === 'user' ? "ml-auto pr-1" : "pl-1")}>
                          {msg.role === 'user' ? (
                            <button onClick={() => { setEditingIndex(index); setEditValue(msg.content); }} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1.5 text-[11px] font-medium">
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                          ) : (
                            <button onClick={() => handleCopy(msg.id, msg.content)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1.5 text-[11px] font-medium">
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} 
                              {copiedId === msg.id ? "Copied" : "Copy"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex gap-3 w-full items-center mt-2 pl-1">
                    <Loader2 className={cn("w-4 h-4 animate-spin", currentAgent.color)} />
                    <div className="text-slate-400 text-[13px] font-medium">
                      Generating response...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-6 shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            STANDARD CHAT INPUT (Only when active)
            ========================================== */}
        {messages.length > 0 && (
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 z-10">
            <form 
              onSubmit={(e) => handleChatSubmit(e, false)} 
              className="max-w-3xl mx-auto flex items-end w-full bg-white border border-slate-300 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all p-1 shadow-sm"
            >
              <button type="button" className="p-2.5 mb-0.5 ml-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors shrink-0">
                <Paperclip className="w-4 h-4" />
              </button>
              
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(e, false); } }}
                placeholder={`Message ${currentAgent.name}...`}
                disabled={isLoading}
                rows={1}
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[14px] text-slate-900 placeholder:text-slate-400 resize-none py-2.5 px-3 min-h-[44px] max-h-[200px] custom-scrollbar"
              />
              
              <button 
                type="submit" 
                disabled={!chatInput.trim() || isLoading}
                className="p-2 mb-0.5 mr-0.5 rounded-md transition-all flex items-center justify-center shrink-0 disabled:opacity-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:hover:bg-transparent disabled:hover:text-slate-500 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}