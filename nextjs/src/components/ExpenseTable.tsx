'use client';

import { format } from 'date-fns';
import { Trash2, Pencil, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

interface ExpenseTableProps {
  expenses: Expense[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onEdit: (expense: Expense) => void;
  onReprocess: (id: string) => void;
  onDelete: (id: string) => void;
}

function parseExtracted(raw: string | null): ExtractedData | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function ExpenseTable({
  expenses,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onEdit,
  onReprocess,
  onDelete,
}: ExpenseTableProps) {
  const router = useRouter();
  const allSelected = expenses.length > 0 && expenses.every((e) => selectedIds.has(e.id));

  if (expenses.length === 0) {
    return (
      <div className="p-8 text-center text-[#858585]">No expenses found.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="bg-[#252526] border-b border-[#3e3e42] text-left text-xs font-medium text-[#858585] uppercase tracking-wider">
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-[#3e3e42] bg-[#3c3c3c] accent-[#4fc1ff]"
              />
            </th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3e3e42]">
          {expenses.map((expense) => {
            const extracted = parseExtracted(expense.extractedData);
            const isSelected = selectedIds.has(expense.id);
            return (
              <tr
                key={expense.id}
                onClick={() => router.push(`/expenses/${expense.id}`)}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#094771]/30' : 'bg-[#1e1e1e] hover:bg-[#2a2d2e]'
                }`}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectOne(expense.id, e.target.checked)}
                    className="w-4 h-4 rounded border-[#3e3e42] bg-[#3c3c3c] accent-[#4fc1ff]"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-[#858585] whitespace-nowrap">
                  {format(new Date(expense.timestamp), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-[#d4d4d4]">{expense.userTag}</div>
                  <div className="text-xs text-[#858585]">{expense.userId}</div>
                </td>
                <td className="px-4 py-3 text-sm text-[#d4d4d4] max-w-xs">
                  {expense.description || expense.aiDescription ? (
                    <div>
                      <div className="truncate">{expense.description || expense.aiDescription}</div>
                      {expense.description && expense.aiDescription && (
                        <div className="text-xs text-[#858585] truncate">{expense.aiDescription}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[#858585] italic">no description</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[#858585]">
                  {extracted?.items ? (
                    <span>{extracted.items.length} item{extracted.items.length !== 1 ? 's' : ''}</span>
                  ) : (
                    <span className="text-[#858585]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-[#4fc1ff]">
                  {extracted?.total !== undefined ? (
                    extracted.total.toLocaleString()
                  ) : (
                    <span className="text-[#858585]">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={expense.status} />
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(expense)}
                      className="text-[#858585] hover:text-[#4fc1ff] transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onReprocess(expense.id)}
                      className="text-[#858585] hover:text-orange-400 transition-colors"
                      title="Reprocess"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(expense.id)}
                      className="text-[#858585] hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
