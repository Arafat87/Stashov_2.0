'use strict';

/**
 * Seed the Judge Mode demo persona: a compact, self-consistent vault for
 * "Jordan" with income buckets, a closet, gated wishes in every lane, a
 * decision journal, and 36 bookmarks. All dates are relative to seed time;
 * lib/persona.js rebases them to load time so cooling timers always look alive.
 *
 * Usage: npm run seed-persona
 */

const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;
const OUT_PATH = path.join(__dirname, '..', 'data', 'persona-vault.json');

function iso(time) {
  return new Date(time).toISOString();
}

function monthKey(time) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function wish(base) {
  return {
    id: base.id,
    title: base.title,
    category: base.category || 'Unclustered',
    brand: base.brand || '',
    url: base.url || '',
    domain: base.domain || '',
    retail_price: base.retail_price ?? null,
    lowest_verified_price: base.lowest_verified_price ?? null,
    price_currency: 'USD',
    price_status: base.lowest_verified_price ? 'captured' : 'missing',
    price_source: base.lowest_verified_price ? 'page' : '',
    price_confidence: base.lowest_verified_price ? 'high' : '',
    price_captured_at: base.price_captured_at || null,
    price_checked_at: base.price_checked_at || null,
    target_price: base.target_price ?? null,
    price_history: base.price_history || [],
    cooling_off_days: 14,
    added_at: base.added_at,
    unlock_at: base.unlock_at,
    status: base.status || 'cooling',
    cooling_off_days_left: base.cooling_off_days_left ?? 14,
    cooling_status: base.cooling_status || 'Cooling Off',
    snoozed_until: base.snoozed_until || null,
    snoozed_at: base.snoozed_at || null,
    snooze_count: base.snooze_count || 0,
    snooze_note: base.snooze_note || '',
    purchased_at: base.purchased_at || null,
    purchase_price: base.purchase_price ?? null,
    purchase_source: base.purchase_source || '',
    purchase_note: base.purchase_note || '',
    skipped_at: base.skipped_at || null,
    skip_reason: base.skip_reason || '',
    inventory_overlap: base.inventory_overlap || '',
    routine_compatibility: base.routine_compatibility || '',
    best_source: base.best_source || '',
    dupe_alternative: base.dupe_alternative || '',
    verdict_label: base.verdict_label || 'GATE ACTIVE — REVIEW',
    uses_per_month: base.uses_per_month ?? 4,
    cost_per_use: base.lowest_verified_price ? Math.round((base.lowest_verified_price / 4) * 100) / 100 : null,
    image: '',
  };
}

function buildPersona(now) {
  const ago = (days) => now - days * DAY_MS;
  const ahead = (days) => now + days * DAY_MS;

  const wishlist = [
    wish({
      id: 'demo_w1', title: 'Charcoal Wool Overcoat', category: 'Menswear & Streetwear',
      brand: 'Suitsupply', retail_price: 429, lowest_verified_price: 349,
      added_at: iso(ago(13)), unlock_at: iso(ahead(1)),
      price_captured_at: iso(ago(13)), price_checked_at: iso(ago(1)),
      price_history: [
        { at: iso(ago(13)), price: 429, source: 'capture', confidence: 'high' },
        { at: iso(ago(1)), price: 349, source: 'refresh', confidence: 'high' },
      ],
      inventory_overlap: 'Owns Black Quilted Winter Parka — 1-in-1-out rule applies.',
      best_source: 'Suitsupply seasonal sale',
    }),
    wish({
      id: 'demo_w2', title: 'Swiss Oud EDP 100ml', category: 'Fragrances & Cologne',
      brand: 'Swiss Arabian', retail_price: 189, lowest_verified_price: 189,
      added_at: iso(ago(8)), unlock_at: iso(ahead(6)),
      price_captured_at: iso(ago(8)), price_checked_at: iso(ago(8)),
      price_history: [{ at: iso(ago(8)), price: 189, source: 'capture', confidence: 'high' }],
      inventory_overlap: 'Owns Shaghaf Oud (85% full) — same woody-amber lane.',
      dupe_alternative: 'Olfactory Factory dupe, ~$45',
    }),
    wish({
      id: 'demo_w3', title: 'Ceramic Pour-Over Coffee Set', category: 'Food, Halal & Specialty Groceries',
      brand: 'Hario', retail_price: 85, lowest_verified_price: 85,
      added_at: iso(ago(2)), unlock_at: iso(ahead(12)),
      price_captured_at: iso(ago(2)), price_checked_at: iso(ago(2)),
      price_history: [{ at: iso(ago(2)), price: 85, source: 'capture', confidence: 'high' }],
    }),
    wish({
      id: 'demo_w4', title: 'Quince Cashmere Hoodie', category: 'Menswear & Streetwear',
      brand: 'Quince', retail_price: 150, lowest_verified_price: 119, target_price: 130,
      added_at: iso(ago(20)), unlock_at: iso(ago(6)),
      price_captured_at: iso(ago(20)), price_checked_at: iso(ago(1)),
      price_history: [
        { at: iso(ago(20)), price: 150, source: 'capture', confidence: 'high' },
        { at: iso(ago(9)), price: 135, source: 'refresh', confidence: 'high' },
        { at: iso(ago(1)), price: 119, source: 'refresh', confidence: 'high' },
      ],
      status: 'ready', verdict_label: 'TARGET HIT — REVIEW',
    }),
    wish({
      id: 'demo_w5', title: 'Thursday Captain Boots (Factory Seconds)', category: 'Watches, Footwear & Accessories',
      brand: 'Thursday', retail_price: 200, lowest_verified_price: 149,
      added_at: iso(ago(25)), unlock_at: iso(ago(11)),
      price_captured_at: iso(ago(25)), price_checked_at: iso(ago(3)),
      price_history: [
        { at: iso(ago(25)), price: 200, source: 'capture', confidence: 'high' },
        { at: iso(ago(3)), price: 149, source: 'refresh', confidence: 'high' },
      ],
      status: 'ready',
    }),
    wish({
      id: 'demo_w6', title: 'Ultra Light Down Vest', category: 'Menswear & Streetwear',
      brand: 'Uniqlo', retail_price: 99, lowest_verified_price: 99,
      added_at: iso(ago(30)), unlock_at: iso(ago(16)),
      price_captured_at: iso(ago(30)), price_checked_at: iso(ago(2)),
      price_history: [{ at: iso(ago(30)), price: 99, source: 'capture', confidence: 'high' }],
      status: 'bought', purchased_at: iso(ago(2)), purchase_price: 99,
      purchase_source: 'Uniqlo', purchase_note: 'Price dropped below $100 target',
      verdict_label: 'BOUGHT',
    }),
    wish({
      id: 'demo_w7', title: 'Santal Scented Candle Trio', category: 'Fragrances & Cologne',
      brand: 'Maison Gift', retail_price: 95, lowest_verified_price: 95,
      added_at: iso(ago(18)), unlock_at: iso(ago(4)),
      price_captured_at: iso(ago(18)), price_checked_at: iso(ago(3)),
      price_history: [{ at: iso(ago(18)), price: 95, source: 'capture', confidence: 'high' }],
      status: 'skipped', skipped_at: iso(ago(3)), skip_reason: 'Cute but not $95 cute',
      verdict_label: 'SKIPPED',
    }),
    wish({
      id: 'demo_w8', title: 'Burr Espresso Grinder', category: 'Food, Halal & Specialty Groceries',
      brand: 'Baratza', retail_price: 229, lowest_verified_price: 229,
      added_at: iso(ago(16)), unlock_at: iso(ago(2)),
      price_captured_at: iso(ago(16)), price_checked_at: iso(ago(5)),
      price_history: [{ at: iso(ago(16)), price: 229, source: 'capture', confidence: 'high' }],
      status: 'snoozed', snoozed_until: iso(ahead(10)), snoozed_at: iso(ago(5)),
      snooze_count: 1, snooze_note: 'Wait for the holiday sale',
    }),
  ];

  const bookmarks = [];
  const shelves = [
    ['Fragrances & Cologne', 'fragrancex.com', ['cologne', 'deals'], 6],
    ['Menswear & Streetwear', 'quince.com', ['wardrobe', 'basics'], 6],
    ['Skincare, Health & Protocols', 'reddit.com', ['routine', 'skincare'], 6],
    ['Watches, Footwear & Accessories', 'thursdayboots.com', ['boots', 'seconds'], 6],
    ['Food, Halal & Specialty Groceries', 'homegrounds.com', ['coffee', 'gear'], 6],
    ['Career, Jobs & Interview Prep', 'levels.fyi', ['career', 'salary'], 6],
  ];
  let counter = 0;
  for (const [category, domain, tags, count] of shelves) {
    for (let i = 0; i < count; i += 1) {
      counter += 1;
      bookmarks.push({
        id: `demo_b${String(counter).padStart(2, '0')}`,
        title: `Demo save ${counter}: ${tags[0]} notes from ${domain}`,
        url: `https://www.${domain}/demo-save-${counter}`,
        domain,
        original_folder: 'Demo',
        browser: 'Chrome',
        category,
        subcategory: '',
        item_type: 'link',
        tags,
        snapshot_status: 'Archived',
        rot_status: 'alive',
        embedding: [],
      });
    }
  }

  return {
    meta: { persona: true, persona_name: 'Jordan', seeded_at: iso(now), gate_schema_version: 3 },
    personal_context: {
      owner: 'Jordan (demo persona)',
      location: 'New York, NY',
      monthly_discretionary_budget: 800,
      spent_this_month: 99,
      budget_month: monthKey(now),
      default_cooling_off_days: 14,
      sizes: { tops: 'M', shoes: 'US 10' },
      skin_and_health_constraints: ['Oily, acne-prone skin', 'Fragrance oils OK, no parabens'],
      fragrance_profile: { loved: ['oud', 'amber'], avoided: ['aquatic'] },
      owned_inventory: [
        { id: 'demo_own_1', name: 'Black Quilted Winter Parka', category: 'Menswear & Streetwear', brand: 'Tokyo Laundry', notes: 'Covers winter to 15F. No duplicate black puffer needed.', status: 'Active in Closet' },
        { id: 'demo_own_2', name: 'Charcoal Pullover Hoodie', category: 'Menswear & Streetwear', brand: 'BYLT', notes: 'Closet scan: charcoal x2', status: 'Closet scan' },
        { id: 'demo_own_3', name: 'Shaghaf Oud EDP 75ml', category: 'Fragrances & Cologne', brand: 'Swiss Arabian', notes: '85% full. Covers sweet oud occasions.', status: 'On Shelf (85% full)' },
        { id: 'demo_own_4', name: 'Adapalene Gel 0.1%', category: 'Skincare, Health & Protocols', brand: 'Differin', notes: 'PM retinoid — blocks leave-on acids in the PM window.', status: 'Active Routine' },
        { id: 'demo_own_5', name: 'White Leather Sneakers', category: 'Watches, Footwear & Accessories', brand: 'Koio', notes: 'Closet scan: white', status: 'Closet scan' },
        { id: 'demo_own_6', name: 'Cast-Iron Skillet 12in', category: 'Food, Halal & Specialty Groceries', brand: 'Lodge', notes: 'Daily driver. No duplicate pans.', status: 'Owned' },
      ],
    },
    treasury: {
      yearly_income: 96000,
      currency: 'USD',
      buckets: [
        { id: 'demo_bkt_rent', name: 'Rent', yearly_amount: 28800, percent: null, feeds_fun_money: false, color: '', created_at: iso(ago(60)), updated_at: iso(ago(60)) },
        { id: 'demo_bkt_fun', name: 'Fun Money', yearly_amount: null, percent: 10, feeds_fun_money: true, color: '', created_at: iso(ago(60)), updated_at: iso(ago(60)) },
        { id: 'demo_bkt_inv', name: 'Investments', yearly_amount: null, percent: 15, feeds_fun_money: false, color: '', created_at: iso(ago(60)), updated_at: iso(ago(60)) },
        { id: 'demo_bkt_groc', name: 'Groceries', yearly_amount: 9600, percent: null, feeds_fun_money: false, color: '', created_at: iso(ago(60)), updated_at: iso(ago(60)) },
      ],
      updated_at: iso(ago(60)),
    },
    wishlist,
    spending_ledger: [
      {
        id: 'demo_led_1', item_id: 'demo_w6', title: 'Ultra Light Down Vest',
        category: 'Menswear & Streetwear', amount: 99, currency: 'USD',
        spent_at: iso(ago(2)), month: monthKey(ago(2)), source: 'Uniqlo',
        note: 'Price dropped below $100 target', voided: false, created_at: iso(ago(2)),
      },
    ],
    decision_journal: [
      { id: 'demo_dec_1', at: iso(ago(2)), decision: 'bought', item_id: 'demo_w6', title: 'Ultra Light Down Vest', category: 'Menswear & Streetwear', amount: 99, reason: 'Price dropped below $100 target' },
      { id: 'demo_dec_2', at: iso(ago(3)), decision: 'skipped', item_id: 'demo_w7', title: 'Santal Scented Candle Trio', category: 'Fragrances & Cologne', amount: 95, reason: 'Cute but not $95 cute' },
      { id: 'demo_dec_3', at: iso(ago(5)), decision: 'snoozed', item_id: 'demo_w8', title: 'Burr Espresso Grinder', category: 'Food, Halal & Specialty Groceries', amount: 229, reason: 'Wait for the holiday sale' },
    ],
    protocols: [
      {
        id: 'demo_proto_1', title: 'Clear Skin PM Split', category: 'Skincare, Health & Protocols',
        schedule: 'Daily — 10:30 PM', credibility_badge: 'Dermatology Backed',
        source_platform: 'YouTube derm roundup', snapshot_status: 'Archived',
        conflict_alert: 'ACTIVE GUARDRAIL: Blocks leave-on AHA/BHA in the PM window with 0.1% Adapalene.',
        steps: ['Double cleanse to remove sunscreen.', 'Pea-sized 0.1% Adapalene on dry skin.', 'Ceramide moisturizer.'],
        linked_wishlist_ids: [],
      },
      {
        id: 'demo_proto_2', title: 'Morning Energy Stack', category: 'Skincare, Health & Protocols',
        schedule: 'Daily — 7:00 AM', credibility_badge: 'Mixed Evidence',
        source_platform: 'Podcast notes', snapshot_status: 'Archived', conflict_alert: '',
        steps: ['500ml water + electrolytes.', '20g protein within an hour of waking.', '10-minute walk before screens.'],
        linked_wishlist_ids: [],
      },
    ],
    routine_log: {},
    telemetry: [],
    last_digest: null,
    bookmarks,
  };
}

function main() {
  const vault = buildPersona(Date.now());
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(vault, null, 2)}\n`, 'utf8');
  console.log(`Persona written: ${OUT_PATH}`);
  console.log(`  bookmarks=${vault.bookmarks.length} wishlist=${vault.wishlist.length} protocols=${vault.protocols.length} journal=${vault.decision_journal.length}`);
}

if (require.main === module) main();

module.exports = { buildPersona };
