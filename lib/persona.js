'use strict';

/**
 * Stashov — Judge Mode: demo persona loading with timer rebasing.
 *
 * The persona seed (scripts/seed-persona.js) stores dates relative to seed
 * time. Loading rebases every date to the load moment, so cooling timers,
 * ledger months, and journal entries always look alive no matter when a judge
 * clicks "Load demo persona". Swapping in a persona snapshots the current
 * vault first (label `pre-persona`); restoring reads that snapshot back.
 * On hosted Blob storage there is no local backup dir, so restore is a
 * local-first operation and reports honestly when no snapshot exists.
 */

const fs = require('fs');
const path = require('path');
const { BUNDLED_DATA_DIR, DATA_DIR } = require('./data-paths');
const { monthKey } = require('./gate');

const PERSONA_FILE = 'persona-vault.json';
const SNAPSHOT_PREFIX = 'vault-pre-persona-';
const WISH_DATES = [
  'added_at', 'unlock_at', 'snoozed_until', 'snoozed_at', 'purchased_at',
  'skipped_at', 'price_captured_at', 'price_checked_at', 'lowest_seen_at',
];
const LEDGER_DATES = ['spent_at', 'created_at', 'voided_at'];

class PersonaError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PersonaError';
    this.status = status;
  }
}

function personaPath() {
  const local = path.join(DATA_DIR, PERSONA_FILE);
  if (fs.existsSync(local)) return local;
  return path.join(BUNDLED_DATA_DIR, PERSONA_FILE);
}

function assertVaultShape(vault, label) {
  if (!vault || !Array.isArray(vault.bookmarks) || !Array.isArray(vault.wishlist) || !Array.isArray(vault.protocols)) {
    throw new PersonaError(`${label} is not a Stashov vault. It needs bookmarks, wishlist and protocols arrays.`, 500);
  }
}

function shiftDate(value, shiftMs) {
  if (!value) return value;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Date(time + shiftMs).toISOString();
}

/** Shift every persona date so offsets from seed time hold at load time. */
function rebasePersona(vault, now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const at = Number.isNaN(current.getTime()) ? new Date() : current;
  const seeded = Date.parse(vault && vault.meta && vault.meta.seeded_at);
  const shiftMs = Number.isNaN(seeded) ? 0 : at.getTime() - seeded;
  for (const item of vault.wishlist || []) {
    for (const field of WISH_DATES) item[field] = shiftDate(item[field], shiftMs);
    for (const point of item.price_history || []) point.at = shiftDate(point.at, shiftMs);
  }
  for (const entry of vault.spending_ledger || []) {
    for (const field of LEDGER_DATES) entry[field] = shiftDate(entry[field], shiftMs);
    const spent = Date.parse(entry.spent_at);
    if (!Number.isNaN(spent)) entry.month = monthKey(new Date(spent));
  }
  for (const record of vault.decision_journal || []) record.at = shiftDate(record.at, shiftMs);
  if (vault.treasury && typeof vault.treasury === 'object') {
    vault.treasury.updated_at = shiftDate(vault.treasury.updated_at, shiftMs);
    for (const bucket of vault.treasury.buckets || []) {
      bucket.created_at = shiftDate(bucket.created_at, shiftMs);
      bucket.updated_at = shiftDate(bucket.updated_at, shiftMs);
    }
  }
  if (vault.personal_context && typeof vault.personal_context === 'object') {
    vault.personal_context.budget_month = monthKey(at);
  }
  vault.meta = { ...(vault.meta || {}), rebased_at: at.toISOString() };
  return vault;
}

function loadPersonaVault(options = {}) {
  const filePath = personaPath();
  if (!fs.existsSync(filePath)) {
    throw new PersonaError('Demo persona seed is missing. Run npm run seed-persona first.', 500);
  }
  let vault = null;
  try {
    vault = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    vault = null;
  }
  if (!vault) throw new PersonaError('Demo persona seed is corrupt. Run npm run seed-persona again.', 500);
  assertVaultShape(vault, 'Demo persona seed');
  return rebasePersona(vault, options.now ? new Date(options.now) : new Date());
}

/** Minimal blank vault for the "start fresh" path. */
function freshVault() {
  return {
    meta: { fresh: true, gate_schema_version: 3 },
    personal_context: {
      owner: '',
      location: '',
      monthly_discretionary_budget: 300,
      spent_this_month: 0,
      budget_month: monthKey(new Date()),
      default_cooling_off_days: 14,
      sizes: {},
      skin_and_health_constraints: [],
      fragrance_profile: { loved: [], avoided: [] },
      owned_inventory: [],
    },
    treasury: { yearly_income: null, currency: 'USD', buckets: [], updated_at: null },
    wishlist: [],
    spending_ledger: [],
    decision_journal: [],
    protocols: [],
    routine_log: {},
    telemetry: [],
    last_digest: null,
    bookmarks: [],
  };
}

function backupDir() {
  return path.join(DATA_DIR, 'backups');
}

function findPrePersonaSnapshot(dir = backupDir()) {
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (_) {
    return null;
  }
  const match = files
    .filter((name) => name.startsWith(SNAPSHOT_PREFIX) && /\.json$/i.test(name))
    .sort()
    .reverse()[0];
  return match ? path.join(dir, match) : null;
}

function readSnapshotVault(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new PersonaError('No pre-persona snapshot found. Load a persona or start fresh first.', 404);
  }
  let vault = null;
  try {
    vault = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    vault = null;
  }
  if (!vault) throw new PersonaError('That snapshot is corrupt and cannot be restored.', 500);
  assertVaultShape(vault, 'That snapshot');
  return vault;
}

module.exports = {
  PersonaError,
  backupDir,
  findPrePersonaSnapshot,
  freshVault,
  loadPersonaVault,
  personaPath,
  readSnapshotVault,
  rebasePersona,
};
