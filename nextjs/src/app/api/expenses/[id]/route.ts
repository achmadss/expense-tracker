import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishToQueue } from '@/lib/rabbitmq';
import { captureSnapshot } from '@/lib/expenseHistory';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const expense = await prisma.expense.findUnique({
    where: { id },
  });

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  return NextResponse.json(expense);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    const existingExpense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const textChanged = existingExpense.text !== body.text;
    const imagesChanged = JSON.stringify(existingExpense.imageUrls) !== JSON.stringify(body.imageUrls || []);
    const shouldReprocess = textChanged || imagesChanged;

    const updateData: Record<string, unknown> = {
      messageId: body.messageId,
      userId: body.userId,
      userTag: body.userTag,
      description: body.description || null,
      text: body.text,
      imageUrls: body.imageUrls || [],
      channelId: body.channelId,
      isDm: body.isDm || false,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    };

    if (body.extractedData !== undefined) {
      updateData.extractedData = typeof body.extractedData === 'string' 
        ? body.extractedData 
        : JSON.stringify(body.extractedData);
    }

    await captureSnapshot(id, 'edit');

    const expense = await prisma.expense.update({
      where: { id },
      data: updateData,
    });

    if (shouldReprocess) {
      await prisma.expense.update({
        where: { id },
        data: { status: 'processing' },
      });

      await publishToQueue(process.env.RABBITMQ_QUEUE || 'expense_processing', {
        expenseId: expense.id,
        messageId: expense.messageId || expense.id,
        interactionToken: expense.interactionToken,
        description: expense.description,
        text: expense.text,
        imageUrls: expense.imageUrls,
        isRedo: true,
      });
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    await prisma.expense.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}

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

    if (expense.status !== 'completed' && expense.status !== 'failed') {
      return NextResponse.json({ error: 'Can only redo completed or failed expenses' }, { status: 400 });
    }

    await prisma.expense.update({
      where: { id },
      data: { status: 'processing' },
    });

    await publishToQueue(process.env.RABBITMQ_QUEUE || 'expense_processing', {
      expenseId: expense.id,
      messageId: expense.messageId,
      interactionToken: expense.interactionToken,
      description: expense.description,
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
