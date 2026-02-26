import { prisma } from '@/lib/prisma';
import ExpensesClient from '@/components/ExpensesClient';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getExpenses(searchParams: { [key: string]: string | string[] | undefined }) {
  const page = parseInt(String(searchParams.page || '1'));
  const limit = parseInt(String(searchParams.limit || '10'));
  const userId = searchParams.userId ? String(searchParams.userId) : undefined;
  const status = searchParams.status ? String(searchParams.status) : undefined;

  const where: Record<string, unknown> = {};

  if (userId) where.userId = userId;
  if (status) where.status = status;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.count({ where }),
  ]);

  const serializedExpenses = expenses.map((e) => ({
    ...e,
    timestamp: e.timestamp.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  return {
    expenses: serializedExpenses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const { expenses, pagination } = await getExpenses(params);

  return <ExpensesClient expenses={expenses} pagination={pagination} />;
}
