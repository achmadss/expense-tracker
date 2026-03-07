import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const history = await prisma.expenseHistory.findMany({
    where: { expenseId: id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(history);
}
