#![no_std]

//! FCToken — FundChain Reward Token (FCT)
//! SEP-41 compatible token. Only the FundChain contract can mint.

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, String,
    symbol_short,
};

#[contracttype]
pub enum DataKey {
    Admin,
    Minter,
    Balance(Address),
    TotalSupply,
    Initialized,
}

#[contract]
pub struct FCTokenContract;

#[contractimpl]
impl FCTokenContract {

    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        let already: bool = env.storage().instance()
            .get(&DataKey::Initialized).unwrap_or(false);
        assert!(!already, "Already initialised");
        env.storage().instance().set(&DataKey::Admin,       &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0_i128);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    pub fn set_minter(env: Env, minter: Address) {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin).expect("Not initialised");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Minter, &minter);
        env.events().publish((symbol_short!("minter"),), minter);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        assert!(amount > 0, "Amount must be greater than 0");
        let minter: Address = env.storage().instance()
            .get(&DataKey::Minter).expect("Minter not set");
        minter.require_auth();
        let key     = DataKey::Balance(to.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));
        let supply: i128 = env.storage().instance()
            .get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(supply + amount));
        env.events().publish((symbol_short!("mint"), to), amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn name(_env: Env) -> String {
        String::from_str(&_env, "FundChain Token")
    }

    pub fn symbol(_env: Env) -> String {
        String::from_str(&_env, "FCT")
    }

    pub fn decimals(_env: Env) -> u32 { 7 }

    pub fn admin(env: Env) -> Address {
        env.storage().instance()
            .get(&DataKey::Admin)
            .expect("Not initialised")
    }

    pub fn minter(env: Env) -> Address {
        env.storage().instance()
            .get(&DataKey::Minter)
            .expect("Minter not set")
    }
}

#[cfg(test)]
mod test;