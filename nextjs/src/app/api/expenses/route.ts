import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const userId = searchParams.get('userId');
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const where: Record<string, unknown> = {};

  if (userId) where.userId = userId;
  if (status) where.status = status;
  
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) (where.timestamp as Record<string, Date>).gte = new Date(startDate);
    if (endDate) (where.timestamp as Record<string, Date>).lte = new Date(endDate);
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.count({ where }),
  ]);

  return NextResponse.json({
    data: expenses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const expense = await prisma.expense.create({
      data: {
        messageId: body.messageId,
        userId: body.userId,
        userTag: body.userTag,
        text: body.text,
        imageUrls: body.imageUrls || [],
        channelId: body.channelId,
        isDm: body.isDm || false,
        ocrText: body.ocrText,
        extractedData: body.extractedData ? JSON.stringify(body.extractedData) : null,
        status: body.status || 'unprocessed',
        timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
