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

// Example Keypairs (replace with actual keypairs)
const adminKeypair = Keypair.fromSecretKey(/* ... */);
const userKeypair = Keypair.fromSecretKey(/* ... */);

// Initialize the game
(async () => {
  await initializeGame(adminKeypair, "Super Arcade", 5, 1_000_000); // 0.001 SOL
})();

// User plays the game
(async () => {
  await playGame(userKeypair, adminKeypair.publicKey, 1_000_000); // 0.001 SOL
})();

// Admin adds a user score
(async () => {
  const userScore = {
    score: new anchor.BN(1000),
    nickname: "PlayerOne",
    userAddress: userKeypair.publicKey,
  };
  await addUserScore(adminKeypair, userScore);
})();

// Update price per game
(async () => {
  await updatePrice(adminKeypair, 2_000_000); // Update to 0.002 SOL
})();

// Get arcade state
(async () => {
  const totalDistributed = await getTotalPriceDistributed(
    adminKeypair.publicKey
  );
  console.log("Total Prize Distributed:", totalDistributed);

  const topUsers = await getTopUsers(adminKeypair.publicKey);
  console.log("Top Users:", topUsers);

  const gameCounter = await getGameCounter(adminKeypair.publicKey);
  console.log("Game Counter:", gameCounter);

  const pricePerGame = await getPricePerGame(adminKeypair.publicKey);
  console.log("Price Per Game:", pricePerGame);
})();
