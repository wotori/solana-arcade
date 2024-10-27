// tests/initialize.test.ts

import { expect } from "chai";
import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { initAdmin, program } from "./helpers";

describe("Initialize Arcade Account", () => {
  let admin: anchor.web3.Keypair;
  let arcadeAccountPDA: anchor.web3.PublicKey;

  before(async () => {
    // Initialize admin and derive PDA
    const initResult = await initAdmin();
    admin = initResult.admin;
    arcadeAccountPDA = initResult.arcadeAccountPDA;
  });

  it("Initializes the arcade account using PDA", async () => {
    const arcadeName = "Super Arcade";
    const maxTopScores = 5;
    const pricePerGame = new anchor.BN(web3.LAMPORTS_PER_SOL).div(
      new anchor.BN(10)
    );

    // Invoke the initialize method of the program
    await program.methods
      .initialize(arcadeName, maxTopScores, pricePerGame)
      .accounts({
        arcadeAccount: arcadeAccountPDA,
        admin: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    // Fetch and assert the arcade account state
    const account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);

    expect(account.admin.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(account.arcadeName).to.equal(arcadeName);
    expect(account.maxTopScores).to.equal(maxTopScores);
    expect(account.pricePerGame.toNumber()).to.equal(pricePerGame.toNumber());
    expect(account.totalPriceDistributed.toNumber()).to.equal(0);
    expect(account.gameCounter.toNumber()).to.equal(0);
    expect(account.topUsers.length).to.equal(maxTopScores);

    account.topUsers.forEach((user: any) => {
      expect(user).to.be.null;
    });
  });
});
