// arcade_client.js

import {
  Wallet,
  AnchorProvider,
  setProvider,
  Program,
  BN,
} from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "fs";

// Constants
const PROGRAM_ID = new PublicKey(
  "CSSnstKmeBuQoDxpdjUd4fdqXwtM237PmTyexjizdrBN"
); // Replace with your actual program ID
const IDL_PATH = "./path_to_your_idl.json"; // Replace with the path to your IDL file
const COMMITMENT = "processed"; // You can use "confirmed" or "finalized" as well

// Load IDL
const idl = JSON.parse(readFileSync(IDL_PATH, "utf8"));

// Create a connection to the cluster
const connection = new Connection("https://api.devnet.solana.com", COMMITMENT);

// Load the provider (here we use a local wallet file)
const wallet = new Wallet(
  Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync("~/.config/solana/id.json")))
  )
);
const provider = new AnchorProvider(connection, wallet, {
  commitment: COMMITMENT,
});
setProvider(provider);

// Create the program interface combining the IDL, program ID, and provider
const program = new Program(idl, PROGRAM_ID, provider);

// Function to derive the arcade account PDA
async function getArcadeAccountPDA(adminPublicKey) {
  const [arcadeAccountPDA, _] = await PublicKey.findProgramAddress(
    [Buffer.from("arcade_account"), adminPublicKey.toBuffer()],
    PROGRAM_ID
  );
  return arcadeAccountPDA;
}

// Initialize a game
async function initializeGame(
  adminKeypair,
  arcadeName,
  maxTopScores,
  pricePerGame
) {
  const arcadeAccountPDA = await getArcadeAccountPDA(adminKeypair.publicKey);

  await program.methods
    .initialize(arcadeName, maxTopScores, new BN(pricePerGame))
    .accounts({
      arcadeAccount: arcadeAccountPDA,
      admin: adminKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([adminKeypair])
    .rpc();

  console.log("Game initialized successfully.");
}

// Play a game
async function playGame(userKeypair, adminPublicKey, lamports) {
  const arcadeAccountPDA = await getArcadeAccountPDA(adminPublicKey);

  await program.methods
    .play(new BN(lamports))
    .accounts({
      arcadeAccount: arcadeAccountPDA,
      user: userKeypair.publicKey,
      admin: adminPublicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([userKeypair])
    .rpc();

  console.log("Game played successfully.");
}

// Add user score (from hardcoded wallet)
async function addUserScore(adminKeypair, userScore) {
  const arcadeAccountPDA = await getArcadeAccountPDA(adminKeypair.publicKey);

  await program.methods
    .addUserScore(userScore)
    .accounts({
      arcadeAccount: arcadeAccountPDA,
      admin: adminKeypair.publicKey,
      user: userScore.userAddress, // User's public key
      systemProgram: SystemProgram.programId,
    })
    .signers([adminKeypair])
    .rpc();

  console.log("User score added successfully.");
}

// Update price per game
async function updatePrice(adminKeypair, newPrice) {
  const arcadeAccountPDA = await getArcadeAccountPDA(adminKeypair.publicKey);

  await program.methods
    .updatePrice(new BN(newPrice))
    .accounts({
      arcadeAccount: arcadeAccountPDA,
      admin: adminKeypair.publicKey,
    })
    .signers([adminKeypair])
    .rpc();

  console.log("Price updated successfully.");
}

// Get total price distributed
async function getTotalPriceDistributed(adminPublicKey) {
  const arcadeAccountPDA = await getArcadeAccountPDA(adminPublicKey);
  const account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);
  return account.totalPriceDistributed.toNumber();
}

// Get top users
async function getTopUsers(adminPublicKey) {
  const arcadeAccountPDA = await getArcadeAccountPDA(adminPublicKey);
  const account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);
  return account.topUsers;
}

// Get game counter
async function getGameCounter(adminPublicKey) {
  const arcadeAccountPDA = await getArcadeAccountPDA(adminPublicKey);
  const account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);
  return account.gameCounter.toNumber();
}

// Get price per game
async function getPricePerGame(adminPublicKey) {
  const arcadeAccountPDA = await getArcadeAccountPDA(adminPublicKey);
  const account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);
  return account.pricePerGame.toNumber();
}

// Export functions
export default {
  initializeGame,
  playGame,
  addUserScore,
  updatePrice,
  getTotalPriceDistributed,
  getTopUsers,
  getGameCounter,
  getPricePerGame,
};
