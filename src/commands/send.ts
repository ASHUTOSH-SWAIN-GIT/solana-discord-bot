const { SlashCommandBuilder } = require("discord.js");
const { Keypair, PublicKey, Connection, clusterApiUrl } = require("@solana/web3.js");
const {
    getAssociatedTokenAddress,
    getAccount,
    getOrCreateAssociatedTokenAccount,
    transfer,
} = require("@solana/spl-token");
const bs58 = require("bs58");
const dotenv = require("dotenv");
import type { ChatInputCommandInteraction } from "discord.js";

dotenv.config();

// Use devnet for send command testing
const connection = new Connection(process.env.SOLANA_DEVNET_RPC!);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("send")
        .setDescription("Generate a transaction for sending tokens (sign in your wallet)")
        .addStringOption((option: any) =>
            option
                .setName("from")
                .setDescription("Your wallet's public address")
                .setRequired(true)
        )
        .addStringOption((option: any) =>
            option
                .setName("to")
                .setDescription("Recipient's public key")
                .setRequired(true)
        )
        .addStringOption((option: any) =>
            option
                .setName("token")
                .setDescription("Token mint address (leave empty for first available)")
                .setRequired(false)
        )
        .addNumberOption((option: any) =>
            option
                .setName("amount")
                .setDescription("Amount of token to send")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const senderPubkeyStr = interaction.options.getString("from", true);
            const recipientPubkeyStr = interaction.options.getString("to", true);
            const tokenMint = interaction.options.getString("token");
            const amount = interaction.options.getNumber("amount", true);

            const senderPubkey = new PublicKey(senderPubkeyStr);
            const recipientPubkey = new PublicKey(recipientPubkeyStr);

            // Check SOL balance first
            const solBalance = await connection.getBalance(senderPubkey);
            const solBalanceInSol = solBalance / 1000000000; // Convert lamports to SOL

            // Fetch SPL token accounts owned by sender
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(senderPubkey, {
                programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
            });

            // Filter only SPL tokens with balance > 09
            const ownedTokens = tokenAccounts.value
                .map((accountInfo: any) => {
                    const info = accountInfo.account.data.parsed.info;
                    return {
                        mint: new PublicKey(info.mint),
                        amount: Number(info.tokenAmount.amount),
                        decimals: info.tokenAmount.decimals,
                        mintStr: info.mint,
                        type: 'spl'
                    };
                })
                .filter((t: any) => t.amount > 0);

            // Add SOL to the available tokens if balance > 0
            const availableTokens = [];
            if (solBalanceInSol > 0) {
                availableTokens.push({
                    mint: 'SOL',
                    amount: solBalance, // in lamports
                    decimals: 9,
                    mintStr: 'SOL',
                    type: 'native'
                });
            }
            availableTokens.push(...ownedTokens);

            if (availableTokens.length === 0) {
                return await interaction.editReply("No tokens or SOL balance found in your account.");
            }

            // Select token to send
            let tokenToSend;
            if (tokenMint) {
                if (tokenMint.toLowerCase() === 'sol') {
                    tokenToSend = availableTokens.find((t: any) => t.type === 'native');
                } else {
                    tokenToSend = availableTokens.find((t: any) => t.mintStr === tokenMint);
                }
                if (!tokenToSend) {
                    return await interaction.editReply("Specified token not found or has zero balance.");
                }
            } else {
                tokenToSend = availableTokens[0]; // First available token (SOL or SPL)
            }

            // Create unsigned transaction
            const { Transaction, SystemProgram } = require("@solana/web3.js");
            const { createTransferInstruction } = require("@solana/spl-token");

            const transaction = new Transaction();

            if (tokenToSend.type === 'native') {
                // SOL transfer
                const transferAmount = amount * 10 ** tokenToSend.decimals; // Convert to lamports
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: senderPubkey,
                        toPubkey: recipientPubkey,
                        lamports: transferAmount
                    })
                );
            } else {
                // SPL Token transfer
                const senderTokenAccount = await getAssociatedTokenAddress(tokenToSend.mint, senderPubkey);
                const recipientTokenAccount = await getAssociatedTokenAddress(tokenToSend.mint, recipientPubkey);

                // Add transfer instruction
                transaction.add(
                    createTransferInstruction(
                        senderTokenAccount,
                        recipientTokenAccount,
                        senderPubkey,
                        amount * 10 ** tokenToSend.decimals
                    )
                );
            }

            // Set recent blockhash
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = senderPubkey;

            // Serialize transaction for wallet signing
            const serializedTx = transaction.serialize({ requireAllSignatures: false });
            const base64Tx = serializedTx.toString('base64');

            // Create direct wallet URLs (more reliable)
            const phantomDeepLink = `phantom://sign?transaction=${encodeURIComponent(base64Tx)}`;
            
            const response = `**Transaction Created Successfully!**

**Token:** ${tokenToSend.mintStr === 'SOL' ? 'SOL' : tokenToSend.mintStr.slice(0, 6) + '...'}
**Amount:** ${amount}
**To:** ${recipientPubkeyStr}

**How to sign this transaction:**

**Option 1: Direct Phantom Link (if Phantom is installed)**
[Open in Phantom](${phantomDeepLink})

**Option 2: Copy & Paste Method**
1. Open your Phantom or Solflare wallet app
2. Look for "Import Transaction" or "Sign Transaction" 
3. Paste this base64 transaction:
\`\`\`
${base64Tx}
\`\`\`

**Option 3: Solana Explorer**
1. Go to: https://explorer.solana.com/tx/inspector?cluster=${process.env.SOLANA_DEVNET_RPC?.includes('devnet') ? 'devnet' : 'mainnet-beta'}
2. Paste the base64 transaction above
3. Connect your wallet to review and sign

**Transaction Details:**
• Network: ${process.env.SOLANA_DEVNET_RPC?.includes('devnet') ? 'Devnet' : 'Mainnet'}
• Amount: ${amount} ${tokenToSend.mintStr === 'SOL' ? 'SOL' : 'tokens'}`;

            return await interaction.editReply(response);

        } catch (error: any) {
            console.error(error);
            return await interaction.editReply("Error occurred: " + error.message);
        }
    },
};
