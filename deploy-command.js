require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('set-channel')
        .setDescription('Sets the target channel ID for DM relaying')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .addStringOption(option => 
            option.setName('channel_id')
                .setDescription('The ID of the text channel to send messages to')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('relay-status')
        .setDescription('Displays current relay bot status and configuration')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel),
    new SlashCommandBuilder()
        .setName('set-message-type')
        .setDescription('Change the relayed message type to normal and embed mode')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .addStringOption(option =>
            option.setName('message_type')
                .setDescription('Select the relay format')
                .setRequired(true)
                .addChoices(
                    { name: 'Normal (Raw Text & Attachments)', value: 'false' },
                    { name: 'Embed (Rich Discord Card)', value: 'true' }
                )
        ),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays current relay bot status and configuration')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel),
    new SlashCommandBuilder()
        .setName('announcement-relay')
        .setDescription('Relay announcement only once across multiple channles and servers')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .addStringOption(option =>
            option.setName('message')
            .setDescription("Type an announcement you want to announce")
            .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('message-sending')
        .setDescription('Choose how the way how to relay message, with slash command or just direct message')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .addStringOption(option =>
            option.setName('type')
            .setDescription("Select send type")
            .setRequired(true)
            .addChoices(
                {name: 'Direct Message (Simple DM Send)', value: 'false'},
                {name: '/say (Every Message must be provided with a /say)', value: 'true'}
            )
        ),
    new SlashCommandBuilder()
        .setName('say')
        .setDescription('Relay messages via /say command')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .addStringOption(option =>
            option.setName('message')
            .setDescription("Type an announcement you want to announce")
            .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('set-dm')
        .setDescription('Sets the target channel ID for DM relaying')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .addStringOption(option => 
            option.setName('user_id')
                .setDescription('The ID of the text channel to send messages to')
                .setRequired(true)
        )
        
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log('Deploying global DM application commands...');
        const clientId = process.env.DISCORD_CLIENT_ID || '1540633731780448266';

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded global application (/) commands!');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();