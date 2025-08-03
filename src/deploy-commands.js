console.log('Deploy script starting...');

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

console.log('Environment check:');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'Found' : 'Missing');
console.log('CLIENT_ID:', process.env.CLIENT_ID ? 'Found' : 'Missing');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.log('Missing required environment variables');
    process.exit(1);
}

try {
    console.log('Creating commands...');
    
    const commands = [
        // WalletInfo command
        new SlashCommandBuilder()
            .setName('walletinfo')
            .setDescription('Get complete Solana wallet info (SOL + all token balances)')
            .addStringOption(option =>
                option.setName('address')
                    .setDescription('Public key of the wallet')
                    .setRequired(true)
            ),
        
        // Send command
        new SlashCommandBuilder()
            .setName('send')
            .setDescription('Generate a transaction for sending tokens (sign in your wallet)')
            .addStringOption(option =>
                option.setName('from')
                    .setDescription('Your wallet\'s public address')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('to')
                    .setDescription('Recipient\'s public key')
                    .setRequired(true)
            )
            .addNumberOption(option =>
                option.setName('amount')
                .setDescription('Amount of token to send')
                .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('token')
                    .setDescription('Token mint address (leave empty for first available)')
                    .setRequired(false)
            )
    ].map(command => command.toJSON());

    console.log(`Prepared ${commands.length} commands for deployment`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    (async () => {
        try {
            console.log(`Started refreshing ${commands.length} application (/) commands.`);

            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );

            console.log(`Successfully reloaded ${data.length} application (/) commands.`);
            process.exit(0);
        } catch (error) {
            console.error('Deployment error:', error);
            process.exit(1);
        }
    })();
    
} catch (error) {
    console.error('Error creating commands:', error);
    process.exit(1);
}