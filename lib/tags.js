'use strict';

/** Shared bookmark-tag rules for the tag editor endpoint and its tests. */

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 28;

function sanitizeTags(input) {
  if (!Array.isArray(input)) return { tags: null, error: 'Tags must be a list.' };
  const seen = new Set();
  const tags = [];
  for (const raw of input) {
    const tag = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH).trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return { tags, error: null };
}

/** Captures (Capture Studio, TikTok import, video mode) live on the Refs board. */
function isReferenceBookmark(bookmark) {
  if (!bookmark || typeof bookmark !== 'object') return false;
  const folder = String(bookmark.original_folder || '');
  if (folder.startsWith('Ingest Studio') || folder === 'TikTok Import') return true;
  const tags = Array.isArray(bookmark.tags) ? bookmark.tags : [];
  return tags.includes('reference');
}

module.exports = { MAX_TAGS, MAX_TAG_LENGTH, sanitizeTags, isReferenceBookmark };
