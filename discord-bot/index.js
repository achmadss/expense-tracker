require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const amqp = require('amqplib');

const {
  DISCORD_TOKEN,
  RABBITMQ_URL,
  RABBITMQ_QUEUE,
  RABBITMQ_REPLY_QUEUE,
} = process.env;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let channel = null;
const pendingRequests = new Map();

async function setupRabbitMQ(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertQueue(RABBITMQ_QUEUE, { durable: true });
      await channel.assertQueue(RABBITMQ_REPLY_QUEUE, { durable: true });

      channel.consume(RABBITMQ_REPLY_QUEUE, (msg) => {
        if (msg) {
          const data = JSON.parse(msg.content.toString());
          const { messageId, status } = data;

          const pending = pendingRequests.get(messageId);
          if (pending) {
            const { interaction } = pending;
            if (status === 'success') {
              interaction.editReply('Success! Your expense has been processed.').catch(console.error);
            } else {
              interaction.editReply('Failed to process your request. Please try again.').catch(console.error);
            }
            pendingRequests.delete(messageId);
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

async function publishExpense(data) {
  const message = Buffer.from(JSON.stringify(data));
  channel.sendToQueue(RABBITMQ_QUEUE, message, { persistent: true });
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

  await interaction.reply('Your request is being processed...');

  pendingRequests.set(messageId, { interaction });

  const expenseData = {
    messageId,
    userId,
    userTag,
    text,
    imageUrls,
    channelId,
    isDm,
    timestamp,
  };

  try {
    await publishExpense(expenseData);
    console.log(`Published expense for message ${messageId}`);
  } catch (error) {
    console.error('Failed to publish expense:', error);
    await interaction.editReply('Failed to process your request. Please try again.');
    pendingRequests.delete(messageId);
  }
});

async function start() {
  await setupRabbitMQ();
  await client.login(DISCORD_TOKEN);
}

start().catch(console.error);
