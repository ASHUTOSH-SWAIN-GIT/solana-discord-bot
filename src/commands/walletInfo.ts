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

  // Defer the reply to give us more time (up to 15 minutes)
  await interaction.deferReply();

  try {
    const pubKey = new PublicKey(address);
    
    // Run multiple operations in parallel for better performance
    const [lamports, tokenAccounts, signatures] = await Promise.all([
      connection.getBalance(pubKey),
      connection.getParsedTokenAccountsByOwner(pubKey, { programId: TOKEN_PROGRAM_ID }),
      connection.getSignaturesForAddress(pubKey, { limit: 5 })
    ]);

    const sol = lamports / 1e9;

    let response = `**Wallet:** \`${address}\`\n\n`;
    response += `**SOL Balance:** \`${sol.toFixed(4)} SOL\`\n\n`;

    // Token Balances
    if (tokenAccounts.value.length > 0) {
      response += `**Token Balances:**\n`;

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
        .filter((token: any) => token.balance > 0)
        .sort((a: any, b: any) => b.balance - a.balance);

      const tokensToShow = sortedTokens.slice(0, 10);
      for (const token of tokensToShow) {
        response += `• **${token.symbol}:** \`${token.balance.toLocaleString()}\`\n`;
      }

      if (sortedTokens.length > 10) {
        response += `\n*...and ${sortedTokens.length - 10} more tokens*\n`;
      }
    } else {
      response += `**Token Balances:** *No token accounts found*\n`;
    }

    // Recent transactions
    if (signatures.length > 0) {
      response += `\n**Recent Transactions:**\n`;

      for (const sig of signatures) {
        const time = sig.blockTime ? new Date(sig.blockTime * 1000).toLocaleString() : 'Unknown time';
        const txLink = `https://solscan.io/tx/${sig.signature}`;
        const status = sig.err ? 'Failed' : 'Success';

        response += `• [${sig.signature.slice(0, 6)}...](<${txLink}>) - ${status} @ ${time}\n`;
      }
    } else {
      response += `\n**Recent Transactions:** *None found*\n`;
    }

    // Use editReply instead of reply since we deferred
    await interaction.editReply({ content: response });

  } catch (err) {
    console.error(err);
    await interaction.editReply(`Invalid public key or unable to fetch data.`);
  }
}

module.exports = { data, execute };
