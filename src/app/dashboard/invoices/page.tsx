'use client';

import React, { useEffect, useState } from 'react';
import { Search, FileText, Download, Send, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  invoiceDate: string;
  dueDate?: string;
  telegramSent: boolean;
  clientId: {
    _id: string;
    name: string;
    clientCode: string;
    telegramConnected: boolean;
  };
  projectId: {
    name: string;
  };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (statusFilter) query.append('status', statusFilter);

      const res = await fetch(`/api/invoices?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setInvoices(json.data);
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  const handleSendTelegram = async (invoiceId: string) => {
    setSendingId(invoiceId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send-telegram`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setActionSuccess(json.message || 'Invoice sent via Telegram!');
        fetchInvoices(); // Reload
      } else {
        setActionError(json.error?.message || 'Failed to dispatch invoice via Telegram');
      }
    } catch (err) {
      setActionError('An error occurred connecting to server.');
    } finally {
      setSendingId(null);
    }
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      DRAFT: 'bg-slate-905 border border-slate-700 text-slate-400',
      ISSUED: 'bg-blue-950/40 text-blue-400 border border-blue-900/30',
      PARTIALLY_PAID: 'bg-amber-950/40 text-amber-400 border border-amber-900/30',
      PAID: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30',
      OVERDUE: 'bg-red-950/40 text-red-400 border border-red-900/30',
      CANCELLED: 'bg-slate-900 border border-slate-800 text-slate-500',
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Invoices & Billing</h1>
          <p className="text-slate-400 text-sm">Generate line items, download billing summaries, and audit payment balances.</p>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-950/45 border border-red-500/20 text-red-300 rounded-xl text-sm">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 bg-emerald-950/45 border border-emerald-500/20 text-emerald-305 rounded-xl text-sm">
          {actionSuccess}
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#0d0d12]/60 border border-slate-850 p-4 rounded-xl flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-stretch sm:items-center">
        <form onSubmit={handleSearch} className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-550" />
          <input
            type="text"
            placeholder="Search by invoice number..."
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

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-950/65 border border-slate-800 text-slate-350 text-sm rounded-xl outline-none focus:border-indigo-500 transition-all cursor-pointer w-full sm:w-44"
          >
            <option value="">All Invoice States</option>
            <option value="ISSUED">Issued</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
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
      ) : invoices.length === 0 ? (
        <div className="bg-[#0d0d12]/40 border border-slate-850 p-8 sm:p-12 rounded-xl text-center flex flex-col items-center justify-center text-slate-500">
          <FileText className="w-12 h-12 mb-3 stroke-1 text-slate-650" />
          <h3 className="font-bold text-slate-300">No invoices generated</h3>
          <p className="text-sm text-slate-500 mt-1">Invoices are automatically created during client onboarding.</p>
        </div>
      ) : (
        <div className="bg-[#0d0d12]/40 border border-slate-850 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/35 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-4 sm:px-6 py-4">Invoice #</th>
                  <th className="px-4 sm:px-6 py-4">Client</th>
                  <th className="px-4 sm:px-6 py-4">Project</th>
                  <th className="px-4 sm:px-6 py-4">Issue Date</th>
                  <th className="px-4 sm:px-6 py-4">Due Date</th>
                  <th className="px-4 sm:px-6 py-4 text-right">Total Amount</th>
                  <th className="px-4 sm:px-6 py-4 text-center">Telegram</th>
                  <th className="px-4 sm:px-6 py-4 text-right">Status</th>
                  <th className="px-4 sm:px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-sm">
                {invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-900/20 transition-all">
                    <td className="px-4 sm:px-6 py-4 font-bold text-slate-200">{inv.invoiceNumber}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <Link
                        href={`/dashboard/clients/${inv.clientId._id}`}
                        className="font-medium text-indigo-400 hover:underline"
                      >
                        {inv.clientId.name}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">Code: {inv.clientId.clientCode}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-350">{inv.projectId.name}</td>
                    <td className="px-4 sm:px-6 py-4 text-slate-400 whitespace-nowrap">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-400 whitespace-nowrap">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : 'On Receipt'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-bold text-slate-100 whitespace-nowrap">
                      {inv.currency} {inv.total.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-center">
                      {inv.telegramSent ? (
                        <span className="text-[10px] font-bold text-emerald-450 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">Sent</span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Not Sent</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">{getStatusBadge(inv.status)}</td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <a
                          href={`/api/invoices/${inv._id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-450 hover:text-slate-205 rounded-lg transition-all"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleSendTelegram(inv._id)}
                          disabled={!inv.clientId.telegramConnected || sendingId === inv._id}
                          className={`p-2 rounded-lg border text-xs font-semibold flex items-center transition-all
                            ${inv.clientId.telegramConnected 
                              ? 'bg-indigo-650/15 hover:bg-indigo-650/25 border-indigo-500/20 text-indigo-400' 
                              : 'bg-slate-900 border-slate-800 text-slate-650 cursor-not-allowed'
                            }
                          `}
                          title={inv.clientId.telegramConnected ? 'Send via Telegram' : 'Client Telegram not connected'}
                        >
                          {sendingId === inv._id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
