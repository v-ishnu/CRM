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
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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

  const availableProjectTasks = tasks.filter((t) => {
    if (!formData.projectId) return true;
    const pId = t.projectId?._id || t.projectId;
    return pId.toString() === formData.projectId;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        tag="FINANCE // TEAM PAYOUTS"
        title="Team Member Compensation"
        description="Track payouts to developer team members, task milestone compensation, and automated Telegram payment receipts."
        action={
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            icon={<Plus className="w-4 h-4" />}
          >
            RECORD PAYOUT
          </Button>
        }
      />

      {/* Alert Banners */}
      {bannerSuccess && (
        <div className="p-3.5 bg-[#0e1f15] border border-[#00d664]/40 text-[#00d664] text-xs font-mono flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#00d664] shrink-0" />
          <span>{bannerSuccess}</span>
        </div>
      )}
      {bannerError && (
        <div className="p-3.5 bg-[#1c1110] border border-[#ff3e00]/40 text-[#ff8a7a] text-xs font-mono flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#ff3e00] shrink-0" />
          <span>{bannerError}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141416] border border-[#242428] p-5 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider">
            <span>DISBURSED COMP</span>
            <Coins className="w-4 h-4 text-[#00d664]" />
          </div>
          <p className="text-2xl font-bold font-mono text-[#00d664]">
            ₹{summary.totalPaid.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] font-mono text-[#6b6b76]">DISBURSED DEVELOPER PAYOUTS</p>
        </div>

        <div className="bg-[#141416] border border-[#242428] p-5 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider">
            <span>PENDING SETTLEMENT</span>
            <Clock className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <p className="text-2xl font-bold font-mono text-[#f59e0b]">
            ₹{summary.totalPending.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] font-mono text-[#6b6b76]">RECORDED UNCONFIRMED PAYOUTS</p>
        </div>

        <div className="bg-[#141416] border border-[#242428] p-5 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider">
            <span>TOTAL TRANSFERS</span>
            <Wallet className="w-4 h-4 text-[#ff3e00]" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">{summary.totalCount}</p>
          <p className="text-[11px] font-mono text-[#6b6b76]">ALL-TIME LEDGER ENTRIES</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#141416] border border-[#242428] p-3">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8a8a93]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref, desc..."
            className="w-full bg-[#0a0a0a] border border-[#242428] pl-8 pr-3 py-1.5 text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00]"
          />
        </div>

        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="bg-[#0a0a0a] border border-[#242428] px-3 py-1.5 text-xs text-[#8a8a93] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
        >
          <option value="">ALL TEAM MEMBERS</option>
          {teamMembers.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-[#0a0a0a] border border-[#242428] px-3 py-1.5 text-xs text-[#8a8a93] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
        >
          <option value="">ALL PROJECTS</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} ({p.projectCode})
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0a0a0a] border border-[#242428] px-3 py-1.5 text-xs text-[#8a8a93] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
        >
          <option value="">ALL STATUSES</option>
          <option value="PAID">PAID</option>
          <option value="PENDING">PENDING</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 w-full bg-[#141416] border border-[#242428] animate-pulse"></div>
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center p-12 bg-[#141416] border border-[#242428]">
          <Wallet className="w-10 h-10 text-[#4a4a52] stroke-1 mx-auto mb-3" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#f5f5f2]">No team payments found</h3>
          <p className="text-xs text-[#8a8a93] mt-1 font-mono">Record a payment or adjust your search filters.</p>
        </div>
      ) : (
        <div className="bg-[#141416] border border-[#242428] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0a0a0a] text-[#8a8a93] font-mono text-[10px] uppercase tracking-wider border-b border-[#242428]">
                <tr>
                  <th className="px-5 py-3">Payment Ref</th>
                  <th className="px-5 py-3">Team Member</th>
                  <th className="px-5 py-3">Project & Task</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Method & Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Telegram Receipt</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242428]">
                {payments.map((p) => {
                  const m = p.teamMemberId;
                  const proj = p.projectId;
                  const task = p.taskId;

                  return (
                    <tr key={p._id} className="hover:bg-[#18181b] transition-colors">
                      {/* Ref */}
                      <td className="px-5 py-3.5 font-mono font-bold text-white tracking-wide">
                        {p.paymentNumber}
                        {p.reference && (
                          <div className="text-[10px] font-normal text-[#8a8a93] font-mono mt-0.5">
                            REF: {p.reference}
                          </div>
                        )}
                      </td>

                      {/* Member */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white">{m?.name || 'Unknown'}</div>
                        <div className="text-[10px] font-mono text-[#8a8a93] uppercase">{m?.role || 'Member'}</div>
                      </td>

                      {/* Project & Task */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-[#f5f5f2]">{proj?.name || 'Project'}</div>
                        {task ? (
                          <div className="text-[10px] font-mono text-[#8a8a93] mt-0.5">
                            TASK: {task.title} (<span className="text-[#ff3e00]">{task.taskCode}</span>)
                          </div>
                        ) : (
                          <div className="text-[10px] text-[#6b6b76] italic font-mono mt-0.5">General Payout</div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-white text-sm">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Method & Date */}
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-white text-xs">{p.paymentMethod}</div>
                        <div className="text-[10px] font-mono text-[#8a8a93]">
                          {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={p.status === 'PAID' ? 'active' : p.status === 'PENDING' ? 'warning' : 'danger'}
                          size="sm"
                        >
                          {p.status}
                        </Badge>
                      </td>

                      {/* Telegram Notification */}
                      <td className="px-5 py-3.5">
                        {p.notificationStatus === 'SENT' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#00d664]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>DELIVERED</span>
                          </span>
                        ) : p.notificationStatus === 'FAILED' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#ff3e00]">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>FAILED</span>
                            </span>
                            <button
                              onClick={() => handleRetryNotification(p._id)}
                              disabled={retryingId === p._id}
                              className="px-1.5 py-0.5 bg-[#0a0a0a] border border-[#242428] hover:border-[#ff3e00] text-[#8a8a93] hover:text-white text-[9px] font-mono uppercase cursor-pointer"
                              title="Retry Telegram delivery"
                            >
                              {retryingId === p._id ? '...' : 'RETRY'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-[#6b6b76]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleDeletePayment(p._id)}
                          className="p-1.5 text-[#8a8a93] hover:text-[#ff3e00] transition-colors cursor-pointer"
                          title="Delete payment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
          <div className="bg-[#141416] border border-[#242428] shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#242428] pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
                <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-widest ml-1">
                  PAYROLL::DISBURSEMENT
                </span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-[#8a8a93] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Team Member *
                  </label>
                  <select
                    required
                    value={formData.teamMemberId}
                    onChange={(e) => setFormData({ ...formData, teamMemberId: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3 py-2 text-xs text-[#f5f5f2] focus:outline-none focus:border-[#ff3e00] font-sans cursor-pointer"
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
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Project *
                  </label>
                  <select
                    required
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value, taskId: '' })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3 py-2 text-xs text-[#f5f5f2] focus:outline-none focus:border-[#ff3e00] font-sans cursor-pointer"
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
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Linked Task <span className="text-[#6b6b76]">(Optional)</span>
                </label>
                <select
                  value={formData.taskId}
                  onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3 py-2 text-xs text-[#f5f5f2] focus:outline-none focus:border-[#ff3e00] font-sans cursor-pointer"
                >
                  <option value="">No linked task (General Project Payout)</option>
                  {availableProjectTasks.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.title} ({t.taskCode}) - Agreed: ₹{t.agreedAmount || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 5000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3 py-2 text-xs text-[#f5f5f2] font-mono font-bold focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3 py-2 text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="CASH">CASH</option>
                    <option value="PAYPAL">PAYPAL</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.paymentDate}
                    onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3 py-2 text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3 py-2 text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
                  >
                    <option value="PAID">PAID (Sends Telegram Receipt)</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Reference / Transaction ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI-491823902"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3 py-2 text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Description / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Frontend telemetry & design milestone payout"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3 py-2 text-xs text-[#f5f5f2] focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#0a0a0a] hover:bg-[#242428] border border-[#242428] text-[#8a8a93] hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white text-xs font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer"
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
