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
  ShieldCheck,
  History,
  DollarSign,
  Coins,
  AlertTriangle,
  RotateCw,
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
  });

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

  const handleStatusChange = async (taskId: string, newStatus: string) => {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Task Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Least-privilege task credential access, status workflows, and developer compensation tracking.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Task</span>
        </button>
      </div>

      {/* Alert Banners */}
      {bannerSuccess && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{bannerSuccess}</span>
        </div>
      )}
      {bannerError && (
        <div className="p-4 bg-red-950/60 border border-red-500/30 text-red-300 rounded-xl text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{bannerError}</span>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide border-b border-slate-800/80">
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
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              statusTab === tab.key
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#0d0d12] border border-slate-800/80 p-3 rounded-2xl">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full bg-[#14141b] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} ({p.projectCode})
            </option>
          ))}
        </select>

        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Assignees</option>
          {teamMembers.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>

      {/* Task Cards List */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center p-12 bg-[#0d0d12] border border-slate-800 rounded-2xl">
          <CheckSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No tasks found</h3>
          <p className="text-xs text-slate-400 mt-1">Create your first task or change your filter settings.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const pBadge = priorityBadges[task.priority] || priorityBadges.MEDIUM;
            const requiredCount = task.requiredCredentialIds?.length || 0;
            const isRevoked = !!task.credentialAccessRevoked;

            return (
              <div
                key={task._id}
                className="bg-[#0d0d12] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-4 transition-all"
              >
                {/* Top Task Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-2 py-0.5 rounded-md">
                        {task.taskCode}
                      </span>
                      <h3 className="text-base font-semibold text-white truncate">{task.title}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${pBadge.bg} ${pBadge.text}`}>
                        {pBadge.label}
                      </span>
                      {task.agreedAmount ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-emerald-950/50 border-emerald-800/40 text-emerald-400">
                          ₹{task.agreedAmount.toLocaleString('en-IN')}
                        </span>
                      ) : null}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">{task.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-300">
                        <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
                        <span>{task.projectId?.name || 'Project'}</span>
                      </span>

                      <span className="flex items-center gap-1 text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{task.assignedTo ? `${task.assignedTo.name} (${task.assignedTo.role})` : 'Unassigned'}</span>
                      </span>

                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Due: {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Dropdown & Delete */}
                  <div className="flex items-center gap-3 shrink-0">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task._id, e.target.value)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${
                        task.status === 'COMPLETED'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                          : task.status === 'BLOCKED'
                          ? 'bg-red-950/60 text-red-300 border-red-800/60'
                          : task.status === 'REVIEW'
                          ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                          : 'bg-[#14141b] text-slate-300 border-slate-800'
                      }`}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#14141b] text-slate-200">
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Task Toolbar: Required Credentials & Payments */}
                <div className="pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {/* Credentials Section */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {requiredCount > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-medium ${
                          isRevoked
                            ? 'bg-slate-900 border-slate-700 text-slate-400'
                            : 'bg-amber-950/40 border-amber-800/40 text-amber-300'
                        }`}>
                          <Lock className="w-3.5 h-3.5" />
                          <span>{requiredCount} Required Credential{requiredCount > 1 ? 's' : ''}</span>
                          {isRevoked && <span className="text-[10px] bg-red-950/80 text-red-400 px-1.5 py-0.2 rounded border border-red-800/50 ml-1">REVOKED</span>}
                        </span>

                        {!isRevoked && (
                          <button
                            onClick={() => handleShareTaskCredentials(task)}
                            disabled={actionLoading === task._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-semibold cursor-pointer transition-all disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{actionLoading === task._id ? 'Sharing...' : 'Share via Telegram'}</span>
                          </button>
                        )}

                        {!isRevoked && (
                          <button
                            onClick={() => handleRevokeTaskCredentials(task)}
                            disabled={actionLoading === task._id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-950/50 border border-red-800/30 text-red-400 font-medium cursor-pointer transition-all"
                            title="Revoke access to this task's credentials"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">No specific credentials required</span>
                    )}

                    <button
                      onClick={() => handleViewHistory(task)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
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
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-800/30 text-emerald-300 font-semibold cursor-pointer transition-all"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>+ Record Payment</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Create New Task</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Update WordPress Content"
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Project *</label>
                <select
                  required
                  value={formData.projectId}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Assign To</label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Agreed Payout (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 2500"
                    value={formData.agreedAmount}
                    onChange={(e) => setFormData({ ...formData, agreedAmount: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Task instructions and requirements..."
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Task Required Access (Least Privilege Credentials Selection) */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Required Access</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {formData.requiredCredentialIds.length} selected
                  </span>
                </div>

                <div className="p-3 bg-amber-950/30 border border-amber-500/20 rounded-xl text-amber-300/90 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>⚠️ Only selected credentials will be available to the assigned team member. Unselected credentials remain hidden.</span>
                </div>

                {loadingCredentials ? (
                  <div className="p-4 text-center text-xs text-slate-500">Loading project credentials...</div>
                ) : projectCredentials.length === 0 ? (
                  <div className="p-3 bg-[#14141b] border border-slate-800 rounded-xl text-slate-400 text-xs">
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
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-xs ${
                            selected
                              ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
                              : 'bg-[#14141b] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {}}
                              className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                            <span className="font-medium">{c.service}</span>
                          </div>
                          <span className="text-[10px] uppercase font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                            {c.credentialType || 'Credential'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {formData.requiredCredentialIds.length > 0 && formData.assignedTo && (
                  <label className="flex items-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoShareCredentials}
                      onChange={(e) => setFormData({ ...formData, autoShareCredentials: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span>⚡ Share required credentials automatically via Telegram upon assignment</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Team Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="text-lg font-bold text-white">Record Team Payment</h2>
                <p className="text-xs text-slate-400">For {paymentFormData.teamMemberName}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  placeholder="e.g. 2000"
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Payment Method</label>
                  <select
                    value={paymentFormData.paymentMethod}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentFormData.paymentDate}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentDate: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-92837492"
                  value={paymentFormData.reference}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, reference: e.target.value })}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Status</label>
                <select
                  value={paymentFormData.status}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, status: e.target.value })}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="PAID">PAID (Sends Telegram Receipt)</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={paymentFormData.description}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, description: e.target.value })}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Credential Access History</h2>
                <p className="text-xs text-slate-400 mt-0.5">{activeTaskTitle}</p>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading audit history...</div>
            ) : activeTaskHistory.length === 0 ? (
              <div className="p-8 text-center bg-[#14141b] border border-slate-800/80 rounded-xl text-slate-400 text-xs">
                No credential sharing actions logged yet for this task.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {activeTaskHistory.map((item, idx) => (
                  <div
                    key={item._id || idx}
                    className="p-3 bg-[#14141b] border border-slate-800 rounded-xl text-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{item.serviceName}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                          item.action === 'TASK_CREDENTIAL_REVOKED'
                            ? 'bg-red-950/60 text-red-400 border-red-800/40'
                            : 'bg-indigo-950/60 text-indigo-400 border-indigo-800/40'
                        }`}>
                          {item.action}
                        </span>
                      </div>
                      <p className="text-slate-400">
                        {item.action === 'TASK_CREDENTIAL_REVOKED'
                          ? `Access revoked by ${item.actor}`
                          : `Shared with ${item.teamMemberName || 'Team Member'} by ${item.sharedBy || item.actor}`}
                      </p>
                    </div>

                    <span className="text-[10px] text-slate-500 shrink-0">
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

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
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
