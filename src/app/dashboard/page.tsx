'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FolderKanban,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  Activity,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ActivityItem {
  _id: string;
  actor: string;
  action: string;
  entityType: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface DashboardStats {
  totalClients: number;
  activeProjects: number;
  totalRevenue: number;
  outstandingAmount: number;
  paymentsThisMonth: number;
  pendingInvoices: number;
  recentActivity: ActivityItem[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard');
        const json = await res.json();
        if (json.success) {
          setStats(json.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 w-72 bg-[#141416] border border-[#242428] rounded-xs" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-[#141416] border border-[#242428] rounded-xs" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-[#141416] border border-[#242428] rounded-xs" />
          <div className="h-96 bg-[#141416] border border-[#242428] rounded-xs" />
        </div>
      </div>
    );
  }

  const data = stats || {
    totalClients: 0,
    activeProjects: 0,
    totalRevenue: 0,
    outstandingAmount: 0,
    paymentsThisMonth: 0,
    pendingInvoices: 0,
    recentActivity: [],
  };

  const cards = [
    {
      name: 'Total Clients',
      value: data.totalClients,
      icon: <Users className="w-4 h-4 text-[#ff3e00]" />,
      description: 'Registered client entities',
    },
    {
      name: 'Active Projects',
      value: data.activeProjects,
      icon: <FolderKanban className="w-4 h-4 text-[#00d664]" />,
      description: 'Projects currently in progress',
    },
    {
      name: 'Total Revenue',
      value: `₹${data.totalRevenue.toLocaleString('en-IN')}`,
      icon: <DollarSign className="w-4 h-4 text-[#ff3e00]" />,
      description: 'Sum of all project budgets',
    },
    {
      name: 'Outstanding Amount',
      value: `₹${data.outstandingAmount.toLocaleString('en-IN')}`,
      icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
      description: 'Unpaid project budget balances',
    },
    {
      name: 'Payments This Month',
      value: `₹${data.paymentsThisMonth.toLocaleString('en-IN')}`,
      icon: <TrendingUp className="w-4 h-4 text-[#00d664]" />,
      description: 'Income received in current month',
    },
    {
      name: 'Pending Invoices',
      value: data.pendingInvoices,
      icon: <FileText className="w-4 h-4 text-sky-400" />,
      description: 'Draft or unpaid issued invoices',
    },
  ];

  const formatActivityAction = (action: string) => {
    return action.replace(/_/g, ' ').toLowerCase();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'Client':
        return Users;
      case 'Project':
        return FolderKanban;
      case 'Payment':
        return DollarSign;
      case 'Invoice':
        return FileText;
      case 'Notification':
        return MessageSquare;
      default:
        return Activity;
    }
  };

  const totalPaid = Math.max(0, data.totalRevenue - data.outstandingAmount);
  const collectionsRate =
    data.totalRevenue > 0 ? Math.round((totalPaid / data.totalRevenue) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        tag="METRICS"
        title="Operations Dashboard"
        description="Real-time developer CRM tracking, project velocity, and financial telemetry."
        actions={
          <Link href="/dashboard/clients/new">
            <Button variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
              Onboard Client
            </Button>
          </Link>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <StatCard
            key={card.name}
            label={card.name}
            value={card.value}
            description={card.description}
            icon={card.icon}
          />
        ))}
      </div>

      {/* Financial Telemetry & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collections Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#ff3e00]">
                TELEMETRY // FINANCIALS
              </span>
              <CardTitle className="mt-1">Financial Collections Breakdown</CardTitle>
            </div>
            <Badge variant={collectionsRate >= 80 ? 'green' : 'amber'} dot>
              {collectionsRate}% Collected
            </Badge>
          </CardHeader>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between font-mono text-xs mb-2">
                <span className="text-[#a1a1aa] uppercase tracking-wider">
                  Collections Progress
                </span>
                <span className="font-bold text-white">
                  ₹{totalPaid.toLocaleString('en-IN')} / ₹{data.totalRevenue.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="w-full h-2.5 bg-[#0e0e11] border border-[#242428] rounded-xs overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#ff3e00] to-[#00d664] transition-all duration-500"
                  style={{ width: `${collectionsRate}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#242428]">
              <div className="bg-[#0e0e11] p-4 border border-[#242428] rounded-xs">
                <p className="font-mono text-[10px] text-[#71717a] uppercase font-bold tracking-wider">
                  Payments Realized
                </p>
                <p className="font-mono text-xl font-bold text-[#00d664] mt-1">
                  ₹{totalPaid.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-[#0e0e11] p-4 border border-[#242428] rounded-xs">
                <p className="font-mono text-[10px] text-[#71717a] uppercase font-bold tracking-wider">
                  Outstanding Balance
                </p>
                <p className="font-mono text-xl font-bold text-[#ff3e00] mt-1">
                  ₹{data.outstandingAmount.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Inflow Waveform Visual */}
            <div className="h-36 w-full bg-[#0e0e11] border border-[#242428] rounded-xs flex items-center justify-center relative p-4 overflow-hidden">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff3e00" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#ff3e00" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,80 Q75,30 150,60 T300,20 T450,50 T500,30 L500,100 L0,100 Z"
                  fill="url(#chartGrad)"
                />
                <path
                  d="M0,80 Q75,30 150,60 T300,20 T450,50 T500,30"
                  fill="none"
                  stroke="#ff3e00"
                  strokeWidth="2"
                />
                <circle cx="150" cy="60" r="3.5" fill="#00d664" />
                <circle cx="300" cy="20" r="3.5" fill="#ff3e00" />
                <circle cx="450" cy="50" r="3.5" fill="#38bdf8" />
              </svg>
              <div className="absolute top-3 left-3 font-mono text-[9px] text-[#a1a1aa] bg-[#141416] px-2 py-0.5 border border-[#242428] rounded-xs uppercase tracking-wider font-bold">
                Revenue Velocity Telemetry
              </div>
            </div>
          </div>
        </Card>

        {/* Activity Feed */}
        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#71717a]">
                LOGS // AUDIT
              </span>
              <CardTitle className="mt-1">System Activity Feed</CardTitle>
            </div>
            <Link
              href="/dashboard/audit-logs"
              className="font-mono text-[10px] text-[#ff3e00] hover:underline uppercase tracking-wider font-bold"
            >
              View All
            </Link>
          </CardHeader>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[380px] pr-1">
            {data.recentActivity.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#71717a]">
                <Clock className="w-8 h-8 mb-2 stroke-1" />
                <p className="font-mono text-xs">No activity logged yet.</p>
              </div>
            ) : (
              data.recentActivity.map((activity) => {
                const Icon = getActivityIcon(activity.entityType);
                return (
                  <div
                    key={activity._id}
                    className="flex gap-3 text-xs leading-relaxed p-2.5 bg-[#0e0e11] border border-[#242428] rounded-xs hover:border-[#ff3e00]/40 transition-colors"
                  >
                    <div className="p-1.5 bg-[#141416] border border-[#27272a] rounded-xs text-[#ff3e00] shrink-0 h-7 w-7 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-white text-[11px] truncate">
                          {activity.actor}
                        </span>
                        <span className="font-mono text-[9px] text-[#71717a] shrink-0">
                          {new Date(activity.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[#a1a1aa] text-[11px] mt-0.5">
                        <span className="capitalize">{formatActivityAction(activity.action)}</span>{' '}
                        <span className="font-mono text-[9px] uppercase px-1 py-0.2 bg-[#1a1a1e] border border-[#27272a] text-[#ff3e00] rounded-xs">
                          {activity.entityType}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
