use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::{invoke, invoke_signed},
    system_instruction,
    sysvar::rent::Rent,
};

declare_id!("EVxipTzjmJgnsfTXxKpQSJFeS6rTuYAgmuLKTSBjAP9E");

#[program]
pub mod arcade {
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
        arcade_account.bump = ctx.bumps.arcade_account;

        Ok(())
    }

    pub fn play(ctx: Context<Play>, lamports: u64) -> Result<()> {
        let arcade_account_key = ctx.accounts.arcade_account.key();
        let admin_key = ctx.accounts.admin.key();

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
                ctx.accounts.admin.to_account_info(),
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

        // Ensure the user account matches the user address in the score
        require!(
            ctx.accounts.user.key() == user_score.user_address,
            CustomError::InvalidUserAccount
        );

        // Collect existing scores and sort them in descending order
        let mut scores: Vec<UserScore> = arcade_account
            .top_users
            .iter()
            .filter_map(|x| x.clone())
            .collect();

        scores.sort_by(|a, b| b.score.cmp(&a.score));

        // Get the highest score before adding the new score
        let highest_score_before = scores.first().map(|s| s.score);

        // Check if the new score exceeds the highest score and is not equal
        let is_new_highest = highest_score_before.map_or(true, |s| user_score.score > s);

        // Add the new user score to the list
        scores.push(user_score.clone());

        // Sort the scores again after adding the new score
        scores.sort_by(|a, b| b.score.cmp(&a.score));

        // Keep only the top N scores
        scores.truncate(arcade_account.max_top_scores as usize);

        // Update the top_users
        arcade_account.top_users = scores.into_iter().map(Some).collect();

        // If the new score is the highest, award the prize pool to the user
        if is_new_highest {
            // Calculate the rent-exempt minimum balance
            let rent = Rent::get()?;
            let min_balance = rent.minimum_balance(arcade_account.to_account_info().data_len());

            // Calculate the prize amount (total lamports minus minimum balance)
            let total_lamports = arcade_account.to_account_info().lamports();
            let prize_amount = total_lamports.saturating_sub(min_balance);

            // Ensure there is a prize to distribute
            if prize_amount > 0 {
                // Prepare the seeds for signing
                let bump = arcade_account.bump;
                let seeds = &[b"arcade_account", arcade_account.admin.as_ref(), &[bump]];
                let signer_seeds = &[&seeds[..]];

                // Transfer the prize amount from the arcade account to the user
                invoke_signed(
                    &system_instruction::transfer(
                        &arcade_account.key(),
                        &ctx.accounts.user.key(),
                        prize_amount,
                    ),
                    &[
                        arcade_account.to_account_info(),
                        ctx.accounts.user.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    signer_seeds,
                )?;

                // Update the total price distributed
                arcade_account.total_price_distributed = arcade_account
                    .total_price_distributed
                    .checked_add(prize_amount)
                    .ok_or(ProgramError::InvalidInstructionData)?;
            }
        }

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
        space = 8 + 32 + 4 + 256 + 4 + 8 + 8 + 8 + (max_top_scores as usize * 40) + 1
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
        bump = arcade_account.bump
    )]
    pub arcade_account: Account<'info, ArcadeAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: This is verified as the arcade admin when the PDA is derived and used for payment.
    #[account(mut)]
    pub admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddUserScore<'info> {
    #[account(
        mut,
        seeds = [b"arcade_account", arcade_account.admin.key().as_ref()],
        bump = arcade_account.bump
    )]
    pub arcade_account: Account<'info, ArcadeAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: This is the user who achieved the new high score.
    #[account(mut)]
    pub user: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
        mut,
        seeds = [b"arcade_account", arcade_account.admin.key().as_ref()],
        bump = arcade_account.bump
    )]
    pub arcade_account: Account<'info, ArcadeAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetState<'info> {
    #[account(
        seeds = [b"arcade_account", arcade_account.admin.key().as_ref()],
        bump = arcade_account.bump
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
    pub bump: u8,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Ord, PartialOrd)]
pub struct UserScore {
    pub score: u64,
    pub nickname: String,
    pub user_address: Pubkey,
}

#[error_code]
pub enum CustomError {
    #[msg("Incorrect payment amount")]
    IncorrectPaymentAmount,
    #[msg("Unauthorized action")]
    Unauthorized,
    #[msg("Invalid user account")]
    InvalidUserAccount,
}
