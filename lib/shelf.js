'use strict';

/**
 * Stashov — Shelf: closet/shelf photo scans for the Palace Shelf of Proof.
 *
 * A closet photo goes to Muse Spark's multimodal tier, which returns the
 * visible items as structured JSON; the merge step dedupes them into the
 * owned inventory the Impulse Gate checks against. Pixel-precise SAM 3.1
 * masks are the planned upgrade — SAM answers over the streaming Responses
 * API with a special-token protocol, so the structured Spark pass ships first
 * and carries the demo beat (photo -> owned items -> visual duplicate block).
 */

const { callMetaChat, metaModels } = require('./meta');

const MAX_SCAN_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_SCAN_ITEMS = 30;
const MAX_INVENTORY = 30;
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;

class ShelfError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ShelfError';
    this.status = status;
  }
}

function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function parseImageDataUrl(value) {
  const text = String(value || '').trim();
  const match = text.match(DATA_URL_PATTERN);
  if (!match) {
    throw new ShelfError('Send the photo as a data:image/jpeg, png, or webp base64 data URL.');
  }
  const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!bytes.length) throw new ShelfError('That data URL holds no image bytes.');
  if (bytes.length > MAX_SCAN_IMAGE_BYTES) {
    throw new ShelfError('Photos are limited to 5 MB. Shrink the image and try again.', 413);
  }
  return { mime: match[1], bytes, dataUrl: text };
}

function buildClosetScanMessages(dataUrl, hint = '') {
  const trimmedHint = clean(hint, 200);
  return [
    {
      role: 'system',
      content: 'You are Stashov Shelf, a precise visual inventory clerk. You list physical items visible in closet and shelf photos as strict JSON. Never invent items that are not visible.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: [
            'List every distinct clothing, fragrance, skincare, footwear, accessory, or gear item visible in this photo.',
            'Group identical items with a count instead of repeating them.',
            'Reply with JSON only, no code fences and no commentary:',
            '{"items":[{"name":"Charcoal pullover hoodie","category":"Menswear","brand":"BYLT","color":"charcoal","count":2}]}',
            trimmedHint ? `Context from the user: ${trimmedHint}` : '',
          ].filter(Boolean).join('\n'),
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];
}

function unfence(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function parseClosetScan(content) {
  let parsed = null;
  try {
    parsed = JSON.parse(unfence(content));
  } catch (_) {
    parsed = null;
  }
  const rows = parsed && Array.isArray(parsed.items) ? parsed.items : null;
  if (!rows || !rows.length) {
    throw new ShelfError('The closet scan returned no usable items. Retake the photo with the shelf in frame.', 502);
  }
  const items = [];
  for (const row of rows) {
    const name = clean(row && row.name, 140);
    if (!name) continue;
    const count = Math.floor(Number(row.count));
    items.push({
      name,
      category: clean(row.category, 60) || 'Uncategorized',
      brand: clean(row.brand, 100),
      color: clean(row.color, 60),
      count: Number.isFinite(count) && count > 0 ? count : 1,
    });
    if (items.length >= MAX_SCAN_ITEMS) break;
  }
  if (!items.length) {
    throw new ShelfError('The closet scan returned no usable items. Retake the photo with the shelf in frame.', 502);
  }
  return items;
}

/**
 * Run the multimodal scan. Offline (no key / HTTP error) resolves to
 * { live: false }; a live but unparseable response throws ShelfError (502).
 */
async function scanClosetImage(dataUrl, options = {}) {
  const model = metaModels().agent;
  const started = Date.now();
  const result = await callMetaChat(
    model,
    buildClosetScanMessages(dataUrl, options.hint),
    1200,
    { temperature: 0.1, timeout_ms: options.timeout_ms }
  );
  if (!result.live || !result.content) {
    return { live: false, latency_ms: result.latency_ms, model, items: [], usage: null };
  }
  return {
    live: true,
    latency_ms: result.latency_ms,
    model,
    items: parseClosetScan(result.content),
    usage: result.usage || null,
  };
}

function normaliseName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mergeScanIntoInventory(vault, items, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const stamp = Number.isNaN(now.getTime()) ? new Date() : now;
  const context = vault.personal_context || (vault.personal_context = {});
  if (!Array.isArray(context.owned_inventory)) context.owned_inventory = [];
  const seen = new Set(context.owned_inventory.map((item) => normaliseName(item && item.name)));
  const added = [];
  const duplicates = [];
  let capped = 0;
  for (const row of Array.isArray(items) ? items : []) {
    const name = clean(row && row.name, 140);
    if (!name) continue;
    if (seen.has(normaliseName(name))) {
      duplicates.push(name);
      continue;
    }
    if (context.owned_inventory.length >= MAX_INVENTORY) {
      capped += 1;
      continue;
    }
    const color = clean(row.color, 60);
    const count = Math.floor(Number(row.count));
    const record = {
      id: `own_scan_${stamp.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      category: clean(row.category, 60) || 'Uncategorized',
      brand: clean(row.brand, 100),
      notes: clean(
        `Closet scan${color ? `: ${color}` : ''}${Number.isFinite(count) && count > 1 ? ` x${count}` : ''} — ${stamp.toISOString().slice(0, 10)}`,
        300
      ),
      status: 'Closet scan',
    };
    context.owned_inventory.push(record);
    seen.add(normaliseName(name));
    added.push(record);
  }
  return { added, duplicates, capped };
}

module.exports = {
  ShelfError,
  buildClosetScanMessages,
  mergeScanIntoInventory,
  parseClosetScan,
  parseImageDataUrl,
  scanClosetImage,
};
