const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createNote, deleteCategory, deleteNote, ensureNotesState,
  listNotes, stripTag, updateNote, upsertCategory,
} = require('../lib/notes');

function vault() {
  return ensureNotesState({ bookmarks: [], wishlist: [], protocols: [] });
}

test('ensureNotesState seeds default categories once', () => {
  const v = vault();
  assert.deepEqual(v.notes, []);
  assert.ok(v.note_categories.some((c) => c.id === 'reference'));
  const before = v.note_categories;
  ensureNotesState(v);
  assert.equal(v.note_categories, before);
});

test('notes create, update, filter and delete', () => {
  const v = vault();
  const a = createNote(v, { title: 'PM routine', body: 'Cleanse, treat, moisturise.', category: 'routines', tags: ['skincare', 'pm'] });
  const b = createNote(v, { title: 'Gift idea', body: 'Candle for Sara.', category: 'ideas', tags: ['gift'] });
  assert.equal(v.notes.length, 2);
  assert.equal(listNotes(v, { category: 'routines' }).length, 1);
  assert.equal(listNotes(v, { tag: 'gift' })[0].id, b.id);
  assert.equal(listNotes(v, { q: 'cleanse' })[0].id, a.id);
  const updated = updateNote(v, a.id, { body: 'Updated body.', tags: ['pm-only'] });
  assert.equal(updated.body, 'Updated body.');
  assert.deepEqual(updated.tags, ['pm-only']);
  assert.equal(updateNote(v, 'note_missing', { title: 'x' }), null);
  assert.equal(deleteNote(v, b.id).id, b.id);
  assert.equal(deleteNote(v, b.id), null);
  assert.equal(v.notes.length, 1);
});

test('unknown note category falls back to reference', () => {
  const v = vault();
  const note = createNote(v, { title: 'x', category: 'nope' });
  assert.equal(note.category, 'reference');
});

test('categories create, rename, and delete moves notes to fallback', () => {
  const v = vault();
  const { category, error } = upsertCategory(v, { label: 'Home Lab' });
  assert.equal(error, null);
  assert.equal(category.id, 'home-lab');
  const note = createNote(v, { title: 'Desk setup', category: 'home-lab' });
  const renamed = upsertCategory(v, { label: 'Studio' }, 'home-lab');
  assert.equal(renamed.category.label, 'Studio');
  const result = deleteCategory(v, 'home-lab');
  assert.equal(result.moved, 1);
  assert.equal(note.category, 'reference');
  assert.equal(deleteCategory(v, 'home-lab'), null);
  assert.equal(upsertCategory(v, { label: '  ' }).category, null);
});

test('stripTag removes a tag from every note', () => {
  const v = vault();
  createNote(v, { title: 'a', tags: ['sale', 'x'] });
  createNote(v, { title: 'b', tags: ['Sale'] });
  createNote(v, { title: 'c', tags: ['y'] });
  assert.equal(stripTag(v, 'sale'), 2);
  assert.ok(v.notes.every((n) => !(n.tags || []).some((t) => t.toLowerCase() === 'sale')));
  assert.equal(stripTag(v, ''), 0);
});
