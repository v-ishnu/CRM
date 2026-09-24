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
  Radio,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInquiries();
  };

  const getStatusBadge = (status: string, mode: string) => {
    if (mode === 'HUMAN' || status === 'HUMAN_HANDOFF') {
      return (
        <Badge variant="warning" size="sm" pulse>
          HUMAN HANDOFF
        </Badge>
      );
    }
    if (status === 'CLOSED') {
      return (
        <Badge variant="neutral" size="sm">
          CLOSED
        </Badge>
      );
    }
    if (status === 'NEW') {
      return (
        <Badge variant="orange" size="sm">
          NEW LEAD
        </Badge>
      );
    }
    return (
      <Badge variant="active" size="sm">
        ACTIVE BOT
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        tag="OPERATIONS // LEAD TELEMETRY"
        title="Public Inquiries & Leads"
        description="Monitor lead inquiries from Telegram channels, manage automated bot triage, and process human handoffs."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInquiries}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            REFRESH STREAM
          </Button>
        }
      />

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#141416] border border-[#242428] p-3">
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
          {[
            { id: 'ALL', label: 'ALL LEADS' },
            { id: 'HUMAN', label: 'HUMAN HANDOFF' },
            { id: 'NEW', label: 'NEW LEADS' },
            { id: 'BOT', label: 'BOT AUTOMATION' },
            { id: 'CLOSED', label: 'ARCHIVED / CLOSED' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-black'
                  : 'text-[#8a8a93] hover:text-white hover:bg-[#242428]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px]">
          <input
            type="text"
            placeholder="Search inquiries, lead names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#242428] pl-8 pr-3 py-1.5 text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
          />
          <Search className="w-3.5 h-3.5 text-[#8a8a93] absolute left-2.5 top-2.5" />
        </form>
      </div>

      {/* Inquiry List */}
      <div className="bg-[#141416] border border-[#242428] overflow-hidden">
        {loading && inquiries.length === 0 ? (
          <div className="py-16 text-center text-[#8a8a93]">
            <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin text-[#ff3e00]" />
            <p className="text-xs font-mono uppercase tracking-widest">LOADING TELEGRAM INQUIRIES...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="py-16 text-center text-[#8a8a93]">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 text-[#4a4a52] stroke-1" />
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#f5f5f2]">No inquiries found</p>
            <p className="text-xs text-[#8a8a93] mt-1 font-mono">
              Inbound messages from Telegram bot listeners will populate here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#242428]">
            {inquiries.map((inquiry) => (
              <Link
                key={inquiry._id}
                href={`/dashboard/inquiries/${inquiry._id}`}
                className="block p-4 sm:p-5 hover:bg-[#18181b] transition-colors group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                      <span className="font-mono font-bold text-xs text-white bg-[#0a0a0a] px-2 py-0.5 border border-[#242428] shrink-0">
                        {inquiry.inquiryNumber}
                      </span>
                      <h3 className="font-semibold text-white group-hover:text-[#ff3e00] transition-colors text-sm truncate">
                        {inquiry.name || 'Anonymous Lead'}
                      </h3>
                      {inquiry.telegramUsername && (
                        <span className="text-xs font-mono text-[#8a8a93] truncate">@{inquiry.telegramUsername}</span>
                      )}
                      {getStatusBadge(inquiry.status, inquiry.conversationMode)}
                    </div>

                    <p className="text-xs text-[#8a8a93] line-clamp-1 font-sans">
                      {inquiry.message || 'No message preview'}
                    </p>

                    {inquiry.handoffReason && (
                      <p className="text-[11px] font-mono text-[#f59e0b] flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" />
                        <span>HANDOFF REASON: {inquiry.handoffReason}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end space-x-4 shrink-0 text-xs text-[#8a8a93] pt-2 md:pt-0 border-t md:border-t-0 border-[#242428]">
                    <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                      <Clock className="w-3 h-3 text-[#6b6b76]" />
                      <span>{new Date(inquiry.lastMessageAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {inquiry.conversationMode === 'HUMAN' ? (
                      <span className="flex items-center text-[#f59e0b] font-mono text-[10px] uppercase font-bold tracking-wider">
                        <User className="w-3 h-3 mr-1" />
                        HUMAN OPERATOR
                      </span>
                    ) : (
                      <span className="flex items-center text-[#8a8a93] font-mono text-[10px] uppercase tracking-wider">
                        <Bot className="w-3 h-3 mr-1 text-[#ff3e00]" />
                        BOT RUNNING
                      </span>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-[#6b6b76] group-hover:text-[#ff3e00] group-hover:translate-x-1 transition-all hidden sm:inline" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 bg-[#0a0a0a] border-t border-[#242428] flex flex-col sm:flex-row gap-3 items-center justify-between text-xs font-mono text-[#8a8a93]">
            <span>
              SHOWING {inquiries.length} OF {totalCount} INQUIRIES
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2.5 py-1 bg-[#141416] border border-[#242428] disabled:opacity-30 hover:border-[#ff3e00] text-white uppercase text-[10px] transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 py-0.5 text-white">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-2.5 py-1 bg-[#141416] border border-[#242428] disabled:opacity-30 hover:border-[#ff3e00] text-white uppercase text-[10px] transition-colors cursor-pointer"
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
