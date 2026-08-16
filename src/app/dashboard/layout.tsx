'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  CheckSquare,
  CreditCard,
  Wallet,
  FileText,
  Send,
  History,
  LogOut,
  Menu,
  X,
  User,
} from 'lucide-react';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation: SidebarItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Clients', href: '/dashboard/clients', icon: Users },
    { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
    { name: 'Team Members', href: '/dashboard/team', icon: UserCheck },
    { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
    { name: 'Team Payments', href: '/dashboard/team-payments', icon: Wallet },
    { name: 'Client Payments', href: '/dashboard/payments', icon: CreditCard },
    { name: 'Invoices', href: '/dashboard/invoices', icon: FileText },
    { name: 'Telegram Bot', href: '/dashboard/settings/telegram', icon: Send },
    { name: 'Audit Logs', href: '/dashboard/audit-logs', icon: History },
  ];

  const handleLogout = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
          router.push('/login');
          router.refresh();
        }
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col md:flex-row font-sans antialiased">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-[#0d0d12] border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">
            CRM
          </div>
          <span className="font-bold text-lg text-slate-200">Dev CRM</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-slate-400 hover:text-slate-200 focus:outline-none"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 w-64 h-full md:h-screen bg-[#0d0d12]/95 md:bg-[#0d0d12] border-r border-slate-850 p-6 flex flex-col justify-between transition-transform duration-305 shrink-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-650 rounded-xl flex items-center justify-center font-black text-white text-base shadow-lg shadow-indigo-650/20">
              AG
            </div>
            <div>
              <h1 className="font-bold text-slate-100 leading-none">Dr. Debuggers</h1>
              <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Developer CRM</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                    ${isActive
                      ? 'bg-indigo-600/10 text-indigo-405 border-l-2 border-indigo-500 font-semibold pl-3'
                      : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="space-y-4 pt-4 border-t border-slate-900">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-9 h-9 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-350">
              <User className="w-5 h-5" />
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-300 leading-tight">Admin User</p>
              <p className="text-[10px] text-slate-500 truncate">admin@example.com</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-950/20 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 text-slate-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
