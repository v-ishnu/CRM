'use client';

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Search,
  Send,
  CheckCircle2,
  Shield,
  Trash2,
  Edit2,
  Copy,
  Check,
  CheckSquare,
  AlertTriangle,
  X,
  Link2,
  CreditCard,
  Eye,
  Lock,
  Clock,
  Ban,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function TeamMembersPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');

  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRevealBankModal, setShowRevealBankModal] = useState(false);

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Invite Modal State
  const [inviteRole, setInviteRole] = useState('DEVELOPER');
  const [inviteExpiresDays, setInviteExpiresDays] = useState(7);
  const [createdInviteUrl, setCreatedInviteUrl] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Reveal Bank State
  const [masterPassword, setMasterPassword] = useState('');
  const [revealingBank, setRevealingBank] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [revealedBankData, setRevealedBankData] = useState<any>(null);
  const [bankCopiedField, setBankCopiedField] = useState<string | null>(null);

  // Add/Edit Form State
  const [showBankFields, setShowBankFields] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: string;
    permissions: string[];
    bankDetails: {
      accountHolderName: string;
      bankName: string;
      accountNumber: string;
      ifsc: string;
      upiId: string;
    };
  }>({
    name: '',
    email: '',
    phone: '',
    role: 'DEVELOPER',
    permissions: ['VIEW_PROJECT', 'VIEW_TASKS'],
    bankDetails: {
      accountHolderName: '',
      bankName: '',
      accountNumber: '',
      ifsc: '',
      upiId: '',
    },
  });

  const availablePermissions = [
    { id: 'VIEW_PROJECT', label: 'View Project Details' },
    { id: 'VIEW_TASKS', label: 'View & Update Tasks' },
    { id: 'MANAGE_TASKS', label: 'Create & Assign Tasks' },
    { id: 'VIEW_CREDENTIALS', label: 'Access Project Credentials (Sensitive)' },
    { id: 'REQUEST_CREDENTIALS', label: 'Request Client Data/Credentials' },
    { id: 'VIEW_CLIENT', label: 'View Client Info' },
    { id: 'MANAGE_PROJECT', label: 'Manage Projects' },
  ];

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (roleFilter) query.set('role', roleFilter);
      if (statusFilter) query.set('status', statusFilter);

      const res = await fetch(`/api/team-members?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMembers(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch team members:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      setInvitationsLoading(true);
      const res = await fetch('/api/team-invitations');
      const data = await res.json();
      if (data.success) {
        setInvitations(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    } finally {
      setInvitationsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === 'invitations') {
      fetchInvitations();
    }
  }, [activeTab]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'DEVELOPER',
      permissions: ['VIEW_PROJECT', 'VIEW_TASKS'],
      bankDetails: {
        accountHolderName: '',
        bankName: '',
        accountNumber: '',
        ifsc: '',
        upiId: '',
      },
    });
    setShowBankFields(false);
    setShowAddModal(true);
  };

  const handleOpenEdit = (member: any) => {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      role: member.role,
      permissions: member.permissions || [],
      bankDetails: {
        accountHolderName: member.bankDetails?.accountHolderName || '',
        bankName: member.bankDetails?.bankName || '',
        accountNumber: '',
        ifsc: '',
        upiId: '',
      },
    });
    setShowBankFields(!!member.bankDetails?.isComplete);
    setShowEditModal(true);
  };

  const togglePermission = (permId: string) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permId);
      return {
        ...prev,
        permissions: exists ? prev.permissions.filter((p) => p !== permId) : [...prev.permissions, permId],
      };
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        role: formData.role,
        permissions: formData.permissions,
      };

      if (
        formData.bankDetails.accountHolderName ||
        formData.bankDetails.accountNumber ||
        formData.bankDetails.ifsc ||
        formData.bankDetails.upiId
      ) {
        payload.bankDetails = {
          accountHolderName: formData.bankDetails.accountHolderName || undefined,
          bankName: formData.bankDetails.bankName || undefined,
          accountNumber: formData.bankDetails.accountNumber || undefined,
          ifsc: formData.bankDetails.ifsc || undefined,
          upiId: formData.bankDetails.upiId || undefined,
        };
      }

      const res = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        fetchMembers();
      } else {
        alert(data.error?.message || 'Failed to create team member');
      }
    } catch (err) {
      console.error('Error creating team member:', err);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        role: formData.role,
        permissions: formData.permissions,
      };

      if (
        formData.bankDetails.accountHolderName ||
        formData.bankDetails.accountNumber ||
        formData.bankDetails.ifsc ||
        formData.bankDetails.upiId
      ) {
        payload.bankDetails = {
          accountHolderName: formData.bankDetails.accountHolderName || undefined,
          bankName: formData.bankDetails.bankName || undefined,
          accountNumber: formData.bankDetails.accountNumber || undefined,
          ifsc: formData.bankDetails.ifsc || undefined,
          upiId: formData.bankDetails.upiId || undefined,
        };
      }

      const res = await fetch(`/api/team-members/${selectedMember._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setShowEditModal(false);
        fetchMembers();
      } else {
        alert(data.error?.message || 'Failed to update team member');
      }
    } catch (err) {
      console.error('Error updating team member:', err);
    }
  };

  const handleGenerateLink = async (member: any) => {
    setSelectedMember(member);
    try {
      const res = await fetch(`/api/team-members/${member._id}/telegram-token`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedLink(data.data.link);
        setShowTokenModal(true);
      } else {
        alert(data.error?.message || 'Failed to generate token');
      }
    } catch (err) {
      console.error('Error generating token:', err);
    }
  };

  const handleToggleDeactivate = async (member: any) => {
    const isActivating = member.status !== 'ACTIVE';
    const confirmMsg = isActivating
      ? `Reactivate ${member.name}?`
      : `Deactivate ${member.name}? They will lose access to Telegram tasks.`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/team-members/${member._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: isActivating ? 'ACTIVE' : 'DEACTIVATED' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchMembers();
      } else {
        alert(data.error?.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleDeleteMember = async (member: any) => {
    if (member.isPrimaryAdmin) {
      alert('Primary admin account cannot be deleted');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${member.name}? Historical records will be preserved.`)) return;

    try {
      const res = await fetch(`/api/team-members/${member._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchMembers();
      } else {
        alert(data.error?.message || 'Failed to delete team member');
      }
    } catch (err) {
      console.error('Error deleting member:', err);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingInvite(true);
      const res = await fetch('/api/team-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole, expiresInDays: inviteExpiresDays }),
      });
      const data = await res.json();
      if (data.success && data.data?.inviteUrl) {
        setCreatedInviteUrl(data.data.inviteUrl);
        fetchInvitations();
      } else {
        alert(data.error?.message || 'Failed to create invitation link');
      }
    } catch (err) {
      console.error('Error creating invitation:', err);
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation link? It will become immediately invalid.')) return;
    try {
      const res = await fetch(`/api/team-invitations/${invitationId}/revoke`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        fetchInvitations();
      } else {
        alert(data.error?.message || 'Failed to revoke invitation');
      }
    } catch (err) {
      console.error('Error revoking invitation:', err);
    }
  };

  const handleOpenRevealBank = (member: any) => {
    setSelectedMember(member);
    setMasterPassword('');
    setRevealError('');
    setRevealedBankData(null);
    setShowRevealBankModal(true);
  };

  const handleRevealBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !masterPassword) return;

    try {
      setRevealingBank(true);
      setRevealError('');
      const res = await fetch(`/api/team-members/${selectedMember._id}/reveal-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setRevealedBankData(data.data);
      } else {
        setRevealError(data.error?.message || 'Authentication failed. Please verify your admin password.');
      }
    } catch (err) {
      setRevealError('Failed to communicate with server.');
    } finally {
      setRevealingBank(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const copyInviteToClipboard = () => {
    navigator.clipboard.writeText(createdInviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  const copyBankField = (fieldName: string, value: string) => {
    navigator.clipboard.writeText(value);
    setBankCopiedField(fieldName);
    setTimeout(() => setBankCopiedField(null), 2000);
  };

  const roleBadges: Record<string, string> = {
    ADMIN: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
    MANAGER: 'bg-blue-950/60 text-blue-300 border-blue-800/60',
    DEVELOPER: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
    DESIGNER: 'bg-pink-950/60 text-pink-300 border-pink-800/60',
    SEO: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    OTHER: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Team Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your development team, onboarding invitations, secure bank payouts, and task assignments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCreatedInviteUrl('');
              setShowInviteModal(true);
            }}
            className="inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-sm font-semibold transition-all cursor-pointer shrink-0"
          >
            <Link2 className="w-4 h-4 text-emerald-400" />
            <span>+ Invite via Link</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Member</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 space-x-6 text-sm">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 font-medium transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'members'
              ? 'border-b-2 border-indigo-500 text-indigo-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Team Members</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
            {members.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`pb-3 font-medium transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'invitations'
              ? 'border-b-2 border-indigo-500 text-indigo-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Onboarding Invitations</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
            {invitations.length}
          </span>
        </button>
      </div>

      {activeTab === 'members' ? (
        <>
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#0d0d12] border border-slate-800/80 p-3 rounded-2xl">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="w-full bg-[#14141b] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="DEVELOPER">Developer</option>
                <option value="DESIGNER">Designer</option>
                <option value="SEO">SEO</option>
                <option value="OTHER">Other</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
            </div>
          </div>

          {/* Team Member Cards */}
          {loading ? (
            <div className="flex items-center justify-center p-12 text-slate-400">Loading team members...</div>
          ) : members.length === 0 ? (
            <div className="text-center p-8 sm:p-12 bg-[#0d0d12] border border-slate-800 rounded-2xl">
              <UsersIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-200">No team members found</h3>
              <p className="text-xs text-slate-400 mt-1">Get started by inviting or adding a team member.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => (
                <div
                  key={member._id}
                  className={`bg-[#0d0d12] border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:border-slate-700 ${
                    member.status === 'DEACTIVATED' ? 'border-red-950/40 opacity-75' : 'border-slate-800'
                  }`}
                >
                  <div>
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-white text-base leading-tight flex items-center gap-2">
                          {member.name}
                          {member.isPrimaryAdmin && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                              Primary Admin
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{member.email}</p>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                          roleBadges[member.role] || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {member.role}
                      </span>
                    </div>

                    {/* Status and Details */}
                    <div className="space-y-2 py-3 border-y border-slate-800/60 my-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Telegram Bot:</span>
                        {member.telegramConnected ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Connected</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGenerateLink(member)}
                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Generate Link</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Status:</span>
                        <span
                          className={`font-semibold ${
                            member.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>

                      {/* Bank Details Status Row */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                          Bank Details:
                        </span>
                        {member.bankDetails?.isComplete ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded">
                              {member.bankDetails.accountNumberMasked || '•••• Configured'}
                            </span>
                            <button
                              onClick={() => handleOpenRevealBank(member)}
                              title="Reveal Decrypted Bank Details"
                              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-400/80 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded">
                            Pending Info
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Assigned Projects:</span>
                        <span className="text-slate-200 font-mono font-medium">{member.projectsCount || 0}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Active Tasks:</span>
                        <span className="text-slate-200 font-mono font-medium">{member.activeTasksCount || 0}</span>
                      </div>
                    </div>

                    {/* Permissions summary */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {member.permissions && member.permissions.includes('VIEW_CREDENTIALS') && (
                        <span className="text-[10px] bg-amber-950/50 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" /> Credential Access
                        </span>
                      )}
                      {member.permissions && member.permissions.includes('MANAGE_TASKS') && (
                        <span className="text-[10px] bg-blue-950/50 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckSquare className="w-2.5 h-2.5" /> Manage Tasks
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/40 text-xs">
                    <button
                      onClick={() => handleOpenEdit(member)}
                      className="text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edit</span>
                    </button>

                    <div className="flex items-center gap-3">
                      {!member.isPrimaryAdmin && (
                        <button
                          onClick={() => handleToggleDeactivate(member)}
                          className={`inline-flex items-center gap-1 font-medium cursor-pointer ${
                            member.status === 'ACTIVE' ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'
                          }`}
                        >
                          <span>{member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                        </button>
                      )}

                      {!member.isPrimaryAdmin && (
                        <button
                          onClick={() => handleDeleteMember(member)}
                          className="text-red-400 hover:text-red-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Invitations Tab */
        <div className="space-y-4">
          <div className="bg-[#0d0d12] border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-white">Cryptographic Single-Use Invitations</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Invitations expire after the configured duration and become invalid once claimed.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedInviteUrl('');
                  setShowInviteModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>+ Create Link</span>
              </button>
            </div>

            {invitationsLoading ? (
              <div className="p-8 text-center text-zinc-500 text-sm">Loading invitations...</div>
            ) : invitations.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">No invitations generated yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Expires</th>
                      <th className="py-3 px-4">Created By</th>
                      <th className="py-3 px-4">Claimed By</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {invitations.map((inv) => (
                      <tr key={inv._id} className="hover:bg-zinc-900/30">
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold px-2 py-0.5 rounded text-[11px] border ${
                              roleBadges[inv.role] || 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {inv.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              inv.status === 'PENDING'
                                ? 'text-amber-400'
                                : inv.status === 'USED'
                                ? 'text-emerald-400'
                                : inv.status === 'EXPIRED'
                                ? 'text-zinc-500'
                                : 'text-red-400'
                            }`}
                          >
                            {inv.status === 'PENDING' && <Clock className="w-3 h-3" />}
                            {inv.status === 'USED' && <CheckCircle2 className="w-3 h-3" />}
                            {inv.status === 'REVOKED' && <Ban className="w-3 h-3" />}
                            <span>{inv.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-400">
                          {new Date(inv.expiresAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 text-zinc-400">{inv.createdBy}</td>
                        <td className="py-3 px-4">
                          {inv.teamMemberId ? (
                            <span className="text-white font-medium">
                              {inv.teamMemberId.name} ({inv.teamMemberId.email})
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {inv.status === 'PENDING' && (
                            <button
                              onClick={() => handleRevokeInvite(inv._id)}
                              className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Invitation Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0d0d12] border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-emerald-400" />
                Create Onboarding Invitation Link
              </h2>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!createdInviteUrl ? (
              <form onSubmit={handleCreateInvite} className="space-y-4 text-sm">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Role for Invitee *</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-[#14141b] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DEVELOPER">Developer</option>
                    <option value="DESIGNER">Designer</option>
                    <option value="SEO">SEO</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Validity Period (Days) *</label>
                  <select
                    value={inviteExpiresDays}
                    onChange={(e) => setInviteExpiresDays(Number(e.target.value))}
                    className="w-full bg-[#14141b] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={1}>1 Day (24 hours)</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days (Default)</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>

                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" /> Cryptographic Single-Use Security
                  </div>
                  <p>
                    The recipient can set up their profile and encrypted bank details independently without needing an admin to input them manually.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {creatingInvite ? 'Generating...' : 'Generate Invitation Link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-zinc-300 space-y-1">
                    <p className="font-semibold text-emerald-300">Invitation Link Generated!</p>
                    <p>Share this link with your new team member to complete their onboarding.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-[#14141b] border border-zinc-800 rounded-xl p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={createdInviteUrl}
                    className="w-full bg-transparent text-xs text-slate-200 focus:outline-none select-all"
                  />
                  <button
                    onClick={copyInviteToClipboard}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {inviteCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{inviteCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reveal Bank Details Modal */}
      {showRevealBankModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0d0d12] border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                Decrypted Bank Details ({selectedMember.name})
              </h2>
              <button onClick={() => setShowRevealBankModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!revealedBankData ? (
              <form onSubmit={handleRevealBankSubmit} className="space-y-4 text-sm">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                  <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    Re-authentication required. Enter your admin password to decrypt and reveal financial payout details. This action is permanently audit-logged.
                  </p>
                </div>

                {revealError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                    {revealError}
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Admin Password *</label>
                  <input
                    type="password"
                    required
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Enter your administrator password"
                    className="w-full bg-[#14141b] border border-zinc-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowRevealBankModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={revealingBank}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/20 cursor-pointer disabled:opacity-50"
                  >
                    {revealingBank ? 'Decrypting...' : 'Authenticate & Reveal'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Decryption Authenticated
                  </span>
                  <span className="text-zinc-400 font-mono">Audit logged</span>
                </div>

                <div className="space-y-3 bg-[#14141b] border border-zinc-800 rounded-xl p-4 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Account Holder Name:</span>
                    <span className="font-semibold text-white">{revealedBankData.accountHolderName || '—'}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Bank Name:</span>
                    <span className="font-semibold text-white">{revealedBankData.bankName || '—'}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Account Number:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-400">{revealedBankData.accountNumber || '—'}</span>
                      {revealedBankData.accountNumber && (
                        <button
                          onClick={() => copyBankField('acc', revealedBankData.accountNumber)}
                          className="text-zinc-400 hover:text-white p-1"
                        >
                          {bankCopiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">IFSC Code:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{revealedBankData.ifsc || '—'}</span>
                      {revealedBankData.ifsc && (
                        <button
                          onClick={() => copyBankField('ifsc', revealedBankData.ifsc)}
                          className="text-zinc-400 hover:text-white p-1"
                        >
                          {bankCopiedField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-400">UPI ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-300">{revealedBankData.upiId || '—'}</span>
                      {revealedBankData.upiId && (
                        <button
                          onClick={() => copyBankField('upi', revealedBankData.upiId)}
                          className="text-zinc-400 hover:text-white p-1"
                        >
                          {bankCopiedField === 'upi' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowRevealBankModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
                  >
                    Close & Hide
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add New Team Member</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. rahul@example.com"
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Phone (Optional)</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DEVELOPER">Developer</option>
                    <option value="DESIGNER">Designer</option>
                    <option value="MANAGER">Manager</option>
                    <option value="SEO">SEO</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-2">Permissions & Access</label>
                <div className="space-y-2 bg-[#14141b] border border-slate-800/80 p-3 rounded-xl max-h-40 overflow-y-auto">
                  {availablePermissions.map((perm) => (
                    <label key={perm.id} className="flex items-center space-x-2.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span className={perm.id === 'VIEW_CREDENTIALS' ? 'text-amber-400 font-medium' : 'text-slate-300'}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Collapsible Bank Details */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowBankFields(!showBankFields)}
                  className="w-full p-3 bg-zinc-900/60 flex items-center justify-between text-xs font-semibold text-zinc-300 hover:bg-zinc-900 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    Bank & Payout Details (Optional, Encrypted)
                  </span>
                  {showBankFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showBankFields && (
                  <div className="p-3 bg-[#14141b] space-y-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        value={formData.bankDetails.accountHolderName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bankDetails: { ...formData.bankDetails, accountHolderName: e.target.value },
                          })
                        }
                        placeholder="Name on bank account"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-zinc-400 mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={formData.bankDetails.bankName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, bankName: e.target.value },
                            })
                          }
                          placeholder="e.g. HDFC Bank"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 mb-1">Account Number</label>
                        <input
                          type="text"
                          value={formData.bankDetails.accountNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, accountNumber: e.target.value },
                            })
                          }
                          placeholder="Account Number"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-zinc-400 mb-1">IFSC Code</label>
                        <input
                          type="text"
                          value={formData.bankDetails.ifsc}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, ifsc: e.target.value.toUpperCase() },
                            })
                          }
                          placeholder="e.g. HDFC0001234"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 mb-1">UPI ID</label>
                        <input
                          type="text"
                          value={formData.bankDetails.upiId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, upiId: e.target.value },
                            })
                          }
                          placeholder="user@upi"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Create Team Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Member Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Team Member</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DEVELOPER">Developer</option>
                    <option value="DESIGNER">Designer</option>
                    <option value="MANAGER">Manager</option>
                    <option value="SEO">SEO</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-2">Permissions</label>
                <div className="space-y-2 bg-[#14141b] border border-slate-800/80 p-3 rounded-xl max-h-40 overflow-y-auto">
                  {availablePermissions.map((perm) => (
                    <label key={perm.id} className="flex items-center space-x-2.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span className={perm.id === 'VIEW_CREDENTIALS' ? 'text-amber-400 font-medium' : 'text-slate-300'}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Collapsible Bank Details for Edit */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowBankFields(!showBankFields)}
                  className="w-full p-3 bg-zinc-900/60 flex items-center justify-between text-xs font-semibold text-zinc-300 hover:bg-zinc-900 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    Update Bank & Payout Details (Encrypted)
                  </span>
                  {showBankFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showBankFields && (
                  <div className="p-3 bg-[#14141b] space-y-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        value={formData.bankDetails.accountHolderName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bankDetails: { ...formData.bankDetails, accountHolderName: e.target.value },
                          })
                        }
                        placeholder="Name on bank account"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-zinc-400 mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={formData.bankDetails.bankName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, bankName: e.target.value },
                            })
                          }
                          placeholder="e.g. HDFC Bank"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 mb-1">Account Number (Leave blank to keep unchanged)</label>
                        <input
                          type="text"
                          value={formData.bankDetails.accountNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, accountNumber: e.target.value },
                            })
                          }
                          placeholder="New Account Number"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-zinc-400 mb-1">IFSC Code</label>
                        <input
                          type="text"
                          value={formData.bankDetails.ifsc}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, ifsc: e.target.value.toUpperCase() },
                            })
                          }
                          placeholder="e.g. HDFC0001234"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 mb-1">UPI ID</label>
                        <input
                          type="text"
                          value={formData.bankDetails.upiId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, upiId: e.target.value },
                            })
                          }
                          placeholder="user@upi"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Telegram Connection Link Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-400" />
                Telegram Connection Link
              </h2>
              <button onClick={() => setShowTokenModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Share this single-use link with <b>{selectedMember?.name}</b>. When opened in Telegram, their profile will automatically be linked.
            </p>

            <div className="flex items-center gap-2 bg-[#14141b] border border-slate-800 rounded-xl p-2.5">
              <input
                type="text"
                readOnly
                value={generatedLink}
                className="w-full bg-transparent text-xs text-slate-200 focus:outline-none select-all"
              />
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-start gap-2 text-[11px] text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>This token expires in 24 hours and becomes invalid immediately after successful connection.</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTokenModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersIcon(props: any) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}
