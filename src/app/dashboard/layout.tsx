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
  MessageSquare,
  LogOut,
  Menu,
  X,
  Server,
  Terminal,
  Shield,
} from 'lucide-react';
import { StatusBeacon } from '@/components/ui/StatusBeacon';

interface NavSection {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections: NavSection[] = [
    {
      title: 'CORE',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Clients', href: '/dashboard/clients', icon: Users },
        { name: 'Inquiries', href: '/dashboard/inquiries', icon: MessageSquare },
        { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
        { name: 'Hosting', href: '/dashboard/hosting', icon: Server },
        { name: 'Team Members', href: '/dashboard/team', icon: UserCheck },
      ],
    },
    {
      title: 'FINANCIAL',
      items: [
        { name: 'Client Payments', href: '/dashboard/payments', icon: CreditCard },
        { name: 'Team Payments', href: '/dashboard/team-payments', icon: Wallet },
        { name: 'Invoices', href: '/dashboard/invoices', icon: FileText },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { name: 'Telegram Bot', href: '/dashboard/settings/telegram', icon: Send },
        { name: 'Audit Logs', href: '/dashboard/audit-logs', icon: History },
      ],
    },
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
    <div className="h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#0a0a0a] text-[#f5f5f2] flex flex-col md:flex-row font-sans antialiased">
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0e0e11] border-b border-[#242428] shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#141416] border border-[#ff3e00]/40 rounded-xs flex items-center justify-center font-mono font-bold text-white text-xs">
            <Terminal className="w-3.5 h-3.5 text-[#ff3e00]" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">DR. DEBUGGERS</span>
            <span className="block font-mono text-[9px] uppercase tracking-widest text-[#a1a1aa] leading-none">
              CRM OPS
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBeacon status="operational" size="sm" />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 text-[#a1a1aa] hover:text-white hover:bg-white/5 rounded-xs focus:outline-none"
            aria-label="Toggle Navigation"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 w-64 h-full md:h-screen bg-[#0e0e11] border-r border-[#242428] flex flex-col justify-between transition-transform duration-200 shrink-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="p-5 border-b border-[#242428]">
            <div className="flex items-center justify-between">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 group focus:outline-none"
              >
                <div className="w-8 h-8 bg-[#141416] border border-[#27272a] group-hover:border-[#ff3e00] rounded-xs flex items-center justify-center transition-colors">
                  <Terminal className="w-4 h-4 text-[#ff3e00]" />
                </div>
                <div>
                  <h1 className="font-bold text-sm text-white tracking-tight leading-none group-hover:text-[#ff3e00] transition-colors">
                    DR. DEBUGGERS
                  </h1>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#ff3e00] font-semibold mt-0.5 block">
                    OPERATIONS CRM
                  </span>
                </div>
              </Link>
            </div>
            {/* Status Beacon indicator */}
            <div className="mt-3 pt-3 border-t border-[#1f1f23] flex items-center justify-between">
              <StatusBeacon status="operational" label="SYSTEM ONLINE" size="sm" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#71717a] font-bold">
                v2.6
              </span>
            </div>
          </div>

          {/* Grouped Navigation */}
          <nav className="p-3 space-y-5 flex-1">
            {sections.map((sec) => (
              <div key={sec.title}>
                <div className="px-3 pb-1.5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#71717a]">
                    // {sec.title}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 text-xs font-mono font-medium tracking-wide uppercase transition-all duration-150 rounded-xs group ${
                          isActive
                            ? 'bg-[#18181c] text-white border-l-2 border-[#ff3e00] font-bold pl-2.5'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive
                                ? 'text-[#ff3e00]'
                                : 'text-[#71717a] group-hover:text-[#a1a1aa]'
                            }`}
                          />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff3e00] shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* User Footer Bar */}
        <div className="p-3 border-t border-[#242428] bg-[#0c0c0f] shrink-0 space-y-2">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#141416] border border-[#242428] rounded-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 bg-[#1a1a1e] border border-[#27272a] rounded-xs flex items-center justify-center text-[#ff3e00] shrink-0">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <p className="font-mono text-[11px] font-bold text-white leading-tight truncate">
                  Admin User
                </p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-[#71717a] leading-none">
                  ADMIN ROLE
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-[#71717a] hover:text-[#ff3e00] hover:bg-white/5 rounded-xs transition-colors shrink-0"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0a0a0a]">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-[#242428] bg-[#0e0e11] shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#71717a]">SYSTEM</span>
            <span className="text-[#3f3f46]">/</span>
            <span className="text-white font-bold uppercase tracking-wider">
              {pathname === '/dashboard'
                ? 'DASHBOARD'
                : pathname.replace('/dashboard/', '').replace(/\//g, ' / ').toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-[#141416] border border-[#242428] rounded-xs">
              <span className="w-2 h-2 rounded-full bg-[#00d664] status-beacon" />
              <span className="font-mono text-[10px] uppercase font-bold text-[#00d664] tracking-widest">
                TELEGRAM BOT ACTIVE
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto min-h-0 flex flex-col space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
