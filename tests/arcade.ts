import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Arcade } from "../target/types/arcade"; // Adjust the path if necessary

describe("Arcade Program", () => {
  // Set up the provider and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Arcade as Program<Arcade>;

  let arcadePDA: PublicKey;
  let arcadeBump: number;
  let prizePoolTokenAccountPDA: PublicKey;
  let prizePoolBump: number;

  let mint: PublicKey;
  let playerTokenAccount: PublicKey;
  let userTokenAccount: PublicKey;

  const arcadeName = "Test Arcade";
  const pricePerGame = new anchor.BN(1000); // Adjust according to your mint's decimals
  const maxTopScores = 10;
  const admins = [provider.wallet.publicKey];

  it("Initializes the Arcade", async () => {
    // Generate the Arcade PDA
    [arcadePDA, arcadeBump] = await PublicKey.findProgramAddress(
      [Buffer.from("arcade")],
      program.programId
    );

    // Airdrop SOL to the initializer
    const airdropSignature = await provider.connection.requestAirdrop(
      provider.wallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Create a new mint
    const mintAuthority = Keypair.generate();
    mint = await createMint(
      provider.connection,
      provider.wallet.payer,
      mintAuthority.publicKey,
      null,
      9 // Decimals
    );

    // Create token accounts for the player and the prize pool
    playerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint,
      provider.wallet.publicKey // Player's public key
    );

    // Mint tokens to the player's token account
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mint,
      playerTokenAccount.address,
      mintAuthority,
      1_000_000_000 // Adjust the amount as needed
    );

    // Generate the Prize Pool Token Account PDA
    [prizePoolTokenAccountPDA, prizePoolBump] =
      await PublicKey.findProgramAddress(
        [Buffer.from("prize_pool"), arcadePDA.toBuffer()],
        program.programId
      );

    // Call the initialize function
    await program.methods
      .initialize(admins, arcadeName, maxTopScores, pricePerGame)
      .accounts({
        arcade: arcadePDA,
        initializer: provider.wallet.publicKey,
        mint: mint,
        prizePoolTokenAccount: prizePoolTokenAccountPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Fetch the Arcade account and verify its state
    const arcadeAccount = await program.account.arcade.fetch(arcadePDA);
    assert.equal(arcadeAccount.arcadeName, arcadeName);
    assert.equal(
      arcadeAccount.pricePerGame.toNumber(),
      pricePerGame.toNumber()
    );
    assert.equal(arcadeAccount.maxTopScores, maxTopScores);
    assert.deepEqual(arcadeAccount.admins, admins);
    console.log("Arcade initialized successfully");
  });

  it("Player plays a game", async () => {
    // Call the play function
    await program.methods
      .play()
      .accounts({
        arcade: arcadePDA,
        player: provider.wallet.publicKey,
        playerTokenAccount: playerTokenAccount.address,
        prizePoolTokenAccount: prizePoolTokenAccountPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Fetch the Arcade account and verify the game counter
    const arcadeAccount = await program.account.arcade.fetch(arcadePDA);
    assert.equal(arcadeAccount.gameCounter.toNumber(), 1);
    console.log("Game counter incremented");

    // Check the player's token account balance
    const playerTokenAccountInfo = await getAccount(
      provider.connection,
      playerTokenAccount.address
    );
    assert.equal(
      playerTokenAccountInfo.amount.toNumber(),
      1_000_000_000 - pricePerGame.toNumber()
    );
    console.log("Player's token account balance updated");

    // Check the prize pool token account balance
    const prizePoolTokenAccountInfo = await getAccount(
      provider.connection,
      prizePoolTokenAccountPDA
    );
    assert.equal(
      prizePoolTokenAccountInfo.amount.toNumber(),
      pricePerGame.toNumber()
    );
    console.log("Prize pool token account balance updated");
  });

  it("Updates the price per game", async () => {
    const newPrice = new anchor.BN(2_000);

    await program.methods
      .updatePrice(newPrice)
      .accounts({
        arcade: arcadePDA,
        admin: provider.wallet.publicKey,
      })
      .rpc();

    const arcadeAccount = await program.account.arcade.fetch(arcadePDA);
    assert.equal(arcadeAccount.pricePerGame.toNumber(), newPrice.toNumber());
    console.log("Price per game updated successfully");
  });

  it("Adds a new admin", async () => {
    const newAdminKeypair = Keypair.generate();
    const newAdminPubkey = newAdminKeypair.publicKey;

    // Airdrop SOL to the new admin for transaction fees
    const airdropSignature = await provider.connection.requestAirdrop(
      newAdminPubkey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    await program.methods
      .addAdmin([newAdminPubkey])
      .accounts({
        arcade: arcadePDA,
        admin: provider.wallet.publicKey,
      })
      .rpc();

    const arcadeAccount = await program.account.arcade.fetch(arcadePDA);
    assert.ok(arcadeAccount.admins.includes(newAdminPubkey));
    console.log("New admin added successfully");
  });

  it("Admin leaves the arcade", async () => {
    await program.methods
      .leave()
      .accounts({
        arcade: arcadePDA,
        admin: provider.wallet.publicKey,
      })
      .rpc();

    const arcadeAccount = await program.account.arcade.fetch(arcadePDA);
    assert.ok(!arcadeAccount.admins.includes(provider.wallet.publicKey));
    console.log("Admin left the arcade successfully");
  });

  it("Adds a top user", async () => {
    // Ensure the caller is an admin
    // Re-add the original admin for testing
    await program.methods
      .addAdmin([provider.wallet.publicKey])
      .accounts({
        arcade: arcadePDA,
        admin: provider.wallet.publicKey, // Since the admin left, we use the same key to re-add
      })
      .rpc();

    // Create a user token account (could be the same as the player)
    userTokenAccount = playerTokenAccount.address;

    const topUser = {
      name: "TopPlayer",
      address: provider.wallet.publicKey,
      score: 9999,
    };

    // Call the addTopUser function
    await program.methods
      .addTopUser(topUser)
      .accounts({
        arcade: arcadePDA,
        admin: provider.wallet.publicKey,
        prizePoolTokenAccount: prizePoolTokenAccountPDA,
        userTokenAccount: userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const arcadeAccount = await program.account.arcade.fetch(arcadePDA);
    assert.equal(arcadeAccount.topUsers.length, 1);
    assert.equal(arcadeAccount.topUsers[0].name, "TopPlayer");
    assert.equal(arcadeAccount.topUsers[0].score, 9999);
    console.log("Top user added successfully");
  });

  it("Attempts to play without sufficient funds", async () => {
    // Drain the player's token account
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mint,
      prizePoolTokenAccountPDA,
      mintAuthority,
      1_000_000_000 - pricePerGame.toNumber()
    );

    try {
      await program.methods
        .play()
        .accounts({
          arcade: arcadePDA,
          player: provider.wallet.publicKey,
          playerTokenAccount: playerTokenAccount.address,
          prizePoolTokenAccount: prizePoolTokenAccountPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      assert.fail("Expected an error due to insufficient funds");
    } catch (err) {
      assert.ok(
        err.error.errorCode.code === "InsufficientFunds",
        "Expected InsufficientFunds error"
      );
      console.log("Properly caught insufficient funds error");
    }
  });
});
