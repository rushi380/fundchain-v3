/**
 * App.js — Root component for FundChain v3
 * New: Dashboard tab, milestone release modal
 */
import {
  renderNav, renderHero, renderStatsBar, renderTabsBar,
  renderCampaignGrid, renderSkeletons, renderDetailModal,
  renderMyCampaigns, renderTransactions,
  renderToasts, renderProcessingOverlay, openWalletModal,
} from './index.js';
import { renderDashboard, bindDashboardEvents } from './Dashboard.js';
import {
  store, loadCampaigns, loadMetrics, createCampaign,
  contribute, releaseMilestone,
  showToast, setProcessing, getFilteredCampaigns,
} from '../utils/store.js';
import { walletManager } from '../utils/walletConnector.js';

let root;

export function initApp(container) {
  root = container;
  render();
  store.subscribe(s => {
    _updateNav(s);
    _updateStats(s);
    _updateTabs(s);
    _updateContent(s);
    _updateToasts(s);
    _updateOverlay(s);
  });
  loadCampaigns().then(() => loadMetrics());
  walletManager.tryAutoReconnect().then(ok => {
    if (!ok) return;
    const w = walletManager.activeWallet;
    store.setState({ walletId: w.id, walletAddress: w.address, walletBalance: w.balance, walletNetwork: w.network });
    showToast(`Reconnected: ${w.name}`, 'success');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.remove());
  });
  window.__fc = { openCreateModal, openContributeModal, openDetailModal, openWalletModal };
}

// ── Full render ───────────────────────────────────────────────────────────────

function render() {
  const s = store.getState();
  root.innerHTML = `
    ${renderProcessingOverlay(s)}
    <div id="toast-area"></div>
    ${renderNav(s)}
    <main>
      ${renderHero()}
      ${renderStatsBar(s)}
      ${renderTabsBar(s)}
      <div class="main-content" id="main-content">${_tabContent(s)}</div>
    </main>`;
  _bindAll();
}

// ── Partial updates ───────────────────────────────────────────────────────────

function _updateNav(s) {
  const el = document.getElementById('nav-root'); if (!el) return;
  const d  = document.createElement('div'); d.innerHTML = renderNav(s);
  el.replaceWith(d.firstElementChild);
  document.getElementById('wallet-btn')?.addEventListener('click', _walletClick);
  document.getElementById('create-campaign-btn')?.addEventListener('click', openCreateModal);
}
function _updateStats(s) {
  const el = document.getElementById('stats-bar'); if (!el) return;
  const d  = document.createElement('div'); d.innerHTML = renderStatsBar(s);
  el.replaceWith(d.firstElementChild);
}
function _updateTabs(s) {
  const el = document.querySelector('.tabs'); if (!el) return;
  const d  = document.createElement('div'); d.innerHTML = renderTabsBar(s);
  el.replaceWith(d.firstElementChild);
  _bindTabClicks();
}
function _updateContent(s) {
  const el = document.getElementById('main-content'); if (!el) return;
  el.innerHTML = _tabContent(s);
  _bindContentEvents();
}
function _updateToasts(s) {
  const el = document.getElementById('toast-area');
  if (el) el.innerHTML = renderToasts(s.toasts);
}
function _updateOverlay(s) {
  const el = document.getElementById('processing-overlay'); if (!el) return;
  el.className = `processing-overlay ${s.isProcessing ? 'active' : ''}`;
  const t = el.querySelector('.processing-text');
  if (t) t.textContent = s.processingText || 'PROCESSING...';
}

// ── Tab content ───────────────────────────────────────────────────────────────

function _tabContent(s) {
  if (s.activeTab === 'my-campaigns')  return renderMyCampaigns(s);
  if (s.activeTab === 'dashboard')     return renderDashboard(s);
  if (s.activeTab === 'transactions')  return renderTransactions(s);

  const list = getFilteredCampaigns();
  return `
    <div class="section-header">
      <div class="section-title">Active Campaigns</div>
      <input class="search-input" id="search-input" placeholder="Search..." value="${s.searchQuery}" />
    </div>
    <div class="filter-bar">
      ${['all','tech','art','social','gaming','defi'].map(cat =>
        `<button class="filter-chip ${s.activeCategory===cat?'active':''}" data-cat="${cat}">${cat==='all'?'All':cat}</button>`
      ).join('')}
    </div>
    <div class="campaign-grid">
      ${s.campaignsLoading ? renderSkeletons(6) : renderCampaignGrid(list)}
    </div>`;
}

// ── Event binding ─────────────────────────────────────────────────────────────

function _bindAll() {
  document.getElementById('wallet-btn')?.addEventListener('click', _walletClick);
  document.getElementById('create-campaign-btn')?.addEventListener('click', openCreateModal);
  _bindTabClicks();
  _bindContentEvents();
}

function _bindTabClicks() {
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => store.setState({ activeTab: btn.dataset.tab }))
  );
}

function _bindContentEvents() {
  document.getElementById('search-input')?.addEventListener('input', e =>
    store.setState({ searchQuery: e.target.value })
  );
  document.querySelectorAll('.filter-chip').forEach(c =>
    c.addEventListener('click', () => store.setState({ activeCategory: c.dataset.cat }))
  );
  document.querySelectorAll('.campaign-card[data-campaign-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (!e.target.closest('.fund-btn')) openDetailModal(card.dataset.campaignId);
    });
  });
  document.querySelectorAll('.fund-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.campaignId;
      if (!id || isNaN(Number(id))) {
        showToast('This is a demo campaign. Deploy the contract and create a real one.', 'error', 4000);
        return;
      }
      openContributeModal(id);
    });
  });
  // Bind dashboard refresh if on dashboard tab
  bindDashboardEvents();
}

// ── Wallet ────────────────────────────────────────────────────────────────────

async function _walletClick() {
  if (walletManager.isConnected()) {
    await walletManager.disconnect();
    store.setState({ walletId: null, walletAddress: null, walletBalance: null, walletNetwork: null, fctBalance: 0 });
    showToast('Wallet disconnected', 'info');
  } else { openWalletModal(); }
}

// ── Create campaign modal ─────────────────────────────────────────────────────

export function openCreateModal() {
  if (!walletManager.isConnected()) { showToast('Connect your wallet first', 'error'); openWalletModal(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div>
          <div class="modal-title">🚀 Launch a Campaign</div>
          <div class="modal-subtitle">Milestone-based · Funds release in 3 stages</div>
        </div>
        <button class="modal-close">✕</button>
      </div>
      <div class="form-group">
        <label class="form-label">Campaign Title *</label>
        <input class="form-input" id="c-title" placeholder="Min 3 characters" />
      </div>
      <div class="form-group">
        <label class="form-label">Description *</label>
        <textarea class="form-input" id="c-desc" rows="3" placeholder="What are you building?"></textarea>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Goal (XLM) *</label>
          <input class="form-input" id="c-goal" type="number" step="1" min="1" placeholder="e.g. 1000" />
        </div>
        <div class="form-group">
          <label class="form-label">Duration (days) *</label>
          <input class="form-input" id="c-days" type="number" min="1" max="90" placeholder="1–90" />
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-input" id="c-category">
            <option value="tech">Tech</option>
            <option value="art">Art</option>
            <option value="social">Social Good</option>
            <option value="gaming">Gaming</option>
            <option value="defi">DeFi</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Emoji</label>
          <input class="form-input" id="c-emoji" placeholder="🚀" maxlength="2" />
        </div>
      </div>
      <div style="background:rgba(245,200,66,.08);border:1px solid rgba(245,200,66,.2);border-radius:.5rem;padding:.75rem;font-size:.75rem;color:var(--gold);margin-bottom:1rem;font-family:'JetBrains Mono',monospace">
        ⬡ Backers earn 1 FCT per 1 XLM · Funds release at 30% → 60% → 100%
      </div>
      <button class="btn btn-primary" style="width:100%;padding:.75rem" id="deploy-btn">Deploy Campaign →</button>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());

  document.getElementById('deploy-btn').addEventListener('click', async () => {
    const title   = document.getElementById('c-title').value.trim();
    const desc    = document.getElementById('c-desc').value.trim();
    const goalRaw = document.getElementById('c-goal').value;
    const daysRaw = document.getElementById('c-days').value;
    const category = document.getElementById('c-category').value;
    const emoji   = document.getElementById('c-emoji').value.trim() || '🚀';

    if (!title || title.length < 3)  { showToast('Title must be at least 3 characters', 'error'); return; }
    if (!desc)                        { showToast('Description is required', 'error'); return; }
    const goal = parseInt(goalRaw, 10);
    const days = parseInt(daysRaw, 10);
    if (isNaN(goal) || goal <= 0)    { showToast('Goal must be a positive whole number', 'error'); return; }
    if (isNaN(days) || days < 1 || days > 90) { showToast('Duration must be 1–90 days', 'error'); return; }

    overlay.remove();
    setProcessing(true, 'WAITING FOR FREIGHTER SIGNATURE...');
    try {
      await createCampaign(
        { title, desc, goal, days, category, emoji },
        walletManager.getAddress(),
        walletManager.getNetwork()?.id
      );
      showToast(`"${title}" launched with milestones! 🚀`, 'success');
    } catch (err) {
      showToast(err.message, 'error', 5000);
    } finally { setProcessing(false); }
  });
}

// ── Contribute modal ──────────────────────────────────────────────────────────

export function openContributeModal(campaignId) {
  if (!walletManager.isConnected()) { showToast('Connect your wallet first', 'error'); openWalletModal(); return; }
  if (!campaignId || isNaN(Number(campaignId))) {
    showToast('Demo campaign — create a real one after deploying the contract.', 'error', 4000);
    return;
  }

  const campaign = store.getState().campaigns.find(c => String(c.id) === String(campaignId));
  if (!campaign) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Fund This Project</div>
          <div class="modal-subtitle">${campaign.emoji||'⭐'} ${campaign.title}</div>
        </div>
        <button class="modal-close">✕</button>
      </div>
      <label class="form-label">Amount (whole XLM)</label>
      <input class="contribute-amount-input" id="contrib-amt" type="number" value="10" step="1" min="1" />
      <div class="quick-amounts">
        ${[10,50,100,500].map(v=>`<div class="quick-amt" data-val="${v}">${v}</div>`).join('')}
      </div>
      <div class="reward-preview" id="reward-preview">⬡ You will earn <strong>10 FCT</strong> reward tokens</div>
      <div style="font-size:.72rem;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:1rem">
        Goal: ${campaign.goal.toLocaleString()} XLM · Raised: ${(campaign.raised||0).toLocaleString()} XLM
      </div>
      <div style="background:rgba(245,200,66,.06);border:1px solid rgba(245,200,66,.15);border-radius:.5rem;padding:.65rem;font-size:.72rem;color:var(--muted);margin-bottom:1rem">
        ⚡ FCT minted automatically via inter-contract call · Milestone progress updates on-chain
      </div>
      <button class="btn btn-primary" style="width:100%;padding:.75rem" id="confirm-btn">Confirm & Fund →</button>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());

  const inp     = document.getElementById('contrib-amt');
  const preview = document.getElementById('reward-preview');
  function updatePreview() {
    const n = parseInt(inp.value, 10);
    if (!isNaN(n) && n > 0) preview.innerHTML = `⬡ You will earn <strong>${n} FCT</strong> reward tokens`;
  }
  inp.addEventListener('input', updatePreview);
  overlay.querySelectorAll('.quick-amt').forEach(btn => {
    btn.addEventListener('click', () => { inp.value = parseInt(btn.dataset.val, 10); updatePreview(); });
  });

  document.getElementById('confirm-btn').addEventListener('click', async () => {
    const amount = parseInt(inp.value, 10);
    if (isNaN(amount) || amount <= 0) { showToast('Enter a valid whole number amount', 'error'); return; }
    overlay.remove();
    setProcessing(true, 'WAITING FOR FREIGHTER SIGNATURE...');
    try {
      await contribute(campaignId, amount, walletManager.getAddress());
      showToast(`✅ Funded ${amount} XLM — earned ⬡${amount} FCT!`, 'success', 5000);
    } catch (err) { showToast(err.message, 'error', 5000); }
    finally { setProcessing(false); }
  });
}

// ── Detail modal ──────────────────────────────────────────────────────────────

export function openDetailModal(campaignId) {
  const s        = store.getState();
  const campaign = s.campaigns.find(c => String(c.id) === String(campaignId));
  if (!campaign) return;

  const isOwner = s.walletAddress === campaign.owner;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = renderDetailModal(campaign, isOwner);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.fund-campaign-btn')?.addEventListener('click', () => {
    overlay.remove(); openContributeModal(campaignId);
  });

  // Bind milestone release buttons
  overlay.querySelectorAll('.release-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cId  = btn.dataset.campaignId;
      const mIdx = parseInt(btn.dataset.milestoneIdx, 10);
      overlay.remove();
      setProcessing(true, `RELEASING MILESTONE ${mIdx + 1}...`);
      try {
        await releaseMilestone(cId, mIdx);
        showToast(`✅ Milestone ${mIdx + 1} funds released!`, 'success');
      } catch (err) { showToast(err.message, 'error', 5000); }
      finally { setProcessing(false); }
    });
  });
}