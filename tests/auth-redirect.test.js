const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// getJSON is the single funnel for every app API call. A 401 means the
// session is missing or expired, so it must send the browser to /unlock
// instead of leaving a signed-out shell on screen.
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const start = appSource.indexOf('async function getJSON(url, options) {');
const end = appSource.indexOf('\nconst sendJSON');
assert.ok(start > -1 && end > start, 'getJSON should be extractable from public/app.js');
const helperSource = appSource.slice(start, end);

function runHelper({ status, body }) {
  let redirected = null;
  const fakeFetch = async () => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
  });
  const fakeWindow = { location: { assign: (url) => { redirected = url; } } };
  const load = new Function('fetch', 'window', `${helperSource}\nreturn getJSON;`);
  const getJSON = load(fakeFetch, fakeWindow);
  return { getJSON, redirected: () => redirected };
}

test('a 401 from any API call redirects to /unlock', async () => {
  const { getJSON, redirected } = runHelper({ status: 401, body: '{"error":"Unlock Stashov before using the API."}' });
  await assert.rejects(getJSON('/api/vault'), /Unlock required/);
  assert.equal(redirected(), '/unlock');
});

test('successful calls return data without redirecting', async () => {
  const { getJSON, redirected } = runHelper({ status: 200, body: '{"ok":true}' });
  assert.deepEqual(await getJSON('/api/vault'), { ok: true });
  assert.equal(redirected(), null);
});

test('non-auth failures throw without redirecting', async () => {
  const { getJSON, redirected } = runHelper({ status: 500, body: '{"error":"boom"}' });
  await assert.rejects(getJSON('/api/vault'), /boom/);
  assert.equal(redirected(), null);
});
