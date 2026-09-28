'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Radio,
  Send,
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  AlertCircle,
  RefreshCw,
  Users,
  Shield,
  Loader2,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

export interface BroadcastTeamMember {
  _id: string;
  name: string;
  email: string;
  designation?: string;
  role: string;
  status: string;
  telegramConnected: boolean;
  telegramUsername?: string;
  telegramChatId?: string;
}

export interface TeamMemberBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMembers: BroadcastTeamMember[];
  onBroadcastComplete?: () => void;
}

export function TeamMemberBroadcastModal({
  isOpen,
  onClose,
  teamMembers,
  onBroadcastComplete,
}: TeamMemberBroadcastModalProps) {
  // Wizard steps: 'COMPOSE' -> 'CONFIRM' -> 'DELIVERING' -> 'RESULT'
  const [step, setStep] = useState<'COMPOSE' | 'CONFIRM' | 'DELIVERING' | 'RESULT'>('COMPOSE');

  const [targetMode, setTargetMode] = useState<'ALL_CONNECTED' | 'SELECTED'>('SELECTED');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Execution & Progress state
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter active and eligible team members
  const eligibleMembers = useMemo(() => {
    return teamMembers.filter((m) => m.status !== 'DEACTIVATED');
  }, [teamMembers]);

  // Connected members
  const connectedMembers = useMemo(() => {
    return eligibleMembers.filter((m) => m.telegramConnected && m.telegramChatId);
  }, [eligibleMembers]);

  // Filtered members for display
  const filteredMembers = useMemo(() => {
    return eligibleMembers.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.designation && m.designation.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [eligibleMembers, searchQuery, roleFilter]);

  // Recipient calculation
  const targetRecipients = useMemo(() => {
    if (targetMode === 'ALL_CONNECTED') {
      return connectedMembers;
    }
    return eligibleMembers.filter((m) => selectedIds.includes(m._id));
  }, [targetMode, connectedMembers, eligibleMembers, selectedIds]);

  const targetConnectedCount = useMemo(() => {
    return targetRecipients.filter((m) => m.telegramConnected && m.telegramChatId).length;
  }, [targetRecipients]);

  const targetUnconnectedCount = useMemo(() => {
    return targetRecipients.length - targetConnectedCount;
  }, [targetRecipients, targetConnectedCount]);

  if (!isOpen) return null;

  const toggleSelectMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllConnected = () => {
    const connectedIds = filteredMembers
      .filter((m) => m.telegramConnected && m.telegramChatId)
      .map((m) => m._id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...connectedIds])));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleProceedToConfirm = () => {
    setErrorMessage(null);
    if (!message.trim()) {
      setErrorMessage('Please compose an announcement message before proceeding.');
      return;
    }

    if (targetMode === 'SELECTED' && selectedIds.length === 0) {
      setErrorMessage('Please select at least one team member recipient.');
      return;
    }

    if (targetConnectedCount === 0) {
      setErrorMessage('None of the selected team members have a linked Telegram account.');
      return;
    }

    setStep('CONFIRM');
  };

  const handleExecuteBroadcast = async () => {
    try {
      setSending(true);
      setErrorMessage(null);
      setStep('DELIVERING');

      // Unique idempotency key to prevent double dispatch
      const idempotencyKey = `bcast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch('/api/team-members/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          targetMode,
          recipientIds: targetMode === 'SELECTED' ? selectedIds : undefined,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to dispatch broadcast');
      }

      setBroadcastResult(data.data);
      setStep('RESULT');
      if (onBroadcastComplete) {
        onBroadcastComplete();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Broadcast failed to execute');
      setStep('CONFIRM');
    } finally {
      setSending(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!broadcastResult?._id) return;
    try {
      setRetrying(true);
      const res = await fetch(`/api/team-members/broadcast/${broadcastResult._id}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.data) {
        setBroadcastResult(data.data);
      } else {
        alert(data.error?.message || 'Failed to retry');
      }
    } catch (err: any) {
      alert(err.message || 'Retry request failed');
    } finally {
      setRetrying(false);
    }
  };

  const handleReset = () => {
    setStep('COMPOSE');
    setMessage('');
    setSelectedIds([]);
    setBroadcastResult(null);
    setErrorMessage(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-auto bg-[#0e0e10] border border-[#242428] rounded-xs shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#242428] bg-[#141416]/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xs bg-[#ff3e00]/10 border border-[#ff3e00]/30 flex items-center justify-center text-[#ff3e00]">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  TEAM // BROADCAST
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs bg-[#242428] text-[#88888e]">
                  TELEGRAM DIRECT
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#88888e] mt-0.5">
                Send simultaneous individual Telegram messages to team members.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#88888e] hover:text-white transition-colors p-1.5 rounded-xs hover:bg-[#1f1f23]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: COMPOSE & SELECT */}
        {step === 'COMPOSE' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xs flex items-center gap-2.5 text-red-300 text-xs font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Mode Selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-[#88888e] font-semibold">
                Dispatch Target
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTargetMode('SELECTED')}
                  className={`p-3 text-left border rounded-xs transition-all cursor-pointer ${
                    targetMode === 'SELECTED'
                      ? 'border-[#ff3e00] bg-[#ff3e00]/5 text-white'
                      : 'border-[#242428] bg-[#141416] text-[#88888e] hover:text-white hover:border-[#38383e]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold">Selected Team Members</span>
                    {targetMode === 'SELECTED' && <Check className="w-3.5 h-3.5 text-[#ff3e00]" />}
                  </div>
                  <p className="text-[10px] font-mono text-[#88888e] mt-1">
                    Hand-pick specific recipients from the active team registry.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetMode('ALL_CONNECTED')}
                  className={`p-3 text-left border rounded-xs transition-all cursor-pointer ${
                    targetMode === 'ALL_CONNECTED'
                      ? 'border-[#ff3e00] bg-[#ff3e00]/5 text-white'
                      : 'border-[#242428] bg-[#141416] text-[#88888e] hover:text-white hover:border-[#38383e]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold">All Connected Members</span>
                    {targetMode === 'ALL_CONNECTED' && <Check className="w-3.5 h-3.5 text-[#ff3e00]" />}
                  </div>
                  <p className="text-[10px] font-mono text-[#00D664] mt-1">
                    Instant blast to all {connectedMembers.length} members with linked Telegram.
                  </p>
                </button>
              </div>
            </div>

            {/* Member Selector (when SELECTED mode is active) */}
            {targetMode === 'SELECTED' && (
              <div className="space-y-3 bg-[#141416] border border-[#242428] p-3.5 rounded-xs">
                {/* Search & Actions Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#88888e]" />
                    <input
                      type="text"
                      placeholder="Filter by name, email, or designation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#0e0e10] border border-[#242428] pl-8 pr-3 py-1.5 text-xs text-white font-mono placeholder:text-[#555] rounded-xs focus:outline-none focus:border-[#ff3e00]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllConnected}
                      className="px-2.5 py-1.5 bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-[#ff3e00]/60 text-white font-mono text-[11px] rounded-xs transition-colors cursor-pointer"
                    >
                      Select All Connected
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="px-2.5 py-1.5 bg-[#18181b] hover:bg-[#202024] border border-[#27272a] text-[#88888e] hover:text-white font-mono text-[11px] rounded-xs transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Recipient Counter */}
                <div className="flex items-center justify-between text-[11px] font-mono border-b border-[#242428] pb-2 text-[#88888e]">
                  <span>
                    Selected: <b className="text-white">{selectedIds.length}</b> of {eligibleMembers.length} total
                  </span>
                  <span>
                    Ready for Telegram: <b className="text-[#00D664]">{targetConnectedCount}</b>
                  </span>
                </div>

                {/* Scrollable Members List */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {filteredMembers.length === 0 ? (
                    <div className="p-4 text-center text-xs font-mono text-[#88888e]">
                      No matching team members found.
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const isConnected = !!(member.telegramConnected && member.telegramChatId);
                      const isChecked = selectedIds.includes(member._id);

                      return (
                        <div
                          key={member._id}
                          onClick={() => toggleSelectMember(member._id)}
                          className={`flex items-center justify-between p-2.5 rounded-xs border transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-[#ff3e00]/5 border-[#ff3e00]/40'
                              : 'bg-[#0e0e10] border-[#242428] hover:border-[#38383e]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="accent-[#ff3e00] rounded-none cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-white truncate">
                                  {member.name}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs bg-[#242428] text-[#88888e]">
                                  {member.role}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-[#88888e] truncate">
                                {member.designation || member.email}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            {isConnected ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#00D664] bg-[#00D664]/10 border border-[#00D664]/20 px-2 py-0.5 rounded-xs">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{member.telegramUsername ? `@${member.telegramUsername}` : 'Connected'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-xs">
                                <AlertTriangle className="w-3 h-3" />
                                <span>No Telegram</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Announcement Message Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <label className="uppercase tracking-wider text-[#88888e] font-semibold">
                  Announcement Message
                </label>
                <span className={message.length > 4000 ? 'text-red-400' : 'text-[#88888e]'}>
                  {message.length} / 4000
                </span>
              </div>

              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose announcement... e.g. Please submit today's sprint task updates before 6:00 PM."
                className="w-full bg-[#141416] border border-[#242428] p-3 text-xs text-white font-mono rounded-xs focus:outline-none focus:border-[#ff3e00] resize-y placeholder:text-[#555]"
              />

              <p className="text-[10px] font-mono text-[#88888e]">
                ⌯⌲ Each recipient receives an individual message. Responses route to their separate existing chat.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIRMATION STEP */}
        {step === 'CONFIRM' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="p-4 bg-amber-950/30 border border-amber-700/50 rounded-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs font-mono">
                <div className="font-bold text-amber-300 uppercase tracking-wide">
                  Confirm Broadcast Dispatch
                </div>
                <p className="text-[#e4e4e7] leading-relaxed">
                  You are about to transmit this message to{' '}
                  <b className="text-white underline">{targetConnectedCount} Team Members</b> simultaneously via
                  Telegram.
                </p>
                {targetUnconnectedCount > 0 && (
                  <p className="text-amber-400 text-[11px]">
                    ⚠️ Note: {targetUnconnectedCount} selected team member(s) have not linked Telegram and will be
                    flagged as NOT_CONNECTED.
                  </p>
                )}
              </div>
            </div>

            {/* Message Preview */}
            <div className="space-y-1.5 bg-[#141416] border border-[#242428] p-3.5 rounded-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#88888e]">
                Message Preview
              </span>
              <div className="p-3 bg-[#0e0e10] border border-[#1f1f23] rounded-xs font-mono text-xs text-white whitespace-pre-wrap">
                {message}
              </div>
            </div>

            {/* Recipient summary list */}
            <div className="space-y-1.5 bg-[#141416] border border-[#242428] p-3.5 rounded-xs max-h-48 overflow-y-auto">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#88888e]">
                Recipients ({targetConnectedCount})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                {targetRecipients
                  .filter((m) => m.telegramConnected && m.telegramChatId)
                  .map((m) => (
                    <div
                      key={m._id}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-[#0e0e10] border border-[#1f1f23] rounded-xs text-[11px] font-mono"
                    >
                      <span className="text-white truncate">{m.name}</span>
                      <span className="text-[#00D664] text-[10px]">
                        {m.telegramUsername ? `@${m.telegramUsername}` : '✓'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DELIVERING (PROGRESS) */}
        {step === 'DELIVERING' && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-8 h-8 text-[#ff3e00] animate-spin" />
            <div className="text-center font-mono">
              <div className="text-sm font-bold text-white uppercase tracking-wider">
                Delivering Announcement...
              </div>
              <p className="text-xs text-[#88888e] mt-1">
                Dispatching messages through TelegramService concurrency pool.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: RESULT SCREEN */}
        {step === 'RESULT' && broadcastResult && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-3 gap-2.5 font-mono">
              <div className="p-3 bg-[#141416] border border-[#00D664]/40 rounded-xs text-center">
                <div className="text-[10px] text-[#88888e] uppercase">Sent</div>
                <div className="text-xl font-bold text-[#00D664] mt-0.5">
                  {broadcastResult.sentCount || 0}
                </div>
              </div>
              <div className="p-3 bg-[#141416] border border-red-800/40 rounded-xs text-center">
                <div className="text-[10px] text-[#88888e] uppercase">Failed</div>
                <div className="text-xl font-bold text-red-400 mt-0.5">
                  {broadcastResult.failedCount || 0}
                </div>
              </div>
              <div className="p-3 bg-[#141416] border border-amber-800/40 rounded-xs text-center">
                <div className="text-[10px] text-[#88888e] uppercase">Unconnected</div>
                <div className="text-xl font-bold text-amber-400 mt-0.5">
                  {broadcastResult.notConnectedCount || 0}
                </div>
              </div>
            </div>

            {/* Individual Delivery Breakdown */}
            <div className="space-y-1.5 bg-[#141416] border border-[#242428] p-3.5 rounded-xs">
              <div className="flex items-center justify-between border-b border-[#242428] pb-2 text-xs font-mono">
                <span className="text-[#88888e] uppercase tracking-wider font-semibold">
                  Delivery Log ({broadcastResult.deliveries?.length || 0})
                </span>
                {broadcastResult.failedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    disabled={retrying}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-950/60 hover:bg-red-900/60 border border-red-700/60 text-red-200 text-[11px] rounded-xs font-mono transition-colors cursor-pointer"
                  >
                    <RotateCcw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
                    <span>{retrying ? 'Retrying...' : 'Retry Failed Recipients'}</span>
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 pt-1">
                {broadcastResult.deliveries?.map((delivery: any, idx: number) => {
                  const isSent = delivery.status === 'SENT';
                  const isFailed = delivery.status === 'FAILED';
                  const isNotConnected = delivery.status === 'NOT_CONNECTED';

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xs bg-[#0e0e10] border border-[#1f1f23] text-xs font-mono"
                    >
                      <div className="truncate pr-2">
                        <span className="text-white font-bold">{delivery.teamMemberName}</span>
                        {delivery.error && (
                          <p className="text-[10px] text-red-400 truncate mt-0.5">
                            {delivery.error}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        {isSent && (
                          <span className="text-[#00D664] inline-flex items-center gap-1 text-[11px]">
                            <Check className="w-3.5 h-3.5" />
                            <span>Sent</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className="text-red-400 inline-flex items-center gap-1 text-[11px]">
                            <X className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </span>
                        )}
                        {isNotConnected && (
                          <span className="text-amber-400 inline-flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>No Telegram</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#242428] bg-[#141416]/80">
          {step === 'COMPOSE' && (
            <>
              <div className="text-[11px] font-mono text-[#88888e]">
                {targetConnectedCount} recipient(s) ready
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[#27272a] hover:bg-[#18181b] text-[#88888e] hover:text-white font-mono text-xs rounded-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceedToConfirm}
                  disabled={targetConnectedCount === 0 || !message.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff3e00] hover:bg-[#ff3e00]/90 disabled:opacity-40 disabled:hover:bg-[#ff3e00] text-white font-mono text-xs uppercase font-bold tracking-wider rounded-xs transition-colors cursor-pointer shadow-lg shadow-[#ff3e00]/20"
                >
                  <span>Review Broadcast</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {step === 'CONFIRM' && (
            <>
              <button
                type="button"
                onClick={() => setStep('COMPOSE')}
                disabled={sending}
                className="px-4 py-2 border border-[#27272a] hover:bg-[#18181b] text-[#88888e] hover:text-white font-mono text-xs rounded-xs transition-colors cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleExecuteBroadcast}
                disabled={sending}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#ff3e00] hover:bg-[#ff3e00]/90 disabled:opacity-50 text-white font-mono text-xs uppercase font-bold tracking-wider rounded-xs transition-colors cursor-pointer shadow-lg shadow-[#ff3e00]/20"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Broadcast</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'RESULT' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 border border-[#27272a] hover:bg-[#18181b] text-white font-mono text-xs rounded-xs transition-colors cursor-pointer"
              >
                Send Another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-[#18181b] hover:bg-[#222] border border-[#27272a] text-white font-mono text-xs uppercase font-bold tracking-wider rounded-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
