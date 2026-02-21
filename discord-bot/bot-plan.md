# Discord Bot Plan

## Overview
Discord bot that accepts expense submissions via slash command and communicates with the backend via RabbitMQ.

## Slash Command

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

> Note: At least one of `description` or `image` must be provided.

## Data Captured

| Field | Type | Description |
|-------|------|-------------|
| messageId | string | Discord message ID (for editing later) |
| userId | string | User who sent command |
| userTag | string | User discriminator (e.g., `user#0000`) |
| text | string | Raw description from user |
| imageUrls | string[] | Array of attachment URLs (jpg/png/webp) |
| channelId | string | Where command was sent |
| isDm | boolean | Whether from DM |
| timestamp | string | When command was sent (ISO 8601) |

## Message States

1. **Initial reply**: "Your request is being processed..."
2. **Success edit**: "Success! Your expense has been processed."
3. **Error edit**: "Failed to process your request. Please try again."

## RabbitMQ Queues

| Queue | Direction | Purpose |
|-------|-----------|---------|
| `expense_processing` | Bot → API | Send user data for processing |
| `expense_results` | API → Bot | Receive processing result |

### Outbound Message (Bot → API)
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

### Inbound Message (API → Bot)
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
| `RABBITMQ_URL` | RabbitMQ connection URL |
| `RABBITMQ_QUEUE` | Processing queue name (`expense_processing`) |
| `RABBITMQ_REPLY_QUEUE` | Results queue name (`expense_results`) |

## File Structure

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
