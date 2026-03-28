"use client";

import { useRouter } from "next/navigation";
import { Bot, FileText, Table, Calendar as CalendarIcon, ArrowRight, LayoutGrid, Globe, Sparkles } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  // Monochromatic, shadcn-inspired tool configuration
  const tools = [
    { 
      title: "Deep Browser", 
      description: "Search the live web and synthesize answers instantly with AI.", 
      icon: Globe, 
      href: "/browser" 
    },
    { 
      title: "Nova Agent", 
      description: "Your dedicated AI assistant for coding, writing, and brainstorming.", 
      icon: Bot, 
      href: "/agent" 
    },
    { 
      title: "Smart Docs", 
      description: "Draft beautiful essays, notes, and documents with AI assistance.", 
      icon: FileText, 
      href: "/docs" 
    },
    { 
      title: "Data Sheets", 
      description: "Build spreadsheets and process complex datasets efficiently.", 
      icon: Table, 
      href: "/sheets" 
    },
    { 
      title: "Calendar", 
      description: "Organize your time, schedule events, and manage your day.", 
      icon: CalendarIcon, 
      href: "/calendar" 
    }
  ];

  return (
    <div 
      className="absolute inset-0 overflow-y-auto bg-white dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 custom-scrollbar selection:bg-zinc-200 dark:selection:bg-zinc-800"
      style={{ 
        fontFamily: "'Google Sans', 'Outfit', sans-serif",
        WebkitOverflowScrolling: "touch"
      }}
    >
      {/* STRICT FONT IMPORT & RESPONSIVE SCROLLBAR STYLING */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Outfit:wght@100..900&display=swap');
        
        * {
          font-family: 'Google Sans', 'Outfit', sans-serif !important;
        }

        /* Hide scrollbar completely on mobile */
        .custom-scrollbar::-webkit-scrollbar { 
          display: none; 
          width: 0px;
        }
        .custom-scrollbar { 
          -ms-overflow-style: none; 
          scrollbar-width: none; 
        }

        /* Show thin, black scrollbar ONLY on desktop (min-width: 768px) */
        @media (min-width: 768px) {
          .custom-scrollbar::-webkit-scrollbar { 
            display: block;
            width: 6px; 
            height: 6px; 
          }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { 
            background: #27272a; /* Zinc 800 */
            border-radius: 10px; 
          }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #52525b; /* Zinc 600 */ }
        }
      `}} />

      {/* SUBTLE BACKGROUND TEXTURE & GLOW */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-zinc-300 dark:bg-zinc-800 opacity-20 blur-[120px] pointer-events-none"></div>

      {/* Main Content Container */}
      <div className="flex flex-col items-center justify-center px-5 sm:px-8 py-24 sm:py-32 relative z-10 w-full max-w-[1400px] mx-auto min-h-full pb-32">
        
        {/* Hero Section */}
        <div className="text-center mb-20 sm:mb-28 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
          
          {/* Premium Animated Badge */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter mb-6 leading-[1.1] sm:leading-[1.05] bg-gradient-to-br from-zinc-900 to-zinc-400 dark:from-zinc-50 dark:to-zinc-500 bg-clip-text text-transparent drop-shadow-sm max-w-4xl mx-auto">
            What will you build today?
          </h1>
          
          <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 font-medium max-w-2xl mx-auto leading-relaxed px-2 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200 fill-mode-both">
            Your intelligent, unified workspace. Everything you need to research, write, analyze, and plan—powered by an advanced agentic architecture.
          </p>
        </div>

        {/* Tools Grid - Staggered entrance, glassmorphism, aggressive hover states */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 sm:gap-8 w-full">
          {tools.map((tool, idx) => (
            <div 
              key={idx}
              onClick={() => router.push(tool.href)}
              style={{ animationDelay: `${200 + (idx * 100)}ms` }}
              className="group relative flex flex-col p-8 sm:p-10 rounded-[2rem] border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl hover:bg-white dark:hover:bg-[#121214] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-500 cursor-pointer animate-in fade-in slide-in-from-bottom-12 fill-mode-both hover:-translate-y-2 hover:shadow-2xl hover:shadow-zinc-200/50 dark:hover:shadow-black/80 overflow-hidden"
            >
              {/* Internal Shine Effect on Hover */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none z-0"></div>

              <div className="relative z-10 flex-1 flex flex-col">
                {/* Oversized Monochromatic Icon Container */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl mb-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-950 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-950 transition-all duration-500 shadow-inner group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-xl">
                  <tool.icon className="w-8 h-8 sm:w-10 sm:h-10 transition-transform duration-500" />
                </div>
                
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mb-3 group-hover:translate-x-1 transition-transform duration-500">
                  {tool.title}
                </h3>
                
                <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8 flex-1 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors duration-500">
                  {tool.description}
                </p>
                
                <div className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase text-zinc-950 dark:text-zinc-50 mt-auto opacity-70 group-hover:opacity-100 transition-opacity duration-500">
                  Launch App 
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-500 ease-out" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shimmer Animation Keyframes */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}