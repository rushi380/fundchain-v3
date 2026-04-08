#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Env, Address, String,
};

fn s(env: &Env, val: &str) -> String { String::from_str(env, val) }

// Dummy FCToken for tests
#[soroban_sdk::contract]
struct DummyFCToken;
#[soroban_sdk::contractimpl]
impl DummyFCToken {
    pub fn mint(_env: soroban_sdk::Env, _to: Address, _amount: i128) {}
}

fn setup() -> (Env, FundChainContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let fctoken_id = env.register_contract(None, DummyFCToken);
    let fc_id      = env.register_contract(None, FundChainContract);
    let fc_client  = FundChainContractClient::new(&env, &fc_id);
    fc_client.initialize(&fctoken_id);
    (env, fc_client)
}

// ── Campaign creation ─────────────────────────────────────────────────────────

#[test]
fn test_create_returns_zero_for_first() {
    let (env, c) = setup();
    let id = c.create_campaign(
        &Address::generate(&env),
        &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &30
    );
    assert_eq!(id, 0);
}

#[test]
fn test_milestones_initialized_correctly() {
    let (env, c) = setup();
    let owner = Address::generate(&env);
    c.create_campaign(&owner, &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &30);
    let camp = c.get_campaign(&0);
    assert_eq!(camp.milestone1.percent,    30);
    assert_eq!(camp.milestone2.percent,    60);
    assert_eq!(camp.milestone3.percent,    100);
    assert_eq!(camp.milestone1.amount_xlm, 300);
    assert_eq!(camp.milestone2.amount_xlm, 300);
    assert_eq!(camp.milestone3.amount_xlm, 400);
}

#[test]
#[should_panic(expected = "Goal must be greater than 0")]
fn test_create_zero_goal_panics() {
    let (env, c) = setup();
    c.create_campaign(&Address::generate(&env), &s(&env,"X"), &s(&env,"D"), &0, &7);
}

// ── Milestone progression ─────────────────────────────────────────────────────

#[test]
fn test_milestone1_reached_at_30_percent() {
    let (env, c) = setup();
    let owner  = Address::generate(&env);
    let backer = Address::generate(&env);
    c.create_campaign(&owner, &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &30);
    c.contribute(&0, &backer, &300);
    let camp = c.get_campaign(&0);
    assert_eq!(camp.milestone1.status, MilestoneStatus::Reached);
    assert_eq!(camp.milestone2.status, MilestoneStatus::Locked);
    assert_eq!(camp.milestone3.status, MilestoneStatus::Locked);
}

#[test]
fn test_milestone2_reached_at_60_percent() {
    let (env, c) = setup();
    let owner  = Address::generate(&env);
    let backer = Address::generate(&env);
    c.create_campaign(&owner, &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &30);
    c.contribute(&0, &backer, &600);
    let camp = c.get_campaign(&0);
    assert_eq!(camp.milestone1.status, MilestoneStatus::Reached);
    assert_eq!(camp.milestone2.status, MilestoneStatus::Reached);
    assert_eq!(camp.milestone3.status, MilestoneStatus::Locked);
}

#[test]
fn test_all_milestones_reached_at_100_percent() {
    let (env, c) = setup();
    let owner  = Address::generate(&env);
    let backer = Address::generate(&env);
    c.create_campaign(&owner, &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &30);
    c.contribute(&0, &backer, &1000);
    let camp = c.get_campaign(&0);
    assert_eq!(camp.milestone1.status, MilestoneStatus::Reached);
    assert_eq!(camp.milestone2.status, MilestoneStatus::Reached);
    assert_eq!(camp.milestone3.status, MilestoneStatus::Reached);
}

// ── Milestone release ─────────────────────────────────────────────────────────

#[test]
fn test_release_milestone1() {
    let (env, c) = setup();
    let owner  = Address::generate(&env);
    let backer = Address::generate(&env);
    c.create_campaign(&owner, &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &30);
    c.contribute(&0, &backer, &300);
    c.release_milestone(&0, &0);
    let camp = c.get_campaign(&0);
    assert_eq!(camp.milestone1.status, MilestoneStatus::Released);
}

#[test]
fn test_all_milestones_released_marks_withdrawn() {
    let (env, c) = setup();
    let owner  = Address::generate(&env);
    let backer = Address::generate(&env);
    c.create_campaign(&owner, &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &30);
    c.contribute(&0, &backer, &1000);
    c.release_milestone(&0, &0);
    c.release_milestone(&0, &1);
    c.release_milestone(&0, &2);
    let camp = c.get_campaign(&0);
    assert_eq!(camp.withdrawn, true);
}

#[test]
#[should_panic(expected = "Milestone not reached yet or already released")]
fn test_release_locked_milestone_panics() {
    let (env, c) = setup();
    let owner = Address::generate(&env);
    c.create_campaign(&owner, &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &30);
    c.release_milestone(&0, &0); // milestone1 not reached yet
}

// ── Refund ────────────────────────────────────────────────────────────────────

#[test]
fn test_refund_when_goal_not_met() {
    let (env, c) = setup();
    let owner  = Address::generate(&env);
    let backer = Address::generate(&env);
    c.create_campaign(&owner, &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &1);
    c.contribute(&0, &backer, &200);
    env.ledger().with_mut(|l| l.sequence_number = 999_999);
    c.refund(&0, &backer);
    assert_eq!(c.get_contribution(&0, &backer), 0);
}

#[test]
#[should_panic(expected = "Campaign is still active")]
fn test_refund_before_deadline_panics() {
    let (env, c) = setup();
    let owner  = Address::generate(&env);
    let backer = Address::generate(&env);
    c.create_campaign(&owner, &s(&env,"Solar Grid"), &s(&env,"Desc"), &1000, &30);
    c.contribute(&0, &backer, &200);
    c.refund(&0, &backer);
}