#![no_std]

//! FundChain v3 — Milestone-Based Crowdfunding
//!
//! ADVANCED FEATURE: Milestone-based funding
//! Funds are released in 3 stages instead of one lump sum:
//!   Milestone 1 → released when 30% of goal is raised
//!   Milestone 2 → released when 60% of goal is raised
//!   Milestone 3 → released when 100% of goal is reached
//!
//! INTER-CONTRACT CALL: contribute() calls FCToken.mint()
//! Every XLM contributed mints 1 FCT reward token to the backer.

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, String,
    symbol_short,
};

// ── FCToken interface for inter-contract call ─────────────────────────────────
mod fctoken {
    use soroban_sdk::{contractclient, Address, Env};
    #[contractclient(name = "FCTokenClient")]
    pub trait FCToken {
        fn mint(env: Env, to: Address, amount: i128);
    }
}
use fctoken::FCTokenClient;

// ── Storage keys ──────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Campaign(u64),
    CampaignCount,
    Contribution(u64, Address),
    FCTokenAddress,
}

// ── Milestone state ───────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum MilestoneStatus {
    Locked,    // not yet reached
    Reached,   // goal % reached, ready to release
    Released,  // funds already released to owner
}

#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    pub index:       u32,   // 0, 1, 2
    pub percent:     u32,   // 30, 60, 100
    pub status:      MilestoneStatus,
    pub amount_xlm:  i128,  // XLM released at this milestone
}

// ── Campaign struct ───────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct Campaign {
    pub id:           u64,
    pub owner:        Address,
    pub title:        String,
    pub description:  String,
    pub goal:         i128,     // whole XLM
    pub raised:       i128,     // whole XLM
    pub deadline:     u32,      // ledger sequence
    pub withdrawn:    bool,
    pub token_minted: i128,     // total FCT minted
    pub milestone1:   Milestone,
    pub milestone2:   Milestone,
    pub milestone3:   Milestone,
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct FundChainContract;

#[contractimpl]
impl FundChainContract {

    // ── Init ──────────────────────────────────────────────────────────────────
    pub fn initialize(env: Env, fctoken_address: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::FCTokenAddress),
            "Already initialised"
        );
        env.storage().instance().set(&DataKey::FCTokenAddress, &fctoken_address);
    }

    // ── Create campaign with milestones ───────────────────────────────────────
    /// Creates a campaign with 3 automatic milestones:
    ///   M1 = 30% of goal, M2 = 60% of goal, M3 = 100% of goal
    pub fn create_campaign(
        env:           Env,
        owner:         Address,
        title:         String,
        description:   String,
        goal_xlm:      i128,
        duration_days: u32,
    ) -> u64 {
        owner.require_auth();
        assert!(goal_xlm > 0,       "Goal must be greater than 0");
        assert!(duration_days > 0,  "Duration must be greater than 0");
        assert!(duration_days <= 90, "Duration max is 90 days");

        let duration_ledgers = duration_days * 17_280;
        let id = Self::next_id(&env);

        // Calculate milestone amounts
        let m1_amount = (goal_xlm * 30) / 100;
        let m2_amount = (goal_xlm * 30) / 100;
        let m3_amount = goal_xlm - m1_amount - m2_amount;

        let campaign = Campaign {
            id,
            owner,
            title,
            description,
            goal:         goal_xlm,
            raised:       0,
            deadline:     env.ledger().sequence() + duration_ledgers,
            withdrawn:    false,
            token_minted: 0,
            milestone1: Milestone {
                index: 0, percent: 30,
                status: MilestoneStatus::Locked,
                amount_xlm: m1_amount,
            },
            milestone2: Milestone {
                index: 1, percent: 60,
                status: MilestoneStatus::Locked,
                amount_xlm: m2_amount,
            },
            milestone3: Milestone {
                index: 2, percent: 100,
                status: MilestoneStatus::Locked,
                amount_xlm: m3_amount,
            },
        };

        env.storage().persistent().set(&DataKey::Campaign(id), &campaign);
        env.events().publish((symbol_short!("created"), id), goal_xlm);
        id
    }

    // ── Contribute + inter-contract call to FCToken ───────────────────────────
    pub fn contribute(
        env:         Env,
        campaign_id: u64,
        backer:      Address,
        amount_xlm:  i128,
    ) {
        backer.require_auth();
        assert!(amount_xlm > 0, "Amount must be greater than 0");

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign does not exist");

        assert!(
            env.ledger().sequence() < campaign.deadline,
            "Campaign has ended"
        );

        // Record contribution
        let key = DataKey::Contribution(campaign_id, backer.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(prev + amount_xlm));

        campaign.raised       += amount_xlm;
        campaign.token_minted += amount_xlm;

        // Update milestone statuses based on new raised amount
        let pct = (campaign.raised * 100) / campaign.goal;
        if pct >= 30 && campaign.milestone1.status == MilestoneStatus::Locked {
            campaign.milestone1.status = MilestoneStatus::Reached;
            env.events().publish((symbol_short!("m1reach"), campaign_id), campaign.raised);
        }
        if pct >= 60 && campaign.milestone2.status == MilestoneStatus::Locked {
            campaign.milestone2.status = MilestoneStatus::Reached;
            env.events().publish((symbol_short!("m2reach"), campaign_id), campaign.raised);
        }
        if pct >= 100 && campaign.milestone3.status == MilestoneStatus::Locked {
            campaign.milestone3.status = MilestoneStatus::Reached;
            env.events().publish((symbol_short!("m3reach"), campaign_id), campaign.raised);
        }

        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        // ── INTER-CONTRACT CALL ───────────────────────────────────────────────
        // Mint FCT reward tokens to backer — 1 XLM = 1 FCT
        let fctoken_addr: Address = env.storage().instance()
            .get(&DataKey::FCTokenAddress)
            .expect("FCToken not set — call initialize first");
        let fctoken = FCTokenClient::new(&env, &fctoken_addr);
        fctoken.mint(&backer, &amount_xlm);
        // ── END INTER-CONTRACT CALL ───────────────────────────────────────────

        env.events().publish(
            (symbol_short!("funded"), campaign_id),
            (backer, amount_xlm)
        );
    }

    // ── Release milestone ─────────────────────────────────────────────────────
    /// Owner releases funds for a specific milestone (0, 1, or 2).
    /// Milestone must be in Reached status — not Locked or already Released.
    pub fn release_milestone(env: Env, campaign_id: u64, milestone_index: u32) {
        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign does not exist");

        campaign.owner.require_auth();
        assert!(milestone_index <= 2, "Milestone index must be 0, 1, or 2");

        let milestone = match milestone_index {
            0 => &mut campaign.milestone1,
            1 => &mut campaign.milestone2,
            _ => &mut campaign.milestone3,
        };

        assert!(
            milestone.status == MilestoneStatus::Reached,
            "Milestone not reached yet or already released"
        );

        milestone.status = MilestoneStatus::Released;

        // Check if all milestones released — mark campaign withdrawn
        if campaign.milestone1.status == MilestoneStatus::Released &&
           campaign.milestone2.status == MilestoneStatus::Released &&
           campaign.milestone3.status == MilestoneStatus::Released {
            campaign.withdrawn = true;
        }

        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.events().publish(
            (symbol_short!("mrelease"), campaign_id),
            milestone_index
        );
    }

    // ── Refund ────────────────────────────────────────────────────────────────
    pub fn refund(env: Env, campaign_id: u64, backer: Address) {
        backer.require_auth();

        let mut campaign: Campaign = env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign does not exist");

        assert!(
            env.ledger().sequence() >= campaign.deadline,
            "Campaign is still active"
        );
        assert!(
            campaign.raised < campaign.goal,
            "Goal was reached — no refund available"
        );

        let key: DataKey = DataKey::Contribution(campaign_id, backer.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        assert!(amount > 0, "No contribution to refund");

        env.storage().persistent().set(&key, &0_i128);
        campaign.raised -= amount;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.events().publish(
            (symbol_short!("refunded"), campaign_id),
            (backer, amount)
        );
    }

    // ── Read functions ────────────────────────────────────────────────────────

    pub fn get_campaign(env: Env, campaign_id: u64) -> Campaign {
        env.storage().persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign does not exist")
    }

    pub fn get_contribution(env: Env, campaign_id: u64, backer: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::Contribution(campaign_id, backer))
            .unwrap_or(0)
    }

    pub fn get_campaign_count(env: Env) -> u64 {
        env.storage().persistent()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0)
    }

    pub fn get_fctoken_address(env: Env) -> Address {
        env.storage().instance()
            .get(&DataKey::FCTokenAddress)
            .expect("Not initialised")
    }

    // ── Internal ──────────────────────────────────────────────────────────────
    fn next_id(env: &Env) -> u64 {
        let count: u64 = env.storage().persistent()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0);
        env.storage().persistent()
            .set(&DataKey::CampaignCount, &(count + 1));
        count
    }
}

#[cfg(test)]
mod test;