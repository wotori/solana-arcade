use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// Replace with your actual program ID
declare_id!("CrxQKgLZU7bnm5yPsn4tMvnK9qBWDCtzoz3NCvk39eV3");

#[program]
pub mod arcade {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        admins: Vec<Pubkey>,
        arcade_name: String,
        max_top_scores: u32,
        price_per_game: u64,
    ) -> Result<()> {
        let arcade_account = &mut ctx.accounts.arcade;
        arcade_account.admins = admins;
        arcade_account.arcade_name = arcade_name;
        arcade_account.max_top_scores = max_top_scores;
        arcade_account.game_counter = 0;
        arcade_account.price_per_game = price_per_game;
        arcade_account.total_price_distributed = 0;

        // Safely retrieve the bump for "arcade"
        arcade_account.bump = ctx.bumps.arcade;

        // Safely retrieve the bump for "prize_pool"
        arcade_account.prize_pool_bump = ctx.bumps.prize_pool_token_account;

        arcade_account.mint = ctx.accounts.mint.key();

        Ok(())
    }

    pub fn add_admin(ctx: Context<AddAdmin>, new_admins: Vec<Pubkey>) -> Result<()> {
        let arcade = &mut ctx.accounts.arcade;
        require!(
            arcade.admins.contains(&ctx.accounts.admin.key()),
            ArcadeError::Unauthorized
        );

        arcade.admins.extend(new_admins);
        Ok(())
    }

    pub fn leave(ctx: Context<Leave>) -> Result<()> {
        let arcade = &mut ctx.accounts.arcade;
        arcade.admins.retain(|&x| x != ctx.accounts.admin.key());
        Ok(())
    }

    pub fn play(ctx: Context<Play>) -> Result<()> {
        let arcade = &mut ctx.accounts.arcade;
        let price = arcade.price_per_game;

        let player_balance = ctx.accounts.player_token_account.amount;
        require!(player_balance >= price, ArcadeError::InsufficientFunds);

        // Transfer tokens from player to prize pool
        let cpi_accounts = Transfer {
            from: ctx.accounts.player_token_account.to_account_info(),
            to: ctx.accounts.prize_pool_token_account.to_account_info(),
            authority: ctx.accounts.player.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, price)?;

        arcade.game_counter += 1;

        // Emit an event for off-chain tracking
        emit!(PlayEvent {
            player: ctx.accounts.player.key(),
            arcade: arcade.key(),
            amount: price,
        });

        Ok(())
    }

    pub fn add_top_user(ctx: Context<AddTopUser>, user: User) -> Result<()> {
        // Collect necessary data before mutable borrow
        let admin_key = ctx.accounts.admin.key();
        let _arcade_key = ctx.accounts.arcade.key();
        let amount = ctx.accounts.prize_pool_token_account.amount;
        let bump = ctx.accounts.arcade.bump;

        // Determine if we need to perform CPI and update
        let should_update;

        {
            // Start mutable borrow
            let arcade = &mut ctx.accounts.arcade;

            require!(
                arcade.admins.contains(&admin_key),
                ArcadeError::Unauthorized
            );

            let max_scores = arcade.max_top_scores as usize;

            if arcade.top_users.len() < max_scores {
                arcade.top_users.push(user.clone());
                arcade.top_users.sort_by(|a, b| b.score.cmp(&a.score));
                return Ok(());
            } else if let Some(lowest_user) = arcade.top_users.last() {
                if user.score > lowest_user.score {
                    should_update = true;
                } else {
                    return Ok(());
                }
            } else {
                return Ok(());
            }
            // Mutable borrow ends here
        }

        // Now we can immutably borrow `ctx.accounts.arcade`
        if should_update {
            let arcade_info = ctx.accounts.arcade.to_account_info();

            // Perform the CPI with the arcade's authority
            let seeds = &[b"arcade".as_ref(), &[bump]];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.prize_pool_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: arcade_info.clone(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, amount)?;

            // Re-borrow `arcade` mutably after CPI to update state
            let arcade = &mut ctx.accounts.arcade;
            arcade.total_price_distributed += amount;
            arcade.top_users.pop();
            arcade.top_users.push(user);
            arcade.top_users.sort_by(|a, b| b.score.cmp(&a.score));
        }

        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, price: u64) -> Result<()> {
        let arcade = &mut ctx.accounts.arcade;
        require!(
            arcade.admins.contains(&ctx.accounts.admin.key()),
            ArcadeError::Unauthorized
        );
        arcade.price_per_game = price;

        // Emit an event to indicate price update
        emit!(PriceUpdateEvent {
            arcade: arcade.key(),
            new_price: price,
            updated_by: ctx.accounts.admin.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"arcade"],
        bump,
        payer = initializer,
        space = Arcade::SIZE
    )]
    pub arcade: Account<'info, Arcade>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    /// CHECK: This is safe because we don't read or write from this account
    pub mint: AccountInfo<'info>,
    #[account(
        init,
        payer = initializer,
        seeds = [b"prize_pool", arcade.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = arcade,
    )]
    pub prize_pool_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddAdmin<'info> {
    #[account(mut)]
    pub arcade: Account<'info, Arcade>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Leave<'info> {
    #[account(mut)]
    pub arcade: Account<'info, Arcade>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Play<'info> {
    #[account(mut)]
    pub arcade: Account<'info, Arcade>,
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, constraint = player_token_account.owner == player.key())]
    pub player_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"prize_pool", arcade.key().as_ref()],
        bump = arcade.prize_pool_bump,
        token::mint = arcade.mint,
        token::authority = arcade,
    )]
    pub prize_pool_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddTopUser<'info> {
    #[account(mut)]
    pub arcade: Account<'info, Arcade>,
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"prize_pool", arcade.key().as_ref()],
        bump = arcade.prize_pool_bump,
        token::mint = arcade.mint,
        token::authority = arcade,
    )]
    pub prize_pool_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(mut)]
    pub arcade: Account<'info, Arcade>,
    pub admin: Signer<'info>,
}

#[account]
pub struct Arcade {
    pub admins: Vec<Pubkey>,
    pub arcade_name: String,
    pub max_top_scores: u32,
    pub top_users: Vec<User>,
    pub game_counter: u64,
    pub price_per_game: u64,
    pub total_price_distributed: u64,
    pub bump: u8,
    pub mint: Pubkey,
    pub prize_pool_bump: u8,
}

impl Arcade {
    // Maximum sizes for dynamic fields
    pub const MAX_ADMINS: usize = 3;
    pub const MAX_ARCADE_NAME_LENGTH: usize = 64;
    pub const MAX_TOP_USERS: usize = 10;
    pub const SIZE: usize = 8 + // Discriminator
        4 + (Self::MAX_ADMINS * 32) + // admins Vec<Pubkey>
        4 + Self::MAX_ARCADE_NAME_LENGTH + // arcade_name String
        4 + // max_top_scores u32
        4 + (Self::MAX_TOP_USERS * User::SIZE) + // top_users Vec<User>
        8 + // game_counter u64
        8 + // price_per_game u64
        8 + // total_price_distributed u64
        1 + // bump u8
        32 + // mint Pubkey
        1; // prize_pool_bump u8
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct User {
    pub name: String,
    pub address: Pubkey,
    pub score: u16,
}

impl User {
    pub const MAX_NAME_LENGTH: usize = 32; // Adjust as needed
    pub const SIZE: usize = 4 + Self::MAX_NAME_LENGTH + // name String
        32 + // address Pubkey
        2; // score u16
}

// Events for off-chain tracking
#[event]
pub struct PlayEvent {
    pub player: Pubkey,
    pub arcade: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PriceUpdateEvent {
    pub arcade: Pubkey,
    pub new_price: u64,
    pub updated_by: Pubkey,
}

#[error_code]
pub enum ArcadeError {
    #[msg("Unauthorized action")]
    Unauthorized,
    #[msg("Score too low to enter top scores")]
    ScoreTooLow,
    #[msg("Missing bump for PDA")]
    MissingBump,
    #[msg("Insufficient funds for game")]
    InsufficientFunds,
}
