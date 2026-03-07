import { prisma } from './prisma';

export async function captureSnapshot(expenseId: string, triggeredBy: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return;
  await prisma.expenseHistory.create({
    data: {
      expenseId,
      triggeredBy,
      snapshot: JSON.stringify(expense),
    },
  });
}
