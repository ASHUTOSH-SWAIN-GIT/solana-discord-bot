const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('walletinfo')
    .setDescription('Get Solana wallet info')
    .addStringOption((option: any) =>
      option.setName('address')
        .setDescription('Public key of the wallet')
        .setRequired(true)
    )
].map((command: any) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands }
    );
    console.log('Successfully registered.');
  } catch (error) {
    console.error(error);
  }
})();
