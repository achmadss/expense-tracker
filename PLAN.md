# Expense Tracker Bot Plan

## Architecture

```
User ──(slash command)──> Discord Bot ──(queue)──> Message Broker
                                                          │
                                                          ▼
                                                    Next.js API
                                                          │
                    ┌─────────────────────────────────────┼─────────────────┐
                    ▼                                     ▼                 ▼
              OCR Service                          LLM Service        Object Storage
                    │                                     │                 │
                    └────────────────┬────────────────────┴─────────────────┘
                                      ▼
                                  Database
                                      │
                                      ▼
User ←─(edit message)── Discord Bot ←─(queue)── Message Broker
```

## Processing Workflow

1. User sends slash command with description and optional image attachment
2. Discord Bot captures user data (messageId, userId, text, imageUrls, metadata)
3. Discord Bot sends data to Next.js API via message queue
4. Next.js API creates unprocessed expense record in Database
5. Next.js API downloads images from Discord CDN and uploads to Object Storage
6. OCR Service extracts text from receipt images (via Object Storage URLs)
7. LLM Service processes extracted text + user description to create structured expense data
8. Database updates with final structured results
9. Next.js API queues result back to Discord Bot via reply queue
10. Discord Bot edits original message with success/failure status

## Data to Capture on Slash Command

| Field | Type | Description |
|-------|------|-------------|
| messageId | string | Discord message ID (for editing later) |
| userId | string | User who sent command |
| userTag | string | User discriminator (e.g., `user#0000`) |
| text | string | Raw description from user (no extraction) |
| imageUrls | string[] | Array of attachment URLs (jpg/png/webp) |
| channelId | string | Where command was sent |
| isDm | boolean | Whether from DM |
| timestamp | string | When command was sent (ISO 8601) |

## API POST Payload

```json
{
  "messageId": "123456789",
  "userId": "987654321",
  "userTag": "user#0000",
  "text": "lunch at mcdonalds",
  "imageUrls": ["https://cdn.discordapp.com/attachments/..."],
  "channelId": "111222333",
  "isDm": false,
  "timestamp": "2026-02-21T10:00:00.000Z"
}
```

## Message States

1. **Initial reply**: "Your request is being processed..."
2. **Success edit**: "Success! Your expense has been processed."
3. **Error edit**: "Failed to process your request. Please try again."

## RabbitMQ Configuration

| Queue | Direction | Purpose |
|-------|-----------|---------|
| `expense_processing` | Bot → API | Send user data for processing |
| `expense_results` | API → Bot | Receive processing result |

### RabbitMQ Message Format

```json
{
  "messageId": "123456789",
  "status": "success",
  "result": {},
  "error": null
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Discord bot token |
| `API_URL` | Backend API endpoint |
| `RABBITMQ_URL` | RabbitMQ connection URL |
| `RABBITMQ_QUEUE` | Processing queue name |
| `RABBITMQ_REPLY_QUEUE` | Results queue name |
| `OCR_SERVICE_URL` | OCR service endpoint |
| `LLM_SERVICE_URL` | LLM service endpoint |
| `LLM_API_KEY` | LLM authentication |
| `OBJECT_STORAGE_URL` | Object storage endpoint |
| `OBJECT_STORAGE_KEY` | Storage authentication |
| `DATABASE_URL` | Database connection string |

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

## Slash Command Definition

> Note: At least one of `description` or `image` must be provided.

```javascript
new SlashCommandBuilder()
  .setName('expense')
  .setDescription('Submit an expense')
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Expense description')
      .setRequired(false))
  .addAttachmentOption(option =>
    option.setName('image')
      .setDescription('Receipt image (jpg, png, webp)')
      .setRequired(false))
```

## Files Structure

```
expense-tracker-bot/
├── package.json
├── .env
└── index.js
```

## Dependencies

- `discord.js` - v14
- `amqplib` - RabbitMQ client
- `dotenv` - Environment variables
