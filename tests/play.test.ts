// tests/play.test.ts

import { expect } from "chai";
import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { initAdmin, createUser, program, provider } from "./helpers";

describe("Play Game", () => {
  let admin: anchor.web3.Keypair;
  let arcadeAccountPDA: anchor.web3.PublicKey;

  before(async () => {
    // Initialize admin and arcade account
    const initResult = await initAdmin();
    admin = initResult.admin;
    arcadeAccountPDA = initResult.arcadeAccountPDA;

    // Initialize the arcade account
    const arcadeName = "Super Arcade";
    const maxTopScores = 5;
    const pricePerGame = new anchor.BN(web3.LAMPORTS_PER_SOL).div(
      new anchor.BN(10)
    );

    await program.methods
      .initialize(arcadeName, maxTopScores, pricePerGame)
      .accounts({
        arcadeAccount: arcadeAccountPDA,
        admin: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();
  });

  it("Allows a user to play a game", async () => {
    // Create a new user
    const user = await createUser();

    // Define the price per game
    const pricePerGame = new anchor.BN(web3.LAMPORTS_PER_SOL).div(
      new anchor.BN(10)
    ); // 0.1 SOL

    // User plays the game
    await program.methods
      .play(pricePerGame)
      .accounts({
        arcadeAccount: arcadeAccountPDA,
        user: user.publicKey,
        admin: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      } as any)
      .signers([user])
      .rpc();

    // Fetch and assert the updated arcade account state
    const account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);

    expect(account.gameCounter.toNumber()).to.equal(1);

    // Check the balance of the arcade account
    const arcadeBalance = await provider.connection.getBalance(
      arcadeAccountPDA
    );
    expect(arcadeBalance).to.be.closeTo(pricePerGame.toNumber() / 2, 5_000_000); // Allow some delta for fees
  });
});
