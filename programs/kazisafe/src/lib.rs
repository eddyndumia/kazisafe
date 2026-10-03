use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("G48xcsU1JTUtWhsg23Z3E94v3cUZDjg7S7wxH4NpYg4M");

pub const MAX_STAGES: usize = 4;
pub const BPS: u64 = 10_000;
pub const MAX_FEE_BPS: u16 = 500;

#[program]
pub mod kazisafe {
    use super::*;

    /// One-time setup: who verifies agencies, who signs stage proofs, which mint, fee.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        attestor: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, KaziError::FeeTooHigh);
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.attestor = attestor;
        config.mint = ctx.accounts.mint.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_bps = fee_bps;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn update_config(ctx: Context<UpdateConfig>, attestor: Pubkey, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, KaziError::FeeTooHigh);
        let config = &mut ctx.accounts.config;
        config.attestor = attestor;
        config.fee_bps = fee_bps;
        Ok(())
    }

    /// Agency signs up. Starts unverified.
    pub fn register_agency(ctx: Context<RegisterAgency>, name: String, license_no: String) -> Result<()> {
        require!(name.len() <= Agency::MAX_NAME, KaziError::TooLong);
        require!(license_no.len() <= Agency::MAX_LICENSE, KaziError::TooLong);
        let agency = &mut ctx.accounts.agency;
        agency.authority = ctx.accounts.authority.key();
        agency.name = name;
        agency.license_no = license_no;
        agency.verified = false;
        agency.bump = ctx.bumps.agency;
        Ok(())
    }

    /// Admin marks an agency verified after checking the NEA licensed list (or unverifies it).
    pub fn set_agency_verified(ctx: Context<SetAgencyVerified>, verified: bool) -> Result<()> {
        ctx.accounts.agency.verified = verified;
        emit!(AgencyVerified { agency: ctx.accounts.agency.key(), verified });
        Ok(())
    }

    /// Agency creates a placement. Stage shares must add up to 100%.
    pub fn create_placement(
        ctx: Context<CreatePlacement>,
        args: CreatePlacementArgs,
    ) -> Result<()> {
        let agency = &mut ctx.accounts.agency;
        require!(agency.verified, KaziError::AgencyNotVerified);
        require!(args.amount > 0, KaziError::InvalidAmount);
        let n = args.stage_bps.len();
        require!(n >= 1 && n <= MAX_STAGES, KaziError::InvalidStages);
        let total: u64 = args.stage_bps.iter().map(|b| *b as u64).sum();
        require!(total == BPS, KaziError::InvalidStages);
        let now = Clock::get()?.unix_timestamp;
        require!(args.deadline > now, KaziError::DeadlineInPast);

        let p = &mut ctx.accounts.placement;
        p.agency = agency.key();
        p.id = agency.placements_created;
        p.refund_to = Pubkey::default();
        p.seeker_ref = [0u8; 32];
        p.terms_hash = args.terms_hash;
        p.amount = args.amount;
        p.funded = 0;
        p.released = 0;
        p.deadline = args.deadline;
        p.stage_count = n as u8;
        p.stage_bps = [0; MAX_STAGES];
        for (i, b) in args.stage_bps.iter().enumerate() {
            p.stage_bps[i] = *b;
        }
        p.stages_done = 0;
        p.proof_hashes = [[0u8; 32]; MAX_STAGES];
        p.status = PlacementStatus::Created;
        p.created_at = now;
        p.bump = ctx.bumps.placement;

        agency.placements_created += 1;
        emit!(PlacementCreated { placement: p.key(), agency: p.agency, amount: p.amount, deadline: p.deadline });
        Ok(())
    }

    /// Job seeker (or the M-Pesa ramp paying on their behalf) locks the full fee in the vault.
    /// Whoever pays is who gets refunded, so the agency can never point a refund at itself.
    pub fn fund_placement(ctx: Context<FundPlacement>, seeker_ref: [u8; 32]) -> Result<()> {
        let p = &mut ctx.accounts.placement;
        require!(p.status == PlacementStatus::Created, KaziError::InvalidStatus);
        let now = Clock::get()?.unix_timestamp;
        require!(now < p.deadline, KaziError::DeadlinePassed);

        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.payer_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            p.amount,
            ctx.accounts.mint.decimals,
        )?;
        p.funded = p.amount;
        p.refund_to = ctx.accounts.payer.key();
        p.seeker_ref = seeker_ref;
        p.status = PlacementStatus::Funded;
        emit!(PlacementFunded { placement: p.key(), amount: p.amount });
        Ok(())
    }

    /// Attestor confirms the next stage after checking its proof. Releases that stage's share.
    pub fn confirm_stage(ctx: Context<ConfirmStage>, stage: u8, proof_hash: [u8; 32]) -> Result<()> {
        let p = &mut ctx.accounts.placement;
        require!(p.status == PlacementStatus::Funded, KaziError::InvalidStatus);
        require!(stage == p.stages_done, KaziError::WrongStage);
        let now = Clock::get()?.unix_timestamp;
        require!(now < p.deadline, KaziError::DeadlinePassed);

        let is_last = stage + 1 == p.stage_count;
        let share = if is_last {
            p.amount - p.released
        } else {
            p.amount * p.stage_bps[stage as usize] as u64 / BPS
        };
        let fee = share * ctx.accounts.config.fee_bps as u64 / BPS;
        let to_agency = share - fee;

        let agency_key = p.agency;
        let id_bytes = p.id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"placement", agency_key.as_ref(), &id_bytes, &[p.bump]];
        let signer = &[seeds];

        if to_agency > 0 {
            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.agency_token.to_account_info(),
                        authority: p.to_account_info(),
                    },
                    signer,
                ),
                to_agency,
                ctx.accounts.mint.decimals,
            )?;
        }
        if fee > 0 {
            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                        authority: p.to_account_info(),
                    },
                    signer,
                ),
                fee,
                ctx.accounts.mint.decimals,
            )?;
        }

        p.released += share;
        p.proof_hashes[stage as usize] = proof_hash;
        p.stages_done += 1;

        let agency = &mut ctx.accounts.agency;
        agency.total_released += share;
        if is_last {
            p.status = PlacementStatus::Completed;
            agency.placements_completed += 1;
        }
        emit!(StageConfirmed { placement: p.key(), stage, amount: share, fee, proof_hash });
        Ok(())
    }

    /// After the deadline, anyone can send the unreleased money back to the job seeker.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let p = &mut ctx.accounts.placement;
        require!(p.status == PlacementStatus::Funded, KaziError::InvalidStatus);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= p.deadline, KaziError::DeadlineNotReached);

        let remaining = p.amount - p.released;
        let agency_key = p.agency;
        let id_bytes = p.id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"placement", agency_key.as_ref(), &id_bytes, &[p.bump]];
        if remaining > 0 {
            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.refund_token.to_account_info(),
                        authority: p.to_account_info(),
                    },
                    &[seeds],
                ),
                remaining,
                ctx.accounts.mint.decimals,
            )?;
        }
        p.status = PlacementStatus::Refunded;
        let agency = &mut ctx.accounts.agency;
        agency.placements_refunded += 1;
        agency.total_refunded += remaining;
        emit!(PlacementRefunded { placement: p.key(), amount: remaining });
        Ok(())
    }

    /// Agency can cancel a placement nobody has paid into yet.
    pub fn cancel_unfunded(ctx: Context<CancelUnfunded>) -> Result<()> {
        let p = &mut ctx.accounts.placement;
        require!(p.status == PlacementStatus::Created, KaziError::InvalidStatus);
        p.status = PlacementStatus::Cancelled;
        Ok(())
    }
}

// ---------- accounts ----------

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub attestor: Pubkey,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Agency {
    pub authority: Pubkey,
    #[max_len(64)]
    pub name: String,
    #[max_len(32)]
    pub license_no: String,
    pub verified: bool,
    pub placements_created: u64,
    pub placements_completed: u64,
    pub placements_refunded: u64,
    pub total_released: u64,
    pub total_refunded: u64,
    pub bump: u8,
}

impl Agency {
    pub const MAX_NAME: usize = 64;
    pub const MAX_LICENSE: usize = 32;
}

#[account]
#[derive(InitSpace)]
pub struct Placement {
    pub agency: Pubkey,
    pub id: u64,
    /// Token account owner that receives a refund (seeker wallet, or the ramp wallet for M-Pesa users).
    pub refund_to: Pubkey,
    /// Hash of the seeker's phone number, so the ramp knows whose M-Pesa to refund. No PII onchain.
    pub seeker_ref: [u8; 32],
    /// Hash of the job terms (title, employer, salary, country) agreed off-chain.
    pub terms_hash: [u8; 32],
    pub amount: u64,
    pub funded: u64,
    pub released: u64,
    pub deadline: i64,
    pub created_at: i64,
    pub stage_count: u8,
    pub stage_bps: [u16; MAX_STAGES],
    pub stages_done: u8,
    pub proof_hashes: [[u8; 32]; MAX_STAGES],
    pub status: PlacementStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PlacementStatus {
    Created,
    Funded,
    Completed,
    Refunded,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreatePlacementArgs {
    pub amount: u64,
    pub stage_bps: Vec<u16>,
    pub deadline: i64,
    pub terms_hash: [u8; 32],
}

// ---------- contexts ----------

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(token::mint = mint)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct RegisterAgency<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Agency::INIT_SPACE, seeds = [b"agency", authority.key().as_ref()], bump)]
    pub agency: Account<'info, Agency>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAgencyVerified<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub agency: Account<'info, Agency>,
}

#[derive(Accounts)]
pub struct CreatePlacement<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [b"agency", authority.key().as_ref()], bump = agency.bump, has_one = authority)]
    pub agency: Box<Account<'info, Agency>>,
    #[account(
        init,
        payer = authority,
        space = 8 + Placement::INIT_SPACE,
        seeds = [b"placement", agency.key().as_ref(), &agency.placements_created.to_le_bytes()],
        bump
    )]
    pub placement: Box<Account<'info, Placement>>,
    #[account(address = config.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = placement,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundPlacement<'info> {
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub placement: Box<Account<'info, Placement>>,
    #[account(address = config.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub payer_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = placement, associated_token::token_program = token_program)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ConfirmStage<'info> {
    pub attestor: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = attestor, has_one = treasury)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, address = placement.agency)]
    pub agency: Box<Account<'info, Agency>>,
    #[account(mut)]
    pub placement: Box<Account<'info, Placement>>,
    #[account(address = config.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = placement, associated_token::token_program = token_program)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = mint, token::authority = agency.authority)]
    pub agency_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub treasury: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    /// Anyone can trigger a refund once the deadline has passed.
    pub caller: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, address = placement.agency)]
    pub agency: Box<Account<'info, Agency>>,
    #[account(mut)]
    pub placement: Box<Account<'info, Placement>>,
    #[account(address = config.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = placement, associated_token::token_program = token_program)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = mint, token::authority = placement.refund_to)]
    pub refund_token: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct CancelUnfunded<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"agency", authority.key().as_ref()], bump = agency.bump, has_one = authority)]
    pub agency: Account<'info, Agency>,
    #[account(mut, has_one = agency)]
    pub placement: Account<'info, Placement>,
}

// ---------- events ----------

#[event]
pub struct AgencyVerified {
    pub agency: Pubkey,
    pub verified: bool,
}

#[event]
pub struct PlacementCreated {
    pub placement: Pubkey,
    pub agency: Pubkey,
    pub amount: u64,
    pub deadline: i64,
}

#[event]
pub struct PlacementFunded {
    pub placement: Pubkey,
    pub amount: u64,
}

#[event]
pub struct StageConfirmed {
    pub placement: Pubkey,
    pub stage: u8,
    pub amount: u64,
    pub fee: u64,
    pub proof_hash: [u8; 32],
}

#[event]
pub struct PlacementRefunded {
    pub placement: Pubkey,
    pub amount: u64,
}

// ---------- errors ----------

#[error_code]
pub enum KaziError {
    #[msg("Fee is above the 5% cap")]
    FeeTooHigh,
    #[msg("Text is too long")]
    TooLong,
    #[msg("Agency is not verified")]
    AgencyNotVerified,
    #[msg("Amount must be above zero")]
    InvalidAmount,
    #[msg("Stages must be 1 to 4 and add up to 100%")]
    InvalidStages,
    #[msg("Deadline must be in the future")]
    DeadlineInPast,
    #[msg("Placement is not in the right status for this")]
    InvalidStatus,
    #[msg("Stages must be confirmed in order")]
    WrongStage,
    #[msg("Deadline has passed")]
    DeadlinePassed,
    #[msg("Deadline has not passed yet")]
    DeadlineNotReached,
}
