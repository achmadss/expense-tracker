'use client';

import ExpenseForm from './ExpenseForm';

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

interface EditExpenseDialogProps {
  expense: Expense | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditExpenseDialog({ expense, onClose, onSuccess }: EditExpenseDialogProps) {
  if (!expense) return null;

  let extractedData = null;
  try {
    if (expense.extractedData) extractedData = JSON.parse(expense.extractedData);
  } catch { /* ignore */ }

  const initialData = {
    id: expense.id,
    description: expense.description || '',
    aiDescription: expense.aiDescription || '',
    text: expense.text,
    userId: expense.userId,
    userTag: expense.userTag,
    imageUrls: expense.imageUrls,
    ocrText: expense.ocrText || undefined,
    timestamp: expense.timestamp ? new Date(expense.timestamp).toISOString().slice(0, 16) : undefined,
    extractedData,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#252526] border border-[#3e3e42] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3e3e42]">
          <h2 className="text-[#d4d4d4] font-semibold">Edit Expense</h2>
          <button
            onClick={onClose}
            className="text-[#858585] hover:text-[#d4d4d4] text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>
        <div className="p-6">
          <ExpenseForm
            initialData={initialData}
            mode="edit"
            onSuccess={onSuccess}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
