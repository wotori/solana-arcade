use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use std::collections::BinaryHeap;

declare_id!("4vvLSqVKUwLigvkF6rtGsi7X6k5nCidb2gvbudhoKHvL");

#[program]
pub mod arcade_rewards {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        arcade_name: String,
        max_top_scores: u8,
        price_per_game: u64,
    ) -> Result<()> {
        let arcade_account = &mut ctx.accounts.arcade_account;
        arcade_account.admin = *ctx.accounts.admin.key;
        arcade_account.arcade_name = arcade_name;
        arcade_account.max_top_scores = max_top_scores;
        arcade_account.price_per_game = price_per_game;
        arcade_account.total_price_distributed = 0;
        arcade_account.game_counter = 0;
        arcade_account.top_users = vec![None; max_top_scores as usize];

        Ok(())
    }

    pub fn play(ctx: Context<Play>, lamports: u64) -> Result<()> {
        let arcade_account_key = ctx.accounts.arcade_account.key();
        let admin_key = ctx.accounts.admin.key(); // Added admin key

        let arcade_account = &mut ctx.accounts.arcade_account;
        require!(
            lamports == arcade_account.price_per_game,
            CustomError::IncorrectPaymentAmount
        );

        let user_key = ctx.accounts.user.key();

        // Transfer payment to the arcade program account
        invoke(
            &system_instruction::transfer(&user_key, &arcade_account_key, lamports / 2),
            &[
                ctx.accounts.user.to_account_info(),
                arcade_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Transfer payment to the admin account
        invoke(
            &system_instruction::transfer(&user_key, &admin_key, lamports / 2),
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.admin.to_account_info(), // Include admin account
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Increase the game counter
        arcade_account.game_counter += 1;
        Ok(())
    }

    pub fn add_user_score(ctx: Context<AddUserScore>, user_score: UserScore) -> Result<()> {
        let arcade_account = &mut ctx.accounts.arcade_account;

        // Authorization check
        require!(
            arcade_account.admin == *ctx.accounts.admin.key,
            CustomError::Unauthorized
        );

        // Create a binary heap from the top users
        let mut heap: BinaryHeap<_> = arcade_account
            .top_users
            .iter()
            .filter_map(|x| x.clone())
            .collect();

        // Insert the new user score
        heap.push(user_score.clone());

        // Ensure the heap doesn't exceed the maximum number of top scores
        if heap.len() > arcade_account.max_top_scores as usize {
            heap.pop();
        }

        // Update the top users list from the heap
        arcade_account.top_users = heap.into_sorted_vec().into_iter().rev().map(Some).collect();

        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, new_price: u64) -> Result<()> {
        let arcade_account = &mut ctx.accounts.arcade_account;
        require!(
            arcade_account.admin == *ctx.accounts.admin.key,
            CustomError::Unauthorized
        );
        arcade_account.price_per_game = new_price;
        Ok(())
    }

    pub fn get_total_price_distributed(ctx: Context<GetState>) -> Result<u64> {
        Ok(ctx.accounts.arcade_account.total_price_distributed)
    }

    pub fn get_top_users(ctx: Context<GetState>) -> Result<Vec<Option<UserScore>>> {
        Ok(ctx.accounts.arcade_account.top_users.clone())
    }

    pub fn get_game_counter(ctx: Context<GetState>) -> Result<u64> {
        Ok(ctx.accounts.arcade_account.game_counter)
    }

    pub fn get_price_per_game(ctx: Context<GetState>) -> Result<u64> {
        Ok(ctx.accounts.arcade_account.price_per_game)
    }
}

#[derive(Accounts)]
#[instruction(arcade_name: String, max_top_scores: u8, price_per_game: u64)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        seeds = [b"arcade_account", admin.key().as_ref()],
        bump,
        space = 8 + 32 + 4 + 256 + 4 + 8 + 8 + 8 + (max_top_scores as usize * 40)
    )]
    pub arcade_account: Account<'info, ArcadeAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Play<'info> {
    #[account(
        mut,
        seeds = [b"arcade_account", admin.key().as_ref()],
        bump
    )]
    pub arcade_account: Account<'info, ArcadeAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: This is verified as the arcade admin when the PDA is derived and used for payment.
    #[account(mut)]
    pub admin: AccountInfo<'info>, // Added safety comment
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddUserScore<'info> {
    #[account(
        mut,
        seeds = [b"arcade_account", arcade_account.admin.key().as_ref()],
        bump
    )]
    pub arcade_account: Account<'info, ArcadeAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
        mut,
        seeds = [b"arcade_account", arcade_account.admin.key().as_ref()],
        bump
    )]
    pub arcade_account: Account<'info, ArcadeAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetState<'info> {
    #[account(
        seeds = [b"arcade_account", arcade_account.admin.key().as_ref()],
        bump
    )]
    pub arcade_account: Account<'info, ArcadeAccount>,
}

#[account]
pub struct ArcadeAccount {
    pub admin: Pubkey,
    pub arcade_name: String,
    pub total_price_distributed: u64,
    pub game_counter: u64,
    pub max_top_scores: u8,
    pub price_per_game: u64,
    pub top_users: Vec<Option<UserScore>>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Ord, PartialOrd)]
pub struct UserScore {
    pub user_address: Pubkey,
    pub nickname: String,
}

#[error_code]
pub enum CustomError {
    #[msg("Incorrect payment amount")]
    IncorrectPaymentAmount,
    #[msg("Unauthorized action")]
    Unauthorized,
}
