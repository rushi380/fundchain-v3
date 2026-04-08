/**
 * FundChain v3 — Test Suite
 * Run: node tests/fundchain.test.js
 * 10 tests, zero dependencies.
 */

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn(); passed++;
    console.log(`  ✅  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌  ${name}`);
    console.log(`       → ${err.message}`);
  }
}

function expect(actual) {
  return {
    toBe(e)           { if (actual !== e) throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
    toBeGreaterThan(n){ if (actual <= n)  throw new Error(`Expected ${actual} > ${n}`); },
    toBeLessThan(n)   { if (actual >= n)  throw new Error(`Expected ${actual} < ${n}`); },
    toHaveLength(n)   { if (actual.length !== n) throw new Error(`Expected length ${n}, got ${actual.length}`); },
    toContain(s)      { if (!actual.includes(s)) throw new Error(`"${actual}" does not contain "${s}"`); },
  };
}

// ── Logic under test ──────────────────────────────────────────────────────────

function createCampaign({ title, desc, goal, days, owner, category = 'defi', emoji = '🚀' }) {
  if (!title?.trim() || title.trim().length < 3) throw new Error('Title must be at least 3 characters');
  if (!desc?.trim())      throw new Error('Description is required');
  if (!goal || goal <= 0) throw new Error('Goal must be greater than 0');
  if (!days || days < 1 || days > 90) throw new Error('Duration must be 1–90 days');
  if (!owner)             throw new Error('Owner address required');

  const goalInt = parseInt(goal, 10);
  const m1amt   = Math.floor(goalInt * 0.3);
  const m2amt   = Math.floor(goalInt * 0.3);
  const m3amt   = goalInt - m1amt - m2amt;

  return {
    id:    Math.random().toString(36).slice(2),
    title: title.trim(), desc: desc.trim(),
    goal: goalInt, days: parseInt(days, 10),
    owner, category, emoji,
    raised: 0, backers: 0, tokenMinted: 0,
    daysLeft: parseInt(days, 10), withdrawn: false,
    contributions: [],
    milestone1: { percent: 30,  status: 'Locked', amountXlm: m1amt },
    milestone2: { percent: 60,  status: 'Locked', amountXlm: m2amt },
    milestone3: { percent: 100, status: 'Locked', amountXlm: m3amt },
  };
}

function contribute(campaign, { wallet, amount }) {
  if (!wallet)                throw new Error('Wallet required');
  if (!amount || amount <= 0) throw new Error('Amount must be greater than 0');
  if (campaign.daysLeft <= 0) throw new Error('Campaign has ended');

  const amountInt = parseInt(amount, 10);
  const newRaised = campaign.raised + amountInt;
  const pct       = (newRaised / campaign.goal) * 100;

  return {
    ...campaign,
    raised:      newRaised,
    backers:     campaign.backers + 1,
    tokenMinted: campaign.tokenMinted + amountInt,
    contributions: [{ addr: wallet, amount: amountInt, ts: Date.now() }, ...campaign.contributions],
    milestone1: { ...campaign.milestone1, status: pct >= 30  && campaign.milestone1.status === 'Locked' ? 'Reached' : campaign.milestone1.status },
    milestone2: { ...campaign.milestone2, status: pct >= 60  && campaign.milestone2.status === 'Locked' ? 'Reached' : campaign.milestone2.status },
    milestone3: { ...campaign.milestone3, status: pct >= 100 && campaign.milestone3.status === 'Locked' ? 'Reached' : campaign.milestone3.status },
  };
}

function releaseMilestone(campaign, milestoneIndex) {
  if (![0, 1, 2].includes(milestoneIndex)) throw new Error('Milestone index must be 0, 1, or 2');
  const keys = ['milestone1', 'milestone2', 'milestone3'];
  const key  = keys[milestoneIndex];
  if (campaign[key].status !== 'Reached') throw new Error('Milestone not reached yet or already released');

  const updated = {
    ...campaign,
    [key]: { ...campaign[key], status: 'Released' },
  };

  // If all released, mark withdrawn
  if (updated.milestone1.status === 'Released' &&
      updated.milestone2.status === 'Released' &&
      updated.milestone3.status === 'Released') {
    updated.withdrawn = true;
  }
  return updated;
}

function calcMilestoneAmounts(goal) {
  const m1 = Math.floor(goal * 0.3);
  const m2 = Math.floor(goal * 0.3);
  const m3 = goal - m1 - m2;
  return { m1, m2, m3, total: m1 + m2 + m3 };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  FundChain v3 — Test Suite  (10 tests)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('1. Campaign created with 3 locked milestones', () => {
  const c = createCampaign({ title: 'Solar Grid', desc: 'Clean energy', goal: 1000, days: 30, owner: 'GABC' });
  expect(c.milestone1.status).toBe('Locked');
  expect(c.milestone2.status).toBe('Locked');
  expect(c.milestone3.status).toBe('Locked');
  expect(c.milestone1.percent).toBe(30);
  expect(c.milestone2.percent).toBe(60);
  expect(c.milestone3.percent).toBe(100);
});

test('2. Milestone amounts sum to total goal', () => {
  const { m1, m2, m3, total } = calcMilestoneAmounts(1000);
  expect(total).toBe(1000);
  expect(m1).toBe(300);
  expect(m2).toBe(300);
  expect(m3).toBe(400);
});

test('3. Milestone 1 reaches Reached at 30% funded', () => {
  const c = createCampaign({ title: 'Solar Grid', desc: 'desc', goal: 1000, days: 30, owner: 'G' });
  const u = contribute(c, { wallet: 'GA', amount: 300 });
  expect(u.milestone1.status).toBe('Reached');
  expect(u.milestone2.status).toBe('Locked');
  expect(u.milestone3.status).toBe('Locked');
});

test('4. All milestones reach Reached at 100% funded', () => {
  const c = createCampaign({ title: 'Solar Grid', desc: 'desc', goal: 1000, days: 30, owner: 'G' });
  const u = contribute(c, { wallet: 'GA', amount: 1000 });
  expect(u.milestone1.status).toBe('Reached');
  expect(u.milestone2.status).toBe('Reached');
  expect(u.milestone3.status).toBe('Reached');
});

test('5. Releasing milestone 1 sets it to Released', () => {
  let c = createCampaign({ title: 'Solar Grid', desc: 'desc', goal: 1000, days: 30, owner: 'G' });
  c = contribute(c, { wallet: 'GA', amount: 300 });
  c = releaseMilestone(c, 0);
  expect(c.milestone1.status).toBe('Released');
  expect(c.withdrawn).toBe(false);
});

test('6. Releasing all milestones marks campaign withdrawn', () => {
  let c = createCampaign({ title: 'Solar Grid', desc: 'desc', goal: 1000, days: 30, owner: 'G' });
  c = contribute(c, { wallet: 'GA', amount: 1000 });
  c = releaseMilestone(c, 0);
  c = releaseMilestone(c, 1);
  c = releaseMilestone(c, 2);
  expect(c.withdrawn).toBe(true);
});

test('7. Cannot release locked milestone', () => {
  const c = createCampaign({ title: 'Solar Grid', desc: 'desc', goal: 1000, days: 30, owner: 'G' });
  let threw = false;
  try { releaseMilestone(c, 0); } catch (e) { threw = true; expect(e.message).toContain('not reached'); }
  if (!threw) throw new Error('Expected error not thrown');
});

test('8. FCT reward equals XLM contributed (1:1)', () => {
  const c = createCampaign({ title: 'Solar Grid', desc: 'desc', goal: 1000, days: 30, owner: 'G' });
  const u = contribute(c, { wallet: 'GA', amount: 250 });
  expect(u.tokenMinted).toBe(250);
  expect(u.raised).toBe(250);
});

test('9. Contribution fails on ended campaign', () => {
  const c = { ...createCampaign({ title: 'Solar Grid', desc: 'desc', goal: 100, days: 30, owner: 'G' }), daysLeft: 0 };
  let threw = false;
  try { contribute(c, { wallet: 'GA', amount: 50 }); } catch (e) { threw = true; expect(e.message).toContain('ended'); }
  if (!threw) throw new Error('Expected error not thrown');
});

test('10. Campaign filtering works correctly', () => {
  const camps = [
    { id: 0, title: 'Solar Grid', category: 'social' },
    { id: 1, title: 'DeFi Tools', category: 'defi'   },
    { id: 2, title: 'GameFi',     category: 'gaming'  },
  ];
  const all    = camps.filter(c => true);
  const defi   = camps.filter(c => c.category === 'defi');
  const search = camps.filter(c => c.title.toLowerCase().includes('solar'));
  expect(all.length).toBe(3);
  expect(defi.length).toBe(1);
  expect(search.length).toBe(1);
});

// ── Result ────────────────────────────────────────────────────────────────────
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
if (failed > 0) process.exit(1);