"use client";

import { useState } from "react";
import { fetchSerperResults } from "./actions/search";

// Define the categories mapping exactly to Serper's endpoints
const CATEGORIES = [
  { id: "search", label: "Web" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "news", label: "News" },
  { id: "shopping", label: "Shopping" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("search");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResults(null); // Clear old results

    // Call our server action
    const data = await fetchSerperResults(query, activeCategory);
    setResults(data);
    setLoading(false);
  };

  // Re-run search automatically if they click a new tab while a query exists
  const handleTabChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    if (query.trim() && results) {
      setTimeout(() => handleSearch(), 0);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-cyan-500/30">
      <main className="max-w-5xl mx-auto py-16 px-6 flex flex-col items-center">
        
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-4">
            Nexus AI Browser
          </h1>
          <p className="text-zinc-400 text-lg">Search the web, powered by Serper.dev</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl relative mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything..."
            className="w-full h-16 rounded-2xl bg-zinc-900 border border-zinc-800 px-6 text-lg text-white shadow-xl transition-all focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 rounded-xl bg-cyan-600 px-8 font-medium text-white transition-colors hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Categories Tabs */}
        <div className="flex flex-wrap gap-2 mb-12 justify-center">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleTabChange(cat.id)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === cat.id
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/50"
                  : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div className="w-full">
          {/* Web Results */}
          {activeCategory === "search" && results?.organic && (
            <div className="flex flex-col gap-6">
              {results.organic.map((item: any, idx: number) => (
                <div key={idx} className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                  <a href={item.link} target="_blank" rel="noreferrer" className="group">
                    <p className="text-sm text-zinc-400 mb-1">{item.link}</p>
                    <h3 className="text-xl font-semibold text-cyan-400 group-hover:underline mb-2">{item.title}</h3>
                  </a>
                  <p className="text-zinc-300 leading-relaxed">{item.snippet}</p>
                </div>
              ))}
            </div>
          )}

          {/* Image Results (Grid) */}
          {activeCategory === "images" && results?.images && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {results.images.map((item: any, idx: number) => (
                <a key={idx} href={item.link} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-zinc-800 hover:border-cyan-500 transition-all aspect-video relative group">
                  <img src={item.imageUrl} alt={item.title} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          )}

          {/* Video Results */}
          {activeCategory === "videos" && results?.videos && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {results.videos.map((item: any, idx: number) => (
                <div key={idx} className="flex gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="thumbnail" className="w-32 h-24 object-cover rounded-lg" />
                  )}
                  <div>
                    <a href={item.link} target="_blank" rel="noreferrer" className="text-lg font-semibold text-cyan-400 hover:underline line-clamp-2">
                      {item.title}
                    </a>
                    <p className="text-sm text-zinc-400 mt-1">{item.source}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

           {/* News Results */}
           {activeCategory === "news" && results?.news && (
            <div className="flex flex-col gap-6">
              {results.news.map((item: any, idx: number) => (
                <div key={idx} className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50">
                  <p className="text-xs font-bold tracking-wider text-purple-400 mb-2 uppercase">{item.source} • {item.date}</p>
                  <a href={item.link} target="_blank" rel="noreferrer">
                    <h3 className="text-xl font-semibold text-zinc-100 hover:text-cyan-400 transition-colors mb-2">{item.title}</h3>
                  </a>
                  <p className="text-zinc-400">{item.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}