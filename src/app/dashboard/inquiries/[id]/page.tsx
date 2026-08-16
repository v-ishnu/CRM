'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  User,
  Send,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserPlus,
  RefreshCw,
  XCircle,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  X,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface InquiryAttachment {
  type: 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO';
  fileName: string;
  mimeType: string;
  fileUrl?: string;
  storagePath?: string;
  telegramFileId?: string;
  size?: number;
}

interface InquiryMessage {
  sender: 'CLIENT' | 'BOT' | 'ADMIN' | 'SYSTEM';
  text: string;
  timestamp: string;
  adminEmail?: string;
  adminName?: string;
  attachments?: InquiryAttachment[];
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

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InquiryDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Attachment state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conversion Modal State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertName, setConvertName] = useState('');
  const [convertEmail, setConvertEmail] = useState('');
  const [convertPhone, setConvertPhone] = useState('');
  const [convertCompany, setConvertCompany] = useState('');
  const [convertNotes, setConvertNotes] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);

  // Check scroll position to determine if we should auto-scroll
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 120;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    isNearBottomRef.current = isNearBottom;
  };

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
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [inquiry?.messages]);

  // Clean up object preview URLs
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File is too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const preview = URL.createObjectURL(file);
      setFilePreviewUrl(preview);
    } else {
      setFilePreviewUrl(null);
    }

    // Reset input value to allow selecting same file again if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = () => {
    setSelectedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    setFileError(null);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText.trim() && !selectedFile) || sending) return;

    setSending(true);
    setFileError(null);

    try {
      let res: Response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('message', replyText.trim());
        formData.append('adminName', 'Admin');
        formData.append('file', selectedFile);

        res = await fetch(`/api/inquiries/${id}/message`, {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch(`/api/inquiries/${id}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: replyText.trim(), adminName: 'Admin' }),
        });
      }

      const json = await res.json();
      if (json.success) {
        setReplyText('');
        handleRemoveAttachment();
        isNearBottomRef.current = true;
        await fetchDetail();
      } else {
        alert(json.error?.message || 'Failed to deliver message');
      }
    } catch (err: any) {
      alert(err.message || 'Network error while delivering message');
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

  const renderAttachment = (att: InquiryAttachment, index: number) => {
    if (att.type === 'IMAGE') {
      return (
        <div key={index} className="mt-2 group relative max-w-sm rounded-xl overflow-hidden border border-slate-700/60 bg-black/40">
          {att.fileUrl ? (
            <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="block relative">
              <img
                src={att.fileUrl}
                alt={att.fileName || 'Attachment'}
                className="max-h-60 w-full object-contain bg-black/40 transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <div className="absolute bottom-2 right-2 bg-black/70 text-slate-200 text-[10px] px-2 py-0.5 rounded backdrop-blur flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-3 h-3" /> View
              </div>
            </a>
          ) : (
            <div className="p-3 flex items-center space-x-2 text-xs text-slate-300">
              <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">{att.fileName}</span>
            </div>
          )}
        </div>
      );
    }

    if (att.type === 'VIDEO') {
      return (
        <div key={index} className="mt-2 max-w-sm rounded-xl overflow-hidden border border-slate-700/60 bg-black/40">
          {att.fileUrl ? (
            <video controls src={att.fileUrl} className="max-h-60 w-full rounded-xl" />
          ) : (
            <div className="p-3 flex items-center space-x-2 text-xs text-slate-300">
              <Film className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="truncate">{att.fileName}</span>
              {att.size && <span className="text-[10px] text-slate-500">({formatFileSize(att.size)})</span>}
            </div>
          )}
        </div>
      );
    }

    if (att.type === 'AUDIO') {
      return (
        <div key={index} className="mt-2 max-w-md p-2 rounded-xl border border-slate-700/60 bg-slate-900/60">
          {att.fileUrl ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-300 px-1">
                <Music className="w-3.5 h-3.5 text-pink-400" />
                <span className="truncate">{att.fileName}</span>
              </div>
              <audio controls src={att.fileUrl} className="w-full h-8" />
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <Music className="w-4 h-4 text-pink-400 shrink-0" />
              <span className="truncate">{att.fileName}</span>
            </div>
          )}
        </div>
      );
    }

    // Default DOCUMENT
    return (
      <div key={index} className="mt-2 flex items-center justify-between p-2.5 rounded-xl border border-slate-700/60 bg-slate-900/70 max-w-sm">
        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="truncate">
            <p className="text-xs font-medium text-slate-200 truncate">{att.fileName}</p>
            {att.size && <p className="text-[10px] text-slate-400">{formatFileSize(att.size)}</p>}
          </div>
        </div>
        {att.fileUrl && (
          <a
            href={att.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-slate-700 rounded-lg text-xs flex items-center gap-1 transition-colors shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    );
  };

  if (loading || !inquiry) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-slate-500">
        <div>
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-400" />
          <p className="text-sm">Loading inquiry conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full max-w-5xl w-full mx-auto space-y-4 min-h-0">
      {/* Mobile Breadcrumb & Header Card (shown only on mobile directly below main header) */}
      <div className="md:hidden shrink-0 bg-[#0d0d12]/90 border border-slate-800/80 rounded-2xl p-3 space-y-2.5 shadow-md">
        {/* Top Row: Back button, Inquiry Number, Name, Mode */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <Link
              href="/dashboard/inquiries"
              className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 rounded-lg transition-colors shrink-0"
              title="Back to Inquiries"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                <span className="font-mono font-bold text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                  {inquiry.inquiryNumber}
                </span>
                <h1 className="text-sm font-bold text-slate-100 truncate">{inquiry.name || 'Anonymous Lead'}</h1>
              </div>
            </div>
          </div>
          <div className="shrink-0">
            {inquiry.conversationMode === 'HUMAN' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-2.5 h-2.5 mr-1" />
                Human Mode
              </span>
            ) : inquiry.status === 'CLOSED' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                Closed
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Bot className="w-2.5 h-2.5 mr-1" />
                Bot Mode
              </span>
            )}
          </div>
        </div>

        {/* Telegram User ID & Created Date */}
        <p className="text-[11px] text-slate-400 leading-tight">
          Telegram User ID: <code>{inquiry.telegramUserId}</code> {inquiry.telegramUsername && `(@${inquiry.telegramUsername})`} • Created{' '}
          {new Date(inquiry.createdAt).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        {/* Mobile Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/60">
          {inquiry.status !== 'CLOSED' && (
            <>
              {inquiry.conversationMode === 'HUMAN' ? (
                <button
                  onClick={() => handleAction('return_to_bot')}
                  disabled={actionLoading}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-slate-700 rounded-lg text-[11px] font-medium flex items-center transition-colors"
                >
                  <Bot className="w-3 h-3 mr-1" />
                  Return to Bot
                </button>
              ) : (
                <button
                  onClick={() => handleAction('take')}
                  disabled={actionLoading}
                  className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-medium flex items-center transition-colors"
                >
                  <UserCheck className="w-3 h-3 mr-1" />
                  Take Inquiry
                </button>
              )}

              {!inquiry.convertedToClientId && (
                <button
                  onClick={() => setShowConvertModal(true)}
                  disabled={actionLoading}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-medium flex items-center shadow-sm transition-colors"
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Convert to Client
                </button>
              )}

              <button
                onClick={() => handleAction('close')}
                disabled={actionLoading}
                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[11px] font-medium flex items-center transition-colors"
              >
                <XCircle className="w-3 h-3 mr-1" />
                Close Inquiry
              </button>
            </>
          )}

          {inquiry.convertedToClientId && (
            <Link
              href={`/dashboard/clients/${inquiry.convertedToClientId._id}`}
              className="px-2.5 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-semibold flex items-center"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Converted: {inquiry.convertedToClientId.clientCode}
            </Link>
          )}
        </div>
      </div>

      {/* Desktop Header & Action Controls */}
      <div className="hidden md:flex shrink-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/inquiries"
            className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 rounded-xl transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="font-mono font-bold text-sm text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                {inquiry.inquiryNumber}
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-100">{inquiry.name || 'Anonymous Lead'}</h1>
              {inquiry.conversationMode === 'HUMAN' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Human Mode
                </span>
              ) : inquiry.status === 'CLOSED' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Closed
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Bot className="w-3 h-3 mr-1" />
                  Bot Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Telegram User ID: <code>{inquiry.telegramUserId}</code> {inquiry.telegramUsername && `(@${inquiry.telegramUsername})`} • Created{' '}
              {new Date(inquiry.createdAt).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
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

      {/* Conversation Thread - Responsive Container */}
      <div className="bg-[#0d0d12] border border-slate-800/80 rounded-2xl shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 min-h-0 overflow-hidden p-3 sm:p-6 pb-2">
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto scrollbar-hide space-y-4 pr-1 sm:pr-2"
          >
            {inquiry.messages.map((msg, index) => {
              if (msg.sender === 'SYSTEM') {
                return (
                  <div key={index} className="flex justify-center my-2">
                    <span className="text-[11px] font-medium text-slate-400 bg-slate-850 px-3 py-1 rounded-full border border-slate-750/60 text-center">
                      ⚙️ {msg.text} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              }

              if (msg.sender === 'CLIENT') {
                return (
                  <div key={index} className="flex flex-col items-start max-w-[88%] sm:max-w-[75%] space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 ml-1">
                      {inquiry.name || 'Lead'} {inquiry.telegramUsername && `(@${inquiry.telegramUsername})`}
                    </span>
                    <div className="bg-slate-800/90 text-slate-100 rounded-2xl rounded-tl-sm px-3.5 sm:px-4 py-2.5 text-sm border border-slate-700/60 shadow-sm max-w-full overflow-hidden">
                      {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="space-y-2">
                          {msg.attachments.map((att, attIdx) => renderAttachment(att, attIdx))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 ml-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              }

              if (msg.sender === 'BOT') {
                return (
                  <div key={index} className="flex flex-col items-start max-w-[88%] sm:max-w-[75%] space-y-1">
                    <span className="text-[11px] font-semibold text-indigo-400 ml-1 flex items-center gap-1">
                      <Bot className="w-3 h-3" /> Dr. Debuggers Bot
                    </span>
                    <div className="bg-indigo-950/40 text-indigo-200 rounded-2xl rounded-tl-sm px-3.5 sm:px-4 py-2.5 text-sm border border-indigo-800/40 shadow-sm max-w-full overflow-hidden">
                      <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="space-y-2">
                          {msg.attachments.map((att, attIdx) => renderAttachment(att, attIdx))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 ml-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              }

              if (msg.sender === 'ADMIN') {
                return (
                  <div key={index} className="flex flex-col items-end max-w-[88%] sm:max-w-[75%] ml-auto space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-400 mr-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> {msg.adminName || 'Admin'}
                    </span>
                    <div className="bg-emerald-950/40 text-emerald-100 rounded-2xl rounded-tr-sm px-3.5 sm:px-4 py-2.5 text-sm border border-emerald-800/40 shadow-sm max-w-full overflow-hidden">
                      {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="space-y-2">
                          {msg.attachments.map((att, attIdx) => renderAttachment(att, attIdx))}
                        </div>
                      )}
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
        </div>

        {/* Message Composer */}
        {inquiry.status !== 'CLOSED' ? (
          <div className="shrink-0 p-3 sm:p-4 md:p-6 pt-2 sm:pt-3 border-t border-slate-800/80 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            {/* Attachment Preview Chip */}
            {selectedFile && (
              <div className="mb-2 flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-indigo-500/30 max-w-md">
                <div className="flex items-center space-x-2.5 min-w-0">
                  {filePreviewUrl ? (
                    <img
                      src={filePreviewUrl}
                      alt="Preview"
                      className="w-9 h-9 object-cover rounded-lg border border-slate-700 shrink-0"
                    />
                  ) : selectedFile.type.startsWith('video/') ? (
                    <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-center justify-center shrink-0">
                      <Film className="w-4 h-4 text-purple-400" />
                    </div>
                  ) : selectedFile.type.startsWith('audio/') ? (
                    <div className="w-9 h-9 bg-pink-500/10 border border-pink-500/30 rounded-lg flex items-center justify-center shrink-0">
                      <Music className="w-4 h-4 text-pink-400" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-indigo-400" />
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-200 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-400">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  disabled={sending}
                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {fileError && (
              <p className="text-xs text-red-400 mb-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {fileError}
              </p>
            )}

            <form onSubmit={handleSendReply} className="flex items-center gap-2 sm:gap-3">
              {/* Hidden Native File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={sending}
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip,application/x-zip-compressed,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm"
              />

              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Attach file (Images, PDFs, Docs, Audio, Video)"
                className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-400 hover:text-slate-200 disabled:opacity-50 rounded-xl transition-colors shrink-0"
              >
                <Paperclip className="w-4 h-4" />
              </button>

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
                className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors min-w-0"
              />

              <button
                type="submit"
                disabled={sending || (!replyText.trim() && !selectedFile)}
                className="px-4 sm:px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all shrink-0 min-w-[85px] justify-center"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="shrink-0 p-4 border-t border-slate-800/80 text-center text-xs text-slate-500 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
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
