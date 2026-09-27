'use client';

import React, { useEffect, useState } from 'react';
import { Search, CreditCard, Plus, CheckCircle2, XCircle, Loader2, X, Gift, Lock } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useMasterData } from '@/hooks/useMasterData';

interface Payment {
  _id: string;
  paymentNumber: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentType?: string;
  paymentDate: string;
  transactionReference?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  notes?: string;
  clientId?: {
    _id: string;
    name: string;
    clientCode: string;
  } | null;
  projectId?: {
    _id: string;
    name: string;
    projectCode: string;
  } | null;
  invoiceId?: {
    _id: string;
    invoiceNumber: string;
  } | null;
}

interface ClientBrief {
  _id: string;
  name: string;
  clientCode: string;
}

interface ProjectBrief {
  _id: string;
  name: string;
  projectCode: string;
  clientId: string;
  totalAmount: number;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const { items: masterPaymentMethods } = useMasterData('PAYMENT_METHOD');

  const defaultPaymentMethods = [
    { key: 'BANK_TRANSFER', label: 'BANK TRANSFER' },
    { key: 'UPI', label: 'UPI' },
    { key: 'CASH', label: 'CASH' },
    { key: 'RAZORPAY', label: 'RAZORPAY' },
    { key: 'STRIPE', label: 'STRIPE' },
    { key: 'OTHER', label: 'OTHER' },
  ];

  const renderedPaymentMethods = masterPaymentMethods.length > 0
    ? masterPaymentMethods.map((m) => ({ key: m.key, label: m.label }))
    : defaultPaymentMethods;

  // Record Payment Modal State
  const [showModal, setShowModal] = useState(false);
  const [clientsList, setClientsList] = useState<ClientBrief[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectBrief[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectBrief[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clientId: '',
    projectId: '',
    amount: '',
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Record Client Bonus Modal State (Internal Only)
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [submittingBonus, setSubmittingBonus] = useState(false);
  const [bonusFormError, setBonusFormError] = useState<string | null>(null);
  const [bonusFilteredProjects, setBonusFilteredProjects] = useState<ProjectBrief[]>([]);
  const [bonusFormData, setBonusFormData] = useState({
    clientId: '',
    projectId: '',
    amount: '',
    currency: 'INR',
    paymentMethod: 'UPI',
    transactionReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    reason: '',
    notes: '',
  });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (statusFilter) query.append('status', statusFilter);

      const res = await fetch(`/api/payments?${query.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPayments(json.data);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleOpenModal = async () => {
    setShowModal(true);
    setFormError(null);
    try {
      const clientsRes = await fetch('/api/clients?limit=100');
      const clientsJson = await clientsRes.json();
      if (clientsJson.success) {
        setClientsList(clientsJson.clients);
      }

      const projectsRes = await fetch('/api/projects');
      const projectsJson = await projectsRes.json();
      if (projectsJson.success) {
        setProjectsList(projectsJson.data);
      }
    } catch (err) {
      console.error('Failed to pre-load form dependencies:', err);
    }
  };

  const handleClientSelectionChange = (clientId: string) => {
    setFormData((prev) => ({
      ...prev,
      clientId,
      projectId: '',
    }));
    
    const matches = projectsList.filter((p) => p.clientId?.toString() === clientId || (p.clientId as any)?._id === clientId);
    setFilteredProjects(matches);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    if (!formData.clientId || !formData.projectId || !formData.amount) {
      setFormError('Please fill out Client, Project, and Amount fields.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        setFormData({
          clientId: '',
          projectId: '',
          amount: '',
          paymentMethod: 'BANK_TRANSFER',
          transactionReference: '',
          paymentDate: new Date().toISOString().split('T')[0],
          notes: '',
        });
        fetchPayments();
      } else {
        setFormError(json.error?.message || 'Failed to record transaction');
      }
    } catch (err) {
      setFormError('An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenBonusModal = async () => {
    setShowBonusModal(true);
    setBonusFormError(null);
    try {
      if (clientsList.length === 0) {
        const clientsRes = await fetch('/api/clients?limit=100');
        const clientsJson = await clientsRes.json();
        if (clientsJson.success) {
          setClientsList(clientsJson.clients);
        }
      }
      if (projectsList.length === 0) {
        const projectsRes = await fetch('/api/projects');
        const projectsJson = await projectsRes.json();
        if (projectsJson.success) {
          setProjectsList(projectsJson.data);
        }
      }
    } catch (err) {
      console.error('Failed to pre-load form dependencies:', err);
    }
  };

  const handleBonusClientSelectionChange = (clientId: string) => {
    setBonusFormData((prev) => ({
      ...prev,
      clientId,
      projectId: '',
    }));
    const matches = projectsList.filter(
      (p) => p.clientId?.toString() === clientId || (p.clientId as any)?._id === clientId
    );
    setBonusFilteredProjects(matches);
  };

  const handleBonusFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setBonusFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBonusFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBonusFormError(null);
    setSubmittingBonus(true);

    if (!bonusFormData.clientId || !bonusFormData.amount) {
      setBonusFormError('Please select a Client and enter a Bonus Amount.');
      setSubmittingBonus(false);
      return;
    }

    const numAmount = Number(bonusFormData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setBonusFormError('Bonus amount must be a valid positive number.');
      setSubmittingBonus(false);
      return;
    }

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: bonusFormData.clientId,
          projectId: bonusFormData.projectId || undefined,
          amount: numAmount,
          currency: bonusFormData.currency,
          paymentMethod: bonusPaymentMethodName(bonusFormData.paymentMethod),
          paymentType: 'CLIENT_BONUS',
          transactionReference: bonusFormData.transactionReference || undefined,
          paymentDate: new Date(bonusFormData.paymentDate).toISOString(),
          notes: [bonusFormData.reason ? `Reason: ${bonusFormData.reason}` : '', bonusFormData.notes]
            .filter(Boolean)
            .join(' | ') || undefined,
          notifyClient: false,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowBonusModal(false);
        setBonusFormData({
          clientId: '',
          projectId: '',
          amount: '',
          currency: 'INR',
          paymentMethod: 'UPI',
          transactionReference: '',
          paymentDate: new Date().toISOString().split('T')[0],
          reason: '',
          notes: '',
        });
        fetchPayments();
      } else {
        setBonusFormError(json.error?.message || 'Failed to record client bonus');
      }
    } catch (err) {
      setBonusFormError('An error occurred during submission.');
    } finally {
      setSubmittingBonus(false);
    }
  };

  const bonusPaymentMethodName = (m: string) => m || 'UPI';

  const renderStatusBadge = (status: Payment['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="active" size="sm">COMPLETED</Badge>;
      case 'PENDING':
        return <Badge variant="warning" size="sm">PENDING</Badge>;
      case 'FAILED':
        return <Badge variant="danger" size="sm">FAILED</Badge>;
      case 'REFUNDED':
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        tag="FINANCE // CLIENT TRANSACTIONS"
        title="Transaction History"
        description="Review incoming deposits, bank transfers, UPI transactions, and invoices linked payments."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenBonusModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#18181b] hover:bg-amber-500 hover:text-black border border-amber-500/40 text-amber-400 text-xs font-mono uppercase tracking-wider font-semibold rounded-none md:rounded-xs transition-all cursor-pointer"
            >
              <Gift className="w-3.5 h-3.5" />
              ADD BONUS
            </button>
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenModal}
              icon={<Plus className="w-4 h-4" />}
            >
              RECORD PAYMENT
            </Button>
          </div>
        }
      />

      {/* Filters Toolbar */}
      <div className="bg-[#141416] border border-[#242428] p-4 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <form onSubmit={handleSearch} className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#8a8a93]" />
          <input
            type="text"
            placeholder="Search by receipt # or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-20 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1 px-3 py-1 bg-white text-black hover:bg-[#ff3e00] hover:text-white text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="crm-select-sm w-full sm:w-48"
          >
            <option value="">ALL STATES</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="PENDING">PENDING</option>
            <option value="REFUNDED">REFUNDED</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 w-full bg-[#141416] border border-[#242428] animate-pulse"></div>
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-[#141416] border border-[#242428] p-12 text-center flex flex-col items-center justify-center text-[#8a8a93]">
          <CreditCard className="w-10 h-10 mb-3 text-[#4a4a52] stroke-1" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-[#f5f5f2]">No transactions recorded</h3>
          <p className="text-xs text-[#8a8a93] mt-1 font-mono">Log payments on client profile pages or click &apos;Record Payment&apos;.</p>
        </div>
      ) : (
        <div className="bg-[#141416] border border-[#242428] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#242428] bg-[#0a0a0a] text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Receipt #</th>
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">Project</th>
                  <th className="px-5 py-3 font-semibold">Method / Ref</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold text-right">Amount</th>
                  <th className="px-5 py-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242428] text-xs">
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-[#18181b] transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-white tracking-wide">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{p.paymentNumber}</span>
                        {p.paymentType === 'CLIENT_BONUS' && (
                          <span className="px-1.5 py-0.5 rounded-none md:rounded-xs text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            CLIENT BONUS
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {p.clientId ? (
                        <>
                          <Link
                            href={`/dashboard/clients/${p.clientId._id}`}
                            className="font-medium text-[#f5f5f2] hover:text-[#ff3e00] transition-colors"
                          >
                            {p.clientId.name}
                          </Link>
                          <div className="text-[10px] font-mono text-[#8a8a93] mt-0.5">
                            CODE: {p.clientId.clientCode}
                          </div>
                        </>
                      ) : (
                        <span className="text-[#6b6b76] italic font-mono text-[11px]">Unassigned Client</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[#f5f5f2] font-medium">
                        {p.projectId?.name || (p.paymentType === 'CLIENT_BONUS' ? (
                          <span className="text-amber-400/90 font-mono text-[11px]">Direct Client Bonus</span>
                        ) : (
                          <span className="text-[#6b6b76] italic font-mono text-[11px]">Unassigned Project</span>
                        ))}
                      </div>
                      <div className="text-[10px] font-mono text-[#8a8a93] mt-0.5">
                        {p.paymentType === 'CLIENT_BONUS' ? (
                          <span className="text-amber-400/70">INTERNAL BONUS</span>
                        ) : (
                          p.invoiceId ? `INV: ${p.invoiceId.invoiceNumber}` : 'DIRECT DEPOSIT'
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[#f5f5f2] font-mono font-semibold uppercase">{p.paymentMethod}</div>
                      {p.transactionReference && (
                        <div className="text-[10px] text-[#8a8a93] font-mono mt-0.5">{p.transactionReference}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#8a8a93] whitespace-nowrap">
                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-white whitespace-nowrap">
                      {p.currency} {p.amount ? p.amount.toLocaleString('en-IN') : 0}
                    </td>
                    <td className="px-5 py-3.5 text-right">{renderStatusBadge(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-[#141416] border border-[#242428] shadow-2xl relative p-6">
            {/* Terminal Header */}
            <div className="flex items-center justify-between border-b border-[#242428] pb-4 mb-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#242428]" />
                <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-widest ml-1">
                  FINANCE::RECORD_PAYMENT
                </span>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-[#8a8a93] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-base font-bold text-white mb-1">Record Payment Transaction</h2>
            <p className="text-xs text-[#8a8a93] mb-5 font-mono">Match client project files and post verified ledger transactions.</p>
            
            {formError && (
              <div className="mb-4 p-3 bg-[#1c1110] border border-[#ff3e00]/40 text-[#ff8a7a] text-xs font-mono">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Client Account *
                </label>
                <select
                  required
                  value={formData.clientId}
                  onChange={(e) => handleClientSelectionChange(e.target.value)}
                  className="crm-select"
                >
                  <option value="">Select client account...</option>
                  {clientsList.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.clientCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Project Ledger *
                </label>
                <select
                  required
                  disabled={!formData.clientId}
                  value={formData.projectId}
                  onChange={handleFormChange}
                  name="projectId"
                  className="crm-select"
                >
                  <option value="">Select linked project...</option>
                  {filteredProjects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (Budget: ₹{p.totalAmount.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Amount (INR) *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    required
                    value={formData.amount}
                    onChange={handleFormChange}
                    placeholder="25000"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono font-bold focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Payment Method
                  </label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleFormChange}
                    className="crm-select font-mono"
                  >
                    {renderedPaymentMethods.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                    {formData.paymentMethod && !renderedPaymentMethods.some((m) => m.key === formData.paymentMethod) && (
                      <option value={formData.paymentMethod}>{formData.paymentMethod} (Inactive)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    name="paymentDate"
                    required
                    value={formData.paymentDate}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Txn Reference ID
                  </label>
                  <input
                    type="text"
                    name="transactionReference"
                    value={formData.transactionReference}
                    onChange={handleFormChange}
                    placeholder="UTR / Bank Ref ID"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Internal Journal Notes
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  value={formData.notes}
                  onChange={handleFormChange}
                  placeholder="Additional settlement telemetry or notes..."
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-4 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[#0a0a0a] hover:bg-[#242428] border border-[#242428] text-[#8a8a93] hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-white text-black hover:bg-[#ff3e00] hover:text-white text-xs font-mono font-semibold uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      POSTING...
                    </>
                  ) : (
                    'RECORD ENTRY'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Client Bonus Modal (Internal Only) */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] w-full max-w-lg p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowBonusModal(false)}
              className="absolute top-5 right-5 text-[#8a8a93] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-5 space-y-1">
              <span className="font-mono text-[10px] text-amber-400 uppercase font-bold tracking-widest flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5" />
                FINANCIAL LEDGER // CLIENT BONUS
              </span>
              <h2 className="text-base font-semibold text-white tracking-tight">Record Client Bonus</h2>
              <p className="text-xs text-[#8a8a93] font-mono">
                Log additional appreciation or bonus received. Internal accounting only.
              </p>
            </div>

            {/* Internal Only Callout */}
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-none md:rounded-xs text-[11px] font-mono text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-400" />
                INTERNAL ACCOUNTING ONLY
              </div>
              <p className="text-[10px] text-amber-200/80 leading-relaxed">
                The client will NEVER receive any Telegram message, payment receipt, email, or invoice notification.
                This bonus does NOT reduce the client&apos;s project outstanding balance.
              </p>
            </div>

            {bonusFormError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{bonusFormError}</span>
              </div>
            )}

            <form onSubmit={handleBonusFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Client Account *
                </label>
                <select
                  required
                  value={bonusFormData.clientId}
                  onChange={(e) => handleBonusClientSelectionChange(e.target.value)}
                  className="crm-select"
                >
                  <option value="">Select client account...</option>
                  {clientsList.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.clientCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Project Ledger (Optional)
                </label>
                <select
                  value={bonusFormData.projectId}
                  onChange={handleBonusFormChange}
                  name="projectId"
                  className="crm-select"
                  disabled={!bonusFormData.clientId}
                >
                  <option value="">No Project (Direct Client Bonus)</option>
                  {bonusFilteredProjects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.projectCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Bonus Amount *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    name="amount"
                    value={bonusFormData.amount}
                    onChange={handleBonusFormChange}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Currency *
                  </label>
                  <select
                    name="currency"
                    value={bonusFormData.currency}
                    onChange={handleBonusFormChange}
                    className="crm-select font-mono"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Payment Method *
                  </label>
                  <select
                    name="paymentMethod"
                    value={bonusFormData.paymentMethod}
                    onChange={handleBonusFormChange}
                    className="crm-select font-mono"
                    required
                  >
                    {renderedPaymentMethods.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                    {bonusFormData.paymentMethod && !renderedPaymentMethods.some((m) => m.key === bonusFormData.paymentMethod) && (
                      <option value={bonusFormData.paymentMethod}>{bonusFormData.paymentMethod}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                    Received Date *
                  </label>
                  <input
                    type="date"
                    required
                    name="paymentDate"
                    value={bonusFormData.paymentDate}
                    onChange={handleBonusFormChange}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Reason / Description
                </label>
                <input
                  type="text"
                  name="reason"
                  value={bonusFormData.reason}
                  onChange={handleBonusFormChange}
                  placeholder="e.g. Appreciation for early delivery"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Transaction Reference
                </label>
                <input
                  type="text"
                  name="transactionReference"
                  value={bonusFormData.transactionReference}
                  onChange={handleBonusFormChange}
                  placeholder="UTR / UPI Ref ID"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Internal Journal Notes
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  value={bonusFormData.notes}
                  onChange={handleBonusFormChange}
                  placeholder="Additional settlement notes..."
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-4 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowBonusModal(false)}
                  className="px-4 py-2 bg-[#0a0a0a] hover:bg-[#242428] border border-[#242428] text-[#8a8a93] hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBonus}
                  className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-semibold uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
                >
                  {submittingBonus ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      RECORDING...
                    </>
                  ) : (
                    <>
                      <Gift className="w-3.5 h-3.5" />
                      RECORD BONUS (INTERNAL)
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
