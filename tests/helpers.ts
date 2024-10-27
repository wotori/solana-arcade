// tests/helpers.ts

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Arcade } from "../target/types/arcade";
import { web3 } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// Initialize the provider and set it globally
export const provider = AnchorProvider.env();
anchor.setProvider(provider);

// Reference to the deployed program
export const program = anchor.workspace.Arcade as Program<Arcade>;

// Function to initialize the admin account and derive PDA
export const initAdmin = async () => {
  // Generate a new admin keypair for each test
  const admin = web3.Keypair.generate();

  // Airdrop SOL to the admin account
  const signature = await provider.connection.requestAirdrop(
    admin.publicKey,
    web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(signature, "confirmed");

  // Derive the PDA for the arcade account
  const [arcadeAccountPDA, arcadeAccountBump] =
    await PublicKey.findProgramAddress(
      [Buffer.from("arcade_account"), admin.publicKey.toBuffer()],
      program.programId
    );

  return { admin, arcadeAccountPDA, arcadeAccountBump };
};

// Helper function to create a new user with funded SOL
export const createUser = async () => {
  const user = web3.Keypair.generate();
  const signature = await provider.connection.requestAirdrop(
    user.publicKey,
    web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(signature, "confirmed");
  return user;
};
