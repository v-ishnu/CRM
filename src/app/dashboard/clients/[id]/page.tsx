'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  MapPin,
  Send,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard,
  History,
  Copy,
  Check,
  Plus,
  Trash2,
  Download,
  Loader2,
  Calendar,
  Laptop,
  ArrowRight,
  Lock,
  X,
} from 'lucide-react';

interface Project {
  _id: string;
  projectCode: string;
  name: string;
  serviceType: string;
  totalAmount: number;
  currency: string;
  status: string;
  startDate?: string;
  expectedCompletionDate?: string;
  paidAmount?: number;
  outstandingAmount?: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  status: string;
  invoiceDate: string;
  telegramSent: boolean;
}

interface Payment {
  _id: string;
  paymentNumber: string;
  projectId: string;
  amount: number;
  paymentMethod: string;
  paymentType?: string;
  paymentDate: string;
  transactionReference?: string;
  status: string;
}

interface AuditLog {
  _id: string;
  actor: string;
  action: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ClientDetails {
  client: {
    _id: string;
    clientCode: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    telegramConnected: boolean;
    telegramUsername?: string;
    telegramUserId?: string;
    telegramChatId?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    notes?: string;
    onboardingDate: string;
    status: string;
  };
  projects: Project[];
  invoices: Invoice[];
  payments: Payment[];
  auditLogs: AuditLog[];
  financials: {
    totalProjectValue: number;
    totalPaid: number;
    outstanding: number;
  };
}

interface ClientDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = React.use(params);
  const [data, setData] = useState<ClientDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processingInvs, setProcessingInvs] = useState<Record<string, boolean>>({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmClientCode, setConfirmClientCode] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Record Payment States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentType, setPaymentType] = useState('INSTALLMENT');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceId, setReferenceId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Add Project States
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectServiceType, setNewProjectServiceType] = useState('WEBSITE');
  const [newProjectBudget, setNewProjectBudget] = useState('');
  const [newProjectCurrency, setNewProjectCurrency] = useState('INR');
  const [newProjectStartDate, setNewProjectStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newProjectEndDate, setNewProjectEndDate] = useState('');
  const [newProjectNotes, setNewProjectNotes] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Delete Project States
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleteProjectModalOpen, setDeleteProjectModalOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // Requests States
  const [requests, setRequests] = useState<any[]>([]);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestType, setRequestType] = useState('GENERAL');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [credentialType, setCredentialType] = useState('HOSTING');
  const [requiredFields, setRequiredFields] = useState<string[]>(['Service', 'Username', 'Password', 'Login URL']);
  const [expiresInHours, setExpiresInHours] = useState<number>(0);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [selectedProjectIdForReq, setSelectedProjectIdForReq] = useState('');

  // View request details states
  const [viewRequestModalOpen, setViewRequestModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState<any | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [copiedFields, setCopiedFields] = useState<Record<string, boolean>>({});

  // Share Credential to Team Member States
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTeamMembers, setShareTeamMembers] = useState<any[]>([]);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState('');
  const [shareOneTime, setShareOneTime] = useState(true);
  const [sharingCredential, setSharingCredential] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const fetchClientDetails = async () => {
    try {
      const res = await fetch(`/api/clients/${id}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.projects && json.data.projects.length > 0) {
          setSelectedProjectId(json.data.projects[0]._id);
          setSelectedProjectIdForReq(json.data.projects[0]._id);
        }
        if (json.data.requests) {
          setRequests(json.data.requests);
        }
      } else {
        setData(null);
      }
    } catch (err) {
      console.error('Failed to load client details:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleGenerateTelegramLink = async () => {
    setGeneratingLink(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/clients/${id}/connect`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setTelegramLink(json.data.link);
      } else {
        setActionError(json.error?.message || 'Failed to generate linking token');
      }
    } catch (err) {
      setActionError('An error occurred during link generation.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (telegramLink) {
      navigator.clipboard.writeText(telegramLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeleteClient = async () => {
    if (confirmClientCode !== data?.client.clientCode) return;
    setDeleting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess('Client deleted successfully. Redirecting to clients list...');
        setDeleteModalOpen(false);
        setTimeout(() => {
          window.location.href = '/dashboard/clients';
        }, 1500);
      } else {
        setActionError(json.error?.message || 'Failed to delete client.');
        setDeleteModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to delete client:', err);
      setActionError('An error occurred while deleting the client.');
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
      setConfirmClientCode('');
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setActionError('Project name is required.');
      return;
    }
    const budgetNum = Number(newProjectBudget);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      setActionError('Total budget must be a positive number.');
      return;
    }

    setCreatingProject(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: id,
          name: newProjectName.trim(),
          serviceType: newProjectServiceType,
          totalAmount: budgetNum,
          currency: newProjectCurrency,
          startDate: newProjectStartDate ? new Date(newProjectStartDate).toISOString() : undefined,
          expectedCompletionDate: newProjectEndDate ? new Date(newProjectEndDate).toISOString() : undefined,
          description: newProjectNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess(`Project "${newProjectName}" created successfully!`);
        setAddProjectModalOpen(false);
        setNewProjectName('');
        setNewProjectBudget('');
        setNewProjectNotes('');
        await fetchClientDetails();
      } else {
        setActionError(json.error?.message || 'Failed to create project.');
      }
    } catch (err) {
      setActionError('An error occurred while creating the project.');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeletingProject(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectToDelete._id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess(`Project "${projectToDelete.name}" deleted successfully.`);
        setDeleteProjectModalOpen(false);
        setProjectToDelete(null);
        await fetchClientDetails();
      } else {
        setActionError(json.error?.message || 'Failed to delete project.');
      }
    } catch (err) {
      setActionError('An error occurred while deleting the project.');
    } finally {
      setDeletingProject(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingRequest(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: id,
          projectId: selectedProjectIdForReq || undefined,
          type: requestType,
          title: requestTitle,
          message: requestMessage,
          credentialType: requestType === 'CREDENTIAL' ? credentialType : undefined,
          requiredFields: requestType === 'CREDENTIAL' ? requiredFields : undefined,
          expiresInHours: expiresInHours > 0 ? expiresInHours : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess('Request created and sent via Telegram successfully!');
        setRequestModalOpen(false);
        // Reset request fields
        setRequestTitle('');
        setRequestMessage('');
        fetchClientDetails();
      } else {
        setActionError(json.error?.message || 'Failed to send request');
      }
    } catch (err) {
      setActionError('An error occurred while creating request.');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleViewRequest = async (request: any) => {
    setActiveRequest(null);
    setDecryptedData(null);
    setDecryptPassword('');
    setDecryptError(null);
    setViewRequestModalOpen(true);

    try {
      const res = await fetch(`/api/requests/${request._id}`);
      const json = await res.json();
      if (json.success) {
        setActiveRequest(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch request details:', err);
    }
  };

  const handleDecryptCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setDecrypting(true);
    setDecryptError(null);
    try {
      const res = await fetch(`/api/requests/${activeRequest.request._id}/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: decryptPassword }),
      });
      const json = await res.json();
      if (json.success) {
        setDecryptedData(json.data);
        setDecryptPassword('');
      } else {
        setDecryptError(json.error?.message || 'Incorrect password confirmation');
      }
    } catch (err) {
      setDecryptError('An error occurred during decryption.');
    } finally {
      setDecrypting(false);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to permanently delete this request and its response?')) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/requests/${requestId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setActionSuccess('Request deleted successfully.');
        fetchClientDetails();
      } else {
        setActionError(json.error?.message || 'Failed to delete request');
      }
    } catch (err) {
      setActionError('An error occurred during request deletion.');
    }
  };

  const logRequestAudit = async (requestId: string, action: 'CREDENTIAL_REVEALED' | 'CREDENTIAL_COPIED') => {
    try {
      await fetch(`/api/requests/${requestId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch (err) {
      console.error('Failed to log credential audit event:', err);
    }
  };

  const getTelegramPreview = () => {
    let icon = '📋';
    let typeName = 'Data Request';
    let formatBlock = '';

    if (requestType === 'CREDENTIAL') {
      icon = '🔐';
      typeName = 'Credential Request';
      const fields = requiredFields.length > 0 ? requiredFields : ['Service', 'Username', 'Password', 'Login URL'];
      formatBlock = `\n\n<b>Please reply using this exact format:</b>\n\n<code>\n${fields.map(f => `${f}:`).join('\n')}\n</code>`;
    } else if (requestType === 'IMAGE') {
      icon = '🖼️';
      typeName = 'Image Request';
    } else if (requestType === 'DOCUMENT') {
      icon = '📁';
      typeName = 'Document Request';
    } else if (requestType === 'TEXT') {
      icon = '✍️';
      typeName = 'Text Request';
    }

    return `${icon} ${typeName}\n\n` +
      `Hello ${data?.client.name || 'Client'},\n\n` +
      `Your project administrator has requested information:\n\n` +
      `<b>${requestTitle || '[Request Title]'}</b>\n\n` +
      `Instructions: ${requestMessage || '[Instructions message]'}` +
      `${formatBlock}\n\n` +
      `Request ID: REQ-2026-XXXX\n\n` +
      `Please reply directly to this message.`;
  };

  const handleSendInvoiceTelegram = async (invoiceId: string) => {
    setProcessingInvs((prev) => ({ ...prev, [invoiceId]: true }));
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send-telegram`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setActionSuccess(json.message || 'Invoice sent successfully!');
        fetchClientDetails(); // Reload page state
      } else {
        setActionError(json.error?.message || 'Failed to dispatch invoice via Telegram');
      }
    } catch (err) {
      setActionError('Error connecting to Server.');
    } finally {
      setProcessingInvs((prev) => ({ ...prev, [invoiceId]: false }));
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    setActionError(null);
    setActionSuccess(null);

    const selectedProj = data.projects.find((p) => p._id === selectedProjectId);
    if (!selectedProj) {
      setActionError('Please select a valid project.');
      return;
    }

    const projPayments = data.payments.filter(
      (p) => p.projectId === selectedProjectId && p.status === 'COMPLETED'
    );
    const alreadyPaid = projPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalAmount = selectedProj.totalAmount;
    const outstanding = Math.max(0, totalAmount - alreadyPaid);

    const numAmount = Number(paymentAmount);
    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
      setActionError('Payment amount must be a valid positive number.');
      return;
    }

    if (numAmount > outstanding) {
      setActionError(
        `Payment exceeds outstanding balance. Outstanding: Rs. ${outstanding.toLocaleString(
          'en-IN'
        )} Maximum payment allowed: Rs. ${outstanding.toLocaleString('en-IN')}`
      );
      return;
    }

    setRecordingPayment(true);

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: id,
          projectId: selectedProjectId,
          amount: numAmount,
          paymentMethod,
          paymentType,
          paymentDate: new Date(paymentDate).toISOString(),
          transactionReference: referenceId || undefined,
          notes: paymentNotes || undefined,
          notifyClient: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionSuccess(
          `Payment recorded successfully. Amount: Rs. ${numAmount.toLocaleString(
            'en-IN'
          )} Receipt: ${json.data.paymentNumber} New Outstanding: Rs. ${(
            outstanding - numAmount
          ).toLocaleString('en-IN')}`
        );
        // Reset form
        setPaymentAmount('');
        setReferenceId('');
        setPaymentNotes('');
        setPaymentModalOpen(false);
        // Refresh details
        await fetchClientDetails();
      } else {
        setActionError(json.error?.message || 'Payment was not recorded.');
      }
    } catch (err: any) {
      setActionError('An error occurred while saving the payment.');
    } finally {
      setRecordingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-slate-800 rounded-xl"></div>
          <div className="h-6 w-48 bg-slate-800 rounded"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 h-96 bg-slate-800 rounded-2xl"></div>
          <div className="lg:col-span-2 h-96 bg-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 bg-red-950/20 border border-red-500/20 rounded-xl text-center text-red-300">
        Client not found.
      </div>
    );
  }

  const { client, projects, invoices, payments, auditLogs, financials } = data;

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/clients"
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-450 hover:text-slate-205 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">{client.name}</h1>
              <code className="text-xs bg-indigo-650/15 text-indigo-400 border border-indigo-500/10 px-2 py-0.5 rounded uppercase">
                {client.clientCode}
              </code>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">Onboarded: {new Date(client.onboardingDate).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-950/45 border border-red-500/20 text-red-300 rounded-xl text-sm">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 bg-emerald-950/45 border border-emerald-500/20 text-emerald-300 rounded-xl text-sm">
          {actionSuccess}
        </div>
      )}

      {/* Grid Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Client profile & Telegram Panel */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-5 pb-3 border-b border-slate-900">
              Profile Summary
            </h2>
            <div className="space-y-4 text-sm text-slate-400">
              {client.company && (
                <div className="flex items-center space-x-3">
                  <Building className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{client.company}</span>
                </div>
              )}
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    {client.address}, {client.city || ''}, {client.state || ''}, {client.country || ''}
                  </span>
                </div>
              )}
              <div className="pt-2">
                <span className="text-xs text-slate-500">Status Badge</span>
                <div className="mt-1.5 inline-block px-3 py-1 bg-indigo-950/40 border border-indigo-805/30 text-indigo-400 text-xs font-bold rounded-lg uppercase tracking-wider">
                  {client.status}
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Linking Panel */}
          <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
              Telegram Connection
            </h2>

            {client.telegramConnected ? (
              <div className="space-y-4">
                <div className="flex items-center text-emerald-450 text-sm font-semibold gap-2 p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Linked to @{client.telegramUsername || 'User'}</span>
                </div>
                <div className="text-xs text-slate-500 space-y-1.5 bg-slate-950/20 p-3 rounded-lg border border-slate-900">
                  <p><b>User ID:</b> <code>{client.telegramUserId}</code></p>
                  <p><b>Chat ID:</b> <code>{client.telegramChatId}</code></p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-slate-900/40 border border-slate-800 rounded-xl text-xs text-slate-450">
                  <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <p>Telegram is not linked. Generate a connection link to connect the client.</p>
                </div>

                {!telegramLink ? (
                  <button
                    onClick={handleGenerateTelegramLink}
                    disabled={generatingLink}
                    className="w-full flex items-center justify-center py-2.5 bg-indigo-650 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition-all disabled:opacity-55"
                  >
                    {generatingLink ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Generating Link...
                      </>
                    ) : (
                      <>
                        <Send className="w-4.5 h-4.5 mr-2" />
                        Generate Connect Token
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-[10px] bg-slate-950 border border-slate-900 rounded p-2 text-slate-400 break-all select-all font-mono">
                      {telegramLink}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyLink}
                        className="flex-1 flex items-center justify-center py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-all"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-1.5 text-emerald-450" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1.5" />
                            Copy Link
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setTelegramLink(null)}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-semibold rounded-xl"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="bg-[#0d0d12]/60 border border-red-950/45 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center">
              <Trash2 className="w-4 h-4 mr-2 text-red-500" />
              Danger Zone
            </h2>
            <p className="text-xs text-slate-550 mb-4 leading-relaxed">
              Permanently delete this client profile, linked projects, invoices, payments, audit logs, and Supabase Storage PDFs. This action is irreversible.
            </p>
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="w-full py-2.5 bg-red-950/20 hover:bg-red-900/30 border border-red-900/40 hover:border-red-500/50 text-red-450 hover:text-red-300 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete Client
            </button>
          </div>
        </div>

        {/* Right Columns: Financials, Projects, Invoices, Payments, History */}
        <div className="lg:col-span-2 space-y-8">
          {/* Financial summary blocks */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0d0d12]/50 border border-slate-850 p-4 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Projects budget</span>
              <p className="text-base md:text-lg font-bold text-slate-205 mt-1">
                Rs. {financials.totalProjectValue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-[#0d0d12]/50 border border-slate-850 p-4 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Paid</span>
              <p className="text-base md:text-lg font-bold text-emerald-450 mt-1">
                Rs. {financials.totalPaid.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-[#0d0d12]/50 border border-slate-850 p-4 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Outstanding Balance</span>
              <p className="text-base md:text-lg font-bold text-red-405 mt-1">
                Rs. {financials.outstanding.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Projects section */}
          <div className="bg-[#0d0d12]/30 border border-slate-850 p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-slate-200 flex items-center">
                <Laptop className="w-5 h-5 mr-2 text-indigo-400" />
                Client Projects ({projects.length})
              </h2>
              <button
                onClick={() => setAddProjectModalOpen(true)}
                className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-950/40 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="text-center py-8 bg-slate-950/20 border border-slate-900 rounded-xl space-y-3">
                <p className="text-sm text-slate-500">No projects registered for this client yet.</p>
                <button
                  onClick={() => setAddProjectModalOpen(true)}
                  className="px-4 py-2 bg-indigo-650/20 hover:bg-indigo-650/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Project
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((proj) => {
                  const paid = proj.paidAmount ?? 0;
                  const outstanding = proj.outstandingAmount ?? Math.max(0, proj.totalAmount - paid);
                  return (
                    <div
                      key={proj._id}
                      className="p-4 bg-slate-905/30 border border-slate-850/60 hover:border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 text-base">{proj.name}</span>
                          <span className="text-[10px] bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 font-mono px-2 py-0.5 rounded">
                            {proj.projectCode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-3">
                          <span>Service: <b className="text-slate-400">{proj.serviceType}</b></span>
                          <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 uppercase font-semibold">
                            {proj.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-900">
                        <div className="grid grid-cols-3 gap-3 text-right">
                          <div>
                            <span className="text-[10px] text-slate-550 block font-semibold">Budget</span>
                            <span className="text-xs font-bold text-slate-300">
                              {proj.currency === 'INR' ? '₹' : (proj.currency === 'USD' ? '$' : proj.currency)}
                              {proj.totalAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-550 block font-semibold">Paid</span>
                            <span className="text-xs font-bold text-emerald-450">
                              {proj.currency === 'INR' ? '₹' : (proj.currency === 'USD' ? '$' : proj.currency)}
                              {paid.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-red-550 block font-semibold">Outstanding</span>
                            <span className="text-xs font-bold text-red-405">
                              {proj.currency === 'INR' ? '₹' : (proj.currency === 'USD' ? '$' : proj.currency)}
                              {outstanding.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Link
                            href={`/dashboard/projects`}
                            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                            title="View Projects"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => {
                              setProjectToDelete(proj);
                              setDeleteProjectModalOpen(true);
                            }}
                            className="p-2 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 hover:border-red-500/40 text-red-450 hover:text-red-300 rounded-lg transition-all"
                            title="Delete Project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invoices panel */}
          <div className="bg-[#0d0d12]/30 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-400" />
              Invoices & Billing
            </h2>

            {invoices.length === 0 ? (
              <p className="text-sm text-slate-550 py-4 text-center">No invoices generated.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => {
                  const isSending = processingInvs[inv._id] || false;
                  return (
                    <div
                      key={inv._id}
                      className="p-4 bg-slate-905/30 border border-slate-850/60 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div>
                        <div className="font-bold text-slate-300">{inv.invoiceNumber}</div>
                        <div className="text-xs text-slate-550 mt-1 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Issued: {new Date(inv.invoiceDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6">
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-bold text-slate-200">
                            Rs. {inv.total.toLocaleString('en-IN')}
                          </div>
                          <span className="text-[10px] uppercase font-bold text-indigo-400">{inv.status}</span>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={`/api/invoices/${inv._id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleSendInvoiceTelegram(inv._id)}
                            disabled={!client.telegramConnected || isSending}
                            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all
                              ${client.telegramConnected 
                                ? 'bg-indigo-650/10 hover:bg-indigo-650/20 border-indigo-500/20 text-indigo-400' 
                                : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                              }
                            `}
                            title={inv.telegramSent ? 'Resend to Telegram' : 'Send to Telegram'}
                          >
                            {isSending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span className="hidden md:inline">{inv.telegramSent ? 'Resent' : 'Send'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payments listing */}
          <div className="bg-[#0d0d12]/30 border border-slate-850 p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-base font-bold text-slate-200 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-indigo-400" />
                Recent Payments
              </h2>
              {projects.length > 0 && (
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Record Payment
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <p className="text-sm text-slate-550 py-4 text-center">No payment transactions recorded.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/30 border-b border-slate-850 text-slate-450 font-semibold uppercase">
                      <th className="px-4 py-3">Receipt #</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Ref ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-350">
                    {payments.map((pay) => (
                      <tr key={pay._id} className="hover:bg-slate-900/10">
                        <td className="px-4 py-3 font-semibold text-slate-300">{pay.paymentNumber}</td>
                        <td className="px-4 py-3">{pay.paymentMethod}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{pay.transactionReference || '—'}</td>
                        <td className="px-4 py-3">{new Date(pay.paymentDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-200">
                          Rs. {pay.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Client Notes */}
          {client.notes && (
            <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
              <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-2">Onboarding Notes</h2>
              <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{client.notes}</p>
            </div>
          )}

          {/* Data & Credential Requests section */}
          <div className="bg-[#0d0d12]/30 border border-slate-850 p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-slate-200 flex items-center">
                <Lock className="w-5 h-5 mr-2 text-indigo-400" />
                Data & Credential Requests
              </h2>
              {client.telegramConnected && (
                <button
                  onClick={() => setRequestModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Request
                </button>
              )}
            </div>

            {requests.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-550">No requests sent to this client yet.</p>
                {!client.telegramConnected && (
                  <p className="text-xs text-slate-600 mt-1">Connect client's Telegram profile to enable requests.</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/30 border-b border-slate-850 text-slate-450 font-semibold uppercase">
                      <th className="px-4 py-3">Request ID</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-350">
                    {requests.map((req) => (
                      <tr key={req._id} className="hover:bg-slate-900/10">
                        <td className="px-4 py-3 font-semibold text-slate-300 font-mono">{req.requestId}</td>
                        <td className="px-4 py-3">{req.title}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono">
                            {req.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            req.status === 'COMPLETED' ? 'bg-emerald-950/30 text-emerald-450 border border-emerald-900/30' :
                            req.status === 'SENT' ? 'bg-blue-950/30 text-blue-400 border border-blue-900/30' :
                            req.status === 'EXPIRED' ? 'bg-red-950/30 text-red-400 border border-red-900/30' :
                            'bg-slate-900 text-slate-500 border border-slate-800'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => handleViewRequest(req)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 hover:border-slate-700 transition-colors"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleDeleteRequest(req._id)}
                            className="px-2 py-1 bg-red-950/20 hover:bg-red-900/30 text-red-450 hover:text-red-300 rounded border border-red-900/40 hover:border-red-500/50 transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Timeline Audit Logs */}
          <div className="bg-[#0d0d12]/30 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center">
              <History className="w-5 h-5 mr-2 text-indigo-400" />
              Client Activity logs
            </h2>
            
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-550 text-center py-4">No activity logged.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log._id} className="flex gap-3 text-xs leading-relaxed">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0 mt-1.5"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-300 capitalize">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                        <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-500 mt-0.5">By {log.actor}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    {/* Delete Client Confirmation Modal */}
    {deleteModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
        <div className="bg-slate-950 border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-red-405 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
              Delete Client?
            </h3>
            <p className="text-sm text-slate-400">
              You are about to permanently delete client <strong>{client.name}</strong> (<code>{client.clientCode}</code>).
            </p>
          </div>

          <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl space-y-2 text-xs text-red-300">
            <p className="font-semibold text-red-400">This action will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1 text-red-350/85">
              <li>Client profile details</li>
              <li>Projects & Project records</li>
              <li>Payments & Payment transactions</li>
              <li>Invoices & invoice metadata</li>
              <li>Telegram connection & username linking</li>
              <li>All active/expired connection tokens</li>
              <li>All associated client activity logs</li>
              <li>Invoice PDF files from Supabase Storage</li>
            </ul>
            <p className="font-semibold text-red-400 mt-2">This action cannot be undone.</p>
          </div>

          <div className="space-y-2 text-xs">
            <label htmlFor="client-code-confirm" className="block text-slate-450">
              Type <code className="bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-slate-200 uppercase font-bold">{client.clientCode}</code> to confirm deletion:
            </label>
            <input
              id="client-code-confirm"
              type="text"
              value={confirmClientCode}
              onChange={(e) => setConfirmClientCode(e.target.value)}
              placeholder={client.clientCode}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 uppercase tracking-widest placeholder-slate-650 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          <div className="flex gap-3 justify-end text-xs font-semibold">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setConfirmClientCode('');
              }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-450 hover:text-slate-200 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteClient}
              disabled={confirmClientCode !== client.clientCode || deleting}
              className="px-4 py-2.5 bg-red-650 hover:bg-red-650 disabled:bg-slate-900 text-white disabled:text-slate-600 border border-red-500/20 disabled:border-slate-800 rounded-xl transition-all flex items-center gap-1.5 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Permanently
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    {/* Record Payment Modal */}
    {paymentModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
        <div className="bg-slate-950 border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-100 flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-indigo-400" />
              Record Payment
            </h3>
            <p className="text-xs text-slate-400">
              Record a manual transaction and notify the client on Telegram.
            </p>
          </div>

          <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
            {/* Project selection */}
            <div className="space-y-1.5">
              <label htmlFor="payment-project-select" className="block text-slate-400 font-medium">Project *</label>
              <select
                id="payment-project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              >
                {projects.map((proj) => (
                  <option key={proj._id} value={proj._id}>
                    {proj.name} ({proj.projectCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Balances block */}
            {(() => {
              const selectedProj = projects.find((p) => p._id === selectedProjectId);
              if (!selectedProj) return null;

              const projPayments = payments.filter(
                (p) => p.projectId === selectedProjectId && p.status === 'COMPLETED'
              );
              const alreadyPaid = projPayments.reduce((sum, p) => sum + p.amount, 0);
              const totalAmount = selectedProj.totalAmount;
              const outstanding = Math.max(0, totalAmount - alreadyPaid);
              const enteredAmount = Number(paymentAmount) || 0;
              const remaining = Math.max(0, outstanding - enteredAmount);

              return (
                <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl space-y-2 text-slate-350">
                  <div className="flex justify-between">
                    <span>Project Total:</span>
                    <span className="font-bold text-slate-200">
                      {selectedProj.currency} {totalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-450">
                    <span>Already Paid:</span>
                    <span>
                      {selectedProj.currency} {alreadyPaid.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-red-405 border-b border-slate-850 pb-2">
                    <span>Outstanding:</span>
                    <span>
                      {selectedProj.currency} {outstanding.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-indigo-400">
                    <span>Remaining Outstanding:</span>
                    <span>
                      {selectedProj.currency} {remaining.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Amount input */}
            <div className="space-y-1.5">
              <label htmlFor="payment-amount-input" className="block text-slate-400 font-medium">Payment Amount *</label>
              <input
                id="payment-amount-input"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-205 focus:outline-none focus:border-indigo-500 transition-colors font-bold"
                required
                min="0.01"
                step="any"
              />
            </div>

            {/* Payment method & type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="payment-method-select" className="block text-slate-400 font-medium">Payment Method *</label>
                <select
                  id="payment-method-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-202 focus:outline-none"
                  required
                >
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="payment-type-select" className="block text-slate-400 font-medium">Payment Type *</label>
                <select
                  id="payment-type-select"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-202 focus:outline-none"
                  required
                >
                  <option value="INSTALLMENT">INSTALLMENT</option>
                  <option value="ADVANCE">ADVANCE</option>
                  <option value="FINAL_PAYMENT">FINAL PAYMENT</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
            </div>

            {/* Payment date & Reference ID */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="payment-date-input" className="block text-slate-400 font-medium">Payment Date *</label>
                <input
                  id="payment-date-input"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-202 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="payment-ref-input" className="block text-slate-400 font-medium">Reference ID</label>
                <input
                  id="payment-ref-input"
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="e.g. TXN12345678"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-202 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor="payment-notes-input" className="block text-slate-400 font-medium">Notes</label>
              <textarea
                id="payment-notes-input"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-slate-202 focus:outline-none focus:border-indigo-500 transition-colors h-16 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2 font-semibold">
              <button
                type="button"
                onClick={() => {
                  setPaymentModalOpen(false);
                  setPaymentAmount('');
                  setReferenceId('');
                  setPaymentNotes('');
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-450 hover:text-slate-202 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordingPayment}
                className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-500 disabled:bg-slate-900 text-white disabled:text-slate-650 border border-indigo-500/20 disabled:border-slate-800 rounded-xl transition-all flex items-center gap-1.5"
              >
                {recordingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Record Payment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Create Request Modal */}
    {requestModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
        <div className="bg-slate-950 border border-slate-850 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-850 pb-4">
            <h3 className="text-base font-bold text-slate-200 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-indigo-400" />
              New Information Request
            </h3>
            <button
              onClick={() => setRequestModalOpen(false)}
              className="text-slate-500 hover:text-slate-350 text-sm font-semibold"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-450 mb-1">Request Type *</label>
                <select
                  value={requestType}
                  onChange={(e) => {
                    setRequestType(e.target.value);
                    if (e.target.value === 'CREDENTIAL') {
                      setRequestTitle('Hosting Credentials');
                      setRequestMessage('Please provide the hosting credentials for the website migration.');
                    } else if (e.target.value === 'IMAGE') {
                      setRequestTitle('Company Logo');
                      setRequestMessage('Please send your high-resolution company logo.');
                    } else if (e.target.value === 'DOCUMENT') {
                      setRequestTitle('Project Documents');
                      setRequestMessage('Please upload the project brief PDF/Word file.');
                    } else {
                      setRequestTitle('General Information');
                      setRequestMessage('Please provide the requested website details.');
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="GENERAL">GENERAL TEXT</option>
                  <option value="CREDENTIAL">🔐 SECURE CREDENTIAL</option>
                  <option value="IMAGE">🖼️ IMAGE</option>
                  <option value="DOCUMENT">📁 DOCUMENT / PDF</option>
                  <option value="TEXT">✍️ TEXT</option>
                  <option value="CUSTOM">CUSTOM</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-450 mb-1">Link to Project (Optional)</label>
                <select
                  value={selectedProjectIdForReq}
                  onChange={(e) => setSelectedProjectIdForReq(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">None (General Client Request)</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.projectCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {requestType === 'CREDENTIAL' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900/30 border border-slate-850 rounded-xl">
                <div>
                  <label className="block text-slate-450 mb-1">Credential Type</label>
                  <select
                    value={credentialType}
                    onChange={(e) => setCredentialType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="HOSTING">HOSTING</option>
                    <option value="DOMAIN">DOMAIN</option>
                    <option value="WORDPRESS">WORDPRESS</option>
                    <option value="FTP">FTP</option>
                    <option value="SFTP">SFTP</option>
                    <option value="CPANEL">CPANEL</option>
                    <option value="DATABASE">DATABASE</option>
                    <option value="EMAIL">EMAIL</option>
                    <option value="CLOUD">CLOUD</option>
                    <option value="GITHUB">GITHUB</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-450 mb-1.5">Required Fields</label>
                  <div className="grid grid-cols-2 gap-2 text-slate-350">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={requiredFields.includes('Service')}
                        onChange={(e) => {
                          if (e.target.checked) setRequiredFields([...requiredFields, 'Service']);
                          else setRequiredFields(requiredFields.filter(f => f !== 'Service'));
                        }}
                      />
                      Service
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={requiredFields.includes('Username')}
                        onChange={(e) => {
                          if (e.target.checked) setRequiredFields([...requiredFields, 'Username']);
                          else setRequiredFields(requiredFields.filter(f => f !== 'Username'));
                        }}
                      />
                      Username
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={requiredFields.includes('Password')}
                        onChange={(e) => {
                          if (e.target.checked) setRequiredFields([...requiredFields, 'Password']);
                          else setRequiredFields(requiredFields.filter(f => f !== 'Password'));
                        }}
                      />
                      Password
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={requiredFields.includes('Login URL')}
                        onChange={(e) => {
                          if (e.target.checked) setRequiredFields([...requiredFields, 'Login URL']);
                          else setRequiredFields(requiredFields.filter(f => f !== 'Login URL'));
                        }}
                      />
                      Login URL
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-450 mb-1">Title *</label>
              <input
                type="text"
                required
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="Request title"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-450 mb-1">Message / Instructions *</label>
              <textarea
                required
                rows={3}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Instructions for the client..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            <div className="p-4 bg-indigo-950/10 border border-indigo-900/20 rounded-xl space-y-1">
              <span className="block text-[10px] uppercase font-bold text-indigo-400">Telegram Live Preview</span>
              <pre className="text-[10px] text-slate-400 whitespace-pre-wrap font-mono leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-900">
                {getTelegramPreview()}
              </pre>
            </div>

            <div className="flex gap-3 justify-end font-semibold border-t border-slate-850 pt-4">
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-450 hover:text-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingRequest}
                className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-500 disabled:bg-slate-900 text-white disabled:text-slate-650 border border-indigo-500/20 disabled:border-slate-800 rounded-xl transition-all flex items-center gap-1.5"
              >
                {sendingRequest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* View Request Details / Decryption Modal */}
    {viewRequestModalOpen && activeRequest && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
        <div className="bg-slate-950 border border-slate-850 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-850 pb-4">
            <h3 className="text-base font-bold text-slate-200 font-mono">
              Request Details: {activeRequest.request.requestId}
            </h3>
            <button
              onClick={() => {
                setViewRequestModalOpen(false);
                setDecryptedData(null);
                setDecryptPassword('');
                setDecryptError(null);
              }}
              className="text-slate-500 hover:text-slate-355 text-sm font-semibold"
            >
              Close
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Request Title</span>
                <p className="text-slate-300 font-semibold mt-0.5">{activeRequest.request.title}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Status</span>
                <p className="mt-0.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    activeRequest.request.status === 'COMPLETED' ? 'bg-emerald-950/30 text-emerald-450 border border-emerald-900/30' :
                    activeRequest.request.status === 'SENT' ? 'bg-blue-950/30 text-blue-400 border border-blue-900/30' :
                    'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}>
                    {activeRequest.request.status}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Instructions</span>
              <p className="text-slate-300 bg-slate-900/20 border border-slate-850/50 p-3 rounded-lg mt-1 font-sans">
                {activeRequest.request.message}
              </p>
            </div>

            {/* If request is CREDENTIAL */}
            {activeRequest.request.type === 'CREDENTIAL' && activeRequest.credentialMeta && (
              <div className="border-t border-slate-850 pt-4">
                {/* Password Decryption Challenge form */}
                {!decryptedData ? (
                  <form onSubmit={handleDecryptCredential} className="space-y-3">
                    <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-xl space-y-3">
                      <span className="block text-slate-300 font-semibold">🔐 Confirm Admin Password to Decrypt Credentials</span>
                      <p className="text-slate-500 leading-normal">
                        This credential is encrypted at rest using AES-256-GCM. Confirm your master admin login password to authorize decryption.
                      </p>
                      
                      <div className="space-y-1">
                        <input
                          type="password"
                          required
                          value={decryptPassword}
                          onChange={(e) => setDecryptPassword(e.target.value)}
                          placeholder="Master Password"
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        {decryptError && <p className="text-red-405 font-medium">{decryptError}</p>}
                      </div>

                      <button
                        type="submit"
                        disabled={decrypting}
                        className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-500 disabled:bg-slate-900 text-white disabled:text-slate-650 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {decrypting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Authorize & Decrypt'}
                      </button>
                    </div>
                  </form>
                ) : (
                  // Decrypted credentials values view
                  <div className="space-y-3 p-4 bg-slate-900/20 border border-slate-850 rounded-xl">
                    <span className="block text-emerald-450 font-bold mb-2 flex items-center">
                      <Check className="w-4 h-4 mr-1" />
                      Credentials Decrypted Successfully
                    </span>

                    {/* Service */}
                    <div className="grid grid-cols-3 items-center gap-2 pb-2 border-b border-slate-850/50">
                      <span className="text-slate-500 font-semibold">Service:</span>
                      <span className="col-span-2 text-slate-200 font-bold text-sm">{decryptedData.service}</span>
                    </div>

                    {/* Username */}
                    <div className="grid grid-cols-3 items-center gap-2 pb-2 border-b border-slate-850/50">
                      <span className="text-slate-500 font-semibold">Username:</span>
                      <div className="col-span-2 flex items-center justify-between">
                        <span className="text-slate-250 font-mono select-all">{decryptedData.username}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(decryptedData.username);
                            logRequestAudit(activeRequest.request._id, 'CREDENTIAL_COPIED');
                            setCopiedFields(prev => ({ ...prev, user: true }));
                            setTimeout(() => setCopiedFields(prev => ({ ...prev, user: false })), 2000);
                          }}
                          className="text-slate-500 hover:text-slate-300 text-[10px] font-semibold border border-slate-800 hover:border-slate-700 bg-slate-900 px-2 py-0.5 rounded"
                        >
                          {copiedFields.user ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="grid grid-cols-3 items-center gap-2 pb-2 border-b border-slate-850/50">
                      <span className="text-slate-500 font-semibold">Password:</span>
                      <div className="col-span-2 flex items-center justify-between gap-2">
                        <span className="text-slate-250 font-mono select-all">
                          {revealedFields.password ? decryptedData.password : '••••••••••••••••'}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const rev = !revealedFields.password;
                              setRevealedFields(prev => ({ ...prev, password: rev }));
                              if (rev) {
                                logRequestAudit(activeRequest.request._id, 'CREDENTIAL_REVEALED');
                              }
                            }}
                            className="text-slate-500 hover:text-slate-300 text-[10px] font-semibold border border-slate-800 hover:border-slate-700 bg-slate-900 px-2 py-0.5 rounded"
                          >
                            {revealedFields.password ? 'Hide' : 'Reveal'}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(decryptedData.password);
                              logRequestAudit(activeRequest.request._id, 'CREDENTIAL_COPIED');
                              setCopiedFields(prev => ({ ...prev, pass: true }));
                              setTimeout(() => setCopiedFields(prev => ({ ...prev, pass: false })), 2000);
                            }}
                            className="text-slate-500 hover:text-slate-300 text-[10px] font-semibold border border-slate-800 hover:border-slate-700 bg-slate-900 px-2 py-0.5 rounded"
                          >
                            {copiedFields.pass ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Login URL */}
                    {decryptedData.loginUrl && (
                      <div className="grid grid-cols-3 items-center gap-2 pb-2 border-b border-slate-850/50">
                        <span className="text-slate-500 font-semibold">Login URL:</span>
                        <div className="col-span-2 flex items-center justify-between gap-2">
                          <a
                            href={decryptedData.loginUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-400 hover:underline overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]"
                          >
                            {decryptedData.loginUrl}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(decryptedData.loginUrl);
                              logRequestAudit(activeRequest.request._id, 'CREDENTIAL_COPIED');
                              setCopiedFields(prev => ({ ...prev, url: true }));
                              setTimeout(() => setCopiedFields(prev => ({ ...prev, url: false })), 2000);
                            }}
                            className="text-slate-500 hover:text-slate-300 text-[10px] font-semibold border border-slate-800 hover:border-slate-700 bg-slate-900 px-2 py-0.5 rounded"
                          >
                            {copiedFields.url ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Additional Info */}
                    {decryptedData.additionalInfo && (
                      <div className="grid grid-cols-3 items-start gap-2 pt-1">
                        <span className="text-slate-500 font-semibold">Notes:</span>
                        <div className="col-span-2 flex items-start justify-between gap-2">
                          <span className="text-slate-300 whitespace-pre-wrap font-sans">{decryptedData.additionalInfo}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(decryptedData.additionalInfo);
                              logRequestAudit(activeRequest.request._id, 'CREDENTIAL_COPIED');
                              setCopiedFields(prev => ({ ...prev, notes: true }));
                              setTimeout(() => setCopiedFields(prev => ({ ...prev, notes: false })), 2000);
                            }}
                            className="text-slate-500 hover:text-slate-300 text-[10px] font-semibold border border-slate-800 hover:border-slate-700 bg-slate-900 px-2 py-0.5 rounded shrink-0"
                          >
                            {copiedFields.notes ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Share with Team Member button */}
                    <div className="pt-3 mt-3 border-t border-slate-850/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Share securely with authorized team member:</span>
                      <button
                        onClick={async () => {
                          setShareSuccess(null);
                          setShareError(null);
                          try {
                            const res = await fetch('/api/team-members?status=ACTIVE');
                            const json = await res.json();
                            if (json.success) {
                              setShareTeamMembers(json.data || []);
                              if (json.data && json.data.length > 0) {
                                setSelectedTeamMemberId(json.data[0]._id);
                              }
                              setShareModalOpen(true);
                            }
                          } catch (err) {
                            console.error('Failed to load team members:', err);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>🔐 Share via Telegram</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* If request is NOT credential (General, text, custom, files) */}
            {activeRequest.request.type !== 'CREDENTIAL' && activeRequest.responseMeta && (
              <div className="border-t border-slate-850 pt-4 space-y-3">
                {activeRequest.responseMeta.responseText && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Client Response Text</span>
                    <p className="text-slate-300 bg-slate-900/20 border border-slate-850 p-3 rounded-lg mt-1 font-mono leading-relaxed whitespace-pre-wrap select-all">
                      {activeRequest.responseMeta.responseText}
                    </p>
                  </div>
                )}

                {activeRequest.responseMeta.files && activeRequest.responseMeta.files.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Client Uploaded Files</span>
                    <div className="space-y-2 mt-1">
                      {activeRequest.responseMeta.files.map((file: any, index: number) => (
                        <div key={index} className="flex justify-between items-center bg-slate-900/20 border border-slate-850 p-3 rounded-lg">
                          <div className="overflow-hidden">
                            <span className="block text-slate-300 font-bold truncate max-w-[280px]">{file.fileName}</span>
                            <span className="text-[10px] text-slate-550 block mt-0.5">
                              {file.mimeType} | {Math.round(file.size / 1024)} KB
                            </span>
                          </div>
                          {file.downloadUrl && (
                            <a
                              href={file.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* Add Project Modal */}
      {addProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f0f15] border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-850">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Add New Project for {client.name}
              </h3>
              <button
                onClick={() => setAddProjectModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. E-Commerce Store Development"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Service Type</label>
                  <select
                    value={newProjectServiceType}
                    onChange={(e) => setNewProjectServiceType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="WEBSITE">Website</option>
                    <option value="WEB_APPLICATION">Web Application</option>
                    <option value="MOBILE_APPLICATION">Mobile Application</option>
                    <option value="API_DEVELOPMENT">API Development</option>
                    <option value="WORDPRESS">WordPress</option>
                    <option value="ECOMMERCE">E-Commerce</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Currency</label>
                  <select
                    value={newProjectCurrency}
                    onChange={(e) => setNewProjectCurrency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Total Budget Amount <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={newProjectBudget}
                  onChange={(e) => setNewProjectBudget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newProjectStartDate}
                    onChange={(e) => setNewProjectStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Expected Completion</label>
                  <input
                    type="date"
                    value={newProjectEndDate}
                    onChange={(e) => setNewProjectEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description / Scope Notes</label>
                <textarea
                  rows={3}
                  value={newProjectNotes}
                  onChange={(e) => setNewProjectNotes(e.target.value)}
                  placeholder="Project requirements, deliverable milestones..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddProjectModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProject}
                  className="flex-1 py-2.5 bg-indigo-650 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  {creatingProject ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deleteProjectModalOpen && projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f0f15] border border-red-900/40 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Project: {projectToDelete.name}?
            </h3>
            <p className="text-xs text-slate-450 leading-relaxed">
              Are you sure you want to delete <b>{projectToDelete.name}</b> (<code>{projectToDelete.projectCode}</code>)?
              <br /><br />
              This will remove the project and its associated payments, invoices, requests, and credentials. The client profile <b>{client.name}</b> will NOT be deleted.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteProjectModalOpen(false);
                  setProjectToDelete(null);
                }}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deletingProject}
                className="flex-1 py-2.5 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                {deletingProject ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Confirm Delete Project'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Share Credential to Team Member Modal */}
      {shareModalOpen && activeRequest && activeRequest.credentialMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0f0f15] border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-400" />
                Share Credential with Team Member
              </h3>
              <button onClick={() => setShareModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              The credentials will be decrypted on the server and sent directly to the selected team member&apos;s linked Telegram account.
            </p>

            {shareSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs font-semibold">
                {shareSuccess}
              </div>
            )}

            {shareError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs font-semibold">
                {shareError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Team Member *</label>
                <select
                  value={selectedTeamMemberId}
                  onChange={(e) => setSelectedTeamMemberId(e.target.value)}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  {shareTeamMembers.map((m) => {
                    const hasPerm = m.permissions && m.permissions.includes('VIEW_CREDENTIALS');
                    return (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.role}) {m.telegramConnected ? '• Telegram Linked' : '• No Telegram'} {hasPerm ? '• Has Permission' : '• No Permission'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={shareOneTime}
                  onChange={(e) => setShareOneTime(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-300">Mark as One-Time / Confidential Credential</span>
              </label>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sharingCredential || !selectedTeamMemberId}
                onClick={async () => {
                  setSharingCredential(true);
                  setShareSuccess(null);
                  setShareError(null);
                  try {
                    const credId = activeRequest.credentialMeta._id;
                    const res = await fetch(`/api/credentials/${credId}/share`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        teamMemberId: selectedTeamMemberId,
                        oneTime: shareOneTime,
                      }),
                    });
                    const json = await res.json();
                    if (json.success) {
                      setShareSuccess(json.data?.message || 'Credential sent via Telegram successfully!');
                      setTimeout(() => {
                        setShareModalOpen(false);
                      }, 2000);
                    } else {
                      setShareError(json.error?.message || 'Failed to share credential');
                    }
                  } catch (err: any) {
                    setShareError(err.message || 'Error occurred while sharing credential');
                  } finally {
                    setSharingCredential(false);
                  }
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 text-white disabled:text-slate-600 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                {sharingCredential ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Credential
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
