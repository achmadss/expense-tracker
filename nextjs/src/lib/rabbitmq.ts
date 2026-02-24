import amqp from 'amqplib';

let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
let channel: Awaited<ReturnType<Awaited<ReturnType<typeof amqp.connect>>['createChannel']>> | null = null;

export async function connectRabbitMQ() {
  if (channel) return channel;

  connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  channel = await connection.createChannel();

  await channel.assertQueue(process.env.RABBITMQ_QUEUE || 'expense_processing', { durable: true });
  await channel.assertQueue(process.env.RABBITMQ_REPLY_QUEUE || 'expense_results', { durable: true });

  console.log('RabbitMQ connected');
  return channel;
}

export async function publishToQueue(queue: string, message: object): Promise<void> {
  const ch = await connectRabbitMQ();
  const buffer = Buffer.from(JSON.stringify(message));
  ch.sendToQueue(queue, buffer, { persistent: true });
}

export async function consumeFromQueue(
  queue: string,
  callback: (message: object) => Promise<void>
): Promise<void> {
  const ch = await connectRabbitMQ();
  
  await ch.consume(queue, async (msg) => {
    if (msg) {
      try {
        const content = JSON.parse(msg.content.toString());
        await callback(content);
        ch.ack(msg);
      } catch (error) {
        console.error('Error processing message:', error);
        ch.nack(msg, false, false);
      }
    }
  });
}

export async function closeRabbitMQ(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
