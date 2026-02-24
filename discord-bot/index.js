require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, WebhookClient } = require('discord.js');
const amqp = require('amqplib');

const {
  DISCORD_TOKEN,
  RABBITMQ_URL,
  RABBITMQ_REPLY_QUEUE,
  NEXTJS_API_URL,
  APPLICATION_ID,
} = process.env;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let channel = null;

async function setupRabbitMQ(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertQueue(RABBITMQ_REPLY_QUEUE, { durable: true });

      channel.consume(RABBITMQ_REPLY_QUEUE, async (msg) => {
        if (msg) {
          const { interactionToken, status, extractedData } = JSON.parse(msg.content.toString());

          const webhook = new WebhookClient({ id: APPLICATION_ID, token: interactionToken });

          if (status === 'success' && extractedData) {
            const { items, tax, total } = extractedData;
            let content = '**Extracted Items:**\n';
            
            if (items && items.length > 0) {
              for (const item of items) {
                content += `• ${item.name} - ${item.price.toLocaleString('id-ID')} (x${item.quantity})\n`;
              }
            } else {
              content += '_No items found_\n';
            }
            
            content += `\n**Tax:** ${(tax || 0).toLocaleString('id-ID')}\n`;
            content += `**Total:** ${(total || 0).toLocaleString('id-ID')}`;

            await webhook.send({ content }).catch(console.error);
          } else {
            await webhook.send('Failed to process your request. Please try again.').catch(console.error);
          }

          channel.ack(msg);
        }
      });

      console.log('RabbitMQ connected');
      return;
    } catch (error) {
      console.log(`RabbitMQ not ready, retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed to connect to RabbitMQ after retries');
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('expense')
      .setDescription('Submit an expense')
      .addStringOption((option) =>
        option
          .setName('description')
          .setDescription('Expense description')
          .setRequired(false)
      )
      .addAttachmentOption((option) =>
        option
          .setName('image')
          .setDescription('Receipt image (jpg, png, webp)')
          .setRequired(false)
      ),
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'expense') {
    return;
  }

  const description = interaction.options.getString('description');
  const attachment = interaction.options.getAttachment('image');

  if (!description && !attachment) {
    await interaction.reply({
      content: 'Please provide at least a description or an image.',
      ephemeral: true,
    });
    return;
  }

  const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (attachment && !validImageTypes.includes(attachment.contentType)) {
    await interaction.reply({
      content: 'Invalid image format. Please use jpg, png, or webp.',
      ephemeral: true,
    });
    return;
  }

  const messageId = interaction.id;
  const userId = interaction.user.id;
  const userTag = `${interaction.user.username}#${interaction.user.discriminator}`;
  const text = description || '';
  const imageUrls = attachment ? [attachment.url] : [];
  const channelId = interaction.channelId;
  const isDm = interaction.guildId === null;
  const timestamp = new Date().toISOString();
  const interactionToken = interaction.token;

  const expenseData = {
    messageId,
    userId,
    userTag,
    text,
    imageUrls,
    channelId,
    isDm,
    timestamp,
    interactionToken,
  };

  try {
    const res = await fetch(`${NEXTJS_API_URL}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseData),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const expense = await res.json();
    await interaction.reply(`Expenses submitted https://expense.achmad.dev/expenses/${expense.id}`);

    console.log(`Submitted expense for message ${messageId}`);
  } catch (error) {
    console.error('Failed to submit expense:', error);
    await interaction.reply('Failed to process your request. Please try again.');
  }
});

async function start() {
  await setupRabbitMQ();
  await client.login(DISCORD_TOKEN);
}

start().catch(console.error);
