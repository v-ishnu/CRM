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
  Download,
  Loader2,
  Calendar,
  Laptop,
  ArrowRight,
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
  amount: number;
  paymentMethod: string;
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

  const fetchClientDetails = async () => {
    try {
      const res = await fetch(`/api/clients/${id}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load client details:', err);
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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-slate-800 rounded-xl"></div>
          <div className="h-6 w-48 bg-slate-800 rounded"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 h-96 bg-slate-800 rounded-2xl"></div>
          <div className="lg:col-span-2 h-96 bg-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 bg-red-950/20 border border-red-500/20 rounded-xl text-center text-red-300">
        Client not found.
      </div>
    );
  }

  const { client, projects, invoices, payments, auditLogs, financials } = data;

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/clients"
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-450 hover:text-slate-205 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">{client.name}</h1>
              <code className="text-xs bg-indigo-650/15 text-indigo-400 border border-indigo-500/10 px-2 py-0.5 rounded uppercase">
                {client.clientCode}
              </code>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">Onboarded: {new Date(client.onboardingDate).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-950/45 border border-red-500/20 text-red-300 rounded-xl text-sm">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 bg-emerald-950/45 border border-emerald-500/20 text-emerald-300 rounded-xl text-sm">
          {actionSuccess}
        </div>
      )}

      {/* Grid Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Client profile & Telegram Panel */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-5 pb-3 border-b border-slate-900">
              Profile Summary
            </h2>
            <div className="space-y-4 text-sm text-slate-400">
              {client.company && (
                <div className="flex items-center space-x-3">
                  <Building className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{client.company}</span>
                </div>
              )}
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    {client.address}, {client.city || ''}, {client.state || ''}, {client.country || ''}
                  </span>
                </div>
              )}
              <div className="pt-2">
                <span className="text-xs text-slate-500">Status Badge</span>
                <div className="mt-1.5 inline-block px-3 py-1 bg-indigo-950/40 border border-indigo-805/30 text-indigo-400 text-xs font-bold rounded-lg uppercase tracking-wider">
                  {client.status}
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Linking Panel */}
          <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
              Telegram Connection
            </h2>

            {client.telegramConnected ? (
              <div className="space-y-4">
                <div className="flex items-center text-emerald-450 text-sm font-semibold gap-2 p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Linked to @{client.telegramUsername || 'User'}</span>
                </div>
                <div className="text-xs text-slate-500 space-y-1.5 bg-slate-950/20 p-3 rounded-lg border border-slate-900">
                  <p><b>User ID:</b> <code>{client.telegramUserId}</code></p>
                  <p><b>Chat ID:</b> <code>{client.telegramChatId}</code></p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-slate-900/40 border border-slate-800 rounded-xl text-xs text-slate-450">
                  <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <p>Telegram is not linked. Generate a connection link to connect the client.</p>
                </div>

                {!telegramLink ? (
                  <button
                    onClick={handleGenerateTelegramLink}
                    disabled={generatingLink}
                    className="w-full flex items-center justify-center py-2.5 bg-indigo-650 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition-all disabled:opacity-55"
                  >
                    {generatingLink ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Generating Link...
                      </>
                    ) : (
                      <>
                        <Send className="w-4.5 h-4.5 mr-2" />
                        Generate Connect Token
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-[10px] bg-slate-950 border border-slate-900 rounded p-2 text-slate-400 break-all select-all font-mono">
                      {telegramLink}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyLink}
                        className="flex-1 flex items-center justify-center py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-all"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-1.5 text-emerald-450" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1.5" />
                            Copy Link
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setTelegramLink(null)}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-semibold rounded-xl"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Financials, Projects, Invoices, Payments, History */}
        <div className="lg:col-span-2 space-y-8">
          {/* Financial summary blocks */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0d0d12]/50 border border-slate-850 p-4 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Projects budget</span>
              <p className="text-base md:text-lg font-bold text-slate-205 mt-1">
                Rs. {financials.totalProjectValue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-[#0d0d12]/50 border border-slate-850 p-4 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Paid</span>
              <p className="text-base md:text-lg font-bold text-emerald-450 mt-1">
                Rs. {financials.totalPaid.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-[#0d0d12]/50 border border-slate-850 p-4 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Outstanding Balance</span>
              <p className="text-base md:text-lg font-bold text-red-405 mt-1">
                Rs. {financials.outstanding.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Projects section */}
          <div className="bg-[#0d0d12]/30 border border-slate-850 p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-slate-200 flex items-center">
                <Laptop className="w-5 h-5 mr-2 text-indigo-400" />
                Client Projects
              </h2>
            </div>

            {projects.length === 0 ? (
              <p className="text-sm text-slate-550 py-4 text-center">No projects registered for this client.</p>
            ) : (
              <div className="space-y-3">
                {projects.map((proj) => (
                  <div
                    key={proj._id}
                    className="p-4 bg-slate-905/30 border border-slate-850/60 hover:border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{proj.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Code: {proj.projectCode} | Service: {proj.serviceType}
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-right">
                      <div>
                        <div className="text-sm font-bold text-slate-300">
                          {proj.currency} {proj.totalAmount.toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg text-slate-400 uppercase font-semibold mt-1 inline-block">
                          {proj.status}
                        </span>
                      </div>
                      <Link
                        href={`/dashboard/projects`}
                        className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices panel */}
          <div className="bg-[#0d0d12]/30 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-400" />
              Invoices & Billing
            </h2>

            {invoices.length === 0 ? (
              <p className="text-sm text-slate-550 py-4 text-center">No invoices generated.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => {
                  const isSending = processingInvs[inv._id] || false;
                  return (
                    <div
                      key={inv._id}
                      className="p-4 bg-slate-905/30 border border-slate-850/60 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div>
                        <div className="font-bold text-slate-300">{inv.invoiceNumber}</div>
                        <div className="text-xs text-slate-550 mt-1 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Issued: {new Date(inv.invoiceDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6">
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-bold text-slate-200">
                            Rs. {inv.total.toLocaleString('en-IN')}
                          </div>
                          <span className="text-[10px] uppercase font-bold text-indigo-400">{inv.status}</span>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={`/api/invoices/${inv._id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleSendInvoiceTelegram(inv._id)}
                            disabled={!client.telegramConnected || isSending}
                            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all
                              ${client.telegramConnected 
                                ? 'bg-indigo-650/10 hover:bg-indigo-650/20 border-indigo-500/20 text-indigo-400' 
                                : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                              }
                            `}
                            title={inv.telegramSent ? 'Resend to Telegram' : 'Send to Telegram'}
                          >
                            {isSending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span className="hidden md:inline">{inv.telegramSent ? 'Resent' : 'Send'}</span>
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
          <div className="bg-[#0d0d12]/30 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-indigo-400" />
              Recent Payments
            </h2>

            {payments.length === 0 ? (
              <p className="text-sm text-slate-550 py-4 text-center">No payment transactions recorded.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/30 border-b border-slate-850 text-slate-450 font-semibold uppercase">
                      <th className="px-4 py-3">Receipt #</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Ref ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-350">
                    {payments.map((pay) => (
                      <tr key={pay._id} className="hover:bg-slate-900/10">
                        <td className="px-4 py-3 font-semibold text-slate-300">{pay.paymentNumber}</td>
                        <td className="px-4 py-3">{pay.paymentMethod}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{pay.transactionReference || '—'}</td>
                        <td className="px-4 py-3">{new Date(pay.paymentDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-200">
                          Rs. {pay.amount.toLocaleString('en-IN')}
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
            <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl">
              <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-2">Onboarding Notes</h2>
              <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{client.notes}</p>
            </div>
          )}

          {/* Timeline Audit Logs */}
          <div className="bg-[#0d0d12]/30 border border-slate-850 p-6 rounded-2xl">
            <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center">
              <History className="w-5 h-5 mr-2 text-indigo-400" />
              Client Activity logs
            </h2>
            
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-550 text-center py-4">No activity logged.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log._id} className="flex gap-3 text-xs leading-relaxed">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0 mt-1.5"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-300 capitalize">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                        <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-500 mt-0.5">By {log.actor}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
