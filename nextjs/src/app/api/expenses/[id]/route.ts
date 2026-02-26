import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    
    const updateData: Record<string, unknown> = {
      messageId: body.messageId,
      userId: body.userId,
      userTag: body.userTag,
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

    const expense = await prisma.expense.update({
      where: { id },
      data: updateData,
    });

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
