import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ExpenseForm from '@/components/ExpenseForm';

interface Props {
  params: Promise<{ id: string }>;
}

async function getExpense(id: string) {
  return prisma.expense.findUnique({
    where: { id },
  });
}

export default async function EditExpensePage({ params }: Props) {
  const { id } = await params;
  const expense = await getExpense(id);

  if (!expense) {
    notFound();
  }

  const initialData = {
    id: expense.id,
    messageId: expense.messageId || '',
    userId: expense.userId,
    userTag: expense.userTag,
    text: expense.text,
    imageUrls: expense.imageUrls,
    channelId: expense.channelId || '',
    isDm: expense.isDm || false,
    timestamp: expense.timestamp ? new Date(expense.timestamp).toISOString().slice(0, 16) : '',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Edit Expense</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <ExpenseForm initialData={initialData} mode="edit" />
        </div>
      </div>
    </div>
  );
}
