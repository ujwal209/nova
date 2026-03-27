"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchSerperResults } from "./actions/search";
import { generateNovaResponse } from "./actions/chat";
import { scrapeAndSummarize } from "./actions/ai-assistant";
import { fetchAutocomplete } from "./actions/autocomplete";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Search, Image as ImageIcon, Video, Newspaper, 
  ShoppingBag, LayoutGrid, Settings, ChevronLeft, ChevronRight,
  MessageSquare, FileText, ArrowUp, X, PanelRightClose, PanelRightOpen,
  Library, Calendar as CalendarIcon, Table, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

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

function NovaWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search & Autocomplete State
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  const [activeSearch, setActiveSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("search");
  const [currentPage, setCurrentPage] = useState(1);
  const [cache, setCache] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Chat/Split Pane State
  const [isChatOpen, setIsChatOpen] = useState(false); 
  const [chatWidth, setChatWidth] = useState(600); 
  const [isDragging, setIsDragging] = useState(false);
  
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Apps Launcher Dropdown State
  const [showAppsMenu, setShowAppsMenu] = useState(false);
  const appsMenuRef = useRef<HTMLDivElement>(null);

  // Auto-open chat on desktop only on initial load
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setIsChatOpen(true);
    }
  }, []);

  // Handle outside clicks for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (appsMenuRef.current && !appsMenuRef.current.contains(event.target as Node)) {
        setShowAppsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- AUTOCOMPLETE LOGIC ---
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

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading, isChatOpen]);

  // Handle URL Sync for Search
  useEffect(() => {
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
      
      if (messages.length === 0) {
        handleChatSubmit(urlQ, true);
      }
    } else {
      setHasSearched(false);
      setResults(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-resize Textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [chatInput]);

  // --- RESIZE LOGIC (Desktop Only) ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 350 && newWidth < window.innerWidth - 300) {
        setChatWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // --- ACTIONS ---
  const executeSearch = async (searchQuery: string, category: string, page: number) => {
    if (!searchQuery.trim()) return;
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
    router.push(`/?${params.toString()}`);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateUrl(query, activeCategory, 1);
  };

  const handleSuggestionClick = (suggestion: string) => {
    updateUrl(suggestion, activeCategory, 1);
  };

  // --- CHAT LOGIC ---
  const handleChatSubmit = async (textOveride?: string, isInitialSearch = false) => {
    const queryToSend = textOveride || chatInput;
    if (!queryToSend.trim() || isChatLoading) return;

    if (!textOveride) setChatInput("");
    setIsChatOpen(true);
    setIsChatLoading(true);

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: queryToSend };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);

    const chatHistoryPayload = newHistory.filter(m => !isInitialSearch).map(m => ({ role: m.role, content: m.content }));
    
    const { answer, sources } = await generateNovaResponse(chatHistoryPayload, queryToSend) || { answer: "Error", sources: [] };

    const assistantMsg: ChatMessage = { 
      id: (Date.now() + 1).toString(), 
      role: "assistant", 
      content: answer,
      sources: sources
    };
    
    setMessages(prev => [...prev, assistantMsg]);
    setIsChatLoading(false);
  };

  const handleReadPage = async (url: string, title: string) => {
    setIsChatOpen(true);
    setIsChatLoading(true);

    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: "user", 
      content: `Extract detailed professional insights from: ${title}` 
    };
    setMessages(prev => [...prev, userMsg]);

    const summary = await scrapeAndSummarize(url);

    const assistantMsg: ChatMessage = { 
      id: (Date.now() + 1).toString(), 
      role: "assistant", 
      content: summary || "Content extraction failed."
    };
    
    setMessages(prev => [...prev, assistantMsg]);
    setIsChatLoading(false);
  };

  // --- RENDER HELPERS ---
  const WebResults = () => (
    <div className="flex flex-col gap-8 sm:gap-10 w-full animate-in fade-in duration-500">
      {results?.organic?.map((item: any, idx: number) => (
        <div key={idx} className="flex flex-col gap-1.5 relative group max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded flex items-center justify-center border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden shrink-0">
              <img src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(item.link)}`} alt="" className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-[13px] sm:text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate">{item.title.split(' - ')[0]}</span>
              <span className="text-zinc-400 dark:text-zinc-600 hidden sm:inline">•</span>
              <span className="text-[11px] sm:text-[13px] text-zinc-500 dark:text-zinc-400 truncate hidden sm:inline">{item.link}</span>
            </div>
          </div>
          <a href={item.link} target="_blank" rel="noreferrer" className="w-fit">
            <h3 className="text-[17px] sm:text-[22px] font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline mb-1 tracking-tight leading-snug">{item.title}</h3>
          </a>
          <p className="text-[13px] sm:text-[15px] text-[#4d5156] dark:text-[#bdc1c6] leading-relaxed mb-3">{item.snippet}</p>
          
          <button 
            onClick={() => handleReadPage(item.link, item.title)}
            className="flex items-center gap-2 w-fit text-[11px] sm:text-[13px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-50 dark:bg-[#1a1a1a] hover:bg-zinc-100 dark:hover:bg-[#2a2a2a] px-3 py-1.5 rounded-md transition-all border border-zinc-200 dark:border-zinc-800"
          >
            <Library className="w-3.5 h-3.5" /> Analyze Source
          </button>
        </div>
      ))}
    </div>
  );

  const ImageResults = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
      {results?.images?.map((item: any, idx: number) => (
        <a key={idx} href={item.link} target="_blank" rel="noreferrer" className="flex flex-col gap-2 group">
          <div className="rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 aspect-square shadow-sm border border-zinc-200 dark:border-zinc-800">
            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
          </div>
          <p className="text-[12px] sm:text-[13px] font-medium text-zinc-600 dark:text-zinc-400 line-clamp-2 group-hover:underline group-hover:text-zinc-900 dark:group-hover:text-zinc-100">{item.title}</p>
        </a>
      ))}
    </div>
  );

  const VideoResults = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in duration-500">
      {results?.videos?.map((item: any, idx: number) => (
        <a key={idx} href={item.link} target="_blank" rel="noreferrer" className="flex flex-col gap-3 group">
          <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 aspect-video shadow-sm border border-zinc-200 dark:border-zinc-800">
            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            {item.duration && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-md">
                {item.duration}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-[14px] sm:text-[16px] font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-[#1a0dab] dark:group-hover:text-[#8ab4f8] transition-colors leading-snug">
              {item.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-[11px] sm:text-[13px] text-zinc-500">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.source}</span>
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
        <div key={idx} className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-5 p-3 sm:p-5 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all">
          <div className="flex-1 flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2 text-[11px] sm:text-[13px]">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.source}</span>
              <span className="text-zinc-500">• {item.date}</span>
            </div>
            <a href={item.link} target="_blank" rel="noreferrer" className="group">
              <h3 className="text-[16px] sm:text-[20px] font-medium text-[#1a0dab] dark:text-[#8ab4f8] group-hover:underline leading-snug">
                {item.title}
              </h3>
            </a>
            <p className="text-[13px] sm:text-[15px] text-[#4d5156] dark:text-[#bdc1c6] line-clamp-3">
              {item.snippet}
            </p>
          </div>
          {item.imageUrl && (
            <div className="w-full sm:w-32 h-32 sm:h-24 rounded-lg overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800">
              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const ShoppingResults = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 animate-in fade-in duration-500">
      {results?.shopping?.map((item: any, idx: number) => (
        <a key={idx} href={item.link} target="_blank" rel="noreferrer" className="flex flex-col gap-2 sm:gap-3 group p-2.5 sm:p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all">
          <div className="rounded-xl overflow-hidden bg-white aspect-square p-2 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
            <img src={item.imageUrl} alt={item.title} className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300" />
          </div>
          <div className="flex flex-col gap-0.5 sm:gap-1">
            <h3 className="text-[12px] sm:text-[13px] font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:underline leading-snug">
              {item.title}
            </h3>
            <span className="text-[15px] sm:text-[16px] font-bold text-zinc-900 dark:text-zinc-100 mt-1">{item.price}</span>
            <span className="text-[10px] sm:text-[11px] text-zinc-500">{item.source}</span>
          </div>
        </a>
      ))}
    </div>
  );

  return (
    <div 
      className="flex flex-col h-[100dvh] bg-white dark:bg-[#111111] text-zinc-900 dark:text-zinc-100 overflow-hidden"
      style={{ fontFamily: "'Google Sans', 'Product Sans', sans-serif" }}
    >
      
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap');
        
        /* Fallback if Google Sans is not installed locally */
        @font-face {
          font-family: 'Google Sans';
          src: local('Google Sans'), local('Product Sans'), url('https://fonts.gstatic.com/s/productsans/v5/HYvgU2fE2nRJvZ5JFAumwegdm0LZdjqr5-oayXSOefg.woff2') format('woff2');
        }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; display: none; }
        @media (min-width: 768px) { .custom-scrollbar::-webkit-scrollbar { display: block; } }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.6); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* TOP NAVBAR */}
      <header className="flex items-center justify-between p-2.5 sm:p-3.5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 bg-white dark:bg-[#111111] z-30 relative">
        <div className="flex items-center gap-2 sm:gap-6 w-full max-w-5xl">
          <div className="text-lg sm:text-2xl font-bold tracking-tight cursor-pointer px-1 sm:px-2 text-zinc-900 dark:text-white flex items-center gap-2" onClick={() => router.push('/')}>
            Nova
          </div>
          
          {/* SEARCH BAR WITH AUTOCOMPLETE */}
          <div className="flex-1 relative max-w-2xl" ref={searchContainerRef}>
            <form onSubmit={handleSearchSubmit}>
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Search or ask Nova..."
                className="w-full rounded-full pl-4 sm:pl-5 pr-10 sm:pr-12 py-2 sm:py-5 bg-zinc-100/80 dark:bg-[#1f1f1f] border-transparent focus-visible:ring-1 focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700 transition-all shadow-none text-[14px] sm:text-[15px]"
              />
              <Search className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            </form>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1f1f1f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 py-2">
                {suggestions.map((sug, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleSuggestionClick(sug)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                  >
                    <Search className="w-4 h-4 text-zinc-400" />
                    <span className="text-[13px] sm:text-[15px] font-medium text-zinc-700 dark:text-zinc-200">{sug}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-3 pl-1 relative">
          <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(!isChatOpen)} className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1f1f1f] h-8 w-8 sm:h-10 sm:w-10">
            {isChatOpen ? <PanelRightClose className="w-4 h-4 sm:w-5 sm:h-5" /> : <PanelRightOpen className="w-4 h-4 sm:w-5 sm:h-5" />}
          </Button>
          <Settings className="hidden sm:block w-5 h-5 text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" />
          
          {/* APPS EXTENSION LAUNCHER - VISIBLE ON MOBILE */}
          <div ref={appsMenuRef} className="relative">
            <div 
              onClick={() => setShowAppsMenu(!showAppsMenu)}
              className="flex p-1.5 sm:p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-[#1f1f1f] cursor-pointer transition-colors"
            >
              <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600 dark:text-zinc-400" />
            </div>

            {/* Dropdown Menu - Adjusted for Mobile Width */}
            {showAppsMenu && (
              <div className="absolute top-full right-0 mt-2 sm:mt-3 w-[280px] sm:w-80 bg-white dark:bg-[#1c1c1c] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 p-3 sm:p-4">
                <div className="grid grid-cols-3 gap-y-5 sm:gap-y-6 gap-x-2">
                  <div onClick={() => { setShowAppsMenu(false); document.querySelector('input')?.focus(); }} className="flex flex-col items-center gap-2 cursor-pointer group">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                      <Search className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-medium text-zinc-600 dark:text-zinc-400">Search</span>
                  </div>
                  <div onClick={() => router.push('/docs')} className="flex flex-col items-center gap-2 cursor-pointer group">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-medium text-zinc-600 dark:text-zinc-400">Docs</span>
                  </div>
                  <div onClick={() => router.push('/sheets')} className="flex flex-col items-center gap-2 cursor-pointer group">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/40 transition-colors">
                      <Table className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-medium text-zinc-600 dark:text-zinc-400">Sheets</span>
                  </div>
                  <div onClick={() => router.push('/calendar')} className="flex flex-col items-center gap-2 cursor-pointer group">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                      <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-medium text-zinc-600 dark:text-zinc-400">Calendar</span>
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-center">
                  <button className="text-[12px] sm:text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline">More from Nova</button>
                </div>
              </div>
            )}
          </div>

          <Avatar className="w-6 h-6 sm:w-8 sm:h-8 cursor-pointer ml-1 ring-2 ring-transparent hover:ring-zinc-200 dark:hover:ring-zinc-700 transition-all">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>UV</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* MAIN WORKSPACE: SPLIT PANE */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANE: SEARCH RESULTS OR BEAUTIFUL EMPTY STATE */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-[#111111]">
          {hasSearched ? (
            <>
              <div className="w-full border-b border-zinc-200 dark:border-zinc-800/60 px-2 sm:px-8 shrink-0 bg-white/95 dark:bg-[#111111]/95 backdrop-blur-md z-10 overflow-x-auto hide-scrollbar">
                <Tabs value={activeCategory} onValueChange={(v) => updateUrl(activeSearch, v, 1)} className="w-full max-w-3xl">
                  <TabsList className="bg-transparent h-10 sm:h-14 p-0 gap-4 sm:gap-8 flex w-max ml-2 sm:ml-0">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <TabsTrigger key={cat.id} value={cat.id} className="relative rounded-none bg-transparent shadow-none px-1 py-2 sm:py-4 text-[12px] sm:text-[14px] font-medium text-zinc-500 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 group">
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 opacity-70 group-data-[state=active]:opacity-100" />{cat.label}
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] sm:h-[3px] bg-zinc-900 dark:bg-zinc-100 rounded-t-full scale-x-0 group-data-[state=active]:scale-x-100 transition-transform" />
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-8 custom-scrollbar">
                {loadingSearch ? (
                  <div className="flex flex-col gap-8 sm:gap-10 max-w-2xl">
                    {[1, 2, 3].map(i => (
                       <div key={i} className="space-y-3 sm:space-y-4"><Skeleton className="h-4 sm:h-5 w-2/3" /><Skeleton className="h-14 sm:h-16 w-full" /></div>
                    ))}
                  </div>
                ) : (
                  <div className="pb-32">
                    {results?.searchInformation && <p className="text-[11px] sm:text-[13px] text-zinc-500 mb-5 sm:mb-8 font-medium">Page {currentPage} • {results.searchInformation.formattedTotalResults} results</p>}
                    
                    {/* DYNAMIC CATEGORY RENDERING */}
                    {activeCategory === "search" && <WebResults />}
                    {activeCategory === "images" && <ImageResults />}
                    {activeCategory === "videos" && <VideoResults />}
                    {activeCategory === "news" && <NewsResults />}
                    {activeCategory === "shopping" && <ShoppingResults />}
                    
                    {results && (results.organic || results.images || results.videos || results.news || results.shopping) && (
                      <div className="flex items-center gap-3 sm:gap-4 mt-10 sm:mt-16 pt-5 sm:pt-8 border-t border-zinc-200 dark:border-zinc-800/60 max-w-2xl">
                        <Button variant="outline" size="sm" onClick={() => updateUrl(activeSearch, activeCategory, currentPage - 1)} disabled={currentPage === 1} className="text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 h-8 sm:h-9 text-[12px] sm:text-sm"><ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" /> <span className="hidden sm:inline">Prev</span></Button>
                        <span className="text-[12px] sm:text-[13px] font-medium text-zinc-600 dark:text-zinc-400">Page {currentPage}</span>
                        <Button variant="outline" size="sm" onClick={() => updateUrl(activeSearch, activeCategory, currentPage + 1)} className="text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 h-8 sm:h-9 text-[12px] sm:text-sm"><span className="hidden sm:inline">Next</span> <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:ml-1" /></Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            // ==========================================
            // INSANE BEAUTIFUL EMPTY STATE REDESIGN
            // ==========================================
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12 relative overflow-y-auto custom-scrollbar bg-white dark:bg-[#111111]">
              
              {/* Atmospheric Gradient Background Effects */}
              <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 dark:bg-blue-500/15 blur-[80px] sm:blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 dark:bg-indigo-500/15 blur-[80px] sm:blur-[120px] rounded-full pointer-events-none" />
              
              <div className="z-10 flex flex-col items-center text-center max-w-4xl w-full my-auto pb-10">
                
                {/* Intro Pill */}


                {/* Hero Text */}
                <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500 dark:from-white dark:via-zinc-300 dark:to-zinc-500 mb-3 sm:mb-6 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-150 leading-[1.15]">
                  What will you create today?
                </h1>

                <p className="text-[14px] sm:text-[18px] md:text-[20px] text-zinc-500 dark:text-zinc-400 mb-8 sm:mb-16 max-w-[280px] sm:max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 leading-relaxed font-medium">
                  Your intelligent, unified workspace for deep research, powerful documentation, and seamless planning.
                </p>

                {/* Quick Action Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 px-2 sm:px-0">
                  
                  {/* Action 1: Search */}
                  <div 
                    onClick={() => document.querySelector('input')?.focus()}
                    className="flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-0 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1a1a1a] border border-zinc-200/80 dark:border-zinc-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] dark:hover:bg-[#1f1f1f] transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-[14px] sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center sm:mb-5 group-hover:scale-110 transition-transform duration-300">
                      <Search className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div className="flex flex-col text-left">
                      <h3 className="text-[15px] sm:text-[17px] font-bold text-zinc-900 dark:text-zinc-100 mb-0.5 sm:mb-1.5">Deep Search</h3>
                      <p className="text-[13px] sm:text-[14px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">Ask questions or find resources across the web.</p>
                    </div>
                  </div>

                  {/* Action 2: Docs */}
                  <div 
                    onClick={() => router.push('/docs')}
                    className="flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-0 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1a1a1a] border border-zinc-200/80 dark:border-zinc-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] dark:hover:bg-[#1f1f1f] transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-[14px] sm:rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center sm:mb-5 group-hover:scale-110 transition-transform duration-300">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col text-left">
                      <h3 className="text-[15px] sm:text-[17px] font-bold text-zinc-900 dark:text-zinc-100 mb-0.5 sm:mb-1.5">Write Docs</h3>
                      <p className="text-[13px] sm:text-[14px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">Draft essays, notes, and beautiful documents.</p>
                    </div>
                  </div>

                  {/* Action 3: Sheets */}
                  <div 
                    onClick={() => router.push('/sheets')}
                    className="flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-0 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1a1a1a] border border-zinc-200/80 dark:border-zinc-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] dark:hover:bg-[#1f1f1f] transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-[14px] sm:rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center sm:mb-5 group-hover:scale-110 transition-transform duration-300">
                      <Table className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex flex-col text-left">
                      <h3 className="text-[15px] sm:text-[17px] font-bold text-zinc-900 dark:text-zinc-100 mb-0.5 sm:mb-1.5">Analyze Data</h3>
                      <p className="text-[13px] sm:text-[14px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">Build spreadsheets and process complex datasets.</p>
                    </div>
                  </div>

                  {/* Action 4: Calendar */}
                  <div 
                    onClick={() => router.push('/calendar')}
                    className="flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-0 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1a1a1a] border border-zinc-200/80 dark:border-zinc-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] dark:hover:bg-[#1f1f1f] transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-[14px] sm:rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center sm:mb-5 group-hover:scale-110 transition-transform duration-300">
                      <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex flex-col text-left">
                      <h3 className="text-[15px] sm:text-[17px] font-bold text-zinc-900 dark:text-zinc-100 mb-0.5 sm:mb-1.5">Plan Schedule</h3>
                      <p className="text-[13px] sm:text-[14px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">Organize your time and manage upcoming events.</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>

        {/* DRAG RESIZER (Desktop Only) */}
        {isChatOpen && (
          <div 
            onMouseDown={handleMouseDown}
            className={`hidden md:block w-[1px] shrink-0 cursor-col-resize hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors z-30 ${isDragging ? 'bg-zinc-400 dark:bg-zinc-600' : 'bg-zinc-200 dark:bg-zinc-800'}`}
          />
        )}

        {/* RIGHT PANE: ULTRA PROFESSIONAL AI CHAT (Overlay on mobile, Split on Desktop) */}
        {isChatOpen && (
          <div 
            style={{ '--chat-width': `${chatWidth}px` } as React.CSSProperties}
            className="absolute inset-0 z-50 md:static md:z-auto w-full md:w-[var(--chat-width)] shrink-0 flex flex-col bg-[#fdfdfd] dark:bg-[#161616] h-full shadow-2xl md:shadow-[-10px_0_30px_rgba(0,0,0,0.03)] dark:md:shadow-[-10px_0_30px_rgba(0,0,0,0.2)] animate-in slide-in-from-right-full md:slide-in-from-right-0 duration-300"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-4 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 bg-white/50 dark:bg-[#161616]/50 backdrop-blur-md">
              <div className="flex items-center gap-2 font-semibold text-[13px] sm:text-[15px] text-zinc-800 dark:text-zinc-200">
                <Library className="w-4 h-4 text-zinc-500" /> Research Synthesis
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} className="h-7 w-7 sm:h-8 sm:w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-8 flex flex-col gap-5 sm:gap-10 pb-40 sm:pb-48 custom-scrollbar">
              {messages.length === 0 && !isChatLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 px-4">
                  <Library className="w-7 h-7 sm:w-8 sm:h-8 mb-3 sm:mb-4 opacity-50" />
                  <p className="text-[13px] sm:text-[15px] font-medium text-zinc-600 dark:text-zinc-400">Synthesis Engine Idle.</p>
                  <p className="text-[12px] sm:text-[14px] mt-1 opacity-70">Execute a search to generate contextual analysis.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-bottom-2">
                  
                  {/* User Message */}
                  {msg.role === "user" ? (
                    <div className="self-end bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3.5 sm:px-5 py-2 sm:py-3 rounded-[18px] sm:rounded-2xl rounded-tr-sm max-w-[92%] md:max-w-[85%] text-[13px] sm:text-[15px] font-medium leading-relaxed">
                      {msg.content}
                    </div>
                  ) : (
                    
                    /* Assistant Message */
                    <div className="flex flex-col gap-3 sm:gap-5 w-full bg-transparent">
                      
                      {/* Avatar Pills for Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 border-b border-zinc-200 dark:border-zinc-800/60">
                          {msg.sources.map((src, idx) => (
                            <a 
                              key={idx} 
                              href={src.link} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-white dark:bg-[#202020] border border-zinc-200 dark:border-zinc-700/80 rounded hover:border-zinc-400 dark:hover:border-zinc-500 transition-all group"
                            >
                              <img src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(src.link)}`} alt="" className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm bg-white" />
                              <span className="text-[10px] sm:text-[12px] font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate max-w-[80px] sm:max-w-[120px]">{src.domain}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Markdown Parsing Component */}
                      <div className="prose prose-sm sm:prose-zinc dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal text-[14px] sm:text-[15px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading State */}
              {isChatLoading && (
                <div className="flex flex-col gap-4 w-full bg-transparent animate-pulse pt-2 sm:pt-4">
                   <div className="flex gap-2 pb-2 sm:pb-3 border-b border-zinc-200 dark:border-zinc-800/60">
                     <Skeleton className="h-4 sm:h-6 w-16 sm:w-24 rounded" />
                     <Skeleton className="h-4 sm:h-6 w-12 sm:w-20 rounded" />
                   </div>
                   <div className="space-y-2.5 sm:space-y-4">
                     <Skeleton className="h-2.5 sm:h-4 w-full" />
                     <Skeleton className="h-2.5 sm:h-4 w-[90%]" />
                     <Skeleton className="h-2.5 sm:h-4 w-[95%]" />
                     <Skeleton className="h-2.5 sm:h-4 w-[60%]" />
                   </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* PROFESSIONAL TEXTAREA PROMPT BAR */}
            <div className="absolute bottom-0 w-full p-3 sm:p-6 bg-gradient-to-t from-[#fdfdfd] via-[#fdfdfd] to-transparent dark:from-[#161616] dark:via-[#161616]">
              <div className="bg-white dark:bg-[#1f1f1f] border border-zinc-200 dark:border-zinc-700/80 rounded-xl shadow-[0_2px_15px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_15px_rgba(0,0,0,0.2)] focus-within:border-zinc-400 dark:focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-100 dark:focus-within:ring-zinc-800/50 transition-all">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleChatSubmit(); }} 
                  className="relative flex flex-col w-full"
                >
                  <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit();
                      }
                    }}
                    placeholder="Ask follow-up..."
                    disabled={isChatLoading}
                    rows={1}
                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-[13px] sm:text-[15px] placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none py-2.5 sm:py-4 px-3 sm:px-4 min-h-[40px] sm:min-h-[56px] max-h-[100px] sm:max-h-[150px] custom-scrollbar"
                  />
                  <div className="flex justify-end p-1.5 sm:p-2 pt-0">
                    <Button 
                      type="submit" 
                      disabled={!chatInput.trim() || isChatLoading} 
                      className="h-6 w-6 sm:h-8 sm:w-8 p-0 rounded-md sm:rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 disabled:opacity-30 transition-all"
                    >
                      <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4" />
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

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen bg-white dark:bg-[#121212]" />}>
      <NovaWorkspace />
    </Suspense>
  );
}