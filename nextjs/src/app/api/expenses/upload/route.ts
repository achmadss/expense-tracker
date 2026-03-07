import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishToQueue } from '@/lib/rabbitmq';
import { uploadToStorage } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const files = formData.getAll('files') as File[];
    const description = formData.get('description') as string | null;
    const text = formData.get('text') as string | null;
    const userId = formData.get('userId') as string | null;
    const userTag = formData.get('userTag') as string | null;

    const hasFiles = files && files.length > 0;
    const hasText = text && text.trim().length > 0;

    if (!hasFiles && !hasText) {
      return NextResponse.json(
        { error: 'At least text or image is required' },
        { status: 400 }
      );
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const SUPPORTED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    const imageUrls: string[] = [];

    if (hasFiles) {
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File ${file.name} exceeds 50MB limit` },
            { status: 400 }
          );
        }

        if (!SUPPORTED_CONTENT_TYPES.includes(file.type)) {
          return NextResponse.json(
            { error: `Unsupported file type: ${file.type}. Supported: jpeg, png, webp, pdf` },
            { status: 400 }
          );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        const storageUrl = await uploadToStorage(buffer, file.name, file.type);
        imageUrls.push(storageUrl);
      }
    }

    const expense = await prisma.expense.create({
      data: {
        userId: userId || 'manual',
        userTag: userTag || 'manual',
        description: description || null,
        text: text || '',
        imageUrls,
        status: 'pending',
        timestamp: new Date(),
      },
    });

    if (imageUrls.length > 0) {
      await publishToQueue(process.env.RABBITMQ_QUEUE || 'expense_processing', {
        expenseId: expense.id,
        messageId: expense.id,
        interactionToken: null,
        description: expense.description,
        text: expense.text,
        imageUrls,
      });
    }

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Error creating expense with upload:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
