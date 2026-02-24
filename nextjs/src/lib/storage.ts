import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

export async function uploadToStorage(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const key = `receipts/${Date.now()}-${filename}`;
  
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${process.env.OBJECT_STORAGE_URL}/${BUCKET_NAME}/${key}`;
}

export async function getStorageUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return signedUrl;
}

export async function downloadFromUrl(url: string): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1].split('?')[0] || 'receipt';
  
  return { buffer, contentType, filename };
}
