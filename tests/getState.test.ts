// tests/getState.test.ts

import { expect } from "chai";
import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { initAdmin, createUser, program } from "./helpers";

describe("Get Arcade State", () => {
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

  it("Retrieves the correct state from get_state functions", async () => {
    // Play a game to modify the state
    const user = await createUser();
    const pricePerGame = new anchor.BN(web3.LAMPORTS_PER_SOL).div(
      new anchor.BN(10)
    );

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

    // Fetch the updated arcade account
    const account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);

    // Assertions
    const totalPriceDistributed = account.totalPriceDistributed;
    expect(totalPriceDistributed.toNumber()).to.equal(0); // Update as per your logic

    const gameCounter = account.gameCounter;
    expect(gameCounter.toNumber()).to.equal(1);

    const currentPrice = account.pricePerGame;
    expect(currentPrice.toNumber()).to.equal(pricePerGame.toNumber());

    const topUsers = account.topUsers;
    expect(topUsers.length).to.equal(5);
    topUsers.forEach((user: any) => {
      expect(user).to.be.null;
    });
  });
});
