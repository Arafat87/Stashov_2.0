const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractRoutineSteps,
  parseCaptionTracks,
  parseSpottedProducts,
  parseVideoUrl,
  pickCaptionTrack,
  transcriptXmlToText,
} = require('../lib/video');

test('parseVideoUrl recognises platforms and ids', () => {
  assert.deepEqual(parseVideoUrl('https://www.youtube.com/watch?v=abc123XYZ_0&t=4'), {
    platform: 'youtube', id: 'abc123XYZ_0', url: 'https://www.youtube.com/watch?v=abc123XYZ_0&t=4',
  });
  assert.equal(parseVideoUrl('https://youtu.be/abc123XYZ_0').id, 'abc123XYZ_0');
  assert.equal(parseVideoUrl('https://www.youtube.com/shorts/abc123XYZ_0').id, 'abc123XYZ_0');
  assert.equal(parseVideoUrl('https://www.tiktok.com/@chef/video/7310000000000000001').platform, 'tiktok');
  assert.equal(parseVideoUrl('https://www.instagram.com/reel/Cxyz/').platform, 'instagram');
  assert.equal(parseVideoUrl('https://example.com/watch').platform, 'web');
  assert.equal(parseVideoUrl('not a url'), null);
});

test('caption tracks parse, prefer manual English, and XML flattens to text', () => {
  const html = 'xx "captionTracks":[{"baseUrl":"https://t.example/a","languageCode":"en","kind":"asr"},{"baseUrl":"https://t.example/b","languageCode":"en"},{"baseUrl":"https://t.example/c","languageCode":"fr"}] , yy';
  const tracks = parseCaptionTracks(html);
  assert.equal(tracks.length, 3);
  assert.equal(pickCaptionTrack(tracks).baseUrl, 'https://t.example/b');
  assert.equal(pickCaptionTrack([]), null);
  assert.equal(
    transcriptXmlToText('<text start="0">Hello &amp; welcome</text><text>back &#39;home&#39;</text>'),
    "Hello & welcome back 'home'"
  );
});

test('extractRoutineSteps needs steps plus a schedule hint', () => {
  const routine = extractRoutineSteps(
    'This is my morning routine for clear skin. Apply the gel cleanser to damp skin. Wait two minutes before rinsing. Then layer the toner gently. Finish with moisturiser and SPF.'
  );
  assert.ok(routine.steps.length >= 2);
  assert.equal(routine.schedule, 'AM routine');
  const chat = extractRoutineSteps('Today we unbox three products and compare prices. This one costs twenty dollars.');
  assert.deepEqual(chat.steps, []);
  assert.deepEqual(extractRoutineSteps('').steps, []);
});

test('parseSpottedProducts accepts fenced or bare JSON and rejects noise', () => {
  const fenced = '```json\n{"products":[{"name":"Toner 240ml","brand":"The Ordinary","where":"sink"}]}\n```';
  assert.deepEqual(parseSpottedProducts(fenced), [{ name: 'Toner 240ml', brand: 'The Ordinary', where: 'sink' }]);
  assert.deepEqual(parseSpottedProducts('[{"name":"Cap"}]'), [{ name: 'Cap', brand: '', where: 'thumbnail' }]);
  assert.deepEqual(parseSpottedProducts('no json here'), []);
});
