'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  FileText,
  CheckSquare,
  Lock,
  Server,
  FileSignature,
  History,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Send,
  Loader2,
  X,
  User,
} from 'lucide-react';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [project, setProject] = useState<any | null>(null);
  const [financials, setFinancials] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [hostings, setHostings] = useState<any[]>([]);
  const [agreement, setAgreement] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'tasks' | 'payments' | 'invoices' | 'credentials' | 'hosting' | 'agreement' | 'activity'
  >('overview');

  // Modals
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showManualCredModal, setShowManualCredModal] = useState(false);
  const [showAddHostingModal, setShowAddHostingModal] = useState(false);
  const [showSendAgreementModal, setShowSendAgreementModal] = useState(false);
  const [showRevealCredModal, setShowRevealCredModal] = useState(false);
  const [revealedCred, setRevealedCred] = useState<any | null>(null);

  // Banner status
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Project form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    serviceType: '',
    totalAmount: '',
    currency: 'INR',
    status: 'PLANNED',
    startDate: '',
    expectedCompletionDate: '',
    scope: '',
    terms: '',
    notes: '',
  });

  // Manual Credential form state
  const [credFormData, setCredFormData] = useState({
    service: '',
    username: '',
    password: '',
    loginUrl: '',
    additionalInfo: '',
    credentialType: 'WORDPRESS',
    taskId: '',
  });

  // Agreement form state
  const [agreementTerms, setAgreementTerms] = useState('');

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const [projRes, tasksRes, paymentsRes, invRes, credsRes, hostingsRes, agRes, auditRes] =
        await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/tasks?projectId=${id}`),
          fetch(`/api/payments?projectId=${id}`),
          fetch(`/api/invoices?projectId=${id}`),
          fetch(`/api/credentials?projectId=${id}`),
          fetch(`/api/hosting?projectId=${id}`),
          fetch(`/api/agreements?projectId=${id}`),
          fetch(`/api/audit-logs?entityType=Project&entityId=${id}&limit=50`),
        ]);

      const [projData, tasksData, paymentsData, invData, credsData, hostingsData, agData, auditData] =
        await Promise.all([
          projRes.json(),
          tasksRes.json(),
          paymentsRes.json(),
          invRes.json(),
          credsRes.json(),
          hostingsRes.json(),
          agRes.json(),
          auditRes.json(),
        ]);

      if (projData.success) {
        setProject(projData.data.project);
        setFinancials(projData.data.financials);

        const p = projData.data.project;
        setEditFormData({
          name: p.name || '',
          serviceType: p.serviceType || 'WEBSITE',
          totalAmount: String(p.totalAmount || ''),
          currency: p.currency || 'INR',
          status: p.status || 'PLANNED',
          startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
          expectedCompletionDate: p.expectedCompletionDate
            ? new Date(p.expectedCompletionDate).toISOString().split('T')[0]
            : '',
          scope: p.scope || '',
          terms: p.terms || '',
          notes: p.notes || '',
        });
        setAgreementTerms(p.terms || '');
      }

      if (tasksData.success) setTasks(tasksData.data || []);
      if (paymentsData.success) setPayments(paymentsData.data || []);
      if (invData.success) setInvoices(invData.data || []);
      if (credsData.success) setCredentials(credsData.data || []);
      if (hostingsData.success) setHostings(hostingsData.data || []);
      if (agData.success && agData.data && agData.data.length > 0) {
        setAgreement(agData.data[0]);
      }
      if (auditData.success) setAuditLogs(auditData.data?.logs || []);
    } catch (err: any) {
      console.error('Failed to load project details:', err);
      setBannerError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  // Handle Edit Project Submit
  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editFormData,
          totalAmount: parseFloat(editFormData.totalAmount) || 0,
          startDate: editFormData.startDate ? new Date(editFormData.startDate) : undefined,
          expectedCompletionDate: editFormData.expectedCompletionDate
            ? new Date(editFormData.expectedCompletionDate)
            : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBannerSuccess('Project details updated successfully');
        setShowEditProjectModal(false);
        fetchProjectData();
      } else {
        setBannerError(json.error?.message || 'Failed to update project');
      }
    } catch (err: any) {
      setBannerError(err.message || 'Error updating project');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Manual Credential Submit
  const handleAddManualCred = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: project.clientId._id,
          projectId: project._id,
          taskId: credFormData.taskId || undefined,
          credentialType: credFormData.credentialType,
          service: credFormData.service,
          username: credFormData.username,
          password: credFormData.password,
          loginUrl: credFormData.loginUrl || undefined,
          additionalInfo: credFormData.additionalInfo || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBannerSuccess('Manual credential added and securely encrypted.');
        setShowManualCredModal(false);
        setCredFormData({
          service: '',
          username: '',
          password: '',
          loginUrl: '',
          additionalInfo: '',
          credentialType: 'WORDPRESS',
          taskId: '',
        });
        fetchProjectData();
      } else {
        setBannerError(json.error?.message || 'Failed to add manual credential');
      }
    } catch (err: any) {
      setBannerError(err.message || 'Error adding manual credential');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Send Agreement Submit
  const handleSendAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !agreementTerms) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project._id,
          terms: agreementTerms,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBannerSuccess('Agreement terms created and dispatched to client via Telegram!');
        setShowSendAgreementModal(false);
        fetchProjectData();
      } else {
        setBannerError(json.error?.message || 'Failed to dispatch agreement');
      }
    } catch (err: any) {
      setBannerError(err.message || 'Error dispatching agreement');
    } finally {
      setSubmitting(false);
    }
  };

  // Reveal Credential Secrets
  const handleRevealCred = async (credId: string) => {
    try {
      const res = await fetch(`/api/credentials/${credId}/reveal`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setRevealedCred(json.data);
        setShowRevealCredModal(true);
      } else {
        setBannerError(json.error?.message || 'Failed to decrypt credential');
      }
    } catch (err: any) {
      setBannerError('Decryption request failed');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff3e00]" />
        <p className="font-mono text-xs text-[#88888e] uppercase tracking-wider">SYS::LOADING_PROJECT_DETAILS...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-[#f59e0b] mx-auto" />
        <h2 className="text-lg font-mono font-semibold uppercase tracking-wider text-white">Project Not Found</h2>
        <Link
          href="/dashboard/projects"
          className="crm-btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#ff3e00]" />
          <span>SYS::RETURN_TO_PROJECTS</span>
        </Link>
      </div>
    );
  }

  const client = project.clientId;
  const currencySymbol = project.currency === 'INR' ? '₹' : (project.currency === 'USD' ? '$' : project.currency);
  const paid = financials?.paidAmount ?? 0;
  const total = financials?.totalAmount ?? project.totalAmount;
  const outstanding = financials?.outstandingAmount ?? Math.max(0, total - paid);

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

      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/projects"
            className="p-2 bg-[#141416] hover:bg-[#18181b] border border-[#27272a] hover:border-[#ff3e00] rounded-xs text-[#a1a1aa] hover:text-white transition-colors"
            title="Back to Projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{project.name}</h1>
              <span className="text-[10px] bg-[#0e0e11] border border-[#27272a] text-[#ff3e00] font-mono font-bold px-2 py-0.5 rounded-xs uppercase tracking-wider">
                {project.projectCode}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-xs font-mono font-bold uppercase tracking-wider bg-[#18181b] border border-[#27272a] text-[#f5f5f2]">
                {project.status}
              </span>
            </div>
            <div className="text-xs text-[#71717a] mt-1 flex items-center gap-2 flex-wrap">
              <span>Client:</span>
              <Link
                href={`/dashboard/clients/${client?._id}`}
                className="font-bold text-white hover:text-[#ff3e00] transition-colors"
              >
                {client?.name} ({client?.clientCode})
              </Link>
              <span>•</span>
              <span className="font-mono text-[11px]">Service: <b className="text-[#a1a1aa]">{project.serviceType}</b></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowEditProjectModal(true)}
            className="px-3.5 py-2 bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-[#ff3e00]/60 text-white rounded-xs font-mono text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#ff3e00]" />
            <span>Edit Project</span>
          </button>

          <button
            onClick={() => setShowSendAgreementModal(true)}
            className="px-3.5 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-xs font-mono text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>{agreement ? 'Update Agreement' : 'Send Agreement'}</span>
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-[#141416] border border-[#242428] rounded-xs">
          <div className="font-mono text-[10px] text-[#a1a1aa] uppercase font-bold tracking-widest">Total Project Value</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-white mt-1.5 tracking-tight">
            {currencySymbol} {total.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-5 bg-[#141416] border border-[#242428] rounded-xs">
          <div className="font-mono text-[10px] text-[#00d664] uppercase font-bold tracking-widest">Total Realized (Paid)</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-[#00d664] mt-1.5 tracking-tight">
            {currencySymbol} {paid.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-5 bg-[#141416] border border-[#242428] rounded-xs">
          <div className="font-mono text-[10px] text-[#ff3e00] uppercase font-bold tracking-widest">Outstanding Balance</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-[#ff3e00] mt-1.5 tracking-tight">
            {currencySymbol} {outstanding.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-[#242428] pb-px overflow-x-auto text-xs font-mono font-bold uppercase tracking-wider scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'overview'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'tasks'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Tasks ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'payments'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payments ({payments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'invoices'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Invoices ({invoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('credentials')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'credentials'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Credentials ({credentials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('hosting')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'hosting'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Hosting ({hostings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('agreement')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'agreement'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <FileSignature className="w-3.5 h-3.5" />
          <span>Agreement {agreement ? `(${agreement.status})` : ''}</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'activity'
              ? 'border-[#ff3e00] text-white bg-white/[0.03]'
              : 'border-transparent text-[#71717a] hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Activity</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
          <div className="p-6 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#242428]">
              <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">SYS::PROJECT_PARAMETERS</h3>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#242428]">
                <span className="text-[#88888e] uppercase text-[10px]">Service Category</span>
                <span className="font-semibold text-white">{project.serviceType}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#242428]">
                <span className="text-[#88888e] uppercase text-[10px]">Current Status</span>
                <span className="font-semibold text-[#ff3e00] uppercase">{project.status}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#242428]">
                <span className="text-[#88888e] uppercase text-[10px]">Start Date</span>
                <span className="font-semibold text-white">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#242428]">
                <span className="text-[#88888e] uppercase text-[10px]">Target Completion</span>
                <span className="font-semibold text-white">
                  {project.expectedCompletionDate
                    ? new Date(project.expectedCompletionDate).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              {project.completionDate && (
                <div className="flex justify-between py-1.5 border-b border-[#242428]">
                  <span className="text-[#88888e] uppercase text-[10px]">Completed On</span>
                  <span className="font-semibold text-[#00D664]">
                    {new Date(project.completionDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {project.description && (
              <div className="space-y-1.5 pt-2 border-t border-[#242428]">
                <span className="text-[10px] uppercase tracking-wider text-[#88888e]">Description</span>
                <p className="text-xs text-[#88888e] leading-relaxed bg-[#0a0a0a] p-3 rounded-none md:rounded-xs border border-[#242428]">
                  {project.description}
                </p>
              </div>
            )}
          </div>

          <div className="p-6 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#242428]">
              <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">SYS::SCOPE_AND_TERMS</h3>
            </div>
            {project.scope ? (
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-[#88888e]">Project Scope</span>
                <div className="text-xs text-white leading-relaxed bg-[#0a0a0a] p-3 rounded-none md:rounded-xs border border-[#242428] whitespace-pre-wrap">
                  {project.scope}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs text-[#88888e]">
                No specific scope notes entered yet. Click &quot;Edit Project&quot; to configure.
              </div>
            )}

            {project.terms && (
              <div className="space-y-1.5 pt-2 border-t border-[#242428]">
                <span className="text-[10px] uppercase tracking-wider text-[#88888e]">Contract Terms</span>
                <div className="text-xs text-white leading-relaxed bg-[#0a0a0a] p-3 rounded-none md:rounded-xs border border-[#242428] whitespace-pre-wrap">
                  {project.terms}
                </div>
              </div>
            )}

            {project.notes && (
              <div className="space-y-1.5 pt-2 border-t border-[#242428]">
                <span className="text-[10px] uppercase tracking-wider text-[#88888e]">Internal Admin Notes</span>
                <p className="text-xs text-[#88888e] leading-relaxed bg-[#0a0a0a] p-3 rounded-none md:rounded-xs border border-[#242428]">
                  {project.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">PROJECT TASKS ({tasks.length})</h3>
            <Link
              href="/dashboard/tasks"
              className="px-3.5 py-1.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs text-xs uppercase tracking-wider font-semibold inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              MANAGE ALL TASKS
            </Link>
          </div>

          {tasks.length === 0 ? (
            <div className="py-12 text-center bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-[#88888e] text-xs">
              NO TASKS CREATED FOR THIS PROJECT YET.
            </div>
          ) : (
            <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#242428] bg-[#0a0a0a] text-[#88888e] text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Assigned Member</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Deliverables</th>
                    <th className="px-4 py-3">Credentials</th>
                    <th className="px-4 py-3 text-right">Compensation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242428] text-[#88888e]">
                  {tasks.map((t) => (
                    <tr key={t._id} className="hover:bg-[#18181b]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{t.title}</div>
                        <div className="text-[11px] text-[#ff3e00]">{t.taskCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        {t.assignedTo ? (
                          <span className="font-medium text-white">{t.assignedTo.name}</span>
                        ) : (
                          <span className="text-[#55555a] italic">UNASSIGNED</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-semibold bg-[#18181b] border border-[#242428] text-[#88888e]">
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#ff3e00]">{t.status}</td>
                      <td className="px-4 py-3">
                        {t.submission ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#00D664] bg-[#00D664]/10 border border-[#00D664]/20 px-2 py-0.5 rounded-none md:rounded-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>SUBMITTED ({t.submission.submissionFiles?.length || 0} files, {t.submission.submissionUrls?.length || 0} URLs)</span>
                          </span>
                        ) : t.submissionRequired ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded-none md:rounded-xs">
                            <Clock className="w-3 h-3" />
                            <span>REQUIRED ({t.submissionTypes?.join(', ') || 'URL/File'})</span>
                          </span>
                        ) : (
                          <span className="text-[#55555a] text-[11px]">OPTIONAL</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#88888e]">
                        {t.requiredCredentialIds?.length || 0} Required
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {t.agreedAmount ? `${currencySymbol} ${t.agreedAmount.toLocaleString('en-IN')}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payments */}
      {activeTab === 'payments' && (
        <div className="space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">PAYMENT TRANSACTIONS ({payments.length})</h3>
            <Link
              href="/dashboard/payments"
              className="px-3.5 py-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-white rounded-none md:rounded-xs text-xs uppercase tracking-wider font-semibold inline-flex items-center gap-1.5 transition-all"
            >
              RECORD PAYMENT IN BILLING
            </Link>
          </div>

          {payments.length === 0 ? (
            <div className="py-12 text-center bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-[#88888e] text-xs">
              NO PAYMENTS RECORDED FOR THIS PROJECT YET.
            </div>
          ) : (
            <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#242428] bg-[#0a0a0a] text-[#88888e] text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-4 py-3">Receipt / Ref</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242428] text-[#88888e]">
                  {payments.map((p) => (
                    <tr key={p._id} className="hover:bg-[#18181b]/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{p.paymentNumber}</td>
                      <td className="px-4 py-3">{new Date(p.paymentDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-white">{p.paymentMethod}</td>
                      <td className="px-4 py-3">{p.paymentType || 'INSTALLMENT'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-semibold bg-[#00D664]/10 border border-[#00D664]/20 text-[#00D664]">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#00D664]">
                        {p.currency === 'INR' ? '₹' : p.currency} {p.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Invoices */}
      {activeTab === 'invoices' && (
        <div className="space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">PROJECT INVOICES ({invoices.length})</h3>
            <Link
              href="/dashboard/invoices"
              className="px-3.5 py-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-white rounded-none md:rounded-xs text-xs uppercase tracking-wider font-semibold inline-flex items-center gap-1.5 transition-all"
            >
              GENERATE NEW INVOICE
            </Link>
          </div>

          {invoices.length === 0 ? (
            <div className="py-12 text-center bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-[#88888e] text-xs">
              NO INVOICES GENERATED FOR THIS PROJECT YET.
            </div>
          ) : (
            <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#242428] bg-[#0a0a0a] text-[#88888e] text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Issue Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Telegram Delivered</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242428] text-[#88888e]">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-[#18181b]/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-semibold text-[#ff3e00]">{inv.status}</td>
                      <td className="px-4 py-3">
                        {inv.telegramSent ? (
                          <span className="text-[#00D664] flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> SENT
                          </span>
                        ) : (
                          <span className="text-[#55555a]">NOT SENT</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-white">
                        {inv.currency === 'INR' ? '₹' : inv.currency} {inv.total.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Credentials */}
      {activeTab === 'credentials' && (
        <div className="space-y-4 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">PROJECT CREDENTIALS ({credentials.length})</h3>
              <p className="text-[11px] text-[#88888e] mt-0.5">
                Encrypted at rest with AES-256-GCM. Never logged or transmitted in cleartext.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowManualCredModal(true)}
                className="px-3.5 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD CREDENTIAL MANUALLY</span>
              </button>
            </div>
          </div>

          {credentials.length === 0 ? (
            <div className="py-12 text-center bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-3">
              <Lock className="w-8 h-8 text-[#55555a] mx-auto" />
              <p className="text-xs text-[#88888e]">NO CREDENTIALS STORED FOR THIS PROJECT YET.</p>
              <button
                onClick={() => setShowManualCredModal(true)}
                className="px-3.5 py-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-white rounded-none md:rounded-xs text-xs uppercase tracking-wider font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                ADD CREDENTIAL MANUALLY
              </button>
            </div>
          ) : (
            <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#242428] bg-[#0a0a0a] text-[#88888e] text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-4 py-3">Service & Type</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Associated Task</th>
                    <th className="px-4 py-3">Added</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242428] text-[#88888e]">
                  {credentials.map((c) => (
                    <tr key={c._id} className="hover:bg-[#18181b]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{c.service}</div>
                        <div className="text-[10px] text-[#ff3e00] font-mono">{c.credentialType}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-white">{c.username || '***'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-semibold bg-[#18181b] border border-[#242428] text-[#88888e]">
                          {c.source === 'MANUAL' ? 'MANUAL' : 'CLIENT_SUBMITTED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#88888e]">
                        {c.taskId ? c.taskId.title : 'PROJECT_WIDE'}
                      </td>
                      <td className="px-4 py-3 text-[#88888e]">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevealCred(c._id)}
                          className="px-2.5 py-1 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs text-[10px] uppercase font-mono tracking-wider font-semibold inline-flex items-center gap-1 transition-all"
                        >
                          <Lock className="w-3 h-3" />
                          <span>REVEAL</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Hosting */}
      {activeTab === 'hosting' && (
        <div className="space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">PROJECT HOSTING ACCOUNTS ({hostings.length})</h3>
              <p className="text-[11px] text-[#88888e] mt-0.5">
                Hosting services dedicated to this client engagement.
              </p>
            </div>
            <Link
              href="/dashboard/hosting"
              className="px-3.5 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD / MANAGE HOSTING</span>
            </Link>
          </div>

          {hostings.length === 0 ? (
            <div className="py-12 text-center bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-[#88888e] text-xs">
              NO HOSTING ACCOUNTS SPECIFICALLY MAPPED TO THIS PROJECT YET.
            </div>
          ) : (
            <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#242428] bg-[#0a0a0a] text-[#88888e] text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3">Provider & Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Days Remaining</th>
                    <th className="px-4 py-3">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242428] text-[#88888e]">
                  {hostings.map((h) => (
                    <tr key={h._id} className="hover:bg-[#18181b]/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{h.domain}</td>
                      <td className="px-4 py-3 text-white">
                        {h.hostingProvider} • {h.hostingType}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#ff3e00]">{h.status}</td>
                      <td className="px-4 py-3 font-medium text-white">{h.daysRemaining} days</td>
                      <td className="px-4 py-3 text-[#88888e]">{new Date(h.expiryDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Agreement */}
      {activeTab === 'agreement' && (
        <div className="space-y-5 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">CONTRACTUAL PROJECT AGREEMENT</h3>
              <p className="text-[11px] text-[#88888e] mt-0.5">
                Client reviews terms on Telegram and accepts or requests revisions.
              </p>
            </div>

            <button
              onClick={() => setShowSendAgreementModal(true)}
              className="px-4 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{agreement ? 'RESEND / REVISE AGREEMENT' : 'DISPATCH AGREEMENT TO CLIENT'}</span>
            </button>
          </div>

          {agreement ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-6 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs md:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Agreement Terms (Version {agreement.version})
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-none md:rounded-xs text-[10px] font-bold uppercase tracking-wider ${
                      agreement.status === 'ACCEPTED'
                        ? 'bg-[#00D664]/10 border border-[#00D664]/20 text-[#00D664]'
                        : agreement.status === 'REJECTED'
                        ? 'bg-red-950/20 border border-red-500/20 text-red-400'
                        : 'bg-amber-950/30 border border-amber-900/40 text-amber-400'
                    }`}
                  >
                    {agreement.status}
                  </span>
                </div>

                <div className="p-4 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs text-white font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {agreement.terms}
                </div>

                {agreement.snapshot && (
                  <div className="pt-2 text-[10px] text-[#88888e]">
                    Snapshot locked at: {new Date(agreement.snapshot.createdAt).toLocaleString('en-IN')}
                  </div>
                )}
              </div>

              <div className="p-6 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs space-y-4 text-xs font-mono">
                <h4 className="font-bold text-white uppercase tracking-wider text-xs">EXECUTION STATUS</h4>

                <div className="space-y-3">
                  <div className="py-2 border-b border-[#242428]">
                    <div className="text-[#88888e] text-[10px] uppercase">Telegram Status</div>
                    <div className="font-semibold text-white mt-0.5">
                      {client?.telegramConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                    </div>
                  </div>

                  {agreement.acceptedAt && (
                    <div className="py-2 border-b border-[#242428]">
                      <div className="text-[#88888e] text-[10px] uppercase">Accepted Date</div>
                      <div className="font-bold text-[#00D664] mt-0.5">
                        {new Date(agreement.acceptedAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}

                  {agreement.acceptedBy && (
                    <div className="py-2 border-b border-[#242428]">
                      <div className="text-[#88888e] text-[10px] uppercase">Accepted By</div>
                      <div className="font-semibold text-white mt-0.5">
                        {agreement.acceptedBy.name || client?.name}
                      </div>
                      <div className="text-[10px] text-[#88888e]">
                        TG ID: {agreement.acceptedBy.telegramUserId}
                      </div>
                    </div>
                  )}

                  {agreement.rejectedAt && (
                    <div className="py-2 border-b border-[#242428]">
                      <div className="text-[#88888e] text-[10px] uppercase">Declined Date</div>
                      <div className="font-bold text-red-400 mt-0.5">
                        {new Date(agreement.rejectedAt).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-red-400 mt-1">{agreement.rejectionReason}</div>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-[10px] text-[#88888e]">
                  ℹ️ Agreement acceptance automatically transitions project to <b>ACTIVE</b> status.
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-3 font-mono">
              <FileSignature className="w-10 h-10 text-[#55555a] mx-auto" />
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider">NO AGREEMENT GENERATED YET</h4>
              <p className="text-xs text-[#88888e] max-w-md mx-auto">
                Send formal project terms to the client. The client will review and accept via interactive buttons on Telegram.
              </p>
              <button
                onClick={() => setShowSendAgreementModal(true)}
                className="px-4 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                CREATE & DISPATCH AGREEMENT
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Activity */}
      {activeTab === 'activity' && (
        <div className="space-y-4 font-mono">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">PROJECT AUDIT HISTORY ({auditLogs.length})</h3>
          {auditLogs.length === 0 ? (
            <div className="py-12 text-center bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-[#88888e] text-xs">
              NO AUDIT LOGS RECORDED FOR THIS PROJECT YET.
            </div>
          ) : (
            <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs overflow-hidden divide-y divide-[#242428]">
              {auditLogs.map((log) => (
                <div key={log._id} className="p-4 flex items-center justify-between text-xs hover:bg-[#18181b]/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#ff3e00] rounded-full"></span>
                      <span className="font-semibold text-white">{log.action}</span>
                      <span className="text-[10px] text-[#88888e]">BY {log.actor}</span>
                    </div>
                    {log.metadata && (
                      <div className="text-[11px] text-[#88888e] pl-3.5">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-[#88888e] shrink-0">
                    {new Date(log.timestamp).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::PROJECT_UPDATE // {project.name}</span>
              </div>
              <button
                onClick={() => setShowEditProjectModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditProject} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Service Category</label>
                  <select
                    value={editFormData.serviceType}
                    onChange={(e) => setEditFormData({ ...editFormData, serviceType: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="WEBSITE">Website Development</option>
                    <option value="WEB_APPLICATION">Web Application</option>
                    <option value="MOBILE_APPLICATION">Mobile Application</option>
                    <option value="API_DEVELOPMENT">API Development</option>
                    <option value="WORDPRESS">WordPress</option>
                    <option value="ECOMMERCE">E-Commerce</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Total Amount *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={editFormData.totalAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, totalAmount: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Currency</label>
                  <select
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="PENDING_AGREEMENT">Pending Agreement</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ONBOARDING">Onboarding</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">Review</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Start Date</label>
                  <input
                    type="date"
                    value={editFormData.startDate}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Expected Due Date</label>
                  <input
                    type="date"
                    value={editFormData.expectedCompletionDate}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, expectedCompletionDate: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Scope of Work</label>
                <textarea
                  rows={3}
                  placeholder="Define deliverables, milestones, tech stack..."
                  value={editFormData.scope}
                  onChange={(e) => setEditFormData({ ...editFormData, scope: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Contract Terms / Conditions</label>
                <textarea
                  rows={3}
                  placeholder="Terms of payment, revision limits, warranty..."
                  value={editFormData.terms}
                  onChange={(e) => setEditFormData({ ...editFormData, terms: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Internal Notes</label>
                <input
                  type="text"
                  placeholder="Notes for internal team..."
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
                  className="px-4 py-2 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs font-mono text-xs uppercase tracking-wider font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs font-mono text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Project Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Credential Modal */}
      {showManualCredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::VAULT // ADD_ENCRYPTED_CREDENTIAL</span>
              </div>
              <button
                onClick={() => setShowManualCredModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualCred} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Credential Type</label>
                  <select
                    value={credFormData.credentialType}
                    onChange={(e) => setCredFormData({ ...credFormData, credentialType: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="WORDPRESS">WordPress</option>
                    <option value="HOSTING">Hosting / cPanel</option>
                    <option value="SSH">SSH / SFTP</option>
                    <option value="DATABASE">Database</option>
                    <option value="CLOUDFLARE">Cloudflare</option>
                    <option value="GITHUB">GitHub</option>
                    <option value="EMAIL">Email / SMTP</option>
                    <option value="API">API Key / Token</option>
                    <option value="CUSTOM">Custom Access</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Task Association (Optional)</label>
                  <select
                    value={credFormData.taskId}
                    onChange={(e) => setCredFormData({ ...credFormData, taskId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="">Project-wide (General)</option>
                    {tasks.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.title} ({t.taskCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Service Label / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Staging WordPress or AWS Production"
                  value={credFormData.service}
                  onChange={(e) => setCredFormData({ ...credFormData, service: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Login URL / Host</label>
                <input
                  type="text"
                  placeholder="https://site.com/wp-admin or 192.168.1.1:22"
                  value={credFormData.loginUrl}
                  onChange={(e) => setCredFormData({ ...credFormData, loginUrl: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Username / Account *</label>
                  <input
                    type="text"
                    required
                    placeholder="admin or root"
                    value={credFormData.username}
                    onChange={(e) => setCredFormData({ ...credFormData, username: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Password / Secret Key *</label>
                  <input
                    type="password"
                    required
                    placeholder="Secret value"
                    value={credFormData.password}
                    onChange={(e) => setCredFormData({ ...credFormData, password: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Additional Secret / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Port numbers, recovery keys, SSH passphrase..."
                  value={credFormData.additionalInfo}
                  onChange={(e) => setCredFormData({ ...credFormData, additionalInfo: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="p-3 bg-[#18181b] border border-[#242428] rounded-none md:rounded-xs text-[11px] font-mono text-[#88888e] flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#00D664] shrink-0" />
                <span>All secret values are encrypted with AES-256-GCM before database storage. Plaintext is never logged.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowManualCredModal(false)}
                  className="px-4 py-2 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs font-mono text-xs uppercase tracking-wider font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs font-mono text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Encrypted Credential</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Agreement Modal */}
      {showSendAgreementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::CONTRACT // DISPATCH_AGREEMENT</span>
              </div>
              <button
                onClick={() => setShowSendAgreementModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendAgreement} className="space-y-4">
              <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs font-mono text-xs space-y-1.5">
                <div>Client: <b className="text-white">{client?.name}</b></div>
                <div>Budget: <b className="text-white">{currencySymbol} {total.toLocaleString('en-IN')}</b></div>
                <div>Telegram: <b className={client?.telegramConnected ? 'text-[#00D664]' : 'text-[#f59e0b]'}>
                  {client?.telegramConnected ? 'Connected (Interactive buttons enabled)' : 'Not Connected'}
                </b></div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Agreement Terms & Scope *</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Specify contractual terms, delivery schedule, revisions..."
                  value={agreementTerms}
                  onChange={(e) => setAgreementTerms(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="p-3 bg-[#18181b] border border-[#242428] rounded-none md:rounded-xs text-[11px] font-mono text-[#88888e]">
                ℹ️ When sent, the project status moves to <b className="text-white">PENDING_AGREEMENT</b>. Once accepted by the client via Telegram, it automatically becomes <b className="text-[#00D664]">ACTIVE</b>.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowSendAgreementModal(false)}
                  className="px-4 py-2 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs font-mono text-xs uppercase tracking-wider font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs font-mono text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Dispatch Agreement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reveal Credential Modal */}
      {showRevealCredModal && revealedCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 text-[#00D664] font-mono text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>VAULT::DECRYPTED_SECRET // AES-256-GCM</span>
              </div>
              <button
                onClick={() => setShowRevealCredModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                <span className="text-[10px] text-[#88888e] font-mono uppercase tracking-wider">Service</span>
                <div className="font-mono text-white mt-1">{revealedCred.service}</div>
              </div>

              {revealedCred.loginUrl && (
                <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                  <span className="text-[10px] text-[#88888e] font-mono uppercase tracking-wider">Login URL</span>
                  <div className="font-mono text-[#88888e] mt-1 select-all break-all">{revealedCred.loginUrl}</div>
                </div>
              )}

              <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                <span className="text-[10px] text-[#88888e] font-mono uppercase tracking-wider">Username</span>
                <div className="font-mono text-white mt-1 select-all font-semibold">{revealedCred.username}</div>
              </div>

              <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                <span className="text-[10px] text-[#88888e] font-mono uppercase tracking-wider">Password</span>
                <div className="font-mono text-[#00D664] mt-1 select-all font-bold tracking-wider">{revealedCred.password}</div>
              </div>

              {revealedCred.additionalInfo && (
                <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                  <span className="text-[10px] text-[#88888e] font-mono uppercase tracking-wider">Notes</span>
                  <div className="font-mono text-[#88888e] mt-1 whitespace-pre-wrap">{revealedCred.additionalInfo}</div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowRevealCredModal(false)}
                className="w-full py-2.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-white font-mono text-xs uppercase tracking-wider rounded-none md:rounded-xs transition-colors"
              >
                Close & Mask
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
