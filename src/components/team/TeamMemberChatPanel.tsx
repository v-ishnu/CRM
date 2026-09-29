'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  RefreshCw,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  User,
  MessageSquare,
  Lock,
  Unlock,
  ExternalLink,
  X,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link2,
  Quote,
  List,
  ListOrdered,
} from 'lucide-react';
import { sanitizeChatHtml, convertMarkdownToTelegramHtml } from '@/lib/templates/rich-text';

export interface TeamMemberChatPanelProps {
  teamMemberId: string;
  teamMemberName: string;
  teamMemberRole?: string;
  telegramConnected: boolean;
  telegramUsername?: string;
  conversationId?: string;
  onGenerateLink?: () => void;
  onClose?: () => void;
  onConversationUpdated?: () => void;
  isModal?: boolean;
}

interface ChatMessage {
  _id: string;
  conversationId: string;
  senderType: 'ADMIN' | 'TEAM_MEMBER';
  senderId: string;
  senderName?: string;
  channel: 'CRM' | 'TELEGRAM';
  telegramMessageId?: string;
  text: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
}

interface ConversationData {
  _id: string;
  status: 'OPEN' | 'CLOSED';
  lastMessageAt: string;
  unreadAdminCount: number;
}

export function TeamMemberChatPanel({
  teamMemberId,
  teamMemberName,
  teamMemberRole,
  telegramConnected,
  telegramUsername,
  conversationId,
  onGenerateLink,
  onClose,
  onConversationUpdated,
  isModal = false,
}: TeamMemberChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const [unseenCount, setUnseenCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const lastMessageAtRef = useRef<string | null>(null);
  const pollingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormatting = (startTag: string, endTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = replyText.substring(start, end);
    const replacement = `${startTag}${selected || 'text'}${endTag}`;
    const newText = replyText.substring(0, start) + replacement + replyText.substring(end);
    setReplyText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + startTag.length,
        start + startTag.length + (selected ? selected.length : 4)
      );
    }, 0);
  };

  const insertBulletList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const prefix = start > 0 && replyText[start - 1] !== '\n' ? '\n• ' : '• ';
    const newText = replyText.substring(0, start) + prefix + replyText.substring(start);
    setReplyText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const insertNumberedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const prefix = start > 0 && replyText[start - 1] !== '\n' ? '\n1. ' : '1. ';
    const newText = replyText.substring(0, start) + prefix + replyText.substring(start);
    setReplyText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  // Monitor scroll position
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const near =
      container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    isNearBottomRef.current = near;
    if (near) {
      setUnseenCount(0);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnseenCount(0);
    isNearBottomRef.current = true;
  };

  // Fetch messages and conversation details (Initial or pagination)
  const fetchMessages = useCallback(
    async (targetPage = 1, isSilent = false) => {
      if (!teamMemberId) return;
      if (!isSilent) setRefreshing(true);

      try {
        const queryParams = new URLSearchParams({
          page: String(targetPage),
          limit: '50',
        });
        if (conversationId) {
          queryParams.set('conversationId', conversationId);
        }
        const res = await fetch(`/api/team-members/${teamMemberId}/chat?${queryParams.toString()}`);
        const json = await res.json();

        if (json.success && json.data) {
          const newMessages: ChatMessage[] = json.data.messages || [];
          if (targetPage === 1) {
            setMessages(newMessages);
            if (newMessages.length > 0) {
              lastMessageAtRef.current = newMessages[newMessages.length - 1].sentAt;
            }
          } else {
            // Prepend older messages without disturbing lastMessageAtRef
            setMessages((prev) => [...newMessages, ...prev]);
          }

          setConversation(json.data.conversation);
          setPage(targetPage);
          setTotalPages(json.data.pagination?.totalPages || 1);

          // If there were unread messages, mark them as read now that chat is open
          if (json.data.conversation?.unreadAdminCount > 0) {
            await fetch(`/api/team-members/${teamMemberId}/chat/read`, { method: 'POST' });
            if (onConversationUpdated) onConversationUpdated();
          }
        }
      } catch (err: any) {
        console.error('Failed to load chat messages:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingOlder(false);
      }
    },
    [teamMemberId, conversationId, onConversationUpdated]
  );

  // Incremental poll for newly arrived messages (?after=)
  const pollNewMessages = useCallback(async () => {
    if (!teamMemberId || pollingRef.current || !lastMessageAtRef.current) return;
    pollingRef.current = true;

    try {
      const res = await fetch(
        `/api/team-members/${teamMemberId}/chat?after=${encodeURIComponent(lastMessageAtRef.current)}`
      );
      const json = await res.json();

      if (json.success && json.data) {
        const freshList: ChatMessage[] = json.data.messages || [];
        if (freshList.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m._id));
            const uniqueIncoming = freshList.filter((m) => !existingIds.has(m._id));
            if (uniqueIncoming.length === 0) return prev;
            return [...prev, ...uniqueIncoming];
          });

          lastMessageAtRef.current = freshList[freshList.length - 1].sentAt;

          if (isNearBottomRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          } else {
            setUnseenCount((prev) => prev + freshList.length);
          }

          if (json.data.unreadAdminCount !== undefined) {
            setConversation((prev) =>
              prev
                ? {
                    ...prev,
                    unreadAdminCount: json.data.unreadAdminCount,
                    lastMessageAt: json.data.lastMessageAt || prev.lastMessageAt,
                  }
                : prev
            );
          }
        }
      }
    } catch {
      // Background poll fail silently to prevent UI disruption
    } finally {
      pollingRef.current = false;
    }
  }, [teamMemberId]);

  // Adaptive polling: 3s when focused, 20s when backgrounded, immediate fetch on refocus
  useEffect(() => {
    fetchMessages(1);

    let timer: NodeJS.Timeout;
    const scheduleNextPoll = () => {
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const delay = isHidden ? 20000 : 3000;
      timer = setTimeout(async () => {
        await pollNewMessages();
        scheduleNextPoll();
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        pollNewMessages();
        scheduleNextPoll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleNextPoll();

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchMessages, pollNewMessages]);

  // Auto-scroll to bottom on new messages if near bottom
  useEffect(() => {
    if (isNearBottomRef.current && !loadingOlder) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingOlder]);

  // Load older messages
  const handleLoadOlder = async () => {
    if (page >= totalPages || loadingOlder) return;
    setLoadingOlder(true);
    await fetchMessages(page + 1);
  };

  // Send message with optimistic UI and reconciliation
  const handleSendMessage = async (textToSend?: string | React.FormEvent) => {
    if (typeof textToSend === 'object' && textToSend !== null && 'preventDefault' in textToSend) {
      textToSend.preventDefault();
      textToSend = undefined;
    }

    const text = (typeof textToSend === 'string' ? textToSend : replyText).trim();
    if (!text || sending || !telegramConnected) return;

    setSending(true);
    setSendError(null);

    // Optimistic message entry with unique client-side key
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const optimisticMsg: ChatMessage = {
      _id: tempId,
      conversationId: conversation?._id || '',
      senderType: 'ADMIN',
      senderId: 'current-admin',
      senderName: 'You (Admin)',
      channel: 'CRM',
      text,
      status: 'SENT',
      sentAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    if (!textToSend) setReplyText('');

    if (isNearBottomRef.current) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }

    try {
      const res = await fetch(`/api/team-members/${teamMemberId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to dispatch message');
      }

      // Reconcile optimistic message with server delivered message
      const serverMessage: ChatMessage = json.data.message;
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? serverMessage : m))
      );
      lastMessageAtRef.current = serverMessage.sentAt || new Date().toISOString();

      if (json.data.conversation) {
        setConversation(json.data.conversation);
      }
      if (onConversationUpdated) onConversationUpdated();
    } catch (err: any) {
      // Mark optimistic message as FAILED for retry
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, status: 'FAILED' } : m))
      );
      setSendError(err.message || 'Message delivery failed. Telegram unreachable.');
    } finally {
      setSending(false);
    }
  };

  // Retry sending a failed message
  const handleRetry = (failedMsg: ChatMessage) => {
    setMessages((prev) => prev.filter((m) => m._id !== failedMsg._id));
    handleSendMessage(failedMsg.text);
  };

  // Toggle conversation status (OPEN / CLOSED)
  const handleToggleStatus = async () => {
    if (!conversation || statusLoading) return;
    const newStatus = conversation.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    setStatusLoading(true);

    try {
      const res = await fetch(`/api/team-members/${teamMemberId}/chat/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setConversation(json.data);
      }
    } catch (err: any) {
      console.error('Failed to toggle conversation status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const isClosed = conversation?.status === 'CLOSED';

  return (
    <div className={`flex flex-col bg-[#141416] border border-[#242428] rounded-none md:rounded-xs overflow-hidden shadow-2xl ${isModal ? 'h-[78vh] sm:h-[82vh]' : 'h-[650px] min-h-[500px]'}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#0e0e11] border-b border-[#242428] shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-none md:rounded-xs bg-[#1f1f23] border border-[#2e2e32] flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-[#ff3e00]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-white text-xs sm:text-sm tracking-tight truncate">
                {teamMemberName}
              </h2>
              {teamMemberRole && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#a1a1aa] bg-[#18181b] border border-[#2e2e32] px-1.5 py-0.5 rounded-none md:rounded-xs">
                  {teamMemberRole}
                </span>
              )}
              {isClosed ? (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase text-[#71717a] bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded-none md:rounded-xs">
                  <Lock className="w-2.5 h-2.5" /> CLOSED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase text-[#00d664] bg-[#00d664]/10 border border-[#00d664]/30 px-1.5 py-0.5 rounded-none md:rounded-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d664] animate-pulse" />
                  OPEN
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-[#8a8a93] font-mono mt-0.5">
              {telegramConnected ? (
                <span className="text-[#00d664] flex items-center gap-1">
                  <span>TELEGRAM LINKED</span>
                  {telegramUsername && <span className="text-[#a1a1aa]">(@{telegramUsername})</span>}
                </span>
              ) : (
                <span className="text-[#ff3e00] flex items-center gap-1">
                  <span>TELEGRAM NOT CONNECTED</span>
                  {onGenerateLink && (
                    <button
                      type="button"
                      onClick={onGenerateLink}
                      className="underline hover:text-white cursor-pointer ml-1"
                    >
                      [GENERATE LINK]
                    </button>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={statusLoading}
            className={`font-mono text-[10px] uppercase font-bold px-2 py-1 border transition-colors flex items-center gap-1 cursor-pointer ${
              isClosed
                ? 'bg-[#00d664]/10 text-[#00d664] border-[#00d664]/30 hover:bg-[#00d664]/20'
                : 'bg-zinc-800 text-[#a1a1aa] border-zinc-700 hover:text-white'
            }`}
            title={isClosed ? 'Reopen Conversation' : 'Close Conversation'}
          >
            {isClosed ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
            <span className="hidden sm:inline">{isClosed ? 'Reopen' : 'Close'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchMessages(1)}
            disabled={refreshing}
            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-[#8a8a93] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer"
            title="Refresh messages"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#ff3e00]' : ''}`} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-[#8a8a93] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Disconnection Warning Banner if Telegram not connected */}
      {!telegramConnected && (
        <div className="bg-[#ff3e00]/10 border-b border-[#ff3e00]/20 px-3 sm:px-4 py-2 flex items-center justify-between text-xs font-mono text-[#ffaa99] shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-[#ff3e00] shrink-0" />
            <span>Telegram is not linked. Outgoing messages cannot be delivered.</span>
          </div>
          {onGenerateLink && (
            <button
              type="button"
              onClick={onGenerateLink}
              className="text-[#ff3e00] hover:text-white font-bold underline cursor-pointer ml-2 text-[11px] shrink-0"
            >
              Generate Link
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-hidden p-3 sm:p-4">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto scrollbar-hide space-y-3 pr-1"
        >
          {/* Load older messages button */}
          {totalPages > page && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={handleLoadOlder}
                disabled={loadingOlder}
                className="font-mono text-[10px] uppercase font-bold text-[#8a8a93] hover:text-white bg-[#18181b] hover:bg-[#242428] border border-[#242428] px-3 py-1 rounded-none md:rounded-xs transition-colors cursor-pointer"
              >
                {loadingOlder ? 'Loading older...' : '↑ Load Older Messages'}
              </button>
            </div>
          )}

          {/* Loading Initial State */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-[#8a8a93] font-mono text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-[#ff3e00]" />
              <span>Loading encrypted chat history...</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-[#71717a] font-mono text-center px-4">
              <MessageSquare className="w-8 h-8 text-[#2e2e32]" />
              <p className="text-xs text-[#a1a1aa]">No messages yet in this conversation.</p>
              <p className="text-[11px] text-[#71717a]">
                {telegramConnected
                  ? 'Send a message below to start communicating with this team member.'
                  : 'Connect Telegram to enable bidirectional communication.'}
              </p>
            </div>
          )}

          {/* Message List */}
          {!loading &&
            messages.map((msg) => {
              const isAdmin = msg.senderType === 'ADMIN';

              return (
                <div
                  key={msg._id}
                  className={`flex flex-col max-w-[85%] sm:max-w-[75%] space-y-1 ${
                    isAdmin ? 'items-end ml-auto' : 'items-start mr-auto'
                  }`}
                >
                  {/* Sender Label */}
                  <span
                    className={`font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 ${
                      isAdmin ? 'text-[#ff3e00] mr-1' : 'text-[#8a8a93] ml-1'
                    }`}
                  >
                    {isAdmin ? (
                      <>
                        <User className="w-2.5 h-2.5" />
                        <span>{msg.senderName || 'Admin'}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-2.5 h-2.5 text-[#00d664]" />
                        <span>{teamMemberName}</span>
                      </>
                    )}
                  </span>

                  {/* Message Bubble */}
                  <div
                    className={`px-3.5 py-2 text-xs sm:text-sm rounded-none md:rounded-xs border shadow-xs max-w-full overflow-hidden ${
                      isAdmin
                        ? 'bg-[#ff3e00]/10 text-white border-[#ff3e00]/30'
                        : 'bg-[#18181b] text-white border-[#242428]'
                    }`}
                  >
                    <div
                      className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed [&>pre]:bg-black/50 [&>pre]:p-2 [&>pre]:my-1.5 [&>pre]:font-mono [&>code]:bg-black/40 [&>code]:px-1 [&>code]:font-mono [&>a]:text-[#ff3e00] [&>a]:underline"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeChatHtml(convertMarkdownToTelegramHtml(msg.text)),
                      }}
                    />
                  </div>

                  {/* Metadata and Delivery Status */}
                  <div
                    className={`flex items-center gap-1.5 font-mono text-[9px] ${
                      isAdmin ? 'text-[#a1a1aa] mr-1' : 'text-[#71717a] ml-1'
                    }`}
                  >
                    <span>
                      {new Date(msg.sentAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {isAdmin && (
                      <span className="flex items-center gap-0.5">
                        {msg.status === 'SENT' && (
                          <span className="text-[#a1a1aa] flex items-center gap-0.5" title="Sending...">
                            <Clock className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {msg.status === 'DELIVERED' && (
                          <span className="text-[#00d664] flex items-center gap-0.5" title="Delivered to Telegram">
                            <CheckCheck className="w-3 h-3" />
                          </span>
                        )}
                        {msg.status === 'READ' && (
                          <span className="text-[#38bdf8] flex items-center gap-0.5" title="Read">
                            <CheckCheck className="w-3 h-3 text-[#38bdf8]" />
                          </span>
                        )}
                        {msg.status === 'FAILED' && (
                          <span className="text-[#ff3e00] flex items-center gap-1 font-bold" title="Delivery Failed">
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                            <span>FAILED</span>
                            <button
                              type="button"
                              onClick={() => handleRetry(msg)}
                              className="underline hover:text-white cursor-pointer ml-1 text-[9px]"
                              title="Click to retry sending"
                            >
                              [RETRY]
                            </button>
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating New Messages Pill */}
        {unseenCount > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-2 right-4 bg-[#ff3e00] hover:bg-[#ff5500] text-white text-[10px] font-mono font-bold px-3 py-1.5 shadow-2xl flex items-center gap-1.5 animate-bounce z-20 cursor-pointer border border-white/20"
            >
              <span>↓</span>
              <span>{unseenCount} new message{unseenCount > 1 ? 's' : ''}</span>
            </button>
          </div>
        )}
      </div>

      {/* Error alert if send failed */}
      {sendError && (
        <div className="bg-[#ff3e00]/15 border-t border-[#ff3e00]/30 px-3 py-1.5 text-[11px] font-mono text-[#ff8877] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 text-[#ff3e00] shrink-0" />
            <span className="truncate">{sendError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSendError(null)}
            className="text-[#a1a1aa] hover:text-white ml-2 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Box Footer */}
      <div className="p-3 bg-[#0e0e11] border-t border-[#242428] shrink-0">
        {/* Rich Text Composer Toolbar */}
        <div className="flex items-center gap-1 mb-2 pb-1.5 border-b border-[#242428]/60 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => applyFormatting('**', '**')}
            disabled={!telegramConnected || isClosed || sending}
            title="Bold (**text**)"
            className="p-1 hover:bg-[#242428] text-[#a1a1aa] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer disabled:opacity-30"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting('*', '*')}
            disabled={!telegramConnected || isClosed || sending}
            title="Italic (*text*)"
            className="p-1 hover:bg-[#242428] text-[#a1a1aa] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer disabled:opacity-30"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting('~', '~')}
            disabled={!telegramConnected || isClosed || sending}
            title="Strikethrough (~text~)"
            className="p-1 hover:bg-[#242428] text-[#a1a1aa] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer disabled:opacity-30"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting('`', '`')}
            disabled={!telegramConnected || isClosed || sending}
            title="Monospace (`code`)"
            className="p-1 hover:bg-[#242428] text-[#a1a1aa] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer disabled:opacity-30"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={insertBulletList}
            disabled={!telegramConnected || isClosed || sending}
            title="Bullet list"
            className="p-1 hover:bg-[#242428] text-[#a1a1aa] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer disabled:opacity-30"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={insertNumberedList}
            disabled={!telegramConnected || isClosed || sending}
            title="Numbered list"
            className="p-1 hover:bg-[#242428] text-[#a1a1aa] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer disabled:opacity-30"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting('[', '](https://)')}
            disabled={!telegramConnected || isClosed || sending}
            title="Add Link [label](url)"
            className="p-1 hover:bg-[#242428] text-[#a1a1aa] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer disabled:opacity-30"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              rows={2}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={sending || !telegramConnected || isClosed}
              placeholder={
                !telegramConnected
                  ? 'Connect Telegram to enable messaging...'
                  : isClosed
                  ? 'Conversation is closed. Reopen to send messages...'
                  : 'Type a message... (Press Enter to send, Shift+Enter for newline)'
              }
              className="w-full bg-[#18181b] border border-[#242428] focus:border-[#ff3e00]/60 focus:outline-none text-white text-xs sm:text-sm p-2.5 rounded-none md:rounded-xs resize-none placeholder:text-[#52525b] font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={!replyText.trim() || sending || !telegramConnected || isClosed}
            className="px-3.5 sm:px-4 py-2.5 bg-[#ff3e00] hover:bg-[#ff3e00]/90 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-none md:rounded-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-[58px] shrink-0"
          >
            {sending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
