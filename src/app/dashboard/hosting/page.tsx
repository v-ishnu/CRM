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
  Globe,
  Key,
} from 'lucide-react';
import { useMasterData } from '@/hooks/useMasterData';

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
  websites?: Array<{
    _id: string;
    domain: string;
    expiryDate: string;
    daysRemaining: number;
    status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
    notes?: string;
    credentialCount: number;
  }>;
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

  // Website modals & state
  const [showAddWebsiteModal, setShowAddWebsiteModal] = useState(false);
  const [showEditWebsiteModal, setShowEditWebsiteModal] = useState(false);
  const [showWebsiteCredentialsModal, setShowWebsiteCredentialsModal] = useState(false);
  const [showViewDomainModal, setShowViewDomainModal] = useState(false);
  const [activeWebsite, setActiveWebsite] = useState<any>(null);
  const [viewingDomain, setViewingDomain] = useState<any>(null);
  const [websiteCredentials, setWebsiteCredentials] = useState<any[]>([]);
  const [websiteCredLoading, setWebsiteCredLoading] = useState(false);
  const [revealedWebsiteCreds, setRevealedWebsiteCreds] = useState<Record<string, string>>({});

  const [websiteFormData, setWebsiteFormData] = useState({
    domain: '',
    expiryDate: '',
    status: 'ACTIVE',
    notes: '',
  });

  const [addWebsiteCredEnabled, setAddWebsiteCredEnabled] = useState(false);
  const [initialCredForm, setInitialCredForm] = useState({
    service: 'WordPress Admin',
    credentialType: 'HOSTING',
    username: '',
    password: '',
    loginUrl: '',
  });

  const [editWebsiteFormData, setEditWebsiteFormData] = useState({
    domain: '',
    expiryDate: '',
    status: 'ACTIVE',
    notes: '',
  });

  const [newWebsiteCredForm, setNewWebsiteCredForm] = useState({
    service: 'WordPress Admin',
    username: '',
    password: '',
    loginUrl: '',
    additionalInfo: '',
    credentialType: 'HOSTING',
  });

  // Selected item state
  const [selectedHosting, setSelectedHosting] = useState<HostingItem | null>(null);
  const [viewingHosting, setViewingHosting] = useState<HostingItem | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<any | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Project selector search and direct client toggle
  const [projectSearch, setProjectSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isDirectClientMode, setIsDirectClientMode] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);

  const { items: masterProviders } = useMasterData('HOSTING_PROVIDER');
  const { items: masterTypes } = useMasterData('HOSTING_TYPE');

  const defaultProviders = [
    'Hostinger',
    'Cloudways',
    'DigitalOcean',
    'AWS',
    'GoDaddy',
    'SiteGround',
    'Namecheap',
    'VPS',
    'Shared',
  ];
  const renderedProviders = masterProviders.length > 0
    ? masterProviders.map((p) => p.label)
    : defaultProviders;

  const defaultTypes = [
    'Shared',
    'Cloud',
    'VPS',
    'Dedicated',
    'cPanel',
  ];
  const renderedTypes = masterTypes.length > 0
    ? masterTypes.map((t) => t.label)
    : defaultTypes;

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

  // Filter direct clients by search term (name, code, company, email)
  const filteredClients = clients.filter((c) => {
    if (!clientSearch.trim()) return true;
    const term = clientSearch.toLowerCase();
    const name = (c.name || '').toLowerCase();
    const code = (c.clientCode || '').toLowerCase();
    const company = (c.company || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    return name.includes(term) || code.includes(term) || company.includes(term) || email.includes(term);
  });

  const selectedProjectObj = projects.find((p) => p._id === formData.projectId);
  const selectedClientObj = clients.find((c) => c._id === formData.clientId);

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

  const fetchClients = async () => {
    try {
      setClientsLoading(true);
      setClientsError(null);
      const res = await fetch('/api/clients?limit=500');
      const json = await res.json();
      if (json.success) {
        const clientList = Array.isArray(json.clients)
          ? json.clients
          : Array.isArray(json.data?.clients)
            ? json.data.clients
            : Array.isArray(json.data)
              ? json.data
              : [];
        setClients(clientList);
      } else {
        setClientsError(json.error?.message || 'Unable to load clients.');
      }
    } catch (err: any) {
      console.error('Failed to load clients for hosting:', err);
      setClientsError('Unable to load clients. Retry.');
    } finally {
      setClientsLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      setClientsLoading(true);
      setClientsError(null);
      const [clientsRes, projectsRes] = await Promise.all([
        fetch('/api/clients?limit=500'),
        fetch('/api/projects'),
      ]);
      const [clientsJson, projectsJson] = await Promise.all([
        clientsRes.json(),
        projectsRes.json(),
      ]);
      if (clientsJson.success) {
        const clientList = Array.isArray(clientsJson.clients)
          ? clientsJson.clients
          : Array.isArray(clientsJson.data?.clients)
            ? clientsJson.data.clients
            : Array.isArray(clientsJson.data)
              ? clientsJson.data
              : [];
        setClients(clientList);
      } else {
        setClientsError(clientsJson.error?.message || 'Unable to load clients.');
      }
      if (projectsJson.success) {
        setProjects(projectsJson.data || []);
      }
    } catch (err) {
      console.error('Failed to load clients/projects for hosting:', err);
      setClientsError('Unable to load clients. Retry.');
    } finally {
      setClientsLoading(false);
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
        domain: '', // Domain creation happens after Hosting account creation
        hostingProvider: provider,
        projectId: isDirectClientMode ? null : (formData.projectId || undefined),
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
        setBannerSuccess(`Hosting account "${provider}" added successfully. You can now add domains to this hosting account.`);
        setShowAddModal(false);
        setProjectSearch('');
        setClientSearch('');
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
        port: formData.port || undefined,
        planName: formData.planName,
        username: formData.username,
        autoRenewal: formData.autoRenewal,
        notes: formData.notes,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined,
        projectId: formData.projectId || undefined,
      };
      if (formData.domain) {
        payload.domain = formData.domain;
      }

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
        setBannerSuccess(`Hosting account "${provider}" updated successfully.`);
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

  // Website / Domain Handlers
  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingHosting) return;
    try {
      setSubmitting(true);
      const payload: any = {
        ...websiteFormData,
      };

      if (
        addWebsiteCredEnabled &&
        initialCredForm.username.trim() &&
        initialCredForm.password.trim()
      ) {
        payload.initialCredential = {
          service: initialCredForm.service.trim() || 'WordPress Admin',
          credentialType: initialCredForm.credentialType || 'HOSTING',
          username: initialCredForm.username.trim(),
          password: initialCredForm.password.trim(),
          loginUrl: initialCredForm.loginUrl.trim() || undefined,
        };
      }

      const res = await fetch(`/api/hosting/${viewingHosting._id}/websites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBannerSuccess(`Domain "${websiteFormData.domain}" added successfully!`);
        setShowAddWebsiteModal(false);
        setWebsiteFormData({
          domain: '',
          expiryDate: '',
          status: 'ACTIVE',
          notes: '',
        });
        setAddWebsiteCredEnabled(false);
        setInitialCredForm({
          service: 'WordPress Admin',
          credentialType: 'HOSTING',
          username: '',
          password: '',
          loginUrl: '',
        });
        await fetchHostings();
        const updatedRes = await fetch(`/api/hosting/${viewingHosting._id}`);
        const updatedData = await updatedRes.json();
        if (updatedData.success) {
          setViewingHosting(updatedData.data);
        }
      } else {
        setBannerError(data.error?.message || 'Failed to add domain');
      }
    } catch {
      setBannerError('Error adding domain to hosting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingHosting || !activeWebsite) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/hosting/${viewingHosting._id}/websites/${activeWebsite._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editWebsiteFormData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBannerSuccess(`Domain "${editWebsiteFormData.domain}" updated successfully!`);
        setShowEditWebsiteModal(false);
        await fetchHostings();
        const updatedRes = await fetch(`/api/hosting/${viewingHosting._id}`);
        const updatedData = await updatedRes.json();
        if (updatedData.success) {
          setViewingHosting(updatedData.data);
          if (viewingDomain && viewingDomain._id === activeWebsite._id) {
            const updatedDomain = updatedData.data.websites?.find((w: any) => w._id === activeWebsite._id);
            if (updatedDomain) setViewingDomain(updatedDomain);
          }
        }
      } else {
        setBannerError(data.error?.message || 'Failed to update domain');
      }
    } catch {
      setBannerError('Error updating domain');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWebsite = async (website: any) => {
    if (!viewingHosting) return;
    if (!confirm(`Are you sure you want to deactivate domain "${website.domain}"?`)) return;
    try {
      const res = await fetch(`/api/hosting/${viewingHosting._id}/websites/${website._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBannerSuccess(`Domain "${website.domain}" deactivated.`);
        if (showViewDomainModal && viewingDomain?._id === website._id) {
          setShowViewDomainModal(false);
          setViewingDomain(null);
        }
        await fetchHostings();
        const updatedRes = await fetch(`/api/hosting/${viewingHosting._id}`);
        const updatedData = await updatedRes.json();
        if (updatedData.success) {
          setViewingHosting(updatedData.data);
        }
      } else {
        setBannerError(data.error?.message || 'Failed to deactivate domain');
      }
    } catch {
      setBannerError('Error deactivating domain');
    }
  };

  const handleOpenViewDomain = async (website: any, hosting?: HostingItem) => {
    const parentHosting = hosting || viewingHosting;
    if (!parentHosting) return;
    if (!viewingHosting || viewingHosting._id !== parentHosting._id) {
      setViewingHosting(parentHosting);
    }
    setActiveWebsite(website);
    setViewingDomain(website);
    setShowViewDomainModal(true);
    setWebsiteCredentials([]);
    setRevealedWebsiteCreds({});
    try {
      const res = await fetch(`/api/hosting/${parentHosting._id}/websites/${website._id}/credentials`);
      const data = await res.json();
      if (data.success) {
        setWebsiteCredentials(data.data || []);
      }
    } catch {
      setWebsiteCredentials([]);
    }
  };

  const handleOpenWebsiteCredentials = async (website: any, hosting?: HostingItem) => {
    const parentHosting = hosting || viewingHosting;
    if (!parentHosting) return;
    if (!viewingHosting || viewingHosting._id !== parentHosting._id) {
      setViewingHosting(parentHosting);
    }
    setActiveWebsite(website);
    setShowWebsiteCredentialsModal(true);
    setWebsiteCredLoading(true);
    setRevealedWebsiteCreds({});
    try {
      const res = await fetch(`/api/hosting/${parentHosting._id}/websites/${website._id}/credentials`);
      const data = await res.json();
      if (data.success) {
        setWebsiteCredentials(data.data || []);
      }
    } catch {
      setWebsiteCredentials([]);
    } finally {
      setWebsiteCredLoading(false);
    }
  };

  const handleAddWebsiteCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentWebsite = activeWebsite || viewingDomain;
    if (!viewingHosting || !currentWebsite) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/hosting/${viewingHosting._id}/websites/${currentWebsite._id}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWebsiteCredForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBannerSuccess('Website credential saved successfully!');
        setNewWebsiteCredForm({
          service: 'WordPress Admin',
          username: '',
          password: '',
          loginUrl: '',
          additionalInfo: '',
          credentialType: 'HOSTING',
        });
        const credsRes = await fetch(`/api/hosting/${viewingHosting._id}/websites/${currentWebsite._id}/credentials`);
        const credsData = await credsRes.json();
        if (credsData.success) {
          setWebsiteCredentials(credsData.data || []);
        }
        await fetchHostings();
        const updatedRes = await fetch(`/api/hosting/${viewingHosting._id}`);
        const updatedData = await updatedRes.json();
        if (updatedData.success) {
          setViewingHosting(updatedData.data);
        }
      } else {
        alert(data.error?.message || 'Failed to add credential');
      }
    } catch {
      alert('Error saving credential');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevealWebsiteCredential = async (credentialId: string) => {
    const currentWebsite = activeWebsite || viewingDomain;
    if (!viewingHosting || !currentWebsite) return;
    if (revealedWebsiteCreds[credentialId]) {
      const next = { ...revealedWebsiteCreds };
      delete next[credentialId];
      setRevealedWebsiteCreds(next);
      return;
    }
    try {
      const res = await fetch(`/api/hosting/${viewingHosting._id}/websites/${currentWebsite._id}/credentials/${credentialId}/reveal`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRevealedWebsiteCreds((prev) => ({
          ...prev,
          [credentialId]: data.data.password,
        }));
      } else {
        alert(data.error?.message || 'Failed to reveal credential');
      }
    } catch {
      alert('Error revealing credential');
    }
  };

  const handleDeleteWebsiteCredential = async (credentialId: string) => {
    const currentWebsite = activeWebsite || viewingDomain;
    if (!viewingHosting || !currentWebsite) return;
    if (!confirm('Are you sure you want to delete this credential?')) return;
    try {
      const res = await fetch(`/api/hosting/${viewingHosting._id}/websites/${currentWebsite._id}/credentials/${credentialId}/reveal`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWebsiteCredentials((prev) => prev.filter((c) => c._id !== credentialId));
        await fetchHostings();
        const updatedRes = await fetch(`/api/hosting/${viewingHosting._id}`);
        const updatedData = await updatedRes.json();
        if (updatedData.success) {
          setViewingHosting(updatedData.data);
        }
      } else {
        alert(data.error?.message || 'Failed to delete credential');
      }
    } catch {
      alert('Error deleting credential');
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

  const totalWebsitesCount = hostings.reduce((sum, h) => sum + (h.websites?.length || 1), 0);
  const expiringWebsitesCount = hostings.reduce((sum, h) => {
    const ws = h.websites && h.websites.length > 0 ? h.websites : [{ status: h.status }];
    return sum + ws.filter((w: any) => w.status === 'EXPIRING_SOON').length;
  }, 0);

  const getStatusBadge = (status: HostingItem['status'] | 'SUSPENDED', days: number) => {
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
    if (status === 'SUSPENDED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-mono uppercase font-bold tracking-wider bg-purple-950/40 border border-purple-500/30 text-purple-300">
          Suspended
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
            Track hosting accounts, multiple websites per hosting, independent expiries, server credentials, and renewals.
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
          <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#a1a1aa]">Total Accounts / Websites</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-white mt-1.5 flex items-baseline gap-2">
            <span>{totalCount}</span>
            <span className="text-xs text-[#88888e] font-normal">({totalWebsitesCount} websites)</span>
          </div>
        </div>

        <div className="p-4 bg-[#141416] border border-[#242428] rounded-xs">
          <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#00d664]">Active Accounts</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-[#00d664] mt-1.5">{activeCount}</div>
        </div>

        <div className="p-4 bg-[#141416] border border-[#242428] rounded-xs">
          <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-amber-400">Expiring Soon (≤30d)</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-400 mt-1.5 flex items-baseline gap-2">
            <span>{expiringSoonCount}</span>
            {expiringWebsitesCount > 0 && (
              <span className="text-xs text-amber-400/80 font-normal">({expiringWebsitesCount} websites)</span>
            )}
          </div>
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
            placeholder="Search domain (e.g. drdebuggers.com), provider, plan, host, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-xs text-white placeholder-[#52525b] outline-none transition-all"
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="crm-select-sm"
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
            className="crm-select-sm"
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
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-[#242428] bg-[#0d0d10] text-[#88888e] font-mono text-[10px] uppercase tracking-wider">
                  <th className="px-5 py-3.5">Hosting Provider & Plan</th>
                  <th className="px-5 py-3.5">Domains / Websites</th>
                  <th className="px-5 py-3.5">Client</th>
                  <th className="px-5 py-3.5">Project</th>
                  <th className="px-5 py-3.5">Hosting Expiry</th>
                  <th className="px-5 py-3.5">Hosting Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242428] font-mono text-xs">
                {hostings.map((h) => {
                  const client = h.clientId;
                  const project = h.projectId;
                  const domainList = h.websites && h.websites.length > 0
                    ? h.websites
                    : [{ _id: h._id, domain: h.domain, expiryDate: h.expiryDate, status: h.status, credentialCount: 0 }];

                  return (
                    <tr key={h._id} className="hover:bg-[#18181b]/50 transition-colors">
                      {/* Provider & Server */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-white font-mono text-xs flex items-center gap-2">
                          <button
                            onClick={() => {
                              setViewingHosting(h);
                              setShowDetailModal(true);
                            }}
                            className="hover:text-[#ff3e00] hover:underline text-left cursor-pointer flex items-center gap-1.5"
                            title="View Full Hosting Details"
                          >
                            <Server className="w-3.5 h-3.5 text-[#ff3e00]" />
                            <span>{h.hostingProvider}</span>
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
                        <div className="text-[11px] text-[#88888e] mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[#a1a1aa] font-semibold">{h.hostingType}</span>
                          {h.planName && (
                            <>
                              <span>•</span>
                              <span className="text-[#d4d4d8]">{h.planName}</span>
                            </>
                          )}
                        </div>
                        {h.serverHost && (
                          <div className="text-[10px] text-[#71717a] mt-0.5 font-mono">
                            Host: {h.serverHost}
                          </div>
                        )}
                      </td>

                      {/* Domains / Websites */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-[#1f1f23] text-white rounded-xs text-[10px] font-bold border border-[#27272a] inline-flex items-center gap-1">
                              <span>🌐</span>
                              <span>{domainList.length} {domainList.length === 1 ? 'Domain' : 'Domains'}</span>
                            </span>
                          </div>
                          <div className="space-y-1">
                            {domainList.slice(0, 3).map((w: any) => (
                              <div key={w._id} className="flex items-center gap-1.5 text-[11px] flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenViewDomain(w, h)}
                                  className="text-white hover:text-[#ff3e00] hover:underline font-mono font-medium text-left flex items-center gap-1 cursor-pointer"
                                  title="Click to view domain details & credentials"
                                >
                                  <span>{w.domain}</span>
                                </button>
                                <span className="text-[10px] text-[#88888e] font-mono">
                                  ({new Date(w.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})
                                </span>
                                {w.credentialCount > 0 && (
                                  <span className="px-1 py-0.2 bg-[#27272a] text-[#a1a1aa] rounded-xs text-[9px] font-mono">
                                    {w.credentialCount} creds
                                  </span>
                                )}
                              </div>
                            ))}
                            {domainList.length > 3 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingHosting(h);
                                  setShowDetailModal(true);
                                }}
                                className="text-[10px] text-[#ff3e00] hover:underline block font-mono cursor-pointer"
                              >
                                +{domainList.length - 3} more domains...
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Client */}
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

                      {/* Project */}
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
                          <span className="text-[#88888e] text-[11px] italic">Direct Client (No Project)</span>
                        )}
                      </td>

                      {/* Hosting Expiry */}
                      <td className="px-5 py-4 text-[#a1a1aa]">
                        <div className="font-mono text-[9px] uppercase tracking-wider text-[#88888e] font-bold">
                          HOSTING EXPIRY
                        </div>
                        <div className="font-bold text-white text-xs mt-0.5">
                          {new Date(h.expiryDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="mt-1">
                          <span className={`text-[10px] font-mono font-semibold ${h.daysRemaining <= 0 ? 'text-red-400' : h.daysRemaining <= 30 ? 'text-amber-400' : 'text-[#00d664]'
                            }`}>
                            {h.daysRemaining <= 0 ? `Expired (${Math.abs(h.daysRemaining)}d ago)` : `Expires in ${h.daysRemaining}d`}
                          </span>
                        </div>
                        {h.renewalHistoryCount > 0 && (
                          <div className="text-[10px] text-[#ff3e00] mt-0.5 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            Renewed {h.renewalHistoryCount}x
                          </div>
                        )}
                      </td>

                      {/* Hosting Status */}
                      <td className="px-5 py-4">
                        <div className="font-mono text-[9px] uppercase tracking-wider text-[#88888e] font-bold mb-1">
                          HOSTING STATUS
                        </div>
                        {getStatusBadge(h.status, h.daysRemaining)}
                        {h.autoRenewal && (
                          <div className="text-[10px] text-[#00d664] mt-1 flex items-center gap-1 font-mono">
                            <CheckCircle2 className="w-3 h-3" />
                            Auto-Renew On
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setViewingHosting(h);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-white/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer"
                            title="View Full Hosting Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleRevealSecrets(h)}
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-[#88888e] hover:text-[#ff3e00] rounded-none md:rounded-xs transition-colors cursor-pointer"
                            title="Manage Hosting Secrets"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedHosting(h);
                              setRenewDate(new Date(new Date(h.expiryDate).setFullYear(new Date(h.expiryDate).getFullYear() + 1)).toISOString().split('T')[0]);
                              setShowRenewModal(true);
                            }}
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#00d664]/50 text-[#88888e] hover:text-[#00d664] rounded-none md:rounded-xs transition-colors cursor-pointer"
                            title="Renew Hosting Account"
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
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-white/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs transition-colors cursor-pointer"
                            title="Edit Hosting Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteHosting(h)}
                            className="p-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-red-500/50 text-[#88888e] hover:text-red-400 rounded-none md:rounded-xs transition-colors cursor-pointer"
                            title="Delete Hosting Account"
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
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::HOSTING_ACCOUNT // {viewingHosting.hostingProvider} — {viewingHosting.domain}</span>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setViewingHosting(null);
                }}
                className="text-[#88888e] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              {/* Header Status Banner */}
              <div className="flex items-center justify-between p-3.5 bg-[#0d0d10] border border-[#242428]">
                <div>
                  <div className="text-white font-bold text-sm flex items-center gap-2">
                    <Server className="w-4 h-4 text-[#ff3e00]" />
                    <span>{viewingHosting.hostingProvider}</span>
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
                    Plan: <span className="text-[#d4d4d8] font-semibold">{viewingHosting.planName || 'Standard'}</span> • Type: <span className="text-[#a1a1aa]">{viewingHosting.hostingType}</span> • Primary: <span className="text-white">{viewingHosting.domain}</span>
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
                    <span className="text-[#88888e] text-[11px] italic">Direct Client (No Project Associated)</span>
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
                    <span className="text-[#88888e] text-[10px] block">ROOT / USERNAME</span>
                    <span className="text-white">{viewingHosting.username || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Dates & Auto Renewal (Explicitly Hosting Expiry) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-[#18181b]/50 border border-[#242428]">
                <div>
                  <span className="text-[#88888e] text-[10px] block uppercase font-bold">START DATE</span>
                  <span className="text-white">
                    {viewingHosting.startDate
                      ? new Date(viewingHosting.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#ff3e00] text-[10px] block uppercase font-bold">HOSTING EXPIRY</span>
                  <span className="text-white font-bold">
                    {new Date(viewingHosting.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-[#88888e] text-[10px] block uppercase font-bold">DAYS REMAINING</span>
                  <span className={`font-bold ${viewingHosting.daysRemaining <= 0 ? 'text-red-400' : viewingHosting.daysRemaining <= 30 ? 'text-amber-400' : 'text-[#00d664]'}`}>
                    {viewingHosting.daysRemaining <= 0 ? `Expired (${Math.abs(viewingHosting.daysRemaining)}d ago)` : `${viewingHosting.daysRemaining} days`}
                  </span>
                </div>
                <div>
                  <span className="text-[#88888e] text-[10px] block uppercase font-bold">AUTO RENEWAL</span>
                  <span className={viewingHosting.autoRenewal ? 'text-[#00d664] font-semibold' : 'text-[#88888e]'}>
                    {viewingHosting.autoRenewal ? 'Enabled' : 'Manual'}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {viewingHosting.notes && (
                <div className="p-3 bg-[#18181b]/50 border border-[#242428]">
                  <span className="text-[10px] text-[#88888e] uppercase font-bold tracking-wider block mb-1">HOSTING NOTES</span>
                  <p className="text-[#a1a1aa] whitespace-pre-wrap">{viewingHosting.notes}</p>
                </div>
              )}

              {/* Dedicated HOSTING-LEVEL CREDENTIALS Section */}
              <div className="p-3.5 bg-[#18181b]/50 border border-[#242428] rounded-xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] text-white uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#ff3e00]" />
                      HOSTING-LEVEL CREDENTIALS
                    </span>
                    <p className="text-[10px] text-[#88888e] mt-0.5">
                      Server, panel, SSH, and provider account secrets belonging to the hosting infrastructure.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevealSecrets(viewingHosting)}
                    className="px-3 py-1.5 bg-[#ff3e00]/10 hover:bg-[#ff3e00]/20 border border-[#ff3e00]/40 text-[#ff3e00] font-mono text-xs font-bold rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Manage Hosting Credentials</span>
                  </button>
                </div>
              </div>

              {/* Dedicated DOMAINS / WEBSITES Section */}
              <div className="p-3.5 bg-[#18181b]/50 border border-[#242428] rounded-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#242428] flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white uppercase font-bold tracking-wider">
                        DOMAINS / WEBSITES ({viewingHosting.websites?.length || 1})
                      </span>
                      <span className="px-2 py-0.5 bg-[#ff3e00]/10 border border-[#ff3e00]/30 text-[#ff3e00] text-[10px] font-mono font-bold rounded-xs">
                        Independent Expiries & Credentials
                      </span>
                    </div>
                    <p className="text-[10px] text-[#88888e] mt-0.5">
                      Each domain has its own independent domain expiry date, status, notes, and credentials.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWebsiteFormData({
                        domain: '',
                        expiryDate: viewingHosting.expiryDate ? new Date(viewingHosting.expiryDate).toISOString().split('T')[0] : '',
                        status: 'ACTIVE',
                        notes: '',
                      });
                      setAddWebsiteCredEnabled(false);
                      setInitialCredForm({
                        service: 'WordPress Admin',
                        credentialType: 'HOSTING',
                        username: '',
                        password: '',
                        loginUrl: '',
                      });
                      setShowAddWebsiteModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#ff3e00] hover:bg-[#ff5500] text-white rounded-xs text-xs font-mono uppercase font-bold tracking-wider flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Domain</span>
                  </button>
                </div>

                {(!viewingHosting.websites || viewingHosting.websites.length === 0) ? (
                  <div className="p-6 bg-[#0d0d10] border border-dashed border-[#27272a] text-center space-y-2">
                    <Globe className="w-8 h-8 text-[#88888e] mx-auto" />
                    <div className="text-white font-mono text-xs font-bold">No domains have been added yet.</div>
                    <p className="text-[#88888e] font-mono text-[11px] max-w-sm mx-auto">
                      Add domains hosted under this {viewingHosting.hostingProvider} account to manage their independent expiries and scoped credentials.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setWebsiteFormData({
                          domain: '',
                          expiryDate: viewingHosting.expiryDate ? new Date(viewingHosting.expiryDate).toISOString().split('T')[0] : '',
                          status: 'ACTIVE',
                          notes: '',
                        });
                        setShowAddWebsiteModal(true);
                      }}
                      className="crm-btn-primary px-3 py-1.5 text-xs inline-flex items-center gap-1.5 mt-2 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Add First Domain</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {viewingHosting.websites.map((w: any) => {
                      const wDays = w.daysRemaining ?? Math.round((new Date(w.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <div
                          key={w._id}
                          className="p-3.5 bg-[#0d0d10] border border-[#27272a] hover:border-[#ff3e00]/50 rounded-xs transition-colors space-y-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-bold text-sm flex items-center gap-1.5">
                                <span>🌐</span>
                                <span>{w.domain}</span>
                              </span>
                              {getStatusBadge(w.status, wDays)}
                              <span className="px-2 py-0.5 bg-[#1f1f23] text-[#a1a1aa] rounded-xs text-[10px] font-mono border border-[#27272a]">
                                🔑 {w.credentialCount || 0} credentials
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono bg-[#141416] p-2.5 rounded-xs border border-[#242428]">
                            <div>
                              <span className="text-[10px] text-[#88888e] uppercase font-bold tracking-wider block">
                                DOMAIN EXPIRY
                              </span>
                              <div className="text-white font-bold text-xs mt-0.5">
                                {new Date(w.expiryDate).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className={`text-[10px] mt-0.5 ${
                                wDays <= 0 ? 'text-red-400' : wDays <= 30 ? 'text-amber-400' : 'text-[#00d664]'
                              }`}>
                                {wDays <= 0 ? `Expired (${Math.abs(wDays)}d ago)` : `Expires in ${wDays} days`}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] text-[#88888e] uppercase font-bold tracking-wider block">
                                DOMAIN NOTES
                              </span>
                              <div className="text-[#a1a1aa] text-[11px] mt-0.5 truncate">
                                {w.notes || '—'}
                              </div>
                            </div>
                          </div>

                          {/* 4 Action Buttons on Domain Card */}
                          <div className="flex items-center gap-2 pt-1 flex-wrap justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenViewDomain(w, viewingHosting)}
                              className="px-2.5 py-1.5 bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-white/50 text-[#d4d4d8] hover:text-white text-xs font-mono rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="View Domain Details"
                            >
                              <Eye className="w-3 h-3 text-[#ff3e00]" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveWebsite(w);
                                setEditWebsiteFormData({
                                  domain: w.domain,
                                  expiryDate: new Date(w.expiryDate).toISOString().split('T')[0],
                                  status: w.status,
                                  notes: w.notes || '',
                                });
                                setShowEditWebsiteModal(true);
                              }}
                              className="px-2.5 py-1.5 bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-white/50 text-[#d4d4d8] hover:text-white text-xs font-mono rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Edit Domain"
                            >
                              <Edit2 className="w-3 h-3 text-[#ff3e00]" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenWebsiteCredentials(w, viewingHosting)}
                              className="px-2.5 py-1.5 bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-[#ff3e00]/50 text-[#d4d4d8] hover:text-white text-xs font-mono rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Manage Domain Credentials"
                            >
                              <Lock className="w-3 h-3 text-[#ff3e00]" />
                              <span>Credentials ({w.credentialCount || 0})</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteWebsite(w)}
                              className="px-2.5 py-1.5 bg-[#18181b] hover:bg-red-950/40 border border-[#27272a] hover:border-red-500/50 text-[#88888e] hover:text-red-400 text-xs font-mono rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Deactivate Domain"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Deactivate</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#242428] flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const h = viewingHosting;
                  handleRevealSecrets(h);
                }}
                className="px-3 py-2 bg-[#ff3e00]/10 hover:bg-[#ff3e00]/20 border border-[#ff3e00]/40 text-[#ff3e00] font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Manage Hosting Credentials</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
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
                  className="crm-btn-secondary px-3 py-2 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Hosting</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    setViewingHosting(null);
                  }}
                  className="crm-btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Website Modal */}
      {showAddWebsiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <Plus className="w-3.5 h-3.5 text-[#ff3e00]" />
                <span>Add Domain to Hosting Account</span>
              </div>
              <button onClick={() => setShowAddWebsiteModal(false)} className="text-[#88888e] hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-[#0d0d10] border border-[#242428] text-[11px] font-mono text-[#a1a1aa] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#ff3e00] shrink-0" />
              <span>
                Hosting: <b className="text-white">{viewingHosting?.hostingProvider}</b> ({viewingHosting?.domain}) • Hosting Expiry: <b className="text-white">{viewingHosting ? new Date(viewingHosting.expiryDate).toLocaleDateString() : ''}</b>
              </span>
            </div>

            <form onSubmit={handleAddWebsite} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1 font-semibold">
                  Domain / Website URL *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. allyonogames.com"
                  value={websiteFormData.domain}
                  onChange={(e) => setWebsiteFormData({ ...websiteFormData, domain: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1 font-semibold">
                    Domain Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={websiteFormData.expiryDate}
                    onChange={(e) => setWebsiteFormData({ ...websiteFormData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                  />
                  <span className="text-[9px] text-[#71717a] mt-0.5 block">Independent of hosting expiry</span>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1 font-semibold">Domain Status</label>
                  <select
                    value={websiteFormData.status}
                    onChange={(e) => setWebsiteFormData({ ...websiteFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRING_SOON">EXPIRING SOON</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1 font-semibold">Domain Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Client promotional landing page, separate registrar"
                  value={websiteFormData.notes}
                  onChange={(e) => setWebsiteFormData({ ...websiteFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none resize-none"
                />
              </div>

              {/* Initial Domain Credential (Optional) */}
              <div className="pt-2 border-t border-[#242428] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addWebsiteCredEnabled}
                      onChange={(e) => setAddWebsiteCredEnabled(e.target.checked)}
                      className="accent-[#ff3e00]"
                    />
                    <span className="text-[11px] font-bold text-white">Add Initial Domain Credential (Optional)</span>
                  </label>
                  <span className="text-[9px] text-[#88888e]">e.g. WP Admin, CMS</span>
                </div>

                {addWebsiteCredEnabled && (
                  <div className="p-3 bg-[#0a0a0d] border border-[#27272a] space-y-2 rounded-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Service Name *</label>
                        <input
                          type="text"
                          required={addWebsiteCredEnabled}
                          placeholder="e.g. WordPress Admin"
                          value={initialCredForm.service}
                          onChange={(e) => setInitialCredForm({ ...initialCredForm, service: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-[#141416] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Type</label>
                        <select
                          value={initialCredForm.credentialType}
                          onChange={(e) => setInitialCredForm({ ...initialCredForm, credentialType: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-[#141416] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                        >
                          <option value="CMS">WordPress / CMS</option>
                          <option value="HOSTING">Hosting / Sub-account</option>
                          <option value="DATABASE">Database</option>
                          <option value="API_KEY">API Key</option>
                          <option value="CUSTOM">Custom</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Username *</label>
                        <input
                          type="text"
                          required={addWebsiteCredEnabled}
                          placeholder="admin"
                          value={initialCredForm.username}
                          onChange={(e) => setInitialCredForm({ ...initialCredForm, username: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-[#141416] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Password *</label>
                        <input
                          type="password"
                          required={addWebsiteCredEnabled}
                          placeholder="Secret password"
                          value={initialCredForm.password}
                          onChange={(e) => setInitialCredForm({ ...initialCredForm, password: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-[#141416] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Login URL (Optional)</label>
                      <input
                        type="text"
                        placeholder="https://example.com/wp-admin"
                        value={initialCredForm.loginUrl}
                        onChange={(e) => setInitialCredForm({ ...initialCredForm, loginUrl: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[#141416] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowAddWebsiteModal(false)}
                  className="crm-btn-secondary px-3 py-1.5 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#ff3e00] hover:bg-[#ff5500] text-white rounded-xs text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Add Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Website Modal */}
      {showEditWebsiteModal && activeWebsite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-md w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <Edit2 className="w-3.5 h-3.5 text-[#ff3e00]" />
                <span>Edit Domain // {activeWebsite.domain}</span>
              </div>
              <button onClick={() => setShowEditWebsiteModal(false)} className="text-[#88888e] hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-[#0d0d10] border border-[#242428] text-[11px] font-mono text-[#a1a1aa]">
              Updating this domain record updates only this child domain and does not change the parent hosting account.
            </div>

            <form onSubmit={handleEditWebsite} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1 font-semibold">Domain / Website URL *</label>
                <input
                  type="text"
                  required
                  value={editWebsiteFormData.domain}
                  onChange={(e) => setEditWebsiteFormData({ ...editWebsiteFormData, domain: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1 font-semibold">Domain Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={editWebsiteFormData.expiryDate}
                  onChange={(e) => setEditWebsiteFormData({ ...editWebsiteFormData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                />
                <span className="text-[9px] text-[#71717a] mt-0.5 block">Independent of hosting expiry</span>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1 font-semibold">Status</label>
                <select
                  value={editWebsiteFormData.status}
                  onChange={(e) => setEditWebsiteFormData({ ...editWebsiteFormData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="EXPIRING_SOON">EXPIRING SOON</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1 font-semibold">Notes</label>
                <textarea
                  rows={2}
                  value={editWebsiteFormData.notes}
                  onChange={(e) => setEditWebsiteFormData({ ...editWebsiteFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowEditWebsiteModal(false)}
                  className="crm-btn-secondary px-3 py-1.5 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#ff3e00] hover:bg-[#ff5500] text-white rounded-xs text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Update Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Website Credentials Modal */}
      {showWebsiteCredentialsModal && activeWebsite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5 text-[#ff3e00]" />
                <span>Domain Credentials // {activeWebsite.domain}</span>
              </div>
              <button
                onClick={() => {
                  setShowWebsiteCredentialsModal(false);
                  setActiveWebsite(null);
                }}
                className="text-[#88888e] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-[#0d0d10] border border-[#242428] text-[11px] font-mono text-[#a1a1aa] space-y-1">
              <div className="flex items-center justify-between">
                <span>Domain: <b className="text-white">{activeWebsite.domain}</b></span>
                <span>Expiry: <b className="text-white">{new Date(activeWebsite.expiryDate).toLocaleDateString()}</b></span>
              </div>
              <div className="text-[10px] text-[#71717a]">
                Credentials stored here are strictly scoped to this domain. They will never leak to other domains or parent hosting credentials.
              </div>
            </div>

            <div className="space-y-4 font-mono text-xs">
              {/* Credentials List */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold text-[#88888e] tracking-wider">
                  EXISTING CREDENTIALS ({websiteCredentials.length})
                </div>
                {websiteCredLoading ? (
                  <div className="p-4 text-center text-[#88888e]">Loading credentials...</div>
                ) : websiteCredentials.length === 0 ? (
                  <div className="p-3 bg-[#0d0d10] border border-[#27272a] text-[#71717a] text-center text-[11px]">
                    No credentials recorded specifically for {activeWebsite.domain} yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {websiteCredentials.map((cred: any) => {
                      const isRevealed = !!revealedWebsiteCreds[cred._id];
                      return (
                        <div key={cred._id} className="p-3 bg-[#0d0d10] border border-[#27272a] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white flex items-center gap-2">
                              <span>{cred.service}</span>
                              <span className="px-1.5 py-0.5 bg-[#1f1f23] text-[#a1a1aa] rounded-xs text-[9px]">
                                {cred.credentialType}
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRevealWebsiteCredential(cred._id)}
                                className="px-2 py-0.5 bg-[#18181b] hover:bg-[#202024] border border-[#27272a] text-[#ff3e00] rounded-xs text-[10px] flex items-center gap-1 cursor-pointer"
                              >
                                {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWebsiteCredential(cred._id)}
                                className="p-1 text-[#88888e] hover:text-red-400 cursor-pointer"
                                title="Delete credential"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-[#88888e] text-[9px] block">USERNAME</span>
                              <span className="text-white flex items-center gap-1">
                                {cred.username || '—'}
                                {cred.username && (
                                  <button onClick={() => copyToClipboard(cred.username, `user_${cred._id}`)} className="text-[#71717a] hover:text-white cursor-pointer">
                                    {copiedKey === `user_${cred._id}` ? <Check className="w-2.5 h-2.5 text-[#00d664]" /> : <Copy className="w-2.5 h-2.5" />}
                                  </button>
                                )}
                              </span>
                            </div>

                            <div>
                              <span className="text-[#88888e] text-[9px] block">PASSWORD</span>
                              <span className="text-white flex items-center gap-1 font-mono">
                                {isRevealed ? revealedWebsiteCreds[cred._id] : '••••••••'}
                                {isRevealed && (
                                  <button onClick={() => copyToClipboard(revealedWebsiteCreds[cred._id], `pwd_${cred._id}`)} className="text-[#71717a] hover:text-white cursor-pointer">
                                    {copiedKey === `pwd_${cred._id}` ? <Check className="w-2.5 h-2.5 text-[#00d664]" /> : <Copy className="w-2.5 h-2.5" />}
                                  </button>
                                )}
                              </span>
                            </div>
                          </div>

                          {cred.loginUrl && (
                            <div className="text-[10px] text-[#88888e] flex items-center gap-2">
                              <span>URL:</span>
                              <a
                                href={cred.loginUrl.startsWith('http') ? cred.loginUrl : `https://${cred.loginUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#ff3e00] hover:underline"
                              >
                                {cred.loginUrl}
                              </a>
                              <button onClick={() => copyToClipboard(cred.loginUrl, `url_${cred._id}`)} className="text-[#71717a] hover:text-white cursor-pointer">
                                {copiedKey === `url_${cred._id}` ? <Check className="w-2.5 h-2.5 text-[#00d664]" /> : <Copy className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Credential Form */}
              <form onSubmit={handleAddWebsiteCredential} className="pt-3 border-t border-[#242428] space-y-2.5">
                <div className="text-[10px] uppercase font-bold text-white tracking-wider flex items-center gap-1">
                  <Plus className="w-3 h-3 text-[#ff3e00]" />
                  <span>ADD NEW CREDENTIAL FOR THIS DOMAIN</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Service Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. WordPress Admin"
                      value={newWebsiteCredForm.service}
                      onChange={(e) => setNewWebsiteCredForm({ ...newWebsiteCredForm, service: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Credential Type</label>
                    <select
                      value={newWebsiteCredForm.credentialType}
                      onChange={(e) => setNewWebsiteCredForm({ ...newWebsiteCredForm, credentialType: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                    >
                      <option value="CMS">WordPress / CMS</option>
                      <option value="HOSTING">Hosting / Sub-account</option>
                      <option value="DATABASE">Database</option>
                      <option value="API_KEY">API Key</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="admin@example.com"
                      value={newWebsiteCredForm.username}
                      onChange={(e) => setNewWebsiteCredForm({ ...newWebsiteCredForm, username: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Secret password"
                      value={newWebsiteCredForm.password}
                      onChange={(e) => setNewWebsiteCredForm({ ...newWebsiteCredForm, password: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] uppercase text-[#88888e] mb-0.5">Login URL (Optional)</label>
                  <input
                    type="text"
                    placeholder={`https://${activeWebsite.domain}/wp-admin`}
                    value={newWebsiteCredForm.loginUrl}
                    onChange={(e) => setNewWebsiteCredForm({ ...newWebsiteCredForm, loginUrl: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs text-white outline-none"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3.5 py-1.5 bg-[#ff3e00] hover:bg-[#ff5500] text-white rounded-xs text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Saving...' : '+ Save Credential'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Domain Detail Modal */}
      {showViewDomainModal && viewingDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::DOMAIN_DETAILS // {viewingDomain.domain}</span>
              </div>
              <button
                onClick={() => {
                  setShowViewDomainModal(false);
                  setViewingDomain(null);
                }}
                className="text-[#88888e] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              {/* Domain Header Card */}
              <div className="flex items-center justify-between p-3.5 bg-[#0d0d10] border border-[#242428]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xs bg-[#ff3e00]/10 border border-[#ff3e00]/30 flex items-center justify-center text-[#ff3e00]">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm flex items-center gap-1.5">
                      <span>{viewingDomain.domain}</span>
                      <a
                        href={`https://${viewingDomain.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#88888e] hover:text-[#ff3e00] transition-colors"
                        title="Open domain"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="text-[10px] text-[#88888e] mt-0.5">
                      Child Domain of <span className="text-[#d4d4d8] font-semibold">{viewingHosting?.hostingProvider}</span> ({viewingHosting?.domain})
                    </div>
                  </div>
                </div>
                <div>
                  {(() => {
                    const days = viewingDomain.daysRemaining ?? Math.round((new Date(viewingDomain.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return getStatusBadge(viewingDomain.status, days);
                  })()}
                </div>
              </div>

              {/* Side-by-Side: Domain Expiry vs Hosting Expiry */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-[#88888e] tracking-wider">
                  LIFECYCLE & EXPIRY COMPARISON
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Domain Expiry Card */}
                  <div className="p-3 bg-[#18181b]/60 border border-[#ff3e00]/30 space-y-1 rounded-xs">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#ff3e00] uppercase tracking-wider">
                      <span>DOMAIN EXPIRY</span>
                      <span className="px-1.5 py-0.5 bg-[#ff3e00]/15 text-[#ff3e00] rounded-xs text-[9px]">
                        REGISTRAR
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">
                      {new Date(viewingDomain.expiryDate).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] text-[#88888e]">
                      {(() => {
                        const days = viewingDomain.daysRemaining ?? Math.round((new Date(viewingDomain.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return (
                          <span className={`font-semibold ${days <= 0 ? 'text-red-400' : days <= 30 ? 'text-amber-400' : 'text-[#00d664]'}`}>
                            {days <= 0 ? `Expired (${Math.abs(days)}d ago)` : `Expires in ${days} days`}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-[9px] text-[#71717a] pt-1">
                      Independent lifecycle; does not dictate hosting server uptime.
                    </div>
                  </div>

                  {/* Hosting Expiry Card */}
                  <div className="p-3 bg-[#18181b]/60 border border-[#27272a] space-y-1 rounded-xs">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#88888e] uppercase tracking-wider">
                      <span>HOSTING EXPIRY</span>
                      <span className="px-1.5 py-0.5 bg-[#27272a] text-[#a1a1aa] rounded-xs text-[9px]">
                        SERVER
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">
                      {viewingHosting ? new Date(viewingHosting.expiryDate).toLocaleDateString() : '—'}
                    </div>
                    <div className="text-[10px] text-[#88888e]">
                      {viewingHosting && (
                        <span className={`font-semibold ${viewingHosting.daysRemaining <= 0 ? 'text-red-400' : viewingHosting.daysRemaining <= 30 ? 'text-amber-400' : 'text-[#00d664]'}`}>
                          {viewingHosting.daysRemaining <= 0 ? `Expired (${Math.abs(viewingHosting.daysRemaining)}d ago)` : `Expires in ${viewingHosting.daysRemaining} days`}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-[#71717a] pt-1">
                      {viewingHosting?.hostingProvider} ({viewingHosting?.planName || 'Plan'})
                    </div>
                  </div>
                </div>
              </div>

              {/* Parent Context */}
              <div className="p-3 bg-[#0d0d10] border border-[#242428] space-y-2">
                <div className="text-[10px] uppercase font-bold text-[#88888e] tracking-wider">PARENT CONTEXT</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#88888e] text-[9px] block">CLIENT</span>
                    <span className="text-white font-semibold">
                      {viewingHosting?.clientId?.name || '—'}
                    </span>
                    {viewingHosting?.clientId?.clientCode && (
                      <span className="text-[#88888e] text-[10px] ml-1 font-mono">
                        ({viewingHosting.clientId.clientCode})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[#88888e] text-[9px] block">PROJECT</span>
                    <span className="text-white font-semibold">
                      {viewingHosting?.projectId?.name || 'Direct Client Hosting'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewingDomain.notes && (
                <div className="p-3 bg-[#0d0d10] border border-[#242428] space-y-1">
                  <div className="text-[10px] uppercase font-bold text-[#88888e] tracking-wider">DOMAIN NOTES</div>
                  <div className="text-white text-[11px] whitespace-pre-wrap">{viewingDomain.notes}</div>
                </div>
              )}

              {/* Domain Credentials Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase font-bold text-[#88888e] tracking-wider">
                    DOMAIN CREDENTIALS ({websiteCredentials.length})
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWebsite(viewingDomain);
                      setShowViewDomainModal(false);
                      setShowWebsiteCredentialsModal(true);
                    }}
                    className="text-[#ff3e00] hover:text-[#ff5500] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add / Manage</span>
                  </button>
                </div>

                {websiteCredentials.length === 0 ? (
                  <div className="p-3 bg-[#0d0d10] border border-[#27272a] text-[#71717a] text-center text-[11px]">
                    No credentials stored specifically for {viewingDomain.domain} yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {websiteCredentials.map((cred: any) => {
                      const isRevealed = !!revealedWebsiteCreds[cred._id];
                      return (
                        <div key={cred._id} className="p-2.5 bg-[#0d0d10] border border-[#27272a] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-[11px] flex items-center gap-2">
                              <span>{cred.service}</span>
                              <span className="px-1.5 py-0.2 bg-[#1f1f23] text-[#a1a1aa] rounded-xs text-[9px]">
                                {cred.credentialType}
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRevealWebsiteCredential(cred._id)}
                                className="px-2 py-0.5 bg-[#18181b] hover:bg-[#202024] border border-[#27272a] text-[#ff3e00] rounded-xs text-[10px] flex items-center gap-1 cursor-pointer"
                              >
                                {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWebsiteCredential(cred._id)}
                                className="p-1 text-[#88888e] hover:text-red-400 cursor-pointer"
                                title="Delete credential"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-[#88888e] text-[9px] block">USERNAME</span>
                              <span className="text-white flex items-center gap-1">
                                {cred.username || '—'}
                                {cred.username && (
                                  <button onClick={() => copyToClipboard(cred.username, `vd_user_${cred._id}`)} className="text-[#71717a] hover:text-white cursor-pointer">
                                    {copiedKey === `vd_user_${cred._id}` ? <Check className="w-2.5 h-2.5 text-[#00d664]" /> : <Copy className="w-2.5 h-2.5" />}
                                  </button>
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#88888e] text-[9px] block">PASSWORD</span>
                              <span className="text-white flex items-center gap-1 font-mono">
                                {isRevealed ? revealedWebsiteCreds[cred._id] : '••••••••'}
                                {isRevealed && (
                                  <button onClick={() => copyToClipboard(revealedWebsiteCreds[cred._id], `vd_pwd_${cred._id}`)} className="text-[#71717a] hover:text-white cursor-pointer">
                                    {copiedKey === `vd_pwd_${cred._id}` ? <Check className="w-2.5 h-2.5 text-[#00d664]" /> : <Copy className="w-2.5 h-2.5" />}
                                  </button>
                                )}
                              </span>
                            </div>
                          </div>

                          {cred.loginUrl && (
                            <div className="text-[10px] text-[#88888e] flex items-center gap-1.5">
                              <span>URL:</span>
                              <a
                                href={cred.loginUrl.startsWith('http') ? cred.loginUrl : `https://${cred.loginUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#ff3e00] hover:underline"
                              >
                                {cred.loginUrl}
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#242428] flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveWebsite(viewingDomain);
                    setShowViewDomainModal(false);
                    setShowWebsiteCredentialsModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#ff3e00]/10 hover:bg-[#ff3e00]/20 border border-[#ff3e00]/40 text-[#ff3e00] font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Credentials ({websiteCredentials.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveWebsite(viewingDomain);
                    setEditWebsiteFormData({
                      domain: viewingDomain.domain,
                      expiryDate: new Date(viewingDomain.expiryDate).toISOString().split('T')[0],
                      status: viewingDomain.status,
                      notes: viewingDomain.notes || '',
                    });
                    setShowViewDomainModal(false);
                    setShowEditWebsiteModal(true);
                  }}
                  className="crm-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3 text-[#ff3e00]" />
                  <span>Edit Domain</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteWebsite(viewingDomain)}
                  className="px-2.5 py-1.5 bg-[#18181b] hover:bg-red-950/40 border border-[#27272a] hover:border-red-500/50 text-[#88888e] hover:text-red-400 text-xs font-mono rounded-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Deactivate</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewDomainModal(false);
                    setViewingDomain(null);
                  }}
                  className="crm-btn-secondary px-3 py-1.5 text-xs cursor-pointer"
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
                        setFormData(prev => ({ ...prev, projectId: '', clientId: '' }));
                        setProjectSearch('');
                      } else {
                        setFormData(prev => ({ ...prev, projectId: '', clientId: '' }));
                        setClientSearch('');
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
                        className="crm-select font-mono"
                      >
                        <option value="">Select Project (Client auto-derived)</option>
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
                  /* Direct Client Mode (when hosting has no project) */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e]">
                        Client (Direct / No Project) *
                      </label>
                      {clientsLoading && (
                        <span className="text-[10px] font-mono text-[#88888e] flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-[#ff3e00]" /> Loading clients...
                        </span>
                      )}
                    </div>

                    {/* Search Clients */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#52525b]" />
                      <input
                        type="text"
                        placeholder="Search clients by name, code, company, or email..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                      />
                    </div>

                    {clientsError ? (
                      <div className="p-2.5 bg-[#1c1110] border border-[#ef4444]/30 flex items-center justify-between text-xs font-mono text-[#ef4444]">
                        <span>{clientsError}</span>
                        <button
                          type="button"
                          onClick={fetchClients}
                          className="underline text-white hover:text-[#ff3e00] ml-2 cursor-pointer font-bold"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <select
                        required={isDirectClientMode}
                        value={formData.clientId}
                        onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value, projectId: '' }))}
                        className="crm-select font-mono"
                      >
                        <option value="">
                          {clientsLoading
                            ? 'Loading clients...'
                            : clients.length === 0
                              ? 'No clients available.'
                              : 'Select Client Directly'}
                        </option>
                        {filteredClients.map((c) => {
                          const clientCode = c.clientCode ? ` [${c.clientCode}]` : '';
                          const companyStr = c.company ? ` • ${c.company}` : '';
                          return (
                            <option key={c._id} value={c._id}>
                              {c.name}{clientCode}{companyStr}
                            </option>
                          );
                        })}
                      </select>
                    )}

                    {selectedClientObj ? (
                      <div className="p-3 bg-[#141416] border border-[#00d664]/30 rounded-none md:rounded-xs space-y-1.5 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase font-bold text-[#00d664] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" /> Direct Client Selected
                          </span>
                          <span className="font-mono text-[10px] text-[#88888e]">
                            Code: <b className="text-white">{selectedClientObj.clientCode || 'N/A'}</b>
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                          <div>
                            <span className="text-[#88888e] text-[10px] block">CLIENT</span>
                            <span className="text-white font-bold">{selectedClientObj.name}</span>
                            {selectedClientObj.company && (
                              <span className="text-[#a1a1aa] text-[11px] block">{selectedClientObj.company}</span>
                            )}
                          </div>
                          <div>
                            <span className="text-[#88888e] text-[10px] block">PROJECT ASSOCIATION</span>
                            <span className="text-[#a1a1aa] italic text-[11px]">Not associated with a project</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-[#141416]/50 border border-dashed border-[#242428] text-center font-mono text-[11px] text-[#88888e]">
                        Select a client directly. No project will be associated with this hosting.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Hosting Details */}
              <div className="space-y-3 p-3 bg-[#0d0d10] border border-[#242428] rounded-none md:rounded-xs">
                <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#ff3e00]">
                  2. Hosting Details
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Hosting Provider *</label>
                    <select
                      value={formData.hostingProvider}
                      onChange={(e) => setFormData({ ...formData, hostingProvider: e.target.value })}
                      className="crm-select font-mono"
                    >
                      {renderedProviders.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      {formData.hostingProvider && formData.hostingProvider !== 'Custom' && !renderedProviders.includes(formData.hostingProvider) && (
                        <option value={formData.hostingProvider}>{formData.hostingProvider} (Inactive)</option>
                      )}
                      <option value="Custom">Custom Provider...</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Hosting Type</label>
                    <select
                      value={formData.hostingType}
                      onChange={(e) => setFormData({ ...formData, hostingType: e.target.value })}
                      className="crm-select font-mono"
                    >
                      {renderedTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      {formData.hostingType && formData.hostingType !== 'Custom' && !renderedTypes.includes(formData.hostingType) && (
                        <option value={formData.hostingType}>{formData.hostingType} (Inactive)</option>
                      )}
                      <option value="Custom">Custom</option>
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

                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Panel URL</label>
                  <input
                    type="text"
                    placeholder="https://hpanel.hostinger.com"
                    value={formData.panelUrl}
                    onChange={(e) => setFormData({ ...formData, panelUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
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
              </div>

              {/* Credentials Block (Sensitive - Encrypted) */}
              <div className="p-4 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-3">
                <div className="flex items-center gap-2 text-white font-mono font-semibold text-xs uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-[#ff3e00]" />
                  <span>3. Secure Hosting Credentials // AES-256-GCM</span>
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
              <div className="p-3 bg-[#0d0d10] border border-[#242428] rounded-none md:rounded-xs space-y-3">
                <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#ff3e00]">
                  4. Hosting Dates
                </label>
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
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Hosting Expiry Date *</label>
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
              </div>

              {/* Notes */}
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
                <span>SYS::EDIT_HOSTING_RECORD // {selectedHosting.hostingProvider} {selectedHosting.planName ? `(${selectedHosting.planName})` : ''}</span>
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
                    className="crm-select font-mono"
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
              {/* Hosting Details */}
              <div className="space-y-3 p-3 bg-[#0d0d10] border border-[#242428] rounded-none md:rounded-xs">
                <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#ff3e00]">
                  Hosting Details
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Hosting Provider *</label>
                    <select
                      value={formData.hostingProvider}
                      onChange={(e) => setFormData({ ...formData, hostingProvider: e.target.value })}
                      className="crm-select font-mono"
                    >
                      {renderedProviders.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      {formData.hostingProvider && formData.hostingProvider !== 'Custom' && !renderedProviders.includes(formData.hostingProvider) && (
                        <option value={formData.hostingProvider}>{formData.hostingProvider} (Inactive)</option>
                      )}
                      <option value="Custom">Custom Provider...</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Hosting Type</label>
                    <select
                      value={formData.hostingType}
                      onChange={(e) => setFormData({ ...formData, hostingType: e.target.value })}
                      className="crm-select font-mono"
                    >
                      {renderedTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      {formData.hostingType && formData.hostingType !== 'Custom' && !renderedTypes.includes(formData.hostingType) && (
                        <option value={formData.hostingType}>{formData.hostingType} (Inactive)</option>
                      )}
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#88888e] mb-1">Panel URL</label>
                  <input
                    type="text"
                    value={formData.panelUrl}
                    onChange={(e) => setFormData({ ...formData, panelUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] focus:border-[#ff3e00] rounded-none md:rounded-xs text-xs font-mono text-white placeholder-[#52525b] outline-none"
                  />
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
