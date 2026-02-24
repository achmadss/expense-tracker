import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ExpenseForm from '@/components/ExpenseForm';

export default function NewExpensePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/expenses" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Expenses
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">New Expense</h1>

        <div className="bg-white rounded-lg shadow p-6">
          <ExpenseForm mode="create" />
        </div>
      </div>
    </div>
  );
}
