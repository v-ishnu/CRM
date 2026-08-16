'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Coins,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  Send,
  X,
  User,
  FolderKanban,
  CheckSquare,
  Trash2,
  Edit2,
  DollarSign,
  TrendingUp,
  CreditCard,
} from 'lucide-react';

export default function TeamPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalPaid: 0, totalPending: 0, totalCount: 0 });
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals & Actions
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    teamMemberId: '',
    projectId: '',
    taskId: '',
    amount: '',
    paymentMethod: 'UPI',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    status: 'PAID',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (memberFilter) query.set('teamMemberId', memberFilter);
      if (projectFilter) query.set('projectId', projectFilter);
      if (statusFilter) query.set('status', statusFilter);

      const [paymentsRes, membersRes, projectsRes, tasksRes] = await Promise.all([
        fetch(`/api/team-payments?${query.toString()}`),
        fetch('/api/team-members'),
        fetch('/api/projects'),
        fetch('/api/tasks'),
      ]);

      const [paymentsData, membersData, projectsData, tasksData] = await Promise.all([
        paymentsRes.json(),
        membersRes.json(),
        projectsRes.json(),
        tasksRes.json(),
      ]);

      if (paymentsData.success) {
        setPayments(paymentsData.payments || []);
        setSummary(paymentsData.summary || { totalPaid: 0, totalPending: 0, totalCount: 0 });
      }
      if (membersData.success) setTeamMembers(membersData.data || []);
      if (projectsData.success) setProjects(projectsData.data || []);
      if (tasksData.success) setTasks(tasksData.data || []);
    } catch (err) {
      console.error('Failed to fetch team payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, memberFilter, projectFilter, statusFilter]);

  const handleOpenCreate = () => {
    setFormData({
      teamMemberId: teamMembers[0]?._id || '',
      projectId: projects[0]?._id || '',
      taskId: '',
      amount: '',
      paymentMethod: 'UPI',
      paymentDate: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
      status: 'PAID',
    });
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teamMemberId || !formData.projectId || !formData.amount) {
      alert('Team Member, Project, and Amount are required.');
      return;
    }

    try {
      const res = await fetch('/api/team-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount),
          taskId: formData.taskId || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setBannerSuccess(`Payment ${data.data.paymentNumber} recorded successfully!`);
        setTimeout(() => setBannerSuccess(null), 5000);
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to record payment');
      }
    } catch (err) {
      console.error('Create payment error:', err);
    }
  };

  const handleRetryNotification = async (paymentId: string) => {
    setRetryingId(paymentId);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await fetch(`/api/team-payments/${paymentId}/retry-notification`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setBannerSuccess('Telegram payment receipt sent successfully!');
        setTimeout(() => setBannerSuccess(null), 5000);
        fetchData();
      } else {
        setBannerError(data.error?.message || 'Notification retry failed');
        setTimeout(() => setBannerError(null), 6000);
      }
    } catch {
      setBannerError('Notification retry request failed');
    } finally {
      setRetryingId(null);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    try {
      const res = await fetch(`/api/team-payments/${paymentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to delete payment');
      }
    } catch (err) {
      console.error('Delete payment error:', err);
    }
  };

  // Filter tasks based on selected project in form
  const availableProjectTasks = tasks.filter((t) => {
    if (!formData.projectId) return true;
    const pId = t.projectId?._id || t.projectId;
    return pId.toString() === formData.projectId;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Team Payments</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track payouts to team members, task compensation, and automated Telegram payment receipts.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Record Payment</span>
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Total Paid</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            ₹{summary.totalPaid.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500">Disbursed developer compensation</p>
        </div>

        <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Total Pending</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">
            ₹{summary.totalPending.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500">Recorded pending payouts</p>
        </div>

        <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Total Transactions</span>
            <Wallet className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white">{summary.totalCount}</p>
          <p className="text-xs text-slate-500">All-time payment records</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#0d0d12] border border-slate-800/80 p-3 rounded-2xl">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref, desc..."
            className="w-full bg-[#14141b] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Team Members</option>
          {teamMembers.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>

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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400">Loading team payments...</div>
      ) : payments.length === 0 ? (
        <div className="text-center p-12 bg-[#0d0d12] border border-slate-800 rounded-2xl">
          <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No team payments found</h3>
          <p className="text-xs text-slate-400 mt-1">Record a payment or adjust your search filters.</p>
        </div>
      ) : (
        <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#14141b] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4">Payment Ref</th>
                  <th className="p-4">Team Member</th>
                  <th className="p-4">Project & Task</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Method & Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Telegram Receipt</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.map((p) => {
                  const m = p.teamMemberId;
                  const proj = p.projectId;
                  const task = p.taskId;

                  return (
                    <tr key={p._id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Ref */}
                      <td className="p-4 font-mono font-semibold text-indigo-400">
                        {p.paymentNumber}
                        {p.reference && (
                          <div className="text-[10px] font-normal text-slate-500 font-sans mt-0.5">
                            Ref: {p.reference}
                          </div>
                        )}
                      </td>

                      {/* Member */}
                      <td className="p-4">
                        <div className="font-semibold text-white">{m?.name || 'Unknown'}</div>
                        <div className="text-[10px] text-slate-400">{m?.role || 'Member'}</div>
                      </td>

                      {/* Project & Task */}
                      <td className="p-4">
                        <div className="font-medium text-slate-200">{proj?.name || 'Project'}</div>
                        {task ? (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Task: {task.title} (<code>{task.taskCode}</code>)
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">General Payout</div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-4">
                        <span className="text-sm font-bold text-emerald-400">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Method & Date */}
                      <td className="p-4">
                        <div className="font-medium text-slate-300">{p.paymentMethod}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            p.status === 'PAID'
                              ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-400'
                              : p.status === 'PENDING'
                              ? 'bg-amber-950/60 border-amber-800/50 text-amber-400'
                              : 'bg-red-950/60 border-red-800/50 text-red-400'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      {/* Telegram Notification */}
                      <td className="p-4">
                        {p.notificationStatus === 'SENT' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Sent</span>
                          </span>
                        ) : p.notificationStatus === 'FAILED' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Failed</span>
                            </span>
                            <button
                              onClick={() => handleRetryNotification(p._id)}
                              disabled={retryingId === p._id}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer"
                              title="Retry Telegram delivery"
                            >
                              {retryingId === p._id ? '...' : 'Retry'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeletePayment(p._id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete payment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#0d0d12] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Record Team Payment</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Team Member *</label>
                  <select
                    required
                    value={formData.teamMemberId}
                    onChange={(e) => setFormData({ ...formData, teamMemberId: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Member</option>
                    {teamMembers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Project *</label>
                  <select
                    required
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value, taskId: '' })}
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
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Linked Task <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <select
                  value={formData.taskId}
                  onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">No linked task (General Project Payout)</option>
                  {availableProjectTasks.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.title} ({t.taskCode}) - Agreed: ₹{t.agreedAmount || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 5000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={formData.paymentDate}
                    onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PAID">PAID (Sends Telegram Receipt)</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-491823902"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Front-end design milestone payout"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#14141b] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
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
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
