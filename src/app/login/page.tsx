'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck, Terminal } from 'lucide-react';
import { StatusBeacon } from '@/components/ui/StatusBeacon';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Login failed. Please verify credentials.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4 font-sans text-[#f5f5f2] relative overflow-hidden selection:bg-[#ff3e00] selection:text-white">
      {/* Technical Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Subtle Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#ff3e00]/5 rounded-full filter blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#141416] border border-[#242428] p-6 sm:p-8 relative shadow-2xl">
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between border-b border-[#242428] pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
            <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-widest ml-1">
              SYS::AUTH_GATEWAY
            </span>
          </div>
          <StatusBeacon label="ACTIVE" dotColor="bg-[#00d664]" />
        </div>

        {/* Brand Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-[#ff3e00] rounded-sm flex items-center justify-center font-mono font-bold text-white text-base shadow-lg shadow-[#ff3e00]/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-semibold tracking-tight text-white">DR. DEBUGGERS</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#242428] text-[#8a8a93]">CRM</span>
              </div>
              <p className="text-[11px] text-[#8a8a93] font-mono">OPERATIONAL TELEMETRY & CLIENT PORTAL</p>
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mt-4">
            Developer CRM Access
          </h1>
          <p className="text-xs text-[#8a8a93] mt-1 leading-relaxed">
            Sign in to manage client projects, telemetry, billing and Telegram alerts.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-[#1c1110] border border-[#ff3e00]/40 text-[#ff8a7a] text-xs font-mono leading-relaxed flex items-start gap-2">
            <span className="text-[#ff3e00] font-bold">ERR:</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-2" htmlFor="email">
              Operator Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#8a8a93]" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@drdebuggers.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0a0a0a] border border-[#242428] text-sm text-[#f5f5f2] placeholder-[#4a4a52] font-sans focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-2" htmlFor="password">
              Secure Key / Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#8a8a93]" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0a0a0a] border border-[#242428] text-sm text-[#f5f5f2] placeholder-[#4a4a52] font-sans focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#f5f5f2] text-black hover:bg-[#ff3e00] hover:text-white font-mono text-xs tracking-wider uppercase font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  INITIALIZE SESSION
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-[#242428] flex items-center justify-between text-[10px] font-mono text-[#8a8a93]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00d664]" />
            AES-256 ENCRYPTED
          </span>
          <span className="uppercase tracking-widest text-[#6b6b76]">
            v2.4.0-PROD
          </span>
        </div>
      </div>
    </main>
  );
}
