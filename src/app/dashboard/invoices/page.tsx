'use client';

import React, { useEffect, useState } from 'react';
import { Search, FileText, Download, Send, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  invoiceDate: string;
  dueDate?: string;
  telegramSent: boolean;
  clientId?: {
    _id: string;
    name: string;
    clientCode: string;
    telegramConnected?: boolean;
  } | null;
  projectId?: {
    name: string;
  } | null;
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
      if (json.success && Array.isArray(json.data)) {
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
        setActionSuccess(json.message || 'Invoice dispatched via Telegram successfully.');
        fetchInvoices(); // Reload
      } else {
        setActionError(json.error?.message || 'Failed to dispatch invoice via Telegram');
      }
    } catch (err) {
      setActionError('An error occurred connecting to telemetry server.');
    } finally {
      setSendingId(null);
    }
  };

  const renderStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="active" size="sm">{status}</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="warning" size="sm">{status.replace('_', ' ')}</Badge>;
      case 'ISSUED':
        return <Badge variant="blue" size="sm">{status}</Badge>;
      case 'OVERDUE':
        return <Badge variant="danger" size="sm">{status}</Badge>;
      case 'DRAFT':
      case 'CANCELLED':
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dr. Debuggers Standard Page Header */}
      <PageHeader
        tag="FINANCE // INVOICES & BILLING"
        title="Invoices & Billing"
        description="Audit client receivables, generate settlement PDFs, and dispatch automated Telegram notices."
      />

      {actionError && (
        <div className="p-3.5 bg-[#1c1110] border border-[#ff3e00]/40 text-[#ff8a7a] text-xs font-mono flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#ff3e00] shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3.5 bg-[#0e1f15] border border-[#00d664]/40 text-[#00d664] text-xs font-mono flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#00d664] shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-[#141416] border border-[#242428] p-4 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <form onSubmit={handleSearch} className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#8a8a93]" />
          <input
            type="text"
            placeholder="Search by invoice number or client..."
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
            className="px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-[#8a8a93] text-xs font-mono rounded-none outline-none focus:border-[#ff3e00] transition-colors cursor-pointer w-full sm:w-48"
          >
            <option value="">ALL STATES</option>
            <option value="ISSUED">ISSUED</option>
            <option value="PAID">PAID</option>
            <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
            <option value="OVERDUE">OVERDUE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="CANCELLED">CANCELLED</option>
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
      ) : invoices.length === 0 ? (
        <div className="bg-[#141416] border border-[#242428] p-12 text-center flex flex-col items-center justify-center text-[#8a8a93]">
          <FileText className="w-10 h-10 mb-3 text-[#4a4a52] stroke-1" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-[#f5f5f2]">No invoices found</h3>
          <p className="text-xs text-[#8a8a93] mt-1 font-mono">Invoices are automatically created during client onboarding or milestone triggers.</p>
        </div>
      ) : (
        <div className="bg-[#141416] border border-[#242428] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[#242428] bg-[#0a0a0a] text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Invoice #</th>
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">Project</th>
                  <th className="px-5 py-3 font-semibold">Issue Date</th>
                  <th className="px-5 py-3 font-semibold">Due Date</th>
                  <th className="px-5 py-3 font-semibold text-right">Total Amount</th>
                  <th className="px-5 py-3 font-semibold text-center">Telegram</th>
                  <th className="px-5 py-3 font-semibold text-right">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242428] text-xs">
                {invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-[#18181b] transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-white tracking-wide">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-5 py-3.5">
                      {inv.clientId ? (
                        <>
                          <Link
                            href={`/dashboard/clients/${inv.clientId._id}`}
                            className="font-medium text-[#f5f5f2] hover:text-[#ff3e00] transition-colors"
                          >
                            {inv.clientId.name}
                          </Link>
                          <div className="text-[10px] font-mono text-[#8a8a93] mt-0.5">
                            CODE: {inv.clientId.clientCode}
                          </div>
                        </>
                      ) : (
                        <span className="text-[#6b6b76] italic font-mono text-[11px]">Unassigned Client</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#8a8a93]">
                      {inv.projectId?.name || <span className="text-[#6b6b76] italic font-mono text-[11px]">Unassigned Project</span>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#8a8a93] whitespace-nowrap">
                      {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#8a8a93] whitespace-nowrap">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : 'ON RECEIPT'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-white whitespace-nowrap">
                      {inv.currency} {inv.total ? inv.total.toLocaleString('en-IN') : 0}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {inv.telegramSent ? (
                        <span className="text-[9px] font-mono font-bold text-[#00d664] bg-[#0e1f15] border border-[#00d664]/30 px-1.5 py-0.5 uppercase tracking-widest">
                          SENT
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-[#6b6b76] uppercase tracking-widest">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">{renderStatusBadge(inv.status)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <a
                          href={`/api/invoices/${inv._id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-[#0a0a0a] hover:bg-[#242428] border border-[#242428] text-[#8a8a93] hover:text-white transition-colors"
                          title="Download PDF Invoice"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleSendTelegram(inv._id)}
                          disabled={!inv.clientId?.telegramConnected || sendingId === inv._id}
                          className={`p-1.5 border text-xs font-semibold flex items-center transition-colors
                            ${inv.clientId?.telegramConnected 
                              ? 'bg-[#0a0a0a] hover:border-[#ff3e00] hover:text-[#ff3e00] border-[#242428] text-[#8a8a93] cursor-pointer' 
                              : 'bg-[#0a0a0a] border-[#242428] text-[#4a4a52] cursor-not-allowed'
                            }
                          `}
                          title={inv.clientId?.telegramConnected ? 'Dispatch Telegram Notification' : 'Telegram channel not connected'}
                        >
                          {sendingId === inv._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff3e00]" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
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
