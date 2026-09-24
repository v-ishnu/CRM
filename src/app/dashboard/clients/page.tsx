'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, Send, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

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
    const map: Record<Client['status'], { variant: BadgeVariant; label: string }> = {
      LEAD: { variant: 'blue', label: 'LEAD' },
      ONBOARDING: { variant: 'purple', label: 'ONBOARDING' },
      ACTIVE: { variant: 'green', label: 'ACTIVE' },
      COMPLETED: { variant: 'neutral', label: 'COMPLETED' },
      CANCELLED: { variant: 'danger', label: 'CANCELLED' },
    };
    const s = map[clientStatus] || { variant: 'neutral', label: clientStatus };
    return (
      <Badge variant={s.variant} dot>
        {s.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        tag="DIRECTORY"
        title="Clients Directory"
        description="Client registry, Telegram bot linking status, and commercial engagement records."
        actions={
          <Link href="/dashboard/clients/new">
            <Button variant="primary" icon={<UserPlus className="w-3.5 h-3.5" />}>
              Add Client
            </Button>
          </Link>
        }
      />

      {/* Search & Filter Toolbar */}
      <div className="bg-[#141416] border border-[#242428] p-3 sm:p-4 rounded-xs flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:max-w-md flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-[#71717a] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, company, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-24 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] text-xs text-white placeholder-[#52525b] rounded-xs outline-none transition-all"
          />
          <button
            type="submit"
            className="absolute right-1.5 px-2.5 py-1 bg-[#242428] hover:bg-[#ff3e00] hover:text-white text-[#a1a1aa] font-mono text-[10px] font-bold uppercase rounded-xs transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] text-xs font-mono text-[#f5f5f2] rounded-xs outline-none transition-all cursor-pointer w-full sm:w-44"
          >
            <option value="">ALL STATUSES</option>
            <option value="LEAD">LEAD</option>
            <option value="ONBOARDING">ONBOARDING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Clients Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 w-full bg-[#141416] border border-[#242428] animate-pulse rounded-xs" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card className="p-10 text-center flex flex-col items-center justify-center text-[#71717a]">
          <XCircle className="w-10 h-10 mb-2 stroke-1 text-[#52525b]" />
          <h3 className="font-bold text-white text-sm">No clients found</h3>
          <p className="font-mono text-xs text-[#71717a] mt-1">
            Try adjusting your query or filter criteria.
          </p>
        </Card>
      ) : (
        <div className="bg-[#141416] border border-[#242428] rounded-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-[#242428] bg-[#0e0e11] font-mono text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider">
                  <th className="px-5 py-3">Client Entity</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Telegram Integration</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Onboarded</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f24] text-xs">
                {clients.map((client) => (
                  <tr
                    key={client._id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] uppercase px-1 py-0.2 bg-[#0e0e11] border border-[#27272a] text-[#ff3e00] font-bold rounded-xs shrink-0">
                          {client.clientCode}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{client.name}</p>
                          <p className="font-mono text-[11px] text-[#71717a] truncate mt-0.5">
                            {client.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#a1a1aa]">
                      {client.company || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {client.telegramConnected ? (
                        <div className="flex items-center text-[#00d664] font-mono text-xs gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span className="truncate">@{client.telegramUsername || 'LINKED'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-[#71717a] font-mono text-xs gap-1.5">
                          <Send className="w-3.5 h-3.5 shrink-0" />
                          <span>NOT LINKED</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(client.status)}</td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#71717a] whitespace-nowrap">
                      {new Date(client.onboardingDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/dashboard/clients/${client._id}`}>
                        <Button variant="outline" size="sm" icon={<Eye className="w-3 h-3" />}>
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-[#242428] bg-[#0e0e11] flex flex-col sm:flex-row gap-3 items-center justify-between font-mono text-xs text-[#71717a]">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
