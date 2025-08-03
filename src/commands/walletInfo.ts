const { SlashCommandBuilder } = require('discord.js');
const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const dotenv = require('dotenv');
import type { ChatInputCommandInteraction, SlashCommandStringOption } from 'discord.js';

dotenv.config();

// Common token mint addresses and their symbols
const KNOWN_TOKENS: { [key: string]: string } = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'So11111111111111111111111111111111111111112': 'wSOL',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
  '5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC': 'WIF',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 'bSOL'
};

dotenv.config();


const data = new SlashCommandBuilder()
    .setName('walletinfo')
    .setDescription('Get complete Solana wallet info (SOL + all token balances)')
    .addStringOption((option: SlashCommandStringOption) =>
        option.setName('address')
            .setDescription('Public key of the wallet')
            .setRequired(true)
    );


 async function execute(interaction: ChatInputCommandInteraction) {
  const address = interaction.options.getString('address', true);
  const connection = new Connection(process.env.SOLANA_RPC!);

  try {
    const pubKey = new PublicKey(address);
    
    // Get SOL balance
    const lamports = await connection.getBalance(pubKey);
    const sol = lamports / 1e9;
    
    // Get all SPL token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
      programId: TOKEN_PROGRAM_ID,
    });

    let response = `🔍 **Wallet:** \`${address}\`\n\n`;
    response += `💰 **SOL Balance:** \`${sol.toFixed(4)} SOL\`\n\n`;

    if (tokenAccounts.value.length > 0) {
      response += `🪙 **Token Balances:**\n`;
      
      // Sort tokens by balance (highest first)
      const sortedTokens = tokenAccounts.value
        .map((account: any) => {
          const tokenInfo = account.account.data.parsed.info;
          const mint = tokenInfo.mint;
          const balance = tokenInfo.tokenAmount.uiAmount || 0;
          const decimals = tokenInfo.tokenAmount.decimals;
          
          return {
            mint,
            balance,
            decimals,
            symbol: KNOWN_TOKENS[mint] || mint.slice(0, 4) + '...'
          };
        })
        .filter((token: any) => token.balance > 0) // Only show tokens with balance
        .sort((a: any, b: any) => b.balance - a.balance); // Sort by balance descending

      if (sortedTokens.length > 0) {
        // Show top 10 tokens to avoid message being too long
        const tokensToShow = sortedTokens.slice(0, 10);
        
        for (const token of tokensToShow) {
          response += `• **${token.symbol}:** \`${token.balance.toLocaleString()}\`\n`;
        }
        
        if (sortedTokens.length > 10) {
          response += `\n*...and ${sortedTokens.length - 10} more tokens*`;
        }
      } else {
        response += `• *No tokens with balance found*`;
      }
    } else {
      response += `🪙 **Token Balances:** *No token accounts found*`;
    }

    await interaction.reply({ content: response, ephemeral: false });
    
  } catch (err) {
    console.error(err);
    await interaction.reply(`❌ Invalid public key or unable to fetch data.`);
  }
}

module.exports = { data, execute };