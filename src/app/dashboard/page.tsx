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
} from 'lucide-react';

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
      <div className="space-y-8 animate-pulse">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="h-8 w-64 bg-slate-800 rounded-lg"></div>
          <div className="h-10 w-36 bg-slate-800 rounded-lg"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-800 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-slate-800 rounded-2xl"></div>
          <div className="h-96 bg-slate-800 rounded-2xl"></div>
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
      icon: Users,
      color: 'from-blue-600/20 to-indigo-600/10',
      textColor: 'text-blue-400',
      description: 'Registered client entities',
    },
    {
      name: 'Active Projects',
      value: data.activeProjects,
      icon: FolderKanban,
      color: 'from-teal-600/20 to-emerald-600/10',
      textColor: 'text-teal-400',
      description: 'Projects currently in progress',
    },
    {
      name: 'Total Revenue',
      value: `₹${data.totalRevenue.toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: 'from-emerald-600/20 to-teal-650/10',
      textColor: 'text-emerald-400',
      description: 'Sum of all project amounts',
    },
    {
      name: 'Outstanding Amount',
      value: `₹${data.outstandingAmount.toLocaleString('en-IN')}`,
      icon: AlertCircle,
      color: 'from-red-650/20 to-orange-600/10',
      textColor: 'text-red-400',
      description: 'Unpaid project budget balances',
    },
    {
      name: 'Payments This Month',
      value: `₹${data.paymentsThisMonth.toLocaleString('en-IN')}`,
      icon: TrendingUp,
      color: 'from-indigo-600/20 to-purple-600/10',
      textColor: 'text-indigo-400',
      description: 'Income received in current month',
    },
    {
      name: 'Pending Invoices',
      value: data.pendingInvoices,
      icon: FileText,
      color: 'from-amber-600/20 to-yellow-600/10',
      textColor: 'text-amber-400',
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

  // Safe percentage calculation for financial visual progress bar
  const totalPaid = Math.max(0, data.totalRevenue - data.outstandingAmount);
  const collectionsRate = data.totalRevenue > 0 ? Math.round((totalPaid / data.totalRevenue) * 100) : 100;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            System Dashboard
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Real-time developer CRM tracking & financial summaries.</p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="inline-flex items-center justify-center px-4 sm:px-5 py-2.5 bg-indigo-605 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-650/15"
        >
          Onboard New Client
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.name}
              className={`bg-[#0d0d12]/80 border border-slate-800/80 p-5 sm:p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between group hover:border-slate-700/60 transition-all duration-300`}
            >
              {/* Backlit Glow */}
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} rounded-bl-full opacity-60 filter blur-xl group-hover:scale-110 transition-transform`}></div>
              
              <div className="flex justify-between items-start relative">
                <div>
                  <p className="text-xs font-semibold text-slate-450 uppercase tracking-wider">{card.name}</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mt-2 tracking-tight">{card.value}</h3>
                </div>
                <div className={`p-2.5 sm:p-3 bg-slate-900 border border-slate-800 rounded-xl ${card.textColor}`}>
                  <Icon className="w-4 sm:w-5 h-4 sm:h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 sm:mt-4 relative">{card.description}</p>
            </div>
          );
        })}
      </div>

      {/* Financial Ratios & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Collection Ratios */}
        <div className="lg:col-span-2 bg-[#0d0d12]/60 border border-slate-850 p-5 sm:p-6 rounded-2xl">
          <h2 className="text-base sm:text-lg font-bold text-slate-100 mb-5 sm:mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-indigo-400" />
            Financial Breakdown
          </h2>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-xs sm:text-sm mb-2">
                <span className="text-slate-400">Collections Rate</span>
                <span className="font-semibold text-indigo-400">{collectionsRate}% Collected</span>
              </div>
              <div className="w-full h-3 bg-slate-900 border border-slate-800/80 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${collectionsRate}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t border-slate-900">
              <div className="bg-slate-900/30 p-4 border border-slate-900 rounded-xl">
                <p className="text-xs text-slate-500 uppercase font-semibold">Total Payments Collected</p>
                <p className="text-lg font-bold text-emerald-450 mt-1">₹{totalPaid.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-slate-900/30 p-4 border border-slate-900 rounded-xl">
                <p className="text-xs text-slate-500 uppercase font-semibold">Outstanding Balance</p>
                <p className="text-lg font-bold text-red-405 mt-1">₹{data.outstandingAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Simple Graphic SVG Visual Chart representing invoices */}
            <div className="h-44 w-full bg-slate-950/20 border border-slate-900 rounded-xl flex items-center justify-center relative p-4 overflow-hidden">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path 
                  d="M0,80 Q75,30 150,60 T300,20 T450,50 T500,30 L500,100 L0,100 Z" 
                  fill="url(#chartGrad)" 
                />
                <path 
                  d="M0,80 Q75,30 150,60 T300,20 T450,50 T500,30" 
                  fill="none" 
                  stroke="#6366f1" 
                  strokeWidth="2.5" 
                />
                {/* Dots */}
                <circle cx="150" cy="60" r="4" fill="#14b8a6" />
                <circle cx="300" cy="20" r="4" fill="#6366f1" />
                <circle cx="450" cy="50" r="4" fill="#a855f7" />
              </svg>
              <div className="absolute top-4 left-4 text-[10px] text-slate-500 bg-[#0d0d12] px-2 py-0.5 border border-slate-800 rounded font-semibold uppercase">
                Revenue Inflow Projection
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl flex flex-col">
          <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center shrink-0">
            <Activity className="w-5 h-5 mr-2 text-indigo-400" />
            Audit activity log
          </h2>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[360px] pr-2 scrollbar-thin">
            {data.recentActivity.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Clock className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-sm">No activity logged yet.</p>
              </div>
            ) : (
              data.recentActivity.map((activity) => {
                const Icon = getActivityIcon(activity.entityType);
                return (
                  <div key={activity._id} className="flex gap-3 text-xs leading-relaxed group">
                    <div className="p-2 bg-slate-900 border border-slate-805 rounded-lg text-slate-400 shrink-0 h-8 w-8 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-350 truncate">{activity.actor}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-0.5 capitalize">
                        {formatActivityAction(activity.action)} <code className="text-indigo-400 text-[10px] bg-slate-900/60 px-1 py-0.5 border border-slate-850 rounded">{activity.entityType}</code>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
