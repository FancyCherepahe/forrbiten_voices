require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, MessageFlags } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Per-User Session Storage Map
// Map Key: controllerId -> Value: { targetDMId, targetChannelId, embedTypeMessage, messageVerification }
const userSessions = new Map();

// Helper to retrieve or initialize a session object
function getOrCreateSession(userId) {
    if (!userSessions.has(userId)) {
        userSessions.set(userId, {
            targetDMId: null,
            targetChannelId: null,
            embedTypeMessage: false,
            messageVerification: false
        });
    }
    return userSessions.get(userId);
}

const commandsList = [
    {"name": "set-channel", "usage": "/set-channel channel_id:[ID]", "description": "Set channel for relaying"},
    {"name": "relay-status", "usage": "/relay-status", "description": "Get general relay information"},
    {"name": "set-message-type", "usage": "/set-message-type message_type:[type]", "description": "Toggle between Normal and Embed mode"},
    {"name": "announcement-relay", "usage": "/announcement-relay [message]", "description": "Relay announcement across channels"},
    {"name": "message-sending", "usage": "/message-sending [type]", "description": "Toggle between Direct Message and /say mode"},
    {"name": "set-dm", "usage": "/set-dm user_id:[ID]", "description": "Set target user for DM relaying"},
    {"name": "say", "usage": "/say message:[text]", "description": "Send a message, just like a DM one, but only via command"}

];

const fields = commandsList.map(cmd => ({
    name: cmd.name ? `/${cmd.name}` : 'Unknown Command',
    value: `**Usage:** \`${cmd.usage}\`\n${cmd.description}`,
    inline: false
}));

client.on('clientReady', () => {
    console.log(`🤖 Relay Bot active as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const session = getOrCreateSession(interaction.user.id);

    // 1. /set-dm [USER_ID]
    if (interaction.commandName === 'set-dm') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const inputId = (interaction.options.getString('user_id') || '').trim();
            const targetUser = await client.users.fetch(inputId).catch(() => null);

            if (!targetUser) {
                return interaction.editReply({ content: '❌ Invalid User ID or user not found.' });
            }

            session.targetDMId = targetUser.id;
            session.targetChannelId = null;
           
            return interaction.editReply({ 
                content: `✅ Connection established!\n👤 **Controller:** <@${interaction.user.id}>\n🎯 **Target DM:** <@${targetUser.id}>`
            });
        } catch (err) {
            console.error('Interaction error:', err);
            return interaction.editReply({ content: '❌ Error processing command.' });
        }
    }

    // 2. /set-channel [ID]
    if (interaction.commandName === 'set-channel') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const inputId = (interaction.options.getString('channel_id') || '').trim();
            const channel = await client.channels.fetch(inputId).catch(() => null);

            if (!channel || !channel.isTextBased()) {
                return interaction.editReply({ content: '❌ Invalid channel ID or bot lacks access.' });
            }

            session.targetChannelId = channel.id;
            session.targetDMId = null;
            

            return interaction.editReply({ content: `✅ Target channel set to **#${channel.name}** (\`${channel.id}\`)` });
        } catch (err) {
            console.error('Interaction error:', err);
            return interaction.editReply({ content: '❌ Error processing command.' });
        }
    }

    // 3. /relay-status
    if (interaction.commandName === 'relay-status') {
        const statusEmbed = new EmbedBuilder()
            .setTitle('🤖 Relay Bot Dashboard')
            .setColor(session.targetDMId || session.targetChannelId ? 0x57F287 : 0xED4245)
            .addFields(
                { name: 'Active Owner', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Target DM User', value: session.targetDMId ? `<@${session.targetDMId}>` : '❌ *Not set*', inline: true },
                { name: 'Target Channel', value: session.targetChannelId ? `<#${session.targetChannelId}>` : '❌ *Not set*', inline: true },
                { name: 'Relay Mode', value: session.embedTypeMessage ? '🎨 Embed Mode' : '💬 Normal Mode', inline: true },
                { name: 'Sending Mode', value: session.messageVerification ? '🗣️ /say Mode' : '📩 Direct DM Mode', inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        return interaction.reply({ embeds: [statusEmbed], flags: MessageFlags.Ephemeral });
    }

    // 4. /set-message-type
    if (interaction.commandName === 'set-message-type') {
        const rawTypeValue = interaction.options.getString('message_type');
        session.embedTypeMessage = (rawTypeValue === 'true' || rawTypeValue === 'embed');
        return interaction.reply({ 
            content: `✅ Relay mode updated to: **${session.embedTypeMessage ? 'Embed Mode' : 'Normal Mode'}**`, 
            flags: MessageFlags.Ephemeral 
        });
    }

    // 5. /message-sending
    if (interaction.commandName === 'message-sending') {
        const rawTypeValue = interaction.options.getString('type');
        session.messageVerification = (rawTypeValue === 'true');
        return interaction.reply({ 
            content: `✅ Message sending set to: **${session.messageVerification ? '/say' : 'Direct Message'}**`, 
            flags: MessageFlags.Ephemeral 
        });
    }

    // 6. /help
    if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('❓ Bot Commands')
            .setColor('Blue')
            .addFields(fields)
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        return interaction.reply({ embeds: [helpEmbed] });
    }

    if (interaction.commandName === 'say') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const messageToSend = interaction.options.getString('message');

        // Check if user has an active DM target or Channel target set
        if (!session.targetDMId && !session.targetChannelId) {
            return interaction.editReply({ 
                content: '⚠️ No target configured! Use `/set-dm` or `/set-channel` first.' 
            });
        }

        try {
            // Priority 1: Send via Direct Message if targetDMId is set
            if (session.targetDMId) {
                const targetUser = await client.users.fetch(session.targetDMId);

                if (session.embedTypeMessage) {
                    const relayEmbed = new EmbedBuilder()
                        .setAuthor({ 
                            name: interaction.user.username, 
                            iconURL: interaction.user.displayAvatarURL() 
                        })
                        .setColor(0x008000)
                        .setDescription(messageToSend)
                        .setTimestamp();

                    await targetUser.send({ embeds: [relayEmbed] });
                } else {
                    await targetUser.send({ content: messageToSend });
                }

                return interaction.editReply({ 
                    content: `✅ Sent message to DM target **@${targetUser.username}**!` 
                });
            }

            // Priority 2: Send via Channel if targetChannelId is set
            if (session.targetChannelId) {
                const targetChannel = await client.channels.fetch(session.targetChannelId);

                if (session.embedTypeMessage) {
                    const relayEmbed = new EmbedBuilder()
                        .setAuthor({ 
                            name: interaction.user.username, 
                            iconURL: interaction.user.displayAvatarURL() 
                        })
                        .setColor(0x008000)
                        .setDescription(messageToSend)
                        .setTimestamp();

                    await targetChannel.send({ embeds: [relayEmbed] });
                } else {
                    await targetChannel.send({ content: messageToSend });
                }

                return interaction.editReply({ 
                    content: `✅ Sent message to channel **#${targetChannel.name}**!` 
                });
            }
        } catch (err) {
            console.error('Error executing /say command:', err);
            return interaction.editReply({ 
                content: `❌ Failed to send message: ${err.message}` 
            });
        }
    }
});

// Dynamic Multi-User Relay Handler
client.on('messageCreate', async (message) => {
    if (message.author.bot || message.guild) return;

    // --- OUTGOING: Active controller sending a message to their designated target ---
    if (userSessions.has(message.author.id)) {
        const session = userSessions.get(message.author.id);

        if (!session.messageVerification && session.targetDMId) {
            try {
                const targetUser = await client.users.fetch(session.targetDMId);

                if (session.embedTypeMessage) {
                    const relayEmbed = new EmbedBuilder()
                        .setAuthor({ 
                            name: message.author.username, 
                            iconURL: message.author.displayAvatarURL()
                        })
                        .setColor(0x008000)
                        .setDescription(message.content || '*[Attachment only]*')
                        .setTimestamp();

                    const imageAttachment = message.attachments.find(att => att.contentType?.startsWith('image/'));
                    if (imageAttachment) {
                        relayEmbed.setImage(imageAttachment.url);
                    }

                    await targetUser.send({ embeds: [relayEmbed] });
                } else {
                    await targetUser.send({
                        content: message.content.length > 0 ? message.content : undefined,
                        files: [...message.attachments.values()]
                    });
                }

                await message.react('✅');
                return;
            } catch (err) {
                console.error('Relay error:', err);
                return message.reply(`❌ Could not send message to target: ${err.message}`);
            }
        }

        if (!session.messageVerification && session.targetChannelId) {
            try {
                const targetChannel = await client.channels.fetch(session.targetChannelId);

                if (session.embedTypeMessage) {
                    const relayEmbed = new EmbedBuilder()
                        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
                        .setColor(0x008000)
                        .setDescription(message.content || '*[Attachment only]*')
                        .setTimestamp();

                    const imageAttachment = message.attachments.find(att => att.contentType?.startsWith('image/'));
                    if (imageAttachment) relayEmbed.setImage(imageAttachment.url);

                    await targetChannel.send({ embeds: [relayEmbed] });
                } else {
                    await targetChannel.send({
                        content: message.content.length > 0 ? message.content : undefined,
                        files: [...message.attachments.values()]
                    });
                }

                await message.react('✅');
                return;
            } catch (err) {
                console.error('Relay error:', err);
                return message.reply(`❌ Could not send message to target channel: ${err.message}`);
            }
        }
    }

    // --- INCOMING: Target replying back to whichever controller mapped them ---
    for (const [controllerId, session] of userSessions.entries()) {
        if (session.targetDMId === message.author.id) {
            try {
                const controllerUser = await client.users.fetch(controllerId);
                const replyEmbed = new EmbedBuilder()
                    .setAuthor({ 
                        name: `Reply from @${message.author.username}`, 
                        iconURL: message.author.displayAvatarURL() 
                    })
                    .setDescription(message.content || '*[Attachment only]*')
                    .setColor(0x57F287)
                    .setFooter({ text: `Sender ID: ${message.author.id}` })
                    .setTimestamp();

                const imageAttachment = message.attachments.find(att => att.contentType?.startsWith('image/'));
                if (imageAttachment) {
                    replyEmbed.setImage(imageAttachment.url);
                }

                const dmChannel = await controllerUser.createDM();
                await dmChannel.send({ embeds: [replyEmbed] });

                await message.react('📩');
                return;
            } catch (err) {
                console.error(`Failed to relay reply to controller ${controllerId}:`, err);
            }
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);