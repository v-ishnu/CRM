'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Search,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  User,
  FolderKanban,
  X,
  Send,
  Lock,
  Unlock,
  History,
  Coins,
  AlertTriangle,
  UploadCloud,
  ExternalLink,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusTab, setStatusTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Modals & States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectCredentials, setProjectCredentials] = useState<any[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    assignedTo: '',
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

  // Task Completion Submission Modal State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [submittingTask, setSubmittingTask] = useState<any>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionUrls, setSubmissionUrls] = useState<string[]>(['']);
  const [submissionFiles, setSubmissionFiles] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submissionSubmitting, setSubmissionSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [expandedHistoryTaskId, setExpandedHistoryTaskId] = useState<string | null>(null);

  // Share / Revoke / History modals
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [activeTaskHistory, setActiveTaskHistory] = useState<any[]>([]);
  const [activeTaskTitle, setActiveTaskTitle] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Record Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    taskId: '',
    projectId: '',
    teamMemberId: '',
    taskTitle: '',
    teamMemberName: '',
    amount: '',
    paymentMethod: 'UPI',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    status: 'PAID',
  });

  // Action status banners
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Manual Credential Modal State
  const [showManualCredModal, setShowManualCredModal] = useState(false);
  const [manualCredLoading, setManualCredLoading] = useState(false);
  const [manualCredError, setManualCredError] = useState<string | null>(null);
  const [manualCredData, setManualCredData] = useState({
    projectId: '',
    taskId: '',
    service: '',
    credentialType: 'WORDPRESS',
    loginUrl: '',
    username: '',
    password: '',
    notes: '',
    port: '22',
    privateKey: '',
  });

  const handleOpenAddCredForTask = (task?: any) => {
    setManualCredData({
      projectId: task ? (task.projectId?._id || task.projectId) : (projects[0]?._id || ''),
      taskId: task ? task._id : '',
      service: '',
      credentialType: 'WORDPRESS',
      loginUrl: '',
      username: '',
      password: '',
      notes: '',
      port: '22',
      privateKey: '',
    });
    setManualCredError(null);
    setShowManualCredModal(true);
  };

  const handleManualCredSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCredData.projectId || !manualCredData.service) {
      setManualCredError('Project and Service name are required.');
      return;
    }
    setManualCredLoading(true);
    setManualCredError(null);
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: manualCredData.projectId,
          taskId: manualCredData.taskId || undefined,
          service: manualCredData.service,
          credentialType: manualCredData.credentialType,
          loginUrl: manualCredData.loginUrl || undefined,
          username: manualCredData.username || undefined,
          password: manualCredData.password || undefined,
          notes: manualCredData.notes || undefined,
          port: manualCredData.port ? Number(manualCredData.port) : undefined,
          privateKey: manualCredData.privateKey || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBannerSuccess(`Credential for "${manualCredData.service}" securely saved with AES-256-GCM.`);
        setTimeout(() => setBannerSuccess(null), 5000);
        setShowManualCredModal(false);
        fetchData();
      } else {
        setManualCredError(data.error?.message || 'Failed to save credential.');
      }
    } catch (err: any) {
      setManualCredError(err.message || 'An error occurred while saving credential.');
    } finally {
      setManualCredLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (statusTab !== 'ALL') query.set('status', statusTab);
      if (search) query.set('search', search);
      if (projectFilter) query.set('projectId', projectFilter);
      if (memberFilter) query.set('assignedTo', memberFilter);
      if (priorityFilter) query.set('priority', priorityFilter);

      const [tasksRes, projectsRes, membersRes] = await Promise.all([
        fetch(`/api/tasks?${query.toString()}`),
        fetch('/api/projects'),
        fetch('/api/team-members?status=ACTIVE'),
      ]);

      const [tasksData, projectsData, membersData] = await Promise.all([
        tasksRes.json(),
        projectsRes.json(),
        membersRes.json(),
      ]);

      if (tasksData.success) setTasks(tasksData.data || []);
      if (projectsData.success) setProjects(projectsData.data || []);
      if (membersData.success) setTeamMembers(membersData.data || []);
    } catch (err) {
      console.error('Failed to fetch tasks data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusTab, search, projectFilter, memberFilter, priorityFilter]);

  // When project changes in Create Modal, load project's credentials
  const handleProjectSelect = async (projId: string) => {
    setFormData((prev) => ({
      ...prev,
      projectId: projId,
      requiredCredentialIds: [],
    }));

    if (!projId) {
      setProjectCredentials([]);
      return;
    }

    try {
      setLoadingCredentials(true);
      const res = await fetch(`/api/projects/${projId}/credentials`);
      const json = await res.json();
      if (json.success) {
        setProjectCredentials(json.data || []);
      } else {
        setProjectCredentials([]);
      }
    } catch (err) {
      console.error('Failed to load project credentials:', err);
      setProjectCredentials([]);
    } finally {
      setLoadingCredentials(false);
    }
  };

  const handleOpenCreate = () => {
    const defaultProjId = projects[0]?._id || '';
    setFormData({
      title: '',
      description: '',
      projectId: defaultProjId,
      assignedTo: '',
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
    if (defaultProjId) {
      handleProjectSelect(defaultProjId);
    }
    setShowCreateModal(true);
  };

  const toggleCredentialSelection = (credId: string) => {
    setFormData((prev) => {
      const exists = prev.requiredCredentialIds.includes(credId);
      return {
        ...prev,
        requiredCredentialIds: exists
          ? prev.requiredCredentialIds.filter((id) => id !== credId)
          : [...prev.requiredCredentialIds, credId],
      };
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.projectId) {
      alert('Title and Project are required');
      return;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          agreedAmount: formData.agreedAmount ? Number(formData.agreedAmount) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setBannerSuccess(`Task "${formData.title}" created successfully!`);
        setTimeout(() => setBannerSuccess(null), 4000);
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to create task');
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleOpenCompleteModal = (task: any) => {
    setSubmittingTask(task);
    setSubmissionNotes(task.submission?.submissionNotes || '');
    setSubmissionUrls(
      task.submission?.submissionUrls && task.submission?.submissionUrls.length > 0
        ? [...task.submission.submissionUrls]
        : ['']
    );
    setSubmissionFiles([]);
    setSubmissionError('');
    setShowCompleteModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!submittingTask || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const maxMb = submittingTask.maxFileSizeMb || 25;
    if (file.size > maxMb * 1024 * 1024) {
      setSubmissionError(`File ${file.name} exceeds max allowed size of ${maxMb}MB.`);
      return;
    }

    try {
      setUploadingFile(true);
      setSubmissionError('');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const res = await fetch(`/api/tasks/${submittingTask._id}/submissions/upload`, {
        method: 'POST',
        body: formDataUpload,
      });

      const data = await res.json();
      if (data.success && data.data) {
        setSubmissionFiles((prev) => [...prev, data.data]);
      } else {
        setSubmissionError(data.error?.message || 'File upload failed');
      }
    } catch (err: any) {
      setSubmissionError('Network error uploading file');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingTask) return;

    const cleanUrls = submissionUrls.map((u) => u.trim()).filter(Boolean);

    // Validation if required
    if (submittingTask.submissionRequired) {
      const types = submittingTask.submissionTypes && submittingTask.submissionTypes.length > 0
        ? submittingTask.submissionTypes
        : ['url', 'file'];
      const requiresUrl = types.includes('url') && !types.includes('file');
      const requiresFile = types.includes('file') && !types.includes('url');

      if (requiresUrl && cleanUrls.length === 0) {
        setSubmissionError('Please provide at least one valid submission URL');
        return;
      }
      if (requiresFile && submissionFiles.length === 0) {
        setSubmissionError('Please upload at least one submission deliverable file');
        return;
      }
      if (!requiresUrl && !requiresFile && cleanUrls.length === 0 && submissionFiles.length === 0) {
        setSubmissionError('Please provide at least one deliverable (URL or uploaded file)');
        return;
      }
    }

    try {
      setSubmissionSubmitting(true);
      setSubmissionError('');

      const existingFiles = submittingTask.submission?.submissionFiles || [];
      const allFiles = [...existingFiles, ...submissionFiles];

      const res = await fetch(`/api/tasks/${submittingTask._id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionNotes,
          submissionUrls: cleanUrls,
          submissionFiles: allFiles,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowCompleteModal(false);
        setBannerSuccess(`Task "${submittingTask.title}" marked completed with deliverables!`);
        setTimeout(() => setBannerSuccess(null), 4000);
        fetchData();
      } else {
        setSubmissionError(data.error?.message || 'Failed to complete task');
      }
    } catch (err) {
      setSubmissionError('Failed to communicate with server');
    } finally {
      setSubmissionSubmitting(false);
    }
  };

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
    } catch (err) {
      alert('Error fetching file download link');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t._id === taskId);
    if (newStatus === 'COMPLETED' && task) {
      handleOpenCompleteModal(task);
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to update task status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Share Required Credentials via Telegram
  const handleShareTaskCredentials = async (task: any) => {
    if (!task.assignedTo) {
      alert('Cannot share credentials: No team member is assigned to this task.');
      return;
    }
    if (!confirm(`Share the ${task.requiredCredentialIds?.length || 0} required credential(s) with ${task.assignedTo.name} via Telegram?`)) {
      return;
    }

    setActionLoading(task._id);
    setBannerError(null);
    setBannerSuccess(null);

    try {
      const res = await fetch(`/api/tasks/${task._id}/credentials/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oneTime: true }),
      });
      const data = await res.json();
      if (data.success) {
        setBannerSuccess(data.data?.message || 'Task credentials securely sent via Telegram!');
        setTimeout(() => setBannerSuccess(null), 5000);
      } else {
        setBannerError(data.error?.message || 'Failed to share task credentials.');
        setTimeout(() => setBannerError(null), 7000);
      }
    } catch (err: any) {
      setBannerError('An unexpected error occurred during credential dispatch.');
    } finally {
      setActionLoading(null);
    }
  };

  // Revoke Task Credential Access
  const handleRevokeTaskCredentials = async (task: any) => {
    if (!confirm(`Revoke task credential access for task ${task.taskCode}? The underlying project credentials will remain safe in storage.`)) {
      return;
    }

    setActionLoading(task._id);
    setBannerError(null);
    setBannerSuccess(null);

    try {
      const res = await fetch(`/api/tasks/${task._id}/credentials/revoke`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setBannerSuccess(`Credential access revoked for task ${task.taskCode}.`);
        setTimeout(() => setBannerSuccess(null), 5000);
        fetchData();
      } else {
        setBannerError(data.error?.message || 'Failed to revoke access.');
      }
    } catch (err) {
      setBannerError('An error occurred during revocation.');
    } finally {
      setActionLoading(null);
    }
  };

  // Open Access History Modal
  const handleViewHistory = async (task: any) => {
    setActiveTaskTitle(task.title);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/tasks/${task._id}/credentials/history`);
      const data = await res.json();
      if (data.success) {
        setActiveTaskHistory(data.data || []);
      } else {
        setActiveTaskHistory([]);
      }
    } catch {
      setActiveTaskHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Record Payment Modal for a task
  const handleOpenRecordPayment = (task: any) => {
    setPaymentFormData({
      taskId: task._id,
      projectId: task.projectId?._id || task.projectId,
      teamMemberId: task.assignedTo?._id || '',
      taskTitle: task.title,
      teamMemberName: task.assignedTo?.name || 'Assigned Member',
      amount: task.agreedAmount ? String(task.agreedAmount) : '',
      paymentMethod: 'UPI',
      paymentDate: new Date().toISOString().split('T')[0],
      reference: '',
      description: `Payment for task ${task.taskCode}: ${task.title}`,
      status: 'PAID',
    });
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentFormData.teamMemberId || !paymentFormData.projectId || !paymentFormData.amount) {
      alert('Please fill out all required payment fields.');
      return;
    }

    try {
      const res = await fetch('/api/team-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: paymentFormData.taskId,
          projectId: paymentFormData.projectId,
          teamMemberId: paymentFormData.teamMemberId,
          amount: Number(paymentFormData.amount),
          paymentMethod: paymentFormData.paymentMethod,
          paymentDate: paymentFormData.paymentDate,
          reference: paymentFormData.reference,
          description: paymentFormData.description,
          status: paymentFormData.status,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPaymentModal(false);
        setBannerSuccess(`Payment of ₹${Number(paymentFormData.amount).toLocaleString('en-IN')} recorded successfully!`);
        setTimeout(() => setBannerSuccess(null), 5000);
      } else {
        alert(data.error?.message || 'Failed to record payment');
      }
    } catch (err) {
      console.error('Record payment error:', err);
    }
  };

  const priorityBadges: Record<string, { label: string; bg: string; text: string }> = {
    LOW: { label: 'Low', bg: 'bg-emerald-950/60 border-emerald-800/50', text: 'text-emerald-400' },
    MEDIUM: { label: 'Medium', bg: 'bg-amber-950/60 border-amber-800/50', text: 'text-amber-400' },
    HIGH: { label: 'High', bg: 'bg-orange-950/60 border-orange-800/50', text: 'text-orange-400' },
    URGENT: { label: 'Urgent', bg: 'bg-red-950/60 border-red-800/50', text: 'text-red-400' },
  };

  const statusOptions = [
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'BLOCKED', label: 'Blocked' },
    { value: 'REVIEW', label: 'Review' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-[#ff3e00]">
              WORKFLOW // TASKS
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Task Management</h1>
          <p className="text-xs sm:text-sm text-[#a1a1aa] mt-0.5">
            Least-privilege task credential access, status workflows, and developer compensation tracking.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleOpenAddCredForTask()}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xs bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-[#ff3e00]/60 text-white font-mono text-xs uppercase font-bold tracking-wider transition-colors cursor-pointer shrink-0"
          >
            <Lock className="w-3.5 h-3.5 text-[#ff3e00]" />
            <span>+ Add Credential</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xs bg-white text-black hover:bg-[#ff3e00] hover:text-white font-mono text-xs uppercase font-bold tracking-wider shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Create Task</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {bannerSuccess && (
        <div className="p-3.5 bg-[#00d664]/10 border border-[#00d664]/30 text-[#00d664] rounded-xs text-xs font-mono flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{bannerSuccess}</span>
        </div>
      )}
      {bannerError && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xs text-xs font-mono flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{bannerError}</span>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-px border-b border-[#242428] font-mono text-xs uppercase font-bold tracking-wider scrollbar-none">
        {[
          { key: 'ALL', label: 'All Tasks' },
          { key: 'TODO', label: 'To Do' },
          { key: 'IN_PROGRESS', label: 'In Progress' },
          { key: 'BLOCKED', label: 'Blocked' },
          { key: 'REVIEW', label: 'Review' },
          { key: 'COMPLETED', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`px-4 py-2 transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              statusTab === tab.key
                ? 'border-[#ff3e00] text-white bg-white/[0.03]'
                : 'border-transparent text-[#71717a] hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#141416] border border-[#242428] p-3 rounded-xs">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71717a] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs pl-9 pr-3 py-2 text-xs text-white placeholder-[#52525b] outline-none transition-all"
          />
        </div>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs px-3 py-2 text-xs font-mono text-[#f5f5f2] outline-none cursor-pointer"
        >
          <option value="">ALL PROJECTS</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} ({p.projectCode})
            </option>
          ))}
        </select>

        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs px-3 py-2 text-xs font-mono text-[#f5f5f2] outline-none cursor-pointer"
        >
          <option value="">ALL ASSIGNEES</option>
          {teamMembers.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] rounded-xs px-3 py-2 text-xs font-mono text-[#f5f5f2] outline-none cursor-pointer"
        >
          <option value="">ALL PRIORITIES</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
      </div>

      {/* Task Cards List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 w-full bg-[#141416] border border-[#242428] animate-pulse"></div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center p-12 bg-[#141416] border border-[#242428]">
          <CheckSquare className="w-10 h-10 text-[#4a4a52] stroke-1 mx-auto mb-3" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#f5f5f2]">No tasks found</h3>
          <p className="text-xs text-[#8a8a93] mt-1 font-mono">Create your first task or change your filter settings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const pBadge = priorityBadges[task.priority] || priorityBadges.MEDIUM;
            const requiredCount = task.requiredCredentialIds?.length || 0;
            const isRevoked = !!task.credentialAccessRevoked;

            return (
              <div
                key={task._id}
                className="bg-[#141416] border border-[#242428] hover:border-[#38383e] p-5 space-y-4 transition-colors"
              >
                {/* Top Task Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-white bg-[#0a0a0a] border border-[#242428] px-2 py-0.5 tracking-wide">
                        {task.taskCode}
                      </span>
                      <h3 className="text-sm font-semibold text-white truncate">{task.title}</h3>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border bg-[#0a0a0a] border-[#242428] text-[#8a8a93]">
                        {pBadge.label}
                      </span>
                      {task.submissionRequired && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border bg-[#1c1408] border-[#f59e0b]/40 text-[#f59e0b] flex items-center gap-1">
                          <UploadCloud className="w-3 h-3 text-[#f59e0b]" />
                          <span>DELIVERABLE REQ</span>
                        </span>
                      )}
                      {task.agreedAmount ? (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border bg-[#0e1f15] border-[#00d664]/30 text-[#00d664]">
                          ₹{task.agreedAmount.toLocaleString('en-IN')}
                        </span>
                      ) : null}
                    </div>

                    {task.description && (
                      <p className="text-xs text-[#8a8a93] line-clamp-1">{task.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs font-mono text-[#8a8a93] pt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[#f5f5f2]">
                        <FolderKanban className="w-3.5 h-3.5 text-[#ff3e00]" />
                        <span>{task.projectId?.name || 'Project'}</span>
                      </span>

                      <span className="flex items-center gap-1 text-[#f5f5f2]">
                        <User className="w-3.5 h-3.5 text-[#8a8a93]" />
                        <span>{task.assignedTo ? `${task.assignedTo.name} (${task.assignedTo.role})` : 'Unassigned'}</span>
                      </span>

                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-[#8a8a93]">
                          <Clock className="w-3.5 h-3.5 text-[#6b6b76]" />
                          <span>DUE: {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Dropdown & Delete */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task._id, e.target.value)}
                      className="text-xs font-mono font-semibold px-2.5 py-1.5 bg-[#0a0a0a] border border-[#242428] text-white focus:outline-none focus:border-[#ff3e00] cursor-pointer"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0a0a0a] text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="p-1.5 text-[#8a8a93] hover:text-[#ff3e00] transition-colors cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Task Toolbar: Required Credentials & Payments */}
                <div className="pt-3 border-t border-[#242428] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {/* Credentials Section */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {requiredCount > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none md:rounded-xs border font-mono text-xs ${
                          isRevoked
                            ? 'bg-[#18181b] border-[#242428] text-[#88888e]'
                            : 'bg-[#ff3e00]/10 border-[#ff3e00]/30 text-[#ff3e00]'
                        }`}>
                          <Lock className="w-3.5 h-3.5" />
                          <span>{requiredCount} Credential{requiredCount > 1 ? 's' : ''}</span>
                          {isRevoked && <span className="text-[10px] bg-[#EF4444]/20 text-[#EF4444] px-1.5 py-0.2 rounded-none md:rounded-xs border border-[#EF4444]/30 ml-1">REVOKED</span>}
                        </span>

                        {!isRevoked && (
                          <button
                            onClick={() => handleShareTaskCredentials(task)}
                            disabled={actionLoading === task._id}
                            className="crm-btn-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{actionLoading === task._id ? 'Sharing...' : 'Share via Telegram'}</span>
                          </button>
                        )}

                        {!isRevoked && (
                          <button
                            onClick={() => handleRevokeTaskCredentials(task)}
                            disabled={actionLoading === task._id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none md:rounded-xs bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 text-[#EF4444] font-mono text-xs transition-all"
                            title="Revoke access to this task's credentials"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#88888e] font-mono text-xs italic">No specific credentials required</span>
                    )}

                    <button
                      onClick={() => handleOpenAddCredForTask(task)}
                      className="crm-btn-secondary inline-flex items-center gap-1 px-2 py-1 text-[11px]"
                      title="Add or link credential to this task"
                    >
                      <Plus className="w-3 h-3 text-[#ff3e00]" />
                      <span>Add Cred</span>
                    </button>

                    <button
                      onClick={() => handleViewHistory(task)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[#88888e] hover:text-white font-mono text-xs transition-colors cursor-pointer"
                      title="View credential share history"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>History</span>
                    </button>
                  </div>

                  {/* Payment Button */}
                  <div className="flex items-center gap-2">
                    {task.assignedTo && (
                      <button
                        onClick={() => handleOpenRecordPayment(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none md:rounded-xs bg-[#00D664]/10 hover:bg-[#00D664]/20 border border-[#00D664]/30 text-[#00D664] font-mono text-xs font-semibold cursor-pointer transition-all"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>+ Record Payment</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Task Deliverables / Submission Section */}
                {(task.submission || task.status === 'COMPLETED' || task.submissionRequired) && (
                  <div className="pt-3 border-t border-[#242428] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-white flex items-center gap-1.5">
                        <UploadCloud className="w-3.5 h-3.5 text-[#00D664]" />
                        <span>Deliverables</span>
                      </span>

                      <button
                        onClick={() => handleOpenCompleteModal(task)}
                        className="crm-btn-secondary text-[11px] px-2.5 py-1 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-[#ff3e00]" />
                        <span>{task.submission ? 'Resubmit Deliverables' : 'Submit Deliverables'}</span>
                      </button>
                    </div>

                    {task.submission ? (
                      <div className="bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs p-3.5 space-y-2.5 text-xs font-mono">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[#88888e] text-[11px] pb-2 border-b border-[#242428]">
                          <span>
                            Submitted by <b className="text-white">{task.submission.submittedBy}</b>
                          </span>
                          <span>
                            {new Date(task.submission.submittedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {task.submission.submissionNotes && (
                          <div>
                            <span className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Notes</span>
                            <p className="text-[#e4e4e7] mt-0.5 whitespace-pre-wrap">{task.submission.submissionNotes}</p>
                          </div>
                        )}

                        {task.submission.submissionUrls && task.submission.submissionUrls.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Submitted URLs</span>
                            <div className="space-y-1">
                              {task.submission.submissionUrls.map((url: string, uIdx: number) => (
                                <a
                                  key={uIdx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-[#ff3e00] hover:underline font-mono text-[11px]"
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{url}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {task.submission.submissionFiles && task.submission.submissionFiles.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-[#88888e]">Submitted Files</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {task.submission.submissionFiles.map((file: any, fIdx: number) => {
                                const sizeMb = (file.fileSize / (1024 * 1024)).toFixed(2);
                                return (
                                  <div
                                    key={fIdx}
                                    className="flex items-center justify-between p-2 rounded-none md:rounded-xs bg-[#141416] border border-[#242428] text-[11px]"
                                  >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                      <FileText className="w-4 h-4 text-[#00D664] shrink-0" />
                                      <div className="truncate">
                                        <p className="font-mono text-white truncate">{file.fileName}</p>
                                        <p className="text-[10px] text-[#88888e] font-mono">{sizeMb} MB</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleDownloadFile(task._id, fIdx)}
                                      className="p-1 text-[#88888e] hover:text-[#ff3e00] rounded-none md:rounded-xs hover:bg-[#18181b] cursor-pointer transition-colors shrink-0"
                                      title="Download with secure signed URL"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* History Accordion if resubmissions exist */}
                        {task.submissionHistory && task.submissionHistory.length > 0 && (
                          <div className="pt-2 border-t border-[#242428]">
                            <button
                              onClick={() =>
                                setExpandedHistoryTaskId(expandedHistoryTaskId === task._id ? null : task._id)
                              }
                              className="text-[11px] text-[#88888e] hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                            >
                              <History className="w-3 h-3 text-[#ff3e00]" />
                              <span>
                                Previous Submissions ({task.submissionHistory.length})
                              </span>
                              {expandedHistoryTaskId === task._id ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            {expandedHistoryTaskId === task._id && (
                              <div className="mt-2 space-y-2 pl-2 border-l border-[#242428]">
                                {task.submissionHistory.map((hist: any, hIdx: number) => (
                                  <div key={hIdx} className="bg-[#141416] p-2.5 rounded-none md:rounded-xs border border-[#242428] text-[11px] space-y-1">
                                    <div className="flex justify-between text-[#88888e] text-[10px] font-mono">
                                      <span>By {hist.submittedBy}</span>
                                      <span>{new Date(hist.submittedAt).toLocaleString('en-IN')}</span>
                                    </div>
                                    {hist.submissionNotes && <p className="text-[#e4e4e7]">{hist.submissionNotes}</p>}
                                    {hist.submissionUrls?.map((u: string, idx: number) => (
                                      <a key={idx} href={u} target="_blank" rel="noopener noreferrer" className="block text-[#ff3e00] hover:underline truncate text-[10px] font-mono">
                                        {u}
                                      </a>
                                    ))}
                                    {hist.submissionFiles?.map((f: any, fIdx: number) => (
                                      <div key={fIdx} className="flex justify-between items-center text-[10px] font-mono text-[#88888e]">
                                        <span className="truncate">{f.fileName}</span>
                                        <button
                                          onClick={() => handleDownloadFile(task._id, fIdx, hIdx)}
                                          className="text-[#ff3e00] hover:underline cursor-pointer"
                                        >
                                          Download
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-[#88888e] font-mono text-xs flex items-center justify-between">
                        <span>No submission deliverables attached yet.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                <span>SYS::TASK // CREATE_NEW_WORK_ITEM</span>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Update WordPress Content"
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Project *</label>
                <select
                  required
                  value={formData.projectId}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.projectCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Assign To</label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Agreed Payout (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 2500"
                    value={formData.agreedAmount}
                    onChange={(e) => setFormData({ ...formData, agreedAmount: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Task instructions and requirements..."
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              {/* Task Required Access (Least Privilege Credentials Selection) */}
              <div className="space-y-2 pt-2 border-t border-[#242428]">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-white flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#ff3e00]" />
                    <span>Required Access</span>
                  </label>
                  <span className="text-[10px] font-mono text-[#88888e]">
                    {formData.requiredCredentialIds.length} selected
                  </span>
                </div>

                <div className="p-3 bg-[#18181b] border border-[#242428] rounded-none md:rounded-xs text-[#88888e] text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" />
                  <span>Only selected credentials will be accessible to the assigned team member. Unselected credentials remain hidden.</span>
                </div>

                {loadingCredentials ? (
                  <div className="p-4 text-center text-xs text-[#88888e] font-mono">Loading project credentials...</div>
                ) : projectCredentials.length === 0 ? (
                  <div className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-[#88888e] text-xs font-mono">
                    No active credentials stored for this project.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {projectCredentials.map((c) => {
                      const selected = formData.requiredCredentialIds.includes(c._id);
                      return (
                        <div
                          key={c._id}
                          onClick={() => toggleCredentialSelection(c._id)}
                          className={`p-2.5 rounded-none md:rounded-xs border flex items-center justify-between cursor-pointer transition-all text-xs font-mono ${
                            selected
                              ? 'bg-[#ff3e00]/10 border-[#ff3e00]/40 text-white'
                              : 'bg-[#0a0a0a] border-[#242428] text-[#88888e] hover:border-[#ff3e00]/30 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {}}
                              className="rounded-none text-[#ff3e00] focus:ring-0 cursor-pointer"
                            />
                            <span className="font-semibold text-white">{c.service}</span>
                          </div>
                          <span className="text-[10px] uppercase font-mono text-[#88888e] bg-[#18181b] px-2 py-0.5 rounded-none md:rounded-xs border border-[#242428]">
                            {c.credentialType || 'Credential'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {formData.requiredCredentialIds.length > 0 && formData.assignedTo && (
                  <label className="flex items-center gap-2 pt-1 text-xs text-[#88888e] cursor-pointer font-mono">
                    <input
                      type="checkbox"
                      checked={formData.autoShareCredentials}
                      onChange={(e) => setFormData({ ...formData, autoShareCredentials: e.target.checked })}
                      className="rounded-none text-[#ff3e00] focus:ring-0 cursor-pointer"
                    />
                    <span>⚡ Share required credentials automatically via Telegram upon assignment</span>
                  </label>
                )}
              </div>

              {/* Task Deliverable Requirements */}
              <div className="space-y-3 pt-3 border-t border-[#242428]">
                <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.submissionRequired}
                    onChange={(e) => setFormData({ ...formData, submissionRequired: e.target.checked })}
                    className="rounded-none text-[#00D664] focus:ring-0 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-[#00D664]" />
                    <span>Require Completion Deliverables (Files / URLs)</span>
                  </span>
                </label>

                {formData.submissionRequired && (
                  <div className="p-3.5 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs space-y-3 text-xs font-mono">
                    <div>
                      <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1.5">Deliverable Types</label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#e4e4e7]">
                          <input
                            type="checkbox"
                            checked={formData.submissionTypes.includes('url')}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormData((prev) => ({
                                ...prev,
                                submissionTypes: checked
                                  ? [...prev.submissionTypes, 'url']
                                  : prev.submissionTypes.filter((t) => t !== 'url'),
                              }));
                            }}
                            className="rounded-none text-[#ff3e00] focus:ring-0"
                          />
                          <span>URLs / Links (PRs, Figma, Staging)</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer text-[#e4e4e7]">
                          <input
                            type="checkbox"
                            checked={formData.submissionTypes.includes('file')}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormData((prev) => ({
                                ...prev,
                                submissionTypes: checked
                                  ? [...prev.submissionTypes, 'file']
                                  : prev.submissionTypes.filter((t) => t !== 'file'),
                              }));
                            }}
                            className="rounded-none text-[#ff3e00] focus:ring-0"
                          />
                          <span>Files (ZIP, PDF, DOCX, Images)</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Max File Size (MB)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={formData.maxFileSizeMb}
                          onChange={(e) =>
                            setFormData({ ...formData, maxFileSizeMb: Number(e.target.value) || 25 })
                          }
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-3 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Assignee Instructions (Optional)</label>
                        <input
                          type="text"
                          value={formData.submissionInstructions}
                          onChange={(e) =>
                            setFormData({ ...formData, submissionInstructions: e.target.value })
                          }
                          placeholder="e.g. Provide build ZIP and release notes link"
                          className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-3 py-1.5 text-white focus:outline-none focus:border-[#ff3e00]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary px-4 py-2 text-xs"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Task Deliverables Modal */}
      {showCompleteModal && submittingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                  <span className="w-2 h-2 rounded-full bg-[#00D664]" />
                  <span>SYS::DELIVERABLE // SUBMIT_DELIVERABLES</span>
                </div>
                <p className="text-[10px] font-mono text-[#88888e] mt-1">
                  {submittingTask.title} (<span className="text-[#ff3e00]">{submittingTask.taskCode}</span>)
                </p>
              </div>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submittingTask.submissionInstructions && (
              <div className="p-3 bg-[#18181b] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono text-[#88888e]">
                <span className="font-semibold text-white">Instructions: </span>
                {submittingTask.submissionInstructions}
              </div>
            )}

            {submissionError && (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-none md:rounded-xs text-xs font-mono text-[#EF4444]">
                {submissionError}
              </div>
            )}

            <form onSubmit={handleSubmitCompletion} className="space-y-4 text-xs font-mono">
              {/* URLs Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e] flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-[#ff3e00]" />
                    <span>Submission URLs / Links</span>
                    {submittingTask.submissionRequired && submittingTask.submissionTypes?.includes('url') && (
                      <span className="text-[#ff3e00]">*</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setSubmissionUrls([...submissionUrls, ''])}
                    className="text-[11px] text-[#ff3e00] hover:underline cursor-pointer"
                  >
                    + Add Link
                  </button>
                </div>

                <div className="space-y-2">
                  {submissionUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          const updated = [...submissionUrls];
                          updated[idx] = e.target.value;
                          setSubmissionUrls(updated);
                        }}
                        placeholder="https://github.com/... or https://figma.com/..."
                        className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                      />
                      {submissionUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSubmissionUrls(submissionUrls.filter((_, i) => i !== idx))}
                          className="p-1 text-[#88888e] hover:text-[#EF4444] rounded-none md:rounded-xs transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* File Upload Section */}
              <div className="space-y-2 pt-2 border-t border-[#242428]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#88888e] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#00D664]" />
                    <span>Deliverable Files</span>
                    {submittingTask.submissionRequired && submittingTask.submissionTypes?.includes('file') && (
                      <span className="text-[#ff3e00]">*</span>
                    )}
                  </label>
                  <span className="text-[10px] text-[#88888e] font-mono">
                    Max {submittingTask.maxFileSizeMb || 25}MB per file
                  </span>
                </div>

                <div className="border border-dashed border-[#242428] hover:border-[#ff3e00]/50 rounded-none md:rounded-xs p-4 text-center bg-[#0a0a0a] transition-colors">
                  <input
                    type="file"
                    id="submission-file-input"
                    disabled={uploadingFile}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="submission-file-input"
                    className="cursor-pointer inline-flex flex-col items-center gap-1 text-xs text-[#88888e] hover:text-white"
                  >
                    <UploadCloud className="w-6 h-6 text-[#00D664] mb-1" />
                    <span className="font-mono text-white">
                      {uploadingFile ? 'Uploading file...' : 'Click to upload deliverable file'}
                    </span>
                    <span className="text-[10px] text-[#88888e] font-mono">
                      ZIP, PDF, DOCX, XLSX, images, tar.gz
                    </span>
                  </label>
                </div>

                {/* Uploaded Files Table */}
                {submissionFiles.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {submissionFiles.map((file, idx) => {
                      const sizeMb = (file.fileSize / (1024 * 1024)).toFixed(2);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-none md:rounded-xs bg-[#0a0a0a] border border-[#242428] text-xs font-mono"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#00D664] shrink-0" />
                            <span className="font-medium text-white truncate">{file.fileName}</span>
                            <span className="text-[10px] text-[#88888e] font-mono">({sizeMb} MB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSubmissionFiles(submissionFiles.filter((_, i) => i !== idx))}
                            className="p-1 text-[#88888e] hover:text-[#EF4444] rounded-none md:rounded-xs transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="pt-2 border-t border-[#242428]">
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">
                  Completion Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Summary of changes, test instructions, or notes for the admin..."
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submissionSubmitting || uploadingFile}
                  className="crm-btn-primary px-4 py-2 text-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#00D664]" />
                  <span>{submissionSubmitting ? 'Submitting...' : 'Complete Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Team Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                  <span className="w-2 h-2 rounded-full bg-[#00D664]" />
                  <span>SYS::FINANCE // RECORD_PAYMENT</span>
                </div>
                <p className="text-[10px] font-mono text-[#88888e]">For {paymentFormData.teamMemberName}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  placeholder="e.g. 2000"
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00] font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Payment Method</label>
                  <select
                    value={paymentFormData.paymentMethod}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentFormData.paymentDate}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentDate: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-92837492"
                  value={paymentFormData.reference}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, reference: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Status</label>
                <select
                  value={paymentFormData.status}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, status: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                >
                  <option value="PAID">PAID (Sends Telegram Receipt)</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Description</label>
                <input
                  type="text"
                  value={paymentFormData.description}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, description: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary px-4 py-2 text-xs"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credential Access History Modal */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                  <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
                  <span>SYS::AUDIT // ACCESS_HISTORY</span>
                </div>
                <p className="text-[10px] font-mono text-[#88888e] mt-0.5">{activeTaskTitle}</p>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-[#88888e] font-mono">Loading audit history...</div>
            ) : activeTaskHistory.length === 0 ? (
              <div className="p-8 text-center bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-[#88888e] text-xs font-mono">
                No credential sharing actions logged yet for this task.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {activeTaskHistory.map((item, idx) => (
                  <div
                    key={item._id || idx}
                    className="p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs text-xs font-mono flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{item.serviceName}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-none md:rounded-xs border ${
                          item.action === 'TASK_CREDENTIAL_REVOKED'
                            ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                            : 'bg-[#ff3e00]/10 text-[#ff3e00] border-[#ff3e00]/30'
                        }`}>
                          {item.action}
                        </span>
                      </div>
                      <p className="text-[#88888e]">
                        {item.action === 'TASK_CREDENTIAL_REVOKED'
                          ? `Access revoked by ${item.actor}`
                          : `Shared with ${item.teamMemberName || 'Team Member'} by ${item.sharedBy || item.actor}`}
                      </p>
                    </div>

                    <span className="text-[10px] text-[#88888e] font-mono shrink-0">
                      {new Date(item.timestamp).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[#242428]">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="crm-btn-secondary px-4 py-2 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Credential Modal */}
      {showManualCredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#141416] border border-[#242428] rounded-none md:rounded-xs w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#242428] pb-3">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white">
                <Lock className="w-4 h-4 text-[#ff3e00]" />
                <div>
                  <div className="font-semibold text-white">SYS::VAULT // ADD_CREDENTIAL</div>
                  <p className="text-[10px] text-[#88888e]">Encrypted with AES-256-GCM authentication</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualCredModal(false)}
                className="p-1 text-[#88888e] hover:text-white hover:bg-[#18181b] rounded-none md:rounded-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {manualCredError && (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-none md:rounded-xs text-xs font-mono text-[#EF4444] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#EF4444]" />
                <span>{manualCredError}</span>
              </div>
            )}

            <form onSubmit={handleManualCredSubmit} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Project *</label>
                  <select
                    required
                    value={manualCredData.projectId}
                    onChange={(e) => setManualCredData({ ...manualCredData, projectId: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
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
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Link to Task (Optional)</label>
                  <select
                    value={manualCredData.taskId}
                    onChange={(e) => setManualCredData({ ...manualCredData, taskId: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="">None (Project-wide)</option>
                    {tasks
                      .filter((t) => !manualCredData.projectId || (t.projectId?._id || t.projectId) === manualCredData.projectId)
                      .map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.taskCode} - {t.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Service / Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Staging WP Admin"
                    value={manualCredData.service}
                    onChange={(e) => setManualCredData({ ...manualCredData, service: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Credential Type</label>
                  <select
                    value={manualCredData.credentialType}
                    onChange={(e) => setManualCredData({ ...manualCredData, credentialType: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  >
                    <option value="WORDPRESS">WordPress Admin</option>
                    <option value="HOSTING">Hosting / cPanel</option>
                    <option value="SSH">SSH / VPS Server</option>
                    <option value="DATABASE">Database</option>
                    <option value="API_KEY">API Key / Token</option>
                    <option value="CUSTOM">Custom Credential</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">
                  {manualCredData.credentialType === 'SSH' ? 'Host / IP Address' : 'Login URL / Endpoint'}
                </label>
                <input
                  type="text"
                  placeholder={manualCredData.credentialType === 'SSH' ? '192.168.1.1 or server.example.com' : 'https://example.com/wp-admin'}
                  value={manualCredData.loginUrl}
                  onChange={(e) => setManualCredData({ ...manualCredData, loginUrl: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Username / Email / Key ID</label>
                  <input
                    type="text"
                    placeholder="admin or root"
                    value={manualCredData.username}
                    onChange={(e) => setManualCredData({ ...manualCredData, username: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Password / Secret Key</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={manualCredData.password}
                    onChange={(e) => setManualCredData({ ...manualCredData, password: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              {manualCredData.credentialType === 'SSH' && (
                <div className="space-y-3 p-3 bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">SSH Port</label>
                    <input
                      type="number"
                      value={manualCredData.port}
                      onChange={(e) => setManualCredData({ ...manualCredData, port: e.target.value })}
                      placeholder="22"
                      className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">SSH Private Key (Encrypted)</label>
                    <textarea
                      rows={3}
                      value={manualCredData.privateKey}
                      onChange={(e) => setManualCredData({ ...manualCredData, privateKey: e.target.value })}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                      className="w-full bg-[#141416] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-[#ff3e00]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#88888e] mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={manualCredData.notes}
                  onChange={(e) => setManualCredData({ ...manualCredData, notes: e.target.value })}
                  placeholder="Additional access instructions or 2FA recovery keys..."
                  className="w-full bg-[#0a0a0a] border border-[#242428] rounded-none md:rounded-xs px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowManualCredModal(false)}
                  className="crm-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualCredLoading}
                  className="crm-btn-primary px-5 py-2 text-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {manualCredLoading ? 'Encrypting & Saving...' : 'Save Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
