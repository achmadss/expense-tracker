'use client';

import { format } from 'date-fns';
import { DollarSign, Calendar, User, Receipt } from 'lucide-react';
import StatusBadge from './StatusBadge';

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

interface ExpenseCardProps {
  expense: Expense;
}

export default function ExpenseCard({ expense }: ExpenseCardProps) {
  const extracted = expense.extractedData ? JSON.parse(expense.extractedData) as { amount?: number; category?: string; vendor?: string } | null : null;
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-lg truncate flex-1">
          {extracted?.vendor || expense.text || 'Expense'}
        </h3>
        <StatusBadge status={expense.status} />
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        {extracted?.amount && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span className="font-medium">${extracted.amount.toFixed(2)}</span>
          </div>
        )}
        
        {extracted?.category && (
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            <span>{extracted.category}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <span>{expense.userTag}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>{format(new Date(expense.timestamp), 'MMM d, yyyy')}</span>
        </div>
      </div>
      
      {expense.imageUrls.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <span className="text-xs text-gray-500">{expense.imageUrls.length} receipt(s)</span>
        </div>
      )}
    </div>
  );
}
