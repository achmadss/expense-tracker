import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishToQueue } from '@/lib/rabbitmq';

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

    if (expense.status !== 'completed' && expense.status !== 'failed' && expense.status !== 'cancelled') {
      return NextResponse.json({ error: 'Can only redo completed, failed, or cancelled expenses' }, { status: 400 });
    }

    await prisma.expense.update({
      where: { id },
      data: { status: 'processing' },
    });

    await publishToQueue(process.env.RABBITMQ_QUEUE || 'expense_processing', {
      expenseId: expense.id,
      messageId: expense.messageId,
      interactionToken: expense.interactionToken,
      text: expense.text,
      imageUrls: expense.imageUrls,
      isRedo: true,
    });

    return NextResponse.json({ success: true, message: 'Reprocessing started' });
  } catch (error) {
    console.error('Error redoing expense:', error);
    return NextResponse.json({ error: 'Failed to redo expense' }, { status: 500 });
  }
}
