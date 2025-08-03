require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.commands = new Collection();

// Load commands dynamically
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// On bot ready
client.once('ready', () => {
  console.log(` Bot is ready as ${client.user.tag}`);
});

// Interaction (slash commands)
client.on('interactionCreate', async (interaction: import('discord.js').Interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: '❌ Error executing command.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);

// dont push
