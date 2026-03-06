import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import amqp from 'amqplib';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

const s3Client = new S3Client({
  endpoint: process.env.OBJECT_STORAGE_URL,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_KEY || '',
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET || '',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = 'expenses';

const OCR_REQUEST_QUEUE = process.env.OCR_REQUEST_QUEUE || 'ocr_request';
const OCR_RESULT_QUEUE = process.env.OCR_RESULT_QUEUE || 'ocr_result';
const EXPENSE_UPDATES_QUEUE = 'expense_updates';

async function downloadFromUrl(url: string) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1].split('?')[0] || 'receipt';

  return { buffer, contentType, filename };
}

async function uploadToStorage(buffer: Buffer, filename: string, contentType: string) {
  const key = `receipts/${Date.now()}-${filename}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${process.env.PUBLIC_OBJECT_STORAGE_URL}/${BUCKET_NAME}/${key}`;
}

let ocrConnection: amqp.ChannelModel | null = null;
let ocrChannel: amqp.Channel | null = null;

async function getOcrChannel(): Promise<amqp.Channel> {
  if (ocrChannel) return ocrChannel;

  ocrConnection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  const channel = await ocrConnection.createChannel();
  ocrChannel = channel;

  await channel.assertQueue(OCR_REQUEST_QUEUE, { durable: true });
  await channel.assertQueue(OCR_RESULT_QUEUE, { durable: true });

  return channel;
}

const pendingOcrRequests = new Map<string, { resolve: (content: string) => void; reject: (error: Error) => void }>();

async function setupOcrResultConsumer() {
  const channel = await getOcrChannel();

  await channel.consume(OCR_RESULT_QUEUE, (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        const { requestId, content, error } = data;

        const pending = pendingOcrRequests.get(requestId);
        if (pending) {
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(content || '');
          }
          pendingOcrRequests.delete(requestId);
        }
        channel.ack(msg);
      } catch (err) {
        console.error('Error processing OCR result:', err);
        channel.ack(msg);
      }
    }
  });

  console.log('OCR result consumer started');
}

async function callOcrService(imageUrl: string): Promise<string> {
  const requestId = `ocr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      if (pendingOcrRequests.has(requestId)) {
        pendingOcrRequests.delete(requestId);
        reject(new Error('OCR request timeout'));
      }
    }, 120000);

    pendingOcrRequests.set(requestId, {
      resolve: (content) => {
        clearTimeout(timeout);
        resolve(content);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });

    try {
      const channel = await getOcrChannel();
      const message = Buffer.from(JSON.stringify({ requestId, url: imageUrl }));
      channel.sendToQueue(OCR_REQUEST_QUEUE, message, { persistent: true });
      console.log(`OCR request sent: ${requestId}`);
    } catch (error) {
      clearTimeout(timeout);
      pendingOcrRequests.delete(requestId);
      console.error('Failed to send OCR request:', error);
      reject(error);
    }
  });
}

async function publishExpenseUpdate(expenseId: string) {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const channel = await connection.createChannel();
    await channel.assertQueue(EXPENSE_UPDATES_QUEUE, { durable: true });
    channel.sendToQueue(EXPENSE_UPDATES_QUEUE, Buffer.from(JSON.stringify({ expenseId })), { persistent: true });
    await channel.close();
    await connection.close();
  } catch (error) {
    console.error('Failed to publish expense update:', error);
  }
}

const SYSTEM_PROMPT_PATH = process.env.SYSTEM_PROMPT_PATH || path.join(process.cwd(), 'config', 'system-prompt.txt');

function loadSystemPrompt(): string {
  try {
    return fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
  } catch (error) {
    console.error('Failed to load system prompt from file, using default:', error);
    return 'You are a helpful assistant that extracts expense data from receipts. Return JSON with items (name, price, quantity), tax, and total.';
  }
}

const SYSTEM_PROMPT = loadSystemPrompt();

async function callLlmService(text: string) {
  try {
    const response = await axios.post(`${process.env.LLM_SERVICE_URL}/v1/chat/completions`, {
      model: 'llm7.io/default',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-litellm-api-key': process.env.LITELLM_API_KEY || '',
      },
    });

    const content = response.data.choices?.[0]?.message?.content || '{}';
    console.log('LLM raw response:', content);
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      return JSON.parse(jsonStr.trim());
    } catch {
      console.error('Failed to parse LLM response as JSON');
      return { items: [], tax: 0, total: 0 };
    }
  } catch (error) {
    console.error('LLM service error:', error);
    return { items: [], tax: 0, total: 0 };
  }
}

interface ExpenseMessage {
  expenseId: string;
  messageId: string;
  interactionToken: string;
  description?: string | null;
  text: string;
  imageUrls: string[];
  isRedo?: boolean;
}

async function processExpense(data: ExpenseMessage) {
  const { expenseId, messageId, interactionToken, description, text, imageUrls, isRedo } = data;

  try {
    await prisma.expense.update({
      where: { id: expenseId },
      data: { status: 'processing' },
    });

    await publishExpenseUpdate(expenseId);

    let storageUrls: string[] = [];
    let ocrText = '';

    if (isRedo) {
      storageUrls = imageUrls;
      if (imageUrls.length > 0) {
        for (const url of imageUrls) {
          try {
            const extracted = await callOcrService(url);
            console.log('OCR result for', url, ':', extracted.substring(0, 200));
            ocrText += extracted + '\n';
          } catch (err) {
            console.error('Failed to process OCR:', err);
          }
        }
      }
    } else {
      for (const url of imageUrls) {
        try {
          const { buffer, contentType, filename } = await downloadFromUrl(url);
          const storageUrl = await uploadToStorage(buffer, filename, contentType);
          storageUrls.push(storageUrl);
        } catch (err) {
          console.error('Failed to upload image:', err);
        }
      }

      for (const url of storageUrls) {
        try {
          const extracted = await callOcrService(url);
          console.log('OCR result for', url, ':', extracted.substring(0, 200));
          ocrText += extracted + '\n';
        } catch (err) {
          console.error('Failed to process OCR:', err);
        }
      }
    }

    console.log('Full OCR text:', ocrText);
    
    let combinedText = '';
    if (description) {
      combinedText += `Description: ${description}\n`;
    }
    if (text) {
      combinedText += `User provided text: ${text}\n`;
    }
    if (ocrText) {
      combinedText += `OCR text: ${ocrText}`;
    }
    
    console.log('Sending to LLM:', combinedText.substring(0, 500));
    const extractedData = await callLlmService(combinedText);

    const itemsTotal = extractedData.items.reduce((sum: number, item: { price: number; quantity: number }) => {
      return sum + (item.price * item.quantity);
    }, 0);
    const total = itemsTotal + (extractedData.tax || 0);
    extractedData.total = total;

    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        imageUrls: storageUrls.length > 0 ? storageUrls : imageUrls,
        ocrText: ocrText.trim(),
        aiDescription: extractedData.description || null,
        extractedData: JSON.stringify(extractedData),
        status: 'completed',
      },
    });

    await publishExpenseUpdate(expenseId);
    await publishResult(messageId, interactionToken, 'success', { expenseId }, null, extractedData);
  } catch (error) {
    console.error('Error processing expense:', error);
    await prisma.expense.update({
      where: { id: expenseId },
      data: { status: 'failed' },
    });
    await publishExpenseUpdate(expenseId);
    await publishResult(messageId, interactionToken, 'failed', null, (error as Error).message);
  }
}

async function publishResult(
  messageId: string,
  interactionToken: string,
  status: string,
  result: object | null,
  error: string | null = null,
  extractedData: object | null = null,
) {
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  const channel = await connection.createChannel();

  await channel.assertQueue(process.env.RABBITMQ_REPLY_QUEUE || 'expense_results', { durable: true });

  const message = Buffer.from(JSON.stringify({ messageId, interactionToken, status, result, error, extractedData }));
  channel.sendToQueue(process.env.RABBITMQ_REPLY_QUEUE || 'expense_results', message, { persistent: true });

  await channel.close();
  await connection.close();
}

async function connectWithRetry(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      const channel = await connection.createChannel();
      await channel.assertQueue(process.env.RABBITMQ_QUEUE || 'expense_processing', { durable: true });
      console.log('RabbitMQ connected');
      return channel;
    } catch (error) {
      console.log(`RabbitMQ not ready, retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed to connect to RabbitMQ after retries');
}

async function initBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`Bucket "${BUCKET_NAME}" already exists`);
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`Bucket "${BUCKET_NAME}" created`);
  }

  // Allow anonymous public downloads (equivalent to: mc anonymous set download)
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
      },
    ],
  });
  await s3Client.send(new PutBucketPolicyCommand({ Bucket: BUCKET_NAME, Policy: policy }));
  console.log(`Bucket "${BUCKET_NAME}" public download policy applied`);
}

async function start() {
  console.log('Starting expense consumer...');

  await initBucket();

  await setupOcrResultConsumer();

  const channel = await connectWithRetry();

  console.log('Waiting for messages...');

  channel.consume(process.env.RABBITMQ_QUEUE || 'expense_processing', async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        console.log('Processing expense:', data.messageId);
        await processExpense(data);
        channel.ack(msg);
      } catch (error) {
        console.error('Error:', error);
        channel.nack(msg, false, false);
      }
    }
  });
}

start().catch(console.error);
