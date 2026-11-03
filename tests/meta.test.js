const test = require('node:test');
const assert = require('node:assert/strict');

const meta = require('../lib/meta');

const ENV_KEYS = [
  'MODEL_API_KEY',
  'META_API_KEY',
  'META_BASE_URL',
  'MODEL_WONDER',
  'MODEL_SPARK',
  'MODEL_SPARK_FAST',
  'MODEL_IMAGE',
  'MODEL_SAM',
];

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

test('Meta model defaults point at the hackathon model IDs', withCleanEnv(() => {
  assert.deepEqual(meta.META_MODEL_DEFAULTS, {
    reason: 'muse-wonder-1.0',
    agent: 'muse-spark-1.3',
    fast: 'muse-spark-1.1',
    image: 'muse-image-1.0',
    segment: 'sam-3.1',
  });
  assert.deepEqual(meta.metaModels(), meta.META_MODEL_DEFAULTS);
  assert.equal(meta.metaBaseUrl(), 'https://api.meta.ai/v1');
}));

test('Model IDs and base URL are overridable per tier', withCleanEnv(() => {
  process.env.MODEL_WONDER = 'muse-wonder-1.0-custom';
  process.env.MODEL_SPARK = 'muse-spark-1.2';
  process.env.META_BASE_URL = 'https://proxy.example.com/v1/';
  const models = meta.metaModels();
  assert.equal(models.reason, 'muse-wonder-1.0-custom');
  assert.equal(models.agent, 'muse-spark-1.2');
  assert.equal(models.fast, 'muse-spark-1.1');
  assert.equal(meta.metaBaseUrl(), 'https://proxy.example.com/v1');
}));

test('Meta is unconfigured without a key or with a placeholder', withCleanEnv(() => {
  assert.equal(meta.isMetaConfigured(), false);
  process.env.MODEL_API_KEY = 'your_model_api_key_here';
  assert.equal(meta.isMetaConfigured(), false);
  process.env.MODEL_API_KEY = '  ';
  assert.equal(meta.isMetaConfigured(), false);
  process.env.MODEL_API_KEY = 'live-key';
  assert.equal(meta.isMetaConfigured(), true);
}));

test('Chat without a key returns the offline shape and never fetches', withCleanEnv(async () => {
  const realFetch = global.fetch;
  let called = 0;
  global.fetch = async () => { called += 1; throw new Error('must not fetch'); };
  try {
    const res = await meta.callMetaChat('muse-wonder-1.0', [{ role: 'user', content: 'hi' }]);
    assert.equal(res.live, false);
    assert.equal(res.content, null);
    assert.ok(res.latency_ms >= 0);
    assert.equal(called, 0);
  } finally {
    global.fetch = realFetch;
  }
}));

test('Chat posts an OpenAI-compatible body with a Bearer key', withCleanEnv(async () => {
  process.env.MODEL_API_KEY = 'test-key-123';
  const realFetch = global.fetch;
  let seenUrl = '';
  let seenInit = null;
  global.fetch = async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '1. BUY NOTHING' } }],
        usage: { prompt_tokens: 50, completion_tokens: 10 },
      }),
    };
  };
  try {
    const messages = [{ role: 'user', content: 'Audit me' }];
    const res = await meta.callMetaChat('muse-wonder-1.0', messages, 600);
    assert.equal(seenUrl, 'https://api.meta.ai/v1/chat/completions');
    assert.equal(seenInit.method, 'POST');
    assert.equal(seenInit.headers.Authorization, 'Bearer test-key-123');
    assert.deepEqual(JSON.parse(seenInit.body), {
      model: 'muse-wonder-1.0',
      messages,
      max_tokens: 600,
      temperature: 0.2,
      reasoning_effort: 'low',
    });
    assert.equal(res.live, true);
    assert.equal(res.content, '1. BUY NOTHING');
    assert.deepEqual(res.usage, { prompt_tokens: 50, completion_tokens: 10 });
  } finally {
    global.fetch = realFetch;
  }
}));

test('Chat maps HTTP errors and network failures to offline', withCleanEnv(async () => {
  process.env.MODEL_API_KEY = 'test-key-123';
  const realFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
    const denied = await meta.callMetaChat('muse-spark-1.1', []);
    assert.equal(denied.live, false);
    assert.equal(denied.content, null);

    global.fetch = async () => { throw new Error('socket hang up'); };
    const broken = await meta.callMetaChat('muse-spark-1.1', []);
    assert.equal(broken.live, false);
    assert.equal(broken.content, null);
  } finally {
    global.fetch = realFetch;
  }
}));

test('Image generation posts to /images/generations with muse-image-1.0', withCleanEnv(async () => {
  process.env.MODEL_API_KEY = 'test-key-123';
  const realFetch = global.fetch;
  let seenUrl = '';
  let seenBody = null;
  global.fetch = async (url, init) => {
    seenUrl = String(url);
    seenBody = JSON.parse(init.body);
    return { ok: true, json: async () => ({ data: [{ url: 'https://cdn.example.com/img.png' }] }) };
  };
  try {
    const res = await meta.callMetaImage('A minimalist wardrobe flat-lay');
    assert.equal(seenUrl, 'https://api.meta.ai/v1/images/generations');
    assert.equal(seenBody.model, 'muse-image-1.0');
    assert.equal(seenBody.prompt, 'A minimalist wardrobe flat-lay');
    assert.equal(res.live, true);
    assert.equal(res.url, 'https://cdn.example.com/img.png');
    assert.equal(res.b64_json, null);
  } finally {
    global.fetch = realFetch;
  }
}));

test('Image generation without a key or prompt stays offline', withCleanEnv(async () => {
  const noKey = await meta.callMetaImage('anything');
  assert.equal(noKey.live, false);

  process.env.MODEL_API_KEY = 'test-key-123';
  const noPrompt = await meta.callMetaImage('   ');
  assert.equal(noPrompt.live, false);
}));
