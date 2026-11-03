'use strict';

/**
 * Notes: the Refs board's primary content.
 *
 * Notes live on the vault (vault.notes) with user-owned categories
 * (vault.note_categories). Scans (URL text, pasted notes, videos) file
 * notes automatically; the user can also create, edit and delete notes,
 * categories and tags. All helpers are pure vault transforms — the
 * server persists with saveVault and tests need no IO.
 */

const { sanitizeTags } = require('./tags');

const DEFAULT_CATEGORIES = [
  { id: 'routines', label: 'Routines', color: '#3d6b4c' },
  { id: 'products', label: 'Products', color: '#a96f12' },
  { id: 'ideas', label: 'Ideas', color: '#31517e' },
  { id: 'reference', label: 'Reference', color: '#96603a' },
];
const FALLBACK_CATEGORY = 'reference';
const MAX_BODY = 6000;

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function slug(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function ensureNotesState(vault) {
  if (!vault || typeof vault !== 'object') return vault;
  if (!Array.isArray(vault.notes)) vault.notes = [];
  if (!Array.isArray(vault.note_categories) || !vault.note_categories.length) {
    vault.note_categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  }
  return vault;
}

function categoryExists(vault, id) {
  return (vault.note_categories || []).some((c) => c.id === id);
}

function createNote(vault, input = {}, now = new Date()) {
  ensureNotesState(vault);
  const stamp = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const { tags } = sanitizeTags(Array.isArray(input.tags) ? input.tags : []);
  const category = categoryExists(vault, input.category) ? input.category : FALLBACK_CATEGORY;
  const note = {
    id: `note_${stamp.getTime().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: clean(input.title, 160) || 'Untitled note',
    body: clean(input.body, MAX_BODY),
    category,
    tags: tags || [],
    source_url: clean(input.source_url, 500),
    source_type: clean(input.source_type, 30) || 'manual',
    created_at: stamp.toISOString(),
    updated_at: stamp.toISOString(),
  };
  vault.notes.unshift(note);
  return note;
}

function updateNote(vault, id, input = {}) {
  ensureNotesState(vault);
  const note = (vault.notes || []).find((n) => n.id === id);
  if (!note) return null;
  if (input.title !== undefined) note.title = clean(input.title, 160) || note.title;
  if (input.body !== undefined) note.body = clean(input.body, MAX_BODY);
  if (input.category !== undefined && categoryExists(vault, input.category)) note.category = input.category;
  if (input.tags !== undefined) {
    const { tags } = sanitizeTags(input.tags);
    if (tags) note.tags = tags;
  }
  note.updated_at = new Date().toISOString();
  return note;
}

function deleteNote(vault, id) {
  ensureNotesState(vault);
  const index = (vault.notes || []).findIndex((n) => n.id === id);
  if (index < 0) return null;
  const [removed] = vault.notes.splice(index, 1);
  return removed;
}

function upsertCategory(vault, input = {}, id = null) {
  ensureNotesState(vault);
  const label = clean(input.label, 60);
  if (!label) return { category: null, error: 'Give the category a name.' };
  if (id) {
    const existing = vault.note_categories.find((c) => c.id === id);
    if (!existing) return { category: null, error: 'Category not found.' };
    existing.label = label;
    if (input.color) existing.color = clean(input.color, 20);
    return { category: existing, error: null };
  }
  let newId = slug(label) || `cat_${Date.now().toString(36)}`;
  if (categoryExists(vault, newId)) newId = `${newId}-${Date.now().toString(36).slice(-3)}`;
  const category = { id: newId, label, color: clean(input.color, 20) || '#96603a' };
  vault.note_categories.push(category);
  return { category, error: null };
}

function deleteCategory(vault, id) {
  ensureNotesState(vault);
  const index = (vault.note_categories || []).findIndex((c) => c.id === id);
  if (index < 0) return null;
  const [removed] = vault.note_categories.splice(index, 1);
  const fallback = categoryExists(vault, FALLBACK_CATEGORY)
    ? FALLBACK_CATEGORY
    : (vault.note_categories[0] && vault.note_categories[0].id) || FALLBACK_CATEGORY;
  let moved = 0;
  for (const note of vault.notes || []) {
    if (note.category === id) { note.category = fallback; moved += 1; }
  }
  return { removed, moved, fallback };
}

/** Remove one tag from every note. Returns how many notes changed. */
function stripTag(vault, tag) {
  ensureNotesState(vault);
  const target = String(tag || '').trim().toLowerCase();
  if (!target) return 0;
  let changed = 0;
  for (const note of vault.notes || []) {
    const before = (note.tags || []).length;
    note.tags = (note.tags || []).filter((t) => t.toLowerCase() !== target);
    if (note.tags.length !== before) changed += 1;
  }
  return changed;
}

function listNotes(vault, filters = {}) {
  ensureNotesState(vault);
  const category = String(filters.category || 'ALL');
  const tag = String(filters.tag || '').trim().toLowerCase();
  const q = String(filters.q || '').trim().toLowerCase();
  return (vault.notes || []).filter((note) => {
    if (category !== 'ALL' && note.category !== category) return false;
    if (tag && !(note.tags || []).some((t) => t.toLowerCase() === tag)) return false;
    if (q) {
      const hay = `${note.title} ${note.body} ${(note.tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

module.exports = {
  DEFAULT_CATEGORIES,
  createNote,
  deleteCategory,
  deleteNote,
  ensureNotesState,
  listNotes,
  stripTag,
  updateNote,
  upsertCategory,
};
