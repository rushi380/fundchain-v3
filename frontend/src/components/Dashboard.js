/**
 * Dashboard.js — Live metrics dashboard
 * Pulls data from Stellar Horizon API via horizonIndexer.js
 */
import { store, loadMetrics, showToast } from '../utils/store.js';
import fundchainConfig from '../contracts/FundChain.json';
import fctokenConfig   from '../contracts/FCToken.json';

export function renderDashboard(s) {
  const { metrics, metricsLoading, campaigns, fctTotalSupply } = s;

  const totalRaised  = campaigns.reduce((a,c) => a+(c.raised||0), 0);
  const totalBackers = new Set(campaigns.flatMap(c => (c.contributions||[]).map(x=>x.addr))).size;
  const activeCamps  = campaigns.filter(c => c.daysLeft > 0).length;
  const fundedCamps  = campaigns.filter(c => c.raised >= c.goal).length;

  return `
    <div style="max-width:900px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
        <div>
          <div class="section-title">📊 Live Metrics Dashboard</div>
          <div style="font-size:.72rem;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:.25rem">
            Data indexed via Stellar Horizon API · ${metrics?.lastUpdated ?? 'Loading...'}
          </div>
        </div>
        <button class="btn btn-outline btn-sm" id="refresh-metrics-btn">↻ Refresh</button>
      </div>

      <!-- Key metrics grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin-bottom:2rem">
        ${_metricCard('Total Campaigns', campaigns.length, '')}
        ${_metricCard('Active Campaigns', activeCamps, '')}
        ${_metricCard('Total XLM Raised', totalRaised.toLocaleString(), 'XLM')}
        ${_metricCard('FCT Tokens Minted', fctTotalSupply.toLocaleString(), 'FCT')}
        ${_metricCard('Unique Backers', totalBackers, '')}
        ${_metricCard('Success Rate', campaigns.length ? ((fundedCamps/campaigns.length)*100).toFixed(0) : 0, '%')}
        ${_metricCard('Current Ledger', metrics?.currentLedger ?? '—', '')}
        ${_metricCard('On-chain Tx', metrics?.txCount ?? '—', '')}
      </div>

      <!-- Contract addresses -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:1.25rem;margin-bottom:1.5rem">
        <div style="font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace;letter-spacing:.08em;margin-bottom:.875rem">CONTRACT ADDRESSES — STELLAR TESTNET</div>
        <div style="display:grid;gap:.75rem">
          ${_contractRow('FundChain v3', fundchainConfig.contractId, 'Crowdfunding + Milestones')}
          ${_contractRow('FCToken (FCT)', fctokenConfig.contractId, 'SEP-41 Reward Token')}
        </div>
      </div>

      <!-- Campaign breakdown -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:1.25rem;margin-bottom:1.5rem">
        <div style="font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace;letter-spacing:.08em;margin-bottom:.875rem">CAMPAIGN BREAKDOWN</div>
        ${campaigns.length === 0
          ? `<div style="text-align:center;color:var(--muted);font-size:.85rem;padding:2rem">No campaigns yet — deploy contract and create one.</div>`
          : campaigns.map(c => _campaignRow(c)).join('')}
      </div>

      <!-- Horizon API info -->
      <div style="background:rgba(8,181,229,.06);border:1px solid rgba(8,181,229,.2);border-radius:var(--r);padding:1.25rem">
        <div style="font-size:.7rem;color:var(--cyan);font-family:'JetBrains Mono',monospace;letter-spacing:.08em;margin-bottom:.5rem">DATA INDEXING — STELLAR HORIZON API</div>
        <div style="font-size:.78rem;color:var(--muted);line-height:1.7">
          All metrics are indexed directly from the Stellar Testnet via the Horizon REST API.
          No separate indexer or database needed — queries run in real time.<br><br>
          <span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--cyan)">
            Endpoint: https://horizon-testnet.stellar.org
          </span>
        </div>
        <div style="margin-top:.875rem;display:flex;gap:.75rem;flex-wrap:wrap">
          <a href="https://horizon-testnet.stellar.org/accounts/${fundchainConfig.contractId}" 
             target="_blank" 
             style="font-size:.72rem;color:var(--cyan);font-family:'JetBrains Mono',monospace;text-decoration:none;border:1px solid rgba(8,181,229,.3);padding:.25rem .6rem;border-radius:.375rem">
            View FundChain on Horizon ↗
          </a>
          <a href="https://stellar.expert/explorer/testnet/contract/${fundchainConfig.contractId}" 
             target="_blank"
             style="font-size:.72rem;color:var(--gold);font-family:'JetBrains Mono',monospace;text-decoration:none;border:1px solid rgba(245,200,66,.3);padding:.25rem .6rem;border-radius:.375rem">
            View on Stellar Explorer ↗
          </a>
        </div>
      </div>
    </div>`;
}

function _metricCard(label, value, unit) {
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:1.1rem">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem">${label}</div>
      <div style="font-family:'Fraunces',serif;font-size:1.5rem;font-weight:900;color:var(--gold)">${value}<span style="font-size:.75rem;color:var(--muted);margin-left:.25rem">${unit}</span></div>
    </div>`;
}

function _contractRow(name, id, desc) {
  const short = id && !id.startsWith('REPLACE') ? id.slice(0,8)+'...'+id.slice(-6) : 'Not deployed';
  const isSet = id && !id.startsWith('REPLACE');
  return `
    <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
      <div style="font-size:.8rem;font-weight:500;min-width:140px">${name}</div>
      <code style="font-size:.72rem;color:${isSet?'var(--cyan)':'var(--muted)'};flex:1">${isSet?id:short}</code>
      <div style="font-size:.7rem;color:var(--muted)">${desc}</div>
      ${isSet?`<a href="https://stellar.expert/explorer/testnet/contract/${id}" target="_blank" style="font-size:.68rem;color:var(--gold);font-family:'JetBrains Mono',monospace;text-decoration:none">View ↗</a>`:''}
    </div>`;
}

function _campaignRow(c) {
  const pct = Math.min(c.goal > 0 ? (c.raised/c.goal)*100 : 0, 100);
  const isDemo = isNaN(Number(c.id));
  const m1 = c.milestone1?.status ?? 'Locked';
  const m2 = c.milestone2?.status ?? 'Locked';
  const m3 = c.milestone3?.status ?? 'Locked';
  const statusColor = { Released:'var(--green)', Reached:'var(--gold)', Locked:'var(--muted)' };

  return `
    <div style="border-bottom:1px solid var(--border);padding:.875rem 0;display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
      <div style="font-size:1.25rem">${c.emoji||'⭐'}</div>
      <div style="flex:1;min-width:160px">
        <div style="font-weight:500;font-size:.875rem">${c.title}</div>
        <div style="font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${c.raised}/${c.goal} XLM · ${c.backers} backers · ⬡${c.tokenMinted||0} FCT</div>
      </div>
      <div style="width:120px">
        <div class="progress-bar-track"><div class="progress-bar-fill ${pct<33?'low':pct<70?'mid':'high'}" style="width:${pct}%"></div></div>
        <div style="font-size:.65rem;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:.2rem">${pct.toFixed(0)}% funded</div>
      </div>
      <div style="display:flex;gap:.375rem;align-items:center">
        <span style="font-size:.6rem;font-family:'JetBrains Mono',monospace;color:${statusColor[m1]}">M1:${m1}</span>
        <span style="color:var(--muted);font-size:.6rem">·</span>
        <span style="font-size:.6rem;font-family:'JetBrains Mono',monospace;color:${statusColor[m2]}">M2:${m2}</span>
        <span style="color:var(--muted);font-size:.6rem">·</span>
        <span style="font-size:.6rem;font-family:'JetBrains Mono',monospace;color:${statusColor[m3]}">M3:${m3}</span>
      </div>
      ${isDemo?'':`<a href="https://stellar.expert/explorer/testnet/contract/${fundchainConfig.contractId}" target="_blank" style="font-size:.68rem;color:var(--gold);font-family:'JetBrains Mono',monospace;text-decoration:none">View ↗</a>`}
    </div>`;
}

export function bindDashboardEvents() {
  document.getElementById('refresh-metrics-btn')?.addEventListener('click', async () => {
    showToast('Refreshing metrics from Horizon...', 'info');
    await loadMetrics();
    showToast('Metrics updated', 'success');
  });
}