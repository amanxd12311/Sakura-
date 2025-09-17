/*
 Sakura 🌸 Discord Revival Bot
 Uses OpenRouter DeepSeek free model
 Designed for Render Web Service
*/

import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import axios from 'axios';
import http from 'http';

// Load environment
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BOT_NAME = process.env.BOT_NAME || 'Sakura 🌸';
const RESPONSE_COOLDOWN = Number(process.env.RESPONSE_COOLDOWN || 60);
const QUIET_WINDOW = Number(process.env.QUIET_WINDOW || 300);
const MIN_MESSAGES_WINDOW = Number(process.env.MIN_MESSAGES_WINDOW || 2);

if (!DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');
if (!OPENROUTER_API_KEY) throw new Error('Missing OPENROUTER_API_KEY');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const lastReplyAt = new Map();

client.once('ready', () => {
  console.log(`${BOT_NAME} is online as ${client.user.tag}`);
});

// Quiet check
async function isChannelQuiet(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const cutoff = Date.now() - QUIET_WINDOW * 1000;
    let humanCount = 0;
    for (const msg of messages.values()) {
      if (msg.createdTimestamp < cutoff) continue;
      if (msg.author && !msg.author.bot) humanCount++;
      if (humanCount >= MIN_MESSAGES_WINDOW) return false;
    }
    return true;
  } catch (err) {
    console.error('Quiet check failed:', err);
    return false;
  }
}

// OpenRouter DeepSeek call
async function callDeepSeek(prompt) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  try {
    const body = {
      model: 'deepseek/deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are ${BOT_NAME}, a warm, playful girl who keeps the Discord chat alive.
Keep replies short, casual, inviting, and fun.`
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 256,
      temperature: 0.9
    };

    const resp = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return resp.data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('DeepSeek API error:', err.response?.data || err.message);
    return null;
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const channel = message.channel;
  const last = lastReplyAt.get(channel.id) || 0;
  if (Date.now() - last < RESPONSE_COOLDOWN * 1000) return;
  if (!channel.isTextBased?.()) return;

  const quiet = await isChannelQuiet(channel);
  if (!quiet) return;

  const recent = await channel.messages.fetch({ limit: 8 });
  const context = [];
  for (const msg of Array.from(recent.values()).reverse()) {
    if (msg.author.bot) continue;
    context.push(`${msg.author.username}: ${msg.content.replace(/\n/g, ' ').slice(0, 200)}`);
  }

  const prompt = `The server is quiet. Respond as ${BOT_NAME}, a playful friendly girl.
Reply short, warm, and ask a fun question.
Context:\n${context.join('\n')}\nTrigger: ${message.author.username}: ${message.content}`;

  const reply = await callDeepSeek(prompt);
  if (!reply) return;

  await channel.send(reply);
  lastReplyAt.set(channel.id, Date.now());
});

// Simple ping test
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === '!ping') {
    await message.reply(`${BOT_NAME} is here to revive the vibes 🌸✨`);
  }
});

// Render requires a web server
http.createServer((req, res) => {
  res.end(`${BOT_NAME} is alive!`);
}).listen(process.env.PORT || 3000);

client.login(DISCORD_TOKEN);
