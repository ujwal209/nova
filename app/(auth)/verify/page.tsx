"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyManualOTP } from "@/app/actions/auth";
import { 
  Loader2, ShieldCheck, AlertCircle, 
  Lock, Zap, Box, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function VerifyPage() {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");

  useEffect(() => {
    if (!email) router.push("/login");
  }, [email, router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const res = await verifyManualOTP(email!, token);

    if (!res.success) {
      setError(res.error || "System rejected code.");
      setIsLoading(false);
    } else {
      // Navigate to the session finalizer (redirect property)
      if (res.redirect) window.location.href = res.redirect;
      else router.push("/docs");
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
            Secure your identity.
          </h1>
          <p className="text-zinc-400 text-[15px] mb-10 leading-relaxed">
            Multi-factor verification ensures your research, data, and sensitive documents are protected by enterprise-grade encryption.
          </p>

          <div className="space-y-6">
            <div className="flex gap-4 items-start">
              <ShieldCheck className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white text-sm mb-1">Identity Shield</h3>
                <p className="text-[13px] text-zinc-500 leading-snug">Continuous session monitoring and real-time threat detection active.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <Zap className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white text-sm mb-1">Instant Verification</h3>
                <p className="text-[13px] text-zinc-500 leading-snug">Time-sensitive security codes delivered directly to your verified communication channel.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badge */}
        <div className="flex items-center gap-2 text-[13px] text-zinc-500 font-medium">
          <Lock className="w-4 h-4" />
          <span>Encryption Protocol: AES-256 GCM</span>
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
              Verification Required
            </h2>
            <p className="text-[14px] text-zinc-500 leading-relaxed">
              We've sent a unique 6-digit access code to <br />
              <span className="font-semibold text-zinc-900">{email}</span>.
            </p>
          </div>
          
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="otp" className="text-[13px] font-medium text-zinc-700">Security Code</label>
              <input 
                type="text" id="otp" required maxLength={6} autoFocus
                value={token} onChange={(e) => setToken(e.target.value)}
                placeholder="000000"
                className="w-full text-center tracking-[0.5em] py-3 bg-white border border-zinc-300 rounded-md focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-colors font-medium text-xl text-zinc-900 placeholder:text-zinc-300 shadow-sm" 
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-[13px] font-medium rounded-md flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button 
              disabled={isLoading || token.length < 6}
              className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-950 text-white rounded-md font-medium text-[14px] hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-sm mt-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify Access <ArrowRight className="w-4 h-4 ml-0.5" /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-col gap-4 text-center">
             <button 
               onClick={() => router.push("/login")}
               className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
             >
               Return to Login
             </button>
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