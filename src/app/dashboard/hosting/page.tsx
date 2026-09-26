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
    company?: string;
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
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Selected item state
  const [selectedHosting, setSelectedHosting] = useState<HostingItem | null>(null);
  const [viewingHosting, setViewingHosting] = useState<HostingItem | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<any | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Project selector search and direct client toggle
  const [projectSearch, setProjectSearch] = useState('');
  const [isDirectClientMode, setIsDirectClientMode] = useState(false);

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

  // Filter projects by search term (searches project name, code, client name, code, company)
  const filteredProjects = projects.filter((p) => {
    if (!projectSearch.trim()) return true;
    const term = projectSearch.toLowerCase();
    const projName = (p.name || '').toLowerCase();
    const projCode = (p.projectCode || '').toLowerCase();
    const clientName = (p.clientId?.name || '').toLowerCase();
    const clientCode = (p.clientId?.clientCode || '').toLowerCase();
    const company = (p.clientId?.company || '').toLowerCase();
    return (
      projName.includes(term) ||
      projCode.includes(term) ||
      clientName.includes(term) ||
      clientCode.includes(term) ||
      company.includes(term)
    );
  });

  const selectedProjectObj = projects.find((p) => p._id === formData.projectId);

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
        clientId: formData.clientId || undefined,
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
        setProjectSearch('');
        setIsDirectClientMode(false);
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
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-mono uppercase font-bold tracking-wider bg-red-950/40 border border-red-500/30 text-red-400">
          <XCircle className="w-3 h-3" />
          Expired ({days <= 0 ? `${Math.abs(days)}d ago` : '0d'})
        </span>
      );
    }
    if (status === 'EXPIRING_SOON' || days <= 30) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-mono uppercase font-bold tracking-wider bg-amber-950/40 border border-amber-500/30 text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          Expiring Soon ({days}d)
        </span>
      );
    }
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-mono uppercase font-bold tracking-wider bg-[#00d664]/10 border border-[#00d664]/30 text-[#00d664]">
          <CheckCircle2 className="w-3 h-3" />
          Active ({days}d)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-mono uppercase font-bold tracking-wider bg-[#18181b] border border-[#242428] text-[#88888e]">
        Cancelled
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {bannerSuccess && (
        <div className="p-3.5 bg-[#00d664]/10 border border-[#00d664]/30 rounded-none md:rounded-xs text-[#00d664] font-mono text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bannerSuccess}</span>
          </div>
          <button onClick={() => setBannerSuccess(null)} className="text-[#00d664] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {bannerError && (
        <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-none md:rounded-xs text-red-400 font-mono text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
          <button onClick={() => setBannerError(null)} className="text-red-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-[#ff3e00]">
              SYSTEMS // INFRASTRUCTURE
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Server className="w-5 h-5 text-[#ff3e00]" />
            Hosting Management
          </h2>
          <p className="text-xs sm:text-sm text-[#a1a1aa] mt-0.5">
            Track hosting providers, server credentials, domains, multi-threshold expiration reminders, and renewals.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleCheckExpiry}
            disabled={checkingExpiry}
            className="px-3.5 py-2 bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-[#ff3e00]/60 text-white font-mono text-xs uppercase font-bold tracking-wider rounded-xs flex items-center gap-2 transition-colors disabled:opacity-50"
            title="Scan expiry dates and dispatch Telegram reminders to clients and admin"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingExpiry ? 'animate-spin text-[#ff3e00]' : 'text-[#ff3e00]'}`} />
            <span>{checkingExpiry ? 'Scanning...' : 'Check Expiry Alerts'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-xs font-mono text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Hosting</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[#141416] border border-[#242428] rounded-xs">
          <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#a1a1aa]">Total Accounts</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-white mt-1.5">{totalCount}</div>
        </div>

        <div className="p-4 bg-[#141416] border border-[#242428] rounded-xs">
          <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#00d664]">Active Accounts</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-[#00d664] mt-1.5">{activeCount}</div>
        </div>

        <div className="p-4 bg-[#141416] border border-[#242428] rounded-xs">
          <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-amber-400">Expiring Soon (≤30d)</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-400 mt-1.5">{expiringSoonCount}</div>
        </div>

        <div className="p-4 bg-[#141416] border border-[#242428] rounded-xs">
          <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-red-400">Expired</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-red-400 mt-1.5">{expiredCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#141416] border border-[#242428] p-3 rounded-xs flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71717a] pointer-events-none" />
          <input
            type="text"
            placeholder="Search domain, provider, server host, plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-xs text-white placeholder-[#52525b] outline-none transition-all"
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-xs font-mono text-[#f5f5f2] outline-none cursor-pointer"
          >
            <option value="">ALL STATUSES</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="EXPIRING_SOON">EXPIRING SOON</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-xs font-mono text-[#f5f5f2] outline-none cursor-pointer"
          >
            <option value="">ALL CLIENTS</option>
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
          <Loader2 className="w-8 h-8 animate-spin text-[#ff3e00]" />
          <p className="font-mono text-xs uppercase tracking-wider text-[#88888e]">SYS::LOADING_HOSTING_ACCOUNTS...</p>
        </div>
      ) : hostings.length === 0 ? (
        <div className="py-16 text-center bg-[#141416] border border-[#242428] rounded-none md:rounded-xs space-y-3 p-8">
          <Server className="w-10 h-10 text-[#88888e] mx-auto" />
          <h3 className="font-mono text-sm uppercase tracking-wider font-bold text-white">SYS::NO_HOSTING_RECORDS</h3>
          <p className="font-mono text-xs text-[#88888e] max-w-sm mx-auto">
            Add hosting details for your clients to monitor renewals, credentials, and automated Telegram expiry reminders.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="crm-btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Hosting Account</span>
          </button>
        </div>
      ) : (
        <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-[#242428] bg-[#0d0d10] text-[#88888e] font-mono text-[10px] uppercase tracking-wider">
                  <th className="px-5 py-3.5">Hosting & Provider</th>
                  <th className="px-5 py-3.5">Client</th>
                  <th className="px-5 py-3.5">Project</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Expiry Date</th>
                  <th className="px-5 py-3.5">Auto Renew</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242428] font-mono text-xs">
                {hostings.map((h) => {
                  const client = h.clientId;
                  const project = h.projectId;
                  return (
                    <tr key={h._id} className="hover:bg-[#18181b]/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-white font-mono text-xs flex items-center gap-2">
                          <button
                            onClick={() => {
                              setViewingHosting(h);
                              setShowDetailModal(true);
                            }}
                            className="hover:text-[#ff3e00] hover:underline text-left cursor-pointer"
                            title="View Full Hosting Details"
                          >
                            {h.domain}
                          </button>
                          {h.panelUrl && (
                            <a
                              href={h.panelUrl.startsWith('http') ? h.panelUrl : `https://${h.panelUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#88888e] hover:text-[#ff3e00] transition-colors"
                              title="Open Hosting Panel"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-[#88888e] mt-0.5 flex items-center gap-2">
                          <span className="text-[#a1a1aa] font-semibold">{h.hostingProvider}</span>
                          <span>•</span>
                          <span>{h.hostingType}</span>
                          {h.planName && (
                            <>
                              <span>•</span>
                              <span className="text-[#a1a1aa]">{h.planName}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {client ? (
                          <div>
                            <Link
                              href={`/dashboard/clients/${client._id}`}
                              className="font-medium text-white hover:text-[#ff3e00] hover:underline block"
                            >
                              {client.name}
                            </Link>
                            <div className="text-[11px] text-[#88888e] mt-0.5">
                              <code>{client.clientCode}</code>
                              {client.company ? ` • ${client.company}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#88888e] italic">Unassigned</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {project ? (
                          <div>
                            <Link
                              href={`/dashboard/projects/${project._id}`}
                              className="font-medium text-[#a1a1aa] hover:text-white hover:underline block"
                            >
                              {project.name}
                            </Link>
                            <div className="text-[11px] text-[#ff3e00] mt-0.5 font-mono">
                              {project.projectCode}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#88888e] text-[11px] italic">General Hosting</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {getStatusBadge(h.status, h.daysRemaining)}
                      </td>

                      <td className="px-5 py-4 text-[#a1a1aa]">
                        <div className="font-medium text-white">
                          {new Date(h.expiryDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {h.renewalHistoryCount > 0 && (
                          <div className="text-[10px] text-[#ff3e00] mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Renewed {h.renewalHistoryCount}x
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {h.autoRenewal ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#00d664] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Enabled
                          </span>
                        ) : (
                          <span className="text-[#88888e] text-[11px]">Manual</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setViewingHosting(h);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-white/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs transition-colors"
                            title="View Full Hosting Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleRevealSecrets(h)}
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-[#88888e] hover:text-[#ff3e00] rounded-none md:rounded-xs transition-colors"
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
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#00d664]/50 text-[#88888e] hover:text-[#00d664] rounded-none md:rounded-xs transition-colors"
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
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-white/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs transition-colors"
                            title="Edit Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteHosting(h)}
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-red-500/50 text-[#88888e] hover:text-red-400 rounded-none md:rounded-xs transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">SYS::AUTHENTICATED_HOSTING_ACCESS</span>
              </div>
              <button
                onClick={() => {
                  setShowRevealModal(false);
                  setRevealedSecrets(null);
                  setSelectedHosting(null);
                }}
                className="text-[#88888e] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {revealing ? (
              <div className="py-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#ff3e00] mx-auto" />
                <p className="font-mono text-xs uppercase tracking-wider text-[#88888e]">SYS::DECRYPTING_AUTHENTICATED_SECRET_BLOCK...</p>
              </div>
            ) : revealedSecrets ? (
              <div className="space-y-4">
                <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-1">
                  <div className="font-mono text-[10px] text-[#88888e] font-semibold uppercase tracking-wider">Domain & Provider</div>
                  <div className="font-mono text-xs font-bold text-white">
                    {revealedSecrets.domain} ({selectedHosting?.hostingProvider})
                  </div>
                </div>

                {revealedSecrets.username && (
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-[#88888e] font-semibold uppercase tracking-wider">Username</label>
                    <div className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                      <span className="font-mono text-xs text-white select-all">{revealedSecrets.username}</span>
                      <button
                        onClick={() => copyToClipboard(revealedSecrets.username, 'username')}
                        className="text-[#88888e] hover:text-white p-1 transition-colors"
                        title="Copy Username"
                      >
                        {copiedKey === 'username' ? <Check className="w-3.5 h-3.5 text-[#00d664]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-mono text-[10px] text-[#88888e] font-semibold uppercase tracking-wider">Decrypted Password</label>
                  <div className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                    <span className="font-mono text-xs text-amber-400 select-all font-semibold">
                      {revealedSecrets.password}
                    </span>
                    <button
                      onClick={() => copyToClipboard(revealedSecrets.password, 'password')}
                      className="text-[#88888e] hover:text-white p-1 transition-colors"
                      title="Copy Password"
                    >
                      {copiedKey === 'password' ? <Check className="w-3.5 h-3.5 text-[#00d664]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {revealedSecrets.sshKey && (
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-[#88888e] font-semibold uppercase tracking-wider">SSH Key / Private Key</label>
                    <div className="p-2.5 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                      <textarea
                        readOnly
                        value={revealedSecrets.sshKey}
                        rows={3}
                        className="w-full font-mono text-[11px] text-[#a1a1aa] bg-transparent border-none outline-none resize-none"
                      />
                      <button
                        onClick={() => copyToClipboard(revealedSecrets.sshKey, 'sshKey')}
                        className="font-mono text-xs text-white hover:text-[#ff3e00] mt-1 inline-flex items-center gap-1 font-semibold transition-colors"
                      >
                        {copiedKey === 'sshKey' ? <Check className="w-3 h-3 text-[#00d664]" /> : <Copy className="w-3 h-3" />}
                        Copy SSH Key
                      </button>
                    </div>
                  </div>
                )}

                {revealedSecrets.apiToken && (
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-[#88888e] font-semibold uppercase tracking-wider">API Token</label>
                    <div className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                      <span className="font-mono text-xs text-[#a1a1aa] truncate mr-2 select-all">{revealedSecrets.apiToken}</span>
                      <button
                        onClick={() => copyToClipboard(revealedSecrets.apiToken, 'apiToken')}
                        className="text-[#88888e] hover:text-white p-1 transition-colors"
                      >
                        {copiedKey === 'apiToken' ? <Check className="w-3.5 h-3.5 text-[#00d664]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-[#18181b] border border-[#242428] rounded-none md:rounded-xs font-mono text-[11px] text-[#88888e]">
                  ⚠️ This action has been recorded in the immutable audit log (<b className="font-mono text-white">HOSTING_SECRET_VIEWED</b>). Do not store or forward secrets insecurely.
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
                className="w-full py-2.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-white font-mono uppercase font-bold text-xs rounded-none md:rounded-xs transition-colors"
              >
                Close & Mask
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hosting Detail Modal */}
      {showDetailModal && viewingHosting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::HOSTING_RECORD // {viewingHosting.domain}</span>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setViewingHosting(null);
                }}
                className="text-[#88888e] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              {/* Header Status Banner */}
              <div className="flex items-center justify-between p-3 bg-[#0d0d10] border border-[#242428]">
                <div>
                  <div className="text-white font-bold text-sm flex items-center gap-2">
                    <span>{viewingHosting.domain}</span>
                    {viewingHosting.panelUrl && (
                      <a
                        href={viewingHosting.panelUrl.startsWith('http') ? viewingHosting.panelUrl : `https://${viewingHosting.panelUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#ff3e00] hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3" /> Panel
                      </a>
                    )}
                  </div>
                  <div className="text-[#88888e] text-[11px] mt-0.5">
                    {viewingHosting.hostingProvider} • {viewingHosting.hostingType}
                    {viewingHosting.planName ? ` • ${viewingHosting.planName}` : ''}
                  </div>
                </div>
                <div>{getStatusBadge(viewingHosting.status, viewingHosting.daysRemaining)}</div>
              </div>

              {/* Client & Project Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-[#18181b]/50 border border-[#242428] space-y-1">
                  <span className="text-[10px] text-[#88888e] uppercase font-bold tracking-wider block">CLIENT INFORMATION</span>
                  {viewingHosting.clientId ? (
                    <div>
                      <Link
                        href={`/dashboard/clients/${viewingHosting.clientId._id}`}
                        className="text-white font-bold hover:text-[#ff3e00] hover:underline block"
                      >
                        {viewingHosting.clientId.name}
                      </Link>
                      <div className="text-[11px] text-[#88888e]">
                        Code: <b className="text-white">{viewingHosting.clientId.clientCode}</b>
                      </div>
                      {viewingHosting.clientId.company && (
                        <div className="text-[11px] text-[#a1a1aa]">{viewingHosting.clientId.company}</div>
                      )}
                      <div className="text-[11px] text-[#88888e] mt-1 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${viewingHosting.clientId.telegramConnected ? 'bg-[#00d664]' : 'bg-[#71717a]'}`} />
                        <span>Telegram: {viewingHosting.clientId.telegramConnected ? 'Connected' : 'Not Connected'}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#88888e] italic">Unassigned</span>
                  )}
                </div>

                <div className="p-3 bg-[#18181b]/50 border border-[#242428] space-y-1">
                  <span className="text-[10px] text-[#88888e] uppercase font-bold tracking-wider block">PROJECT ASSOCIATION</span>
                  {viewingHosting.projectId ? (
                    <div>
                      <Link
                        href={`/dashboard/projects/${viewingHosting.projectId._id}`}
                        className="text-white font-bold hover:text-[#ff3e00] hover:underline block"
                      >
                        {viewingHosting.projectId.name}
                      </Link>
                      <div className="text-[11px] text-[#ff3e00]">
                        Code: <b>{viewingHosting.projectId.projectCode}</b>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#88888e] italic">General Client Hosting (No Project)</span>
                  )}
                </div>
              </div>

              {/* Server & Infrastructure */}
              <div className="p-3 bg-[#18181b]/50 border border-[#242428] space-y-2">
                <span className="text-[10px] text-[#88888e] uppercase font-bold tracking-wider block">SERVER SPECS</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-[#88888e] text-[10px] block">SERVER HOST / IP</span>
                    <span className="text-white">{viewingHosting.serverHost || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#88888e] text-[10px] block">PORT</span>
                    <span className="text-white">{viewingHosting.port || '22'}</span>
                  </div>
                  <div>
                    <span className="text-[#88888e] text-[10px] block">USERNAME</span>
                    <span className="text-white">{viewingHosting.username || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Dates & Auto Renewal */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-[#18181b]/50 border border-[#242428]">
                <div>
                  <span className="text-[#88888e] text-[10px] block">START DATE</span>
                  <span className="text-white">
                    {viewingHosting.startDate
                      ? new Date(viewingHosting.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#88888e] text-[10px] block">EXPIRY DATE</span>
                  <span className="text-white font-bold">
                    {new Date(viewingHosting.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-[#88888e] text-[10px] block">DAYS REMAINING</span>
                  <span className={`font-bold ${viewingHosting.daysRemaining <= 0 ? 'text-red-400' : viewingHosting.daysRemaining <= 30 ? 'text-amber-400' : 'text-[#00d664]'}`}>
                    {viewingHosting.daysRemaining <= 0 ? `Expired (${Math.abs(viewingHosting.daysRemaining)}d ago)` : `${viewingHosting.daysRemaining} days`}
                  </span>
                </div>
                <div>
                  <span className="text-[#88888e] text-[10px] block">AUTO RENEWAL</span>
                  <span className={viewingHosting.autoRenewal ? 'text-[#00d664] font-semibold' : 'text-[#88888e]'}>
                    {viewingHosting.autoRenewal ? 'Enabled' : 'Manual'}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {viewingHosting.notes && (
                <div className="p-3 bg-[#18181b]/50 border border-[#242428]">
                  <span className="text-[10px] text-[#88888e] uppercase font-bold tracking-wider block mb-1">NOTES</span>
                  <p className="text-[#a1a1aa] whitespace-pre-wrap">{viewingHosting.notes}</p>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#242428]">
              <button
                onClick={() => {
                  const h = viewingHosting;
                  setShowDetailModal(false);
                  setViewingHosting(null);
                  handleRevealSecrets(h);
                }}
                className="px-3 py-2 bg-[#ff3e00]/10 hover:bg-[#ff3e00]/20 border border-[#ff3e00]/40 text-[#ff3e00] font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Reveal Credentials</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const h = viewingHosting;
                    setShowDetailModal(false);
                    setViewingHosting(null);
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
                  className="crm-btn-secondary px-3 py-2 text-xs flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setViewingHosting(null);
                  }}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Hosting Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::ADD_HOSTING_DETAILS</span>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-[#88888e] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddHosting} className="space-y-4">
              {/* Project & Derived Client Selector */}
              <div className="space-y-3 p-3 bg-[#0d0d10] border border-[#242428] rounded-none md:rounded-xs">
                <div className="flex items-center justify-between">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#ff3e00]">
                    1. Associated Project & Client *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isDirectClientMode;
                      setIsDirectClientMode(next);
                      if (next) {
                        setFormData(prev => ({ ...prev, projectId: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, clientId: '' }));
                      }
                    }}
                    className="text-[10px] font-mono text-[#88888e] hover:text-white underline transition-colors cursor-pointer"
                  >
                    {isDirectClientMode ? '← Link to Project' : 'Direct Client (No Project) →'}
                  </button>
                </div>

                {!isDirectClientMode ? (
                  <div className="space-y-2">
                    {/* Search Projects */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#52525b]" />
                      <input
                        type="text"
                        placeholder="Search projects by name, code, or client..."
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                      />
                    </div>

                    {/* Project Dropdown */}
                    <div className="space-y-1">
                      <select
                        required={!isDirectClientMode}
                        value={formData.projectId}
                        onChange={(e) => {
                          const projId = e.target.value;
                          const proj = projects.find((p) => p._id === projId);
                          if (proj) {
                            const derivedClientId = proj.clientId?._id || proj.clientId;
                            setFormData(prev => ({
                              ...prev,
                              projectId: proj._id,
                              clientId: derivedClientId ? String(derivedClientId) : '',
                            }));
                          } else {
                            setFormData(prev => ({ ...prev, projectId: '', clientId: '' }));
                          }
                        }}
                        className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
                      >
                        <option value="">Select Project (Client auto-derived) ▼</option>
                        {filteredProjects.map((p) => {
                          const clientName = p.clientId?.name || 'Client';
                          const clientCode = p.clientId?.clientCode ? ` [${p.clientId.clientCode}]` : '';
                          return (
                            <option key={p._id} value={p._id}>
                              {clientName}{clientCode} — {p.name} ({p.projectCode})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Derived Client Info Display */}
                    {selectedProjectObj ? (
                      <div className="p-3 bg-[#141416] border border-[#00d664]/30 rounded-none md:rounded-xs space-y-1.5 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase font-bold text-[#00d664] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" /> Client Automatically Populated
                          </span>
                          <span className="font-mono text-[10px] text-[#88888e]">
                            Code: <b className="text-white">{selectedProjectObj.clientId?.clientCode || 'N/A'}</b>
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                          <div>
                            <span className="text-[#88888e] text-[10px] block">CLIENT</span>
                            <span className="text-white font-bold">{selectedProjectObj.clientId?.name || 'Unknown'}</span>
                            {selectedProjectObj.clientId?.company && (
                              <span className="text-[#a1a1aa] text-[11px] block">{selectedProjectObj.clientId.company}</span>
                            )}
                          </div>
                          <div>
                            <span className="text-[#88888e] text-[10px] block">PROJECT</span>
                            <span className="text-[#ff3e00] font-bold">{selectedProjectObj.name}</span>
                            <span className="text-[#88888e] text-[11px] block">Code: {selectedProjectObj.projectCode}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-[#141416]/50 border border-dashed border-[#242428] text-center font-mono text-[11px] text-[#88888e]">
                        Select a project above to automatically populate and lock the associated client.
                      </div>
                    )}
                  </div>
                ) : (
                  /* Direct Client Mode (fallback when hosting has no project) */
                  <div className="space-y-2">
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e]">
                      Client (Direct / No Project) *
                    </label>
                    <select
                      required={isDirectClientMode}
                      value={formData.clientId}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value, projectId: '' }))}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
                    >
                      <option value="">Select Client Directly ▼</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.clientCode}) {c.company ? `• ${c.company}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Domain *</label>
                  <input
                    type="text"
                    required
                    placeholder="example.com"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Hosting Provider *</label>
                  <select
                    value={formData.hostingProvider}
                    onChange={(e) => setFormData({ ...formData, hostingProvider: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
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
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Custom Provider Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter hosting provider name"
                    value={formData.customProvider}
                    onChange={(e) => setFormData({ ...formData, customProvider: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Hosting Type</label>
                  <select
                    value={formData.hostingType}
                    onChange={(e) => setFormData({ ...formData, hostingType: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
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
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Panel URL</label>
                  <input
                    type="text"
                    placeholder="https://hpanel.hostinger.com"
                    value={formData.panelUrl}
                    onChange={(e) => setFormData({ ...formData, panelUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
                </div>
              </div>

              {/* Server Host and Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Server Host / IP</label>
                  <input
                    type="text"
                    placeholder="192.168.1.1 or srv.provider.com"
                    value={formData.serverHost}
                    onChange={(e) => setFormData({ ...formData, serverHost: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Port</label>
                  <input
                    type="text"
                    placeholder="22"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
                </div>
              </div>

              {/* Credentials Block (Sensitive - Encrypted) */}
              <div className="p-4 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-3">
                <div className="flex items-center gap-2 text-white font-mono font-semibold text-xs uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-[#ff3e00]" />
                  <span>SECURE_CREDENTIALS // AES-256-GCM</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="admin or root"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-[#141416] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Strong password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-[#141416] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">SSH / Private Key (Optional)</label>
                  <textarea
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    rows={2}
                    value={formData.sshKey}
                    onChange={(e) => setFormData({ ...formData, sshKey: e.target.value })}
                    className="w-full px-3 py-2 bg-[#141416] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs text-white font-mono placeholder-[#52525b] outline-none"
                  />
                </div>
              </div>

              {/* Dates & Expiration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoRenewalCheckbox"
                  checked={formData.autoRenewal}
                  onChange={(e) => setFormData({ ...formData, autoRenewal: e.target.checked })}
                  className="rounded-none border-[#242428] bg-[#0a0a0a] text-[#ff3e00] focus:ring-0"
                />
                <label htmlFor="autoRenewalCheckbox" className="font-mono text-xs text-[#a1a1aa] select-none cursor-pointer">
                  Auto Renewal Enabled with Provider
                </label>
              </div>

              <div className="space-y-1">
                <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Notes</label>
                <textarea
                  placeholder="Additional notes about DNS, nameservers, or hosting specs..."
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="crm-btn-primary px-5 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Hosting</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Hosting Modal */}
      {showEditModal && selectedHosting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::EDIT_HOSTING_RECORD // {selectedHosting.domain}</span>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-[#88888e] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditHosting} className="space-y-4">
              {/* Project & Client Relationship */}
              <div className="p-3 bg-[#0d0d10] border border-[#242428] rounded-none md:rounded-xs space-y-2 font-mono">
                <span className="text-[10px] font-bold text-[#88888e] uppercase tracking-wider block">
                  Project & Client Association
                </span>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase text-[#88888e]">Change Project (Updates Client Automatically)</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => {
                      const projId = e.target.value;
                      const proj = projects.find((p) => p._id === projId);
                      if (proj) {
                        const derivedClientId = proj.clientId?._id || proj.clientId;
                        setFormData(prev => ({
                          ...prev,
                          projectId: proj._id,
                          clientId: derivedClientId ? String(derivedClientId) : '',
                        }));
                      } else {
                        setFormData(prev => ({ ...prev, projectId: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs text-white outline-none"
                  >
                    <option value="">No Specific Project / Keep General</option>
                    {projects.map((p) => {
                      const clientName = p.clientId?.name || 'Client';
                      const clientCode = p.clientId?.clientCode ? ` [${p.clientId.clientCode}]` : '';
                      return (
                        <option key={p._id} value={p._id}>
                          {clientName}{clientCode} — {p.name} ({p.projectCode})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#242428] text-xs">
                  <div>
                    <span className="text-[#88888e] text-[10px] block">CLIENT</span>
                    <span className="text-white font-bold">
                      {projects.find(p => p._id === formData.projectId)?.clientId?.name ||
                       selectedHosting.clientId?.name || 'N/A'}
                    </span>
                    <span className="text-[#88888e] text-[11px] block">
                      Code: {projects.find(p => p._id === formData.projectId)?.clientId?.clientCode ||
                             selectedHosting.clientId?.clientCode || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#88888e] text-[10px] block">PROJECT</span>
                    <span className="text-[#ff3e00] font-bold">
                      {projects.find(p => p._id === formData.projectId)?.name ||
                       selectedHosting.projectId?.name || 'General Client Hosting'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Domain *</label>
                  <input
                    type="text"
                    required
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Hosting Provider *</label>
                  <select
                    value={formData.hostingProvider}
                    onChange={(e) => setFormData({ ...formData, hostingProvider: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Hosting Type</label>
                  <select
                    value={formData.hostingType}
                    onChange={(e) => setFormData({ ...formData, hostingType: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
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
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Panel URL</label>
                  <input
                    type="text"
                    value={formData.panelUrl}
                    onChange={(e) => setFormData({ ...formData, panelUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
                </div>
              </div>

              {/* Server Host and Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Server Host / IP</label>
                  <input
                    type="text"
                    placeholder="192.168.1.1 or srv.provider.com"
                    value={formData.serverHost}
                    onChange={(e) => setFormData({ ...formData, serverHost: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Port</label>
                  <input
                    type="text"
                    placeholder="22"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
                </div>
              </div>

              {/* Credentials Update (Leave blank to keep existing) */}
              <div className="p-4 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-3">
                <div className="flex items-center gap-2 text-white font-mono font-semibold text-xs uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-[#ff3e00]" />
                  <span>UPDATE_CREDENTIALS (LEAVE EMPTY TO KEEP EXISTING)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Username</label>
                    <input
                      type="text"
                      placeholder="Username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-[#141416] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">New Password</label>
                    <input
                      type="password"
                      placeholder="Leave blank to keep current"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-[#141416] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">SSH Key</label>
                  <textarea
                    placeholder="Leave blank to keep current SSH key"
                    rows={2}
                    value={formData.sshKey}
                    onChange={(e) => setFormData({ ...formData, sshKey: e.target.value })}
                    className="w-full px-3 py-2 bg-[#141416] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs text-white font-mono placeholder-[#52525b] outline-none"
                  />
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-1">
                <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editAutoRenewalCheckbox"
                  checked={formData.autoRenewal}
                  onChange={(e) => setFormData({ ...formData, autoRenewal: e.target.checked })}
                  className="rounded-none border-[#242428] bg-[#0a0a0a] text-[#ff3e00] focus:ring-0"
                />
                <label htmlFor="editAutoRenewalCheckbox" className="font-mono text-xs text-[#a1a1aa] select-none cursor-pointer">
                  Auto Renewal Enabled with Provider
                </label>
              </div>

              <div className="space-y-1">
                <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="crm-btn-primary px-5 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Hosting</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Hosting Modal */}
      {showRenewModal && selectedHosting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-[#00d664]" />
                <span>SYS::RENEW_HOSTING_SERVICE</span>
              </div>
              <button onClick={() => setShowRenewModal(false)} className="text-[#88888e] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenewHosting} className="space-y-4">
              <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-1">
                <div className="font-mono text-[10px] text-[#88888e] font-semibold uppercase tracking-wider">Domain</div>
                <div className="font-mono text-xs font-bold text-white">{selectedHosting.domain}</div>
                <div className="font-mono text-[11px] text-[#88888e] mt-1">
                  Current Expiry:{' '}
                  <b className="text-white">
                    {new Date(selectedHosting.expiryDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </b>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">New Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={renewDate}
                  onChange={(e) => setRenewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Renewal Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Renewed for 1 year via Hostinger invoice #9921"
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                />
              </div>

              <div className="p-3 bg-[#18181b] border border-[#00d664]/30 rounded-none md:rounded-xs font-mono text-[11px] text-[#88888e]">
                ℹ️ Renewing will reset all multi-threshold notification locks, reactivate status, and log an immutable renewal audit event.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="crm-btn-primary px-5 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
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
