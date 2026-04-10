# ⛓ FundChain v3 — Production-Ready Milestone Crowdfunding

> Advanced crowdfunding on Stellar Soroban with milestone-based fund release, FCT reward tokens, live metrics dashboard, and Horizon API data indexing.

---

## 📊 Website Dashboard:

<img width="1919" height="973" alt="image" src="https://github.com/user-attachments/assets/f236d016-00cb-4954-b9b9-cd0e3b1e0320" />

---

## 🌐 Live Demo

🔗 **fundchain-v3.vercel.app**

---

## 🎥 Demo Video

📹 **[Watch demo](https://www.loom.com/share/982f2970167f4e328507cf0d1e0dc311)**

---

## 📸 Test Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FundChain v3 — Test Suite  (10 tests)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅  1. Campaign created with 3 locked milestones
  ✅  2. Milestone amounts sum to total goal
  ✅  3. Milestone 1 reaches Reached at 30% funded
  ✅  4. All milestones reach Reached at 100% funded
  ✅  5. Releasing milestone 1 sets it to Released
  ✅  6. Releasing all milestones marks campaign withdrawn
  ✅  7. Cannot release locked milestone
  ✅  8. FCT reward equals XLM contributed (1:1)
  ✅  9. Contribution fails on ended campaign
  ✅  10. Campaign filtering works correctly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  10 passed  |  0 failed  |  10 total
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📊 Metrics Dashboard

<img width="1919" height="891" alt="Screenshot 2026-04-10 164009" src="https://github.com/user-attachments/assets/53ac1286-26c6-4c62-bc31-449612c97f4d" />

---

## 📊 Monitoring Dashboard

<img width="1919" height="973" alt="Screenshot 2026-04-10 155543" src="https://github.com/user-attachments/assets/9924a081-013f-497c-b1f1-bea67a3718ee" />

---

## 📱 Mobile Responsive

Fully responsive across all screen sizes with CSS breakpoints.

![WhatsApp Image 2026-04-10 at 4 15 09 PM](https://github.com/user-attachments/assets/bc02b8bb-af58-4601-a092-d37224c1a419)

---

## ⚙️ CI/CD Pipeline

GitHub Actions runs automatically on every push to `main`.

<img width="1896" height="971" alt="image" src="https://github.com/user-attachments/assets/5eeda55f-7f39-4e73-bc6a-1a1f0f2fb55d" />


---

## 🔐 Security Checklist

📄 **[View full security checklist](./docs/SECURITY.md)**

Key items:
- `require_auth()` on all state-changing contract functions
- Integer overflow protection via `overflow-checks = true`
- Only FundChain contract can mint FCT tokens
- Milestone state machine: Locked → Reached → Released (one-way)
- Input validation on all parameters

---

## 👥 Verified User Wallets (30+)

| # | Wallet Address | Stellar Explorer |
|---|----------------|-----------------|
| 1  | GADY24FFOBCTVQJIBCP6OCX6QPVODAQM4IEMYUKS5VSVN564XQPSWXGY  | [View](https://stellar.expert/explorer/testnet/account/GADY24FFOBCTVQJIBCP6OCX6QPVODAQM4IEMYUKS5VSVN564XQPSWXGY) |
| 2  | GCATAASNFHODIKA4VTIEZHONZB3BGZJL42FXHHZ3VS6YKX2PCDIJ3LDY  | [View](https://stellar.expert/explorer/testnet/account/GCATAASNFHODIKA4VTIEZHONZB3BGZJL42FXHHZ3VS6YKX2PCDIJ3LDY) |
| 3  | GCZXHLXNKRQZ7FA3MV575L2OZ7UCYCMZCKKMBZN64MQ2XTD2TFCYHP2V  | [View](https://stellar.expert/explorer/testnet/account/GCZXHLXNKRQZ7FA3MV575L2OZ7UCYCMZCKKMBZN64MQ2XTD2TFCYHP2V) |
| 4  | GCHB2KGFMWFAM7HOQYUFNPQXAQMAY6U7OLXAP4BEJWIJWXBV6IDKB7DR  | [View](https://stellar.expert/explorer/testnet/account/GCHB2KGFMWFAM7HOQYUFNPQXAQMAY6U7OLXAP4BEJWIJWXBV6IDKB7DR) |
| 5  | GBXU3XKT5W66VJOTZBEINMAXQYGJ7HYNFWITQQ6VQKZBHDQ2EX5ACG2F  | [View](https://stellar.expert/explorer/testnet/account/GBXU3XKT5W66VJOTZBEINMAXQYGJ7HYNFWITQQ6VQKZBHDQ2EX5ACG2F) |

> Added 30+ real wallet addresses and users details:
👉 **[User Onboarding & Details Form](https://docs.google.com/spreadsheets/d/1OTEPNE6nxbRn4Nn_jgYRBvbFKJb1t6JJ-trwS7Disqo/edit?usp=sharing)**

---

## 🐦 Community Contribution

📣 **[Twitter/X Post](https://x.com/RushikesGaiwal/status/2042643752070910399?s=20)**

> Post about FundChain Pro on Twitter with your Vercel link to satisfy the community contribution requirement.

---

## ⚡ Advanced Feature — Milestone-Based Funding

Instead of one lump withdrawal, funds release in 3 automatic stages:

```
Milestone 1 → 30% of goal raised → owner can release 30% of funds
Milestone 2 → 60% of goal raised → owner can release next 30% of funds
Milestone 3 → 100% of goal raised → owner can release final 40% of funds
```

**How it works in the contract:**
```rust
// On every contribution, milestone statuses update automatically
let pct = (campaign.raised * 100) / campaign.goal;
if pct >= 30 && campaign.milestone1.status == MilestoneStatus::Locked {
    campaign.milestone1.status = MilestoneStatus::Reached;
}
```

**Owner releases funds per stage:**
```rust
pub fn release_milestone(env: Env, campaign_id: u64, milestone_index: u32) {
    // Verifies milestone is Reached, then sets to Released
    // All 3 Released → campaign.withdrawn = true
}
```

This protects backers — campaign owners cannot take all funds upfront.

---

## 🗄 Data Indexing — Stellar Horizon API

All metrics are indexed directly from Stellar Testnet via the **Horizon REST API**.
No separate database or indexer needed.

**Endpoint:** `https://horizon-testnet.stellar.org`

**Queries used:**
```
GET /accounts/{contract_id}/operations   → index all transactions
GET /accounts/{contract_id}/transactions → get tx history
GET /accounts/{address}                  → verify user wallets
GET /ledgers?limit=1&order=desc          → current ledger stats
```

**Implementation:** `frontend/src/utils/horizonIndexer.js`

---

## 📋 Contract Addresses

| Contract | Address |
|---|---|
| FundChain v3 | `CBMSNPGDUF4B3FROZ3UFFWXXY55O5MDKGAKSOOAAOCGYHFWAZGAKMQLK` |
| FCToken (FCT) | `CAG6OKIXAMOJSMTJRUJSTNMWXSVI4C6JV4EHMKAFBZOS4QDSERJES7EI` |

---



## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Contract 1 | Rust + Soroban SDK 23.4.1 — FundChain (milestone funding) |
| Contract 2 | Rust + Soroban SDK 23.4.1 — FCToken (SEP-41 reward token) |
| Data Indexing | Stellar Horizon REST API |
| Frontend | Vite 5 + Vanilla JavaScript |
| Wallet | Freighter v2 |
| SDK | @stellar/stellar-sdk 14.5.0 |
| CI/CD | GitHub Actions |
| Monitoring | UptimeRobot |
| Deployment | Vercel |

---

## 🚀 Local Setup

```bash
# 1. Install tools
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none
cargo install stellar-cli --features opt

# 2. Setup testnet identity
stellar network add --global testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
stellar keys generate --global deployer --network testnet --fund

# 3. Build contracts
cd contracts
stellar contract build

# 4. Deploy FCToken
stellar contract deploy \
  --wasm target/wasm32v1-none/release/fctoken.wasm \
  --source deployer --network testnet --alias fctoken

# 5. Initialize FCToken
stellar contract invoke --id fctoken --source deployer --network testnet \
  -- initialize --admin $(stellar keys address deployer)

# 6. Deploy FundChain
stellar contract deploy \
  --wasm target/wasm32v1-none/release/fundchain.wasm \
  --source deployer --network testnet --alias fundchain

# 7. Initialize FundChain with FCToken address
stellar contract invoke --id fundchain --source deployer --network testnet \
  -- initialize --fctoken_address $(stellar contract id alias fctoken)

# 8. Set FundChain as FCToken minter
stellar contract invoke --id fctoken --source deployer --network testnet \
  -- set_minter --minter $(stellar contract id alias fundchain)

# 9. Paste contract IDs into frontend JSON files

# 10. Run frontend
cd ../frontend && npm install && npm run dev

# 11. Run tests
node tests/fundchain.test.js
```

---

## 🔄 Improvement Plan (based on user feedback)

**Issues**
- Slow wallet connection  
- Mobile UI problems  
- No notifications  

**Fix (v3.1)**
- Improved wallet connection  
- Added loading + error messages  

**Next**
- Notifications  
- UI improvements  
- Performance optimization
    
---

## 👤 Author

**Rushikesh** — [@rushi380](https://github.com/rushi380)

---

## 📄 License

MIT
