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
} from 'lucide-react';

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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-zinc-400 font-medium">Validating invitation link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invitation Unavailable</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            {tokenError}
          </p>
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 text-xs text-zinc-400 text-left">
            <span className="font-semibold text-zinc-300">Need access?</span>
            <p className="mt-1">
              Please contact your administrator to request a fresh invitation link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to the Team!</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Your profile and bank details have been securely registered.
          </p>
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 text-left space-y-2 text-sm text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-500">Name:</span>
              <span className="font-medium">{name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Email:</span>
              <span className="font-medium">{email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Assigned Role:</span>
              <span className="font-medium text-emerald-400">{inviteData.role || 'DEVELOPER'}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-6">
            Your team administrator has been notified. You can close this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            Official Team Invitation
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Join Dr. Debuggers Team
          </h1>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto">
            You&apos;ve been invited as a <span className="text-emerald-400 font-semibold">{inviteData.role || 'Team Member'}</span>. Complete your profile and payout details below to get started.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" /> Personal Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Smith"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Phone / WhatsApp Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bank & Payout Details */}
            <div className="pt-6 border-t border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" /> Payout & Bank Details
                </h2>
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" /> AES-256-GCM Encrypted
                </span>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 flex items-start gap-3">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your banking information is protected with military-grade encryption at rest. It will only be decrypted by authorized administrators for issuing compensation payments.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="Name as per Bank Record"
                    className="w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Bank Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank, ICICI Bank"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 50100234567890"
                    className="w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0001234"
                    maxLength={11}
                    className="w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white uppercase placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    UPI ID / VPA (Optional)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="username@okhdfcbank"
                    className="w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl shadow-lg shadow-emerald-900/30 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Registering Profile...
                  </>
                ) : (
                  <>
                    Complete Onboarding
                    <ArrowRight className="w-4 h-4" />
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
