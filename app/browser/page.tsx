"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchSerperResults } from "../actions/search";
import { fetchAutocomplete } from "../actions/autocomplete";
import { generateSearchOverview, scrapeAndSummarizePage } from "../actions/workspace";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Search, Image as ImageIcon, Video, Newspaper, 
  ShoppingBag, X, Sparkles, ArrowRight, ChevronLeft, ChevronRight,
  ScanEye, Loader2, ExternalLink, Filter, ArrowDownUp, Globe, Code, FileText, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "search", label: "All", icon: Search },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Video },
  { id: "news", label: "News", icon: Newspaper },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
];

const SUGGESTED_PROMPTS = [
  { icon: Globe, label: "Latest tech news today", query: "Top technology news headlines today" },
  { icon: Code, label: "React 19 features", query: "What are the new features in React 19?" },
  { icon: FileText, label: "How to write a resume", query: "Best practices for writing a modern resume 2026" },
  { icon: Zap, label: "AI trends in 2026", query: "Biggest artificial intelligence trends in 2026" },
];

function BrowserWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search State
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const centerSearchContainerRef = useRef<HTMLDivElement>(null);
  
  const [activeSearch, setActiveSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("search");
  const [currentPage, setCurrentPage] = useState(1);
  const [results, setResults] = useState<any>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Shopping Filter State
  const [shoppingSort, setShoppingSort] = useState<"relevance" | "low" | "high">("relevance");

  // AI Overview State
  const [aiOverview, setAiOverview] = useState<string | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const lastOverviewQueryRef = useRef<string>("");

  // Scraper Modal State
  const [modalData, setModalData] = useState<{ url: string, title: string, summary: string } | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) setShowSuggestions(false);
      if (centerSearchContainerRef.current && !centerSearchContainerRef.current.contains(event.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autocomplete Sync
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2 && query !== activeSearch) {
        const data = await fetchAutocomplete(query);
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }, 200); 
    return () => clearTimeout(timer);
  }, [query, activeSearch]);

  // URL Sync & Search Execution
  useEffect(() => {
    const urlQ = searchParams.get("q");
    const urlCat = searchParams.get("category") || "search";
    const urlPage = parseInt(searchParams.get("page") || "1", 10);

    if (urlQ) {
      setQuery(urlQ);
      setActiveCategory(urlCat);
      setCurrentPage(urlPage);
      setHasSearched(true);
      
      executeSearch(urlQ, urlCat, urlPage);
      
      // AI Overview Trigger (Fixed to avoid infinite loops)
      if (urlCat === "search" && urlPage === 1 && urlQ !== lastOverviewQueryRef.current) {
        lastOverviewQueryRef.current = urlQ;
        setActiveSearch(urlQ);
        fetchAiOverview(urlQ);
      } else if (urlQ !== activeSearch) {
        setActiveSearch(urlQ);
      }
    } else {
      setHasSearched(false);
      setResults(null);
      setAiOverview(null);
      setActiveSearch("");
      lastOverviewQueryRef.current = "";
    }
  }, [searchParams]);

  const executeSearch = async (searchQuery: string, category: string, page: number) => {
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    setShoppingSort("relevance"); 
    try {
      const data = await fetchSerperResults(searchQuery, category, page);
      setResults(data); 
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoadingSearch(false);
    }
  };

  const fetchAiOverview = async (searchQuery: string) => {
    setIsOverviewLoading(true);
    setAiOverview(null);
    const overview = await generateSearchOverview(searchQuery);
    setAiOverview(overview);
    setIsOverviewLoading(false);
  };

  const handleAnalyzeClick = async (url: string, title: string) => {
    setModalData({ url, title, summary: "" });
    setIsModalLoading(true);
    const summary = await scrapeAndSummarizePage(url);
    setModalData({ url, title, summary: summary || "Failed to load summary." });
    setIsModalLoading(false);
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

  const parsePrice = (priceStr: string) => {
    if (!priceStr) return 0;
    const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const PaginationFooter = () => {
    if (!results || (!results.organic && !results.images && !results.videos && !results.news && !results.shopping)) return null;

    return (
      <div className="flex items-center gap-6 pt-10 pb-16 mt-8 max-w-[700px]">
        <Button variant="ghost" disabled={currentPage <= 1 || loadingSearch} onClick={() => updateUrl(activeSearch, activeCategory, currentPage - 1)} className="font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50">
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <span className="text-sm font-bold text-slate-500">Page {currentPage}</span>
        <Button variant="ghost" disabled={loadingSearch} onClick={() => updateUrl(activeSearch, activeCategory, currentPage + 1)} className="font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50">
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  };

  // --- RESULT COMPONENTS ---

  const WebResults = () => (
    <div className="flex flex-col gap-8 w-full animate-in fade-in duration-500">
      {results?.organic?.map((item: any, idx: number) => {
        let domain = "";
        try { domain = new URL(item.link).hostname; } catch(e) {}
        return (
          <div key={idx} className="flex flex-col gap-1.5 relative group max-w-[700px]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center border border-slate-100 bg-white overflow-hidden shrink-0">
                  <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="w-3.5 h-3.5 object-contain" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[13px] text-slate-800 truncate leading-tight font-medium">{domain.replace('www.', '')}</span>
                  <span className="text-[12px] text-slate-500 truncate leading-tight">{item.link}</span>
                </div>
              </div>
              
              {/* AI ANALYZE PILL */}
              <button 
                onClick={() => handleAnalyzeClick(item.link, item.title)}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 text-[11px] font-bold transition-all border border-blue-100 shadow-sm ml-2 cursor-pointer"
              >
                <ScanEye className="w-3 h-3" /> Analyze
              </button>
            </div>

            <a href={item.link} target="_blank" rel="noreferrer" className="w-fit group-hover:underline decoration-blue-600 underline-offset-2">
              <h3 className="text-[20px] sm:text-[22px] text-[#1a0dab] tracking-normal leading-snug transition-colors duration-300">{item.title}</h3>
            </a>
            <p className="text-[14px] text-[#4d5156] leading-[1.58]">{item.snippet}</p>
          </div>
        );
      })}
    </div>
  );

  const ShoppingResults = () => {
    let displayedItems = [...(results?.shopping || [])];
    
    if (shoppingSort === 'low') {
      displayedItems.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    } else if (shoppingSort === 'high') {
      displayedItems.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    }

    return (
      <div className="w-full flex flex-col max-w-[1000px]">
        {results?.shopping && results.shopping.length > 0 && (
          <div className="flex items-center justify-end gap-3 mb-6 w-full animate-in fade-in">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Sort By
            </span>
            <div className="relative">
              <select
                value={shoppingSort}
                onChange={(e) => setShoppingSort(e.target.value as any)}
                className="appearance-none bg-white border border-slate-200 shadow-sm text-slate-700 text-sm font-bold rounded-xl pl-4 pr-10 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="relevance">Relevance</option>
                <option value="low">Price: Low to High</option>
                <option value="high">Price: High to Low</option>
              </select>
              <ArrowDownUp className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 w-full animate-in fade-in duration-500">
          {displayedItems.map((item: any, idx: number) => (
            <a key={idx} href={item.link} target="_blank" rel="noreferrer" className="flex flex-col group bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300">
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-white mb-3 p-2 relative flex items-center justify-center border border-slate-100">
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="flex flex-col flex-1 justify-between px-1">
                <h3 className="text-[13px] font-medium text-slate-800 line-clamp-2 leading-tight mb-2 group-hover:text-blue-600 transition-colors">{item.title}</h3>
                <div>
                  <p className="text-lg font-bold text-slate-900">{item.price}</p>
                  <p className="text-[12px] text-slate-500 font-medium mt-0.5 truncate">{item.source}</p>
                </div>
              </div>
            </a>
          ))}
          {!results?.shopping?.length && !loadingSearch && (
            <p className="text-slate-500 font-medium">No shopping results found.</p>
          )}
        </div>
      </div>
    );
  };

  const ImageResults = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 animate-in fade-in duration-500 w-full">
      {results?.images?.map((item: any, idx: number) => (
        <a key={idx} href={item.link} target="_blank" rel="noreferrer" className="flex flex-col gap-2 group transition-all duration-300">
          <div className="rounded-xl overflow-hidden bg-slate-100 aspect-square relative border border-slate-200 shadow-sm group-hover:shadow-md">
            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 absolute inset-0" />
          </div>
          <p className="text-[13px] text-slate-700 line-clamp-2 px-1 group-hover:underline decoration-slate-400 underline-offset-2">{item.title}</p>
        </a>
      ))}
    </div>
  );

  const VideoResults = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 max-w-[1000px]">
      {results?.videos?.map((item: any, idx: number) => (
        <a key={idx} href={item.link} target="_blank" rel="noreferrer" className="flex flex-col gap-3 group transition-all duration-300">
          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video border border-slate-200 shadow-sm group-hover:shadow-md">
            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            {item.duration && (
              <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-[11px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">
                {item.duration}
              </span>
            )}
            <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-300 z-0"></div>
          </div>
          <div className="px-1">
            <h3 className="text-[16px] text-[#1a0dab] line-clamp-2 leading-snug group-hover:underline underline-offset-2">
              {item.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-[13px] text-slate-600">
              <span>{item.source}</span>
              {item.date && <span>• {item.date}</span>}
            </div>
          </div>
        </a>
      ))}
    </div>
  );

  const NewsResults = () => (
    <div className="flex flex-col gap-8 max-w-[700px] animate-in fade-in duration-500">
      {results?.news?.map((item: any, idx: number) => (
        <div key={idx} className="flex flex-col-reverse sm:flex-row gap-4 sm:gap-6 group">
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[13px] text-slate-600">
              <span className="font-bold text-slate-800">{item.source}</span>
              <span>• {item.date}</span>
            </div>
            <a href={item.link} target="_blank" rel="noreferrer" className="w-fit group-hover:underline decoration-blue-600 underline-offset-2">
              <h3 className="text-[18px] sm:text-[20px] text-[#1a0dab] leading-snug transition-colors">{item.title}</h3>
            </a>
            <p className="text-[14px] text-[#4d5156] line-clamp-3 leading-[1.58] mt-1">{item.snippet}</p>
          </div>
          {item.imageUrl && (
            <div className="w-full sm:w-[120px] h-[120px] rounded-xl overflow-hidden shrink-0 border border-slate-200 shadow-sm">
              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="absolute inset-0 flex flex-col bg-[#f8f9fa] text-slate-900 overflow-hidden selection:bg-blue-100 selection:text-blue-900" style={{ fontFamily: "Arial, sans-serif" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; display: block; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #cbd5e1; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* TOP HEADER - Visible only when actively searching */}
      {hasSearched && (
        <header className="flex items-center py-4 px-4 sm:px-8 shrink-0 z-30 relative bg-white border-b border-slate-200 w-full min-h-[72px]">
          <div className="flex items-center gap-4 sm:gap-8 w-full max-w-[1200px] mx-auto xl:mx-0">
            {/* Minimal Logo */}
            <div 
              onClick={() => { setQuery(""); setHasSearched(false); router.push('/browser'); }}
              className="flex items-center justify-center font-black text-xl sm:text-2xl tracking-tighter text-blue-600 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            >
              Nova.
            </div>

            <div className="flex-1 relative w-full max-w-[700px]" ref={searchContainerRef}>
              <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full group">
                <Input
                  type="text" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  className="w-full rounded-full pl-6 pr-14 py-6 bg-slate-100/50 border border-slate-200 hover:bg-white hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)] focus-visible:bg-white focus-visible:shadow-[0_2px_15px_rgba(0,0,0,0.08)] focus-visible:ring-0 focus-visible:border-blue-400 transition-all text-[16px] text-slate-900 placeholder:text-slate-500"
                />
                <Button type="submit" variant="ghost" className="absolute right-2 rounded-full w-10 h-10 p-0 text-blue-600 hover:bg-blue-50">
                  <Search className="w-5 h-5" />
                </Button>
              </form>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 py-2 animate-in fade-in slide-in-from-top-2">
                  {suggestions.map((sug, idx) => (
                    <div key={idx} onClick={() => { updateUrl(sug, activeCategory, 1); setShowSuggestions(false); }} className="flex items-center gap-4 px-5 py-2.5 hover:bg-slate-100 cursor-pointer font-medium text-[15px] text-slate-800">
                      <Search className="w-4 h-4 text-slate-400" /> {sug}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 w-full">
        
        {hasSearched ? (
          <div className="flex-1 flex flex-col h-full bg-white">
            {/* Category Tabs */}
            <div className="w-full border-b border-slate-200 shrink-0 z-10 relative">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-[130px]">
                <Tabs value={activeCategory} onValueChange={(v) => updateUrl(activeSearch, v, 1)} className="w-full">
                  <TabsList className="bg-transparent h-14 p-0 gap-6 flex w-full justify-start overflow-x-auto hide-scrollbar">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <TabsTrigger key={cat.id} value={cat.id} className="relative rounded-none bg-transparent shadow-none px-1 py-4 text-[14px] font-medium text-slate-500 data-[state=active]:text-blue-600 group cursor-pointer shrink-0 transition-colors border-b-[3px] border-transparent data-[state=active]:border-blue-600 hover:text-slate-800">
                          <Icon className="w-4 h-4 mr-2 opacity-80" />{cat.label}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* SEARCH RESULTS SCROLL CONTAINER */}
            <div className="flex-1 overflow-y-auto py-6 sm:py-8 custom-scrollbar min-h-0 relative z-10 w-full scroll-smooth">
              <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-[130px]">
                
                {/* AI OVERVIEW BLOCK (Only on All/Search tab) */}
                {activeCategory === "search" && currentPage === 1 && (
                  <div className="mb-10 w-full max-w-[700px] p-[1px] rounded-3xl bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-300 shadow-sm animate-in fade-in duration-500">
                    <div className="bg-gradient-to-br from-blue-50/50 to-purple-50/30 bg-white p-6 sm:p-7 rounded-[23px] h-full w-full">
                      <div className="flex items-center gap-2 text-blue-600 mb-4 font-bold text-[13px] uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" /> AI Overview
                      </div>
                      
                      {isOverviewLoading ? (
                        <div className="space-y-3 animate-pulse w-full">
                          <div className="h-4 bg-slate-200/80 rounded w-full"></div>
                          <div className="h-4 bg-slate-200/80 rounded w-5/6"></div>
                          <div className="h-4 bg-slate-200/80 rounded w-4/6"></div>
                        </div>
                      ) : aiOverview ? (
                        <div className="prose prose-slate max-w-none prose-p:leading-[1.6] prose-p:text-[#4d5156] prose-a:text-blue-600 text-[15px]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiOverview}</ReactMarkdown>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {loadingSearch ? (
                  <div className="flex flex-col gap-8 w-full max-w-[700px] animate-pulse">
                    {[1, 2, 3].map(i => (
                       <div key={i} className="space-y-3">
                         <div className="h-4 w-48 bg-slate-100 rounded"></div>
                         <div className="h-6 w-3/4 bg-slate-100 rounded"></div>
                         <div className="h-10 w-full bg-slate-100 rounded"></div>
                       </div>
                    ))}
                  </div>
                ) : (
                  <div className="pb-16 w-full">
                    {results?.searchInformation && <p className="text-[13px] text-slate-500 mb-6 font-medium pl-1">About {results.searchInformation.formattedTotalResults} results</p>}
                    
                    {activeCategory === "search" && <WebResults />}
                    {activeCategory === "shopping" && <ShoppingResults />}
                    {activeCategory === "images" && <ImageResults />}
                    {activeCategory === "videos" && <VideoResults />}
                    {activeCategory === "news" && <NewsResults />}

                    <PaginationFooter />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // ============================================================================
          // GORGEOUS, EXUBERANT LANDING / EMPTY STATE
          // ============================================================================
          <div className="flex-1 overflow-y-auto bg-white custom-scrollbar min-h-0 w-full relative z-10 flex flex-col items-center justify-center pt-8 sm:pt-0">
            
            {/* Background Ambient Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-[100px] pointer-events-none -z-10 mix-blend-multiply"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full blur-[100px] pointer-events-none -z-10 mix-blend-multiply"></div>

            <div className="flex flex-col items-center w-full max-w-3xl p-6 sm:-mt-20 z-10">
               <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-6 sm:mb-8 text-center bg-clip-text text-transparent bg-gradient-to-br from-slate-900 via-blue-800 to-indigo-900 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                 Nova.
               </h1>
               
               <p className="text-slate-500 text-base sm:text-lg md:text-xl font-medium mb-8 sm:mb-12 text-center max-w-xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 px-4">
                 The intelligent browser. Search the web, synthesize complex answers, and extract data instantly.
               </p>

               {/* Center Search Bar */}
               <div className="w-full relative animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300" ref={centerSearchContainerRef}>
                 <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full group">
                   <Input 
                     type="text" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                     placeholder="Ask anything..."
                     className="w-full rounded-full pl-6 pr-14 sm:pr-16 py-7 sm:py-8 md:py-9 text-base sm:text-lg md:text-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] border border-slate-200/80 bg-white/90 backdrop-blur-xl focus-visible:ring-0 focus-visible:border-blue-400 transition-all text-slate-900 placeholder:text-slate-400 font-medium" 
                   />
                   <Button type="submit" disabled={!query.trim()} className="absolute right-2 sm:right-3 rounded-full w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 p-0 bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 transition-all shadow-md disabled:opacity-50 disabled:hover:scale-100">
                     <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                   </Button>
                 </form>

                 {/* Suggestions Dropdown */}
                 {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-4 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-2xl overflow-hidden z-50 py-3 animate-in fade-in slide-in-from-top-4">
                    {suggestions.map((sug, idx) => (
                      <div key={idx} onClick={() => { updateUrl(sug, activeCategory, 1); setShowSuggestions(false); }} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 cursor-pointer font-medium text-[16px] text-slate-700 transition-colors">
                        <Search className="w-5 h-5 text-slate-400" /> {sug}
                      </div>
                    ))}
                  </div>
                 )}
               </div>

               {/* Suggested Prompts Pills */}
               <div className="flex flex-wrap justify-center gap-3 mt-10 animate-in fade-in duration-1000 delay-500">
                 {SUGGESTED_PROMPTS.map((item, idx) => (
                   <button 
                     key={idx}
                     onClick={() => updateUrl(item.query, "search", 1)}
                     className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:shadow-sm transition-all"
                   >
                     <item.icon className="w-4 h-4 text-slate-400" /> {item.label}
                   </button>
                 ))}
               </div>

            </div>
          </div>
        )}
      </div>

      {/* OVERLAY MODAL FOR WEBPAGE ANALYSIS */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => !isModalLoading && setModalData(null)}></div>
          <div className="relative w-full max-w-4xl h-[85vh] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-white">
              <div className="flex flex-col overflow-hidden pr-4">
                <div className="flex items-center gap-2 text-blue-600 font-bold tracking-widest text-[11px] uppercase mb-1">
                  <ScanEye className="w-4 h-4 text-blue-500" /> AI Synthesis
                </div>
                <h2 className="text-xl sm:text-2xl font-bold truncate text-slate-900">{modalData.title}</h2>
                <a href={modalData.url} target="_blank" rel="noreferrer" className="text-[13px] text-slate-500 hover:text-blue-600 truncate flex items-center gap-1 mt-1 transition-colors">
                  {modalData.url} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button onClick={() => setModalData(null)} disabled={isModalLoading} className="p-2.5 rounded-full bg-slate-50 border border-slate-200 shadow-sm hover:bg-slate-100 transition-colors disabled:opacity-50 shrink-0">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar bg-[#f8f9fa]">
              {isModalLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 animate-in fade-in duration-500">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-6">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                  <p className="font-bold tracking-widest uppercase text-[13px] text-slate-400">Synthesizing Page Content...</p>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none prose-p:leading-[1.8] prose-p:text-[#4d5156] prose-headings:font-bold prose-headings:text-slate-900 prose-li:font-medium text-[16px] bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{modalData.summary}</ReactMarkdown>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}

export default function BrowserPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] w-full bg-white" />}>
      <BrowserWorkspace />
    </Suspense>
  );
}