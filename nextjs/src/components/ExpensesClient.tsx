'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState, useTransition, useEffect } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import ExpenseTable from '@/components/ExpenseTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import EditExpenseDialog from '@/components/EditExpenseDialog';
import Breadcrumbs from '@/components/Breadcrumbs';

interface Expense {
  id: string;
  userId: string;
  userTag: string;
  description?: string | null;
  aiDescription?: string | null;
  text: string;
  imageUrls: string[];
  ocrText: string | null;
  extractedData: string | null;
  status: string;
  timestamp: string;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ExpensesClientProps {
  expenses: Expense[];
  pagination: PaginationInfo;
}

interface ConfirmState {
  open: boolean;
  type: 'delete' | 'reprocess' | 'delete-many' | 'reprocess-many';
  ids: string[];
}

export default function ExpensesClient({ expenses: initialExpenses, pagination }: ExpensesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({
    open: false,
    type: 'delete',
    ids: [],
  });

  useEffect(() => {
    const eventSource = new EventSource('/api/expenses/stream');

    eventSource.onmessage = (event) => {
      try {
        const { expense: updatedExpense } = JSON.parse(event.data);
        setExpenses((prev) => {
          const index = prev.findIndex((e) => e.id === updatedExpense.id);
          if (index >= 0) {
            const newExpenses = [...prev];
            newExpenses[index] = {
              ...updatedExpense,
              timestamp: updatedExpense.timestamp,
              createdAt: updatedExpense.createdAt,
            };
            return newExpenses;
          }
          return prev;
        });
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
  }, []);

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, searchParams, pathname]
  );

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(expenses.map((e) => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [expenses]);

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleEdit = useCallback((expense: Expense) => {
    setEditExpense(expense);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditExpense(null);
    router.refresh();
  }, [router]);

  const handleDelete = useCallback((id: string) => {
    setConfirmDialog({ open: true, type: 'delete', ids: [id] });
  }, []);

  const handleReprocess = useCallback((id: string) => {
    setConfirmDialog({ open: true, type: 'reprocess', ids: [id] });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({ open: true, type: 'delete-many', ids: Array.from(selectedIds) });
  }, [selectedIds]);

  const handleReprocessSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({ open: true, type: 'reprocess-many', ids: Array.from(selectedIds) });
  }, [selectedIds]);

  const executeConfirm = useCallback(async () => {
    const { type, ids } = confirmDialog;
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    if (type === 'delete' || type === 'delete-many') {
      const res = ids.length === 1
        ? await fetch(`/api/expenses/${ids[0]}`, { method: 'DELETE' })
        : await fetch('/api/expenses', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
          });
      if (res.ok) {
        if (type === 'delete-many') setSelectedIds(new Set());
        router.refresh();
      }
    } else {
      const res = await fetch('/api/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        if (type === 'reprocess-many') setSelectedIds(new Set());
        router.refresh();
      }
    }
  }, [confirmDialog, router]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(newPage));
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, searchParams, pathname]
  );

  const handleLimitChange = useCallback(
    (newLimit: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('limit', newLimit);
      params.delete('page');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, searchParams, pathname]
  );

  const currentStatus = searchParams.get('status') || '';
  const someSelected = selectedIds.size > 0;

  const confirmConfig = {
    delete: { title: 'Delete Expense', message: 'Delete this expense? This cannot be undone.', label: 'Delete', cls: 'bg-[#c72e2e] hover:bg-[#a82525]' },
    reprocess: { title: 'Reprocess Expense', message: 'Reprocess this expense?', label: 'Reprocess', cls: 'bg-[#cc7a00] hover:bg-[#a86400]' },
    'delete-many': { title: 'Delete Expenses', message: `Delete ${confirmDialog.ids.length} expense(s)? This cannot be undone.`, label: 'Delete All', cls: 'bg-[#c72e2e] hover:bg-[#a82525]' },
    'reprocess-many': { title: 'Reprocess Expenses', message: `Reprocess ${confirmDialog.ids.length} expense(s)?`, label: 'Reprocess All', cls: 'bg-[#cc7a00] hover:bg-[#a86400]' },
  }[confirmDialog.type];

  return (
    <div>
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.label}
        confirmClass={confirmConfig.cls}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />

      <EditExpenseDialog
        expense={editExpense}
        onClose={() => setEditExpense(null)}
        onSuccess={handleEditSuccess}
      />

      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Expenses' }]} />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-[#d4d4d4]">Expenses</h1>
        <Link
          href="/expenses/new"
          className="px-4 py-2 bg-[#0e639c] text-white text-sm rounded hover:bg-[#1177bb] transition-colors"
        >
          + New Expense
        </Link>
      </div>

      <div className={`bg-[#252526] border border-[#3e3e42] rounded-lg mb-4 ${isPending ? 'opacity-60' : ''}`}>
        <div className="p-3 border-b border-[#3e3e42] flex gap-3 flex-wrap items-center">
          <select
            value={currentStatus}
            onChange={(e) => updateParam('status', e.target.value)}
            className="px-3 py-1.5 bg-[#3c3c3c] border border-[#3e3e42] rounded text-sm text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#4fc1ff]"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          {someSelected && (
            <>
              <button
                onClick={handleReprocessSelected}
                className="px-3 py-1.5 bg-[#cc7a00] text-white text-sm rounded hover:bg-[#a86400] transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reprocess ({selectedIds.size})
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 bg-[#c72e2e] text-white text-sm rounded hover:bg-[#a82525] transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedIds.size})
              </button>
            </>
          )}
        </div>

        <ExpenseTable
          expenses={expenses}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          onEdit={handleEdit}
          onReprocess={handleReprocess}
          onDelete={handleDelete}
        />

        <div className="p-3 border-t border-[#3e3e42] flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#858585]">Show:</span>
            <select
              value={pagination.limit}
              onChange={(e) => handleLimitChange(e.target.value)}
              className="px-2 py-1 bg-[#3c3c3c] border border-[#3e3e42] rounded text-sm text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#4fc1ff]"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span className="text-sm text-[#858585]">per page</span>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#d4d4d4] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                const showPage = p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1;
                if (!showPage && p !== pagination.page - 2 && p !== pagination.page + 2) {
                  return p === pagination.page - 3 || p === pagination.page + 3 ? (
                    <span key={p} className="px-2 text-[#858585]">...</span>
                  ) : null;
                }
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      p === pagination.page
                        ? 'bg-[#094771] text-white'
                        : 'bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#d4d4d4]'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#d4d4d4] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-[#858585] text-center">
        Showing {expenses.length} of {pagination.total} expenses
      </p>
    </div>
  );
}
