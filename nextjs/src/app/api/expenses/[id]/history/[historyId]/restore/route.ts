import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { captureSnapshot } from '@/lib/expenseHistory';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  const { id, historyId } = await params;

  const historyEntry = await prisma.expenseHistory.findUnique({ where: { id: historyId } });
  if (!historyEntry) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const snap = JSON.parse(historyEntry.snapshot);

  await captureSnapshot(id, 'restore');

  await prisma.expense.update({
    where: { id },
    data: {
      description: snap.description,
      aiDescription: snap.aiDescription,
      text: snap.text,
      imageUrls: snap.imageUrls,
      ocrText: snap.ocrText,
      extractedData: snap.extractedData,
      status: snap.status,
    },
  });

  return NextResponse.json({ success: true });
}
