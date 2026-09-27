'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  UserCheck,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Edit2,
  Plus,
  Coins,
  CreditCard,
  Eye,
  Send,
  Lock,
  Unlock,
  History,
  UploadCloud,
  ExternalLink,
  FileText,
  Download,
  Trash2,
  X,
  Copy,
  Check,
  FolderKanban,
  CheckSquare,
  ChevronRight,
  User,
  Wallet,
} from 'lucide-react';

export default function TeamMemberWorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const memberId = params.id as string;

  const activeTab = searchParams.get('tab') || 'overview';

  const [member, setMember] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Status / Feedback
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Modals
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [showInspectTaskModal, setShowInspectTaskModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showRevealBankModal, setShowRevealBankModal] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

  // Modal active items
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [generatedTelegramLink, setGeneratedTelegramLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatingTelegramLink, setGeneratingTelegramLink] = useState(false);

  // Reveal Bank state
  const [masterPassword, setMasterPassword] = useState('');
  const [revealingBank, setRevealingBank] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [revealedBankData, setRevealedBankData] = useState<any>(null);
  const [bankCopiedField, setBankCopiedField] = useState<string | null>(null);

  // Edit Member Form State
  const [showBankFields, setShowBankFields] = useState(false);
  const [editMemberForm, setEditMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'DEVELOPER',
    permissions: [] as string[],
    bankDetails: {
      accountHolderName: '',
      bankName: '',
      accountNumber: '',
      ifsc: '',
      upiId: '',
    },
  });
  const [updatingMember, setUpdatingMember] = useState(false);

  // Assign Task Form State
  const [assignTaskForm, setAssignTaskForm] = useState({
    title: '',
    description: '',
    clientId: '',
    projectId: '',
    priority: 'MEDIUM',
    dueDate: '',
    agreedAmount: '',
    requiredCredentialIds: [] as string[],
    autoShareCredentials: false,
    submissionRequired: false,
    submissionTypes: ['url', 'file'] as ('url' | 'file')[],
    maxFileSizeMb: 25,
    submissionInstructions: '',
  });
  const [projectCredentials, setProjectCredentials] = useState<any[]>([]);
  const [assigningTask, setAssigningTask] = useState(false);
  const [assignTaskError, setAssignTaskError] = useState('');

  // Edit Task Form State
  const [editTaskForm, setEditTaskForm] = useState({
    title: '',
    description: '',
    clientId: '',
    projectId: '',
    priority: 'MEDIUM',
    dueDate: '',
    agreedAmount: '',
    requiredCredentialIds: [] as string[],
    autoShareCredentials: false,
    submissionRequired: false,
    submissionTypes: ['url', 'file'] as ('url' | 'file')[],
    maxFileSizeMb: 25,
    submissionInstructions: '',
  });
  const [updatingTask, setUpdatingTask] = useState(false);
  const [editTaskError, setEditTaskError] = useState('');

  // Record Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    taskId: '',
    projectId: '',
    amount: '',
    currency: 'INR',
    paymentMethod: 'UPI',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    status: 'PAID',
  });
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const availablePermissions = [
    { id: 'VIEW_PROJECT', label: 'View Project Details' },
    { id: 'VIEW_TASKS', label: 'View & Update Tasks' },
    { id: 'MANAGE_TASKS', label: 'Create & Assign Tasks' },
    { id: 'VIEW_CREDENTIALS', label: 'Access Project Credentials (Sensitive)' },
    { id: 'REQUEST_CREDENTIALS', label: 'Request Client Data/Credentials' },
    { id: 'VIEW_CLIENT', label: 'View Client Info' },
    { id: 'MANAGE_PROJECT', label: 'Manage Projects' },
  ];

  const fetchMemberWorkspace = async () => {
    try {
      setLoading(true);
      const [memberRes, tasksRes, clientsRes, projectsRes] = await Promise.all([
        fetch(`/api/team-members/${memberId}`),
        fetch(`/api/tasks?assignedTo=${memberId}`),
        fetch('/api/clients?limit=500'),
        fetch('/api/projects'),
      ]);

      const [memberData, tasksData, clientsData, projectsData] = await Promise.all([
        memberRes.json(),
        tasksRes.json(),
        clientsRes.json(),
        projectsRes.json(),
      ]);

      if (memberData.success && memberData.data) {
        setMember(memberData.data);
        setPayments(memberData.data.payments || []);
        setAuditLogs(memberData.data.auditLogs || []);
      }
      if (tasksData.success) {
        setTasks(tasksData.data || []);
      }
      if (clientsData.success) {
        setClients(clientsData.clients || clientsData.data?.clients || clientsData.data || []);
      }
      if (projectsData.success) {
        setProjects(projectsData.data || []);
      }
    } catch (err) {
      console.error('Failed to load team member workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memberId) {
      fetchMemberWorkspace();
    }
  }, [memberId]);

  const setTab = (tab: string) => {
    router.push(`/dashboard/team/${memberId}?tab=${tab}`);
  };

  // Helper to load credentials for project
  const loadProjectCredentials = async (projId: string) => {
    if (!projId) {
      setProjectCredentials([]);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projId}/credentials`);
      const data = await res.json();
      if (data.success) {
        setProjectCredentials(data.data || []);
      } else {
        setProjectCredentials([]);
      }
    } catch {
      setProjectCredentials([]);
    }
  };

  // Open Edit Member Modal
  const handleOpenEditMember = () => {
    if (!member) return;
    setEditMemberForm({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      role: member.role || 'DEVELOPER',
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
    setShowEditMemberModal(true);
  };

  // Submit Member Edits
  const handleEditMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingMember(true);
      const payload: any = {
        name: editMemberForm.name,
        email: editMemberForm.email,
        phone: editMemberForm.phone || undefined,
        role: editMemberForm.role,
        permissions: editMemberForm.permissions,
      };

      if (
        editMemberForm.bankDetails.accountHolderName ||
        editMemberForm.bankDetails.accountNumber ||
        editMemberForm.bankDetails.ifsc ||
        editMemberForm.bankDetails.upiId
      ) {
        payload.bankDetails = {
          accountHolderName: editMemberForm.bankDetails.accountHolderName || undefined,
          bankName: editMemberForm.bankDetails.bankName || undefined,
          accountNumber: editMemberForm.bankDetails.accountNumber || undefined,
          ifsc: editMemberForm.bankDetails.ifsc || undefined,
          upiId: editMemberForm.bankDetails.upiId || undefined,
        };
      }

      const res = await fetch(`/api/team-members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setShowEditMemberModal(false);
        setBannerSuccess('Team member details updated successfully!');
        setTimeout(() => setBannerSuccess(null), 3500);
        fetchMemberWorkspace();
      } else {
        alert(data.error?.message || 'Failed to update member');
      }
    } catch (err) {
      console.error('Error updating member:', err);
    } finally {
      setUpdatingMember(false);
    }
  };

  // Toggle Member Activation
  const handleToggleDeactivate = async () => {
    if (!member) return;
    const isActivating = member.status === 'DEACTIVATED';
    const actionText = isActivating ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${actionText} ${member.name}?`)) return;

    try {
      const res = await fetch(`/api/team-members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: isActivating ? 'ACTIVE' : 'DEACTIVATED' }),
      });
      const data = await res.json();
      if (data.success) {
        setBannerSuccess(`Team member successfully ${isActivating ? 'activated' : 'deactivated'}.`);
        setTimeout(() => setBannerSuccess(null), 3500);
        fetchMemberWorkspace();
      } else {
        alert(data.error?.message || 'Failed to update member status');
      }
    } catch (err) {
      console.error('Error updating member status:', err);
    }
  };

  // Open Assign Task Modal (Preselected & locked to this member)
  const handleOpenAssignTask = () => {
    setAssignTaskForm({
      title: '',
      description: '',
      clientId: '',
      projectId: '',
      priority: 'MEDIUM',
      dueDate: '',
      agreedAmount: '',
      requiredCredentialIds: [],
      autoShareCredentials: false,
      submissionRequired: false,
      submissionTypes: ['url', 'file'],
      maxFileSizeMb: 25,
      submissionInstructions: '',
    });
    setAssignTaskError('');
    setProjectCredentials([]);
    setShowAssignTaskModal(true);
  };

  // Submit Assign Task (Strictly respects Client -> Project -> Task -> Member)
  const handleAssignTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTaskForm.title || !assignTaskForm.projectId) {
      setAssignTaskError('Title and Project are required');
      return;
    }

    try {
      setAssigningTask(true);
      setAssignTaskError('');

      const payload: any = {
        title: assignTaskForm.title,
        description: assignTaskForm.description,
        clientId: assignTaskForm.clientId || undefined,
        projectId: assignTaskForm.projectId,
        assignedTo: memberId, // Preselected & locked to this Team Member
        priority: assignTaskForm.priority,
        dueDate: assignTaskForm.dueDate || undefined,
        agreedAmount: assignTaskForm.agreedAmount ? Number(assignTaskForm.agreedAmount) : undefined,
        requiredCredentialIds: assignTaskForm.requiredCredentialIds,
        autoShareCredentials: assignTaskForm.autoShareCredentials,
        submissionRequired: assignTaskForm.submissionRequired,
        submissionTypes: assignTaskForm.submissionTypes,
        maxFileSizeMb: Number(assignTaskForm.maxFileSizeMb) || 25,
        submissionInstructions: assignTaskForm.submissionInstructions,
      };

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setShowAssignTaskModal(false);
        setBannerSuccess(`Task "${assignTaskForm.title}" assigned to ${member.name}!`);
        setTimeout(() => setBannerSuccess(null), 4000);
        fetchMemberWorkspace();
      } else {
        setAssignTaskError(data.error?.message || 'Failed to assign task');
      }
    } catch (err: any) {
      setAssignTaskError('Failed to communicate with server');
    } finally {
      setAssigningTask(false);
    }
  };

  // Open Edit Task Modal
  const handleOpenEditTask = (task: any) => {
    setSelectedTask(task);
    setEditTaskError('');
    const pId = task.projectId?._id ? String(task.projectId._id) : (task.projectId ? String(task.projectId) : '');
    const cId = task.clientId?._id
      ? String(task.clientId._id)
      : (task.clientId ? String(task.clientId) : (task.projectId?.clientId?._id ? String(task.projectId.clientId._id) : (task.projectId?.clientId ? String(task.projectId.clientId) : '')));

    setEditTaskForm({
      title: task.title || '',
      description: task.description || '',
      clientId: cId,
      projectId: pId,
      priority: task.priority || 'MEDIUM',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      agreedAmount: task.agreedAmount ? String(task.agreedAmount) : '',
      requiredCredentialIds: (task.requiredCredentialIds || []).map((c: any) => (typeof c === 'object' ? c._id : c)),
      autoShareCredentials: !!task.autoShareCredentials,
      submissionRequired: !!task.submissionRequired,
      submissionTypes: task.submissionTypes || ['url', 'file'],
      maxFileSizeMb: task.maxFileSizeMb || 25,
      submissionInstructions: task.submissionInstructions || '',
    });

    if (pId) {
      loadProjectCredentials(pId);
    }
    setShowEditTaskModal(true);
  };

  // Submit Edit Task
  const handleEditTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      setUpdatingTask(true);
      setEditTaskError('');

      const payload: any = {
        title: editTaskForm.title,
        description: editTaskForm.description,
        clientId: editTaskForm.clientId || undefined,
        projectId: editTaskForm.projectId,
        priority: editTaskForm.priority,
        dueDate: editTaskForm.dueDate || null,
        agreedAmount: editTaskForm.agreedAmount ? Number(editTaskForm.agreedAmount) : undefined,
        requiredCredentialIds: editTaskForm.requiredCredentialIds,
        autoShareCredentials: editTaskForm.autoShareCredentials,
        submissionRequired: editTaskForm.submissionRequired,
        submissionTypes: editTaskForm.submissionTypes,
        maxFileSizeMb: Number(editTaskForm.maxFileSizeMb) || 25,
        submissionInstructions: editTaskForm.submissionInstructions,
      };

      const res = await fetch(`/api/tasks/${selectedTask._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setShowEditTaskModal(false);
        setBannerSuccess(`Task "${editTaskForm.title}" updated successfully!`);
        setTimeout(() => setBannerSuccess(null), 3500);
        fetchMemberWorkspace();
      } else {
        setEditTaskError(data.error?.message || 'Failed to update task');
      }
    } catch {
      setEditTaskError('Failed to communicate with server');
    } finally {
      setUpdatingTask(false);
    }
  };

  // Direct Task Status Change (Admin Lifecycle Management)
  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setBannerSuccess(`Task status updated to ${newStatus}`);
        setTimeout(() => setBannerSuccess(null), 3000);
        fetchMemberWorkspace();
      } else {
        alert(data.error?.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setBannerSuccess('Task deleted successfully');
        setTimeout(() => setBannerSuccess(null), 3000);
        fetchMemberWorkspace();
      } else {
        alert(data.error?.message || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Open Record Payment Modal
  const handleOpenRecordPayment = (task?: any) => {
    const defaultProjId = task?.projectId?._id || task?.projectId || member?.assignedProjects?.[0]?._id || projects[0]?._id || '';
    setPaymentForm({
      taskId: task?._id || '',
      projectId: defaultProjId,
      amount: task?.agreedAmount ? String(task.agreedAmount) : '',
      currency: 'INR',
      paymentMethod: 'UPI',
      paymentDate: new Date().toISOString().split('T')[0],
      reference: '',
      description: task ? `Payment for task: ${task.title}` : `Payment to ${member?.name}`,
      status: 'PAID',
    });
    setPaymentError('');
    setShowRecordPaymentModal(true);
  };

  // Submit Payment Record
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.projectId || !paymentForm.amount) {
      setPaymentError('Project and Amount are required');
      return;
    }

    try {
      setRecordingPayment(true);
      setPaymentError('');

      const res = await fetch('/api/team-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamMemberId: memberId,
          projectId: paymentForm.projectId,
          taskId: paymentForm.taskId || undefined,
          amount: Number(paymentForm.amount),
          currency: paymentForm.currency,
          paymentMethod: paymentForm.paymentMethod,
          paymentDate: paymentForm.paymentDate,
          reference: paymentForm.reference || undefined,
          description: paymentForm.description || undefined,
          status: paymentForm.status,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowRecordPaymentModal(false);
        setBannerSuccess(`Payment of ₹${paymentForm.amount} recorded for ${member.name}!`);
        setTimeout(() => setBannerSuccess(null), 4000);
        fetchMemberWorkspace();
      } else {
        setPaymentError(data.error?.message || 'Failed to record payment');
      }
    } catch {
      setPaymentError('Failed to communicate with server');
    } finally {
      setRecordingPayment(false);
    }
  };

  // Generate Telegram Connection Link
  const handleGenerateTelegramLink = async () => {
    try {
      setGeneratingTelegramLink(true);
      const res = await fetch(`/api/team-members/${memberId}/connect`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedTelegramLink(data.data.link);
        setShowTelegramModal(true);
      } else {
        alert(data.error?.message || 'Failed to generate Telegram connection link');
      }
    } catch (err) {
      console.error('Error generating link:', err);
    } finally {
      setGeneratingTelegramLink(false);
    }
  };

  // Reveal Bank Details
  const handleRevealBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;

    try {
      setRevealingBank(true);
      setRevealError('');
      const res = await fetch(`/api/team-members/${memberId}/reveal-bank`, {
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
    } catch {
      setRevealError('Failed to communicate with server.');
    } finally {
      setRevealingBank(false);
    }
  };

  // Download Submission File via Signed URL
  const handleDownloadFile = async (taskId: string, fileIndex: number, historyIndex?: number) => {
    try {
      const url = `/api/tasks/${taskId}/submissions/files/${fileIndex}/signed-url${
        historyIndex !== undefined ? `?historyIndex=${historyIndex}` : ''
      }`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data?.signedUrl) {
        window.open(data.data.signedUrl, '_blank');
      } else {
        alert(data.error?.message || 'Failed to generate download URL');
      }
    } catch {
      alert('Error fetching file download link');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-[#141416] border border-[#242428] animate-pulse rounded-none md:rounded-xs" />
        <div className="h-44 w-full bg-[#141416] border border-[#242428] animate-pulse rounded-none md:rounded-xs" />
        <div className="h-72 w-full bg-[#141416] border border-[#242428] animate-pulse rounded-none md:rounded-xs" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center p-12 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs">
        <User className="w-10 h-10 text-[#4a4a52] stroke-1 mx-auto mb-3" />
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#f5f5f2]">Team Member Not Found</h3>
        <p className="text-xs text-[#8a8a93] mt-1 font-mono">The requested team member does not exist or was deleted.</p>
        <Link
          href="/dashboard/team"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#ff3e00] hover:underline font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Team Members</span>
        </Link>
      </div>
    );
  }

  // Calculate task summary directly from member's assigned tasks
  const stats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'TODO').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    review: tasks.filter((t) => t.status === 'REVIEW').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    totalPaid: payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    pendingPayments: payments.filter((p) => p.status === 'PENDING').length,
  };

  const priorityBadges: Record<string, { label: string; color: string }> = {
    LOW: { label: 'LOW', color: 'text-[#8a8a93] border-[#27272a] bg-[#141416]' },
    MEDIUM: { label: 'MEDIUM', color: 'text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/10' },
    HIGH: { label: 'HIGH', color: 'text-[#f59e0b] border-[#f59e0b]/30 bg-[#f59e0b]/10' },
    URGENT: { label: 'URGENT', color: 'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10' },
  };

  const statusOptions = [
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'REVIEW', label: 'Under Review' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs font-mono text-[#8a8a93]">
        <Link href="/dashboard/team" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Team Members</span>
        </Link>
        <span>/</span>
        <span className="text-white font-semibold">{member.name}</span>
      </div>

      {/* Notifications */}
      {bannerSuccess && (
        <div className="p-3 bg-[#0e1f15] border border-[#00d664]/40 text-[#00d664] text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{bannerSuccess}</span>
        </div>
      )}

      {/* Profile Header & Quick Actions */}
      <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs p-5 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#0a0a0a] border border-[#242428] flex items-center justify-center text-[#ff3e00] font-bold text-lg font-mono shrink-0">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg md:text-xl font-bold text-white font-mono">{member.name}</h1>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border bg-[#18181b] border-[#242428] text-[#8a8a93]">
                  {member.role}
                </span>
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border ${
                    member.status === 'ACTIVE'
                      ? 'bg-[#0e1f15] border-[#00d664]/30 text-[#00d664]'
                      : 'bg-[#1c1408] border-[#f59e0b]/30 text-[#f59e0b]'
                  }`}
                >
                  {member.status}
                </span>
                {member.telegramConnected ? (
                  <span className="text-[10px] font-mono text-[#00D664] bg-[#00D664]/10 border border-[#00D664]/30 px-2 py-0.5 flex items-center gap-1">
                    <Send className="w-2.5 h-2.5" />
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-[#88888e] bg-[#18181b] border border-[#242428] px-2 py-0.5 flex items-center gap-1">
                    <Send className="w-2.5 h-2.5" />
                    <span>Unlinked</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-[#8a8a93] flex-wrap pt-1">
                <span className="flex items-center gap-1 text-[#e4e4e7]">
                  <Mail className="w-3.5 h-3.5 text-[#ff3e00]" />
                  <span>{member.email}</span>
                </span>
                {member.phone && (
                  <span className="flex items-center gap-1 text-[#e4e4e7]">
                    <Phone className="w-3.5 h-3.5 text-[#8a8a93]" />
                    <span>{member.phone}</span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-[#6b6b76]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Joined {new Date(member.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={handleOpenEditMember}
              className="crm-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#ff3e00]" />
              <span>Edit Member</span>
            </button>

            <button
              onClick={handleOpenAssignTask}
              className="crm-btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#ff3e00]" />
              <span>+ Assign Task</span>
            </button>

            <button
              onClick={handleGenerateTelegramLink}
              disabled={generatingTelegramLink}
              className="crm-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span>{generatingTelegramLink ? 'Generating...' : 'Telegram Link'}</span>
            </button>

            {!member.isPrimaryAdmin && (
              <button
                onClick={handleToggleDeactivate}
                className={`px-3 py-1.5 text-xs font-mono border transition-colors cursor-pointer ${
                  member.status === 'ACTIVE'
                    ? 'border-[#f59e0b]/40 text-[#f59e0b] hover:bg-[#f59e0b]/10'
                    : 'border-[#00D664]/40 text-[#00D664] hover:bg-[#00D664]/10'
                }`}
              >
                {member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#242428] overflow-x-auto pb-px text-xs font-mono">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'tasks', label: `Tasks (${stats.total})` },
          { id: 'payments', label: `Payments (${payments.length})` },
          { id: 'bank', label: 'Bank Details' },
          { id: 'telegram', label: 'Telegram' },
          { id: 'activity', label: `Activity (${auditLogs.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`px-4 py-2.5 font-semibold transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[#ff3e00] text-white bg-[#141416]/50'
                : 'border-transparent text-[#8a8a93] hover:text-white hover:border-[#38383e]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Task Status Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
            <div className="bg-[#141416] border border-[#242428] p-4">
              <span className="text-[#88888e] text-[10px] uppercase tracking-wider block">Total Tasks</span>
              <span className="text-xl font-bold text-white mt-1 block">{stats.total}</span>
            </div>
            <div className="bg-[#141416] border border-[#242428] p-4">
              <span className="text-[#88888e] text-[10px] uppercase tracking-wider block">To Do</span>
              <span className="text-xl font-bold text-white mt-1 block">{stats.todo}</span>
            </div>
            <div className="bg-[#141416] border border-[#242428] p-4">
              <span className="text-[#3b82f6] text-[10px] uppercase tracking-wider block">In Progress</span>
              <span className="text-xl font-bold text-[#3b82f6] mt-1 block">{stats.inProgress}</span>
            </div>
            <div className="bg-[#141416] border border-[#242428] p-4">
              <span className="text-[#f59e0b] text-[10px] uppercase tracking-wider block">In Review</span>
              <span className="text-xl font-bold text-[#f59e0b] mt-1 block">{stats.review}</span>
            </div>
            <div className="bg-[#141416] border border-[#242428] p-4">
              <span className="text-[#00D664] text-[10px] uppercase tracking-wider block">Completed</span>
              <span className="text-xl font-bold text-[#00D664] mt-1 block">{stats.completed}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Tasks */}
            <div className="lg:col-span-2 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white font-bold flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-[#ff3e00]" />
                  <span>Recent Assigned Tasks</span>
                </h3>
                <button
                  onClick={() => setTab('tasks')}
                  className="text-xs font-mono text-[#ff3e00] hover:underline flex items-center gap-1"
                >
                  <span>View All ({stats.total})</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="py-8 text-center text-[#88888e] font-mono text-xs">
                  No tasks currently assigned to {member.name}.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tasks.slice(0, 5).map((task) => (
                    <div
                      key={task._id}
                      className="p-3 bg-[#0a0a0a] border border-[#242428] hover:border-[#38383e] flex items-center justify-between gap-3 text-xs font-mono transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-[11px]">{task.taskCode}</span>
                          <span className="text-white truncate font-medium">{task.title}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 border ${
                              priorityBadges[task.priority]?.color || 'text-white border-[#242428]'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[#88888e] text-[11px]">
                          <span>{task.projectId?.name || 'Project'}</span>
                          {task.dueDate && (
                            <span>Due: {new Date(task.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                          )}
                          {task.submission && (
                            <span className="text-[#00D664] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Submitted</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedTask(task);
                            setShowInspectTaskModal(true);
                          }}
                          className="px-2.5 py-1 text-[11px] bg-[#141416] border border-[#242428] text-[#88888e] hover:text-white transition-colors cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial & Telegram Snapshot */}
            <div className="space-y-6">
              {/* Financial Snapshot */}
              <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#242428]">
                  <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-[#00D664]" />
                    <span>Compensation Snapshot</span>
                  </h3>
                  <button onClick={() => setTab('payments')} className="text-[#ff3e00] hover:underline text-[11px]">
                    History →
                  </button>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[#88888e]">Total Paid Out:</span>
                    <span className="text-[#00D664] font-bold text-sm">₹{stats.totalPaid.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#88888e]">Pending Payments:</span>
                    <span className="text-white font-bold">{stats.pendingPayments}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenRecordPayment()}
                  className="w-full mt-2 crm-btn-secondary py-1.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer text-[#00D664]"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>+ Record Payment</span>
                </button>
              </div>

              {/* Telegram Snapshot */}
              <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#242428]">
                  <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-[#3b82f6]" />
                    <span>Telegram Identity</span>
                  </h3>
                  <button onClick={() => setTab('telegram')} className="text-[#ff3e00] hover:underline text-[11px]">
                    Manage →
                  </button>
                </div>
                <div className="space-y-1.5 text-[#88888e] text-[11px]">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={member.telegramConnected ? 'text-[#00D664]' : 'text-[#88888e]'}>
                      {member.telegramConnected ? 'Active Connection' : 'Unlinked'}
                    </span>
                  </div>
                  {member.telegramUsername && (
                    <div className="flex justify-between">
                      <span>Username:</span>
                      <span className="text-white">@{member.telegramUsername}</span>
                    </div>
                  )}
                  {member.telegramUserId && (
                    <div className="flex justify-between">
                      <span>User ID:</span>
                      <span className="text-white">{member.telegramUserId}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141416] border border-[#242428] p-4">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                Tasks Assigned to {member.name} ({tasks.length})
              </h2>
              <p className="text-[11px] font-mono text-[#88888e] mt-0.5">
                Centralized task lifecycle, review submissions, and track deliverables.
              </p>
            </div>
            <button
              onClick={handleOpenAssignTask}
              className="crm-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-[#ff3e00]" />
              <span>+ Assign New Task</span>
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center p-12 bg-[#141416] border border-[#242428] space-y-3">
              <CheckSquare className="w-10 h-10 text-[#4a4a52] stroke-1 mx-auto" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">No tasks assigned</h3>
              <p className="text-xs text-[#8a8a93] font-mono">Click "+ Assign New Task" above to assign work to {member.name}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const pBadge = priorityBadges[task.priority] || priorityBadges.MEDIUM;
                const isRevoked = !!task.credentialAccessRevoked;
                const requiredCreds = task.requiredCredentialIds?.length || 0;

                return (
                  <div
                    key={task._id}
                    className="bg-[#141416] border border-[#242428] hover:border-[#38383e] p-5 space-y-4 transition-colors font-mono text-xs"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-white bg-[#0a0a0a] border border-[#242428] px-2 py-0.5">
                            {task.taskCode}
                          </span>
                          <h3 className="text-sm font-semibold text-white truncate">{task.title}</h3>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border ${pBadge.color}`}>
                            {pBadge.label}
                          </span>
                          {task.submission ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-[#0e1f15] border-[#00d664]/40 text-[#00d664] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-[#00d664]" />
                              <span>SUBMISSION RECEIVED</span>
                            </span>
                          ) : task.submissionRequired ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-[#1c1408] border-[#f59e0b]/40 text-[#f59e0b] flex items-center gap-1">
                              <UploadCloud className="w-3 h-3 text-[#f59e0b]" />
                              <span>DELIVERABLE REQ</span>
                            </span>
                          ) : null}
                          {task.agreedAmount ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-[#0e1f15] border-[#00d664]/30 text-[#00d664]">
                              ₹{task.agreedAmount.toLocaleString('en-IN')}
                            </span>
                          ) : null}
                        </div>

                        {task.description && (
                          <p className="text-[#88888e] line-clamp-1">{task.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-[#88888e] text-[11px] pt-1 flex-wrap">
                          {task.clientId && (
                            <span className="flex items-center gap-1 text-[#f5f5f2]">
                              <User className="w-3 h-3 text-[#8a8a93]" />
                              <span>{task.clientId?.name || 'Client'}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[#f5f5f2]">
                            <FolderKanban className="w-3 h-3 text-[#ff3e00]" />
                            <span>{task.projectId?.name || 'Project'}</span>
                          </span>
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#6b6b76]" />
                              <span>Due: {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Task Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          onClick={() => {
                            setSelectedTask(task);
                            setShowInspectTaskModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0a0a0a] border border-[#242428] text-[#88888e] hover:text-white transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#ff3e00]" />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditTask(task)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0a0a0a] border border-[#242428] text-[#88888e] hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#ff3e00]" />
                          <span>Edit</span>
                        </button>

                        {task.submission && (
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowSubmissionModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0e1f15] border border-[#00d664]/40 text-[#00d664] hover:bg-[#00d664]/20 transition-colors cursor-pointer"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Submission</span>
                          </button>
                        )}

                        <select
                          value={task.status}
                          onChange={(e) => handleTaskStatusChange(task._id, e.target.value)}
                          className="px-2.5 py-1.5 bg-[#0a0a0a] border border-[#242428] text-white focus:outline-none focus:border-[#ff3e00] cursor-pointer"
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-[#0a0a0a] text-white">
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-1.5 text-[#88888e] hover:text-[#EF4444] transition-colors cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom row: Payment + Submission overview */}
                    <div className="pt-3 border-t border-[#242428] flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        {requiredCreds > 0 && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[11px] ${
                            isRevoked
                              ? 'bg-[#18181b] border-[#242428] text-[#88888e]'
                              : 'bg-[#ff3e00]/10 border-[#ff3e00]/30 text-[#ff3e00]'
                          }`}>
                            <Lock className="w-3 h-3" />
                            <span>{requiredCreds} Credential{requiredCreds > 1 ? 's' : ''}</span>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenRecordPayment(task)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#00D664]/10 hover:bg-[#00D664]/20 border border-[#00D664]/30 text-[#00D664] font-semibold cursor-pointer"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>+ Record Payment</span>
                      </button>
                    </div>

                    {/* Deliverables Preview if submitted */}
                    {task.submission && (
                      <div className="p-3 bg-[#0a0a0a] border border-[#242428] space-y-2 text-[11px]">
                        <div className="flex justify-between items-center text-[#88888e] pb-1.5 border-b border-[#242428]">
                          <span>Deliverables submitted by <b className="text-white">{task.submission.submittedBy}</b></span>
                          <span>{new Date(task.submission.submittedAt).toLocaleString('en-IN')}</span>
                        </div>
                        {task.submission.submissionNotes && (
                          <p className="text-[#e4e4e7] whitespace-pre-wrap">{task.submission.submissionNotes}</p>
                        )}
                        {task.submission.submissionUrls && task.submission.submissionUrls.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-[#88888e] uppercase">URLs:</span>
                            {task.submission.submissionUrls.map((u: string, idx: number) => (
                              <a key={idx} href={u} target="_blank" rel="noopener noreferrer" className="block text-[#ff3e00] hover:underline truncate">
                                {u}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141416] border border-[#242428] p-4">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                Compensation & Payments ({payments.length})
              </h2>
              <p className="text-[11px] font-mono text-[#88888e] mt-0.5">
                Total Paid: <b className="text-[#00D664]">₹{stats.totalPaid.toLocaleString('en-IN')}</b> • Pending: <b className="text-white">{stats.pendingPayments}</b>
              </p>
            </div>
            <button
              onClick={() => handleOpenRecordPayment()}
              className="crm-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Coins className="w-4 h-4 text-[#ff3e00]" />
              <span>+ Record Payment</span>
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="text-center p-12 bg-[#141416] border border-[#242428]">
              <Wallet className="w-10 h-10 text-[#4a4a52] stroke-1 mx-auto mb-3" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">No payment records</h3>
              <p className="text-xs text-[#8a8a93] font-mono mt-1">No payments have been recorded for {member.name} yet.</p>
            </div>
          ) : (
            <div className="bg-[#141416] border border-[#242428] overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#242428] text-[10px] text-[#88888e] uppercase">
                    <th className="p-3">Payment #</th>
                    <th className="p-3">Project</th>
                    <th className="p-3">Task</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242428]">
                  {payments.map((p) => (
                    <tr key={p._id} className="hover:bg-[#18181b] transition-colors">
                      <td className="p-3 font-bold text-white">{p.paymentNumber}</td>
                      <td className="p-3 text-[#e4e4e7]">{p.projectId?.name || 'N/A'}</td>
                      <td className="p-3 text-[#88888e] truncate max-w-xs">{p.taskId?.title || 'General Payout'}</td>
                      <td className="p-3 font-bold text-[#00D664]">₹{p.amount.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-[#88888e]">{p.paymentMethod}</td>
                      <td className="p-3 text-[#88888e]">
                        {new Date(p.paymentDate || p.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[9px] px-2 py-0.5 border ${
                            p.status === 'PAID'
                              ? 'bg-[#0e1f15] border-[#00d664]/30 text-[#00d664]'
                              : 'bg-[#1c1408] border-[#f59e0b]/30 text-[#f59e0b]'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-[#88888e] truncate max-w-xs">{p.reference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BANK DETAILS */}
      {activeTab === 'bank' && (
        <div className="space-y-4 max-w-2xl font-mono text-xs">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div>
                <h2 className="text-xs uppercase tracking-wider text-white font-bold flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-[#ff3e00]" />
                  <span>Configured Banking & Payout Credentials</span>
                </h2>
                <p className="text-[11px] text-[#88888e] mt-0.5">
                  Protected with AES-256-GCM encryption. Requires master password to reveal.
                </p>
              </div>
              <button
                onClick={handleOpenEditMember}
                className="crm-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#ff3e00]" />
                <span>Update</span>
              </button>
            </div>

            {member.bankDetails?.isComplete ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#0a0a0a] border border-[#242428]">
                  <div>
                    <span className="text-[10px] text-[#88888e] uppercase block">Account Holder</span>
                    <span className="text-white font-bold">{member.bankDetails.accountHolderName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#88888e] uppercase block">Bank Name</span>
                    <span className="text-white font-bold">{member.bankDetails.bankName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#88888e] uppercase block">Account Number</span>
                    <span className="text-[#00D664] font-bold">
                      {member.bankDetails.accountNumberMasked || '•••• CONFIGURED'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#88888e] uppercase block">IFSC Code</span>
                    <span className="text-white">{member.bankDetails.ifscMasked || '•••• CONFIGURED'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#88888e] uppercase block">UPI ID</span>
                    <span className="text-white">{member.bankDetails.upiIdMasked || '•••• CONFIGURED'}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setMasterPassword('');
                      setRevealError('');
                      setRevealedBankData(null);
                      setShowRevealBankModal(true);
                    }}
                    className="crm-btn-secondary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer text-[#00D664]"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Reveal Full Decrypted Bank Details</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-[#88888e] space-y-2">
                <CreditCard className="w-8 h-8 mx-auto text-[#4a4a52]" />
                <p>No banking details currently configured for {member.name}.</p>
                <button
                  onClick={handleOpenEditMember}
                  className="crm-btn-secondary px-3.5 py-1.5 text-xs text-[#ff3e00] cursor-pointer"
                >
                  + Add Bank Details
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: TELEGRAM */}
      {activeTab === 'telegram' && (
        <div className="space-y-4 max-w-2xl font-mono text-xs">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div>
                <h2 className="text-xs uppercase tracking-wider text-white font-bold flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-[#3b82f6]" />
                  <span>Telegram Bot Integration</span>
                </h2>
                <p className="text-[11px] text-[#88888e] mt-0.5">
                  Enables push notifications, task assignments, deliverables submissions, and credential sharing.
                </p>
              </div>
              <button
                onClick={handleGenerateTelegramLink}
                disabled={generatingTelegramLink}
                className="crm-btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{generatingTelegramLink ? 'Generating...' : 'Generate Connection Link'}</span>
              </button>
            </div>

            <div className="p-4 bg-[#0a0a0a] border border-[#242428] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#88888e]">Connection Status:</span>
                <span className={member.telegramConnected ? 'text-[#00D664] font-bold' : 'text-[#88888e]'}>
                  {member.telegramConnected ? 'CONNECTED' : 'DISCONNECTED / UNLINKED'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#88888e]">Telegram Username:</span>
                <span className="text-white">{member.telegramUsername ? `@${member.telegramUsername}` : 'Not Linked'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#88888e]">Telegram User ID:</span>
                <span className="text-white">{member.telegramUserId || 'Not Linked'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#88888e]">Telegram Chat ID:</span>
                <span className="text-white">{member.telegramChatId || 'Not Linked'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="space-y-4 max-w-3xl font-mono text-xs">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs p-5 space-y-4">
            <h2 className="text-xs uppercase tracking-wider text-white font-bold flex items-center gap-1.5 pb-3 border-b border-[#242428]">
              <History className="w-4 h-4 text-[#ff3e00]" />
              <span>Audit History & Activity Timeline ({auditLogs.length})</span>
            </h2>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-[#88888e]">No recorded activity events for this member yet.</div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log._id} className="p-3 bg-[#0a0a0a] border border-[#242428] space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-[#88888e]">
                      <span className="text-[#ff3e00] font-bold">{log.action}</span>
                      <span>{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-[#e4e4e7] text-[11px]">Actor: {log.actor}</p>
                    {log.metadata && (
                      <div className="text-[10px] text-[#88888e] pt-1">
                        {Object.entries(log.metadata)
                          .filter(([k]) => !['_id', '__v'].includes(k))
                          .map(([key, val]) => (
                            <span key={key} className="mr-3">
                              {key}: <b className="text-white">{String(val)}</b>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Edit Member Modal */}
      {showEditMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-5 my-8 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::TEAM // EDIT_MEMBER</span>
              </div>
              <button
                onClick={() => setShowEditMemberModal(false)}
                className="p-1 text-[#88888e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editMemberForm.name}
                  onChange={(e) => setEditMemberForm({ ...editMemberForm, name: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editMemberForm.email}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, email: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Phone</label>
                  <input
                    type="text"
                    value={editMemberForm.phone}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, phone: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Role</label>
                <select
                  value={editMemberForm.role}
                  onChange={(e) => setEditMemberForm({ ...editMemberForm, role: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                >
                  <option value="DEVELOPER">DEVELOPER</option>
                  <option value="DESIGNER">DESIGNER</option>
                  <option value="QA_TESTER">QA_TESTER</option>
                  <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                  <option value="DEVOPS">DEVOPS</option>
                  <option value="CONTENT_WRITER">CONTENT_WRITER</option>
                </select>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1.5">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-[#0a0a0a] border border-[#242428]">
                  {availablePermissions.map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editMemberForm.permissions.includes(perm.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...editMemberForm.permissions, perm.id]
                            : editMemberForm.permissions.filter((p) => p !== perm.id);
                          setEditMemberForm({ ...editMemberForm, permissions: next });
                        }}
                        className="accent-[#ff3e00]"
                      />
                      <span className="text-[11px] text-white">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Bank Details section */}
              <div className="pt-2 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowBankFields(!showBankFields)}
                  className="text-xs text-[#ff3e00] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{showBankFields ? 'Hide Bank Details' : 'Configure Bank Details'}</span>
                </button>

                {showBankFields && (
                  <div className="mt-3 space-y-3 p-3 bg-[#0a0a0a] border border-[#242428]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase text-[#88888e] mb-1">Account Holder Name</label>
                        <input
                          type="text"
                          value={editMemberForm.bankDetails.accountHolderName}
                          onChange={(e) =>
                            setEditMemberForm({
                              ...editMemberForm,
                              bankDetails: { ...editMemberForm.bankDetails, accountHolderName: e.target.value },
                            })
                          }
                          className="w-full bg-[#141416] border border-[#242428] px-3 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-[#88888e] mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={editMemberForm.bankDetails.bankName}
                          onChange={(e) =>
                            setEditMemberForm({
                              ...editMemberForm,
                              bankDetails: { ...editMemberForm.bankDetails, bankName: e.target.value },
                            })
                          }
                          className="w-full bg-[#141416] border border-[#242428] px-3 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-[#88888e] mb-1">Account Number</label>
                        <input
                          type="password"
                          placeholder={member.bankDetails?.accountNumberMasked || 'Enter to update'}
                          value={editMemberForm.bankDetails.accountNumber}
                          onChange={(e) =>
                            setEditMemberForm({
                              ...editMemberForm,
                              bankDetails: { ...editMemberForm.bankDetails, accountNumber: e.target.value },
                            })
                          }
                          className="w-full bg-[#141416] border border-[#242428] px-3 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-[#88888e] mb-1">IFSC Code</label>
                        <input
                          type="text"
                          placeholder={member.bankDetails?.ifscMasked || 'e.g. HDFC0001234'}
                          value={editMemberForm.bankDetails.ifsc}
                          onChange={(e) =>
                            setEditMemberForm({
                              ...editMemberForm,
                              bankDetails: { ...editMemberForm.bankDetails, ifsc: e.target.value },
                            })
                          }
                          className="w-full bg-[#141416] border border-[#242428] px-3 py-1.5 text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] uppercase text-[#88888e] mb-1">UPI ID</label>
                        <input
                          type="text"
                          placeholder={member.bankDetails?.upiIdMasked || 'username@okhdfcbank'}
                          value={editMemberForm.bankDetails.upiId}
                          onChange={(e) =>
                            setEditMemberForm({
                              ...editMemberForm,
                              bankDetails: { ...editMemberForm.bankDetails, upiId: e.target.value },
                            })
                          }
                          className="w-full bg-[#141416] border border-[#242428] px-3 py-1.5 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowEditMemberModal(false)}
                  className="crm-btn-secondary px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingMember}
                  className="crm-btn-primary px-4 py-2 disabled:opacity-50"
                >
                  {updatingMember ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Task Modal (Preselected & locked to this team member) */}
      {showAssignTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-5 my-8 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::TASK // ASSIGN_NEW_TASK</span>
              </div>
              <button
                onClick={() => setShowAssignTaskModal(false)}
                className="p-1 text-[#88888e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignTaskError && (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]">
                {assignTaskError}
              </div>
            )}

            <form onSubmit={handleAssignTaskSubmit} className="space-y-4">
              {/* Preselected Read-only Team Member */}
              <div className="p-3 bg-[#0a0a0a] border border-[#242428] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#88888e] uppercase block">Assigned Team Member</span>
                  <span className="text-white font-bold">{member.name} ({member.role})</span>
                </div>
                <span className="text-[10px] text-[#00D664] bg-[#0e1f15] border border-[#00d664]/30 px-2 py-0.5">
                  PRESELECTED
                </span>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={assignTaskForm.title}
                  onChange={(e) => setAssignTaskForm({ ...assignTaskForm, title: e.target.value })}
                  placeholder="e.g. Implement Payment Gateway Integration"
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              {/* Client -> Project Cascading Hierarchy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Client (Filter)</label>
                  <select
                    value={assignTaskForm.clientId}
                    onChange={(e) => {
                      const newCId = e.target.value;
                      setAssignTaskForm((prev) => ({
                        ...prev,
                        clientId: newCId,
                        projectId: '',
                        requiredCredentialIds: [],
                      }));
                      setProjectCredentials([]);
                    }}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="">All Clients</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.clientCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Project *</label>
                  <select
                    required
                    value={assignTaskForm.projectId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      const selectedProj = projects.find((p) => String(p._id) === String(pId));
                      const derivedClientId = selectedProj?.clientId?._id
                        ? String(selectedProj.clientId._id)
                        : (selectedProj?.clientId ? String(selectedProj.clientId) : assignTaskForm.clientId);
                      setAssignTaskForm((prev) => ({
                        ...prev,
                        projectId: pId,
                        clientId: derivedClientId || prev.clientId,
                        requiredCredentialIds: [],
                      }));
                      if (pId) loadProjectCredentials(pId);
                      else setProjectCredentials([]);
                    }}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="">Select Project</option>
                    {projects
                      .filter((p) => {
                        if (!assignTaskForm.clientId) return true;
                        const pClientId = p.clientId?._id ? String(p.clientId._id) : String(p.clientId || '');
                        return pClientId === String(assignTaskForm.clientId);
                      })
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.projectCode})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Priority</label>
                  <select
                    value={assignTaskForm.priority}
                    onChange={(e) => setAssignTaskForm({ ...assignTaskForm, priority: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={assignTaskForm.dueDate}
                    onChange={(e) => setAssignTaskForm({ ...assignTaskForm, dueDate: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Agreed Payout (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 5000"
                  value={assignTaskForm.agreedAmount}
                  onChange={(e) => setAssignTaskForm({ ...assignTaskForm, agreedAmount: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Task Scope & Instructions</label>
                <textarea
                  rows={3}
                  value={assignTaskForm.description}
                  onChange={(e) => setAssignTaskForm({ ...assignTaskForm, description: e.target.value })}
                  placeholder="Enter detailed task scope and deliverables..."
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              {/* Deliverable Settings */}
              <div className="pt-3 border-t border-[#242428] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">Deliverables Required</span>
                    <span className="text-[10px] text-[#88888e]">
                      Require URLs or files before the member can submit work
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={assignTaskForm.submissionRequired}
                    onChange={(e) => setAssignTaskForm({ ...assignTaskForm, submissionRequired: e.target.checked })}
                    className="accent-[#ff3e00] w-4 h-4 cursor-pointer"
                  />
                </div>

                {assignTaskForm.submissionRequired && (
                  <div className="space-y-3 p-3 bg-[#0a0a0a] border border-[#242428]">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignTaskForm.submissionTypes.includes('url')}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...assignTaskForm.submissionTypes, 'url']
                              : assignTaskForm.submissionTypes.filter((t) => t !== 'url');
                            setAssignTaskForm({ ...assignTaskForm, submissionTypes: next as any });
                          }}
                          className="accent-[#ff3e00]"
                        />
                        <span>URLs / Links</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignTaskForm.submissionTypes.includes('file')}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...assignTaskForm.submissionTypes, 'file']
                              : assignTaskForm.submissionTypes.filter((t) => t !== 'file');
                            setAssignTaskForm({ ...assignTaskForm, submissionTypes: next as any });
                          }}
                          className="accent-[#ff3e00]"
                        />
                        <span>Files</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase text-[#88888e] mb-1">Max File Size (MB)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={assignTaskForm.maxFileSizeMb}
                        onChange={(e) => setAssignTaskForm({ ...assignTaskForm, maxFileSizeMb: Number(e.target.value) || 25 })}
                        className="w-32 bg-[#141416] border border-[#242428] px-3 py-1.5 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowAssignTaskModal(false)}
                  className="crm-btn-secondary px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningTask}
                  className="crm-btn-primary px-4 py-2 disabled:opacity-50"
                >
                  {assigningTask ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTaskModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-5 my-8 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::TASK // EDIT_TASK ({selectedTask.taskCode})</span>
              </div>
              <button onClick={() => setShowEditTaskModal(false)} className="p-1 text-[#88888e] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editTaskError && (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]">
                {editTaskError}
              </div>
            )}

            <form onSubmit={handleEditTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={editTaskForm.title}
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Client (Filter)</label>
                  <select
                    value={editTaskForm.clientId}
                    onChange={(e) => {
                      const newCId = e.target.value;
                      setEditTaskForm((prev) => ({
                        ...prev,
                        clientId: newCId,
                        projectId: '',
                        requiredCredentialIds: [],
                      }));
                      setProjectCredentials([]);
                    }}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="">All Clients</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.clientCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Project *</label>
                  <select
                    required
                    value={editTaskForm.projectId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      const selectedProj = projects.find((p) => String(p._id) === String(pId));
                      const derivedClientId = selectedProj?.clientId?._id
                        ? String(selectedProj.clientId._id)
                        : (selectedProj?.clientId ? String(selectedProj.clientId) : editTaskForm.clientId);
                      setEditTaskForm((prev) => ({
                        ...prev,
                        projectId: pId,
                        clientId: derivedClientId || prev.clientId,
                        requiredCredentialIds: [],
                      }));
                      if (pId) loadProjectCredentials(pId);
                      else setProjectCredentials([]);
                    }}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="">Select Project</option>
                    {projects
                      .filter((p) => {
                        if (!editTaskForm.clientId) return true;
                        const pClientId = p.clientId?._id ? String(p.clientId._id) : String(p.clientId || '');
                        return pClientId === String(editTaskForm.clientId);
                      })
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.projectCode})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Priority</label>
                  <select
                    value={editTaskForm.priority}
                    onChange={(e) => setEditTaskForm({ ...editTaskForm, priority: e.target.value as any })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editTaskForm.dueDate}
                    onChange={(e) => setEditTaskForm({ ...editTaskForm, dueDate: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Agreed Payout (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={editTaskForm.agreedAmount}
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, agreedAmount: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editTaskForm.description}
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowEditTaskModal(false)}
                  className="crm-btn-secondary px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingTask}
                  className="crm-btn-primary px-4 py-2 disabled:opacity-50"
                >
                  {updatingTask ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Task Modal */}
      {showInspectTaskModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-xl p-6 space-y-5 my-8 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div>
                <div className="flex items-center gap-2 uppercase tracking-wider text-white">
                  <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                  <span>SYS::TASK // INSPECT_DETAILS</span>
                </div>
                <p className="text-[10px] text-[#88888e] mt-0.5">
                  Code: <span className="text-[#ff3e00] font-bold">{selectedTask.taskCode}</span>
                </p>
              </div>
              <button
                onClick={() => setShowInspectTaskModal(false)}
                className="p-1 text-[#88888e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedTask.title}</h3>
                {selectedTask.description ? (
                  <p className="text-[#88888e] mt-1 whitespace-pre-wrap">{selectedTask.description}</p>
                ) : (
                  <p className="text-[#88888e] mt-1 italic">No description provided</p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-[#0a0a0a] border border-[#242428]">
                <div>
                  <span className="text-[10px] uppercase text-[#88888e] block">Status</span>
                  <span className="text-white font-bold">{selectedTask.status}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#88888e] block">Priority</span>
                  <span className="text-white font-bold">{selectedTask.priority}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#88888e] block">Agreed Payout</span>
                  <span className="text-[#00D664] font-bold">
                    {selectedTask.agreedAmount ? `₹${selectedTask.agreedAmount.toLocaleString('en-IN')}` : 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#88888e] block">Project</span>
                  <span className="text-white truncate block">{selectedTask.projectId?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#88888e] block">Client</span>
                  <span className="text-white truncate block">{selectedTask.clientId?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#88888e] block">Due Date</span>
                  <span className="text-white">
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString('en-IN') : 'None'}
                  </span>
                </div>
              </div>

              {/* Submission Details */}
              <div className="p-3.5 bg-[#0a0a0a] border border-[#242428] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-white font-semibold flex items-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5 text-[#00D664]" />
                    <span>Submission Status</span>
                  </span>
                  {selectedTask.submission && (
                    <button
                      onClick={() => {
                        setShowInspectTaskModal(false);
                        setShowSubmissionModal(true);
                      }}
                      className="text-[11px] text-[#ff3e00] hover:underline cursor-pointer"
                    >
                      View Full Deliverables →
                    </button>
                  )}
                </div>
                {selectedTask.submission ? (
                  <div className="text-[11px] text-[#88888e] space-y-1">
                    <p>Submitted by: <b className="text-white">{selectedTask.submission.submittedBy}</b></p>
                    <p>Submitted at: {new Date(selectedTask.submission.submittedAt).toLocaleString('en-IN')}</p>
                    <p>URLs: {selectedTask.submission.submissionUrls?.length || 0} • Files: {selectedTask.submission.submissionFiles?.length || 0}</p>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#88888e] italic">
                    {selectedTask.submissionRequired ? 'Deliverables required — waiting for team member submission.' : 'Deliverables optional for this task.'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#242428]">
              <button
                type="button"
                onClick={() => {
                  setShowInspectTaskModal(false);
                  handleOpenEditTask(selectedTask);
                }}
                className="crm-btn-secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#ff3e00]" />
                <span>Edit Task</span>
              </button>

              <button
                type="button"
                onClick={() => setShowInspectTaskModal(false)}
                className="crm-btn-secondary px-4 py-1.5 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Task Submission Review Modal */}
      {showSubmissionModal && selectedTask && selectedTask.submission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-5 my-8 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div>
                <div className="flex items-center gap-2 uppercase tracking-wider text-white">
                  <span className="w-2 h-2 rounded-full bg-[#00D664]" />
                  <span>SYS::DELIVERABLE // SUBMISSION_REVIEW</span>
                </div>
                <p className="text-[10px] text-[#88888e] mt-1">
                  {selectedTask.title} (<span className="text-[#ff3e00]">{selectedTask.taskCode}</span>)
                </p>
              </div>
              <button
                onClick={() => setShowSubmissionModal(false)}
                className="p-1 text-[#88888e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0a0a0a] border border-[#242428] p-3.5 space-y-2 text-[#88888e]">
                <div className="flex justify-between items-center text-[11px] pb-2 border-b border-[#242428]">
                  <span>Submitted by: <b className="text-white">{selectedTask.submission.submittedBy}</b></span>
                  <span>{new Date(selectedTask.submission.submittedAt).toLocaleString('en-IN')}</span>
                </div>

                {selectedTask.submission.submissionNotes && (
                  <div className="pt-1">
                    <span className="text-[10px] uppercase text-[#88888e] block mb-1">Completion Notes:</span>
                    <p className="text-[#e4e4e7] whitespace-pre-wrap bg-[#141416] p-2.5 border border-[#242428]">
                      {selectedTask.submission.submissionNotes}
                    </p>
                  </div>
                )}

                {selectedTask.submission.submissionUrls && selectedTask.submission.submissionUrls.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] uppercase text-[#88888e] block mb-1.5">Submitted Links & URLs:</span>
                    <div className="space-y-1.5">
                      {selectedTask.submission.submissionUrls.map((url: string, uIdx: number) => (
                        <div key={uIdx} className="flex items-center justify-between p-2 bg-[#141416] border border-[#242428]">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#ff3e00] hover:underline flex items-center gap-1.5 truncate text-[11px]"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{url}</span>
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(url);
                              setBannerSuccess('URL copied to clipboard!');
                              setTimeout(() => setBannerSuccess(null), 2500);
                            }}
                            className="text-[10px] text-[#88888e] hover:text-white px-2 py-0.5 border border-[#242428] bg-[#0a0a0a]"
                          >
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTask.submission.submissionFiles && selectedTask.submission.submissionFiles.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] uppercase text-[#88888e] block mb-1.5">Submitted Files:</span>
                    <div className="space-y-1.5">
                      {selectedTask.submission.submissionFiles.map((file: any, fIdx: number) => {
                        const sizeMb = (file.fileSize / (1024 * 1024)).toFixed(2);
                        return (
                          <div key={fIdx} className="flex items-center justify-between p-2 bg-[#141416] border border-[#242428]">
                            <div className="flex items-center gap-2 truncate pr-2">
                              <FileText className="w-4 h-4 text-[#00D664] shrink-0" />
                              <div className="truncate">
                                <p className="text-white truncate">{file.fileName}</p>
                                <p className="text-[10px] text-[#88888e]">{sizeMb} MB</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDownloadFile(selectedTask._id, fIdx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#ff3e00]/10 border border-[#ff3e00]/30 text-[#ff3e00] hover:bg-[#ff3e00]/20 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowSubmissionModal(false)}
                  className="crm-btn-secondary px-4 py-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-md p-6 space-y-5 my-8 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div>
                <div className="flex items-center gap-2 uppercase tracking-wider text-white">
                  <span className="w-2 h-2 rounded-full bg-[#00D664]" />
                  <span>SYS::FINANCE // RECORD_PAYMENT</span>
                </div>
                <p className="text-[10px] text-[#88888e] mt-1">Recipient: <b className="text-white">{member.name}</b></p>
              </div>
              <button
                onClick={() => setShowRecordPaymentModal(false)}
                className="p-1 text-[#88888e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentError && (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]">
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Project *</label>
                <select
                  required
                  value={paymentForm.projectId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, projectId: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.projectCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Associated Task (Optional)</label>
                <select
                  value={paymentForm.taskId}
                  onChange={(e) => {
                    const tId = e.target.value;
                    const t = tasks.find((item) => item._id === tId);
                    setPaymentForm({
                      ...paymentForm,
                      taskId: tId,
                      amount: t?.agreedAmount ? String(t.agreedAmount) : paymentForm.amount,
                      description: t ? `Payment for task: ${t.title}` : paymentForm.description,
                    });
                  }}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                >
                  <option value="">No specific task (General compensation)</option>
                  {tasks.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.taskCode} - {t.title} {t.agreedAmount ? `(₹${t.agreedAmount})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 5000"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer (IMPS/NEFT)</option>
                    <option value="CASH">Cash</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Reference / UTR</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref # / IMPS ref"
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  placeholder="Notes regarding this payment..."
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowRecordPaymentModal(false)}
                  className="crm-btn-secondary px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="crm-btn-primary px-4 py-2 disabled:opacity-50"
                >
                  {recordingPayment ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reveal Bank Details Modal (Master Admin Password Challenge) */}
      {showRevealBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-md p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 uppercase tracking-wider text-white">
                <Lock className="w-4 h-4 text-[#ff3e00]" />
                <span>SECURITY // REVEAL_BANK_DETAILS</span>
              </div>
              <button
                onClick={() => setShowRevealBankModal(false)}
                className="p-1 text-[#88888e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!revealedBankData ? (
              <form onSubmit={handleRevealBankSubmit} className="space-y-4">
                <p className="text-[#88888e]">
                  Enter your master administrator password to decrypt sensitive banking credentials.
                </p>

                {revealError && (
                  <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]">
                    {revealError}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Master Password *</label>
                  <input
                    type="password"
                    required
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Enter admin password..."
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRevealBankModal(false)}
                    className="crm-btn-secondary px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={revealingBank || !masterPassword}
                    className="crm-btn-primary px-4 py-2 disabled:opacity-50"
                  >
                    {revealingBank ? 'Decrypting...' : 'Authenticate & Reveal'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-[#0e1f15] border border-[#00d664]/30 text-[#00d664] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Authentication verified. Credentials decrypted.</span>
                </div>

                <div className="space-y-2 p-3 bg-[#0a0a0a] border border-[#242428]">
                  <div className="flex justify-between items-center py-1 border-b border-[#242428]">
                    <span className="text-[#88888e]">Account Holder:</span>
                    <span className="text-white font-bold">{revealedBankData.accountHolderName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#242428]">
                    <span className="text-[#88888e]">Bank Name:</span>
                    <span className="text-white font-bold">{revealedBankData.bankName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#242428]">
                    <span className="text-[#88888e]">Account Number:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#00D664] font-bold tracking-wider">{revealedBankData.accountNumber}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(revealedBankData.accountNumber);
                          setBankCopiedField('account');
                          setTimeout(() => setBankCopiedField(null), 2000);
                        }}
                        className="text-[#88888e] hover:text-white"
                      >
                        {bankCopiedField === 'account' ? <Check className="w-3.5 h-3.5 text-[#00D664]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#242428]">
                    <span className="text-[#88888e]">IFSC Code:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{revealedBankData.ifsc}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(revealedBankData.ifsc);
                          setBankCopiedField('ifsc');
                          setTimeout(() => setBankCopiedField(null), 2000);
                        }}
                        className="text-[#88888e] hover:text-white"
                      >
                        {bankCopiedField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-[#00D664]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {revealedBankData.upiId && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-[#88888e]">UPI ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{revealedBankData.upiId}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(revealedBankData.upiId);
                            setBankCopiedField('upi');
                            setTimeout(() => setBankCopiedField(null), 2000);
                          }}
                          className="text-[#88888e] hover:text-white"
                        >
                          {bankCopiedField === 'upi' ? <Check className="w-3.5 h-3.5 text-[#00D664]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRevealedBankData(null);
                      setShowRevealBankModal(false);
                    }}
                    className="crm-btn-secondary px-4 py-2"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Telegram Link Modal */}
      {showTelegramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-md p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 uppercase tracking-wider text-white">
                <Send className="w-4 h-4 text-[#3b82f6]" />
                <span>TELEGRAM // CONNECTION_LINK</span>
              </div>
              <button
                onClick={() => setShowTelegramModal(false)}
                className="p-1 text-[#88888e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[#88888e]">
              Share this single-use link with <b className="text-white">{member.name}</b>. It will link their Telegram account to the CRM upon pressing Start in the bot. Valid for 24 hours.
            </p>

            <div className="p-3 bg-[#0a0a0a] border border-[#242428] flex items-center justify-between gap-2">
              <span className="text-[#ff3e00] truncate text-[11px] font-mono">{generatedTelegramLink}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedTelegramLink);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2500);
                }}
                className="px-2.5 py-1 text-xs bg-[#18181b] hover:bg-[#242428] text-white flex items-center gap-1 shrink-0"
              >
                {linkCopied ? <Check className="w-3.5 h-3.5 text-[#00D664]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{linkCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowTelegramModal(false)}
                className="crm-btn-secondary px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
