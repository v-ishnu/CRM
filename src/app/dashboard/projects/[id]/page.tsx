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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-xs text-slate-500">Loading project details...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-200">Project Not Found</h2>
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/projects"
            className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all"
            title="Back to Projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
              <span className="text-xs bg-indigo-950/50 border border-indigo-500/30 text-indigo-400 font-mono px-2 py-0.5 rounded">
                {project.projectCode}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                {project.status}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>Client:</span>
              <Link
                href={`/dashboard/clients/${client?._id}`}
                className="font-medium text-indigo-400 hover:underline"
              >
                {client?.name} ({client?.clientCode})
              </Link>
              <span>•</span>
              <span>Service: <b className="text-slate-400">{project.serviceType}</b></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditProjectModal(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Project</span>
          </button>

          <button
            onClick={() => setShowSendAgreementModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>{agreement ? 'Update Agreement' : 'Send Agreement'}</span>
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[#0d0d12]/70 border border-slate-850 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Total Project Value</div>
          <div className="text-xl font-bold text-slate-100 mt-1">
            {currencySymbol} {total.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-4 bg-[#0d0d12]/70 border border-slate-850 rounded-xl">
          <div className="text-xs text-emerald-500 font-medium">Total Paid</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {currencySymbol} {paid.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-4 bg-[#0d0d12]/70 border border-slate-850 rounded-xl">
          <div className="text-xs text-red-500 font-medium">Outstanding Balance</div>
          <div className="text-xl font-bold text-red-400 mt-1">
            {currencySymbol} {outstanding.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-850 pb-px overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-[#0d0d12] border-t border-x border-slate-850 text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'tasks'
              ? 'bg-[#0d0d12] border-t border-x border-slate-850 text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Tasks ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'bg-[#0d0d12] border-t border-x border-slate-850 text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payments ({payments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'invoices'
              ? 'bg-[#0d0d12] border-t border-x border-slate-850 text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Invoices ({invoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('credentials')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'credentials'
              ? 'bg-[#0d0d12] border-t border-x border-slate-850 text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Credentials ({credentials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('hosting')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'hosting'
              ? 'bg-[#0d0d12] border-t border-x border-slate-850 text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Hosting ({hostings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('agreement')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'agreement'
              ? 'bg-[#0d0d12] border-t border-x border-slate-850 text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSignature className="w-3.5 h-3.5" />
          <span>Agreement {agreement ? `(${agreement.status})` : ''}</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'activity'
              ? 'bg-[#0d0d12] border-t border-x border-slate-850 text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Activity</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 bg-[#0d0d12]/60 border border-slate-850 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-200">Project Details</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-850/60">
                <span className="text-slate-500">Service Category</span>
                <span className="font-semibold text-slate-300">{project.serviceType}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-850/60">
                <span className="text-slate-500">Current Phase / Status</span>
                <span className="font-semibold text-indigo-400 uppercase">{project.status}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-850/60">
                <span className="text-slate-500">Start Date</span>
                <span className="font-semibold text-slate-300">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-850/60">
                <span className="text-slate-500">Target Completion</span>
                <span className="font-semibold text-slate-300">
                  {project.expectedCompletionDate
                    ? new Date(project.expectedCompletionDate).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              {project.completionDate && (
                <div className="flex justify-between py-1.5 border-b border-slate-850/60">
                  <span className="text-slate-500">Completed On</span>
                  <span className="font-semibold text-emerald-400">
                    {new Date(project.completionDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {project.description && (
              <div className="space-y-1 pt-2">
                <span className="text-xs font-semibold text-slate-400">Description</span>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-850">
                  {project.description}
                </p>
              </div>
            )}
          </div>

          <div className="p-5 bg-[#0d0d12]/60 border border-slate-850 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-200">Scope of Work & Agreement Summary</h3>
            {project.scope ? (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400">Project Scope</span>
                <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-850 whitespace-pre-wrap">
                  {project.scope}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-xl text-xs text-slate-500 italic">
                No specific scope notes entered yet. Click &quot;Edit Project&quot; to add.
              </div>
            )}

            {project.terms && (
              <div className="space-y-1 pt-2">
                <span className="text-xs font-semibold text-slate-400">Contract Terms</span>
                <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-850 whitespace-pre-wrap">
                  {project.terms}
                </div>
              </div>
            )}

            {project.notes && (
              <div className="space-y-1 pt-2">
                <span className="text-xs font-semibold text-slate-400">Internal Admin Notes</span>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-850">
                  {project.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">Project Tasks</h3>
            <Link
              href="/dashboard/tasks"
              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Manage All Tasks
            </Link>
          </div>

          {tasks.length === 0 ? (
            <div className="py-12 text-center bg-[#0d0d12]/40 border border-slate-850 rounded-xl text-slate-500 text-xs">
              No tasks created for this project yet.
            </div>
          ) : (
            <div className="bg-[#0d0d12]/50 border border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 uppercase font-semibold">
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Assigned Member</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Deliverables</th>
                    <th className="px-4 py-3">Credentials</th>
                    <th className="px-4 py-3 text-right">Compensation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {tasks.map((t) => (
                    <tr key={t._id} className="hover:bg-slate-900/20">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{t.title}</div>
                        <div className="text-[11px] text-slate-500">{t.taskCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        {t.assignedTo ? (
                          <span className="font-medium text-slate-300">{t.assignedTo.name}</span>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-indigo-400">{t.status}</td>
                      <td className="px-4 py-3">
                        {t.submission ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Submitted ({t.submission.submissionFiles?.length || 0} files, {t.submission.submissionUrls?.length || 0} URLs)</span>
                          </span>
                        ) : t.submissionRequired ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3" />
                            <span>Required ({t.submissionTypes?.join(', ') || 'URL/File'})</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">Optional</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {t.requiredCredentialIds?.length || 0} Required
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-200">
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">Payment Transactions</h3>
            <Link
              href="/dashboard/payments"
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
            >
              Record Payment in Billing
            </Link>
          </div>

          {payments.length === 0 ? (
            <div className="py-12 text-center bg-[#0d0d12]/40 border border-slate-850 rounded-xl text-slate-500 text-xs">
              No payments recorded for this project yet.
            </div>
          ) : (
            <div className="bg-[#0d0d12]/50 border border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 uppercase font-semibold">
                    <th className="px-4 py-3">Receipt / Ref</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {payments.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-900/20">
                      <td className="px-4 py-3 font-semibold text-slate-200">{p.paymentNumber}</td>
                      <td className="px-4 py-3 text-slate-400">{new Date(p.paymentDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-slate-300">{p.paymentMethod}</td>
                      <td className="px-4 py-3 text-slate-400">{p.paymentType || 'INSTALLMENT'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/40 border border-emerald-500/20 text-emerald-400">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">Project Invoices</h3>
            <Link
              href="/dashboard/invoices"
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
            >
              Generate New Invoice
            </Link>
          </div>

          {invoices.length === 0 ? (
            <div className="py-12 text-center bg-[#0d0d12]/40 border border-slate-850 rounded-xl text-slate-500 text-xs">
              No invoices generated for this project yet.
            </div>
          ) : (
            <div className="bg-[#0d0d12]/50 border border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 uppercase font-semibold">
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Issue Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Telegram Delivered</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-900/20">
                      <td className="px-4 py-3 font-semibold text-slate-200">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-400">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-400">{inv.status}</td>
                      <td className="px-4 py-3">
                        {inv.telegramSent ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                          </span>
                        ) : (
                          <span className="text-slate-500">Not Sent</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-200">
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
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200">Project Credentials</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Encrypted at rest with AES-256-GCM. Never logged or transmitted unencrypted.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowManualCredModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Credential Manually</span>
              </button>
            </div>
          </div>

          {credentials.length === 0 ? (
            <div className="py-12 text-center bg-[#0d0d12]/40 border border-slate-850 rounded-xl space-y-3">
              <Lock className="w-8 h-8 text-slate-650 mx-auto" />
              <p className="text-xs text-slate-500">No credentials stored for this project yet.</p>
              <button
                onClick={() => setShowManualCredModal(true)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Credential Manually
              </button>
            </div>
          ) : (
            <div className="bg-[#0d0d12]/50 border border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 uppercase font-semibold">
                    <th className="px-4 py-3">Service & Type</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Associated Task</th>
                    <th className="px-4 py-3">Added</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {credentials.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-900/20">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{c.service}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.credentialType}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">{c.username || '***'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                          {c.source === 'MANUAL' ? 'Manual' : 'Client Submitted'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {c.taskId ? c.taskId.title : 'Project-wide'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevealCred(c._id)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-indigo-600/10 hover:text-indigo-400 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-all"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Reveal</span>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200">Project Hosting Accounts</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hosting services dedicated to this client engagement.
              </p>
            </div>
            <Link
              href="/dashboard/hosting"
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add / Manage Hosting</span>
            </Link>
          </div>

          {hostings.length === 0 ? (
            <div className="py-12 text-center bg-[#0d0d12]/40 border border-slate-850 rounded-xl text-slate-500 text-xs">
              No hosting accounts specifically mapped to this project yet.
            </div>
          ) : (
            <div className="bg-[#0d0d12]/50 border border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 uppercase font-semibold">
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3">Provider & Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Days Remaining</th>
                    <th className="px-4 py-3">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {hostings.map((h) => (
                    <tr key={h._id} className="hover:bg-slate-900/20">
                      <td className="px-4 py-3 font-semibold text-slate-200">{h.domain}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {h.hostingProvider} • {h.hostingType}
                      </td>
                      <td className="px-4 py-3 font-semibold text-indigo-400">{h.status}</td>
                      <td className="px-4 py-3 font-medium text-slate-200">{h.daysRemaining} days</td>
                      <td className="px-4 py-3 text-slate-400">{new Date(h.expiryDate).toLocaleDateString()}</td>
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
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200">Contractual Project Agreement</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Client reviews terms on Telegram and accepts or requests revisions.
              </p>
            </div>

            <button
              onClick={() => setShowSendAgreementModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{agreement ? 'Resend / Revise Agreement' : 'Send Agreement to Client'}</span>
            </button>
          </div>

          {agreement ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 bg-[#0d0d12]/70 border border-slate-850 rounded-2xl md:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-850">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Agreement Terms (Version {agreement.version})
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      agreement.status === 'ACCEPTED'
                        ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-400'
                        : agreement.status === 'REJECTED'
                        ? 'bg-red-950/60 border border-red-500/30 text-red-400'
                        : 'bg-amber-950/60 border border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {agreement.status}
                  </span>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {agreement.terms}
                </div>

                {agreement.snapshot && (
                  <div className="pt-2 text-[11px] text-slate-500">
                    Snapshot locked at: {new Date(agreement.snapshot.createdAt).toLocaleString('en-IN')}
                  </div>
                )}
              </div>

              <div className="p-5 bg-[#0d0d12]/70 border border-slate-850 rounded-2xl space-y-4 text-xs">
                <h4 className="font-bold text-slate-200">Execution Status</h4>

                <div className="space-y-3">
                  <div className="py-2 border-b border-slate-850/60">
                    <div className="text-slate-500">Telegram Status</div>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {client?.telegramConnected ? 'Connected' : 'Not Connected'}
                    </div>
                  </div>

                  {agreement.acceptedAt && (
                    <div className="py-2 border-b border-slate-850/60">
                      <div className="text-slate-500">Accepted Date</div>
                      <div className="font-bold text-emerald-400 mt-0.5">
                        {new Date(agreement.acceptedAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}

                  {agreement.acceptedBy && (
                    <div className="py-2 border-b border-slate-850/60">
                      <div className="text-slate-500">Accepted By</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {agreement.acceptedBy.name || client?.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        TG ID: {agreement.acceptedBy.telegramUserId}
                      </div>
                    </div>
                  )}

                  {agreement.rejectedAt && (
                    <div className="py-2 border-b border-slate-850/60">
                      <div className="text-slate-500">Declined Date</div>
                      <div className="font-bold text-red-400 mt-0.5">
                        {new Date(agreement.rejectedAt).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-red-300 mt-1">{agreement.rejectionReason}</div>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300">
                  ℹ️ Agreement acceptance transitions project to <b>ACTIVE</b> automatically. Payments remain separate.
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center bg-[#0d0d12]/40 border border-slate-850 rounded-2xl space-y-3">
              <FileSignature className="w-10 h-10 text-slate-650 mx-auto" />
              <h4 className="font-semibold text-slate-300 text-sm">No agreement generated yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Send formal project terms to the client. The client will be able to review and accept via interactive buttons on Telegram.
              </p>
              <button
                onClick={() => setShowSendAgreementModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create & Send Agreement
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Activity */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-200">Project Audit History</h3>
          {auditLogs.length === 0 ? (
            <div className="py-12 text-center bg-[#0d0d12]/40 border border-slate-850 rounded-xl text-slate-500 text-xs">
              No audit logs recorded for this project yet.
            </div>
          ) : (
            <div className="bg-[#0d0d12]/50 border border-slate-850 rounded-xl overflow-hidden divide-y divide-slate-850/60">
              {auditLogs.map((log) => (
                <div key={log._id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-900/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 font-mono">{log.action}</span>
                      <span className="text-[10px] text-slate-500 font-mono">by {log.actor}</span>
                    </div>
                    {log.metadata && (
                      <div className="text-[11px] text-slate-400 font-mono">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 shrink-0">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <span>Edit Project Details</span>
              </div>
              <button onClick={() => setShowEditProjectModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditProject} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Service Category</label>
                  <select
                    value={editFormData.serviceType}
                    onChange={(e) => setEditFormData({ ...editFormData, serviceType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
                  <label className="text-[11px] font-semibold text-slate-300">Total Amount *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={editFormData.totalAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, totalAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Currency</label>
                  <select
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
                  <label className="text-[11px] font-semibold text-slate-300">Start Date</label>
                  <input
                    type="date"
                    value={editFormData.startDate}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Expected Due Date</label>
                  <input
                    type="date"
                    value={editFormData.expectedCompletionDate}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, expectedCompletionDate: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Scope of Work</label>
                <textarea
                  rows={3}
                  placeholder="Define deliverables, milestones, tech stack..."
                  value={editFormData.scope}
                  onChange={(e) => setEditFormData({ ...editFormData, scope: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Contract Terms / Conditions</label>
                <textarea
                  rows={3}
                  placeholder="Terms of payment, revision limits, warranty..."
                  value={editFormData.terms}
                  onChange={(e) => setEditFormData({ ...editFormData, terms: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Internal Notes</label>
                <input
                  type="text"
                  placeholder="Notes for internal team..."
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
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
                  <span>Save Project Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Credential Modal */}
      {showManualCredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Add Credential Manually</span>
              </div>
              <button onClick={() => setShowManualCredModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualCred} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Credential Type</label>
                  <select
                    value={credFormData.credentialType}
                    onChange={(e) => setCredFormData({ ...credFormData, credentialType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
                  <label className="text-[11px] font-semibold text-slate-300">Task Association (Optional)</label>
                  <select
                    value={credFormData.taskId}
                    onChange={(e) => setCredFormData({ ...credFormData, taskId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
                <label className="text-[11px] font-semibold text-slate-300">Service Label / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Staging WordPress or AWS Production"
                  value={credFormData.service}
                  onChange={(e) => setCredFormData({ ...credFormData, service: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Login URL / Host</label>
                <input
                  type="text"
                  placeholder="https://site.com/wp-admin or 192.168.1.1:22"
                  value={credFormData.loginUrl}
                  onChange={(e) => setCredFormData({ ...credFormData, loginUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Username / Account *</label>
                  <input
                    type="text"
                    required
                    placeholder="admin or root"
                    value={credFormData.username}
                    onChange={(e) => setCredFormData({ ...credFormData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Password / Secret Key *</label>
                  <input
                    type="password"
                    required
                    placeholder="Secret value"
                    value={credFormData.password}
                    onChange={(e) => setCredFormData({ ...credFormData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Additional Secret / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Port numbers, recovery keys, SSH passphrase..."
                  value={credFormData.additionalInfo}
                  onChange={(e) => setCredFormData({ ...credFormData, additionalInfo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300">
                🔒 All secret values are encrypted with AES-256-GCM before database storage. Plaintext is never logged or exposed in audit trails.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowManualCredModal(false)}
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
                  <span>Save Encrypted Credential</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Agreement Modal */}
      {showSendAgreementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                <FileSignature className="w-4 h-4 text-indigo-400" />
                <span>Dispatch Project Agreement</span>
              </div>
              <button onClick={() => setShowSendAgreementModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendAgreement} className="space-y-4">
              <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-xs space-y-1">
                <div>Client: <b className="text-slate-200">{client?.name}</b></div>
                <div>Budget: <b className="text-slate-200">{currencySymbol} {total.toLocaleString('en-IN')}</b></div>
                <div>Telegram: <b className={client?.telegramConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {client?.telegramConnected ? 'Connected (Interactive buttons enabled)' : 'Not Connected'}
                </b></div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Agreement Terms & Scope *</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Specify contractual terms, delivery schedule, revisions..."
                  value={agreementTerms}
                  onChange={(e) => setAgreementTerms(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300">
                ℹ️ When sent, the project status moves to <b>PENDING_AGREEMENT</b>. Once accepted by the client via Telegram, it automatically becomes <b>ACTIVE</b>.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSendAgreementModal(false)}
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
                  <span>Dispatch Agreement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reveal Credential Modal */}
      {showRevealCredModal && revealedCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Decrypted Credential</span>
              </div>
              <button onClick={() => setShowRevealCredModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Service</span>
                <div className="font-semibold text-slate-200 mt-0.5">{revealedCred.service}</div>
              </div>

              {revealedCred.loginUrl && (
                <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Login URL</span>
                  <div className="font-mono text-slate-300 mt-0.5 select-all">{revealedCred.loginUrl}</div>
                </div>
              )}

              <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Username</span>
                <div className="font-mono text-slate-200 mt-0.5 select-all font-semibold">{revealedCred.username}</div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Password</span>
                <div className="font-mono text-amber-300 mt-0.5 select-all font-bold">{revealedCred.password}</div>
              </div>

              {revealedCred.additionalInfo && (
                <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Notes</span>
                  <div className="font-mono text-slate-300 mt-0.5 whitespace-pre-wrap">{revealedCred.additionalInfo}</div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowRevealCredModal(false)}
                className="w-full py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-200 font-semibold text-xs rounded-xl"
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
