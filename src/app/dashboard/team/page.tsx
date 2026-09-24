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
    OTHER: 'bg-[#18181b] text-[#88888e] border-[#242428]',
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-[#ff3e00]">
              ENGINEERING // TEAM
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Team Management</h1>
          <p className="text-xs sm:text-sm text-[#a1a1aa] mt-0.5">
            Development personnel registry, single-use invitations, secure bank payout accounts, and task permissions.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setCreatedInviteUrl('');
              setShowInviteModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xs bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-[#ff3e00]/60 text-white font-mono text-xs uppercase font-bold tracking-wider transition-colors cursor-pointer shrink-0"
          >
            <Link2 className="w-3.5 h-3.5 text-[#ff3e00]" />
            <span>+ Invite via Link</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xs bg-white text-black hover:bg-[#ff3e00] hover:text-white font-mono text-xs uppercase font-bold tracking-wider shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add Member</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#242428] pb-px overflow-x-auto text-xs font-mono font-bold uppercase tracking-wider scrollbar-none">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'members'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <span>Team Members</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[#141416] border border-[#27272a] text-[#a1a1aa]">
            {members.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'invitations'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <span>Onboarding Invitations</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[#141416] border border-[#27272a] text-[#a1a1aa]">
            {invitations.length}
          </span>
        </button>
      </div>

      {activeTab === 'members' ? (
        <>
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#141416] border border-[#242428] p-3 rounded-xs">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71717a] pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="w-full bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs pl-9 pr-3 py-2 text-xs text-white placeholder-[#52525b] outline-none transition-all"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs px-3 py-2 text-xs font-mono text-[#f5f5f2] outline-none cursor-pointer"
              >
                <option value="">ALL ROLES</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="DEVELOPER">DEVELOPER</option>
                <option value="DESIGNER">DESIGNER</option>
                <option value="SEO">SEO</option>
                <option value="OTHER">OTHER</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs px-3 py-2 text-xs font-mono text-[#f5f5f2] outline-none cursor-pointer"
              >
                <option value="">ALL STATUSES</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DEACTIVATED">DEACTIVATED</option>
              </select>
            </div>
          </div>

          {/* Team Member Cards */}
          {loading ? (
            <div className="flex items-center justify-center p-12 text-[#88888e] font-mono text-xs">Loading team members...</div>
          ) : members.length === 0 ? (
            <div className="text-center p-8 sm:p-12 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs">
              <UsersIcon className="w-12 h-12 text-[#88888e] mx-auto mb-3" />
              <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-white">No team members found</h3>
              <p className="text-xs font-mono text-[#88888e] mt-1">Get started by inviting or adding a team member.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => (
                <div
                  key={member._id}
                  className={`bg-[#141416] border p-5 flex flex-col justify-between transition-colors rounded-none md:rounded-xs ${
                    member.status === 'DEACTIVATED' ? 'border-[#1c1110] opacity-60' : 'border-[#242428] hover:border-[#ff3e00]/50'
                  }`}
                >
                  <div>
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-white text-sm leading-tight flex items-center gap-2">
                          {member.name}
                          {member.isPrimaryAdmin && (
                            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-[#ff3e00]/10 text-[#ff3e00] border border-[#ff3e00]/30">
                              PRIMARY ADMIN
                            </span>
                          )}
                        </h3>
                        <p className="text-xs font-mono text-[#8a8a93] mt-1 truncate">{member.email}</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border bg-[#0a0a0a] border-[#242428] text-white">
                        {member.role}
                      </span>
                    </div>

                    {/* Status and Details */}
                    <div className="space-y-2 py-3 border-y border-[#242428] my-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8a8a93] font-mono text-[11px]">TELEGRAM BOT:</span>
                        {member.telegramConnected ? (
                          <span className="inline-flex items-center gap-1.5 text-[#00d664] font-mono text-[11px] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>CONNECTED</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGenerateLink(member)}
                            className="inline-flex items-center gap-1 text-[#ff3e00] hover:underline font-mono text-[11px] cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>GENERATE LINK</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8a8a93] font-mono text-[11px]">STATUS:</span>
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            member.status === 'ACTIVE' ? 'text-[#00d664]' : 'text-[#ff3e00]'
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>

                      {/* Bank Details Status Row */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8a8a93] font-mono text-[11px] flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-[#6b6b76]" />
                          BANK DETAILS:
                        </span>
                        {member.bankDetails?.isComplete ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-[#00d664] bg-[#0e1f15] border border-[#00d664]/30 px-2 py-0.5">
                              {member.bankDetails.accountNumberMasked || '•••• CONFIGURED'}
                            </span>
                            <button
                              onClick={() => handleOpenRevealBank(member)}
                              title="Reveal Decrypted Bank Details"
                              className="text-[#8a8a93] hover:text-white p-1 hover:bg-[#242428] cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-[#f59e0b] bg-[#1c1408] border border-[#f59e0b]/30 px-2 py-0.5">
                            PENDING REGISTRATION
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8a8a93] font-mono text-[11px]">ASSIGNED PROJECTS:</span>
                        <span className="text-white font-mono font-medium">{member.projectsCount || 0}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8a8a93] font-mono text-[11px]">ACTIVE TASKS:</span>
                        <span className="text-white font-mono font-medium">{member.activeTasksCount || 0}</span>
                      </div>
                    </div>

                    {/* Permissions summary */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {member.permissions && member.permissions.includes('VIEW_CREDENTIALS') && (
                        <span className="text-[10px] font-mono uppercase tracking-wider bg-[#18181b] text-[#f59e0b] border border-[#f59e0b]/30 px-2 py-0.5 rounded-none md:rounded-xs flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" /> Credentials
                        </span>
                      )}
                      {member.permissions && member.permissions.includes('MANAGE_TASKS') && (
                        <span className="text-[10px] font-mono uppercase tracking-wider bg-[#18181b] text-white border border-[#242428] px-2 py-0.5 rounded-none md:rounded-xs flex items-center gap-1">
                          <CheckSquare className="w-2.5 h-2.5 text-[#ff3e00]" /> Tasks
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#242428] text-xs font-mono">
                    <button
                      onClick={() => handleOpenEdit(member)}
                      className="text-[#88888e] hover:text-white inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#ff3e00]" />
                      <span>Edit</span>
                    </button>

                    <div className="flex items-center gap-3">
                      {!member.isPrimaryAdmin && (
                        <button
                          onClick={() => handleToggleDeactivate(member)}
                          className={`inline-flex items-center gap-1 font-mono cursor-pointer transition-colors ${
                            member.status === 'ACTIVE' ? 'text-[#f59e0b] hover:text-[#f59e0b]/80' : 'text-[#00D664] hover:text-[#00D664]/80'
                          }`}
                        >
                          <span>{member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                        </button>
                      )}

                      {!member.isPrimaryAdmin && (
                        <button
                          onClick={() => handleDeleteMember(member)}
                          className="text-[#88888e] hover:text-[#EF4444] inline-flex items-center gap-1 cursor-pointer transition-colors"
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
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs overflow-hidden">
            <div className="p-4 border-b border-[#242428] flex justify-between items-center">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-white">Cryptographic Single-Use Invitations</h3>
                <p className="text-[11px] font-mono text-[#88888e] mt-0.5">
                  Invitations expire after the configured duration and become invalid once claimed.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedInviteUrl('');
                  setShowInviteModal(true);
                }}
                className="crm-btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>+ Create Link</span>
              </button>
            </div>

            {invitationsLoading ? (
              <div className="p-8 text-center text-[#88888e] font-mono text-xs">Loading invitations...</div>
            ) : invitations.length === 0 ? (
              <div className="p-8 text-center text-[#88888e] font-mono text-xs">No invitations generated yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono text-[#e4e4e7]">
                  <thead className="bg-[#0a0a0a] border-b border-[#242428] text-[10px] text-[#88888e] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Expires</th>
                      <th className="py-3 px-4">Created By</th>
                      <th className="py-3 px-4">Claimed By</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242428]">
                    {invitations.map((inv) => (
                      <tr key={inv._id} className="hover:bg-[#18181b]/50 transition-colors">
                        <td className="py-3 px-4">
                          <span
                            className="font-mono uppercase px-2 py-0.5 text-[10px] border border-[#242428] bg-[#0a0a0a] text-white"
                          >
                            {inv.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-xs ${
                              inv.status === 'PENDING'
                                ? 'text-[#f59e0b]'
                                : inv.status === 'USED'
                                ? 'text-[#00D664]'
                                : inv.status === 'EXPIRED'
                                ? 'text-[#88888e]'
                                : 'text-[#EF4444]'
                            }`}
                          >
                            {inv.status === 'PENDING' && <Clock className="w-3 h-3" />}
                            {inv.status === 'USED' && <CheckCircle2 className="w-3 h-3" />}
                            {inv.status === 'REVOKED' && <Ban className="w-3 h-3" />}
                            <span>{inv.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#88888e]">
                          {new Date(inv.expiresAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 text-[#88888e]">{inv.createdBy}</td>
                        <td className="py-3 px-4">
                          {inv.teamMemberId ? (
                            <span className="text-white">
                              {inv.teamMemberId.name} ({inv.teamMemberId.email})
                            </span>
                          ) : (
                            <span className="text-[#88888e]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {inv.status === 'PENDING' && (
                            <button
                              onClick={() => handleRevokeInvite(inv._id)}
                              className="text-[#EF4444] hover:underline cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::INVITE // CREATE_LINK</span>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!createdInviteUrl ? (
              <form onSubmit={handleCreateInvite} className="space-y-4 text-xs font-mono">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Role for Invitee *</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
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
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Validity Period (Days) *</label>
                  <select
                    value={inviteExpiresDays}
                    onChange={(e) => setInviteExpiresDays(Number(e.target.value))}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value={1}>1 Day (24 hours)</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days (Default)</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>

                <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs text-[#88888e] space-y-1">
                  <div className="flex items-center gap-1.5 text-white font-semibold">
                    <Shield className="w-3.5 h-3.5 text-[#00D664]" /> Cryptographic Single-Use Security
                  </div>
                  <p>
                    The recipient can set up their profile and encrypted bank details independently without needing an admin to input them manually.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="crm-btn-secondary px-4 py-2 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="crm-btn-primary px-4 py-2 text-xs disabled:opacity-50"
                  >
                    {creatingInvite ? 'Generating...' : 'Generate Invitation Link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 bg-[#00D664]/10 border border-[#00D664]/30 rounded-none md:rounded-xs flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00D664] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-white">Invitation Link Generated</p>
                    <p className="text-[#88888e]">Share this single-use link with your new team member to complete onboarding.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={createdInviteUrl}
                    className="w-full bg-transparent text-xs text-white focus:outline-none select-all"
                  />
                  <button
                    onClick={copyInviteToClipboard}
                    className="crm-btn-primary px-3 py-1.5 text-xs flex items-center gap-1 shrink-0"
                  >
                    {inviteCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{inviteCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="crm-btn-secondary px-4 py-2 text-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#00D664]">
                <Lock className="w-4 h-4 text-[#00D664]" />
                <span>VAULT::BANK_ACCOUNT // {selectedMember.name}</span>
              </div>
              <button
                onClick={() => setShowRevealBankModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!revealedBankData ? (
              <form onSubmit={handleRevealBankSubmit} className="space-y-4 text-xs font-mono">
                <div className="p-3 bg-[#18181b] border border-[#242428] rounded-none md:rounded-xs flex items-start gap-2.5 text-xs text-[#88888e]">
                  <Shield className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" />
                  <p>
                    Re-authentication required. Enter your admin password to decrypt and reveal financial payout details. This action is permanently audit-logged.
                  </p>
                </div>

                {revealError && (
                  <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-none md:rounded-xs text-xs text-[#EF4444]">
                    {revealError}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Admin Password *</label>
                  <input
                    type="password"
                    required
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Enter your administrator password"
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white text-xs focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                  <button
                    type="button"
                    onClick={() => setShowRevealBankModal(false)}
                    className="crm-btn-secondary px-4 py-2 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={revealingBank}
                    className="crm-btn-primary px-4 py-2 text-xs disabled:opacity-50"
                  >
                    {revealingBank ? 'Decrypting...' : 'Authenticate & Reveal'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs font-mono">
                <div className="p-3 bg-[#00D664]/10 border border-[#00D664]/30 rounded-none md:rounded-xs flex items-center justify-between text-[#00D664]">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> Decryption Authenticated
                  </span>
                  <span className="text-[#88888e]">Audit logged</span>
                </div>

                <div className="space-y-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs p-4 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#242428]">
                    <span className="text-[#88888e]">Account Holder Name:</span>
                    <span className="font-semibold text-white">{revealedBankData.accountHolderName || '—'}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#242428]">
                    <span className="text-[#88888e]">Bank Name:</span>
                    <span className="font-semibold text-white">{revealedBankData.bankName || '—'}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#242428]">
                    <span className="text-[#88888e]">Account Number:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#00D664]">{revealedBankData.accountNumber || '—'}</span>
                      {revealedBankData.accountNumber && (
                        <button
                          onClick={() => copyBankField('acc', revealedBankData.accountNumber)}
                          className="text-[#88888e] hover:text-white p-1"
                        >
                          {bankCopiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-[#00D664]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#242428]">
                    <span className="text-[#88888e]">IFSC Code:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{revealedBankData.ifsc || '—'}</span>
                      {revealedBankData.ifsc && (
                        <button
                          onClick={() => copyBankField('ifsc', revealedBankData.ifsc)}
                          className="text-[#88888e] hover:text-white p-1"
                        >
                          {bankCopiedField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-[#00D664]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#88888e]">UPI ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#ff3e00]">{revealedBankData.upiId || '—'}</span>
                      {revealedBankData.upiId && (
                        <button
                          onClick={() => copyBankField('upi', revealedBankData.upiId)}
                          className="text-[#88888e] hover:text-white p-1"
                        >
                          {bankCopiedField === 'upi' ? <Check className="w-3.5 h-3.5 text-[#00D664]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowRevealBankModal(false)}
                    className="crm-btn-secondary px-4 py-2 text-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::TEAM // ONBOARD_MEMBER</span>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. rahul@example.com"
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Phone (Optional)</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
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
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-2">Permissions & Access</label>
                <div className="space-y-2 bg-[#0a0a0a] border border-[#242428] p-3 rounded-none md:rounded-xs max-h-40 overflow-y-auto">
                  {availablePermissions.map((perm) => (
                    <label key={perm.id} className="flex items-center space-x-2.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="rounded-none text-[#ff3e00] focus:ring-0"
                      />
                      <span className={perm.id === 'VIEW_CREDENTIALS' ? 'text-[#f59e0b] font-medium' : 'text-[#88888e]'}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Collapsible Bank Details */}
              <div className="border border-[#242428] rounded-none md:rounded-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowBankFields(!showBankFields)}
                  className="w-full p-3 bg-[#18181b] flex items-center justify-between text-xs font-mono text-[#88888e] hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#00D664]" />
                    Bank & Payout Details (Optional, Encrypted)
                  </span>
                  {showBankFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showBankFields && (
                  <div className="p-3 bg-[#0a0a0a] space-y-3 text-xs border-t border-[#242428]">
                    <div>
                      <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Account Holder Name</label>
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
                        className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Bank Name</label>
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
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Account Number</label>
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
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">IFSC Code</label>
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
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white uppercase focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">UPI ID</label>
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
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary px-4 py-2 text-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::TEAM // UPDATE_MEMBER</span>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
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
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-2">Permissions</label>
                <div className="space-y-2 bg-[#0a0a0a] border border-[#242428] p-3 rounded-none md:rounded-xs max-h-40 overflow-y-auto">
                  {availablePermissions.map((perm) => (
                    <label key={perm.id} className="flex items-center space-x-2.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="rounded-none text-[#ff3e00] focus:ring-0"
                      />
                      <span className={perm.id === 'VIEW_CREDENTIALS' ? 'text-[#f59e0b] font-medium' : 'text-[#88888e]'}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Collapsible Bank Details for Edit */}
              <div className="border border-[#242428] rounded-none md:rounded-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowBankFields(!showBankFields)}
                  className="w-full p-3 bg-[#18181b] flex items-center justify-between text-xs font-mono text-[#88888e] hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#00D664]" />
                    Update Bank & Payout Details (Encrypted)
                  </span>
                  {showBankFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showBankFields && (
                  <div className="p-3 bg-[#0a0a0a] space-y-3 text-xs border-t border-[#242428]">
                    <div>
                      <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Account Holder Name</label>
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
                        className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Bank Name</label>
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
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Account Number (Leave blank to keep unchanged)</label>
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
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">IFSC Code</label>
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
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white uppercase focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">UPI ID</label>
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
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary px-4 py-2 text-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                <Send className="w-4 h-4 text-[#ff3e00]" />
                <span>SYS::TELEGRAM // UPLINK_TOKEN</span>
              </div>
              <button
                onClick={() => setShowTokenModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-mono text-[#88888e]">
              Share this single-use link with <b className="text-white">{selectedMember?.name}</b>. When opened in Telegram, their profile will automatically be linked.
            </p>

            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs p-2.5">
              <input
                type="text"
                readOnly
                value={generatedLink}
                className="w-full bg-transparent text-xs font-mono text-white focus:outline-none select-all"
              />
              <button
                onClick={copyToClipboard}
                className="crm-btn-primary px-3 py-1.5 text-xs flex items-center gap-1 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-3 bg-[#18181b] border border-[#242428] rounded-none md:rounded-xs flex items-start gap-2 text-[11px] font-mono text-[#f59e0b]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>This token expires in 24 hours and becomes invalid immediately after successful connection.</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTokenModal(false)}
                className="crm-btn-secondary px-4 py-2 text-xs"
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
