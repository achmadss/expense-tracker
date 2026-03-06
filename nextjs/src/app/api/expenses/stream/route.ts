import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import amqp from 'amqplib';

const prisma = new PrismaClient();
const EXPENSE_UPDATES_QUEUE = 'expense_updates';

let eventSourceClients: Set<ReadableStreamDefaultController> = new Set();

async function setupExpenseUpdatesConsumer() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  const channel = await connection.createChannel();
  
  await channel.assertQueue(EXPENSE_UPDATES_QUEUE, { durable: true });
  await channel.consume(EXPENSE_UPDATES_QUEUE, async (msg) => {
    if (msg) {
      try {
        const { expenseId } = JSON.parse(msg.content.toString());
        
        const expense = await prisma.expense.findUnique({
          where: { id: expenseId },
        });
        
        if (expense) {
          const serializedExpense = {
            ...expense,
            timestamp: expense.timestamp.toISOString(),
            createdAt: expense.createdAt.toISOString(),
            updatedAt: expense.updatedAt.toISOString(),
          };
          
          const encoder = new TextEncoder();
          const data = JSON.stringify({ expense: serializedExpense });
          
          for (const client of eventSourceClients) {
            try {
              client.enqueue(encoder.encode(`data: ${data}\n\n`));
            } catch (e) {
              eventSourceClients.delete(client);
            }
          }
        }
        
        channel.ack(msg);
      } catch (error) {
        console.error('Error processing expense update:', error);
        channel.ack(msg);
      }
    }
  });
  
  console.log('Expense updates consumer started');
}

setupExpenseUpdatesConsumer().catch(console.error);

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      eventSourceClients.add(controller);
      
      request.signal.addEventListener('abort', () => {
        eventSourceClients.delete(controller);
        controller.close();
      });
    },
    cancel() {
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
