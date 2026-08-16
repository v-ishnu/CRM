'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, FolderKanban, CheckCircle2, ArrowRight, Eye, RefreshCw } from 'lucide-react';

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
        // Update local status
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

  const getStatusStyle = (status: Project['status']) => {
    const styles = {
      PLANNED: 'bg-blue-950/40 text-blue-400 border border-blue-900/30',
      ONBOARDING: 'bg-purple-950/40 text-purple-400 border border-purple-900/30',
      IN_PROGRESS: 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30',
      REVIEW: 'bg-amber-950/40 text-amber-400 border border-amber-900/30',
      COMPLETED: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30',
      CANCELLED: 'bg-red-950/40 text-red-400 border border-red-900/30',
      ON_HOLD: 'bg-slate-900 border border-slate-700 text-slate-400',
    };
    return styles[status] || 'bg-slate-800 text-slate-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Project Management</h1>
          <p className="text-slate-400 text-sm">Track milestones, update phases, and monitor budgets.</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-[#0d0d12]/60 border border-slate-850 p-4 rounded-xl flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-stretch sm:items-center">
        <form onSubmit={handleSearch} className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-550" />
          <input
            type="text"
            placeholder="Search by project name or code..."
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
            <option value="">All Project States</option>
            <option value="PLANNED">Planned</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REVIEW">Under Review</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Projects list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 w-full bg-slate-900 animate-pulse rounded-xl"></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-[#0d0d12]/40 border border-slate-850 p-8 sm:p-12 rounded-xl text-center flex flex-col items-center justify-center text-slate-500">
          <FolderKanban className="w-12 h-12 mb-3 stroke-1 text-slate-650" />
          <h3 className="font-bold text-slate-300">No projects found</h3>
          <p className="text-sm text-slate-500 mt-1">Add projects through client onboarding or select different filters.</p>
        </div>
      ) : (
        <div className="bg-[#0d0d12]/40 border border-slate-850 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/35 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-4 sm:px-6 py-4">Project</th>
                  <th className="px-4 sm:px-6 py-4">Client</th>
                  <th className="px-4 sm:px-6 py-4">Total Amount</th>
                  <th className="px-4 sm:px-6 py-4">Status / Phase</th>
                  <th className="px-4 sm:px-6 py-4">Milestones</th>
                  <th className="px-4 sm:px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-sm">
                {projects.map((proj) => (
                  <tr key={proj._id} className="hover:bg-slate-900/20 transition-all">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="font-semibold text-slate-205">{proj.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Code: {proj.projectCode} | {proj.serviceType}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <Link
                        href={`/dashboard/clients/${proj.clientId._id}`}
                        className="font-medium text-indigo-400 hover:underline"
                      >
                        {proj.clientId.name}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">Code: {proj.clientId.clientCode}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 font-bold text-slate-300">
                      {proj.currency} {proj.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      {updatingId === proj._id ? (
                        <div className="flex items-center text-xs text-slate-500">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          Updating...
                        </div>
                      ) : (
                        <select
                          value={proj.status}
                          onChange={(e) => handleStatusChange(proj._id, e.target.value)}
                          className={`px-2 py-1 text-xs font-semibold rounded-lg outline-none cursor-pointer tracking-wide ${getStatusStyle(
                            proj.status
                          )}`}
                        >
                          <option value="PLANNED">PLANNED</option>
                          <option value="ONBOARDING">ONBOARDING</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="REVIEW">REVIEW</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="ON_HOLD">ON HOLD</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-xs text-slate-500 space-y-0.5 whitespace-nowrap">
                      <div>Start: {proj.startDate ? new Date(proj.startDate).toLocaleDateString() : '—'}</div>
                      <div>Due: {proj.expectedCompletionDate ? new Date(proj.expectedCompletionDate).toLocaleDateString() : '—'}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/clients/${proj.clientId._id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-900 hover:bg-indigo-600/10 hover:text-indigo-400 border border-slate-800 hover:border-indigo-500/20 text-slate-355 text-xs font-medium rounded-lg transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        Client Profile
                      </Link>
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
