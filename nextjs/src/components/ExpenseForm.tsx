'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const expenseSchema = z.object({
  text: z.string().min(1, 'Description is required'),
  userId: z.string().optional(),
  userTag: z.string().optional(),
  messageId: z.string().optional(),
  channelId: z.string().optional(),
  isDm: z.boolean().optional(),
  timestamp: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  initialData?: Partial<ExpenseFormData> & { id?: string };
  mode?: 'create' | 'edit';
}

export default function ExpenseForm({ initialData, mode = 'edit' }: ExpenseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      text: initialData?.text || '',
      userId: initialData?.userId || '',
      userTag: initialData?.userTag || '',
      messageId: initialData?.messageId || '',
      channelId: initialData?.channelId || '',
      isDm: initialData?.isDm || false,
      timestamp: initialData?.timestamp || new Date().toISOString().slice(0, 16),
    },
  });

  const onSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true);
    setError(null);

    const payload = {
      text: data.text,
      userId: data.userId || 'manual',
      userTag: data.userTag || 'manual',
      messageId: data.messageId || null,
      channelId: data.channelId || null,
      isDm: data.isDm || false,
      imageUrls: [],
      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
    };

    try {
      let response: Response;

      if (mode === 'create') {
        response = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`/api/expenses/${initialData?.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) throw new Error('Request failed');

      const expense = await response.json();
      router.push(mode === 'create' ? `/expenses/${expense.id}` : '/expenses');
    } catch {
      setError(mode === 'create' ? 'Failed to create expense.' : 'Failed to update expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <input
          {...register('text')}
          type="text"
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. lunch at mcdonalds, receipt from ace hardware"
        />
        {errors.text && <p className="text-red-500 text-xs mt-1">{errors.text.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">User Tag</label>
          <input
            {...register('userTag')}
            type="text"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="user#0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
          <input
            {...register('userId')}
            type="text"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Discord user ID"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message ID</label>
          <input
            {...register('messageId')}
            type="text"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Discord message ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
          <input
            {...register('channelId')}
            type="text"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Discord channel ID"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timestamp</label>
          <input
            {...register('timestamp')}
            type="datetime-local"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center mt-6">
          <input
            {...register('isDm')}
            type="checkbox"
            id="isDm"
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="isDm" className="ml-2 text-sm text-gray-700">From DM</label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Expense' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
