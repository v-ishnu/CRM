'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Search,
  Bot,
  User,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface InquiryItem {
  _id: string;
  inquiryNumber: string;
  telegramUserId: string;
  telegramUsername?: string;
  name?: string;
  service?: string;
  message?: string;
  conversationMode: 'BOT' | 'HUMAN' | 'CLOSED';
  status: 'NEW' | 'OPEN' | 'HUMAN_HANDOFF' | 'CLOSED';
  assignedAdminName?: string;
  handoffReason?: string;
  lastMessageAt: string;
  createdAt: string;
  messagesCount?: number;
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEW' | 'BOT' | 'HUMAN' | 'CLOSED'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(page));
      queryParams.set('limit', '20');
      if (search) queryParams.set('search', search);

      if (activeTab === 'NEW') queryParams.set('status', 'NEW');
      else if (activeTab === 'HUMAN') queryParams.set('conversationMode', 'HUMAN');
      else if (activeTab === 'BOT') queryParams.set('conversationMode', 'BOT');
      else if (activeTab === 'CLOSED') queryParams.set('status', 'CLOSED');

      const res = await fetch(`/api/inquiries?${queryParams.toString()}`);
      const json = await res.json();
      if (json.success) {
        setInquiries(json.data || []);
        setTotalPages(json.pagination?.pages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, [activeTab, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInquiries();
  };

  const getStatusBadge = (status: string, mode: string) => {
    if (mode === 'HUMAN' || status === 'HUMAN_HANDOFF') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
          <AlertCircle className="w-3 h-3 mr-1" />
          Human Handoff
        </span>
      );
    }
    if (status === 'CLOSED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Closed
        </span>
      );
    }
    if (status === 'NEW') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          New Lead
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Active
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <MessageSquare className="w-7 h-7 text-indigo-450" />
            Public Inquiries & Leads
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage public inquiries from unlinked Telegram users with automated responses and human handoff.
          </p>
        </div>
        <button
          onClick={fetchInquiries}
          className="inline-flex items-center justify-center px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-200 rounded-xl text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-1.5 bg-[#0d0d12] p-1.5 rounded-xl border border-slate-800 overflow-x-auto scrollbar-hide">
          {[
            { id: 'ALL', label: 'All Inquiries' },
            { id: 'HUMAN', label: '🟠 Human Handoff' },
            { id: 'NEW', label: 'New Leads' },
            { id: 'BOT', label: 'Bot Active' },
            { id: 'CLOSED', label: 'Closed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative min-w-[280px]">
          <input
            type="text"
            placeholder="Search inquiries, lead names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0d0d12] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </form>
      </div>

      {/* Inquiry List */}
      <div className="bg-[#0d0d12] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        {loading && inquiries.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-400" />
            <p className="text-sm">Loading inquiries...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-medium text-slate-400">No inquiries found</p>
            <p className="text-xs text-slate-600 mt-1">
              Public inquiries sent by unlinked Telegram users will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {inquiries.map((inquiry) => (
              <Link
                key={inquiry._id}
                href={`/dashboard/inquiries/${inquiry._id}`}
                className="block p-4 sm:p-5 hover:bg-slate-850/40 transition-colors group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                      <span className="font-mono font-bold text-xs sm:text-sm text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                        {inquiry.inquiryNumber}
                      </span>
                      <h3 className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors text-sm sm:text-base truncate">
                        {inquiry.name || 'Anonymous Lead'}
                      </h3>
                      {inquiry.telegramUsername && (
                        <span className="text-xs text-slate-500 truncate">@{inquiry.telegramUsername}</span>
                      )}
                      {getStatusBadge(inquiry.status, inquiry.conversationMode)}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-400 line-clamp-1">
                      {inquiry.message || 'No message preview'}
                    </p>

                    {inquiry.handoffReason && (
                      <p className="text-xs text-amber-400/90 font-medium">
                        Reason: {inquiry.handoffReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end space-x-4 shrink-0 text-xs text-slate-500 pt-1 md:pt-0 border-t md:border-t-0 border-slate-850/40">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(inquiry.lastMessageAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {inquiry.conversationMode === 'HUMAN' ? (
                      <span className="flex items-center text-amber-400 font-semibold">
                        <User className="w-3.5 h-3.5 mr-1" />
                        Human Mode
                      </span>
                    ) : (
                      <span className="flex items-center text-slate-400">
                        <Bot className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                        Bot Active
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all hidden sm:inline" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-slate-400">
            <span>
              Showing {inquiries.length} of {totalCount} inquiries
            </span>
            <div className="flex space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 bg-slate-800 rounded disabled:opacity-40 hover:bg-slate-700"
              >
                Previous
              </button>
              <span className="px-2 py-1 font-semibold text-slate-300">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-slate-800 rounded disabled:opacity-40 hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
