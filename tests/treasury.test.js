const test = require('node:test');
const assert = require('node:assert/strict');

const treasury = require('../lib/treasury');

function emptyVault() {
  return { personal_context: {}, spending_ledger: [], wishlist: [] };
}

test('ensureTreasury creates defaults on a vault without one', () => {
  const vault = emptyVault();
  const result = treasury.ensureTreasury(vault);
  assert.deepEqual(result, {
    yearly_income: null,
    currency: 'USD',
    buckets: [],
    updated_at: null,
  });
  assert.equal(vault.treasury, result);
});

test('setIncome accepts valid amounts and clears on null', () => {
  const vault = emptyVault();
  treasury.setIncome(vault, 120000);
  assert.equal(vault.treasury.yearly_income, 120000);
  treasury.setIncome(vault, 99999.999);
  assert.equal(vault.treasury.yearly_income, 100000);
  treasury.setIncome(vault, null);
  assert.equal(vault.treasury.yearly_income, null);
});

test('setIncome rejects negative, NaN, and huge values', () => {
  for (const bad of [-1, Number.NaN, 1000000001, 'lots']) {
    assert.throws(() => treasury.setIncome(emptyVault(), bad), /yearly income/i);
  }
});

test('upsertBucket creates an amount bucket with a generated id', () => {
  const vault = emptyVault();
  const bucket = treasury.upsertBucket(vault, { name: 'Rent', yearly_amount: 36000 });
  assert.match(bucket.id, /^bkt_/);
  assert.equal(bucket.name, 'Rent');
  assert.equal(bucket.yearly_amount, 36000);
  assert.equal(bucket.percent, null);
  assert.equal(bucket.feeds_fun_money, false);
  assert.equal(vault.treasury.buckets.length, 1);
});

test('upsertBucket creates percent buckets and rejects amount+percent', () => {
  const vault = emptyVault();
  const bucket = treasury.upsertBucket(vault, { name: 'Fun Money', percent: 10 });
  assert.equal(bucket.percent, 10);
  assert.equal(bucket.yearly_amount, null);
  assert.throws(
    () => treasury.upsertBucket(vault, { name: 'Bad', yearly_amount: 5, percent: 5 }),
    /either.*amount.*percent|percent.*amount/i
  );
  assert.throws(() => treasury.upsertBucket(vault, { name: 'Bad', percent: 101 }), /percent/i);
  assert.throws(() => treasury.upsertBucket(vault, { name: '   ' }), /name/i);
});

test('upsertBucket updates by id, 404s unknown ids, and keeps one fun bucket', () => {
  const vault = emptyVault();
  const first = treasury.upsertBucket(vault, { name: 'Fun A', percent: 10, feeds_fun_money: true });
  const second = treasury.upsertBucket(vault, { name: 'Fun B', percent: 5 });
  assert.equal(first.feeds_fun_money, true);
  treasury.upsertBucket(vault, { id: second.id, name: 'Fun B', percent: 5, feeds_fun_money: true });
  assert.equal(vault.treasury.buckets.find((b) => b.id === first.id).feeds_fun_money, false);
  assert.equal(vault.treasury.buckets.find((b) => b.id === second.id).feeds_fun_money, true);
  treasury.upsertBucket(vault, { id: second.id, name: 'Fun B Renamed', percent: 6 });
  assert.equal(vault.treasury.buckets.find((b) => b.id === second.id).name, 'Fun B Renamed');
  assert.throws(
    () => treasury.upsertBucket(vault, { id: 'bkt_missing', name: 'X', percent: 1 }),
    (err) => err.status === 404
  );
});

test('deleteBucket removes and 404s when missing', () => {
  const vault = emptyVault();
  const bucket = treasury.upsertBucket(vault, { name: 'Rent', yearly_amount: 1 });
  const removed = treasury.deleteBucket(vault, bucket.id);
  assert.equal(removed.id, bucket.id);
  assert.equal(vault.treasury.buckets.length, 0);
  assert.throws(() => treasury.deleteBucket(vault, bucket.id), (err) => err.status === 404);
});

test('allocationSummary resolves amounts, percents, and the fun slice', () => {
  const vault = emptyVault();
  treasury.setIncome(vault, 120000);
  treasury.upsertBucket(vault, { name: 'Rent', yearly_amount: 36000 });
  treasury.upsertBucket(vault, { name: 'Fun Money', percent: 10, feeds_fun_money: true });
  const summary = treasury.allocationSummary(vault);
  assert.equal(summary.yearly_income, 120000);
  assert.equal(summary.allocated, 48000);
  assert.equal(summary.unallocated, 72000);
  assert.equal(summary.over_allocated, false);
  assert.equal(summary.fun_monthly, 1000);
  const fun = summary.buckets.find((b) => b.name === 'Fun Money');
  assert.equal(fun.resolved_yearly, 12000);
  assert.equal(fun.monthly, 1000);
});

test('allocationSummary flags over-allocation and unresolved percents', () => {
  const vault = emptyVault();
  treasury.setIncome(vault, 50000);
  treasury.upsertBucket(vault, { name: 'Rent', yearly_amount: 40000 });
  treasury.upsertBucket(vault, { name: 'Fun', yearly_amount: 20000 });
  const over = treasury.allocationSummary(vault);
  assert.equal(over.allocated, 60000);
  assert.equal(over.unallocated, -10000);
  assert.equal(over.over_allocated, true);

  const noIncome = emptyVault();
  treasury.upsertBucket(noIncome, { name: 'Mystery', percent: 10, feeds_fun_money: true });
  const pending = treasury.allocationSummary(noIncome);
  assert.equal(pending.unallocated, null);
  assert.equal(pending.unresolved_count, 1);
  assert.equal(pending.fun_monthly, null);
});

test('syncFunCapFromTreasury drives the monthly cap, or null without a fun bucket', () => {
  const vault = emptyVault();
  treasury.setIncome(vault, 120000);
  treasury.upsertBucket(vault, { name: 'Fun Money', percent: 10, feeds_fun_money: true });
  const synced = treasury.syncFunCapFromTreasury(vault);
  assert.equal(synced.monthly_cap, 1000);
  assert.equal(vault.personal_context.monthly_discretionary_budget, 1000);
  assert.equal(synced.budget.cap, 1000);

  const bare = emptyVault();
  assert.equal(treasury.syncFunCapFromTreasury(bare), null);
});

test('trueCost converts prices into work hours', () => {
  const vault = emptyVault();
  treasury.setIncome(vault, 120000);
  assert.equal(treasury.hourlyRate(vault), 57.69);
  const cost = treasury.trueCost(vault, 195);
  assert.equal(cost.hourly_rate, 57.69);
  assert.equal(cost.hours, 3.38);
  assert.equal(cost.label, '3.4 hours of work');
  const quick = treasury.trueCost(vault, 20);
  assert.equal(quick.label, '21 minutes of work');
  assert.throws(() => treasury.trueCost(vault, -5), /price/i);
});

test('trueCost returns nulls without an income', () => {
  const cost = treasury.trueCost(emptyVault(), 195);
  assert.equal(cost.hourly_rate, null);
  assert.equal(cost.hours, null);
  assert.equal(cost.label, null);
});

test('skipToInvest compounds a skipped purchase', () => {
  const result = treasury.skipToInvest(195);
  assert.equal(result.amount, 195);
  assert.equal(result.years, 10);
  assert.equal(result.annual_return, 0.07);
  assert.equal(result.future_value, 383.59);
  assert.equal(result.gained, 188.59);
  assert.throws(() => treasury.skipToInvest(-1), /amount/i);
  assert.throws(() => treasury.skipToInvest(10, { years: 99 }), /years/i);
  assert.throws(() => treasury.skipToInvest(10, { annualReturn: 2 }), /return/i);
});

test('updateTreasury applies income, buckets, deletes, and fun sync together', () => {
  const vault = emptyVault();
  const first = treasury.updateTreasury(vault, {
    yearly_income: 120000,
    buckets: [
      { name: 'Rent', yearly_amount: 36000 },
      { name: 'Fun Money', percent: 10, feeds_fun_money: true },
    ],
  });
  assert.equal(first.treasury.fun_monthly, 1000);
  assert.equal(first.fun_sync.monthly_cap, 1000);
  assert.equal(first.budget.cap, 1000);

  const rentId = vault.treasury.buckets.find((b) => b.name === 'Rent').id;
  const second = treasury.updateTreasury(vault, { delete_ids: [rentId] });
  assert.equal(second.treasury.allocated, 12000);
  assert.throws(() => treasury.updateTreasury(vault, { buckets: 'nope' }), /buckets.*array/i);
});
