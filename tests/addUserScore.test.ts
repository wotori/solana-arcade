// tests/addUserScore.test.ts

import { expect } from "chai";
import * as anchor from "@coral-xyz/anchor";
import { initAdmin, createUser, program, provider } from "./helpers";

describe("Add User Score", () => {
  let admin: anchor.web3.Keypair;
  let arcadeAccountPDA: anchor.web3.PublicKey;

  before(async () => {
    // Initialize admin and arcade account
    const initResult = await initAdmin();
    admin = initResult.admin;
    arcadeAccountPDA = initResult.arcadeAccountPDA;

    // Initialize the arcade account
    const arcadeName = "Super Arcade";
    const maxTopScores = 3;
    const pricePerGame = new anchor.BN(anchor.web3.LAMPORTS_PER_SOL).div(
      new anchor.BN(10)
    );

    await program.methods
      .initialize(arcadeName, maxTopScores, pricePerGame)
      .accounts({
        arcadeAccount: arcadeAccountPDA,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();
  });

  it("Distributes prize to the user when a new high score is achieved", async () => {
    // Create users
    const user1 = await createUser();
    const user2 = await createUser();
    const user3 = await createUser();
    const user4 = await createUser();

    // Define user scores
    const scores = [
      {
        score: new anchor.BN(1),
        userAddress: user1.publicKey,
        nickname: "Alice",
        user: user1,
      },
      {
        score: new anchor.BN(3),
        userAddress: user2.publicKey,
        nickname: "Bob",
        user: user2,
      },
      {
        score: new anchor.BN(10),
        userAddress: user3.publicKey,
        nickname: "Charlie",
        user: user3,
      },
      {
        score: new anchor.BN(100),
        userAddress: user4.publicKey,
        nickname: "Dave",
        user: user4,
      },
    ];

    // Admin adds the first three scores
    for (const scoreData of scores.slice(0, 3)) {
      await program.methods
        .addUserScore({
          score: scoreData.score,
          userAddress: scoreData.userAddress,
          nickname: scoreData.nickname,
        })
        .accounts({
          arcadeAccount: arcadeAccountPDA,
          admin: admin.publicKey,
          user: scoreData.userAddress, // Include user account
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();
    }

    // Fetch and assert the arcade account state after first three scores
    let account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);

    // Expected order after first three scores
    expect(account.topUsers.length).to.equal(3);
    expect(account.topUsers[0]?.nickname).to.equal("Charlie");
    expect(account.topUsers[1]?.nickname).to.equal("Bob");
    expect(account.topUsers[2]?.nickname).to.equal("Alice");

    // Get balances before adding the fourth score
    const arcadeBalanceBefore = await provider.connection.getBalance(
      arcadeAccountPDA
    );
    const daveBalanceBefore = await provider.connection.getBalance(
      user4.publicKey
    );

    // Get account info to determine data length for rent exemption
    const accountInfo = await provider.connection.getAccountInfo(
      arcadeAccountPDA
    );

    // Add the fourth score (new high score by Dave)
    await program.methods
      .addUserScore({
        score: scores[3].score,
        userAddress: scores[3].userAddress,
        nickname: scores[3].nickname,
      })
      .accounts({
        arcadeAccount: arcadeAccountPDA,
        admin: admin.publicKey,
        user: scores[3].userAddress, // Dave's account
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    // Fetch balances after adding the fourth score
    const arcadeBalanceAfter = await provider.connection.getBalance(
      arcadeAccountPDA
    );
    const daveBalanceAfter = await provider.connection.getBalance(
      user4.publicKey
    );

    // Fetch the updated arcade account state
    account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);

    // Expected order after fourth score
    expect(account.topUsers.length).to.equal(3);
    expect(account.topUsers[0]?.nickname).to.equal("Dave");
    expect(account.topUsers[1]?.nickname).to.equal("Charlie");
    expect(account.topUsers[2]?.nickname).to.equal("Bob");
    expect(account.topUsers.some((user: any) => user?.nickname === "Alice")).to
      .be.false;

    // Calculate the rent-exempt minimum balance
    const rentExemptMinimum =
      await provider.connection.getMinimumBalanceForRentExemption(
        accountInfo?.data.length || 0
      );

    // Calculate the expected prize amount
    const prizeAmount = arcadeBalanceBefore - rentExemptMinimum;

    // Verify that the prize amount was transferred to Dave
    expect(arcadeBalanceAfter).to.equal(rentExemptMinimum);
    expect(daveBalanceAfter).to.equal(daveBalanceBefore + prizeAmount);

    // Check that totalPriceDistributed is updated correctly
    expect(account.totalPriceDistributed.toNumber()).to.equal(prizeAmount);
  });
});
