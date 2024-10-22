import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { expect } from "chai";

// Import the type definitions for your program
import { ArcadeRewards } from "../target/types/arcade_rewards";

describe("arcade_rewards", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Use the anchor.workspace to load the program dynamically
  const program = anchor.workspace.ArcadeRewards as Program<ArcadeRewards>;

  // Generate a keypair for the admin
  const admin = web3.Keypair.generate();

  // Airdrop SOL to the admin before running tests
  before(async () => {
    const signature = await provider.connection.requestAirdrop(
      admin.publicKey,
      web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature, "confirmed");
  });

  // Utility function to create a user and airdrop SOL
  const createUser = async () => {
    const user = web3.Keypair.generate();
    const signature = await provider.connection.requestAirdrop(
      user.publicKey,
      web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature, "confirmed");
    return user;
  };

  // Initialize the arcade account
  it("Initializes the arcade account", async () => {
    // Generate a new keypair for the arcade account
    const arcadeAccount = web3.Keypair.generate();

    // Define arcade parameters
    const arcadeName = "Super Arcade";
    const maxTopScores = 5;
    const pricePerGame = new anchor.BN(web3.LAMPORTS_PER_SOL).div(
      new anchor.BN(10)
    ); // 0.1 SOL

    // Invoke the initialize method of your program
    await program.methods
      .initialize(arcadeName, maxTopScores, pricePerGame)
      .accounts({
        arcadeAccount: arcadeAccount.publicKey,
        admin: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      } as any) // Use 'any' temporarily if TypeScript complains
      .signers([admin, arcadeAccount])
      .rpc();

    // Fetch the initialized arcade account
    const account = await program.account.arcadeAccount.fetch(
      arcadeAccount.publicKey
    );

    // Perform assertions to verify the account was initialized correctly
    expect(account.admin.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(account.arcadeName).to.equal(arcadeName);
    expect(account.maxTopScores).to.equal(maxTopScores);
    expect(account.pricePerGame.toNumber()).to.equal(pricePerGame.toNumber());
    expect(account.totalPriceDistributed.toNumber()).to.equal(0);
    expect(account.gameCounter.toNumber()).to.equal(0);
    expect(account.topUsers.length).to.equal(maxTopScores);

    // Check that all entries in topUsers are null or default values
    account.topUsers.forEach((user: any) => {
      expect(user).to.be.null;
    });
  });
});
