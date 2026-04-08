# FundChain v3 — Security Checklist

## Smart Contract Security

### Authentication
- [x] `require_auth()` called on all state-changing functions
  - `create_campaign()` — owner must sign
  - `contribute()` — backer must sign
  - `release_milestone()` — owner must sign
  - `refund()` — backer must sign
  - `FCToken.initialize()` — admin must sign
  - `FCToken.set_minter()` — admin must sign
  - `FCToken.mint()` — minter (FundChain contract) must sign

### Input Validation
- [x] `goal_xlm > 0` — zero goal rejected
- [x] `amount_xlm > 0` — zero contribution rejected
- [x] `duration_days > 0` and `<= 90` — invalid duration rejected
- [x] `milestone_index <= 2` — out of range index rejected
- [x] Campaign existence checked before every operation
- [x] Contribution existence checked before refund

### Integer Safety
- [x] No floats in contracts — all amounts are `i128` whole integers
- [x] `overflow-checks = true` in release profile
- [x] Milestone amounts computed with integer division, remainder allocated to M3
- [x] All arithmetic uses checked operations via overflow-checks

### Access Control
- [x] Only FundChain contract can call `FCToken.mint()` via `set_minter()`
- [x] Only campaign owner can call `release_milestone()`
- [x] Only FCToken admin can call `set_minter()`
- [x] Double-initialization prevented via `Initialized` storage key

### State Machine
- [x] Milestone status: Locked → Reached → Released (one-way)
- [x] Cannot release a Locked milestone
- [x] Cannot release an already Released milestone
- [x] Refund only available after deadline AND goal not met
- [x] `withdrawn = true` only after all 3 milestones Released

### Deadline Handling
- [x] Ledger sequence used for deadlines (not wall-clock time)
- [x] `contribute()` blocked after deadline
- [x] `refund()` blocked before deadline

### Storage
- [x] Persistent storage used for campaigns and contributions
- [x] Instance storage used for global config (FCToken address, admin)
- [x] No sensitive data stored on-chain

---

## Frontend Security

### Wallet
- [x] Private keys never handled — all signing done in Freighter
- [x] Network validation — blocks wrong network connections
- [x] No wallet credentials stored in localStorage

### Input Handling
- [x] `parseInt()` used before every `BigInt()` conversion
- [x] NaN checks before all numeric operations
- [x] Demo campaigns blocked from contract calls
- [x] Max amount validation (prevents overflow)

### Dependencies
- [x] `@stellar/stellar-sdk` — official Stellar SDK
- [x] `@stellar/freighter-api` — official Freighter wallet API
- [x] No unaudited third-party dependencies

---

## Deployment Security

### Testnet Only
- [x] All contracts deployed on Stellar Testnet
- [x] No real XLM at risk
- [x] Friendbot used for test funding

### Contract Initialization
- [x] FCToken initialized with deployer as admin
- [x] FundChain initialized with FCToken address
- [x] `set_minter()` called to restrict minting to FundChain only

---

## Known Limitations (Testnet)

- Storage TTL not handled — persistent storage may expire on long-idle testnet
- No rate limiting on campaign creation
- No maximum campaign goal validation
- Milestone amounts use integer floor — small rounding to M3 is expected

---

*Last updated: March 2026*
*Audited by: Self-review*