import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import ExpensesClient from '@/components/ExpensesClient';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ page?: string; status?: string; userId?: string }>;
}

async function getExpenses(page: number, status?: string, userId?: string) {
  const take = 20;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, total, totalPages: Math.ceil(total / take) };
}

export default async function ExpensesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const status = params.status;
  const userId = params.userId;

  const { expenses, total, totalPages } = await getExpenses(page, status, userId);

  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}>
      <ExpensesClient
        expenses={expenses as unknown as Expense[]}
        total={total}
        totalPages={totalPages}
        currentPage={page}
      />
    </Suspense>
  );
}

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
