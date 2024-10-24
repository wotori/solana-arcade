### Development
run local node ([if meet problem with test validator](https://github.com/solana-labs/solana/issues/28899#issuecomment-1694152935))
```
solana-test-validator (--reset)
solana config set --url localhost
anchor build 
anchor deploy
anchor test
```