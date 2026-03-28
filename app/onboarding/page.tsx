"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { finishOnboarding } from "@/app/actions/auth";
import { 
  User as UserIcon, ArrowRight, Brain, Target, 
  Lightbulb, Zap, Rocket, ShieldCheck, 
  ShieldAlert, ShieldMinus, Loader2, 
  Box, Layers, Globe, Code
} from "lucide-react";
import { cn } from "@/lib/utils";

const INTERESTS = [
  { id: "ai", label: "Artificial Intelligence", icon: Brain },
  { id: "writing", label: "Creative Writing", icon: PenToolIcon },
  { id: "research", label: "Academic Research", icon: Target },
  { id: "productivity", label: "System Productivity", icon: Zap },
  { id: "tech", label: "Full-stack Dev", icon: Rocket },
  { id: "business", label: "SaaS Strategy", icon: Lightbulb },
];

const MODES = [
  { id: "supportive", label: "Supportive", desc: "Gentle guidance & hints", icon: ShieldCheck },
  { id: "professional", label: "Professional", desc: "Strict and efficient", icon: ShieldMinus },
  { id: "aggressive", label: "Aggressive", desc: "High speed execution", icon: ShieldAlert },
];

// Helper icon since PenTool wasn't in the main import list
function PenToolIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
    </svg>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [agentMode, setAgentMode] = useState("professional");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  async function handleFinish() {
    if (!fullName.trim()) { 
      setError("Please enter your full name to continue."); 
      return; 
    }
    setIsLoading(true);
    setError(null);
    
    const res = await finishOnboarding({ fullName, interests: selectedInterests, agentMode });
    if (res.success) {
      router.push("/");
    } else { 
      setError(res.error || "Failed to save workspace settings. Please try again."); 
      setIsLoading(false); 
    }
  }

  return (
    <div className="h-[100dvh] w-full flex bg-white font-sans text-zinc-900 selection:bg-zinc-200 overflow-hidden">
      
      {/* LEFT PANEL - ENTERPRISE SHOWCASE */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] h-full bg-[#09090b] text-white p-12 border-r border-zinc-800 shrink-0 overflow-y-auto custom-scrollbar">
        
        {/* Brand Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white flex items-center justify-center rounded-md shrink-0">
            <Box className="w-5 h-5 text-zinc-950" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Nova Workspace</span>
        </div>

        {/* Value Proposition */}
        <div className="max-w-[420px] my-auto py-10">
          <h1 className="text-3xl font-semibold tracking-tight mb-4 leading-tight">
            Configure your environment.
          </h1>
          <p className="text-zinc-400 text-[15px] mb-10 leading-relaxed">
            Tailor the workspace to your specific research and operational needs. Your settings determine how the underlying AI models route requests.
          </p>

          <div className="space-y-6">
            <div className="flex gap-4 items-start">
              <Brain className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white text-sm mb-1">Neural Synchronization</h3>
                <p className="text-[13px] text-zinc-500 leading-snug">Adaptive persona logic matches your workflow tone for optimized output.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <Globe className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white text-sm mb-1">Contextual Filtering</h3>
                <p className="text-[13px] text-zinc-500 leading-snug">Interest-based parameters prioritize relevant data during live web extraction.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badge */}
        <div className="flex items-center gap-2 text-[13px] text-zinc-500 font-medium">
          <Layers className="w-4 h-4 shrink-0" />
          <span>Configuration applied globally across devices</span>
        </div>
      </div>

      {/* RIGHT PANEL - THE FORM */}
      <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-white relative">
        <div className="flex flex-col items-center min-h-full p-6 sm:p-12">
          
          {/* Mobile Logo (In document flow, preventing overlap) */}
          <div className="lg:hidden w-full max-w-[480px] flex items-center gap-2.5 mb-8">
            <div className="w-7 h-7 bg-zinc-950 flex items-center justify-center rounded-md shrink-0">
              <Box className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight text-zinc-950">Nova</span>
          </div>

          <div className="w-full max-w-[480px] my-auto pb-10">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-1.5 tracking-tight">
                Workspace Setup
              </h2>
              <p className="text-[14px] text-zinc-500">
                Personalize your identity and set your primary operational parameters.
              </p>
            </div>
            
            <div className="space-y-8">
              
              {/* SECTION: IDENTITY */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-[13px] font-medium text-zinc-700">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type="text" id="name" required 
                    value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-md focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-colors text-[14px] text-zinc-900 placeholder:text-zinc-400 shadow-sm" 
                  />
                </div>
              </div>

              {/* SECTION: INTERESTS */}
              <div className="space-y-2">
                 <label className="text-[13px] font-medium text-zinc-700">Primary Focus Areas</label>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {INTERESTS.map(({ id, label, icon: Icon }) => {
                      const isSelected = selectedInterests.includes(id);
                      return (
                        <button 
                           key={id} 
                           onClick={() => toggleInterest(id)}
                           className={cn(
                             "flex flex-col items-start gap-2 p-3 rounded-md border transition-all text-left",
                             isSelected 
                               ? "bg-zinc-50 border-zinc-950 shadow-sm ring-1 ring-zinc-950 text-zinc-900" 
                               : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400"
                           )}
                        >
                           <Icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-zinc-900" : "text-zinc-400")} />
                           <span className={cn("text-[12px] font-medium leading-tight", isSelected ? "font-semibold" : "")}>{label}</span>
                        </button>
                      );
                    })}
                 </div>
              </div>

              {/* SECTION: PERSONA */}
              <div className="space-y-2">
                 <label className="text-[13px] font-medium text-zinc-700">Agent Workflow Persona</label>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {MODES.map(({ id, label, desc, icon: Icon }) => {
                      const isSelected = agentMode === id;
                      return (
                        <button 
                           key={id} 
                           onClick={() => setAgentMode(id)}
                           className={cn(
                             "flex flex-col items-start gap-1 p-3 rounded-md border transition-all text-left",
                             isSelected 
                               ? "bg-zinc-50 border-zinc-950 shadow-sm ring-1 ring-zinc-950 text-zinc-900" 
                               : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400"
                           )}
                        >
                           <div className="flex items-center gap-2 mb-1">
                             <Icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-zinc-900" : "text-zinc-400")} />
                             <span className={cn("text-[13px] font-medium", isSelected ? "font-semibold" : "")}>{label}</span>
                           </div>
                           <span className="text-[11px] leading-snug opacity-80">{desc}</span>
                        </button>
                      );
                    })}
                 </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-[13px] font-medium rounded-md">
                  {error}
                </div>
              )}

              <div className="pt-4 border-t border-zinc-200">
                <button 
                  disabled={isLoading} onClick={handleFinish}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-950 text-white rounded-md font-medium text-[14px] hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <>Initialize Workspace <ArrowRight className="w-4 h-4 ml-0.5 shrink-0" /></>}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* STRICT GLOBALS FOR GOOGLE SANS & SCROLLBAR */}
      <style dangerouslySetInnerHTML={{__html: `
        @font-face {
            font-family: 'Google Sans';
            src: local('Google Sans'), url('https://fonts.gstatic.com/s/productsans/v18/pxPCypQkep0-WKPGWqqiG6k-J-zN_1e3Zg.woff2') format('woff2');
            font-weight: 400;
        }
        @font-face {
            font-family: 'Google Sans Medium';
            src: local('Google Sans Medium'), url('https://fonts.gstatic.com/s/productsans/v18/pxPCypQkep0-WKPGWqqiG6k-J-zE_1e3Zg.woff2') format('woff2');
            font-weight: 500;
        }
        @font-face {
            font-family: 'Google Sans Bold';
            src: local('Google Sans Bold'), url('https://fonts.gstatic.com/s/productsans/v18/pxPCypQkep0-WKPGWqqiG6k-J-zC_1e3Zg.woff2') format('woff2');
            font-weight: 600;
        }
        
        * { font-family: 'Google Sans', sans-serif !important; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
      `}} />
    </div>
  );
}