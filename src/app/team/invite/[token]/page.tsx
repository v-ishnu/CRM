'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Building2,
  CreditCard,
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  Loader2,
  Terminal,
} from 'lucide-react';
import { StatusBeacon } from '@/components/ui/StatusBeacon';

export default function TeamInvitePage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [inviteData, setInviteData] = useState<{ role?: string; expiresAt?: string }>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    if (!token) return;

    const verifyToken = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/team/invite/${token}`);
        const data = await res.json();

        if (data.success && data.data?.valid) {
          setTokenValid(true);
          setInviteData(data.data);
        } else {
          setTokenValid(false);
          setTokenError(data.error?.message || 'This invitation link is invalid or has expired.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setTokenError('Failed to verify invitation link. Please check your network and try again.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Full name is required');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Email address is required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/team/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          bankDetails: {
            accountHolderName: accountHolderName.trim() || undefined,
            bankName: bankName.trim() || undefined,
            accountNumber: accountNumber.trim() || undefined,
            ifsc: ifsc.trim().toUpperCase() || undefined,
            upiId: upiId.trim() || undefined,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitSuccess(true);
      } else {
        setErrorMessage(data.error?.message || 'Failed to complete registration.');
      }
    } catch (err: any) {
      setErrorMessage('An error occurred during submission. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 font-sans text-[#f5f5f2]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 text-[#ff3e00] animate-spin" />
          <p className="text-xs font-mono text-[#8a8a93] uppercase tracking-widest">
            VERIFYING_INVITATION_SIGNATURE...
          </p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 font-sans text-[#f5f5f2] selection:bg-[#ff3e00] selection:text-white">
        <div className="max-w-md w-full bg-[#141416] border border-[#242428] p-8 text-center shadow-2xl relative">
          <div className="w-12 h-12 bg-[#1c1110] border border-[#ff3e00]/40 rounded-sm flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-6 h-6 text-[#ff3e00]" />
          </div>
          <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-widest block mb-1">
            ERROR // 403_FORBIDDEN
          </span>
          <h1 className="text-xl font-bold text-white mb-2">Invitation Unavailable</h1>
          <p className="text-[#8a8a93] text-xs leading-relaxed mb-6 font-mono">
            {tokenError}
          </p>
          <div className="bg-[#0a0a0a] border border-[#242428] p-4 text-xs text-[#8a8a93] text-left">
            <span className="font-mono text-[10px] font-bold text-[#f5f5f2] uppercase tracking-wider block mb-1">
              PROTOCOL NOTICE:
            </span>
            <p className="text-[11px] leading-relaxed">
              Invitation tokens expire after 7 days or upon single use. Contact your system administrator to generate a renewed onboarding link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 font-sans text-[#f5f5f2] selection:bg-[#ff3e00] selection:text-white">
        <div className="max-w-md w-full bg-[#141416] border border-[#242428] p-8 text-center shadow-2xl relative">
          <div className="w-12 h-12 bg-[#00d664]/10 border border-[#00d664]/30 rounded-sm flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-6 h-6 text-[#00d664]" />
          </div>
          <span className="text-[10px] font-mono text-[#00d664] uppercase tracking-widest block mb-1">
            REGISTRATION_CONFIRMED
          </span>
          <h1 className="text-xl font-bold text-white mb-2">Welcome to Dr. Debuggers</h1>
          <p className="text-[#8a8a93] text-xs leading-relaxed mb-6">
            Your developer profile and encrypted bank details have been safely registered to the CRM.
          </p>
          <div className="bg-[#0a0a0a] border border-[#242428] p-4 text-left space-y-2.5 text-xs text-[#f5f5f2] font-mono">
            <div className="flex justify-between border-b border-[#18181b] pb-2">
              <span className="text-[#8a8a93]">NAME:</span>
              <span className="font-semibold text-white">{name}</span>
            </div>
            <div className="flex justify-between border-b border-[#18181b] pb-2">
              <span className="text-[#8a8a93]">EMAIL:</span>
              <span className="font-semibold text-white">{email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8a8a93]">ROLE:</span>
              <span className="font-semibold text-[#00d664]">{inviteData.role || 'DEVELOPER'}</span>
            </div>
          </div>
          <p className="text-[10px] font-mono text-[#8a8a93] mt-6 uppercase tracking-wider">
            ADMINISTRATOR HAS BEEN NOTIFIED VIA TELEGRAM. YOU MAY CLOSE THIS TAB.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f2] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#ff3e00] selection:text-white relative">
      {/* Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="max-w-2xl w-full mx-auto space-y-8 relative">
        {/* Terminal Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#141416] border border-[#242428] text-[10px] font-mono uppercase tracking-widest text-[#8a8a93]">
            <Terminal className="w-3.5 h-3.5 text-[#ff3e00]" />
            OFFICIAL TEAM MEMBER ONBOARDING
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Join Dr. Debuggers
          </h1>
          <p className="text-xs text-[#8a8a93] max-w-lg mx-auto">
            You have been invited as a <span className="text-[#ff3e00] font-mono font-semibold">{inviteData.role || 'Team Member'}</span>. Register your credentials and payout coordinates to complete setup.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[#141416] border border-[#242428] shadow-2xl p-6 sm:p-8">
          {/* Window control bar */}
          <div className="flex items-center justify-between border-b border-[#242428] pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
              <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-widest ml-1">
                PROFILE::PAYOUT_REGISTRATION
              </span>
            </div>
            <StatusBeacon label="READY" dotColor="bg-[#00d664]" />
          </div>

          {errorMessage && (
            <div className="mb-6 p-3.5 bg-[#1c1110] border border-[#ff3e00]/40 text-[#ff8a7a] text-xs font-mono flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#ff3e00] shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#242428] pb-2">
                <h2 className="text-xs font-mono font-semibold text-[#8a8a93] uppercase tracking-wider flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#ff3e00]" /> 01 // PERSONAL PROFILE
                </h2>
                <span className="text-[10px] font-mono text-[#8a8a93]">* REQUIRED FIELDS</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Full Legal Name <span className="text-[#ff3e00]">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-[#8a8a93] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full pl-9 pr-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-[#ff3e00]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#8a8a93] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@domain.com"
                      className="w-full pl-9 pr-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Phone / WhatsApp Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#8a8a93] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bank & Payout Details */}
            <div className="pt-4 border-t border-[#242428] space-y-4">
              <div className="flex items-center justify-between border-b border-[#242428] pb-2">
                <h2 className="text-xs font-mono font-semibold text-[#8a8a93] uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-[#ff3e00]" /> 02 // PAYOUT & BANK TELEMETRY
                </h2>
                <span className="text-[10px] font-mono text-[#00d664] flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#00d664]" /> AES-256 ENCRYPTED
                </span>
              </div>

              <div className="bg-[#0a0a0a] border border-[#242428] p-3 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#00d664] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#8a8a93] font-mono leading-relaxed">
                  Bank accounts are encrypted before writing to database storage. Only authorized administrators decrypt during settlement processing.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="Exact Name on Bank Record"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Bank Institution Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-[#8a8a93] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank, ICICI Bank"
                      className="w-full pl-9 pr-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 50100234567890"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] font-mono focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    IFSC Routing Code
                  </label>
                  <input
                    type="text"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0001234"
                    maxLength={11}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] uppercase placeholder-[#4a4a52] font-mono focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    UPI ID / VPA (Optional)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="developer@oksbi"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] font-mono focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-[#242428]">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[#f5f5f2] text-black hover:bg-[#ff3e00] hover:text-white font-mono text-xs tracking-wider uppercase font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SUBMITTING REGISTRATION DATA...
                  </>
                ) : (
                  <>
                    COMPLETE ONBOARDING REGISTRATION
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
