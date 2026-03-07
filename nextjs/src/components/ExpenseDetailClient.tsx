'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Edit, FileText, RotateCcw } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import StatusBadge from '@/components/StatusBadge';
import DeleteExpenseButton from '@/components/DeleteExpenseButton';
import ReprocessButton from '@/components/ReprocessButton';
import CancelButton from '@/components/CancelButton';

interface ExtractedData {
  items?: Array<{ name: string; price: number; quantity: number }>;
  tax?: number;
  total?: number;
}

interface Expense {
  id: string;
  messageId: string | null;
  channelId: string | null;
  isDm: boolean;
  userId: string;
  userTag: string;
  description: string | null;
  aiDescription: string | null;
  text: string;
  imageUrls: string[];
  ocrText: string | null;
  extractedData: string | null;
  status: string;
  timestamp: string;
  createdAt: string;
}

interface HistoryEntry {
  id: string;
  expenseId: string;
  triggeredBy: string;
  snapshot: string;
  createdAt: string;
}

interface ExpenseDetailClientProps {
  initialExpense: Expense;
}

function parseExtracted(raw: string | null): ExtractedData | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const TRIGGER_COLORS: Record<string, string> = {
  reprocess: 'bg-[#264f78] text-[#9cdcfe]',
  edit: 'bg-[#3a3a1a] text-[#dcdcaa]',
  restore: 'bg-[#1a3a1a] text-[#4ec9b0]',
};

function ExpenseHistoryPanel({
  expenseId,
  refreshSignal,
}: {
  expenseId: string;
  refreshSignal: number;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const res = await fetch(`/api/expenses/${expenseId}/history`);
    if (res.ok) setHistory(await res.json());
  }, [expenseId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshSignal]);

  const restore = async (historyId: string) => {
    setRestoring(historyId);
    try {
      await fetch(`/api/expenses/${expenseId}/history/${historyId}/restore`, { method: 'POST' });
      await fetchHistory();
      window.location.reload();
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="w-72 flex-shrink-0 bg-[#252526] border-l border-[#3e3e42] flex flex-col">
      <div className="px-4 py-3 border-b border-[#3e3e42]">
        <h2 className="text-xs font-semibold text-[#d4d4d4] uppercase tracking-wide">History</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {history.length === 0 ? (
          <p className="text-xs text-[#858585] italic px-1">No history yet.</p>
        ) : (
          history.map((entry) => {
            const snap = parseExtracted(JSON.parse(entry.snapshot).extractedData);
            const snapStatus: string = JSON.parse(entry.snapshot).status ?? '';
            return (
              <div
                key={entry.id}
                className="bg-[#1e1e1e] hover:bg-[#2a2d2e] rounded border border-[#3e3e42] p-3 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${TRIGGER_COLORS[entry.triggeredBy] ?? 'bg-[#3e3e42] text-[#d4d4d4]'}`}
                  >
                    {entry.triggeredBy}
                  </span>
                  <span className="text-[10px] text-[#858585]">
                    {format(new Date(entry.createdAt), 'MMM d, HH:mm')}
                  </span>
                </div>
                <p className="text-[11px] text-[#858585] mt-1">
                  {snapStatus && <span className="capitalize">{snapStatus}</span>}
                  {snap?.total !== undefined && (
                    <span className="ml-1">· {snap.total.toLocaleString()}</span>
                  )}
                </p>
                <button
                  onClick={() => restore(entry.id)}
                  disabled={restoring === entry.id}
                  className="mt-2 flex items-center gap-1 text-[11px] text-[#4ec9b0] hover:text-[#9cdcfe] disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  {restoring === entry.id ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ExpenseDetailClient({ initialExpense }: ExpenseDetailClientProps) {
  const [expense, setExpense] = useState<Expense>(initialExpense);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  useEffect(() => {
    const eventSource = new EventSource('/api/expenses/stream');

    eventSource.onmessage = (event) => {
      try {
        const { expense: updatedExpense } = JSON.parse(event.data);
        if (updatedExpense.id === expense.id) {
          setExpense(updatedExpense);
          setHistoryRefresh((n) => n + 1);
        }
      } catch (e) {
        console.error('Error parsing SSE message:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [expense.id]);

  const extracted = parseExtracted(expense.extractedData);
  const isFinal = expense.status === 'completed' || expense.status === 'failed' || expense.status === 'cancelled';
  const isCancellable = expense.status === 'processing' || expense.status === 'pending';

  return (
    <div className="min-h-screen bg-[#1e1e1e] flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Left: main content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl">

            <Breadcrumbs crumbs={[
              { label: 'Home', href: '/' },
              { label: 'Expenses', href: '/expenses' },
              { label: expense.description || expense.aiDescription || expense.id.slice(0, 8) },
            ]} />

            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#d4d4d4]">
                  {expense.description || expense.aiDescription || 'Expense'}
                </h1>
                {(expense.description && expense.aiDescription) && (
                  <p className="text-sm text-[#858585] mt-1">{expense.aiDescription}</p>
                )}
                <p className="text-sm text-[#6a6a6a] mt-1">ID: {expense.id}</p>
              </div>
              <StatusBadge status={expense.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Submission Info */}
              <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6 space-y-4">
                <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wide">Submission</h2>

                <Field label="User Tag" value={expense.userTag} />
                <Field label="User ID" value={expense.userId} />
                {expense.messageId && <Field label="Message ID" value={expense.messageId} />}
                {expense.channelId && <Field label="Channel ID" value={expense.channelId} />}
                <Field label="Source" value={expense.isDm ? 'Direct Message' : 'Channel'} />
                <Field label="Submitted At" value={format(new Date(expense.timestamp), 'PPpp')} />
                <Field label="Record Created" value={format(new Date(expense.createdAt), 'PPpp')} />
              </div>

              {/* Extracted Data */}
              <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6 space-y-4">
                <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wide">Extracted Data</h2>

                {extracted ? (
                  <>
                    {extracted.items && extracted.items.length > 0 ? (
                      <div>
                        <p className="text-xs text-[#858585] mb-2">Items</p>
                        <div className="space-y-1">
                          {extracted.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-[#d4d4d4]">
                                {item.quantity > 1 && <span className="text-[#858585] mr-1">{item.quantity}×</span>}
                                {item.name}
                              </span>
                              <span className="font-medium text-[#d4d4d4]">{item.price.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {extracted.tax !== undefined && (
                      <div className="flex justify-between text-sm border-t border-[#3e3e42] pt-2">
                        <span className="text-[#858585]">Tax</span>
                        <span className="text-[#d4d4d4]">{extracted.tax.toLocaleString()}</span>
                      </div>
                    )}

                    {extracted.total !== undefined && (
                      <div className="flex justify-between text-sm font-semibold border-t border-[#3e3e42] pt-2">
                        <span className="text-[#d4d4d4]">Total</span>
                        <span className="text-[#d4d4d4]">{extracted.total.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[#858585] italic">
                    {expense.status === 'completed' ? 'No structured data extracted.' : 'Not yet processed.'}
                  </p>
                )}
              </div>

              {/* Raw Text */}
              <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6 space-y-4">
                {expense.description && (
                  <>
                    <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wide">Description</h2>
                    <p className="text-sm text-[#d4d4d4] whitespace-pre-wrap">{expense.description}</p>
                  </>
                )}
                <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wide">Raw Text</h2>
                <p className="text-sm text-[#d4d4d4] whitespace-pre-wrap">{expense.text || <span className="italic text-[#858585]">None</span>}</p>

                {expense.ocrText && (
                  <>
                    <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wide pt-2">OCR Text</h2>
                    <pre className="text-xs bg-[#1e1e1e] border border-[#3e3e42] rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap text-[#858585]">
                      {expense.ocrText}
                    </pre>
                  </>
                )}
              </div>

              {/* Receipt Images */}
              {expense.imageUrls.length > 0 && (
                <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
                  <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wide mb-4">Receipts</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {expense.imageUrls.map((url, i) => {
                      const isPdf = url.toLowerCase().endsWith('.pdf');
                      return (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                          {isPdf ? (
                            <div className="w-full h-32 border border-[#3e3e42] rounded flex flex-col items-center justify-center bg-[#1e1e1e] hover:bg-[#2a2d2e] transition-colors">
                              <FileText className="w-8 h-8 text-red-400 mb-2" />
                              <span className="text-xs text-[#858585]">PDF</span>
                            </div>
                          ) : (
                            <img
                              src={url}
                              alt={`Receipt ${i + 1}`}
                              className="w-full h-32 object-cover rounded border border-[#3e3e42] hover:opacity-80 transition-opacity"
                            />
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-8">
              <Link
                href={`/expenses/${expense.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0e639c] text-white text-sm rounded-lg hover:bg-[#1177bb] transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Link>
              {isCancellable && (
                <CancelButton id={expense.id} onSuccess={() => window.location.reload()} />
              )}
              {isFinal && (
                <ReprocessButton id={expense.id} onSuccess={() => window.location.reload()} />
              )}
              <DeleteExpenseButton id={expense.id} />
            </div>

          </div>
        </div>

        {/* Right: history panel */}
        <ExpenseHistoryPanel expenseId={expense.id} refreshSignal={historyRefresh} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#858585] mb-0.5">{label}</p>
      <p className="text-sm text-[#d4d4d4] font-medium break-all">{value}</p>
    </div>
  );
}
