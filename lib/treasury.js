'use strict';

/**
 * Stashov — Treasury: yearly income allocation for the Palace Treasury wing.
 *
 * The spend ledger tracks what already left the fun-money bucket; the Treasury
 * tracks where the whole paycheck goes before that. A yearly income splits
 * into named buckets (rent, fun money, investments, plus anything custom),
 * each holding either a fixed yearly amount or a percent of income. The bucket
 * flagged `feeds_fun_money` drives the monthly discretionary cap, so one edit
 * flows from salary to the Impulse Gate. Buckets also power the true-cost
 * oracle (prices in hours of work) and skip-to-invest projections.
 */

const { budgetSummary, syncBudget } = require('./gate');

const MAX_BUCKETS = 24;
const MAX_INCOME = 1000000000;
const DEFAULT_HOURS_PER_YEAR = 2080;
const DEFAULT_INVEST_YEARS = 10;
const DEFAULT_ANNUAL_RETURN = 0.07;
const MAX_INVEST_YEARS = 50;

class TreasuryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'TreasuryError';
    this.status = status;
  }
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function asNow(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function ensureTreasury(vault) {
  if (!vault.treasury || typeof vault.treasury !== 'object' || Array.isArray(vault.treasury)) {
    vault.treasury = { yearly_income: null, currency: 'USD', buckets: [], updated_at: null };
  }
  const treasury = vault.treasury;
  if (!Array.isArray(treasury.buckets)) treasury.buckets = [];
  const income = Number(treasury.yearly_income);
  treasury.yearly_income = treasury.yearly_income === null || treasury.yearly_income === undefined || treasury.yearly_income === ''
    ? null
    : Number.isFinite(income) && income >= 0 && income <= MAX_INCOME ? roundMoney(income) : null;
  const currency = String(treasury.currency || '').trim().slice(0, 8).toUpperCase();
  treasury.currency = currency || 'USD';
  return treasury;
}

function setIncome(vault, amount, options = {}) {
  const treasury = ensureTreasury(vault);
  if (amount === null || amount === undefined || amount === '') {
    treasury.yearly_income = null;
  } else {
    const income = Number(amount);
    if (!Number.isFinite(income) || income < 0 || income > MAX_INCOME) {
      throw new TreasuryError(`Yearly income must be a number between $0 and $${MAX_INCOME.toLocaleString('en-US')}.`);
    }
    treasury.yearly_income = roundMoney(income);
  }
  treasury.updated_at = asNow(options.now).toISOString();
  return treasury;
}

function optionalAmount(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_INCOME) {
    throw new TreasuryError(`${label} must be a number between $0 and $${MAX_INCOME.toLocaleString('en-US')}.`);
  }
  return roundMoney(amount);
}

function optionalPercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new TreasuryError('Bucket percent must be a number between 0 and 100.');
  }
  return Math.round((percent + Number.EPSILON) * 100) / 100;
}

function upsertBucket(vault, input = {}, options = {}) {
  const treasury = ensureTreasury(vault);
  const now = asNow(options.now);
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) throw new TreasuryError('A bucket needs a name.');
  const yearlyAmount = optionalAmount(input.yearly_amount, 'Bucket yearly amount');
  const percent = optionalPercent(input.percent);
  if (yearlyAmount !== null && percent !== null) {
    throw new TreasuryError('Give either a yearly amount or a percent of income, not both.');
  }
  const feedsFunMoney = input.feeds_fun_money === true;
  const color = String(input.color || '').trim().slice(0, 24);

  let bucket = null;
  const rawId = input.id === null || input.id === undefined ? '' : String(input.id).trim();
  if (rawId) {
    bucket = treasury.buckets.find((row) => row.id === rawId) || null;
    if (!bucket) throw new TreasuryError('Bucket not found.', 404);
    bucket.name = name;
    bucket.yearly_amount = yearlyAmount;
    bucket.percent = percent;
    bucket.feeds_fun_money = feedsFunMoney;
    if (color) bucket.color = color;
    bucket.updated_at = now.toISOString();
  } else {
    if (treasury.buckets.length >= MAX_BUCKETS) {
      throw new TreasuryError(`Treasury holds at most ${MAX_BUCKETS} buckets.`);
    }
    bucket = {
      id: `bkt_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      yearly_amount: yearlyAmount,
      percent,
      feeds_fun_money: feedsFunMoney,
      color,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    treasury.buckets.push(bucket);
  }
  if (feedsFunMoney) {
    for (const row of treasury.buckets) {
      if (row.id !== bucket.id) row.feeds_fun_money = false;
    }
  }
  treasury.updated_at = now.toISOString();
  return bucket;
}

function deleteBucket(vault, id) {
  const treasury = ensureTreasury(vault);
  const index = treasury.buckets.findIndex((row) => row.id === id);
  if (index < 0) throw new TreasuryError('Bucket not found.', 404);
  const [removed] = treasury.buckets.splice(index, 1);
  treasury.updated_at = new Date().toISOString();
  return removed;
}

function resolveBucketYearly(bucket, income) {
  if (bucket.yearly_amount !== null && bucket.yearly_amount !== undefined) {
    return roundMoney(bucket.yearly_amount);
  }
  if (bucket.percent === null || bucket.percent === undefined || income === null || income === undefined) {
    return null;
  }
  return roundMoney((Number(income) * Number(bucket.percent)) / 100);
}

function allocationSummary(vault) {
  const treasury = ensureTreasury(vault);
  const income = treasury.yearly_income;
  let unresolved = 0;
  const buckets = treasury.buckets.map((bucket) => {
    const resolved = resolveBucketYearly(bucket, income);
    if (resolved === null) unresolved += 1;
    return {
      id: bucket.id,
      name: bucket.name,
      yearly_amount: bucket.yearly_amount ?? null,
      percent: bucket.percent ?? null,
      feeds_fun_money: bucket.feeds_fun_money === true,
      color: bucket.color || '',
      resolved_yearly: resolved,
      monthly: resolved === null ? null : roundMoney(resolved / 12),
    };
  });
  const allocated = roundMoney(buckets.reduce((sum, row) => sum + (row.resolved_yearly || 0), 0));
  const unallocated = income === null ? null : roundMoney(income - allocated);
  const fun = buckets.find((row) => row.feeds_fun_money) || null;
  return {
    yearly_income: income,
    currency: treasury.currency,
    bucket_count: buckets.length,
    allocated,
    unallocated,
    over_allocated: unallocated !== null && unallocated < 0,
    unresolved_count: unresolved,
    fun_monthly: fun ? fun.monthly : null,
    buckets,
    updated_at: treasury.updated_at,
  };
}

/**
 * Drive the monthly discretionary cap from the fun bucket's monthly slice.
 * Returns null when no fun bucket (or no resolvable income) exists, leaving
 * the hand-set cap untouched.
 */
function syncFunCapFromTreasury(vault, options = {}) {
  const now = asNow(options.now);
  const summary = allocationSummary(vault);
  if (summary.fun_monthly === null) return null;
  const context = vault.personal_context || (vault.personal_context = {});
  context.monthly_discretionary_budget = roundMoney(summary.fun_monthly);
  syncBudget(vault, now);
  return { monthly_cap: roundMoney(summary.fun_monthly), budget: budgetSummary(vault, now) };
}

function validHoursPerYear(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_HOURS_PER_YEAR;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 8760) {
    throw new TreasuryError('Hours per year must be a number between 0 and 8760.');
  }
  return hours;
}

function hourlyRate(vault, hoursPerYear = DEFAULT_HOURS_PER_YEAR) {
  const treasury = ensureTreasury(vault);
  if (treasury.yearly_income === null) return null;
  return roundMoney(treasury.yearly_income / validHoursPerYear(hoursPerYear));
}

function workLabel(hours) {
  if (hours < 1) {
    const minutes = Math.max(0, Math.round(hours * 60));
    return `${minutes} minute${minutes === 1 ? '' : 's'} of work`;
  }
  const rounded = Math.round((hours + Number.EPSILON) * 10) / 10;
  return `${rounded} hour${rounded === 1 ? '' : 's'} of work`;
}

/** Express a price as hours of the user's own work. Nulls when income is unknown. */
function trueCost(vault, price, options = {}) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TreasuryError('Price must be a non-negative number.');
  }
  const rate = hourlyRate(vault, options.hoursPerYear);
  if (rate === null || rate <= 0) {
    return { price: roundMoney(amount), hourly_rate: null, hours: null, label: null };
  }
  const hours = roundMoney(amount / rate);
  return { price: roundMoney(amount), hourly_rate: rate, hours, label: workLabel(hours) };
}

/** Compound a skipped purchase at a fixed annual return. Pure math, no vault needed. */
function skipToInvest(amount, options = {}) {
  const principal = Number(amount);
  if (!Number.isFinite(principal) || principal < 0) {
    throw new TreasuryError('Amount must be a non-negative number.');
  }
  const years = options.years === undefined || options.years === null || options.years === ''
    ? DEFAULT_INVEST_YEARS
    : Number(options.years);
  if (!Number.isInteger(years) || years < 1 || years > MAX_INVEST_YEARS) {
    throw new TreasuryError(`Years must be a whole number between 1 and ${MAX_INVEST_YEARS}.`);
  }
  const annualReturn = options.annualReturn === undefined || options.annualReturn === null || options.annualReturn === ''
    ? DEFAULT_ANNUAL_RETURN
    : Number(options.annualReturn);
  if (!Number.isFinite(annualReturn) || annualReturn < 0 || annualReturn > 1) {
    throw new TreasuryError('Annual return must be a number between 0 and 1.');
  }
  const futureValue = roundMoney(principal * Math.pow(1 + annualReturn, years));
  return {
    amount: roundMoney(principal),
    years,
    annual_return: annualReturn,
    future_value: futureValue,
    gained: roundMoney(futureValue - roundMoney(principal)),
  };
}

/** Single entry point for the API route: income, bucket upserts, deletes, fun-cap sync. */
function updateTreasury(vault, updates = {}, options = {}) {
  const now = asNow(options.now);
  if (Object.prototype.hasOwnProperty.call(updates, 'yearly_income')) {
    setIncome(vault, updates.yearly_income, { now });
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'currency')) {
    const treasury = ensureTreasury(vault);
    const currency = String(updates.currency || '').trim().slice(0, 8).toUpperCase();
    if (!currency) throw new TreasuryError('Currency cannot be empty.');
    treasury.currency = currency;
    treasury.updated_at = now.toISOString();
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'buckets')) {
    if (!Array.isArray(updates.buckets)) {
      throw new TreasuryError('Buckets must be an array of bucket objects.');
    }
    for (const bucket of updates.buckets) {
      upsertBucket(vault, bucket || {}, { now });
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'delete_ids')) {
    if (!Array.isArray(updates.delete_ids)) {
      throw new TreasuryError('delete_ids must be an array of bucket ids.');
    }
    for (const id of updates.delete_ids) {
      deleteBucket(vault, id);
    }
  }
  const funSync = syncFunCapFromTreasury(vault, { now });
  return {
    treasury: allocationSummary(vault),
    fun_sync: funSync,
    budget: budgetSummary(vault, now),
  };
}

module.exports = {
  TreasuryError,
  allocationSummary,
  deleteBucket,
  ensureTreasury,
  hourlyRate,
  setIncome,
  skipToInvest,
  syncFunCapFromTreasury,
  trueCost,
  updateTreasury,
  upsertBucket,
};
