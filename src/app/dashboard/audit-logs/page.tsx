'use client';

import React, { useEffect, useState } from 'react';
import { History, RefreshCw, Terminal, Clock, Activity } from 'lucide-react';

interface AuditLog {
  _id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs');
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    if (action.includes('CREATED')) return 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
    if (action.includes('UPDATED')) return 'text-indigo-400 bg-indigo-950/20 border-indigo-900/30';
    if (action.includes('STATUS')) return 'text-amber-405 bg-amber-950/20 border-amber-900/30';
    return 'text-slate-400 bg-slate-900 border-slate-800';
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Audit Trail Ledger</h1>
          <p className="text-slate-400 text-sm">Read-only historical transaction log for security auditing.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-slate-205 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 w-full bg-slate-900 animate-pulse rounded-xl"></div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-[#0d0d12]/40 border border-slate-850 p-12 rounded-xl text-center flex flex-col items-center justify-center text-slate-500">
          <History className="w-12 h-12 mb-3 stroke-1 text-slate-650" />
          <h3 className="font-bold text-slate-350">No events logged</h3>
          <p className="text-sm text-slate-500 mt-1">Audit logs will appear as you create clients and record payments.</p>
        </div>
      ) : (
        <div className="bg-[#0d0d12]/40 border border-slate-850 rounded-xl overflow-hidden shadow-2xl">
          <div className="divide-y divide-slate-850 text-xs">
            {logs.map((log) => (
              <div key={log._id} className="p-4 hover:bg-slate-900/10 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex gap-3 items-start min-w-0">
                  <div className="p-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-450 shrink-0 mt-0.5">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-205 text-sm">{log.actor}</span>
                      <span className={`px-2 py-0.5 font-bold uppercase tracking-wider rounded border text-[9px] ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] bg-slate-950 text-indigo-405 border border-indigo-900/40 px-1.5 py-0.5 rounded font-mono">
                        {log.entityType}
                      </span>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 text-[10px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-900 font-mono overflow-x-auto max-w-xl">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-slate-500 shrink-0 text-right self-end sm:self-start">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
