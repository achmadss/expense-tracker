'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Search } from 'lucide-react';
import ExpenseTable from '@/components/ExpenseTable';

interface Expense {
  id: string;
  userId: string;
  userTag: string;
  text: string;
  imageUrls: string[];
  ocrText: string | null;
  extractedData: string | null;
  status: string;
  timestamp: string;
  createdAt: string;
}

interface ExpensesClientProps {
  expenses: Expense[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export default function ExpensesClient({
  expenses,
  total,
  totalPages,
  currentPage,
}: ExpensesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page'); // reset to page 1 on filter change
      startTransition(() => {
        router.push(`/expenses?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    } else {
      alert('Failed to delete expense.');
    }
  }, [router]);

  const currentStatus = searchParams.get('status') || '';
  const currentSearch = searchParams.get('userId') || '';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <Link
            href="/expenses/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Expense
          </Link>
        </div>

        <div className={`bg-white rounded-lg shadow mb-6 ${isPending ? 'opacity-60' : ''}`}>
          <div className="p-4 border-b flex gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by user ID..."
                defaultValue={currentSearch}
                onChange={(e) => updateParam('userId', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={currentStatus}
              onChange={(e) => updateParam('status', e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="unprocessed">Unprocessed</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <ExpenseTable expenses={expenses} onDelete={handleDelete} />

          {totalPages > 1 && (
            <div className="p-4 border-t flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set('page', String(p));
                return (
                  <Link
                    key={p}
                    href={`/expenses?${params.toString()}`}
                    className={`px-3 py-1 rounded ${
                      p === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 text-center">
          Showing {expenses.length} of {total} expenses
        </p>
      </div>
    </div>
  );
}
