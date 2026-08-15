'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, Send, CheckCircle2, XCircle, ArrowRight, Eye } from 'lucide-react';

interface Client {
  _id: string;
  clientCode: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status: 'LEAD' | 'ONBOARDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  telegramConnected: boolean;
  telegramUsername?: string;
  onboardingDate: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        status,
        page: page.toString(),
        limit: '10',
      });
      const res = await fetch(`/api/clients?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setClients(json.clients);
        setTotalPages(json.pagination.pages);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchClients();
  };

  const getStatusBadge = (clientStatus: Client['status']) => {
    const styles = {
      LEAD: 'bg-blue-950/45 text-blue-400 border border-blue-800/40',
      ONBOARDING: 'bg-purple-950/45 text-purple-400 border border-purple-800/40',
      ACTIVE: 'bg-emerald-950/45 text-emerald-400 border border-emerald-800/40',
      COMPLETED: 'bg-slate-900/60 text-slate-400 border border-slate-700/40',
      CANCELLED: 'bg-red-950/45 text-red-400 border border-red-800/40',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${styles[clientStatus]}`}>
        {clientStatus}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Clients Database</h1>
          <p className="text-slate-400 text-sm">Manage contacts, profiles, and Telegram integration status.</p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/10"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Client
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="bg-[#0d0d12]/60 border border-slate-850 p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-550" />
          <input
            type="text"
            placeholder="Search by name, email, company, code..."
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
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 bg-slate-950/65 border border-slate-800 text-slate-350 text-sm rounded-xl outline-none focus:border-indigo-500 transition-all cursor-pointer w-full sm:w-44"
          >
            <option value="">All Statuses</option>
            <option value="LEAD">Lead</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 w-full bg-slate-900 animate-pulse rounded-xl"></div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-[#0d0d12]/40 border border-slate-850 p-12 rounded-xl text-center flex flex-col items-center justify-center text-slate-500">
          <XCircle className="w-12 h-12 mb-3 stroke-1 text-slate-650" />
          <h3 className="font-bold text-slate-300">No clients found</h3>
          <p className="text-sm text-slate-500 mt-1">Try modifying your search or filters, or add a new client.</p>
        </div>
      ) : (
        <div className="bg-[#0d0d12]/40 border border-slate-850 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/35 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Telegram linking</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Onboarded</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-sm">
                {clients.map((client) => (
                  <tr key={client._id} className="hover:bg-slate-900/20 transition-all group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-200">{client.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{client.email}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-350">{client.company || '—'}</td>
                    <td className="px-6 py-4">
                      {client.telegramConnected ? (
                        <div className="flex items-center text-emerald-450 text-xs font-semibold gap-1.5">
                          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                          <span>@{client.telegramUsername || 'Linked'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-slate-500 text-xs gap-1.5">
                          <Send className="w-4 h-4" />
                          <span>Not Connected</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(client.status)}</td>
                    <td className="px-6 py-4 text-slate-450">
                      {new Date(client.onboardingDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/clients/${client._id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-900 hover:bg-indigo-600/10 hover:text-indigo-400 border border-slate-800 hover:border-indigo-500/20 text-slate-355 text-xs font-medium rounded-lg transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-850 flex items-center justify-between text-xs text-slate-500 bg-slate-900/10">
              <span>Showing Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
