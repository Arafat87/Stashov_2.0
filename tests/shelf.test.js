const test = require('node:test');
const assert = require('node:assert/strict');

const shelf = require('../lib/shelf');

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function emptyVault() {
  return { personal_context: { owned_inventory: [] } };
}

test('parseImageDataUrl accepts jpeg/png/webp data URLs', () => {
  const parsed = shelf.parseImageDataUrl(PIXEL);
  assert.equal(parsed.mime, 'image/png');
  assert.ok(parsed.bytes.length > 0);
  assert.equal(parsed.dataUrl, PIXEL);
  const jpg = shelf.parseImageDataUrl('data:image/jpeg;base64,/9j/2Q==');
  assert.equal(jpg.mime, 'image/jpeg');
});

test('parseImageDataUrl rejects non-images, malformed, and oversized input', () => {
  assert.throws(() => shelf.parseImageDataUrl('https://example.com/pic.png'), (err) => err.status === 400);
  assert.throws(() => shelf.parseImageDataUrl('data:image/png;base64,!!!'), (err) => err.status === 400);
  assert.throws(() => shelf.parseImageDataUrl('data:image/gif;base64,R0lGODw=='), (err) => err.status === 400);
  const big = `data:image/png;base64,${'A'.repeat(7 * 1024 * 1024)}`;
  assert.throws(() => shelf.parseImageDataUrl(big), (err) => err.status === 413);
});

test('buildClosetScanMessages carries the image and hint as multimodal parts', () => {
  const messages = shelf.buildClosetScanMessages(PIXEL, 'winter closet');
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  const user = messages[1];
  assert.equal(user.role, 'user');
  assert.ok(Array.isArray(user.content));
  const text = user.content.find((part) => part.type === 'text').text;
  assert.match(text, /winter closet/);
  assert.match(text, /JSON/);
  const image = user.content.find((part) => part.type === 'image_url');
  assert.equal(image.image_url.url, PIXEL);
});

test('parseClosetScan reads plain and fenced JSON, skips nameless rows', () => {
  const plain = shelf.parseClosetScan('{"items":[{"name":"Charcoal Hoodie","category":"Menswear","brand":"BYLT","color":"charcoal","count":2}]}');
  assert.equal(plain.length, 1);
  assert.deepEqual(plain[0], { name: 'Charcoal Hoodie', category: 'Menswear', brand: 'BYLT', color: 'charcoal', count: 2 });

  const fenced = shelf.parseClosetScan('```json\n{"items":[{"name":"Parka"}]}\n```');
  assert.equal(fenced.length, 1);
  assert.equal(fenced[0].name, 'Parka');
  assert.equal(fenced[0].category, 'Uncategorized');
  assert.equal(fenced[0].count, 1);

  const skipped = shelf.parseClosetScan('{"items":[{"name":"  "},{"name":"Kept"}]}');
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].name, 'Kept');
});

test('parseClosetScan caps items and rejects garbage', () => {
  const many = { items: Array.from({ length: 40 }, (_, i) => ({ name: `Item ${i}` })) };
  assert.equal(shelf.parseClosetScan(JSON.stringify(many)).length, 30);
  assert.throws(() => shelf.parseClosetScan('no json here'), (err) => err.status === 502);
  assert.throws(() => shelf.parseClosetScan('{"items":[]}'), (err) => err.status === 502);
});

test('scanClosetImage returns items on a live call', async () => {
  process.env.MODEL_API_KEY = 'test-key-123';
  const realFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '{"items":[{"name":"Charcoal Hoodie"}]}' } }],
      usage: { prompt_tokens: 400, completion_tokens: 60 },
    }),
  });
  try {
    const result = await shelf.scanClosetImage(PIXEL, { hint: 'closet' });
    assert.equal(result.live, true);
    assert.equal(result.model, 'muse-spark-1.3');
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].name, 'Charcoal Hoodie');
    assert.deepEqual(result.usage, { prompt_tokens: 400, completion_tokens: 60 });
  } finally {
    global.fetch = realFetch;
    delete process.env.MODEL_API_KEY;
  }
});

test('scanClosetImage maps API failures to offline without throwing', async () => {
  process.env.MODEL_API_KEY = 'test-key-123';
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  try {
    const result = await shelf.scanClosetImage(PIXEL);
    assert.equal(result.live, false);
    assert.deepEqual(result.items, []);
  } finally {
    global.fetch = realFetch;
    delete process.env.MODEL_API_KEY;
  }
});

test('mergeScanIntoInventory appends new items with scan notes', () => {
  const vault = emptyVault();
  const result = shelf.mergeScanIntoInventory(vault, [
    { name: 'Charcoal Hoodie', category: 'Menswear', brand: 'BYLT', color: 'charcoal', count: 2 },
  ], { now: '2026-10-31T12:00:00.000Z' });
  assert.equal(result.added.length, 1);
  assert.equal(result.duplicates.length, 0);
  const [item] = vault.personal_context.owned_inventory;
  assert.match(item.id, /^own_scan_/);
  assert.equal(item.name, 'Charcoal Hoodie');
  assert.equal(item.status, 'Closet scan');
  assert.match(item.notes, /charcoal/);
  assert.match(item.notes, /2/);
});

test('mergeScanIntoInventory dedupes case-insensitively and respects the 30 cap', () => {
  const vault = emptyVault();
  vault.personal_context.owned_inventory.push({
    id: 'own_01', name: 'Charcoal Hoodie', category: 'Menswear', brand: '', notes: '', status: 'Owned',
  });
  const result = shelf.mergeScanIntoInventory(vault, [
    { name: '  charcoal HOODIE!! ', category: 'Menswear' },
    { name: 'New Parka', category: 'Menswear' },
  ]);
  assert.equal(result.added.length, 1);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.added[0].name, 'New Parka');

  const full = emptyVault();
  full.personal_context.owned_inventory = Array.from({ length: 30 }, (_, i) => ({ id: `own_${i}`, name: `Owned ${i}` }));
  const capped = shelf.mergeScanIntoInventory(full, [{ name: 'One More' }]);
  assert.equal(capped.added.length, 0);
  assert.equal(capped.capped, 1);
});
