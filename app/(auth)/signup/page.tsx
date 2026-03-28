"use client";

import { useState } from "react";
import { signUpWithPassword } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import { 
  Loader2, Mail, Lock, User as UserIcon, 
  ShieldCheck, Globe, Code, Layers, Box, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signUpWithPassword(email, password, fullName);
    if (!result.success) {
      setError(result.error || "Signup failed. Try different details.");
      setIsLoading(false);
    } else {
      router.push("/onboarding");
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-white font-sans text-zinc-900 selection:bg-zinc-200">
      
      {/* LEFT PANEL - ENTERPRISE SHOWCASE */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#09090b] text-white p-12 border-r border-zinc-800 shrink-0">
        
        {/* Brand Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white flex items-center justify-center rounded-md">
            <Box className="w-5 h-5 text-zinc-950" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Nova Workspace</span>
        </div>

        {/* Value Proposition */}
        <div className="max-w-[420px] my-auto">
          <h1 className="text-3xl font-semibold tracking-tight mb-4 leading-tight">
            Create your enterprise workspace.
          </h1>
          <p className="text-zinc-400 text-[15px] mb-10 leading-relaxed">
            Join the elite circle of builders. Nova integrates research, data analysis, and professional editing in a secure, unified environment.
          </p>

          <div className="space-y-6">
            <div className="flex gap-4 items-start">
              <Code className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white text-sm mb-1">Developer Ready</h3>
                <p className="text-[13px] text-zinc-500 leading-snug">Full API access and native Markdown support for seamless documentation export.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <Layers className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white text-sm mb-1">Secure Synchronization</h3>
                <p className="text-[13px] text-zinc-500 leading-snug">Multi-device real-time collaboration backed by enterprise-grade data management.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badge */}
        <div className="flex items-center gap-2 text-[13px] text-zinc-500 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Secured by Supabase Authentication Layer</span>
        </div>
      </div>

      {/* RIGHT PANEL - AUTH FORM */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-white">
        
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2.5">
          <div className="w-7 h-7 bg-zinc-950 flex items-center justify-center rounded-md">
            <Box className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-zinc-950">Nova</span>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-1.5 tracking-tight">
              Create an account
            </h2>
            <p className="text-[14px] text-zinc-500">
              Fill in your details to initialize your workspace.
            </p>
          </div>
          
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-[13px] font-medium text-zinc-700">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text" id="name" required 
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-md focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-colors text-[14px] text-zinc-900 placeholder:text-zinc-400 shadow-sm" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[13px] font-medium text-zinc-700">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="email" id="email" required 
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-md focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-colors text-[14px] text-zinc-900 placeholder:text-zinc-400 shadow-sm" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pass" className="text-[13px] font-medium text-zinc-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="password" id="pass" required 
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-md focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-colors text-[14px] text-zinc-900 placeholder:text-zinc-400 shadow-sm" 
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-[13px] font-medium rounded-md">
                {error}
              </div>
            )}

            <button 
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-950 text-white rounded-md font-medium text-[14px] hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-sm mt-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4 ml-0.5" /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-200 text-center">
             <p className="text-[13px] text-zinc-500">
               Already have an account? <a href="/login" className="text-zinc-900 font-medium hover:underline underline-offset-4">Sign in here</a>
             </p>
          </div>
        </div>
      </div>

      {/* STRICT GLOBALS FOR GOOGLE SANS */}
      <style dangerouslySetInnerHTML={{__html: `
        @font-face {
            font-family: 'Google Sans';
            src: local('Google Sans'), url('https://fonts.gstatic.com/s/productsans/v18/pxPCypQkep0-WKPGWqqiG6k-J-zN_1e3Zg.woff2') format('woff2');
            font-weight: 400;
        }
        @font-face {
            font-family: 'Google Sans';
            src: local('Google Sans Medium'), url('https://fonts.gstatic.com/s/productsans/v18/pxPCypQkep0-WKPGWqqiG6k-J-zE_1e3Zg.woff2') format('woff2');
            font-weight: 500;
        }
        @font-face {
            font-family: 'Google Sans';
            src: local('Google Sans Bold'), url('https://fonts.gstatic.com/s/productsans/v18/pxPCypQkep0-WKPGWqqiG6k-J-zC_1e3Zg.woff2') format('woff2');
            font-weight: 600;
        }
        
        * { font-family: 'Google Sans', sans-serif !important; }
      `}} />
    </div>
  );
}