# Arcade Smart Contract

![alt decentralized arcade](https://i.ibb.co/jktJ4Jt/aaarcade.jpg)

This project implements a Solana-based smart contract designed to manage top users in games. Built using the Anchor framework, it supports features like tracking top scores, managing administrators, and handling in-game payments. This contract is scalable and can be integrated into games to manage player leaderboards and distribute rewards.

# Background

This project expands upon the original CW-Arcade smart contract, initially created for a Cosmos-based blockchain. While inspired by its predecessor, it incorporates Solana-specific features, such as streamlined account management and accessible arcade creation, making it even more efficient in terms of space and Solana-specific optimizations. The scoreboard leverages a [Sorted Vector](https://github.com/svdmeer27/arcade/blob/e56ae27d854e4e3092ee22ebfc90487edd9039ff/programs/arcade/src/lib.rs#L86-L110) instead of a Reversed Binary Heap, simplifying both logic and code readability, resulting in a more robust solution. This [Arcade project](https://x.com/wotorimovako/status/1683882135327842309) has already gained attention online and has the potential to establish itself as a new protocol or standard for decentralized arcades, enabling users to deploy and connect their games seamlessly on the Solana blockchain ecosystem.

## Features

- **Initialize Arcade**: Set up a new arcade with administrators, a name, max top scores, and game pricing.
- **Play Game**: Players can pay to play the game, and their payments are transferred to a prize pool.
- **Add Top User**: Add players to the top user leaderboard, which ranks players by their score.
- **Update Game Price**: Modify the cost to play the game at any time.
- **Fetch information**: 

## Technologies Used

- **Solana**
- **Anchor Framework**
- **Rust**

## About Tests

Currently, there is no live dApp utilizing this smart contract, so comprehensive unit tests have been implemented to ensure functionality. These tests cover the following scenarios:

- **Initialize Arcade Account**

  - ✔ Initializes the arcade account with a PDA

- **Play Game**

  - ✔ Allows a user to play a game

- **Add User Score**

  - ✔ Distributes a prize to the user when a new high score is achieved

- **Get Arcade State**

  - ✔ Retrieves the correct state using `get_state` functions

Overall, the test suite completes successfully with **4 passing tests**.

### Development

run local node ([if meet problem with test validator](https://github.com/solana-labs/solana/issues/28899#issuecomment-1694152935))

```
solana-test-validator (--reset)
solana config set --url localhost
anchor build
anchor deploy
anchor test --skip-local-validator
```
