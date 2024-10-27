// arcade_client.test.js

import { expect } from "chai";
import { web3, BN } from "@coral-xyz/anchor";
import {
  initializeGame,
  playGame,
  addUserScore,
  updatePrice,
  getTotalPriceDistributed,
  getTopUsers,
  getGameCounter,
  getPricePerGame,
} from "./arcade_client";
import { Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
// require("dotenv").config();

describe("Arcade Client Tests", () => {
  let adminKeypair;
  let userKeypair;
  let initialPricePerGame = 1_000_000; // 0.001 SOL in lamports
  let newPricePerGame = 2_000_000; // 0.002 SOL in lamports

  before(async () => {
    // Load admin and user keypairs from files
    adminKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(process.env.ADMIN_KEYPAIR)))
    );
    userKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(process.env.USER_KEYPAIR)))
    );

    // Airdrop SOL to admin and user accounts if needed
    const connection = new web3.Connection(process.env.RPC_URL, "processed");
    const adminBalance = await connection.getBalance(adminKeypair.publicKey);
    if (adminBalance < 1_000_000_000) {
      // Airdrop 1 SOL to admin
      await connection.requestAirdrop(adminKeypair.publicKey, 1_000_000_000);
    }

    const userBalance = await connection.getBalance(userKeypair.publicKey);
    if (userBalance < 1_000_000_000) {
      // Airdrop 1 SOL to user
      await connection.requestAirdrop(userKeypair.publicKey, 1_000_000_000);
    }
  });

  it("Initializes the game", async () => {
    await initializeGame(adminKeypair, "Super Arcade", 5, initialPricePerGame);

    const pricePerGame = await getPricePerGame(adminKeypair.publicKey);
    expect(pricePerGame).to.equal(initialPricePerGame);
  });

  it("Plays the game", async () => {
    // Get initial game counter
    const gameCounterBefore = await getGameCounter(adminKeypair.publicKey);

    await playGame(userKeypair, adminKeypair.publicKey, initialPricePerGame);

    // Get updated game counter
    const gameCounterAfter = await getGameCounter(adminKeypair.publicKey);
    expect(gameCounterAfter).to.equal(gameCounterBefore + 1);
  });

  it("Updates the price per game", async () => {
    await updatePrice(adminKeypair, newPricePerGame);

    const pricePerGame = await getPricePerGame(adminKeypair.publicKey);
    expect(pricePerGame).to.equal(newPricePerGame);
  });

  it("Adds a user score and distributes prize if applicable", async () => {
    // Add initial scores to populate top users
    const scores = [
      {
        score: new BN(50),
        nickname: "PlayerOne",
        userAddress: userKeypair.publicKey,
      },
      {
        score: new BN(100),
        nickname: "PlayerTwo",
        userAddress: userKeypair.publicKey,
      },
    ];

    // Add first score
    await addUserScore(adminKeypair, scores[0]);

    let topUsers = await getTopUsers(adminKeypair.publicKey);
    expect(topUsers[0].nickname).to.equal("PlayerOne");
    expect(new BN(topUsers[0].score).toNumber()).to.equal(50);

    // Get balances before adding new high score
    const connection = new web3.Connection(process.env.RPC_URL, "processed");
    const arcadeAccountPDA = await getArcadeAccountPDA(adminKeypair.publicKey);
    const arcadeBalanceBefore = await connection.getBalance(arcadeAccountPDA);
    const userBalanceBefore = await connection.getBalance(
      userKeypair.publicKey
    );

    // Add second score (new high score)
    await addUserScore(adminKeypair, scores[1]);

    topUsers = await getTopUsers(adminKeypair.publicKey);
    expect(topUsers[0].nickname).to.equal("PlayerTwo");
    expect(new BN(topUsers[0].score).toNumber()).to.equal(100);

    // Get balances after adding new high score
    const arcadeBalanceAfter = await connection.getBalance(arcadeAccountPDA);
    const userBalanceAfter = await connection.getBalance(userKeypair.publicKey);

    // Calculate the prize amount
    const accountInfo = await connection.getAccountInfo(arcadeAccountPDA);
    const rentExemptMinimum =
      await connection.getMinimumBalanceForRentExemption(
        accountInfo?.data.length || 0
      );
    const prizeAmount = arcadeBalanceBefore - rentExemptMinimum;

    expect(arcadeBalanceAfter).to.equal(rentExemptMinimum);
    expect(userBalanceAfter).to.equal(userBalanceBefore + prizeAmount);

    // Verify total prize distributed
    const totalDistributed = await getTotalPriceDistributed(
      adminKeypair.publicKey
    );
    expect(totalDistributed).to.equal(prizeAmount);
  });

  it("Gets game statistics", async () => {
    const totalDistributed = await getTotalPriceDistributed(
      adminKeypair.publicKey
    );
    expect(totalDistributed).to.be.a("number");

    const topUsers = await getTopUsers(adminKeypair.publicKey);
    expect(topUsers).to.be.an("array");

    const gameCounter = await getGameCounter(adminKeypair.publicKey);
    expect(gameCounter).to.be.a("number");

    const pricePerGame = await getPricePerGame(adminKeypair.publicKey);
    expect(pricePerGame).to.equal(newPricePerGame);
  });
});

// Helper function to get the arcade account PDA
async function getArcadeAccountPDA(adminPublicKey) {
  const PROGRAM_ID = new PublicKey(
    "CSSnstKmeBuQoDxpdjUd4fdqXwtM237PmTyexjizdrBN" // Replace with your actual program ID
  );
  const [arcadeAccountPDA, _] = await PublicKey.findProgramAddress(
    [Buffer.from("arcade_account"), adminPublicKey.toBuffer()],
    PROGRAM_ID
  );
  return arcadeAccountPDA;
}
