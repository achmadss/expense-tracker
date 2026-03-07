import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Item {
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

interface ExtractedData {
  items: Item[];
  tax?: number;
  total?: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const where: Record<string, unknown> = { status: 'completed' };

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) (where.timestamp as Record<string, Date>).gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      (where.timestamp as Record<string, Date>).lte = end;
    }
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: { id: true, timestamp: true, extractedData: true },
    orderBy: { timestamp: 'asc' },
  });

  const categoryTotals: Record<string, number> = {};
  const dailyTotals: Record<string, number> = {};
  const itemTotals: Record<string, number> = {};
  let totalSpent = 0;

  for (const expense of expenses) {
    if (!expense.extractedData) continue;

    let data: ExtractedData;
    try {
      data = JSON.parse(expense.extractedData);
    } catch {
      continue;
    }

    const dateKey = expense.timestamp.toISOString().slice(0, 10);
    let expenseTotal = 0;

    for (const item of data.items || []) {
      const amount = (item.price || 0) * (item.quantity || 1);
      const category = item.category || 'Other';

      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
      itemTotals[item.name] = (itemTotals[item.name] || 0) + amount;
      expenseTotal += amount;
    }

    // Use extracted total if available and greater (covers tax etc)
    if (data.total && data.total > expenseTotal) {
      expenseTotal = data.total;
    }

    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + expenseTotal;
    totalSpent += expenseTotal;
  }

  const categoryData = Object.entries(categoryTotals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const dailyData = Object.entries(dailyTotals)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topItems = Object.entries(itemTotals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const transactionCount = expenses.length;
  const avgPerTransaction = transactionCount > 0 ? Math.round(totalSpent / transactionCount) : 0;

  return NextResponse.json({
    summary: { totalSpent, transactionCount, avgPerTransaction },
    categoryData,
    dailyData,
    topItems,
  });
}
