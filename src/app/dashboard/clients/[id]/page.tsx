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
  Server,
  FolderKanban,
  Edit2,
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
  hostings?: any[];
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

  // Edit Project States
  const [editProjectModalOpen, setEditProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectServiceType, setEditProjectServiceType] = useState('WEBSITE');
  const [editProjectBudget, setEditProjectBudget] = useState('');
  const [editProjectCurrency, setEditProjectCurrency] = useState('INR');
  const [editProjectStatus, setEditProjectStatus] = useState('PLANNED');
  const [editProjectStartDate, setEditProjectStartDate] = useState('');
  const [editProjectEndDate, setEditProjectEndDate] = useState('');
  const [editProjectScope, setEditProjectScope] = useState('');
  const [editProjectTerms, setEditProjectTerms] = useState('');
  const [editProjectNotes, setEditProjectNotes] = useState('');
  const [editProjectError, setEditProjectError] = useState<string | null>(null);
  const [updatingProject, setUpdatingProject] = useState(false);

  const openEditProject = (proj: Project) => {
    setProjectToEdit(proj);
    setEditProjectName(proj.name);
    setEditProjectServiceType(proj.serviceType);
    setEditProjectBudget(String(proj.totalAmount));
    setEditProjectCurrency(proj.currency || 'INR');
    setEditProjectStatus(proj.status);
    setEditProjectStartDate(proj.startDate ? new Date(proj.startDate).toISOString().split('T')[0] : '');
    setEditProjectEndDate(proj.expectedCompletionDate ? new Date(proj.expectedCompletionDate).toISOString().split('T')[0] : '');
    setEditProjectScope((proj as any).scope || '');
    setEditProjectTerms((proj as any).terms || '');
    setEditProjectNotes('');
    setEditProjectError(null);
    setEditProjectModalOpen(true);
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToEdit) return;
    setUpdatingProject(true);
    setEditProjectError(null);
    try {
      const res = await fetch(`/api/projects/${projectToEdit._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProjectName,
          serviceType: editProjectServiceType,
          totalAmount: parseFloat(editProjectBudget) || 0,
          currency: editProjectCurrency,
          status: editProjectStatus,
          startDate: editProjectStartDate ? new Date(editProjectStartDate) : undefined,
          expectedCompletionDate: editProjectEndDate ? new Date(editProjectEndDate) : undefined,
          scope: editProjectScope,
          terms: editProjectTerms,
          notes: editProjectNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditProjectModalOpen(false);
        setProjectToEdit(null);
        await fetchClientDetails();
      } else {
        setEditProjectError(json.error?.message || 'Failed to update project');
      }
    } catch (err: any) {
      setEditProjectError(err.message || 'Error updating project');
    } finally {
      setUpdatingProject(false);
    }
  };

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
          <div className="w-10 h-10 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs"></div>
          <div className="h-6 w-48 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 h-96 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs"></div>
          <div className="lg:col-span-2 h-96 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 bg-[#141416] border border-red-500/20 rounded-none md:rounded-xs text-center text-red-400 font-mono text-xs uppercase tracking-wider">
        Client record not found in system.
      </div>
    );
  }

  const { client, projects, invoices, payments, auditLogs, financials, hostings = [] } = data;

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/clients"
            className="p-2.5 bg-[#141416] hover:bg-[#18181b] border border-[#242428] hover:border-[#ff3e00]/50 rounded-none md:rounded-xs text-[#88888e] hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">{client.name}</h1>
              <code className="text-xs bg-[#ff3e00]/10 text-[#ff3e00] border border-[#ff3e00]/20 px-2 py-0.5 font-mono uppercase tracking-widest rounded-none md:rounded-xs">
                {client.clientCode}
              </code>
            </div>
            <p className="text-[#88888e] font-mono text-[11px] mt-0.5">ONBOARDED: {new Date(client.onboardingDate).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-400 rounded-none md:rounded-xs font-mono text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 bg-[#00D664]/10 border border-[#00D664]/20 text-[#00D664] rounded-none md:rounded-xs font-mono text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00D664]" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Grid Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Client profile & Telegram Panel */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-[#141416] border border-[#242428] p-6 rounded-none md:rounded-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h2 className="text-xs font-mono font-bold text-[#88888e] uppercase tracking-wider">
                  SYS::PROFILE_SUMMARY
                </h2>
              </div>
            </div>
            <div className="space-y-3.5 text-xs text-[#88888e] font-mono">
              {client.company && (
                <div className="flex items-center space-x-3 text-white">
                  <Building className="w-4 h-4 text-[#88888e] shrink-0" />
                  <span>{client.company}</span>
                </div>
              )}
              <div className="flex items-center space-x-3 text-white">
                <Mail className="w-4 h-4 text-[#88888e] shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center space-x-3 text-white">
                  <Phone className="w-4 h-4 text-[#88888e] shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-start space-x-3 text-white">
                  <MapPin className="w-4 h-4 text-[#88888e] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    {client.address}, {client.city || ''}, {client.state || ''}, {client.country || ''}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-[#242428]">
                <span className="text-[10px] text-[#88888e] block mb-1.5 uppercase tracking-wider">LIFECYCLE_STATUS</span>
                <div className="inline-block px-2.5 py-1 bg-[#18181b] border border-[#242428] text-white text-[10px] font-mono font-semibold uppercase tracking-wider rounded-none md:rounded-xs">
                  {client.status}
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Linking Panel */}
          <div className="bg-[#141416] border border-[#242428] p-6 rounded-none md:rounded-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00D664]"></span>
                <h2 className="text-xs font-mono font-bold text-[#88888e] uppercase tracking-wider">
                  SYS::TELEGRAM_UPLINK
                </h2>
              </div>
            </div>

            {client.telegramConnected ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="flex items-center text-[#00D664] text-xs font-semibold gap-2 p-3 bg-[#00D664]/10 border border-[#00D664]/20 rounded-none md:rounded-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#00D664]" />
                  <span>LINKED: @{client.telegramUsername || 'User'}</span>
                </div>
                <div className="text-[11px] text-[#88888e] space-y-1.5 bg-[#0a0a0a] p-3 rounded-none md:rounded-xs border border-[#242428]">
                  <p><b>USER_ID:</b> <code className="text-white">{client.telegramUserId}</code></p>
                  <p><b>CHAT_ID:</b> <code className="text-white">{client.telegramChatId}</code></p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-[#88888e]">
                  <AlertCircle className="w-4 h-4 text-[#88888e] shrink-0 mt-0.5" />
                  <p>Telegram is not linked. Generate an authorization token to link the client chat.</p>
                </div>

                {!telegramLink ? (
                  <button
                    onClick={handleGenerateTelegramLink}
                    disabled={generatingLink}
                    className="w-full flex items-center justify-center py-2.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white font-mono text-xs font-semibold uppercase tracking-wider rounded-none md:rounded-xs transition-all disabled:opacity-50"
                  >
                    {generatingLink ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        GENERATING TOKEN...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        GENERATE CONNECT TOKEN
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3 font-mono">
                    <div className="text-[10px] bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs p-2 text-[#88888e] break-all select-all">
                      {telegramLink}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyLink}
                        className="flex-1 flex items-center justify-center py-2 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-white font-mono text-xs font-semibold uppercase tracking-wider rounded-none md:rounded-xs transition-all"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-1.5 text-[#00D664]" />
                            COPIED
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1.5" />
                            COPY LINK
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setTelegramLink(null)}
                        className="px-3 py-2 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-[#88888e] hover:text-white text-xs font-mono font-semibold uppercase tracking-wider rounded-none md:rounded-xs"
                      >
                        RESET
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="bg-[#141416] border border-red-500/20 p-6 rounded-none md:rounded-xs space-y-3">
            <h2 className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-500" />
              SYS::DANGER_ZONE
            </h2>
            <p className="text-xs font-mono text-[#88888e] leading-relaxed">
              Permanently purge this client profile, linked projects, invoices, payments, audit logs, and Supabase Storage PDFs. Irreversible action.
            </p>
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="w-full py-2.5 bg-red-950/20 hover:bg-red-900/30 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-red-300 font-mono font-semibold rounded-none md:rounded-xs text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              PURGE CLIENT RECORD
            </button>
          </div>
        </div>

        {/* Right Columns: Financials, Projects, Invoices, Payments, History */}
        <div className="lg:col-span-2 space-y-8">
          {/* Financial summary blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-[#141416] border border-[#242428] p-4 rounded-none md:rounded-xs text-center">
              <span className="text-[10px] text-[#88888e] font-mono font-bold uppercase tracking-wider">PROJECTS BUDGET</span>
              <p className="text-base md:text-lg font-bold font-mono text-white mt-1">
                Rs. {financials.totalProjectValue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-[#141416] border border-[#242428] p-4 rounded-none md:rounded-xs text-center">
              <span className="text-[10px] text-[#88888e] font-mono font-bold uppercase tracking-wider">SETTLED PAID</span>
              <p className="text-base md:text-lg font-bold font-mono text-[#00D664] mt-1">
                Rs. {financials.totalPaid.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-[#141416] border border-[#242428] p-4 rounded-none md:rounded-xs text-center">
              <span className="text-[10px] text-[#88888e] font-mono font-bold uppercase tracking-wider">OUTSTANDING BALANCE</span>
              <p className="text-base md:text-lg font-bold font-mono text-[#ff3e00] mt-1">
                Rs. {financials.outstanding.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Projects section */}
          <div className="bg-[#141416] border border-[#242428] p-6 rounded-none md:rounded-xs space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center">
                  <Laptop className="w-4 h-4 mr-2 text-[#ff3e00]" />
                  CLIENT PROJECTS ({projects.length})
                </h2>
              </div>
              <button
                onClick={() => setAddProjectModalOpen(true)}
                className="px-3 py-1.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs text-xs font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                ADD PROJECT
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="text-center py-8 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-3 font-mono">
                <p className="text-xs text-[#88888e]">NO PROJECTS REGISTERED FOR THIS CLIENT YET.</p>
                <button
                  onClick={() => setAddProjectModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-white rounded-none md:rounded-xs text-xs font-mono uppercase tracking-wider font-semibold inline-flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  CREATE FIRST PROJECT
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
                      className="p-4 bg-[#0a0a0a] border border-[#242428] hover:border-[#ff3e00]/40 rounded-none md:rounded-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm tracking-tight">{proj.name}</span>
                          <span className="text-[10px] bg-[#141416] border border-[#242428] text-[#ff3e00] font-mono px-2 py-0.5 rounded-none md:rounded-xs">
                            {proj.projectCode}
                          </span>
                        </div>
                        <div className="text-xs text-[#88888e] font-mono flex items-center gap-3">
                          <span>SVC: <b className="text-white">{proj.serviceType}</b></span>
                          <span className="text-[10px] bg-[#141416] border border-[#242428] px-2 py-0.5 rounded-none md:rounded-xs text-[#88888e] uppercase font-semibold">
                            {proj.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-5 pt-2 md:pt-0 border-t md:border-t-0 border-[#242428] font-mono">
                        <div className="grid grid-cols-3 gap-4 text-right">
                          <div>
                            <span className="text-[10px] text-[#88888e] block uppercase">BUDGET</span>
                            <span className="text-xs font-bold text-white">
                              {proj.currency === 'INR' ? '₹' : (proj.currency === 'USD' ? '$' : proj.currency)}
                              {proj.totalAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#00D664] block uppercase">PAID</span>
                            <span className="text-xs font-bold text-[#00D664]">
                              {proj.currency === 'INR' ? '₹' : (proj.currency === 'USD' ? '$' : proj.currency)}
                              {paid.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#ff3e00] block uppercase">BALANCE</span>
                            <span className="text-xs font-bold text-[#ff3e00]">
                              {proj.currency === 'INR' ? '₹' : (proj.currency === 'USD' ? '$' : proj.currency)}
                              {outstanding.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Link
                            href={`/dashboard/projects/${proj._id}`}
                            className="p-2 bg-[#141416] border border-[#242428] hover:border-[#ff3e00]/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs transition-all"
                            title="View Project Detail"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => openEditProject(proj)}
                            className="p-2 bg-[#141416] border border-[#242428] hover:border-[#ff3e00]/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs transition-all"
                            title="Edit Project"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setProjectToDelete(proj);
                              setDeleteProjectModalOpen(true);
                            }}
                            className="p-2 bg-red-950/20 hover:bg-red-900/30 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-red-300 rounded-none md:rounded-xs transition-all"
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
          <div className="bg-[#141416] border border-[#242428] p-6 rounded-none md:rounded-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-[#ff3e00]" />
                  INVOICES & BILLING
                </h2>
              </div>
            </div>

            {invoices.length === 0 ? (
              <p className="text-xs font-mono text-[#88888e] py-4 text-center">NO INVOICES GENERATED.</p>
            ) : (
              <div className="space-y-3 font-mono">
                {invoices.map((inv) => {
                  const isSending = processingInvs[inv._id] || false;
                  return (
                    <div
                      key={inv._id}
                      className="p-4 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div>
                        <div className="font-bold text-white text-xs">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-[#88888e] mt-1 flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>ISSUED: {new Date(inv.invoiceDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6">
                        <div className="text-left sm:text-right">
                          <div className="text-xs font-bold text-white">
                            Rs. {inv.total.toLocaleString('en-IN')}
                          </div>
                          <span className="text-[10px] uppercase font-bold text-[#ff3e00]">{inv.status}</span>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={`/api/invoices/${inv._id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-[#141416] hover:bg-[#18181b] border border-[#242428] hover:border-[#ff3e00]/50 text-[#88888e] hover:text-white rounded-none md:rounded-xs transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleSendInvoiceTelegram(inv._id)}
                            disabled={!client.telegramConnected || isSending}
                            className={`p-2 rounded-none md:rounded-xs border text-xs font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all
                              ${client.telegramConnected 
                                ? 'bg-[#18181b] hover:bg-[#242428] border-[#242428] hover:border-[#ff3e00]/50 text-white' 
                                : 'bg-[#0a0a0a] border-[#242428] text-[#55555a] cursor-not-allowed'
                              }
                            `}
                            title={inv.telegramSent ? 'Resend to Telegram' : 'Send to Telegram'}
                          >
                            {isSending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span className="hidden md:inline">{inv.telegramSent ? 'RESENT' : 'SEND'}</span>
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
          <div className="bg-[#141416] border border-[#242428] p-6 rounded-none md:rounded-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center">
                  <CreditCard className="w-4 h-4 mr-2 text-[#ff3e00]" />
                  RECENT PAYMENTS
                </h2>
              </div>
              {projects.length > 0 && (
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white text-xs font-mono uppercase tracking-wider font-semibold rounded-none md:rounded-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  RECORD PAYMENT
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <p className="text-xs font-mono text-[#88888e] py-4 text-center">NO PAYMENT TRANSACTIONS RECORDED.</p>
            ) : (
              <div className="overflow-x-auto border border-[#242428] rounded-none md:rounded-xs">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-[#0a0a0a] border-b border-[#242428] text-[#88888e] text-[10px] uppercase tracking-wider">
                      <th className="px-4 py-3">Receipt #</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Ref ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242428] text-[#88888e]">
                    {payments.map((pay) => (
                      <tr key={pay._id} className="hover:bg-[#18181b]/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{pay.paymentNumber}</td>
                        <td className="px-4 py-3">{pay.paymentMethod}</td>
                        <td className="px-4 py-3 text-[#88888e]">{pay.transactionReference || '—'}</td>
                        <td className="px-4 py-3">{new Date(pay.paymentDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          Rs. {pay.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Hosting Accounts Panel */}
          <div className="bg-[#141416] border border-[#242428] p-6 rounded-none md:rounded-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center">
                  <Server className="w-4 h-4 mr-2 text-[#ff3e00]" />
                  HOSTING & INFRASTRUCTURE
                </h2>
              </div>
              <Link
                href="/dashboard/hosting"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-white text-xs font-mono uppercase tracking-wider font-semibold rounded-none md:rounded-xs transition-all"
              >
                <span>MANAGE HOSTING</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {hostings.length === 0 ? (
              <p className="text-xs font-mono text-[#88888e] py-4 text-center">NO HOSTING ACCOUNTS RECORDED FOR THIS CLIENT.</p>
            ) : (
              <div className="overflow-x-auto border border-[#242428] rounded-none md:rounded-xs">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-[#0a0a0a] border-b border-[#242428] text-[#88888e] text-[10px] uppercase tracking-wider">
                      <th className="px-4 py-3">Server / Domain</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">IP Address</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242428] text-[#88888e]">
                    {hostings.map((h: any) => (
                      <tr key={h._id} className="hover:bg-[#18181b]/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{h.serverName || h.domainName || 'Unnamed'}</td>
                        <td className="px-4 py-3 text-[#88888e]">{h.provider}</td>
                        <td className="px-4 py-3 text-[#88888e]">{h.ipAddress || '—'}</td>
                        <td className="px-4 py-3 text-white">{h.expiryDate ? new Date(h.expiryDate).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-mono font-semibold ${
                            h.status === 'ACTIVE' ? 'bg-[#00D664]/10 text-[#00D664] border border-[#00D664]/20' :
                            h.status === 'EXPIRING_SOON' ? 'bg-amber-950/30 text-amber-400 border border-amber-900/30' :
                            'bg-red-950/30 text-red-400 border border-red-900/30'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href="/dashboard/hosting"
                            className="px-2.5 py-1 bg-[#18181b] hover:bg-[#242428] text-[#88888e] hover:text-white rounded-none md:rounded-xs border border-[#242428] hover:border-[#ff3e00]/50 transition-colors text-[10px] uppercase font-mono tracking-wider"
                          >
                            Details
                          </Link>
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
            <div className="bg-[#141416] border border-[#242428] p-6 rounded-none md:rounded-xs space-y-3 font-mono">
              <div className="flex items-center gap-2 pb-2 border-b border-[#242428]">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h2 className="text-xs font-mono font-semibold uppercase text-[#88888e] tracking-wider">SYS::ONBOARDING_NOTES</h2>
              </div>
              <p className="text-xs text-white whitespace-pre-line leading-relaxed">{client.notes}</p>
            </div>
          )}

          {/* Data & Credential Requests section */}
          <div className="bg-[#141416] border border-[#242428] p-6 rounded-none md:rounded-xs space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center">
                  <Lock className="w-4 h-4 mr-2 text-[#ff3e00]" />
                  DATA & CREDENTIAL REQUESTS
                </h2>
              </div>
              {client.telegramConnected && (
                <button
                  onClick={() => setRequestModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white text-xs font-mono uppercase tracking-wider font-semibold rounded-none md:rounded-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  NEW REQUEST
                </button>
              )}
            </div>

            {requests.length === 0 ? (
              <div className="text-center py-6 font-mono">
                <p className="text-xs text-[#88888e]">NO REQUESTS SENT TO THIS CLIENT YET.</p>
                {!client.telegramConnected && (
                  <p className="text-[10px] text-[#55555a] mt-1">CONNECT CLIENT TELEGRAM PROFILE TO ENABLE REQUESTS.</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#242428] rounded-none md:rounded-xs">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-[#0a0a0a] border-b border-[#242428] text-[#88888e] text-[10px] uppercase tracking-wider">
                      <th className="px-4 py-3">Request ID</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242428] text-[#88888e]">
                    {requests.map((req) => (
                      <tr key={req._id} className="hover:bg-[#18181b]/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{req.requestId}</td>
                        <td className="px-4 py-3 text-white">{req.title}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-none md:rounded-xs bg-[#18181b] border border-[#242428] text-[10px] text-[#88888e]">
                            {req.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-semibold ${
                            req.status === 'COMPLETED' ? 'bg-[#00D664]/10 text-[#00D664] border border-[#00D664]/20' :
                            req.status === 'SENT' ? 'bg-blue-950/30 text-blue-400 border border-blue-900/30' :
                            req.status === 'EXPIRED' ? 'bg-red-950/30 text-red-400 border border-red-900/30' :
                            'bg-[#18181b] text-[#88888e] border border-[#242428]'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => handleViewRequest(req)}
                            className="px-2.5 py-1 bg-[#18181b] hover:bg-[#242428] text-[#88888e] hover:text-white rounded-none md:rounded-xs border border-[#242428] hover:border-[#ff3e00]/50 transition-colors text-[10px] uppercase font-mono tracking-wider"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleDeleteRequest(req._id)}
                            className="px-2 py-1 bg-red-950/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded-none md:rounded-xs border border-red-500/30 hover:border-red-500 transition-colors text-[10px] uppercase font-mono tracking-wider"
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
          <div className="bg-[#141416] border border-[#242428] p-6 rounded-none md:rounded-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#242428]">
              <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center">
                <History className="w-4 h-4 mr-2 text-[#ff3e00]" />
                CLIENT ACTIVITY LOGS
              </h2>
            </div>
            
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-thin font-mono text-xs">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-[#88888e] text-center py-4">NO ACTIVITY LOGGED.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log._id} className="flex gap-3 leading-relaxed">
                    <div className="w-1.5 h-1.5 bg-[#ff3e00] rounded-full shrink-0 mt-1.5"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white capitalize">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                        <span className="text-[10px] text-[#88888e]">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-[#88888e] text-[11px] mt-0.5">BY {log.actor}</p>
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-[#141416] border border-red-500/30 rounded-none md:rounded-xs max-w-md w-full p-6 space-y-5 shadow-2xl">
          <div className="space-y-1.5 pb-3 border-b border-[#242428]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <h3 className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider flex items-center">
                <AlertCircle className="w-4 h-4 mr-1.5 text-red-500" />
                SYS::PURGE_CLIENT_RECORD
              </h3>
            </div>
            <p className="text-xs font-mono text-[#88888e]">
              Confirming permanent purge of client <strong>{client.name}</strong> (<code>{client.clientCode}</code>).
            </p>
          </div>

          <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-none md:rounded-xs space-y-2 text-xs font-mono text-red-300">
            <p className="font-semibold text-red-400 uppercase tracking-wider text-[11px]">This action permanently purges:</p>
            <ul className="list-disc list-inside space-y-1 text-red-400/80 text-[11px]">
              <li>Client profile details</li>
              <li>Projects & Project records</li>
              <li>Payments & Payment transactions</li>
              <li>Invoices & invoice metadata</li>
              <li>Telegram connection & username linking</li>
              <li>All active/expired connection tokens</li>
              <li>All associated client activity logs</li>
              <li>Invoice PDF files from Supabase Storage</li>
            </ul>
            <p className="font-semibold text-red-400 mt-2 text-[11px] uppercase tracking-wider">CRITICAL: Irreversible operation.</p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <label htmlFor="client-code-confirm" className="block text-[10px] uppercase text-[#88888e] tracking-wider">
              TYPE <code className="bg-[#0a0a0a] border border-[#242428] px-1.5 py-0.5 rounded-none md:rounded-xs text-[#ff3e00] uppercase font-bold">{client.clientCode}</code> TO CONFIRM:
            </label>
            <input
              id="client-code-confirm"
              type="text"
              value={confirmClientCode}
              onChange={(e) => setConfirmClientCode(e.target.value)}
              placeholder={client.clientCode}
              className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-4 py-2.5 text-white uppercase tracking-widest placeholder-[#55555a] font-mono text-xs focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          <div className="flex gap-3 justify-end text-xs font-mono">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setConfirmClientCode('');
              }}
              className="px-4 py-2.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-[#88888e] hover:text-white rounded-none md:rounded-xs uppercase tracking-wider font-semibold transition-all"
            >
              CANCEL
            </button>
            <button
              onClick={handleDeleteClient}
              disabled={confirmClientCode !== client.clientCode || deleting}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-[#18181b] text-white disabled:text-[#55555a] border border-red-500/30 disabled:border-[#242428] rounded-none md:rounded-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-1.5 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  PURGING...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  CONFIRM PURGE
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Record Payment Modal */}
    {paymentModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-md w-full p-6 space-y-5 shadow-2xl">
          <div className="space-y-1 pb-3 border-b border-[#242428]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center">
                <CreditCard className="w-4 h-4 mr-2 text-[#ff3e00]" />
                SYS::RECORD_PAYMENT
              </h3>
            </div>
            <p className="text-[11px] font-mono text-[#88888e]">
              Record manual transaction and dispatch Telegram receipt.
            </p>
          </div>

          <form onSubmit={handleRecordPayment} className="space-y-4 text-xs font-mono">
            {/* Project selection */}
            <div className="space-y-1.5">
              <label htmlFor="payment-project-select" className="block text-[10px] uppercase tracking-wider text-[#88888e]">Project *</label>
              <select
                id="payment-project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2.5 text-white focus:outline-none focus:border-[#ff3e00] transition-colors"
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
                <div className="p-3.5 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-2 text-[#88888e] text-xs">
                  <div className="flex justify-between">
                    <span className="uppercase text-[10px]">Project Total:</span>
                    <span className="font-bold text-white">
                      {selectedProj.currency} {totalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#00D664]">
                    <span className="uppercase text-[10px]">Already Paid:</span>
                    <span>
                      {selectedProj.currency} {alreadyPaid.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#ff3e00] border-b border-[#242428] pb-2">
                    <span className="uppercase text-[10px]">Outstanding:</span>
                    <span>
                      {selectedProj.currency} {outstanding.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-white">
                    <span className="uppercase text-[10px] text-[#ff3e00]">Remaining Outstanding:</span>
                    <span>
                      {selectedProj.currency} {remaining.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Amount input */}
            <div className="space-y-1.5">
              <label htmlFor="payment-amount-input" className="block text-[10px] uppercase tracking-wider text-[#88888e]">Payment Amount *</label>
              <input
                id="payment-amount-input"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2.5 text-white focus:outline-none focus:border-[#ff3e00] transition-colors font-bold"
                required
                min="0.01"
                step="any"
              />
            </div>

            {/* Payment method & type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="payment-method-select" className="block text-[10px] uppercase tracking-wider text-[#88888e]">Method *</label>
                <select
                  id="payment-method-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
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
                <label htmlFor="payment-type-select" className="block text-[10px] uppercase tracking-wider text-[#88888e]">Type *</label>
                <select
                  id="payment-type-select"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="payment-date-input" className="block text-[10px] uppercase tracking-wider text-[#88888e]">Payment Date *</label>
                <input
                  id="payment-date-input"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="payment-ref-input" className="block text-[10px] uppercase tracking-wider text-[#88888e]">Ref ID</label>
                <input
                  id="payment-ref-input"
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="TXN12345678"
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00] transition-colors"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor="payment-notes-input" className="block text-[10px] uppercase tracking-wider text-[#88888e]">Notes</label>
              <textarea
                id="payment-notes-input"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00] transition-colors h-16 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentModalOpen(false);
                  setPaymentAmount('');
                  setReferenceId('');
                  setPaymentNotes('');
                }}
                className="px-4 py-2.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-[#88888e] hover:text-white rounded-none md:rounded-xs uppercase tracking-wider font-semibold transition-all"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={recordingPayment}
                className="px-4 py-2.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white disabled:bg-[#18181b] disabled:text-[#55555a] rounded-none md:rounded-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-1.5"
              >
                {recordingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    RECORDING...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    RECORD PAYMENT
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-[#242428] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center">
                <Lock className="w-4 h-4 mr-2 text-[#ff3e00]" />
                SYS::NEW_DATA_REQUEST
              </h3>
            </div>
            <button
              onClick={() => setRequestModalOpen(false)}
              className="text-[#88888e] hover:text-white text-xs font-mono uppercase tracking-wider font-semibold"
            >
              CLOSE
            </button>
          </div>

          <form onSubmit={handleCreateRequest} className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Request Type *</label>
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
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2.5 text-white focus:outline-none focus:border-[#ff3e00]"
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
                <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Link to Project (Optional)</label>
                <select
                  value={selectedProjectIdForReq}
                  onChange={(e) => setSelectedProjectIdForReq(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2.5 text-white focus:outline-none focus:border-[#ff3e00]"
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
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Credential Type</label>
                  <select
                    value={credentialType}
                    onChange={(e) => setCredentialType(e.target.value)}
                    className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
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
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1.5">Required Fields</label>
                  <div className="grid grid-cols-2 gap-2 text-[#88888e]">
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
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
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
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
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
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
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
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
              <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Title *</label>
              <input
                type="text"
                required
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="Request title"
                className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Message / Instructions *</label>
              <textarea
                required
                rows={3}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Instructions for the client..."
                className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00] font-sans"
              />
            </div>

            <div className="p-3.5 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-1.5">
              <span className="block text-[10px] uppercase font-bold text-[#ff3e00] font-mono">Telegram Live Preview</span>
              <pre className="text-[10px] text-[#88888e] whitespace-pre-wrap font-mono leading-relaxed bg-[#141416] p-3 rounded-none md:rounded-xs border border-[#242428]">
                {getTelegramPreview()}
              </pre>
            </div>

            <div className="flex gap-3 justify-end font-semibold border-t border-[#242428] pt-3">
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="px-4 py-2.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-[#88888e] hover:text-white rounded-none md:rounded-xs uppercase tracking-wider font-semibold transition-all"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={sendingRequest}
                className="px-4 py-2.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white disabled:bg-[#18181b] disabled:text-[#55555a] rounded-none md:rounded-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-1.5"
              >
                {sendingRequest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SENDING...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    SEND REQUEST
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-[#242428] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                SYS::REQUEST_METRICS: {activeRequest.request.requestId}
              </h3>
            </div>
            <button
              onClick={() => {
                setViewRequestModalOpen(false);
                setDecryptedData(null);
                setDecryptPassword('');
                setDecryptError(null);
              }}
              className="text-[#88888e] hover:text-white text-xs font-mono uppercase tracking-wider font-semibold"
            >
              CLOSE
            </button>
          </div>

          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-[#88888e] uppercase font-bold">Request Title</span>
                <p className="text-white font-semibold mt-0.5">{activeRequest.request.title}</p>
              </div>
              <div>
                <span className="text-[10px] text-[#88888e] uppercase font-bold">Status</span>
                <p className="mt-0.5">
                  <span className={`px-2 py-0.5 rounded-none md:rounded-xs text-[10px] font-semibold ${
                    activeRequest.request.status === 'COMPLETED' ? 'bg-[#00D664]/10 text-[#00D664] border border-[#00D664]/20' :
                    activeRequest.request.status === 'SENT' ? 'bg-blue-950/30 text-blue-400 border border-blue-900/30' :
                    'bg-[#18181b] text-[#88888e] border border-[#242428]'
                  }`}>
                    {activeRequest.request.status}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#88888e] uppercase font-bold">Instructions</span>
              <p className="text-[#88888e] bg-[#0a0a0a] border border-[#242428] p-3 rounded-none md:rounded-xs mt-1 font-sans">
                {activeRequest.request.message}
              </p>
            </div>

            {/* If request is CREDENTIAL */}
            {activeRequest.request.type === 'CREDENTIAL' && activeRequest.credentialMeta && (
              <div className="border-t border-[#242428] pt-4">
                {/* Password Decryption Challenge form */}
                {!decryptedData ? (
                  <form onSubmit={handleDecryptCredential} className="space-y-3">
                    <div className="p-4 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-3">
                      <span className="block text-white font-semibold">🔐 Confirm Admin Password to Decrypt Credentials</span>
                      <p className="text-[#88888e] leading-normal text-[11px]">
                        This credential is encrypted at rest using AES-256-GCM. Confirm your master admin password to authorize decryption.
                      </p>
                      
                      <div className="space-y-1">
                        <input
                          type="password"
                          required
                          value={decryptPassword}
                          onChange={(e) => setDecryptPassword(e.target.value)}
                          placeholder="Master Password"
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                        />
                        {decryptError && <p className="text-red-400 font-medium text-[11px]">{decryptError}</p>}
                      </div>

                      <button
                        type="submit"
                        disabled={decrypting}
                        className="w-full py-2.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white disabled:bg-[#18181b] disabled:text-[#55555a] rounded-none md:rounded-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {decrypting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'AUTHORIZE & DECRYPT'}
                      </button>
                    </div>
                  </form>
                ) : (
                  // Decrypted credentials values view
                  <div className="space-y-3 p-4 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                    <span className="block text-[#00D664] font-bold mb-2 flex items-center">
                      <Check className="w-4 h-4 mr-1" />
                      CREDENTIALS DECRYPTED SUCCESSFULLY
                    </span>

                    {/* Service */}
                    <div className="grid grid-cols-3 items-center gap-2 pb-2 border-b border-[#242428]">
                      <span className="text-[#88888e] font-semibold">Service:</span>
                      <span className="col-span-2 text-white font-bold text-xs">{decryptedData.service}</span>
                    </div>

                    {/* Username */}
                    <div className="grid grid-cols-3 items-center gap-2 pb-2 border-b border-[#242428]">
                      <span className="text-[#88888e] font-semibold">Username:</span>
                      <div className="col-span-2 flex items-center justify-between">
                        <span className="text-white select-all">{decryptedData.username}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(decryptedData.username);
                            logRequestAudit(activeRequest.request._id, 'CREDENTIAL_COPIED');
                            setCopiedFields(prev => ({ ...prev, user: true }));
                            setTimeout(() => setCopiedFields(prev => ({ ...prev, user: false })), 2000);
                          }}
                          className="text-[#88888e] hover:text-white text-[10px] font-semibold border border-[#242428] hover:border-[#ff3e00]/50 bg-[#18181b] px-2 py-0.5 rounded-none md:rounded-xs"
                        >
                          {copiedFields.user ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="grid grid-cols-3 items-center gap-2 pb-2 border-b border-[#242428]">
                      <span className="text-[#88888e] font-semibold">Password:</span>
                      <div className="col-span-2 flex items-center justify-between gap-2">
                        <span className="text-white select-all">
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
                            className="text-[#88888e] hover:text-white text-[10px] font-semibold border border-[#242428] hover:border-[#ff3e00]/50 bg-[#18181b] px-2 py-0.5 rounded-none md:rounded-xs"
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
                            className="text-[#88888e] hover:text-white text-[10px] font-semibold border border-[#242428] hover:border-[#ff3e00]/50 bg-[#18181b] px-2 py-0.5 rounded-none md:rounded-xs"
                          >
                            {copiedFields.pass ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Login URL */}
                    {decryptedData.loginUrl && (
                      <div className="grid grid-cols-3 items-center gap-2 pb-2 border-b border-[#242428]">
                        <span className="text-[#88888e] font-semibold">Login URL:</span>
                        <div className="col-span-2 flex items-center justify-between gap-2">
                          <a
                            href={decryptedData.loginUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#ff3e00] hover:underline overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]"
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
                            className="text-[#88888e] hover:text-white text-[10px] font-semibold border border-[#242428] hover:border-[#ff3e00]/50 bg-[#18181b] px-2 py-0.5 rounded-none md:rounded-xs"
                          >
                            {copiedFields.url ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Additional Info */}
                    {decryptedData.additionalInfo && (
                      <div className="grid grid-cols-3 items-start gap-2 pt-1">
                        <span className="text-[#88888e] font-semibold">Notes:</span>
                        <div className="col-span-2 flex items-start justify-between gap-2">
                          <span className="text-[#88888e] whitespace-pre-wrap font-sans">{decryptedData.additionalInfo}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(decryptedData.additionalInfo);
                              logRequestAudit(activeRequest.request._id, 'CREDENTIAL_COPIED');
                              setCopiedFields(prev => ({ ...prev, notes: true }));
                              setTimeout(() => setCopiedFields(prev => ({ ...prev, notes: false })), 2000);
                            }}
                            className="text-[#88888e] hover:text-white text-[10px] font-semibold border border-[#242428] hover:border-[#ff3e00]/50 bg-[#18181b] px-2 py-0.5 rounded-none md:rounded-xs shrink-0"
                          >
                            {copiedFields.notes ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Share with Team Member button */}
                    <div className="pt-3 mt-3 border-t border-[#242428] flex items-center justify-between">
                      <span className="text-[11px] text-[#88888e]">Share securely with authorized team member:</span>
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none md:rounded-xs bg-white text-black hover:bg-[#ff3e00] hover:text-white text-xs font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>🔐 SHARE VIA TELEGRAM</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* If request is NOT credential (General, text, custom, files) */}
            {activeRequest.request.type !== 'CREDENTIAL' && activeRequest.responseMeta && (
              <div className="border-t border-[#242428] pt-4 space-y-3">
                {activeRequest.responseMeta.responseText && (
                  <div>
                    <span className="text-[10px] text-[#88888e] uppercase font-bold">Client Response Text</span>
                    <p className="text-white bg-[#0a0a0a] border border-[#242428] p-3 rounded-none md:rounded-xs mt-1 leading-relaxed whitespace-pre-wrap select-all">
                      {activeRequest.responseMeta.responseText}
                    </p>
                  </div>
                )}

                {activeRequest.responseMeta.files && activeRequest.responseMeta.files.length > 0 && (
                  <div>
                    <span className="text-[10px] text-[#88888e] uppercase font-bold">Client Uploaded Files</span>
                    <div className="space-y-2 mt-1">
                      {activeRequest.responseMeta.files.map((file: any, index: number) => (
                        <div key={index} className="flex justify-between items-center bg-[#0a0a0a] border border-[#242428] p-3 rounded-none md:rounded-xs">
                          <div className="overflow-hidden">
                            <span className="block text-white font-bold truncate max-w-[280px]">{file.fileName}</span>
                            <span className="text-[10px] text-[#88888e] block mt-0.5">
                              {file.mimeType} | {Math.round(file.size / 1024)} KB
                            </span>
                          </div>
                          {file.downloadUrl && (
                            <a
                              href={file.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] hover:border-[#ff3e00]/50 text-white font-semibold rounded-none md:rounded-xs flex items-center gap-1 transition-colors uppercase tracking-wider text-[11px]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] w-full max-w-lg rounded-none md:rounded-xs p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#ff3e00]" />
                  SYS::ADD_PROJECT: {client.name}
                </h3>
              </div>
              <button
                onClick={() => setAddProjectModalOpen(false)}
                className="text-[#88888e] hover:text-white text-xs font-mono uppercase tracking-wider font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProject} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">
                  Project Name <span className="text-[#ff3e00]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. E-Commerce Store Development"
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Service Type</label>
                  <select
                    value={newProjectServiceType}
                    onChange={(e) => setNewProjectServiceType(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
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
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Currency</label>
                  <select
                    value={newProjectCurrency}
                    onChange={(e) => setNewProjectCurrency(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">
                  Total Budget Amount <span className="text-[#ff3e00]">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={newProjectBudget}
                  onChange={(e) => setNewProjectBudget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newProjectStartDate}
                    onChange={(e) => setNewProjectStartDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Expected Completion</label>
                  <input
                    type="date"
                    value={newProjectEndDate}
                    onChange={(e) => setNewProjectEndDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Description / Scope Notes</label>
                <textarea
                  rows={3}
                  value={newProjectNotes}
                  onChange={(e) => setNewProjectNotes(e.target.value)}
                  placeholder="Project requirements, deliverable milestones..."
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddProjectModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-[#88888e] hover:text-white uppercase tracking-wider font-semibold rounded-none md:rounded-xs text-xs transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={creatingProject}
                  className="flex-1 py-2.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white disabled:bg-[#18181b] disabled:text-[#55555a] font-semibold uppercase tracking-wider rounded-none md:rounded-xs text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  {creatingProject ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      CREATING...
                    </>
                  ) : (
                    'CREATE PROJECT'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deleteProjectModalOpen && projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#141416] border border-red-500/30 w-full max-w-md rounded-none md:rounded-xs p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-[#242428]">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-500" />
                SYS::PURGE_PROJECT: {projectToDelete.name}?
              </h3>
            </div>
            <p className="text-xs text-[#88888e] leading-relaxed">
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
                className="flex-1 py-2.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-[#88888e] hover:text-white font-semibold uppercase tracking-wider rounded-none md:rounded-xs text-xs"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deletingProject}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 border border-red-500/30 text-white font-semibold uppercase tracking-wider rounded-none md:rounded-xs text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                {deletingProject ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    PURGING...
                  </>
                ) : (
                  'CONFIRM PURGE'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Credential to Team Member Modal */}
      {shareModalOpen && activeRequest && activeRequest.credentialMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] w-full max-w-md rounded-none md:rounded-xs p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#242428]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#ff3e00]" />
                  SYS::SHARE_CREDENTIAL_PAYLOAD
                </h3>
              </div>
              <button onClick={() => setShareModalOpen(false)} className="text-[#88888e] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#88888e]">
              Credentials will be decrypted on the server and sent directly to the selected team member&apos;s linked Telegram account.
            </p>

            {shareSuccess && (
              <div className="p-3 bg-[#00D664]/10 border border-[#00D664]/20 rounded-none md:rounded-xs text-[#00D664] text-xs font-semibold">
                {shareSuccess}
              </div>
            )}

            {shareError && (
              <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-none md:rounded-xs text-red-400 text-xs font-semibold">
                {shareError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Select Team Member *</label>
                <select
                  value={selectedTeamMemberId}
                  onChange={(e) => setSelectedTeamMemberId(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
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

              <label className="flex items-center gap-2 cursor-pointer pt-1 text-[#88888e] hover:text-white">
                <input
                  type="checkbox"
                  checked={shareOneTime}
                  onChange={(e) => setShareOneTime(e.target.checked)}
                  className="rounded-none bg-[#0a0a0a] border-[#242428] text-[#ff3e00] focus:ring-0"
                />
                <span className="text-xs">Mark as One-Time / Confidential Credential</span>
              </label>
            </div>

            <div className="flex gap-3 pt-3 border-t border-[#242428]">
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="flex-1 py-2.5 bg-[#18181b] hover:bg-[#242428] border border-[#242428] text-[#88888e] hover:text-white uppercase tracking-wider font-semibold rounded-none md:rounded-xs text-xs cursor-pointer transition-colors"
              >
                CANCEL
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
                className="flex-1 py-2.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white disabled:bg-[#18181b] disabled:text-[#55555a] uppercase tracking-wider font-semibold rounded-none md:rounded-xs text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {sharingCredential ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SENDING...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    DISPATCH
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editProjectModalOpen && projectToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#242428] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]"></span>
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-[#ff3e00]" />
                  SYS::EDIT_PROJECT_PARAMETERS ({projectToEdit.projectCode})
                </h3>
              </div>
              <button
                onClick={() => setEditProjectModalOpen(false)}
                className="text-[#88888e] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editProjectError && (
              <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-none md:rounded-xs text-xs font-mono text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editProjectError}</span>
              </div>
            )}

            <form onSubmit={handleEditProject} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Service Type</label>
                  <select
                    value={editProjectServiceType}
                    onChange={(e) => setEditProjectServiceType(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="WEB_DEVELOPMENT">Web Development</option>
                    <option value="APP_DEVELOPMENT">App Development</option>
                    <option value="UI_UX_DESIGN">UI/UX Design</option>
                    <option value="SEO">SEO</option>
                    <option value="DIGITAL_MARKETING">Digital Marketing</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="CONSULTING">Consulting</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Status</label>
                  <select
                    value={editProjectStatus}
                    onChange={(e) => setEditProjectStatus(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="PENDING_AGREEMENT">Pending Agreement</option>
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="ACTIVE">Active</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Total Amount</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editProjectBudget}
                    onChange={(e) => setEditProjectBudget(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Currency</label>
                  <select
                    value={editProjectCurrency}
                    onChange={(e) => setEditProjectCurrency(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED (AED)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editProjectStartDate}
                    onChange={(e) => setEditProjectStartDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Expected Completion</label>
                  <input
                    type="date"
                    value={editProjectEndDate}
                    onChange={(e) => setEditProjectEndDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Project Scope</label>
                <textarea
                  rows={2}
                  value={editProjectScope}
                  onChange={(e) => setEditProjectScope(e.target.value)}
                  placeholder="Scope of work..."
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#88888e] mb-1">Terms & Conditions</label>
                <textarea
                  rows={2}
                  value={editProjectTerms}
                  onChange={(e) => setEditProjectTerms(e.target.value)}
                  placeholder="Terms for this project..."
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setEditProjectModalOpen(false)}
                  className="px-4 py-2 bg-[#18181b] hover:bg-[#242428] text-[#88888e] hover:text-white uppercase tracking-wider font-semibold rounded-none md:rounded-xs"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={updatingProject}
                  className="px-5 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white rounded-none md:rounded-xs font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  {updatingProject && <Loader2 className="w-4 h-4 animate-spin" />}
                  SAVE CHANGES
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
