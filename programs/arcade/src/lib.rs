use anchor_lang::prelude::*;

declare_id!("34ChFkgCd7JXnVEW3ityB8GvvUcXH1kusH1cz2SJwR1H");

#[program]
pub mod arcade {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
