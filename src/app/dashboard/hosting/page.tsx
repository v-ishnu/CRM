'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Server,
  Search,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Edit2,
  Trash2,
  ShieldCheck,
  Calendar,
  Lock,
  X,
  Loader2,
  Send,
} from 'lucide-react';

interface HostingItem {
  _id: string;
  clientId: {
    _id: string;
    name: string;
    clientCode: string;
    email: string;
    telegramConnected: boolean;
  };
  projectId?: {
    _id: string;
    name: string;
    projectCode: string;
  };
  hostingProvider: string;
  hostingType: string;
  panelUrl?: string;
  serverHost?: string;
  domain: string;
  port?: number | string;
  planName?: string;
  username?: string;
  startDate?: string;
  expiryDate: string;
  daysRemaining: number;
  autoRenewal: boolean;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'CANCELLED';
  notes?: string;
  renewalHistoryCount: number;
  createdAt: string;
}

export default function HostingPage() {
  const [hostings, setHostings] = useState<HostingItem[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRevealModal, setShowRevealModal] = useState(false);

  // Selected item state
  const [selectedHosting, setSelectedHosting] = useState<HostingItem | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<any | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    clientId: '',
    projectId: '',
    hostingProvider: 'Hostinger',
    customProvider: '',
    hostingType: 'Shared',
    panelUrl: '',
    serverHost: '',
    domain: '',
    port: '',
    planName: '',
    username: '',
    password: '',
    sshKey: '',
    apiToken: '',
    startDate: '',
    expiryDate: '',
    autoRenewal: false,
    notes: '',
  });

  const [renewDate, setRenewDate] = useState('');
  const [renewNotes, setRenewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingExpiry, setCheckingExpiry] = useState(false);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const fetchHostings = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter) query.set('status', statusFilter);
      if (clientFilter) query.set('clientId', clientFilter);

      const res = await fetch(`/api/hosting?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setHostings(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load hosting accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [clientsRes, projectsRes] = await Promise.all([
        fetch('/api/clients?limit=100'),
        fetch('/api/projects'),
      ]);
      const [clientsJson, projectsJson] = await Promise.all([
        clientsRes.json(),
        projectsRes.json(),
      ]);
      if (clientsJson.success) setClients(clientsJson.data?.clients || []);
      if (projectsJson.success) setProjects(projectsJson.data || []);
    } catch (err) {
      console.error('Failed to load clients/projects for hosting:', err);
    }
  };

  useEffect(() => {
    fetchDependencies();
    fetchHostings();
  }, []);

  useEffect(() => {
    fetchHostings();
  }, [statusFilter, clientFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHostings();
  };

  // Add Hosting Handler
  const handleAddHosting = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const provider =
        formData.hostingProvider === 'Custom'
          ? formData.customProvider
          : formData.hostingProvider;

      const payload = {
        ...formData,
        hostingProvider: provider,
        projectId: formData.projectId || undefined,
        port: formData.port || undefined,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        expiryDate: new Date(formData.expiryDate),
      };

      const res = await fetch('/api/hosting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setBannerSuccess(`Hosting account for ${formData.domain} added successfully.`);
        setShowAddModal(false);
        setFormData({
          clientId: '',
          projectId: '',
          hostingProvider: 'Hostinger',
          customProvider: '',
          hostingType: 'Shared',
          panelUrl: '',
          serverHost: '',
          domain: '',
          port: '',
          planName: '',
          username: '',
          password: '',
          sshKey: '',
          apiToken: '',
          startDate: '',
          expiryDate: '',
          autoRenewal: false,
          notes: '',
        });
        fetchHostings();
      } else {
        setBannerError(json.error?.message || 'Failed to add hosting account');
      }
    } catch (err: any) {
      setBannerError(err.message || 'Error submitting hosting account');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Hosting Handler
  const handleEditHosting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHosting) return;
    setSubmitting(true);
    try {
      const provider =
        formData.hostingProvider === 'Custom'
          ? formData.customProvider
          : formData.hostingProvider;

      const payload: Record<string, any> = {
        hostingProvider: provider,
        hostingType: formData.hostingType,
        panelUrl: formData.panelUrl,
        serverHost: formData.serverHost,
        domain: formData.domain,
        port: formData.port || undefined,
        planName: formData.planName,
        username: formData.username,
        autoRenewal: formData.autoRenewal,
        notes: formData.notes,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined,
        projectId: formData.projectId || undefined,
      };

      if (formData.password && formData.password.trim() !== '') {
        payload.password = formData.password.trim();
      }
      if (formData.sshKey && formData.sshKey.trim() !== '') {
        payload.sshKey = formData.sshKey.trim();
      }
      if (formData.apiToken && formData.apiToken.trim() !== '') {
        payload.apiToken = formData.apiToken.trim();
      }

      const res = await fetch(`/api/hosting/${selectedHosting._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setBannerSuccess(`Hosting for ${formData.domain} updated.`);
        setShowEditModal(false);
        fetchHostings();
      } else {
        setBannerError(json.error?.message || 'Failed to update hosting');
      }
    } catch (err: any) {
      setBannerError(err.message || 'Error updating hosting');
    } finally {
      setSubmitting(false);
    }
  };

  // Renew Hosting Handler
  const handleRenewHosting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHosting || !renewDate) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/hosting/${selectedHosting._id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newExpiryDate: new Date(renewDate),
          notes: renewNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBannerSuccess(`Hosting for ${selectedHosting.domain} successfully renewed to ${new Date(renewDate).toLocaleDateString()}!`);
        setShowRenewModal(false);
        setSelectedHosting(null);
        setRenewDate('');
        setRenewNotes('');
        fetchHostings();
      } else {
        setBannerError(json.error?.message || 'Failed to renew hosting');
      }
    } catch (err: any) {
      setBannerError(err.message || 'Error renewing hosting');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Hosting
  const handleDeleteHosting = async (hosting: HostingItem) => {
    if (!confirm(`Are you sure you want to delete hosting for "${hosting.domain}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/hosting/${hosting._id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setBannerSuccess(`Hosting for ${hosting.domain} deleted.`);
        fetchHostings();
      } else {
        setBannerError(json.error?.message || 'Failed to delete hosting');
      }
    } catch (err: any) {
      setBannerError(err.message || 'Error deleting hosting');
    }
  };

  // Reveal Credentials
  const handleRevealSecrets = async (hosting: HostingItem) => {
    setSelectedHosting(hosting);
    setShowRevealModal(true);
    setRevealing(true);
    setRevealedSecrets(null);
    try {
      const res = await fetch(`/api/hosting/${hosting._id}/reveal`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setRevealedSecrets(json.data);
      } else {
        setBannerError(json.error?.message || 'Failed to reveal credentials');
        setShowRevealModal(false);
      }
    } catch (err: any) {
      setBannerError('Decryption request failed');
      setShowRevealModal(false);
    } finally {
      setRevealing(false);
    }
  };

  // Trigger Expiry Check & Notifications
  const handleCheckExpiry = async () => {
    setCheckingExpiry(true);
    try {
      const res = await fetch('/api/hosting/check-expiry', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setBannerSuccess(
          `Checked ${json.data.checkedCount} hosting accounts. Dispatched ${json.data.notificationsSent} new Telegram notification(s).`
        );
        fetchHostings();
      } else {
        setBannerError(json.error?.message || 'Failed to execute expiry check');
      }
    } catch (err: any) {
      setBannerError('Expiry notification dispatch failed');
    } finally {
      setCheckingExpiry(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Stats calculation
  const totalCount = hostings.length;
  const activeCount = hostings.filter((h) => h.status === 'ACTIVE').length;
  const expiringSoonCount = hostings.filter((h) => h.status === 'EXPIRING_SOON').length;
  const expiredCount = hostings.filter((h) => h.status === 'EXPIRED').length;

  const getStatusBadge = (status: HostingItem['status'], days: number) => {
    if (status === 'EXPIRED' || days <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950/60 border border-red-500/30 text-red-400">
          <XCircle className="w-3.5 h-3.5" />
          Expired ({days <= 0 ? `${Math.abs(days)}d ago` : '0d'})
        </span>
      );
    }
    if (status === 'EXPIRING_SOON' || days <= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 border border-amber-500/30 text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Expiring Soon ({days}d)
        </span>
      );
    }
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Active ({days}d)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-400">
        Cancelled
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {bannerSuccess && (
        <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bannerSuccess}</span>
          </div>
          <button onClick={() => setBannerSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {bannerError && (
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
          <button onClick={() => setBannerError(null)} className="text-red-400 hover:text-red-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Server className="w-6 h-6 text-indigo-400" />
            Hosting Management
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Track hosting providers, server credentials, domains, multi-threshold expiration reminders, and renewals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCheckExpiry}
            disabled={checkingExpiry}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            title="Scan expiry dates and dispatch Telegram reminders to clients and admin"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingExpiry ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{checkingExpiry ? 'Scanning...' : 'Check Expiry Alerts'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Hosting</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[#0d0d12]/80 border border-slate-850 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-100">{totalCount}</div>
            <div className="text-xs text-slate-500">Total Accounts</div>
          </div>
        </div>

        <div className="p-4 bg-[#0d0d12]/80 border border-slate-850 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-400">{activeCount}</div>
            <div className="text-xs text-slate-500">Active</div>
          </div>
        </div>

        <div className="p-4 bg-[#0d0d12]/80 border border-slate-850 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-400">{expiringSoonCount}</div>
            <div className="text-xs text-slate-500">Expiring Soon (&le;30d)</div>
          </div>
        </div>

        <div className="p-4 bg-[#0d0d12]/80 border border-slate-850 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-red-400">{expiredCount}</div>
            <div className="text-xs text-slate-500">Expired</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search domain, provider, server host, plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#0d0d12] border border-slate-850 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-[#0d0d12] border border-slate-850 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRING_SOON">Expiring Soon</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2.5 bg-[#0d0d12] border border-slate-850 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.clientCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-xs text-slate-500">Loading hosting accounts...</p>
        </div>
      ) : hostings.length === 0 ? (
        <div className="py-16 text-center bg-[#0d0d12]/40 border border-slate-850 rounded-2xl space-y-3">
          <Server className="w-10 h-10 text-slate-650 mx-auto" />
          <h3 className="text-slate-300 font-semibold text-sm">No hosting records found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add hosting details for your clients to monitor renewals, credentials, and automated Telegram expiry reminders.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Hosting Account
          </button>
        </div>
      ) : (
        <div className="bg-[#0d0d12]/50 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-4">Domain & Provider</th>
                  <th className="px-5 py-4">Client / Project</th>
                  <th className="px-5 py-4">Status & Days Remaining</th>
                  <th className="px-5 py-4">Expiry Date</th>
                  <th className="px-5 py-4">Auto Renew</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-xs">
                {hostings.map((h) => {
                  const client = h.clientId;
                  const project = h.projectId;
                  return (
                    <tr key={h._id} className="hover:bg-slate-900/20 transition-all">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                          <span>{h.domain}</span>
                          {h.panelUrl && (
                            <a
                              href={h.panelUrl.startsWith('http') ? h.panelUrl : `https://${h.panelUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-500 hover:text-indigo-400 transition-all"
                              title="Open Hosting Panel"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span className="font-medium text-slate-400">{h.hostingProvider}</span>
                          <span>•</span>
                          <span>{h.hostingType}</span>
                          {h.planName && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400">{h.planName}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {client ? (
                          <div>
                            <Link
                              href={`/dashboard/clients/${client._id}`}
                              className="font-medium text-indigo-400 hover:underline"
                            >
                              {client.name}
                            </Link>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {client.clientCode}
                              {project ? ` • ${project.name}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {getStatusBadge(h.status, h.daysRemaining)}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        <div className="font-medium">
                          {new Date(h.expiryDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {h.renewalHistoryCount > 0 && (
                          <div className="text-[10px] text-indigo-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Renewed {h.renewalHistoryCount}x
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {h.autoRenewal ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Enabled
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Manual</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleRevealSecrets(h)}
                            className="p-1.5 bg-slate-900 hover:bg-indigo-600/10 hover:text-indigo-400 border border-slate-800 hover:border-indigo-500/30 text-slate-400 rounded-lg transition-all"
                            title="Reveal Encrypted Credentials"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedHosting(h);
                              setRenewDate(new Date(new Date(h.expiryDate).setFullYear(new Date(h.expiryDate).getFullYear() + 1)).toISOString().split('T')[0]);
                              setShowRenewModal(true);
                            }}
                            className="p-1.5 bg-slate-900 hover:bg-emerald-600/10 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/30 text-slate-400 rounded-lg transition-all"
                            title="Renew Hosting"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedHosting(h);
                              setFormData({
                                clientId: h.clientId?._id || '',
                                projectId: h.projectId?._id || '',
                                hostingProvider: h.hostingProvider,
                                customProvider: '',
                                hostingType: h.hostingType,
                                panelUrl: h.panelUrl || '',
                                serverHost: h.serverHost || '',
                                domain: h.domain,
                                port: String(h.port || ''),
                                planName: h.planName || '',
                                username: h.username || '',
                                password: '',
                                sshKey: '',
                                apiToken: '',
                                startDate: h.startDate ? new Date(h.startDate).toISOString().split('T')[0] : '',
                                expiryDate: new Date(h.expiryDate).toISOString().split('T')[0],
                                autoRenewal: h.autoRenewal,
                                notes: h.notes || '',
                              });
                              setShowEditModal(true);
                            }}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg transition-all"
                            title="Edit Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteHosting(h)}
                            className="p-1.5 bg-slate-900 hover:bg-red-600/10 hover:text-red-400 border border-slate-800 hover:border-red-500/30 text-slate-400 rounded-lg transition-all"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reveal Credentials Modal */}
      {showRevealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Encrypted Hosting Access</span>
              </div>
              <button
                onClick={() => {
                  setShowRevealModal(false);
                  setRevealedSecrets(null);
                  setSelectedHosting(null);
                }}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {revealing ? (
              <div className="py-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
                <p className="text-xs text-slate-400">Decrypting authenticated secret block...</p>
              </div>
            ) : revealedSecrets ? (
              <div className="space-y-4">
                <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Domain & Provider</div>
                  <div className="text-sm font-semibold text-slate-200">
                    {revealedSecrets.domain} ({selectedHosting?.hostingProvider})
                  </div>
                </div>

                {revealedSecrets.username && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase">Username</label>
                    <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                      <span className="font-mono text-xs text-slate-200 select-all">{revealedSecrets.username}</span>
                      <button
                        onClick={() => copyToClipboard(revealedSecrets.username, 'username')}
                        className="text-slate-400 hover:text-slate-200 p-1"
                        title="Copy Username"
                      >
                        {copiedKey === 'username' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase">Decrypted Password</label>
                  <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    <span className="font-mono text-xs text-amber-300 select-all font-semibold">
                      {revealedSecrets.password}
                    </span>
                    <button
                      onClick={() => copyToClipboard(revealedSecrets.password, 'password')}
                      className="text-slate-400 hover:text-slate-200 p-1"
                      title="Copy Password"
                    >
                      {copiedKey === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {revealedSecrets.sshKey && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase">SSH Key / Private Key</label>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                      <textarea
                        readOnly
                        value={revealedSecrets.sshKey}
                        rows={3}
                        className="w-full font-mono text-[11px] text-slate-300 bg-transparent border-none outline-none resize-none"
                      />
                      <button
                        onClick={() => copyToClipboard(revealedSecrets.sshKey, 'sshKey')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-flex items-center gap-1 font-semibold"
                      >
                        {copiedKey === 'sshKey' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copy SSH Key
                      </button>
                    </div>
                  </div>
                )}

                {revealedSecrets.apiToken && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase">API Token</label>
                    <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                      <span className="font-mono text-xs text-slate-300 truncate mr-2 select-all">{revealedSecrets.apiToken}</span>
                      <button
                        onClick={() => copyToClipboard(revealedSecrets.apiToken, 'apiToken')}
                        className="text-slate-400 hover:text-slate-200 p-1"
                      >
                        {copiedKey === 'apiToken' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300">
                  ⚠️ This action has been recorded in the immutable audit log (<b className="font-mono">HOSTING_SECRET_VIEWED</b>). Do not store or forward secrets insecurely.
                </div>
              </div>
            ) : null}

            <div className="pt-2">
              <button
                onClick={() => {
                  setShowRevealModal(false);
                  setRevealedSecrets(null);
                  setSelectedHosting(null);
                }}
                className="w-full py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-200 font-semibold text-xs rounded-xl transition-all"
              >
                Close & Mask
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Hosting Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Add Hosting Details</span>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddHosting} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Client *</label>
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Client</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.clientCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Project (Optional)</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">None / General Client Hosting</option>
                    {projects
                      .filter((p) => !formData.clientId || p.clientId?._id === formData.clientId)
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.projectCode})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Domain *</label>
                  <input
                    type="text"
                    required
                    placeholder="example.com"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Hosting Provider *</label>
                  <select
                    value={formData.hostingProvider}
                    onChange={(e) => setFormData({ ...formData, hostingProvider: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Hostinger">Hostinger</option>
                    <option value="Cloudways">Cloudways</option>
                    <option value="DigitalOcean">DigitalOcean</option>
                    <option value="AWS">AWS</option>
                    <option value="GoDaddy">GoDaddy</option>
                    <option value="SiteGround">SiteGround</option>
                    <option value="Namecheap">Namecheap</option>
                    <option value="VPS">VPS</option>
                    <option value="Shared">Shared Hosting</option>
                    <option value="Custom">Custom Provider...</option>
                  </select>
                </div>
              </div>

              {formData.hostingProvider === 'Custom' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Custom Provider Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter hosting provider name"
                    value={formData.customProvider}
                    onChange={(e) => setFormData({ ...formData, customProvider: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Hosting Type</label>
                  <select
                    value={formData.hostingType}
                    onChange={(e) => setFormData({ ...formData, hostingType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Shared">Shared</option>
                    <option value="Cloud">Cloud</option>
                    <option value="VPS">VPS</option>
                    <option value="Dedicated">Dedicated</option>
                    <option value="cPanel">cPanel</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-300">Panel URL</label>
                  <input
                    type="text"
                    placeholder="https://hpanel.hostinger.com"
                    value={formData.panelUrl}
                    onChange={(e) => setFormData({ ...formData, panelUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Server Host and Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-300">Server Host / IP</label>
                  <input
                    type="text"
                    placeholder="192.168.1.1 or srv.provider.com"
                    value={formData.serverHost}
                    onChange={(e) => setFormData({ ...formData, serverHost: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Port</label>
                  <input
                    type="text"
                    placeholder="22"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Credentials Block (Sensitive - Encrypted) */}
              <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Secure Access Credentials (AES-256-GCM Encrypted at Rest)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="admin or root"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Strong password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">SSH / Private Key (Optional)</label>
                  <textarea
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    rows={2}
                    value={formData.sshKey}
                    onChange={(e) => setFormData({ ...formData, sshKey: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Dates & Expiration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoRenewalCheckbox"
                  checked={formData.autoRenewal}
                  onChange={(e) => setFormData({ ...formData, autoRenewal: e.target.checked })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="autoRenewalCheckbox" className="text-xs text-slate-300 select-none cursor-pointer">
                  Auto Renewal Enabled with Provider
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Notes</label>
                <textarea
                  placeholder="Additional notes about DNS, nameservers, or hosting specs..."
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Hosting</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Hosting Modal */}
      {showRenewModal && selectedHosting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Renew Hosting Service</span>
              </div>
              <button onClick={() => setShowRenewModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenewHosting} className="space-y-4">
              <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Domain</div>
                <div className="text-sm font-bold text-slate-200">{selectedHosting.domain}</div>
                <div className="text-xs text-slate-400 mt-1">
                  Current Expiry:{' '}
                  <b className="text-slate-300">
                    {new Date(selectedHosting.expiryDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </b>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">New Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={renewDate}
                  onChange={(e) => setRenewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Renewal Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Renewed for 1 year via Hostinger invoice #9921"
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300">
                ℹ️ Renewing will reset all multi-threshold notification locks, reactivate status, and log an immutable renewal audit event.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Renewal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
