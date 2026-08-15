'use client';

import React, { useEffect, useState } from 'react';
import { Search, CreditCard, Plus, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Payment {
  _id: string;
  paymentNumber: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentDate: string;
  transactionReference?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  notes?: string;
  clientId: {
    _id: string;
    name: string;
    clientCode: string;
  };
  projectId: {
    _id: string;
    name: string;
    projectCode: string;
  };
  invoiceId?: {
    _id: string;
    invoiceNumber: string;
  };
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

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (statusFilter) query.append('status', statusFilter);

      const res = await fetch(`/api/payments?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
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

  // Load clients and projects when launching the form
  const handleOpenModal = async () => {
    setShowModal(true);
    setFormError(null);
    try {
      // Fetch clients
      const clientsRes = await fetch('/api/clients?limit=100');
      const clientsJson = await clientsRes.json();
      if (clientsJson.success) {
        setClientsList(clientsJson.clients);
      }

      // Fetch projects
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
      projectId: '', // Reset project on client switch
    }));
    
    // Filter projects matching selected client
    const matches = projectsList.filter((p) => p.clientId.toString() === clientId || (p.clientId as any)._id === clientId);
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
        // Reset form
        setFormData({
          clientId: '',
          projectId: '',
          amount: '',
          paymentMethod: 'BANK_TRANSFER',
          transactionReference: '',
          paymentDate: new Date().toISOString().split('T')[0],
          notes: '',
        });
        fetchPayments(); // Reload listings
      } else {
        setFormError(json.error?.message || 'Failed to record transaction');
      }
    } catch (err) {
      setFormError('An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: Payment['status']) => {
    const styles = {
      PENDING: 'bg-yellow-950/40 text-yellow-405 border border-yellow-800/30',
      COMPLETED: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30',
      FAILED: 'bg-red-950/40 text-red-400 border border-red-900/30',
      REFUNDED: 'bg-slate-905 border border-slate-700 text-slate-400',
    };
    return (
      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Transaction History</h1>
          <p className="text-slate-400 text-sm">Review deposits, UPIs, cash journals, and invoices linked payments.</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center px-4 py-2 bg-indigo-650 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/10"
        >
          <Plus className="w-4 h-4 mr-2" />
          Record Payment
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#0d0d12]/60 border border-slate-850 p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearch} className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-550" />
          <input
            type="text"
            placeholder="Search by receipt number or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-20 py-2 bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1.5 px-3 py-1 bg-indigo-650 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase rounded-lg tracking-wider"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-4 w-full md:w-auto shrink-0 justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-950/65 border border-slate-800 text-slate-350 text-sm rounded-xl outline-none focus:border-indigo-500 transition-all cursor-pointer w-full sm:w-44"
          >
            <option value="">All Payment States</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 w-full bg-slate-900 animate-pulse rounded-xl"></div>
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-[#0d0d12]/40 border border-slate-850 p-12 rounded-xl text-center flex flex-col items-center justify-center text-slate-500">
          <CreditCard className="w-12 h-12 mb-3 stroke-1 text-slate-650" />
          <h3 className="font-bold text-slate-300">No transactions recorded</h3>
          <p className="text-sm text-slate-500 mt-1">Log payments on client profile pages or click &apos;Record Payment&apos;.</p>
        </div>
      ) : (
        <div className="bg-[#0d0d12]/40 border border-slate-850 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/35 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Receipt #</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Method / Ref</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-sm">
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-900/20 transition-all">
                    <td className="px-6 py-4 font-bold text-slate-200">{p.paymentNumber}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/clients/${p.clientId._id}`}
                        className="font-medium text-indigo-400 hover:underline"
                      >
                        {p.clientId.name}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">Code: {p.clientId.clientCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-350">{p.projectId.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.invoiceId ? `Invoice: ${p.invoiceId.invoiceNumber}` : 'Direct Deposit'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-350 font-semibold">{p.paymentMethod}</div>
                      {p.transactionReference && (
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{p.transactionReference}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-100">
                      {p.currency} {p.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right">{getStatusBadge(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#0d0d12] border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-slate-100 mb-2">Record Payment Transaction</h2>
            <p className="text-xs text-slate-500 mb-5">Select a client, match project files, and post transaction logs.</p>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/20 text-red-300 rounded-xl text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Client</label>
                <select
                  required
                  value={formData.clientId}
                  onChange={(e) => handleClientSelectionChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">Select client...</option>
                  {clientsList.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.clientCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Project File</label>
                <select
                  required
                  disabled={!formData.clientId}
                  value={formData.projectId}
                  onChange={handleFormChange}
                  name="projectId"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">Select project...</option>
                  {filteredProjects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (Budget: Rs. {p.totalAmount.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount (INR)</label>
                  <input
                    type="number"
                    name="amount"
                    required
                    value={formData.amount}
                    onChange={handleFormChange}
                    placeholder="20000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Method</label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="RAZORPAY">Razorpay</option>
                    <option value="STRIPE">Stripe</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Date</label>
                  <input
                    type="date"
                    name="paymentDate"
                    required
                    value={formData.paymentDate}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Txn Reference ID</label>
                  <input
                    type="text"
                    name="transactionReference"
                    value={formData.transactionReference}
                    onChange={handleFormChange}
                    placeholder="Ref ID / UTR"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-205 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  value={formData.notes}
                  onChange={handleFormChange}
                  placeholder="Record note..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-205 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-805 text-slate-400 rounded-xl text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center px-5 py-2 bg-indigo-650 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-55"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin mr-1.5" />
                      Posting...
                    </>
                  ) : (
                    'Record Entry'
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
