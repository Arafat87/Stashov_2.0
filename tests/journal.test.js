const test = require('node:test');
const assert = require('node:assert/strict');

const journal = require('../lib/journal');
const { purchaseItem, skipItem, snoozeItem } = require('../lib/gate');
const { buildVaultAuditMessages } = require('../lib/vault-audit');

function emptyVault() {
  return { personal_context: {}, spending_ledger: [], wishlist: [] };
}

function readyWish(overrides = {}) {
  return {
    id: 'w1',
    title: 'Test Cologne',
    category: 'Fragrances',
    lowest_verified_price: 195,
    added_at: '2026-01-01T00:00:00.000Z',
    unlock_at: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

test('ensureJournal creates an empty journal on a vault without one', () => {
  const vault = emptyVault();
  assert.deepEqual(journal.ensureJournal(vault), []);
  assert.deepEqual(vault.decision_journal, []);
});

test('recordDecision validates and stores newest-first', () => {
  const vault = emptyVault();
  assert.throws(
    () => journal.recordDecision(vault, { decision: 'maybe', item: { id: 'w1', title: 'X' } }),
    /decision/i
  );
  const entry = journal.recordDecision(vault, {
    decision: 'skipped',
    item: { id: 'w1', title: 'Test Cologne', category: 'Fragrances' },
    amount: 195,
    reason: 'Over budget this month',
    now: '2026-10-28T12:00:00.000Z',
  });
  assert.match(entry.id, /^dec_/);
  assert.equal(entry.at, '2026-10-28T12:00:00.000Z');
  assert.equal(vault.decision_journal.length, 1);
  journal.recordDecision(vault, {
    decision: 'bought',
    item: { id: 'w2', title: 'Second', category: 'Tech' },
    now: '2026-10-29T12:00:00.000Z',
  });
  assert.equal(vault.decision_journal[0].decision, 'bought');
  assert.equal(vault.decision_journal[1].decision, 'skipped');
});

test('recordDecision caps the journal at 100 entries', () => {
  const vault = emptyVault();
  for (let i = 0; i < 105; i += 1) {
    journal.recordDecision(vault, {
      decision: 'skipped',
      item: { id: `w${i}`, title: `Item ${i}` },
      now: '2026-10-01T00:00:00.000Z',
    });
  }
  assert.equal(vault.decision_journal.length, 100);
  assert.equal(vault.decision_journal[0].title, 'Item 104');
});

test('purchaseItem writes a bought entry with amount and reason', () => {
  const vault = emptyVault();
  vault.wishlist.push(readyWish());
  purchaseItem(vault, 'w1', { now: '2026-10-31T12:00:00.000Z', note: 'Price dropped to target' });
  assert.equal(vault.decision_journal.length, 1);
  const [entry] = vault.decision_journal;
  assert.equal(entry.decision, 'bought');
  assert.equal(entry.item_id, 'w1');
  assert.equal(entry.amount, 195);
  assert.equal(entry.reason, 'Price dropped to target');
});

test('skipItem writes a skipped entry with the skip reason', () => {
  const vault = emptyVault();
  vault.wishlist.push(readyWish());
  skipItem(vault, 'w1', { now: '2026-10-31T12:00:00.000Z', reason: 'Already own something similar' });
  const [entry] = vault.decision_journal;
  assert.equal(entry.decision, 'skipped');
  assert.equal(entry.amount, 195);
  assert.equal(entry.reason, 'Already own something similar');
});

test('snoozeItem writes a snoozed entry', () => {
  const vault = emptyVault();
  vault.wishlist.push(readyWish());
  snoozeItem(vault, 'w1', { now: '2026-10-31T12:00:00.000Z', days: 14, note: 'Wait for holiday sale' });
  const [entry] = vault.decision_journal;
  assert.equal(entry.decision, 'snoozed');
  assert.equal(entry.reason, 'Wait for holiday sale');
});

test('journalDigest formats newest-first lines for model prompts', () => {
  const vault = emptyVault();
  assert.equal(journal.journalDigest(vault), '');
  journal.recordDecision(vault, {
    decision: 'skipped',
    item: { id: 'w1', title: 'Test Cologne', category: 'Fragrances' },
    amount: 195,
    reason: 'Over budget this month',
    now: '2026-10-28T12:00:00.000Z',
  });
  journal.recordDecision(vault, {
    decision: 'bought',
    item: { id: 'w2', title: 'Quince Hoodie', category: 'Menswear' },
    amount: 60,
    now: '2026-10-29T12:00:00.000Z',
  });
  const digest = journal.journalDigest(vault);
  const lines = digest.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '• 2026-10-29 — BOUGHT "Quince Hoodie" ($60.00, Menswear): no reason recorded');
  assert.equal(lines[1], '• 2026-10-28 — SKIPPED "Test Cologne" ($195.00, Fragrances): Over budget this month');
  assert.equal(journal.journalDigest(vault, { limit: 1 }).split('\n').length, 1);
});

test('vault audit messages carry the decision journal to Wonder', () => {
  const vault = emptyVault();
  vault.bookmarks = [];
  vault.protocols = [];
  journal.recordDecision(vault, {
    decision: 'skipped',
    item: { id: 'w1', title: 'Test Cologne', category: 'Fragrances' },
    amount: 195,
    reason: 'Over budget',
    now: '2026-10-28T12:00:00.000Z',
  });
  const messages = buildVaultAuditMessages({ vault, question: 'Audit me', budget: {}, gate: {} });
  const userContent = messages.find((m) => m.role === 'user').content;
  assert.match(userContent, /Decision journal/);
  assert.match(userContent, /SKIPPED "Test Cologne"/);
});
