'use strict';

/**
 * Stashov — Decision journal: Wonder's long-horizon memory of buy/skip/snooze
 * calls. Every gate transition records what was decided, for how much, and
 * why; the digest feeds back into the vault audit and impulse-gate prompts so
 * future verdicts can cite the user's own track record instead of reasoning
 * from a blank slate each time.
 */

const MAX_JOURNAL = 100;
const DECISIONS = new Set(['bought', 'skipped', 'snoozed']);

class JournalError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'JournalError';
    this.status = status;
  }
}

function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function asNow(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function ensureJournal(vault) {
  if (!Array.isArray(vault.decision_journal)) vault.decision_journal = [];
  return vault.decision_journal;
}

function recordDecision(vault, input = {}) {
  const decision = String(input.decision || '').trim().toLowerCase();
  if (!DECISIONS.has(decision)) {
    throw new JournalError('Decision must be one of: bought, skipped, snoozed.');
  }
  const item = input.item || {};
  if (!item.id || !item.title) {
    throw new JournalError('A journal entry needs an item id and title.');
  }
  const amount = Number(input.amount);
  const entry = {
    id: `dec_${asNow(input.now).getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    at: asNow(input.now).toISOString(),
    decision,
    item_id: String(item.id),
    title: clean(item.title, 140),
    category: clean(item.category, 60) || 'Unfiled',
    amount: Number.isFinite(amount) && amount >= 0 ? Math.round((amount + Number.EPSILON) * 100) / 100 : null,
    reason: clean(input.reason, 500),
  };
  const list = ensureJournal(vault);
  list.unshift(entry);
  if (list.length > MAX_JOURNAL) list.length = MAX_JOURNAL;
  return entry;
}

function dayLabel(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'unknown date' : date.toISOString().slice(0, 10);
}

/** Compact newest-first lines for model prompts. Empty string when no decisions exist. */
function journalDigest(vault, options = {}) {
  const list = Array.isArray(vault && vault.decision_journal) ? vault.decision_journal : [];
  const requested = Number(options.limit);
  const limit = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 8;
  return list.slice(0, limit).map((entry) => {
    const price = Number(entry.amount);
    const priceLabel = Number.isFinite(price) && price >= 0 ? `$${price.toFixed(2)}, ` : '';
    const reason = clean(entry.reason, 160) || 'no reason recorded';
    return `• ${dayLabel(entry.at)} — ${String(entry.decision || '').toUpperCase()} "${clean(entry.title, 90)}" (${priceLabel}${clean(entry.category, 40) || 'Unfiled'}): ${reason}`;
  }).join('\n');
}

module.exports = {
  JournalError,
  ensureJournal,
  journalDigest,
  recordDecision,
};
