import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ExpenseDetailClient from '@/components/ExpenseDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

async function getExpense(id: string) {
  return prisma.expense.findUnique({ where: { id } });
}

export default async function ExpenseDetailPage({ params }: Props) {
  const { id } = await params;
  const expense = await getExpense(id);

  if (!expense) notFound();

  const serializedExpense = {
    ...expense,
    timestamp: expense.timestamp.toISOString(),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };

  return <ExpenseDetailClient initialExpense={serializedExpense} />;
}
