#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Env, Address};

fn setup() -> (Env, FCTokenContractClient<'static>, Address) {
    let env    = Env::default();
    env.mock_all_auths();
    let id     = env.register_contract(None, FCTokenContract);
    let client = FCTokenContractClient::new(&env, &id);
    let admin  = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn test_initialize_sets_admin() {
    let (_, client, admin) = setup();
    assert_eq!(client.admin(), admin);
}

#[test]
fn test_mint_and_balance() {
    let (env, client, _) = setup();
    let minter = Address::generate(&env);
    let backer = Address::generate(&env);
    client.set_minter(&minter);
    client.mint(&backer, &100);
    assert_eq!(client.balance(&backer), 100);
    assert_eq!(client.total_supply(),   100);
}

#[test]
fn test_total_supply_accumulates() {
    let (env, client, _) = setup();
    let minter = Address::generate(&env);
    client.set_minter(&minter);
    client.mint(&Address::generate(&env), &50);
    client.mint(&Address::generate(&env), &75);
    assert_eq!(client.total_supply(), 125);
}

#[test]
#[should_panic(expected = "Already initialised")]
fn test_double_init_panics() {
    let (env, client, admin) = setup();
    client.initialize(&admin);
}

#[test]
#[should_panic(expected = "Amount must be greater than 0")]
fn test_mint_zero_panics() {
    let (env, client, _) = setup();
    let minter = Address::generate(&env);
    client.set_minter(&minter);
    client.mint(&Address::generate(&env), &0);
}