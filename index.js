require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message] // Required to receive DM events reliably
});

let targetChannelId = null;

client.on('ready', () => {
    console.log(`🤖 Relay Bot active as ${client.user.tag}`);
});

const allowedUsers = (process.env.ALLOWED_USER_ID || '').split(',');

client.on('messageCreate', async (message) => {
    // Ignore bots and any non-DM messages
    if (message.author.bot || message.guild) return;

    // Security: Only allow your friend's user ID
    if (!allowedUsers.includes(message.author.id)) {
        console.log(allowedUsers);
        return message.reply('⛔ Unauthorized user.');
    }

    // Command: Set target channel
    if (message.content.startsWith('!set-channel')) {
        const args = message.content.split(/\s+/);
        const channelId = args[1];

        if (!channelId) {
            return message.reply('⚠️ Usage: `!set-channel <channel_id>`');
        }

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                return message.reply('❌ Invalid ID or non-text channel.');
            }

            targetChannelId = channelId;
            return message.reply(`✅ Target channel set to **#${channel.name}** (\`${channelId}\`)`);
        } catch (err) {
            return message.reply(`❌ Could not fetch channel: ${err.message}`);
        }
    }

    // Relay logic
    if (!targetChannelId) {
        return message.reply('⚠️ No target channel set yet! Use `!set-channel <channel_id>` first.');
    }

    try {
        const targetChannel = await client.channels.fetch(targetChannelId);

        await targetChannel.send({
            content: message.content.length > 0 ? message.content : undefined,
            files: [...message.attachments.values()]
        });

        await message.react('✅');
    } catch (err) {
        console.error('Relay error:', err);
        await message.reply(`❌ Failed to send message: ${err.message}`);
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);