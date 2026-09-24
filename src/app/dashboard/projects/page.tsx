'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, FolderKanban, Eye, RefreshCw, Layers } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

interface Project {
  _id: string;
  projectCode: string;
  name: string;
  serviceType: string;
  totalAmount: number;
  currency: string;
  status: 'PLANNED' | 'ONBOARDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  startDate?: string;
  expectedCompletionDate?: string;
  clientId: {
    _id: string;
    name: string;
    clientCode: string;
  };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (statusFilter) query.append('status', statusFilter);

      const res = await fetch(`/api/projects?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProjects(json.data);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects();
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    setUpdatingId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notifyClient: true }),
      });
      const json = await res.json();
      if (json.success) {
        setProjects((prev) =>
          prev.map((p) => (p._id === projectId ? { ...p, status: newStatus as any } : p))
        );
      } else {
        alert(json.error?.message || 'Failed to update project status');
      }
    } catch (err) {
      alert('Error updating status on server.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: Project['status']) => {
    const map: Record<Project['status'], BadgeVariant> = {
      PLANNED: 'blue',
      ONBOARDING: 'purple',
      IN_PROGRESS: 'orange',
      REVIEW: 'warning',
      COMPLETED: 'green',
      CANCELLED: 'danger',
      ON_HOLD: 'neutral',
    };
    return map[status] || 'neutral';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        tag="ENGAGEMENTS"
        title="Projects & Deliverables"
        description="Active software projects, milestone schedules, service phases, and budget allocations."
      />

      {/* Search & Filter Toolbar */}
      <div className="bg-[#141416] border border-[#242428] p-3 sm:p-4 rounded-xs flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <form onSubmit={handleSearch} className="relative w-full sm:max-w-md flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-[#71717a] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by project name or code..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] text-xs font-mono text-[#f5f5f2] rounded-xs outline-none transition-all cursor-pointer w-full sm:w-44"
          >
            <option value="">ALL PROJECT STATES</option>
            <option value="PLANNED">PLANNED</option>
            <option value="ONBOARDING">ONBOARDING</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="REVIEW">UNDER REVIEW</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="ON_HOLD">ON HOLD</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Projects Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 w-full bg-[#141416] border border-[#242428] animate-pulse rounded-xs" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-10 text-center flex flex-col items-center justify-center text-[#71717a]">
          <FolderKanban className="w-10 h-10 mb-2 stroke-1 text-[#52525b]" />
          <h3 className="font-bold text-white text-sm">No projects found</h3>
          <p className="font-mono text-xs text-[#71717a] mt-1">
            Projects are created through client onboarding or project agreements.
          </p>
        </Card>
      ) : (
        <div className="bg-[#141416] border border-[#242428] rounded-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-[#242428] bg-[#0e0e11] font-mono text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider">
                  <th className="px-5 py-3">Project & Code</th>
                  <th className="px-5 py-3">Client Entity</th>
                  <th className="px-5 py-3">Budget</th>
                  <th className="px-5 py-3">Phase / Status</th>
                  <th className="px-5 py-3">Schedule</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f24] text-xs">
                {projects.map((proj) => (
                  <tr key={proj._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] uppercase px-1 py-0.2 bg-[#0e0e11] border border-[#27272a] text-[#ff3e00] font-bold rounded-xs shrink-0">
                          {proj.projectCode}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{proj.name}</p>
                          <p className="font-mono text-[11px] text-[#71717a] truncate mt-0.5">
                            {proj.serviceType}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/clients/${proj.clientId._id}`}
                        className="font-bold text-white hover:text-[#ff3e00] transition-colors"
                      >
                        {proj.clientId.name}
                      </Link>
                      <div className="font-mono text-[10px] text-[#71717a] mt-0.5">
                        {proj.clientId.clientCode}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-white">
                      {proj.currency} {proj.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5">
                      {updatingId === proj._id ? (
                        <div className="flex items-center font-mono text-xs text-[#71717a]">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5 text-[#ff3e00]" />
                          UPDATING...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusBadge(proj.status)} dot>
                            {proj.status}
                          </Badge>
                          <select
                            value={proj.status}
                            onChange={(e) => handleStatusChange(proj._id, e.target.value)}
                            className="bg-[#0d0d10] border border-[#27272a] hover:border-[#ff3e00]/50 text-[10px] font-mono font-bold uppercase text-[#a1a1aa] rounded-xs px-1.5 py-0.5 outline-none cursor-pointer"
                          >
                            <option value="PLANNED">PLANNED</option>
                            <option value="ONBOARDING">ONBOARDING</option>
                            <option value="IN_PROGRESS">IN PROGRESS</option>
                            <option value="REVIEW">REVIEW</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="ON_HOLD">ON HOLD</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#71717a] space-y-0.5 whitespace-nowrap">
                      <div>Start: {proj.startDate ? new Date(proj.startDate).toLocaleDateString() : '—'}</div>
                      <div>Due: {proj.expectedCompletionDate ? new Date(proj.expectedCompletionDate).toLocaleDateString() : '—'}</div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link href={`/dashboard/projects/${proj._id}`}>
                          <Button variant="primary" size="sm" icon={<Layers className="w-3 h-3" />}>
                            Inspect
                          </Button>
                        </Link>
                        <Link href={`/dashboard/clients/${proj.clientId._id}`}>
                          <Button variant="outline" size="sm" icon={<Eye className="w-3 h-3" />}>
                            Client
                          </Button>
                        </Link>
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
