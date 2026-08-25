require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
});

let embedTypeMessage = false;
let targetChannelId = null;

const commandsList = [
    {"name": "set-channel", "usage": "/set-channel channel_id:[ID]", "description": "Use this command to set the channel where the message will be relayed"},
    {"name": "relay-status", "usage": "/relay-status", "description": "Use this command to get general information of your relay information"},
    {"name": "set-message-type", "usage": "/set-message-type message_type:[message type]", "description": "Use this command to change the look of your relayed command"}
]

const fields = commandsList.map(cmd => ({
    name: cmd.name ? `/${cmd.name}` : 'Unknown Command',
    value: `**Usage:** \`${cmd.usage}\`\n${cmd.description}`,
    inline: false
}));

client.on('ready', () => {
    console.log(`🤖 Relay Bot active as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const rawAllowed = process.env.ALLOWED_USER_ID || process.env.ALLOWED_USER_IDS || '';
    const allowedUsers = rawAllowed.split(',').map(id => id.trim());

    if (!allowedUsers.includes(interaction.user.id)) {
        return interaction.reply({ content: '⛔ Unauthorized user.', ephemeral: true });
    }

    // 1. /set-channel
    if (interaction.commandName === 'set-channel') {
        try {
            const inputId = (interaction.options.getString('channel_id') || '').trim();
            const channel = await client.channels.fetch(inputId).catch(() => null);

            if (!channel || !channel.isTextBased()) {
                return interaction.reply({ 
                    content: '❌ Invalid channel ID or bot lacks view permissions.', 
                    ephemeral: true 
                });
            }

            targetChannelId = channel.id;
            console.log(`✅ Target channel updated to: #${channel.name} (${channel.id})`);

            return interaction.reply({ 
                content: `✅ Target channel successfully set to **#${channel.name}** (\`${channel.id}\`)`, 
                ephemeral: true 
            });
        } catch (err) {
            console.error('Interaction error:', err);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Error processing command.', ephemeral: true });
            }
        }
    }

    // 2. /relay-status
    if (interaction.commandName === 'relay-status') {
        const channelMention = targetChannelId ? `<#${targetChannelId}> (\`${targetChannelId}\`)` : '❌ *Not Configured*';
        const modeStatus = embedTypeMessage ? '🎨 Embed Mode' : '💬 Normal Mode';

        const statusEmbed = new EmbedBuilder()
            .setTitle('🤖 Relay Bot Dashboard')
            .setColor(targetChannelId ? 0x57F287 : 0xED4245)
            .addFields(
                { name: 'Status', value: '🟢 Active & Ready', inline: true },
                { name: 'Authorized Users', value: `\`${allowedUsers.length}\` user(s)`, inline: true },
                { name: 'Relay Mode', value: modeStatus, inline: true },
                { name: 'Target Channel', value: channelMention, inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        return interaction.reply({ embeds: [statusEmbed], ephemeral: true });
    }

    // 3. /set-message-type
    if (interaction.commandName === 'set-message-type') {
        const rawTypeValue = interaction.options.getString('message_type');
        
        if (!rawTypeValue) {
            return interaction.reply({ content: '❌ Missing message type selection.', ephemeral: true });
        }

        const selectedType = rawTypeValue.trim().toLowerCase();

        if (selectedType === 'true' || selectedType === 'embed') {
            embedTypeMessage = true;
            return interaction.reply({ content: '✅ Setted message relay to: **Embed Mode**', ephemeral: true });
        } else if (selectedType === 'false' || selectedType === 'normal') {
            embedTypeMessage = false;
            return interaction.reply({ content: '✅ Setted message relay to: **Normal Mode**', ephemeral: true });
        } else {
            return interaction.reply({ content: '❌ Failed to set mode. Please select a valid mode.', ephemeral: true });
        }
    }
    if (interaction.commandName === "help"){
        const helpEmbed = new EmbedBuilder()
            .setTitle("❓ Bots commands")
            .setColor("Blue")
            .addFields(fields)
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();
        
        return interaction.reply({ embeds: [helpEmbed] })
    }
});

// Message Forwarding Handler
client.on('messageCreate', async (message) => {
    if (message.author.bot || message.guild) return;

    if (message.content.startsWith('!set-channel')) return;

    const rawAllowed = process.env.ALLOWED_USER_ID || process.env.ALLOWED_USER_IDS || '';
    const allowedUsers = rawAllowed.split(',').map(id => id.trim());

    if (!allowedUsers.includes(message.author.id)) {
        return message.reply('⛔ Unauthorized user.');
    }

    if (!targetChannelId) {
        return message.reply('⚠️ No target channel set yet! Use `/set-channel` first.');
    }

    try {
        const targetChannel = await client.channels.fetch(targetChannelId);

        if (!embedTypeMessage) {
            // Normal Mode
            await targetChannel.send({
                content: message.content.length > 0 ? message.content : undefined,
                files: [...message.attachments.values()]
            });
        } else {
            // Embed Mode
            const relayBuilder = new EmbedBuilder()
                .setAuthor({ 
                    name: message.author.username || message.author.tag || 'Unknown User', 
                    iconURL: message.author.displayAvatarURL()
                })
                .setColor(0x008000)
                .setDescription(message.content || '*[Attachment only]*')
                .setFooter({ text: `User ID: ${message.author.id}` })
                .setTimestamp();

            const imageAttachment = message.attachments.find(att => att.contentType?.startsWith('image/'));
            if (imageAttachment) {
                relayBuilder.setImage(imageAttachment.url);
            }

            await targetChannel.send({ embeds: [relayBuilder] });
        }

        await message.react('✅');
    } catch (err) {
        console.error('Relay error:', err);
        await message.reply(`❌ Failed to send message: ${err.message}`);
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);