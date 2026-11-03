const test = require('node:test');
const assert = require('node:assert/strict');

const baseten = require('../lib/baseten');

const ENV_KEYS = ['BASETEN_API_KEY', 'BASETEN_BASE_URL', 'BASETEN_MODEL'];

function snapshotEnv() {
  const saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  return saved;
}

function restoreEnv(saved) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

function withCleanEnv(fn) {
  return async () => {
    const saved = snapshotEnv();
    for (const key of ENV_KEYS) delete process.env[key];
    try {
      await fn();
    } finally {
      restoreEnv(saved);
    }
  };
}

test('Baseten defaults point at the hackathon model', withCleanEnv(() => {
  assert.equal(baseten.BASETEN_MODEL_DEFAULT, 'meta-models/muse-spark-open-1026');
  assert.equal(baseten.basetenModel(), 'meta-models/muse-spark-open-1026');
  assert.equal(baseten.basetenBaseUrl(), 'https://inference.baseten.co/v1');
}));

test('Model and base URL are overridable', withCleanEnv(() => {
  process.env.BASETEN_MODEL = 'other/model';
  process.env.BASETEN_BASE_URL = 'https://proxy.example.com/v1/';
  assert.equal(baseten.basetenModel(), 'other/model');
  assert.equal(baseten.basetenBaseUrl(), 'https://proxy.example.com/v1');
}));

test('Baseten is unconfigured without a key or with a placeholder', withCleanEnv(() => {
  assert.equal(baseten.isBasetenConfigured(), false);
  process.env.BASETEN_API_KEY = 'your_baseten_api_key_here';
  assert.equal(baseten.isBasetenConfigured(), false);
  process.env.BASETEN_API_KEY = '  ';
  assert.equal(baseten.isBasetenConfigured(), false);
  process.env.BASETEN_API_KEY = 'live-key';
  assert.equal(baseten.isBasetenConfigured(), true);
}));

test('Chat posts an OpenAI-compatible body to the hackathon model', withCleanEnv(async () => {
  process.env.BASETEN_API_KEY = 'test-key-123';
  const realFetch = global.fetch;
  let seenUrl = '';
  let seenInit = null;
  global.fetch = async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'BASETEN-LIVE-OK' } }],
        usage: { prompt_tokens: 155, completion_tokens: 116 },
      }),
    };
  };
  try {
    const messages = [{ role: 'user', content: 'hi' }];
    const res = await baseten.callBasetenChat(messages, 300);
    assert.equal(seenUrl, 'https://inference.baseten.co/v1/chat/completions');
    assert.equal(seenInit.headers.Authorization, 'Bearer test-key-123');
    assert.deepEqual(JSON.parse(seenInit.body), {
      model: 'meta-models/muse-spark-open-1026',
      messages,
      max_tokens: 300,
      temperature: 0.2,
      reasoning_effort: 'low',
    });
    assert.equal(res.live, true);
    assert.equal(res.content, 'BASETEN-LIVE-OK');
    assert.equal(res.via, 'baseten');
    assert.equal(res.model, 'meta-models/muse-spark-open-1026');
  } finally {
    global.fetch = realFetch;
  }
}));

test('Chat maps missing keys and HTTP errors to offline', withCleanEnv(async () => {
  const realFetch = global.fetch;
  let called = 0;
  global.fetch = async () => { called += 1; throw new Error('must not fetch'); };
  try {
    const noKey = await baseten.callBasetenChat([{ role: 'user', content: 'hi' }]);
    assert.equal(noKey.live, false);
    assert.equal(called, 0);

    process.env.BASETEN_API_KEY = 'test-key-123';
    global.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
    const denied = await baseten.callBasetenChat([]);
    assert.equal(denied.live, false);

    global.fetch = async () => { throw new Error('socket hang up'); };
    const broken = await baseten.callBasetenChat([]);
    assert.equal(broken.live, false);
  } finally {
    global.fetch = realFetch;
  }
}));

test('rescueWithBaseten keeps a live primary and never fetches', withCleanEnv(async () => {
  process.env.BASETEN_API_KEY = 'test-key-123';
  const realFetch = global.fetch;
  let called = 0;
  global.fetch = async () => { called += 1; throw new Error('must not fetch'); };
  try {
    const primary = { live: true, latency_ms: 5, content: 'primary wins' };
    const res = await baseten.rescueWithBaseten(primary, []);
    assert.equal(res, primary);
    assert.equal(called, 0);
  } finally {
    global.fetch = realFetch;
  }
}));

test('rescueWithBaseten tries Baseten only when the primary failed', withCleanEnv(async () => {
  const realFetch = global.fetch;
  try {
    const dead = { live: false, latency_ms: 5, content: null };
    const unconfigured = await baseten.rescueWithBaseten(dead, []);
    assert.equal(unconfigured, dead);

    process.env.BASETEN_API_KEY = 'test-key-123';
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'rescued' } }], usage: null }),
    });
    const rescued = await baseten.rescueWithBaseten(dead, [{ role: 'user', content: 'hi' }], 600);
    assert.equal(rescued.live, true);
    assert.equal(rescued.content, 'rescued');
    assert.equal(rescued.via, 'baseten');
  } finally {
    global.fetch = realFetch;
  }
}));
