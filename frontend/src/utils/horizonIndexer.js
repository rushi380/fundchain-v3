/**
 * horizonIndexer.js
 * Queries Stellar Horizon API directly — no extra setup needed.
 * Used for data indexing, user wallet verification, and metrics.
 *
 * Horizon Testnet base URL: https://horizon-testnet.stellar.org
 */

const HORIZON = 'https://horizon-testnet.stellar.org';

// ── Account data ──────────────────────────────────────────────────────────────

/**
 * Get XLM balance for a Stellar address.
 */
export async function getAccountBalance(address) {
  try {
    const resp = await fetch(`${HORIZON}/accounts/${address}`);
    if (!resp.ok) return '0.00';
    const data   = await resp.json();
    const native = data.balances?.find(b => b.asset_type === 'native');
    return native ? parseFloat(native.balance).toFixed(2) : '0.00';
  } catch { return '0.00'; }
}

/**
 * Check if an account exists and is funded on testnet.
 */
export async function isAccountFunded(address) {
  try {
    const resp = await fetch(`${HORIZON}/accounts/${address}`);
    return resp.ok;
  } catch { return false; }
}

// ── Contract operations ───────────────────────────────────────────────────────

/**
 * Get all operations for a contract address.
 * Used to index all campaign transactions.
 */
export async function getContractOperations(contractId, limit = 50) {
  try {
    const resp = await fetch(
      `${HORIZON}/accounts/${contractId}/operations?limit=${limit}&order=desc`
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data._embedded?.records ?? [];
  } catch { return []; }
}

/**
 * Get all transactions for a contract.
 */
export async function getContractTransactions(contractId, limit = 50) {
  try {
    const resp = await fetch(
      `${HORIZON}/accounts/${contractId}/transactions?limit=${limit}&order=desc`
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data._embedded?.records ?? [];
  } catch { return []; }
}

/**
 * Get a single transaction by hash.
 * Use this to verify and display transaction details.
 */
export async function getTransaction(txHash) {
  try {
    const resp = await fetch(`${HORIZON}/transactions/${txHash}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

// ── Network stats ─────────────────────────────────────────────────────────────

/**
 * Get current Stellar testnet ledger info.
 */
export async function getLedgerStats() {
  try {
    const resp = await fetch(`${HORIZON}/ledgers?limit=1&order=desc`);
    if (!resp.ok) return null;
    const data   = await resp.json();
    const latest = data._embedded?.records?.[0];
    if (!latest) return null;
    return {
      sequence:       latest.sequence,
      closedAt:       latest.closed_at,
      txCount:        latest.transaction_count,
      operationCount: latest.operation_count,
    };
  } catch { return null; }
}

// ── User wallet indexing ──────────────────────────────────────────────────────

/**
 * Verify a list of wallet addresses on Stellar testnet.
 * Returns array of { address, funded, balance } for each.
 * Used for the 30+ user wallet verification requirement.
 */
export async function verifyWalletAddresses(addresses) {
  const results = await Promise.allSettled(
    addresses.map(async (address) => {
      const resp = await fetch(`${HORIZON}/accounts/${address}`);
      if (!resp.ok) return { address, funded: false, balance: '0.00' };
      const data   = await resp.json();
      const native = data.balances?.find(b => b.asset_type === 'native');
      return {
        address,
        funded:  true,
        balance: native ? parseFloat(native.balance).toFixed(2) : '0.00',
      };
    })
  );
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { address: addresses[i], funded: false, balance: '0.00' }
  );
}

/**
 * Get payments received by an address.
 * Used to verify contributions from specific users.
 */
export async function getPayments(address, limit = 20) {
  try {
    const resp = await fetch(
      `${HORIZON}/accounts/${address}/payments?limit=${limit}&order=desc`
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data._embedded?.records ?? [];
  } catch { return []; }
}

// ── Metrics aggregation ───────────────────────────────────────────────────────

/**
 * Build live metrics from Horizon data + local campaign list.
 * Called by the Dashboard page.
 */
export async function buildMetrics(campaigns, fundchainContractId) {
  const [ledger, ops] = await Promise.all([
    getLedgerStats(),
    getContractOperations(fundchainContractId, 200),
  ]);

  const totalRaised    = campaigns.reduce((s, c) => s + (c.raised || 0), 0);
  const totalFCT       = campaigns.reduce((s, c) => s + (c.tokenMinted || 0), 0);
  const totalBackers   = campaigns.reduce((s, c) => s + (c.backers || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.daysLeft > 0).length;
  const fundedCampaigns = campaigns.filter(c => c.raised >= c.goal).length;
  const successRate    = campaigns.length
    ? ((fundedCampaigns / campaigns.length) * 100).toFixed(0)
    : 0;

  // Count unique backers from contributions
  const allAddresses = new Set();
  campaigns.forEach(c =>
    (c.contributions || []).forEach(x => allAddresses.add(x.addr))
  );

  return {
    totalCampaigns:   campaigns.length,
    activeCampaigns,
    fundedCampaigns,
    totalRaised,
    totalFCT,
    totalBackers:     allAddresses.size || totalBackers,
    successRate,
    txCount:          ops.length,
    currentLedger:    ledger?.sequence ?? '—',
    lastUpdated:      new Date().toLocaleTimeString(),
  };
}