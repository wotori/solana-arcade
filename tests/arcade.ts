import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { expect } from "chai";

// Import the type definitions for your program
import { ArcadeRewards } from "../target/types/arcade_rewards";
import { PublicKey } from "@solana/web3.js";

interface UserScore {
  userAddress: PublicKey;
  nickname: string;
}

interface ArcadeAccount {
  admin: PublicKey;
  arcadeName: string;
  totalPriceDistributed: anchor.BN;
  gameCounter: anchor.BN;
  maxTopScores: number;
  pricePerGame: anchor.BN;
  topUsers: Array<UserScore | null>;
}

describe("arcade_rewards", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ArcadeRewards as Program<ArcadeRewards>;

  const admin = web3.Keypair.generate();

  let arcadeAccountPDA: PublicKey;
  let arcadeAccountBump: number;

  before(async () => {
    const signature = await provider.connection.requestAirdrop(
      admin.publicKey,
      web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature, "confirmed");

    // Derive the PDA here so it can be reused
    [arcadeAccountPDA, arcadeAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from("arcade_account"), admin.publicKey.toBuffer()],
      program.programId
    );
  });

  const createUser = async () => {
    const user = web3.Keypair.generate();
    const signature = await provider.connection.requestAirdrop(
      user.publicKey,
      web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature, "confirmed");
    return user;
  };

  it("Initializes the arcade account using PDA", async () => {
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

  it("Allows a user to play a game", async () => {
    // Derive the same PDA for the arcade account as in the initialize step
    const [arcadeAccountPDA, arcadeAccountBump] =
      await PublicKey.findProgramAddress(
        [Buffer.from("arcade_account"), admin.publicKey.toBuffer()],
        program.programId
      );

    // Create a user
    const user = await createUser();

    // Define the price for the game
    const pricePerGame = new anchor.BN(web3.LAMPORTS_PER_SOL).div(
      new anchor.BN(10)
    ); // 0.1 SOL

    // User plays a game
    try {
      await program.methods
        .play(pricePerGame)
        .accounts({
          arcadeAccount: arcadeAccountPDA, // Correct PDA for arcade account
          user: user.publicKey, // User account
          admin: admin.publicKey, // Admin account
          systemProgram: web3.SystemProgram.programId,
        } as any)
        .signers([user])
        .rpc();
    } catch (error) {
      console.log("Transaction logs:", error); // Print error logs for debugging
      throw error; // Rethrow the error to make sure the test fails properly
    }

    // Fetch the updated arcade account
    const account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);

    // Check that the game counter has increased
    expect(account.gameCounter.toNumber()).to.equal(1);

    // Check the balance of the arcade account
    const arcadeBalance = await provider.connection.getBalance(
      arcadeAccountPDA
    );
    expect(arcadeBalance).to.be.closeTo(pricePerGame.toNumber() / 2, 5000000); // Allow a larger delta for transaction fees
  });

  // Add user score
  it("Allows admin to add a user score and handles top users correctly", async () => {
    // Use the existing arcade account PDA to prevent reinitialization issues
    const maxTopScores = 3;

    // Create users
    const user1 = await createUser();
    const user2 = await createUser();
    const user3 = await createUser();
    const user4 = await createUser();

    // Define user scores
    const score1 = {
      score: new anchor.BN(1),
      user_address: user1.publicKey,
      nickname: "Alice",
    };

    const score2 = {
      score: new anchor.BN(3),
      user_address: user2.publicKey,
      nickname: "Bob",
    };

    const score3 = {
      score: new anchor.BN(10),
      user_address: user3.publicKey,
      nickname: "Charlie",
    };

    const score4 = {
      score: new anchor.BN(100),
      user_address: user4.publicKey,
      nickname: "Dave",
    };

    // console.log("Adding scores for users:");
    // console.log("Score 1 (Alice):", score1);
    // console.log("Score 2 (Bob):", score2);
    // console.log("Score 3 (Charlie):", score3);
    // console.log("Score 4 (Dave):", score4);

    // Admin adds first three scores
    await program.methods
      .addUserScore(score1)
      .accounts({
        arcadeAccount: arcadeAccountPDA,
        admin: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    await program.methods
      .addUserScore(score2)
      .accounts({
        arcadeAccount: arcadeAccountPDA,
        admin: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    await program.methods
      .addUserScore(score3)
      .accounts({
        arcadeAccount: arcadeAccountPDA,
        admin: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // Fetch the arcade account
    let account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);

    // console.log("Top users after adding first three scores:", account.topUsers);

    expect(account.topUsers.length).to.equal(maxTopScores);
    expect(account.topUsers[0]?.nickname).to.equal("Charlie");
    expect(account.topUsers[1]?.nickname).to.equal("Bob");
    expect(account.topUsers[2]?.nickname).to.equal("Alice");

    // Add a fourth score which should replace the lowest if applicable
    await program.methods
      .addUserScore(score4)
      .accounts({
        arcadeAccount: arcadeAccountPDA,
        admin: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // Fetch the updated arcade account
    account = await program.account.arcadeAccount.fetch(arcadeAccountPDA);

    // console.log("Top users after adding fourth score:", account.topUsers);

    // Ensure the length remains consistent and the lowest score is replaced
    expect(account.topUsers.length).to.equal(4); // TODO: should be 4
    expect(account.topUsers[0]?.nickname).to.equal("Dave");
    //   expect(account.topUsers.some((user) => user?.nickname === "Alice")).to.be
    //     .false; // TODO: uncomment, should be false
  });

  // Get state
  it("Retrieves the correct state from get_state functions", async () => {
    const maxTopScores = 5;
    const pricePerGame = new anchor.BN(web3.LAMPORTS_PER_SOL).div(
      new anchor.BN(10)
    ); // 0.1 SOL

    // Play a game to modify state
    const user = await createUser();
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

    // Get total price distributed
    const totalPriceDistributed = account.totalPriceDistributed;
    expect(totalPriceDistributed.toNumber()).to.equal(0); // Assuming no prizes have been distributed yet


    // TODO: ...
    // // Get game counter
    // const gameCounter = account.gameCounter;
    // expect(gameCounter.toNumber()).to.equal(2);

    // // Get price per game
    // const currentPrice = account.pricePerGame;
    // expect(currentPrice.toNumber()).to.equal(pricePerGame.toNumber());

    // // Get top users
    // const topUsers = account.topUsers;
    // expect(topUsers.length).to.equal(maxTopScores);
    // topUsers.forEach((user: any) => {
    //   expect(user).to.be.null;
    // });
  });
});
