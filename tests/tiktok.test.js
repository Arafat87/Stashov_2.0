const test = require('node:test');
const assert = require('node:assert/strict');

const { extractTikTokLinks, tikTokVideoId } = require('../lib/tiktok');

test('extractTikTokLinks reads the data-download JSON shape', () => {
  const content = JSON.stringify({
    Activity: {
      'Favorite Videos': {
        FavoriteVideoList: [
          { Date: '2026-01-02 10:00', Link: 'https://www.tiktok.com/@chef/video/7310000000000000001' },
          { Date: '2026-01-03 11:00', Link: 'https://www.tiktok.com/@chef/video/7310000000000000001' },
          { Date: '2026-01-04 12:00', Link: 'https://www.tiktok.com/@glow/video/7310000000000000002', Title: 'Routine' },
        ],
      },
    },
  });
  const links = extractTikTokLinks(content);
  assert.equal(links.length, 2);
  assert.equal(links[0].date, '2026-01-02 10:00');
  assert.equal(links[1].title, 'Routine');
});

test('extractTikTokLinks falls back to a URL scan for TXT exports', () => {
  const txt = 'Date: 2026-01-02\nLink: https://www.tiktok.com/@a/video/7310000000000000009\nnote https://example.com/not-tiktok';
  const links = extractTikTokLinks(txt);
  assert.equal(links.length, 1);
  assert.match(links[0].url, /7310000000000000009/);
  assert.deepEqual(extractTikTokLinks('no links here'), []);
  assert.deepEqual(extractTikTokLinks(''), []);
});

test('tikTokVideoId pulls the numeric id', () => {
  assert.equal(tikTokVideoId('https://www.tiktok.com/@a/video/7312345678901234567?x=1'), '7312345678901234567');
  assert.equal(tikTokVideoId('https://www.tiktok.com/@a'), '');
});
