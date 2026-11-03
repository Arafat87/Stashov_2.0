const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeTags, isReferenceBookmark } = require('../lib/tags');

test('sanitizeTags trims, dedupes case-insensitively, and caps count/length', () => {
  const { tags, error } = sanitizeTags(['  Skin Care ', 'skincare', '', 'a'.repeat(40), 'video', 'Video', 'x']);
  assert.equal(error, null);
  assert.equal(tags[0], 'Skin Care');
  assert.ok(!tags.some((t) => t.toLowerCase() === 'video' && t !== 'video'));
  assert.ok(tags.every((t) => t.length <= 28));
  const many = sanitizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`));
  assert.equal(many.tags.length, 12);
});

test('sanitizeTags rejects non-lists', () => {
  assert.equal(sanitizeTags('video').tags, null);
  assert.match(sanitizeTags(null).error, /list/);
});

test('isReferenceBookmark recognises captures and reference-tagged items', () => {
  assert.equal(isReferenceBookmark({ original_folder: 'Ingest Studio (URL)' }), true);
  assert.equal(isReferenceBookmark({ original_folder: 'TikTok Import' }), true);
  assert.equal(isReferenceBookmark({ original_folder: 'Shopping', tags: ['reference'] }), true);
  assert.equal(isReferenceBookmark({ original_folder: 'Shopping', tags: ['sale'] }), false);
  assert.equal(isReferenceBookmark(null), false);
});
