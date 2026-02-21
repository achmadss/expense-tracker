# Backend Plan

## Overview
Next.js API routes that process expenses from RabbitMQ queue and expose REST endpoints for frontend.

## RabbitMQ Consumer

### Queues
| Queue | Direction | Purpose |
|-------|-----------|---------|
| `expense_processing` | Bot → API | Receive user data for processing |
| `expense_results` | API → Bot | Send processing results back to bot |

### Processing Workflow
1. Consume message from `expense_processing` queue
2. Create unprocessed expense record in Database
3. Download images from Discord CDN and upload to Object Storage
4. Call OCR Service (via `/ocr/tesseract/url`) to extract text from Object Storage URLs
5. Call LLM Service to parse expense data
6. Update database with structured results (imageUrls, ocrText, extractedData)
7. Publish result to `expense_results` queue

### Result Message Format
```json
{
  "messageId": "123456789",
  "status": "success",
  "result": {
    "expenseId": "..."
  },
  "error": null
}
```

## REST API Endpoints

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses` | List all expenses (with pagination) |
| GET | `/api/expenses/[id]` | Get single expense |
| POST | `/api/expenses` | Create new expense |
| PUT | `/api/expenses/[id]` | Update expense |
| DELETE | `/api/expenses/[id]` | Delete expense |

### Query Parameters for GET /api/expenses
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `userId` - Filter by user
- `status` - Filter by status
- `startDate` - Filter by date range
- `endDate` - Filter by date range

## Database Schema

| Field | Type | Description |
|-------|------|-------------|
| id | string | Primary key (UUID) |
| messageId | string | Reference to Discord message |
| userId | string | Discord user ID |
| userTag | string | User discriminator |
| text | string | User's raw description |
| imageUrls | string[] | Object Storage URLs for dashboard display |
| ocrText | string | Extracted text from images |
| extractedData | object | LLM-parsed expense data |
| status | enum | unprocessed, processing, completed, failed |
| timestamp | string | When command was sent |
| createdAt | string | Creation timestamp |
| updatedAt | string | Last update timestamp |
| updatedAt | string | Last update timestamp |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `RABBITMQ_URL` | RabbitMQ connection URL |
| `RABBITMQ_QUEUE` | Processing queue name |
| `RABBITMQ_REPLY_QUEUE` | Results queue name |
| `OCR_SERVICE_URL` | OCR service endpoint |
| `LLM_SERVICE_URL` | LLM service endpoint |
| `LLM_API_KEY` | LLM authentication |
| `OBJECT_STORAGE_URL` | Object storage endpoint |
| `OBJECT_STORAGE_KEY` | Storage authentication |
| `DATABASE_URL` | Database connection string |

## File Structure

```
nextjs/
├── prisma/
│   └── schema.prisma
├── src/
│   └── app/
│       └── api/
│           └── expenses/
│               ├── route.ts
│               └── [id]/
│                   └── route.ts
├── src/lib/
│   ├── rabbitmq.ts
│   ├── ocr.ts
│   ├── llm.ts
│   └── storage.ts
└── package.json
```

## Dependencies

- `next` - Next.js
- `prisma` - ORM
- `@prisma/client` - Database client
- `amqplib` - RabbitMQ client
- `axios` - HTTP client for services
