import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const where: Record<string, unknown> = {};

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
    orderBy: { timestamp: 'desc' },
  });

  const rows: string[] = ['Date,User,Description,Items,Total,Status'];

  for (const expense of expenses) {
    let items = '';
    let total = '';

    if (expense.extractedData) {
      try {
        const data = JSON.parse(expense.extractedData);
        items = (data.items || [])
          .map((item: { name: string; quantity: number; price: number }) =>
            `${item.quantity}x ${item.name} @ ${item.price}`
          )
          .join('; ');
        total = String(data.total || '');
      } catch {
        // leave empty
      }
    }

    rows.push([
      escapeCsv(expense.timestamp.toISOString().slice(0, 10)),
      escapeCsv(expense.userTag),
      escapeCsv(expense.aiDescription || expense.description),
      escapeCsv(items),
      escapeCsv(total),
      escapeCsv(expense.status),
    ].join(','));
  }

  const csv = rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="expenses-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
