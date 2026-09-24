'use client';

import React, { useEffect, useState } from 'react';
import { Send, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Terminal, Play, Radio, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusBeacon } from '@/components/ui/StatusBeacon';

interface BotStatus {
  isConfigured: boolean;
  botUsername: string;
  adminTelegramId: string;
  connectedClientsCount: number;
  lastEvent: {
    timestamp: string;
    payload: any;
  } | null;
  webhookInfo?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
    last_error_date?: number;
    ip_address?: string;
  } | null;
}

export default function TelegramSettingsPage() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [appUrl, setAppUrl] = useState('');
  const [configuring, setConfiguring] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Webhook Simulator State
  const [simUserId, setSimUserId] = useState('123456789');
  const [simUsername, setSimUsername] = useState('rahul_sharma');
  const [simChatId, setSimChatId] = useState('123456789');
  const [simText, setSimText] = useState('/start');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<string | null>(null);

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status');
      const json = await res.json();
      if (json.success) {
        setBotStatus(json.data);
      }
    } catch (err) {
      console.error('Failed to load Telegram configurations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBotStatus();
    const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (envAppUrl) {
      setAppUrl(envAppUrl);
    } else if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
    }
  }, []);

  const handleConfigureWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfiguring(true);
    setConfigError(null);
    setConfigSuccess(null);

    try {
      const res = await fetch('/api/telegram/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appUrl }),
      });
      const json = await res.json();
      if (json.success) {
        setConfigSuccess(json.message || 'Webhook registered successfully with Telegram API.');
        fetchBotStatus();
      } else {
        setConfigError(json.error?.message || 'Telegram webhook configuration failed.');
      }
    } catch (err) {
      setConfigError('An unexpected server error occurred.');
    } finally {
      setConfiguring(false);
    }
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    setSimResult(null);

    const payload = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        message_id: Math.floor(Math.random() * 10000),
        from: {
          id: Number(simUserId),
          is_bot: false,
          first_name: 'Simulated',
          last_name: 'User',
          username: simUsername,
        },
        chat: {
          id: Number(simChatId),
          first_name: 'Simulated',
          type: 'private',
        },
        date: Math.floor(Date.now() / 1000),
        text: simText,
      },
    };

    try {
      const res = await fetch('/api/telegram/simulator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSimResult('Webhook payload accepted. Background message routing completed.');
        fetchBotStatus();
      } else {
        setSimResult(`Failed: [${res.status}] ${json.error?.message || 'Error processing request'}`);
      }
    } catch (err: any) {
      setSimResult(`Connection Error: ${err.message || err}`);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-[#8a8a93]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#ff3e00]" />
      </div>
    );
  }

  const status = botStatus || {
    isConfigured: false,
    botUsername: 'Not configured',
    adminTelegramId: 'Not configured',
    connectedClientsCount: 0,
    lastEvent: null,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <PageHeader
        tag="SETTINGS // TELEGRAM GATEWAY"
        title="Telegram Bot Settings"
        description="Monitor bot credentials, manage webhook endpoints, and run local payload simulations."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBotStatus}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            REFRESH
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns: Bot Configurations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Connection Status Card */}
          <div className="bg-[#141416] border border-[#242428] p-5">
            <div className="flex items-center justify-between border-b border-[#242428] pb-3 mb-4">
              <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider font-semibold">
                BOT CONFIGURATION TELEMETRY
              </span>
              <StatusBeacon
                label={status.isConfigured ? 'CONNECTED' : 'DISCONNECTED'}
                dotColor={status.isConfigured ? 'bg-[#00d664]' : 'bg-[#ff3e00]'}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#0a0a0a] p-3.5 border border-[#242428]">
                <span className="text-[10px] text-[#8a8a93] font-mono uppercase tracking-wider block">API Token Status</span>
                {status.isConfigured ? (
                  <div className="flex items-center text-[#00d664] font-mono font-bold mt-1 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00d664] mr-1.5" />
                    CONFIGURED (ENV)
                  </div>
                ) : (
                  <div className="flex items-center text-[#ff3e00] font-mono font-bold mt-1 text-xs">
                    <XCircle className="w-3.5 h-3.5 text-[#ff3e00] mr-1.5" />
                    MISSING KEY
                  </div>
                )}
              </div>

              <div className="bg-[#0a0a0a] p-3.5 border border-[#242428]">
                <span className="text-[10px] text-[#8a8a93] font-mono uppercase tracking-wider block">Bot Handle</span>
                <p className="text-white font-mono font-bold mt-1 text-xs">@{status.botUsername}</p>
              </div>

              <div className="bg-[#0a0a0a] p-3.5 border border-[#242428]">
                <span className="text-[10px] text-[#8a8a93] font-mono uppercase tracking-wider block">Admin Telegram Chat ID</span>
                <p className="text-white font-mono font-bold mt-1 text-xs">{status.adminTelegramId}</p>
              </div>

              <div className="bg-[#0a0a0a] p-3.5 border border-[#242428]">
                <span className="text-[10px] text-[#8a8a93] font-mono uppercase tracking-wider block">Subscribed Clients</span>
                <p className="text-white font-mono font-bold mt-1 text-xs">{status.connectedClientsCount} CLIENTS</p>
              </div>
            </div>
          </div>

          {/* Webhook Status Info Card */}
          {status.webhookInfo ? (
            <div className="bg-[#141416] border border-[#242428] p-5">
              <div className="flex items-center justify-between border-b border-[#242428] pb-3 mb-4">
                <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider font-semibold">
                  ACTIVE WEBHOOK REGISTRATION
                </span>
                <span className="text-[9px] font-mono text-[#00d664] bg-[#0e1f15] border border-[#00d664]/30 px-1.5 py-0.5 uppercase">
                  REGISTERED
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#0a0a0a] p-3.5 border border-[#242428] sm:col-span-2">
                  <span className="text-[10px] text-[#8a8a93] font-mono uppercase tracking-wider block">Registered Webhook URL</span>
                  <p className="text-white font-mono font-bold mt-1 text-xs break-all">
                    {status.webhookInfo.url || 'NONE'}
                  </p>
                  {status.webhookInfo.url && (status.webhookInfo.url.includes('localhost') || status.webhookInfo.url.includes('127.0.0.1')) && (
                    <p className="text-[#ff3e00] font-mono font-semibold text-[10px] mt-2 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      LOCAL IP DETECTED — TELEGRAM REQUIRES PUBLIC HTTPS DOMAIN
                    </p>
                  )}
                </div>
                <div className="bg-[#0a0a0a] p-3.5 border border-[#242428]">
                  <span className="text-[10px] text-[#8a8a93] font-mono uppercase tracking-wider block">Pending Updates</span>
                  <p className="text-white font-mono font-bold mt-1 text-xs">
                    {status.webhookInfo.pending_update_count ?? 0} UPDATES
                  </p>
                </div>
                <div className="bg-[#0a0a0a] p-3.5 border border-[#242428]">
                  <span className="text-[10px] text-[#8a8a93] font-mono uppercase tracking-wider block">Gateway IP Address</span>
                  <p className="text-white font-mono font-bold mt-1 text-xs">
                    {status.webhookInfo.ip_address || 'N/A'}
                  </p>
                </div>
                {status.webhookInfo.last_error_message && (
                  <div className="bg-[#1c1110] p-3.5 border border-[#ff3e00]/40 sm:col-span-2 text-xs font-mono">
                    <span className="text-[10px] text-[#ff3e00] font-semibold uppercase flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      LAST DELIVERY ERROR
                    </span>
                    <p className="text-[#ff8a7a] mt-1">
                      {status.webhookInfo.last_error_message}
                    </p>
                    {status.webhookInfo.last_error_date && (
                      <p className="text-[10px] text-[#8a8a93] mt-1 font-mono">
                        TIMESTAMP: {new Date(status.webhookInfo.last_error_date * 1000).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#141416] border border-[#242428] p-5">
              <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider font-semibold block mb-2">
                ACTIVE WEBHOOK REGISTRATION
              </span>
              <p className="text-xs text-[#ff3e00] font-mono">No active webhook registered on Telegram for this bot. Use the registration form below.</p>
            </div>
          )}

          {/* Webhook Configuration form */}
          <div className="bg-[#141416] border border-[#242428] p-5">
            <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider font-semibold block mb-1">
              CONFIGURE BOT WEBHOOK ENDPOINT
            </span>
            <p className="text-xs text-[#8a8a93] mb-4 font-mono">Point Telegram Bot updates to this web service. Must be a valid public HTTPS origin.</p>

            {configError && (
              <div className="mb-4 p-3 bg-[#1c1110] border border-[#ff3e00]/40 text-[#ff8a7a] text-xs font-mono">
                {configError}
              </div>
            )}
            {configSuccess && (
              <div className="mb-4 p-3 bg-[#0e1f15] border border-[#00d664]/40 text-[#00d664] text-xs font-mono">
                {configSuccess}
              </div>
            )}

            <form onSubmit={handleConfigureWebhook} className="flex gap-2">
              <div className="flex-1">
                <input
                  type="url"
                  required
                  placeholder="https://your-domain.com"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-white text-xs font-mono focus:outline-none focus:border-[#ff3e00] transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={configuring || !status.isConfigured}
                className="px-4 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white font-mono text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer"
              >
                {configuring ? 'REGISTERING...' : 'SET WEBHOOK'}
              </button>
            </form>
          </div>

          {/* Last event console logs */}
          <div className="bg-[#141416] border border-[#242428] p-5">
            <div className="flex items-center justify-between border-b border-[#242428] pb-3 mb-4">
              <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider font-semibold">
                LAST TELEMETRY EVENT IN MEMORY
              </span>
              <span className="text-[9px] font-mono text-white bg-[#0a0a0a] border border-[#242428] px-2 py-0.5 uppercase tracking-wider">
                BUFFER LOG
              </span>
            </div>

            {status.lastEvent ? (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-[#8a8a93]">
                  RECEIVED AT: {new Date(status.lastEvent.timestamp).toLocaleString()}
                </p>
                <div className="bg-[#0a0a0a] border border-[#242428] p-3.5 overflow-x-auto">
                  <pre className="text-xs text-[#8a8a93] font-mono leading-relaxed select-all">
                    {JSON.stringify(status.lastEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-[#0a0a0a] border border-[#242428] border-dashed text-[#8a8a93] text-center text-xs font-mono">
                No webhook event recorded in memory since boot. Use simulator to dispatch mock frames.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Webhook Simulator Tester */}
        <div className="space-y-6">
          <div className="bg-[#141416] border border-[#242428] p-5">
            <div className="flex items-center space-x-2 border-b border-[#242428] pb-3 mb-4">
              <Terminal className="w-4 h-4 text-[#ff3e00]" />
              <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider font-semibold">
                LOCAL EVENT SIMULATOR
              </span>
            </div>
            <p className="text-xs text-[#8a8a93] leading-relaxed mb-4 font-mono">
              Simulate incoming Telegram messages locally to verify command responses without calling live servers.
            </p>

            <form onSubmit={handleSimulateWebhook} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider mb-1">User ID</label>
                <input
                  type="text"
                  value={simUserId}
                  onChange={(e) => setSimUserId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0a0a0a] border border-[#242428] text-white font-mono focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider mb-1">Username</label>
                <input
                  type="text"
                  value={simUsername}
                  onChange={(e) => setSimUsername(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0a0a0a] border border-[#242428] text-white font-mono focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider mb-1">Chat ID</label>
                <input
                  type="text"
                  value={simChatId}
                  onChange={(e) => setSimChatId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0a0a0a] border border-[#242428] text-white font-mono focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider mb-1">Command / Message</label>
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="/myproject or /start"
                  className="w-full px-3 py-1.5 bg-[#0a0a0a] border border-[#242428] text-white font-mono focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={simulating}
                  className="w-full flex items-center justify-center py-2 bg-[#0a0a0a] border border-[#242428] hover:border-[#ff3e00] hover:text-[#ff3e00] text-[#f5f5f2] font-mono text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {simulating ? (
                    'SIMULATING PACKET...'
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 mr-1.5 text-[#ff3e00]" />
                      DISPATCH EVENT
                    </>
                  )}
                </button>
              </div>

              {simResult && (
                <div className="mt-3 p-3 bg-[#0a0a0a] border border-[#242428] text-[#8a8a93] font-mono text-[10px] leading-relaxed break-words">
                  {simResult}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
