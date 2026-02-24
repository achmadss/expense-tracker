'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';

interface ExtractedData {
  items?: Array<{ name: string; price: number; quantity: number }>;
  tax?: number;
  total?: number;
}

interface Expense {
  id: string;
  messageId?: string | null;
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

interface ExpenseTableProps {
  expenses: Expense[];
  onDelete?: (id: string) => void;
}

function parseExtracted(raw: string | null): ExtractedData | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function ExpenseTable({ expenses, onDelete }: ExpenseTableProps) {
  if (expenses.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">No expenses found.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="bg-gray-50 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {expenses.map((expense) => {
            const extracted = parseExtracted(expense.extractedData);
            return (
              <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {format(new Date(expense.timestamp), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-900">{expense.userTag}</div>
                  <div className="text-xs text-gray-400">{expense.userId}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                  {expense.text || <span className="text-gray-400 italic">no description</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {extracted?.items
                    ? <span>{extracted.items.length} item{extracted.items.length !== 1 ? 's' : ''}</span>
                    : <span className="text-gray-400">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {extracted?.total !== undefined
                    ? extracted.total.toLocaleString()
                    : <span className="text-gray-400">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={expense.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/expenses/${expense.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </Link>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(expense.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
