'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useProcessing } from '@/context/ProcessingContext';

interface StatusCount {
  status: string;
  count: number;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[#1a3a1a] text-[#4ec9b0]',
  failed: 'bg-[#3a1a1a] text-[#f48771]',
  pending: 'bg-[#3a3a1a] text-[#dcdcaa]',
  processing: 'bg-[#1a2a3a] text-[#9cdcfe]',
  cancelled: 'bg-[#2a2a2a] text-[#858585]',
};

export default function MaintenancePage() {
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmState, setConfirmState] = useState<{ status: string; count: number } | null>(null);
  const { progress, startReprocess } = useProcessing();
  const prevProgressRef = useRef(progress);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
      const results = await Promise.all(
        statuses.map(async (s) => {
          const res = await fetch(`/api/expenses?status=${s}&limit=1`);
          const data = await res.json();
          return { status: s, count: data.pagination?.total ?? 0 };
        })
      );
      setStatusCounts(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Detect progress → null transition (batch complete)
  useEffect(() => {
    if (prevProgressRef.current !== null && progress === null) {
      const count = prevProgressRef.current.batchIds.length;
      fetchCounts();
      setMessage({ text: `Reprocessed ${count} expense(s).`, ok: true });
    }
    prevProgressRef.current = progress;
  }, [progress, fetchCounts]);

  const handleReprocess = useCallback(async (status: string) => {
    setMessage(null);

    const res = await fetch(`/api/expenses?status=${status}&limit=1000`);
    const data = await res.json();
    const ids: string[] = (data.data || []).map((e: { id: string }) => e.id);

    if (ids.length === 0) {
      setMessage({ text: 'No expenses found.', ok: false });
      return;
    }

    const patchRes = await fetch('/api/expenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });

    if (!patchRes.ok) {
      const err = await patchRes.json();
      setMessage({ text: err.error || 'Failed to reprocess.', ok: false });
      return;
    }

    startReprocess(status, ids);
  }, [startReprocess]);

  const requestReprocess = useCallback((status: string) => {
    const count = statusCounts.find((s) => s.status === status)?.count ?? 0;
    if (count === 0) {
      setMessage({ text: `No ${status} expenses to reprocess.`, ok: false });
      return;
    }
    setConfirmState({ status, count });
  }, [statusCounts]);

  const isLocked = progress !== null;

  return (
    <div className="max-w-2xl mx-auto">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Maintenance' }]} />

      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm border ${
            message.ok
              ? 'bg-[#1a3a1a] text-[#4ec9b0] border-[#2a5a2a]'
              : 'bg-[#3a1a1a] text-[#f48771] border-[#5a2a2a]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Status summary */}
      <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wide">Status Summary</h2>
          <button
            onClick={fetchCounts}
            disabled={loading}
            className="text-xs text-[#9cdcfe] hover:text-[#d4d4d4] disabled:opacity-50 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-[#858585]">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {statusCounts.map(({ status, count }) => (
              <span
                key={status}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status] ?? 'bg-[#3e3e42] text-[#858585]'}`}
              >
                {status}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-5">
        <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wide mb-4">Actions</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#d4d4d4]">Reprocess all failed</p>
              <p className="text-xs text-[#858585]">Queue all failed expenses for reprocessing</p>
            </div>
            <button
              onClick={() => requestReprocess('failed')}
              disabled={isLocked}
              className="px-4 py-2 bg-[#8b3a00] text-white text-sm rounded-lg hover:bg-[#a84700] disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${progress?.targetStatus === 'failed' ? 'animate-spin' : ''}`} />
              Reprocess Failed
            </button>
          </div>
          <div className="border-t border-[#3e3e42] pt-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#d4d4d4]">Reprocess all completed</p>
              <p className="text-xs text-[#858585]">Re-extract data for all completed expenses</p>
            </div>
            <button
              onClick={() => requestReprocess('completed')}
              disabled={isLocked}
              className="px-4 py-2 bg-[#0e639c] text-white text-sm rounded-lg hover:bg-[#1177bb] disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${progress?.targetStatus === 'completed' ? 'animate-spin' : ''}`} />
              Reprocess Completed
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState !== null}
        title={`Reprocess ${confirmState?.count} ${confirmState?.status} expense(s)?`}
        message={`This will queue all ${confirmState?.status} expenses for reprocessing. Processing will be throttled automatically.`}
        confirmLabel="Reprocess"
        confirmClass="bg-[#0e639c] hover:bg-[#1177bb]"
        onConfirm={() => {
          const s = confirmState!.status;
          setConfirmState(null);
          handleReprocess(s);
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
