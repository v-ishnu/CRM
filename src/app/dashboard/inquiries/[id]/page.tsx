'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MessageSquare,
  Bot,
  User,
  Send,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserPlus,
  RefreshCw,
  XCircle,
} from 'lucide-react';

interface InquiryMessage {
  sender: 'CLIENT' | 'BOT' | 'ADMIN' | 'SYSTEM';
  text: string;
  timestamp: string;
  adminEmail?: string;
  adminName?: string;
}

interface InquiryDetail {
  _id: string;
  inquiryNumber: string;
  telegramUserId: string;
  telegramUsername?: string;
  telegramChatId: string;
  name?: string;
  service?: string;
  message?: string;
  messages: InquiryMessage[];
  conversationMode: 'BOT' | 'HUMAN' | 'CLOSED';
  status: 'NEW' | 'OPEN' | 'HUMAN_HANDOFF' | 'CLOSED';
  assignedAdminName?: string;
  handoffReason?: string;
  convertedToClientId?: {
    _id: string;
    clientCode: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function InquiryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Conversion Modal State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertName, setConvertName] = useState('');
  const [convertEmail, setConvertEmail] = useState('');
  const [convertPhone, setConvertPhone] = useState('');
  const [convertCompany, setConvertCompany] = useState('');
  const [convertNotes, setConvertNotes] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/inquiries/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setInquiry(json.data);
        if (!convertName) setConvertName(json.data.name || '');
      }
    } catch (err) {
      console.error('Failed to load inquiry details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 5000); // 5s polling for new incoming messages
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [inquiry?.messages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/inquiries/${id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim(), adminName: 'Admin' }),
      });
      const json = await res.json();
      if (json.success) {
        setReplyText('');
        fetchDetail();
      } else {
        alert(json.error?.message || 'Failed to deliver message');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (action: 'take' | 'return_to_bot' | 'close') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminName: 'Admin' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchDetail();
      } else {
        alert(json.error?.message || 'Failed to update inquiry');
      }
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertEmail) {
      alert('Email is required to create a CRM client.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/inquiries/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: convertName || inquiry?.name || 'New Client',
          email: convertEmail,
          phone: convertPhone,
          company: convertCompany,
          notes: convertNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`🎉 Converted to Client: ${json.data.client.name} (${json.data.client.clientCode})!`);
        setShowConvertModal(false);
        fetchDetail();
      } else {
        alert(json.error?.message || 'Failed to convert inquiry');
      }
    } catch (err: any) {
      alert(err.message || 'Conversion failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !inquiry) {
    return (
      <div className="p-8 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-400" />
        <p>Loading inquiry conversation...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/inquiries"
            className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <span className="font-mono font-bold text-base text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                {inquiry.inquiryNumber}
              </span>
              <h1 className="text-xl font-bold text-slate-100">{inquiry.name || 'Anonymous Lead'}</h1>
              {inquiry.conversationMode === 'HUMAN' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Human Mode
                </span>
              ) : inquiry.status === 'CLOSED' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Closed
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Bot className="w-3 h-3 mr-1" />
                  Bot Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Telegram User ID: <code>{inquiry.telegramUserId}</code> {inquiry.telegramUsername && `(@${inquiry.telegramUsername})`} • Created {new Date(inquiry.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {inquiry.status !== 'CLOSED' && (
            <>
              {inquiry.conversationMode === 'HUMAN' ? (
                <button
                  onClick={() => handleAction('return_to_bot')}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-slate-700 rounded-xl text-xs font-medium flex items-center transition-colors"
                >
                  <Bot className="w-3.5 h-3.5 mr-1.5" />
                  Return to Bot
                </button>
              ) : (
                <button
                  onClick={() => handleAction('take')}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-medium flex items-center transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                  Take Inquiry
                </button>
              )}

              {!inquiry.convertedToClientId && (
                <button
                  onClick={() => setShowConvertModal(true)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center shadow-sm transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Convert to Client
                </button>
              )}

              <button
                onClick={() => handleAction('close')}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-medium flex items-center transition-colors"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Close Inquiry
              </button>
            </>
          )}

          {inquiry.convertedToClientId && (
            <Link
              href={`/dashboard/clients/${inquiry.convertedToClientId._id}`}
              className="px-3 py-1.5 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Converted: {inquiry.convertedToClientId.clientCode}
            </Link>
          )}
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="bg-[#0d0d12] border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col h-[520px]">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {inquiry.messages.map((msg, index) => {
            if (msg.sender === 'SYSTEM') {
              return (
                <div key={index} className="flex justify-center my-2">
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-850 px-3 py-1 rounded-full border border-slate-750/60">
                    ⚙️ {msg.text} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            }

            if (msg.sender === 'CLIENT') {
              return (
                <div key={index} className="flex flex-col items-start max-w-[75%] space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 ml-1">
                    {inquiry.name || 'Lead'} {inquiry.telegramUsername && `(@${inquiry.telegramUsername})`}
                  </span>
                  <div className="bg-slate-800/90 text-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm border border-slate-700/60 leading-relaxed shadow-sm">
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-500 ml-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            }

            if (msg.sender === 'BOT') {
              return (
                <div key={index} className="flex flex-col items-start max-w-[75%] space-y-1">
                  <span className="text-[11px] font-semibold text-indigo-400 ml-1 flex items-center gap-1">
                    <Bot className="w-3 h-3" /> Dr. Debuggers Bot
                  </span>
                  <div className="bg-indigo-950/40 text-indigo-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm border border-indigo-800/40 leading-relaxed shadow-sm">
                    <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                  </div>
                  <span className="text-[10px] text-slate-500 ml-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            }

            if (msg.sender === 'ADMIN') {
              return (
                <div key={index} className="flex flex-col items-end max-w-[75%] ml-auto space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-400 mr-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> {msg.adminName || 'Admin'}
                  </span>
                  <div className="bg-emerald-950/40 text-emerald-100 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm border border-emerald-800/40 leading-relaxed shadow-sm">
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-500 mr-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            }

            return null;
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        {inquiry.status !== 'CLOSED' ? (
          <form onSubmit={handleSendReply} className="pt-4 border-t border-slate-800/80 mt-2 flex gap-3">
            <input
              type="text"
              placeholder={
                inquiry.conversationMode === 'HUMAN'
                  ? 'Type reply to send directly to lead via Telegram...'
                  : 'Type a message to reply and take over conversation...'
              }
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={sending}
              className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        ) : (
          <div className="pt-4 border-t border-slate-800/80 mt-2 text-center text-xs text-slate-500">
            This inquiry is closed. Reopen or message from client dashboard if converted.
          </div>
        )}
      </div>

      {/* Convert to Client Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              Convert Inquiry to CRM Client
            </h2>
            <p className="text-xs text-slate-400">
              This will create a new CRM Client record and automatically link their Telegram ID (<code>{inquiry.telegramUserId}</code>).
            </p>

            <form onSubmit={handleConvertSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  value={convertName}
                  onChange={(e) => setConvertName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={convertEmail}
                  onChange={(e) => setConvertEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={convertPhone}
                    onChange={(e) => setConvertPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company</label>
                  <input
                    type="text"
                    value={convertCompany}
                    onChange={(e) => setConvertCompany(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  placeholder="Additional context from inquiry..."
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  Create & Link Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
