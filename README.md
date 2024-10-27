# Arcade Smart Contract

This project implements a Solana-based smart contract designed to manage top users in games. Built using the Anchor framework, it supports features like tracking top scores, managing administrators, and handling in-game payments. This contract is scalable and can be integrated into games to manage player leaderboards and distribute rewards.

# JFYI

This project builds on the existing smart contract [CW-Arcade](https://github.com/wotori/cw-arcade), initially developed for a Cosmos-based blockchain. While it functions as a port, it introduces Solana-specific features, such as account management and arcade creation accessible to everyone. The project has attracted interest online and holds potential as a new protocol or standard for decentralized arcades, enabling users to deploy and connect their games.

## Features

- **Initialize Arcade**: Set up a new arcade with administrators, a name, max top scores, and game pricing.
- **Play Game**: Players can pay to play the game, and their payments are transferred to a prize pool.
- **Add Top User**: Add players to the top user leaderboard, which ranks players by their score.
- **Manage Administrators**: Add or remove administrators with authorization checks.
- **Update Game Price**: Modify the cost to play the game at any time.

## Technologies Used

- **Solana**
- **Anchor Framework**
- **Rust**

### Development

run local node ([if meet problem with test validator](https://github.com/solana-labs/solana/issues/28899#issuecomment-1694152935))

```
solana-test-validator (--reset)
solana config set --url localhost
anchor build
anchor deploy
anchor test --skip-local-validator
```
