import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ExpenseStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.status !== 'pending' && expense.status !== 'processing') {
      return NextResponse.json({ error: 'Can only cancel pending or processing expenses' }, { status: 400 });
    }

    await prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.cancelled },
    });

    return NextResponse.json({ success: true, message: 'Expense cancelled' });
  } catch (error) {
    console.error('Error cancelling expense:', error);
    return NextResponse.json({ error: 'Failed to cancel expense' }, { status: 500 });
  }
}
