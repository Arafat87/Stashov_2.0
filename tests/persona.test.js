const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const persona = require('../lib/persona');
const { ensureGateState, monthKey } = require('../lib/gate');

const DAY_MS = 24 * 60 * 60 * 1000;

test('loadPersonaVault returns the Jordan demo vault', () => {
  const vault = persona.loadPersonaVault();
  assert.equal(vault.meta.persona, true);
  assert.equal(vault.bookmarks.length, 36);
  assert.equal(vault.wishlist.length, 8);
  assert.equal(vault.protocols.length, 2);
  assert.equal(vault.decision_journal.length, 3);
  assert.equal(vault.treasury.yearly_income, 96000);
  assert.equal(vault.personal_context.monthly_discretionary_budget, 800);
});

test('persona lanes cover cooling, ready, bought, skipped, and snoozed', () => {
  const vault = persona.loadPersonaVault();
  const { gate } = ensureGateState(vault);
  assert.ok(gate.counts.cooling >= 2);
  assert.ok(gate.counts.ready >= 2);
  assert.equal(gate.counts.bought, 1);
  assert.equal(gate.counts.skipped, 1);
  assert.equal(gate.counts.snoozed, 1);
  const overcoat = vault.wishlist.find((item) => item.id === 'demo_w1');
  const hoursToUnlock = (Date.parse(overcoat.unlock_at) - Date.now()) / (60 * 60 * 1000);
  assert.ok(hoursToUnlock > 0 && hoursToUnlock < 48);
  assert.equal(vault.personal_context.budget_month, monthKey(new Date()));
});

test('rebasePersona shifts every date by the load offset', () => {
  const first = persona.loadPersonaVault({ now: '2026-11-01T12:00:00.000Z' });
  const second = persona.loadPersonaVault({ now: '2026-11-11T12:00:00.000Z' });
  const addedFirst = Date.parse(first.wishlist[0].added_at);
  const addedSecond = Date.parse(second.wishlist[0].added_at);
  assert.equal(addedSecond - addedFirst, 10 * DAY_MS);
  assert.equal(second.spending_ledger[0].month, '2026-11');
  assert.equal(first.meta.rebased_at, '2026-11-01T12:00:00.000Z');
});

test('freshVault is a minimal vault that passes gate setup', () => {
  const vault = persona.freshVault();
  const { budget, gate } = ensureGateState(vault);
  assert.equal(budget.cap, 300);
  assert.equal(gate.total, 0);
  assert.deepEqual(vault.bookmarks, []);
  assert.equal(vault.treasury.yearly_income, null);
});

test('findPrePersonaSnapshot picks the newest snapshot and null when empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-snap-'));
  assert.equal(persona.findPrePersonaSnapshot(dir), null);
  fs.writeFileSync(path.join(dir, 'vault-pre-persona-2026-10-01.json'), '{}');
  fs.writeFileSync(path.join(dir, 'vault-pre-persona-2026-10-31.json'), '{}');
  fs.writeFileSync(path.join(dir, 'vault-manual-2026-11-01.json'), '{}');
  const found = persona.findPrePersonaSnapshot(dir);
  assert.equal(found, path.join(dir, 'vault-pre-persona-2026-10-31.json'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('readSnapshotVault validates shape and reports missing files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-read-'));
  const good = path.join(dir, 'vault-pre-persona-2026-10-31.json');
  fs.writeFileSync(good, JSON.stringify(persona.freshVault()));
  const vault = persona.readSnapshotVault(good);
  assert.deepEqual(vault.bookmarks, []);
  fs.writeFileSync(good, '{not json');
  assert.throws(() => persona.readSnapshotVault(good), (err) => err.status === 500);
  assert.throws(() => persona.readSnapshotVault(path.join(dir, 'absent.json')), (err) => err.status === 404);
  fs.rmSync(dir, { recursive: true, force: true });
});
