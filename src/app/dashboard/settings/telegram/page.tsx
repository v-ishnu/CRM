'use client';

import React, { useEffect, useState } from 'react';
import { Send, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Terminal, Play } from 'lucide-react';

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
    // Default URL detection
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
        setConfigSuccess(json.message || 'Webhook set successfully!');
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

  // Run Webhook Event Simulator
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
        setSimResult('Webhook payload accepted. Message is running command routing in the background.');
        fetchBotStatus(); // Reload log
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
      <div className="h-64 flex items-center justify-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin" />
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
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-sans">Telegram Bot Settings</h1>
          <p className="text-slate-400 text-sm">Monitor bot credentials, manage webhooks, and trigger simulations.</p>
        </div>
        <button
          onClick={fetchBotStatus}
          className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Columns: Bot Configurations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Connection Status Card */}
          <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-slate-350 uppercase tracking-wider mb-5">Bot Configuration Status</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">API Token Status</span>
                {status.isConfigured ? (
                  <div className="flex items-center text-emerald-450 font-bold mt-1 text-sm">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 mr-1.5" />
                    Configured
                  </div>
                ) : (
                  <div className="flex items-center text-red-405 font-bold mt-1 text-sm">
                    <XCircle className="w-4.5 h-4.5 text-red-500 mr-1.5" />
                    Missing in Env
                  </div>
                )}
              </div>

              <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Bot Username</span>
                <p className="text-slate-300 font-bold mt-1 text-sm">@{status.botUsername}</p>
              </div>

              <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Admin Telegram ID</span>
                <p className="text-slate-300 font-bold mt-1 text-sm font-mono">{status.adminTelegramId}</p>
              </div>

              <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Linked Clients</span>
                <p className="text-slate-300 font-bold mt-1 text-sm">{status.connectedClientsCount} Clients</p>
              </div>
            </div>
          </div>

          {/* Webhook Status Info Card */}
          {status.webhookInfo ? (
            <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
              <h2 className="text-sm font-bold text-slate-350 uppercase tracking-wider mb-5">Telegram Live Webhook Info</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl sm:col-span-2">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Active Webhook URL</span>
                  <p className="text-slate-300 font-mono font-bold mt-1 break-all">
                    {status.webhookInfo.url || 'None'}
                  </p>
                  {status.webhookInfo.url && (status.webhookInfo.url.includes('localhost') || status.webhookInfo.url.includes('127.0.0.1')) && (
                    <p className="text-red-400 font-semibold text-[10px] mt-1.5 uppercase tracking-wider flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      Invalid Production Webhook (Detected Localhost)
                    </p>
                  )}
                </div>
                <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Pending Updates</span>
                  <p className="text-slate-300 font-bold mt-1">
                    {status.webhookInfo.pending_update_count ?? 0} updates
                  </p>
                </div>
                <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">IP Address</span>
                  <p className="text-slate-300 font-mono font-bold mt-1">
                    {status.webhookInfo.ip_address || 'N/A'}
                  </p>
                </div>
                {status.webhookInfo.last_error_message && (
                  <div className="bg-red-950/20 p-4 border border-red-500/20 rounded-xl sm:col-span-2">
                    <span className="text-[10px] text-red-400 font-semibold uppercase flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      Last Delivery Error
                    </span>
                    <p className="text-red-300 mt-1">
                      {status.webhookInfo.last_error_message}
                    </p>
                    {status.webhookInfo.last_error_date && (
                      <p className="text-[9px] text-red-500 mt-1 font-mono">
                        Occurred at: {new Date(status.webhookInfo.last_error_date * 1000).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
              <h2 className="text-sm font-bold text-slate-350 uppercase tracking-wider mb-2">Telegram Live Webhook Info</h2>
              <p className="text-xs text-red-400">No active webhook registered on Telegram for this bot. Use the configuration panel below to register one.</p>
            </div>
          )}

          {/* Webhook Configuration form */}
          <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-slate-350 uppercase tracking-wider mb-2">Configure Bot Webhook</h2>
            <p className="text-xs text-slate-500 mb-5">Point Telegram Bot updates to this web server. Must be an HTTPS domain.</p>

            {configError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/20 text-red-300 rounded-xl text-xs">
                {configError}
              </div>
            )}
            {configSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs">
                {configSuccess}
              </div>
            )}

            <form onSubmit={handleConfigureWebhook} className="flex gap-4">
              <div className="flex-1">
                <input
                  type="url"
                  required
                  placeholder="https://your-public-url.ngrok-free.app"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={configuring || !status.isConfigured}
                className="inline-flex items-center px-6 py-2.5 bg-indigo-650 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                {configuring ? 'Configuring...' : 'Set Webhook'}
              </button>
            </form>
          </div>

          {/* Last event console logs */}
          <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-355 uppercase tracking-wider">Last Webhook Event Received</h2>
              <span className="text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Live Log
              </span>
            </div>

            {status.lastEvent ? (
              <div className="space-y-3">
                <p className="text-[10px] text-slate-500">
                  Received at: {new Date(status.lastEvent.timestamp).toLocaleString()}
                </p>
                <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-xs text-slate-300 font-mono leading-relaxed select-all">
                    {JSON.stringify(status.lastEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-slate-950/20 border border-slate-900 border-dashed text-slate-500 text-center text-xs rounded-xl">
                No webhook event recorded in memory since boot. Use simulator to trigger mock logs.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Webhook Simulator Tester (Crucial for Local testing) */}
        <div className="space-y-6">
          <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
            <div className="flex items-center space-x-2 mb-4">
              <Terminal className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-250 uppercase tracking-wider">Webhook Simulator</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              Simulate Telegram payloads locally to verify commands. Useful when running behind strict firewalls/localhost.
            </p>

            <form onSubmit={handleSimulateWebhook} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-400 uppercase tracking-wider mb-1.5">User ID</label>
                <input
                  type="text"
                  value={simUserId}
                  onChange={(e) => setSimUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                <input
                  type="text"
                  value={simUsername}
                  onChange={(e) => setSimUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Chat ID</label>
                <input
                  type="text"
                  value={simChatId}
                  onChange={(e) => setSimChatId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Message / Command</label>
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="/myproject or /start <token>"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-205 rounded-xl outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full flex items-center justify-center py-2.5 bg-indigo-650/15 border border-indigo-500/20 hover:bg-indigo-650/25 text-indigo-400 font-bold rounded-xl transition-all"
              >
                {simulating ? (
                  'Simulating Event...'
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Simulate Message
                  </>
                )}
              </button>

              {simResult && (
                <div className="mt-4 p-3 bg-slate-900 border border-slate-805 text-slate-400 rounded-xl leading-relaxed text-[11px] break-words">
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
