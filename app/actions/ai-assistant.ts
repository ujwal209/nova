"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchSerperResults } from "../actions/search";
import { fetchAutocomplete } from "../actions/autocomplete";
import { chatWithWorkspaceAgent, getUserProfile, logSearchQuery } from "../actions/workspace";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { 
  Search, Image as ImageIcon, Video, Newspaper, 
  ShoppingBag, ChevronLeft, ChevronRight,
  ArrowUp, X, PanelRightClose, PanelRightOpen,
  Library, Globe, Clock, Plus, Edit2, Copy, Check, ArrowRight, Sparkles, Bot, MessageSquare 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const supabase = createClient();

const CATEGORIES = [
  { id: "search", label: "All", icon: Search },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Video },
  { id: "news", label: "News", icon: Newspaper },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: any[];
}

function BrowserWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // User State
  const [user, setUser] = useState<any>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false); // CRITICAL FIX: Auth Race Condition Guard

  // Search State
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const centerSearchContainerRef = useRef<HTMLDivElement>(null);
  
  const [activeSearch, setActiveSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("search");
  const [currentPage, setCurrentPage] = useState(1);
  const [cache, setCache] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false); 
  const [chatWidth, setChatWidth] = useState(400); 
  const [isDragging, setIsDragging] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [chatHistoryVisible, setChatHistoryVisible] = useState(false);
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Auth
  useEffect(() => {
    if (window.innerWidth >= 1024) setIsChatOpen(true);
    setSessionId(crypto.randomUUID());
    
    const initApp = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data } = await supabase.from('workspace_sessions').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
        if (data) setSavedSessions(data);
      }
      setIsAuthLoaded(true); // Unlock URL execution
    };
    initApp();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) setShowSuggestions(false);
      if (centerSearchContainerRef.current && !centerSearchContainerRef.current.contains(event.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autocomplete
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2 && query !== activeSearch) {
        const data = await fetchAutocomplete(query);
        setSuggestions(data.map((item: any) => item.suggestion || item));
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }, 200); 
    return () => clearTimeout(timer);
  }, [query, activeSearch]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatLoading, isChatOpen]);

  // URL Sync Search (Guarded by isAuthLoaded)
  useEffect(() => {
    if (!isAuthLoaded) return; // CRITICAL: Wait for Supabase before making backend calls

    const urlQ = searchParams.get("q");
    const urlCat = searchParams.get("category") || "search";
    const urlPage = parseInt(searchParams.get("page") || "1", 10);

    if (urlQ) {
      setQuery(urlQ);
      setActiveSearch(urlQ);
      setActiveCategory(urlCat);
      setCurrentPage(urlPage);
      setHasSearched(true);
      executeSearch(urlQ, urlCat, urlPage);
      
      if (messages.length === 0 && !isChatLoading) {
        handleChatSubmit(`Research synthesis for: ${urlQ}`);
      }
    } else {
      setHasSearched(false);
      setResults(null);
    }
  }, [searchParams, isAuthLoaded]);

  const executeSearch = async (searchQuery: string, category: string, page: number) => {
    if (!searchQuery.trim()) return;
    
    // Safely logs with user ID because we waited for auth
    logSearchQuery(searchQuery, category, user?.id);

    const cacheKey = `${searchQuery.toLowerCase()}_${category}_${page}`;
    if (cache[cacheKey]) {
      setResults(cache[cacheKey]);
      return;
    }

    setLoadingSearch(true);
    try {
      const data = await fetchSerperResults(searchQuery, category, page);
      setCache((prev) => ({ ...prev, [cacheKey]: data }));
      setResults(data); 
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoadingSearch(false);
    }
  };

  const updateUrl = (newQuery: string, newCat: string, newPage: number) => {
    if (!newQuery.trim()) return;
    setShowSuggestions(false);
    setQuery(newQuery); 
    const params = new URLSearchParams();
    params.set("q", newQuery);
    params.set("category", newCat);
    params.set("page", newPage.toString());
    router.push(`/browser?${params.toString()}`);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateUrl(query, activeCategory, 1);
  };

  const handleSuggestionClick = (suggestion: string) => {
    updateUrl(suggestion, activeCategory, 1);
  };

  // --- CHAT LOGIC ---
  const loadPastSession = async (id: string) => {
    setIsChatLoading(true);
    setSessionId(id);
    const { data } = await supabase.from('workspace_messages').select('*').eq('session_id', id).order('created_at', { ascending: true });
    if (data) setMessages(data.map(m => ({ id: m.id, role: m.role, content: m.content, sources: m.sources })));
    setChatHistoryVisible(false);
    setIsChatLoading(false);
  };

  const handleChatSubmit = async (textOveride?: string) => {
    const queryToSend = textOveride || chatInput;
    if (!queryToSend.trim() || isChatLoading) return;
    if (!textOveride) setChatInput("");
    setIsChatOpen(true);
    setIsChatLoading(true);

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: queryToSend };
    setMessages(prev => [...prev, userMsg]);

    const { content, sources } = await chatWithWorkspaceAgent(queryToSend, sessionId, user?.id);

    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content, sources }]);
    setIsChatLoading(false);
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- DRAG RESIZER ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 350 && newWidth < window.innerWidth - 300) setChatWidth(newWidth);
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
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const WebResults = () => (
    <div className="flex flex-col gap-6 sm:gap-8 w-full animate-in fade-in duration-500">
      {results?.organic?.map((item: any, idx: number) => {
        let domain = "";
        try { domain = new URL(item.link).hostname; } catch(e) {}
        return (
          <div key={idx} className="flex flex-col gap-2 relative group max-w-2xl p-4 sm:p-5 rounded-3xl hover:bg-zinc-50/80 dark:hover:bg-zinc-900/30 border border-transparent hover:border-zinc-200/80 dark:hover:border-zinc-800/80 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
                <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="w-4 h-4 object-contain" />
              </div>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-[13px] sm:text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{domain.replace('www.', '')}</span>
                <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
                <span className="text-[12px] sm:text-[13px] text-zinc-500 dark:text-zinc-500 truncate hidden sm:inline font-medium">{item.link}</span>
              </div>
            </div>
            <a href={item.link} target="_blank" rel="noreferrer" className="w-fit">
              <h3 className="text-[18px] sm:text-[22px] font-black text-zinc-950 dark:text-zinc-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 tracking-tight leading-snug transition-colors duration-300">{item.title}</h3>
            </a>
            <p className="text-[14px] sm:text-[15px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">{item.snippet}</p>
          </div>
        );
      })}
    </div>
  );

  const ImageResults = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
      {results?.images?.map((item: any, idx: number) => (
        <a key={idx} href={item.link} target="_blank" rel="noreferrer" className="flex flex-col gap-2 group bg-white dark:bg-zinc-950 p-2 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="rounded-[1.2rem] overflow-hidden bg-zinc-100 dark:bg-zinc-900 aspect-square">
            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
          </div>
          <p className="text-[12px] sm:text-[13px] font-bold text-zinc-700 dark:text-zinc-300 line-clamp-2 px-1 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors">{item.title}</p>
        </a>
      ))}
    </div>
  );

  const VideoResults = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in duration-500">
      {results?.videos?.map((item: any, idx: number) => (
        <a key={idx} href={item.link} target="_blank" rel="noreferrer" className="flex flex-col gap-3 group bg-white dark:bg-zinc-950 p-3 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="relative rounded-[1.2rem] overflow-hidden bg-zinc-100 dark:bg-zinc-900 aspect-video">
            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
            {item.duration && (
              <span className="absolute bottom-3 right-3 bg-zinc-950/80 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-md shadow-sm">
                {item.duration}
              </span>
            )}
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300"></div>
          </div>
          <div className="px-1">
            <h3 className="text-[15px] sm:text-[17px] font-black text-zinc-950 dark:text-zinc-50 line-clamp-2 transition-colors leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {item.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] sm:text-[13px] text-zinc-500 dark:text-zinc-500 font-bold uppercase tracking-wide">
              <span>{item.source}</span>
              {item.date && <span>• {item.date}</span>}
            </div>
          </div>
        </a>
      ))}
    </div>
  );

  const NewsResults = () => (
    <div className="flex flex-col gap-6 max-w-3xl animate-in fade-in duration-500">
      {results?.news?.map((item: any, idx: number) => (
        <div key={idx} className="flex flex-col-reverse sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6 rounded-3xl hover:bg-zinc-50/80 dark:hover:bg-zinc-900/30 border border-transparent hover:border-zinc-200/80 dark:hover:border-zinc-800/80 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
          <div className="flex-1 flex flex-col gap-2 sm:gap-2.5">
            <div className="flex items-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wide">
              <span className="font-black text-zinc-900 dark:text-zinc-100">{item.source}</span>
              <span className="text-zinc-400 dark:text-zinc-600 font-bold">• {item.date}</span>
            </div>
            <a href={item.link} target="_blank" rel="noreferrer">
              <h3 className="text-[17px] sm:text-[22px] font-black text-zinc-950 dark:text-zinc-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-[1.3] transition-colors">
                {item.title}
              </h3>
            </a>
            <p className="text-[13px] sm:text-[15px] text-zinc-600 dark:text-zinc-400 line-clamp-3 font-medium leading-relaxed mt-1">
              {item.snippet}
            </p>
          </div>
          {item.imageUrl && (
            <div className="w-full sm:w-40 h-40 sm:h-32 rounded-2xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div 
      className="absolute inset-0 flex flex-col bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 overflow-hidden"
      style={{ fontFamily: "'Google Sans', 'Outfit', sans-serif" }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #27272a transparent;
        }
        .dark .custom-scrollbar {
          scrollbar-color: #52525b transparent;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; display: block; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #27272a; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #52525b; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* TOP WORKSPACE HEADER - Glassmorphic */}
      <header className="flex items-center justify-between p-3 sm:p-4 shrink-0 z-30 relative bg-white/70 dark:bg-[#09090b]/70 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50 h-16 sm:h-20">
        <div className="flex items-center gap-3 sm:gap-6 w-full max-w-5xl">
          {hasSearched && (
            <div className="flex-1 relative max-w-2xl" ref={searchContainerRef}>
              <form onSubmit={handleSearchSubmit}>
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  placeholder="Search the web..."
                  className="w-full rounded-full pl-12 pr-12 py-5 sm:py-6 bg-zinc-100/80 dark:bg-zinc-900/80 border-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-50 transition-all shadow-inner text-[15px] font-bold placeholder:font-medium placeholder:text-zinc-500"
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              </form>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-50 py-2 animate-in fade-in slide-in-from-top-2">
                  {suggestions.map((sug, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleSuggestionClick(sug)}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                    >
                      <Search className="w-4 h-4 text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors" />
                      <span className="text-[14px] sm:text-[15px] font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors">{sug}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 pl-2 ml-auto relative">
          <Button variant="outline" size="sm" onClick={() => setIsChatOpen(!isChatOpen)} className="text-zinc-950 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm font-bold rounded-full hidden sm:flex hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all shadow-sm">
            {isChatOpen ? "Close AI" : "Open AI"}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(!isChatOpen)} className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 h-10 w-10 rounded-full transition-colors sm:hidden">
            {isChatOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* MAIN WORKSPACE: SPLIT PANE */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 w-full">
        
        {/* LEFT PANE (Search Area) */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-[#09090b] min-h-0 min-w-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
          
          {hasSearched ? (
            <>
              {/* Category Tabs */}
              <div className="w-full border-b border-zinc-200/50 dark:border-zinc-800/50 px-2 sm:px-8 shrink-0 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md z-10 relative">
                <Tabs value={activeCategory} onValueChange={(v) => updateUrl(activeSearch, v, 1)} className="w-full max-w-3xl">
                  <TabsList className="bg-transparent h-14 sm:h-16 p-0 gap-6 sm:gap-10 flex w-full justify-start overflow-x-auto sm:overflow-visible hide-scrollbar ml-2 sm:ml-0">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <TabsTrigger key={cat.id} value={cat.id} className="relative rounded-none bg-transparent shadow-none px-1 py-4 text-[13px] sm:text-[14px] font-bold text-zinc-500 dark:text-zinc-400 data-[state=active]:text-zinc-950 dark:data-[state=active]:text-zinc-50 group cursor-pointer shrink-0 transition-colors">
                          <Icon className="w-4 h-4 mr-2 opacity-70 group-data-[state=active]:opacity-100 transition-opacity" />{cat.label}
                          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-zinc-950 dark:bg-zinc-50 rounded-t-full scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-300" />
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>
              </div>

              {/* SEARCH RESULTS SCROLL CONTAINER */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10 custom-scrollbar min-h-0 block relative z-10">
                {loadingSearch ? (
                  <div className="flex flex-col gap-10 max-w-3xl mt-4 animate-in fade-in duration-500">
                    {[1, 2, 3].map(i => (
                       <div key={i} className="space-y-4 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-900 bg-white/50 dark:bg-zinc-950/50">
                         <div className="flex items-center gap-3">
                           <Skeleton className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                           <Skeleton className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800" />
                         </div>
                         <Skeleton className="h-6 w-3/4 bg-zinc-200 dark:bg-zinc-800" />
                         <Skeleton className="h-16 w-full bg-zinc-200 dark:bg-zinc-800" />
                       </div>
                    ))}
                  </div>
                ) : (
                  <div className="pb-32 mt-4 max-w-4xl mx-auto xl:mx-0">
                    {results?.searchInformation && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-8 font-black uppercase tracking-widest pl-2">Page {currentPage} • {results.searchInformation.formattedTotalResults} results</p>}
                    {activeCategory === "search" && <WebResults />}
                    {activeCategory === "images" && <ImageResults />}
                    {activeCategory === "videos" && <VideoResults />}
                    {activeCategory === "news" && <NewsResults />}
                  </div>
                )}
              </div>
            </>
          ) : (
            // EXUBERANT CENTERED EMPTY STATE FOR SEARCH
            <div className="flex-1 overflow-y-auto bg-transparent custom-scrollbar min-h-0 block relative z-10">
              <div className="absolute left-0 right-0 top-1/4 -z-10 m-auto h-[300px] w-[300px] sm:h-[500px] sm:w-[500px] rounded-full bg-zinc-300/40 dark:bg-zinc-800/40 blur-[100px] sm:blur-[140px] pointer-events-none"></div>
              
              <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-12">
                <div className="flex flex-col items-center w-full max-w-3xl m-auto pb-10 shrink-0">
                   
                   <div className="inline-flex items-center rounded-full border border-zinc-200/80 dark:border-zinc-800/80 px-4 py-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-8 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-1000">
                     <Sparkles className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                     Deep Web Intelligence
                   </div>

                   <h1 className="text-5xl sm:text-7xl font-black tracking-tighter mb-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 text-center shrink-0 bg-gradient-to-br from-zinc-900 to-zinc-400 dark:from-zinc-50 dark:to-zinc-500 bg-clip-text text-transparent drop-shadow-sm pb-2">
                     Nova Deep Search
                   </h1>

                   <div className="w-full relative animate-in fade-in slide-in-from-bottom-8 duration-1000 shrink-0" ref={centerSearchContainerRef}>
                     <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
                       <Input 
                         type="text" 
                         value={query}
                         onChange={(e) => setQuery(e.target.value)}
                         onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                         placeholder="Ask anything..." 
                         className="w-full rounded-full pl-8 pr-16 py-9 text-lg sm:text-xl font-bold shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl focus-visible:ring-4 focus-visible:ring-zinc-900/10 dark:focus-visible:ring-zinc-100/10 transition-all placeholder:text-zinc-400 placeholder:font-medium hover:bg-white dark:hover:bg-zinc-950" 
                       />
                       <Button type="submit" disabled={!query.trim()} className="absolute right-3 rounded-full w-12 h-12 sm:w-14 sm:h-14 p-0 bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-md disabled:opacity-50 group">
                         <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" />
                       </Button>
                     </form>

                     {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-50 py-3 animate-in fade-in slide-in-from-top-4">
                        {suggestions.map((sug, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => handleSuggestionClick(sug)}
                            className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                          >
                            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors" />
                            <span className="text-[15px] sm:text-[16px] font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors">{sug}</span>
                          </div>
                        ))}
                      </div>
                    )}
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DRAG RESIZER */}
        {isChatOpen && (
          <div 
            onMouseDown={handleMouseDown}
            style={{ touchAction: 'none' }}
            className={`hidden md:block w-[1.5px] shrink-0 cursor-col-resize hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors z-30 ${isDragging ? 'bg-zinc-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}
          />
        )}

        {/* RIGHT PANE: AI CHAT */}
        {isChatOpen && (
          <div 
            style={{ '--chat-width': `${chatWidth}px` } as React.CSSProperties}
            className="absolute inset-0 z-50 md:relative flex flex-col bg-white dark:bg-[#09090b] shadow-2xl md:shadow-none border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right-full md:slide-in-from-right-0 duration-300 min-h-0 w-full md:w-[var(--chat-width)] shrink-0"
          >
            {/* Header with History Menu */}
            <div className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 border-b border-zinc-200/50 dark:border-zinc-800/50 shrink-0 bg-white/70 dark:bg-[#09090b]/70 backdrop-blur-xl relative z-20">
              <div className="flex items-center gap-2.5 font-bold text-[14px] sm:text-[15px] text-zinc-900 dark:text-zinc-50">
                <div className="w-6 h-6 rounded-md bg-zinc-950 dark:bg-zinc-50 flex items-center justify-center shadow-sm">
                  <Bot className="w-3.5 h-3.5 text-zinc-50 dark:text-zinc-950" />
                </div>
                Research Synthesis
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setChatHistoryVisible(!chatHistoryVisible)} className="h-8 w-8 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg relative transition-colors">
                  <Clock className="w-4.5 h-4.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} className="h-8 w-8 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Chat History Dropdown */}
              {chatHistoryVisible && (
                <div className="absolute top-full right-4 mt-2 w-[280px] sm:w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-50 p-3 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between px-3 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                    <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Recent Sessions</span>
                    <button onClick={() => { setSessionId(crypto.randomUUID()); setMessages([]); setChatHistoryVisible(false); }} className="text-[11px] font-bold text-zinc-950 dark:text-zinc-50 hover:underline flex items-center px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md transition-colors"><Plus className="w-3 h-3 mr-1"/> New</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                    {savedSessions.map(s => (
                      <button key={s.id} onClick={() => loadPastSession(s.id)} className="text-left px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-[13.5px] font-bold text-zinc-700 dark:text-zinc-300 truncate transition-colors flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 opacity-50 shrink-0" />
                        {s.title}
                      </button>
                    ))}
                    {savedSessions.length === 0 && <div className="text-center p-6 text-sm font-medium text-zinc-500">No recent sessions.</div>}
                  </div>
                </div>
              )}
            </div>

            {/* CHAT MESSAGES SCROLL CONTAINER */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar bg-zinc-50/30 dark:bg-[#09090b] min-h-0 block relative z-0">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>

              <div className="relative z-10 flex flex-col min-h-full justify-end pb-32">
                {messages.length === 0 && !isChatLoading && (
                  <div className="flex flex-col items-center justify-center text-center opacity-60 pb-10 my-auto">
                    <div className="w-14 h-14 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-zinc-200 dark:border-zinc-800"><Library className="w-6 h-6 text-zinc-900 dark:text-zinc-100" /></div>
                    <p className="text-[16px] font-black text-zinc-700 dark:text-zinc-300 tracking-tight">Synthesis Engine Idle.</p>
                    <p className="text-[13px] mt-1.5 font-semibold text-zinc-500">Execute a search to generate contextual analysis.</p>
                  </div>
                )}

                {messages.map((msg, index) => (
                  <div key={msg.id} className={cn("flex w-full mb-8 sm:mb-10", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    {msg.role === "user" ? (
                      <div className="bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 px-5 py-3.5 rounded-[1.5rem] rounded-br-sm max-w-[85%] text-[15px] font-medium shadow-md">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 w-full">
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="flex flex-wrap gap-2.5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                            {msg.sources.map((src, idx) => {
                              let d = ""; try { d = new URL(src.link).hostname; } catch(e) {}
                              return (
                                <a 
                                  key={idx} href={src.link} target="_blank" rel="noreferrer" 
                                  className="flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                >
                                  <div className="w-5 h-5 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                    <img src={src.favicon || `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(src.link)}`} alt="" className="w-3.5 h-3.5 rounded-sm mix-blend-multiply dark:mix-blend-normal" />
                                  </div>
                                  <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-950 dark:group-hover:text-white truncate max-w-[130px]">{src.title}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                        <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed text-[15px] font-medium">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex flex-col gap-5 w-full animate-in fade-in duration-500 pt-4">
                     <div className="flex gap-2.5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                       <Skeleton className="h-8 w-32 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                       <Skeleton className="h-8 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                     </div>
                     <div className="space-y-3.5">
                       <Skeleton className="h-4 w-full bg-zinc-200 dark:bg-zinc-800" />
                       <Skeleton className="h-4 w-[90%] bg-zinc-200 dark:bg-zinc-800" />
                       <Skeleton className="h-4 w-[60%] bg-zinc-200 dark:bg-zinc-800" />
                     </div>
                  </div>
                )}
                
                <div ref={chatBottomRef} className="h-1 shrink-0" />
              </div>
            </div>

            {/* STUNNING FLOATING INPUT BAR */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-white via-white dark:from-[#09090b] dark:via-[#09090b] to-transparent pointer-events-none z-20">
              <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-zinc-200/80 dark:border-zinc-700/80 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] focus-within:ring-4 focus-within:ring-zinc-900/10 dark:focus-within:ring-zinc-100/10 transition-all overflow-hidden pointer-events-auto">
                <form onSubmit={(e) => { e.preventDefault(); handleChatSubmit(); }} className="flex flex-col w-full">
                  <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
                    placeholder="Ask a follow-up..."
                    disabled={isChatLoading}
                    rows={1}
                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-[15px] font-bold placeholder:font-medium placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none py-5 px-6 min-h-[64px] max-h-[200px] custom-scrollbar text-zinc-950 dark:text-zinc-50"
                  />
                  <div className="flex justify-end p-2 pt-0 px-3 pb-3">
                    <Button type="submit" disabled={!chatInput.trim() || isChatLoading} className="h-10 w-10 p-0 rounded-2xl bg-zinc-950 dark:bg-zinc-50 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 disabled:opacity-40 transition-all shadow-md cursor-pointer group">
                      <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                    </Button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default function BrowserPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] w-full bg-white dark:bg-[#09090b]" />}>
      <BrowserWorkspace />
    </Suspense>
  );
}