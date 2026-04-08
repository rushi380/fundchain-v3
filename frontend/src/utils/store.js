/**
 * store.js v3 — Reactive state with milestone support
 */
import { cache }                              from './cache.js';
import { getAllCampaigns as fetchChain,
         createCampaign  as contractCreate,
         contribute      as contractContribute,
         releaseMilestone as contractRelease,
         getFCTBalance, getFCTTotalSupply }   from './contractClient.js';
import { buildMetrics }                       from './horizonIndexer.js';
import fundchainConfig                        from '../contracts/FundChain.json';

function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    getState()  { return state; },
    setState(u) {
      const next = typeof u === 'function' ? u(state) : u;
      state = { ...state, ...next };
      listeners.forEach(fn => fn(state));
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export const store = createStore({
  walletId: null, walletAddress: null, walletBalance: null, walletNetwork: null,
  fctBalance: 0, fctTotalSupply: 0,
  campaigns: [], campaignsLoading: true,
  metrics: null, metricsLoading: false,
  transactions: [],
  activeTab: 'explore', activeCategory: 'all', searchQuery: '',
  isProcessing: false, processingText: '', toasts: [],
});

export async function loadCampaigns() {
  store.setState({ campaignsLoading: true });
  const cached = cache.get('campaigns');
  if (cached?.length) store.setState({ campaigns: cached, campaignsLoading: false });
  try {
    const campaigns = await fetchChain();
    store.setState({ campaigns, campaignsLoading: false });
    cache.set('campaigns', campaigns);
  } catch (err) {
    console.warn('[store] Chain fetch failed:', err.message);
    if (!cached?.length) store.setState({ campaigns: SEED, campaignsLoading: false });
    else store.setState({ campaignsLoading: false });
  }
}

export async function loadMetrics() {
  store.setState({ metricsLoading: true });
  try {
    const { campaigns } = store.getState();
    const metrics = await buildMetrics(campaigns, fundchainConfig.contractId);
    store.setState({ metrics, metricsLoading: false });
  } catch (err) {
    console.warn('[store] Metrics failed:', err.message);
    store.setState({ metricsLoading: false });
  }
}

export async function loadFCTStats(address) {
  if (!address) return;
  try {
    const [bal, supply] = await Promise.all([getFCTBalance(address), getFCTTotalSupply()]);
    store.setState({ fctBalance: bal, fctTotalSupply: supply });
  } catch {}
}

export async function createCampaign(data, ownerAddress, networkId) {
  const { title, desc, goal, days, category = 'tech', emoji = '🚀' } = data;
  const goalInt = parseInt(goal, 10);
  const daysInt = parseInt(days, 10);
  if (!title?.trim() || title.trim().length < 3) throw new Error('Title must be at least 3 characters');
  if (!desc?.trim())                              throw new Error('Description is required');
  if (isNaN(goalInt) || goalInt <= 0)             throw new Error('Goal must be a positive whole number');
  if (isNaN(daysInt) || daysInt < 1 || daysInt > 90) throw new Error('Duration must be 1–90 days');
  if (!ownerAddress)                              throw new Error('Wallet not connected');

  await contractCreate({ title: title.trim(), description: desc.trim(), goalXlm: goalInt, durationDays: daysInt });

  const campaign = {
    id: `local_${Date.now()}`, title: title.trim(), desc: desc.trim(),
    goal: goalInt, emoji, category, network: networkId || 'stellar-testnet',
    raised: 0, backers: 0, contributions: [], tokenMinted: 0,
    owner: ownerAddress, daysLeft: daysInt, withdrawn: false,
    milestone1: { percent: 30, status: 'Locked', amountXlm: Math.round(goalInt * 0.3) },
    milestone2: { percent: 60, status: 'Locked', amountXlm: Math.round(goalInt * 0.3) },
    milestone3: { percent: 100, status: 'Locked', amountXlm: goalInt - Math.round(goalInt * 0.6) },
  };
  store.setState(s => ({ campaigns: [campaign, ...s.campaigns] }));
  addTransaction({ dir: 'out', label: `Created: ${campaign.title}`, amount: 0 });
  setTimeout(() => loadCampaigns(), 3000);
  return campaign;
}

export async function contribute(campaignId, amount, walletAddress) {
  if (!walletAddress) throw new Error('Wallet not connected');
  const amountInt = parseInt(amount, 10);
  if (isNaN(amountInt) || amountInt <= 0) throw new Error('Amount must be a positive whole number');

  await contractContribute({ campaignId: Number(campaignId), amountXlm: amountInt });

  store.setState(s => {
    const campaigns = s.campaigns.map(c => {
      if (String(c.id) !== String(campaignId)) return c;
      const newRaised = c.raised + amountInt;
      const pct = (newRaised / c.goal) * 100;
      return {
        ...c,
        raised:      newRaised,
        backers:     c.backers + 1,
        tokenMinted: (c.tokenMinted || 0) + amountInt,
        contributions: [{ addr: walletAddress, amount: amountInt, ts: Date.now() }, ...c.contributions],
        milestone1: { ...c.milestone1, status: pct >= 30 && c.milestone1.status === 'Locked' ? 'Reached' : c.milestone1.status },
        milestone2: { ...c.milestone2, status: pct >= 60 && c.milestone2.status === 'Locked' ? 'Reached' : c.milestone2.status },
        milestone3: { ...c.milestone3, status: pct >= 100 && c.milestone3.status === 'Locked' ? 'Reached' : c.milestone3.status },
      };
    });
    cache.set('campaigns', campaigns);
    return { campaigns };
  });
  const camp = store.getState().campaigns.find(c => String(c.id) === String(campaignId));
  addTransaction({ dir: 'out', label: `Backed: ${camp?.title ?? campaignId}`, amount: amountInt });
  addTransaction({ dir: 'in',  label: `Earned: ${amountInt} FCT reward tokens`, amount: amountInt, isFCT: true });
  loadFCTStats(walletAddress);
  setTimeout(() => loadCampaigns(), 3000);
}

export async function releaseMilestone(campaignId, milestoneIndex) {
  await contractRelease({ campaignId: Number(campaignId), milestoneIndex });
  const labels = ['30%', '60%', '100%'];
  addTransaction({ dir: 'in', label: `Released milestone ${milestoneIndex + 1} (${labels[milestoneIndex]})`, amount: 0 });
  setTimeout(() => loadCampaigns(), 3000);
}

export function addTransaction({ dir, label, amount, isFCT = false }) {
  const tx = { id: Date.now() + Math.random(), dir, label, amount, isFCT, ts: Date.now() };
  store.setState(s => {
    const transactions = [tx, ...s.transactions];
    cache.set('transactions', transactions);
    return { transactions };
  });
}

export function showToast(msg, type = 'info', ms = 3500) {
  const id = Date.now() + Math.random();
  store.setState(s => ({ toasts: [...s.toasts, { id, message: msg, type }] }));
  setTimeout(() => store.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), ms);
}

export function setProcessing(active, text = '') {
  store.setState({ isProcessing: active, processingText: text });
}

export function getFilteredCampaigns() {
  const { campaigns, activeCategory, searchQuery } = store.getState();
  return campaigns.filter(c => {
    const matchCat = activeCategory === 'all' || c.category === activeCategory;
    const q = searchQuery.toLowerCase();
    return matchCat && (!q || c.title?.toLowerCase().includes(q) || c.desc?.toLowerCase().includes(q));
  });
}

const SEED = [
  { id:'s1', title:'Solar Grid Africa', emoji:'⚡', desc:'Decentralized solar panels for rural communities.', category:'social', goal:5000, raised:3500, backers:142, tokenMinted:3500, owner:'GABC...', network:'stellar-testnet', daysLeft:8, contributions:[], withdrawn:false, milestone1:{percent:30,status:'Released',amountXlm:1500}, milestone2:{percent:60,status:'Reached',amountXlm:1500}, milestone3:{percent:100,status:'Locked',amountXlm:2000} },
  { id:'s2', title:'Stellar Art DAO',   emoji:'🎨', desc:'On-chain gallery curated by FCT holders.',      category:'art',    goal:2000, raised:2000, backers:89,  tokenMinted:2000, owner:'GXYZ...', network:'stellar-testnet', daysLeft:0, contributions:[], withdrawn:true,  milestone1:{percent:30,status:'Released',amountXlm:600},  milestone2:{percent:60,status:'Released',amountXlm:600},  milestone3:{percent:100,status:'Released',amountXlm:800} },
  { id:'s3', title:'DeFi for India',    emoji:'🌍', desc:'Mobile DeFi education in local languages.',    category:'defi',   goal:1500, raised:620,  backers:201, tokenMinted:620,  owner:'GIJK...', network:'stellar-testnet', daysLeft:19,contributions:[], withdrawn:false, milestone1:{percent:30,status:'Locked',amountXlm:450},   milestone2:{percent:60,status:'Locked',amountXlm:450},   milestone3:{percent:100,status:'Locked',amountXlm:600} },
];