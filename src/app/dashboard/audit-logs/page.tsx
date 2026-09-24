'use client';

import React, { useEffect, useState } from 'react';
import { History, RefreshCw, Terminal, Clock, Activity, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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

  const getActionBadgeVariant = (action: string): 'active' | 'blue' | 'warning' | 'orange' | 'neutral' => {
    if (action.includes('CREATED')) return 'active';
    if (action.includes('UPDATED')) return 'blue';
    if (action.includes('STATUS')) return 'warning';
    if (action.includes('DELETED')) return 'orange';
    return 'neutral';
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <PageHeader
        tag="SYSTEM // AUDIT TRAIL"
        title="Audit Trail Ledger"
        description="Immutable operational activity stream recording client onboarding, milestone updates, telemetry dispatches, and financial mutations."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            REFRESH TELEMETRY
          </Button>
        }
      />

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 w-full bg-[#141416] border border-[#242428] animate-pulse"></div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-[#141416] border border-[#242428] p-12 text-center flex flex-col items-center justify-center text-[#8a8a93]">
          <History className="w-10 h-10 mb-3 text-[#4a4a52] stroke-1" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#f5f5f2]">No events logged</h3>
          <p className="text-xs text-[#8a8a93] mt-1 font-mono">System activity events will record here in real-time as users interact with the CRM.</p>
        </div>
      ) : (
        <div className="bg-[#141416] border border-[#242428] overflow-hidden">
          {/* Terminal Titlebar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-b border-[#242428]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#242428]" />
              <span className="w-2 h-2 rounded-full bg-[#242428]" />
              <span className="w-2 h-2 rounded-full bg-[#242428]" />
              <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-widest ml-1">
                IMMUTABLE_TRANSACTION_RECORDS
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-[#00d664]">
              <ShieldCheck className="w-3.5 h-3.5" />
              VERIFIED LEDGER
            </div>
          </div>

          <div className="divide-y divide-[#242428] text-xs font-sans">
            {logs.map((log) => (
              <div key={log._id} className="p-4 hover:bg-[#18181b] transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex gap-3 items-start min-w-0">
                  <div className="p-2 bg-[#0a0a0a] border border-[#242428] text-[#ff3e00] shrink-0 mt-0.5">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white text-xs tracking-wide">{log.actor}</span>
                      <Badge variant={getActionBadgeVariant(log.action)} size="sm">
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-[10px] bg-[#0a0a0a] text-[#8a8a93] border border-[#242428] px-1.5 py-0.5 font-mono">
                        {log.entityType}
                      </span>
                      {log.entityId && (
                        <span className="text-[10px] text-[#6b6b76] font-mono">
                          ID: {log.entityId.slice(-8)}
                        </span>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2.5 text-[11px] text-[#8a8a93] bg-[#0a0a0a] p-3 border border-[#242428] font-mono overflow-x-auto max-w-2xl">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[#6b6b76] font-mono text-[10px] shrink-0 text-right self-end sm:self-start">
                  <Clock className="w-3 h-3 text-[#4a4a52]" />
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
