const test = require('node:test');
const assert = require('node:assert/strict');

const provider = require('../lib/provider');

const ENV_KEYS = [
  'MODEL_API_KEY',
  'META_API_KEY',
  'META_BASE_URL',
  'NEBIUS_API_KEY',
  'NEBIUS_BASE_URL',
  'BASETEN_API_KEY',
  'BASETEN_BASE_URL',
  'BASETEN_MODEL',
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

const META_MODELS = {
  ultra: 'muse-wonder-1.0',
  super: 'muse-spark-1.3',
  nano: 'muse-spark-1.1',
  lightning: 'muse-spark-1.3',
  vision: 'muse-spark-1.3',
};

test('Nebius is unconfigured without a key or with a placeholder', withCleanEnv(() => {
  assert.equal(provider.isNebiusConfigured(), false);
  process.env.NEBIUS_API_KEY = 'your_nebius_token_factory_api_key_here';
  assert.equal(provider.isNebiusConfigured(), false);
  process.env.NEBIUS_API_KEY = '  ';
  assert.equal(provider.isNebiusConfigured(), false);
  process.env.NEBIUS_API_KEY = 'live-nebius-key';
  assert.equal(provider.isNebiusConfigured(), true);
  assert.equal(provider.nebiusBaseUrl(), 'https://api.tokenfactory.nebius.com/v1');
}));

test('Boot provider prefers Meta, then Nebius, then offline', withCleanEnv(() => {
  assert.equal(provider.resolveProvider(), 'offline');
  process.env.NEBIUS_API_KEY = 'live-nebius-key';
  assert.equal(provider.resolveProvider(), 'nebius');
  process.env.MODEL_API_KEY = 'live-meta-key';
  assert.equal(provider.resolveProvider(), 'meta');
  process.env.MODEL_API_KEY = 'your_model_api_key_here';
  assert.equal(provider.resolveProvider(), 'nebius');
}));

test('Clauses and tiers name the serving provider', withCleanEnv(() => {
  assert.equal(provider.providerClause('meta'), 'Meta Muse via the Meta Model API');
  assert.equal(provider.providerClause('nebius'), 'NVIDIA Nemotron via Nebius Token Factory');
  assert.equal(provider.providerClause('offline'), 'the local deterministic fallback');
  assert.equal(provider.reasonTier('meta'), 'Frontier Reasoning (Muse Wonder)');
  assert.equal(provider.reasonTier('nebius'), '1M-Context Deep Reasoning');
  assert.equal(provider.reasonTier('offline'), 'Local Fallback');
}));

test('Muse model ids translate to their Nemotron tier twin', withCleanEnv(() => {
  assert.equal(provider.nebiusModelFor('muse-wonder-1.0', META_MODELS), 'nvidia/Nemotron-3-Ultra-550b-a55b');
  assert.equal(provider.nebiusModelFor('muse-spark-1.3', META_MODELS), 'nvidia/Nemotron-3-Super-120b-a12b');
  assert.equal(provider.nebiusModelFor('muse-spark-1.1', META_MODELS), 'nvidia/Nemotron-3-Nano-30B-A3B');
  assert.equal(provider.nebiusModelFor('custom-override-9', META_MODELS), null);
  assert.equal(provider.nebiusModelFor('muse-wonder-1.0', null), null);
}));

test('Nebius chat without a key returns offline and never fetches', withCleanEnv(async () => {
  const realFetch = global.fetch;
  let called = 0;
  global.fetch = async () => { called += 1; throw new Error('must not fetch'); };
  try {
    const res = await provider.callNebiusChat('nvidia/Nemotron-3-Ultra-550b-a55b', []);
    assert.equal(res.live, false);
    assert.equal(res.content, null);
    assert.equal(res.via, 'nebius');
    assert.equal(called, 0);
  } finally {
    global.fetch = realFetch;
  }
}));

test('Nebius chat posts an OpenAI-compatible body with auth', withCleanEnv(async () => {
  process.env.NEBIUS_API_KEY = 'test-nebius-key';
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
        usage: { prompt_tokens: 40, completion_tokens: 8 },
      }),
    };
  };
  try {
    const messages = [{ role: 'user', content: 'Audit me' }];
    const res = await provider.callNebiusChat('nvidia/Nemotron-3-Ultra-550b-a55b', messages, 600);
    assert.equal(seenUrl, 'https://api.tokenfactory.nebius.com/v1/chat/completions');
    assert.equal(seenInit.method, 'POST');
    assert.equal(seenInit.headers.Authorization, `Bearer ${process.env.NEBIUS_API_KEY}`);
    assert.deepEqual(JSON.parse(seenInit.body), {
      model: 'nvidia/Nemotron-3-Ultra-550b-a55b',
      messages,
      max_tokens: 600,
      temperature: 0.2,
    });
    assert.equal(res.live, true);
    assert.equal(res.content, '1. BUY NOTHING');
    assert.equal(res.via, 'nebius');
    assert.equal(res.model, 'nvidia/Nemotron-3-Ultra-550b-a55b');
  } finally {
    global.fetch = realFetch;
  }
}));

test('Nebius chat maps HTTP errors and network failures to offline', withCleanEnv(async () => {
  process.env.NEBIUS_API_KEY = 'test-nebius-key';
  const realFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    const denied = await provider.callNebiusChat('nvidia/Nemotron-3-Nano-30B-A3B', []);
    assert.equal(denied.live, false);

    global.fetch = async () => { throw new Error('socket hang up'); };
    const broken = await provider.callNebiusChat('nvidia/Nemotron-3-Nano-30B-A3B', []);
    assert.equal(broken.live, false);
  } finally {
    global.fetch = realFetch;
  }
}));

function mockFetchByHost({ meta = null, nebius = null, baseten = null } = {}) {
  const calls = [];
  global.fetch = async (url, init) => {
    const href = String(url);
    calls.push(href);
    const body = href.includes('api.meta.ai') ? meta : href.includes('tokenfactory.nebius.com') ? nebius : baseten;
    if (!body) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, json: async () => body };
  };
  return calls;
}

const LIVE_BODY = (text) => ({
  choices: [{ message: { content: text } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});

test('Chain serves Meta first and stops on a live answer', withCleanEnv(async () => {
  process.env.MODEL_API_KEY = 'meta-key';
  process.env.NEBIUS_API_KEY = 'nebius-key';
  const realFetch = global.fetch;
  const calls = mockFetchByHost({ meta: LIVE_BODY('meta verdict') });
  try {
    const res = await provider.callChatChain(META_MODELS, 'muse-wonder-1.0', [{ role: 'user', content: 'hi' }]);
    assert.equal(res.live, true);
    assert.equal(res.via, 'meta');
    assert.equal(res.model, 'muse-wonder-1.0');
    assert.equal(res.content, 'meta verdict');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes('api.meta.ai'));
  } finally {
    global.fetch = realFetch;
  }
}));

test('Chain falls back to Nebius with a translated model when Meta fails', withCleanEnv(async () => {
  process.env.MODEL_API_KEY = 'meta-key';
  process.env.NEBIUS_API_KEY = 'nebius-key';
  const realFetch = global.fetch;
  const calls = mockFetchByHost({ meta: null, nebius: LIVE_BODY('nebius verdict') });
  const seenBodies = [];
  const inner = global.fetch;
  global.fetch = async (url, init) => {
    seenBodies.push(JSON.parse(init.body).model);
    return inner(url, init);
  };
  try {
    const res = await provider.callChatChain(META_MODELS, 'muse-wonder-1.0', [{ role: 'user', content: 'hi' }]);
    assert.equal(res.live, true);
    assert.equal(res.via, 'nebius');
    assert.equal(res.model, 'nvidia/Nemotron-3-Ultra-550b-a55b');
    assert.equal(res.content, 'nebius verdict');
    assert.equal(calls.length, 2);
    assert.deepEqual(seenBodies, ['muse-wonder-1.0', 'nvidia/Nemotron-3-Ultra-550b-a55b']);
  } finally {
    global.fetch = realFetch;
  }
}));

test('Chain uses Nebius directly when no Meta key is set', withCleanEnv(async () => {
  process.env.NEBIUS_API_KEY = 'nebius-key';
  const realFetch = global.fetch;
  const calls = mockFetchByHost({ nebius: LIVE_BODY('direct nebius') });
  try {
    const res = await provider.callChatChain({}, 'nvidia/Nemotron-3-Nano-30B-A3B', []);
    assert.equal(res.live, true);
    assert.equal(res.via, 'nebius');
    assert.equal(res.model, 'nvidia/Nemotron-3-Nano-30B-A3B');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes('tokenfactory.nebius.com'));
  } finally {
    global.fetch = realFetch;
  }
}));

test('Chain skips Nebius for untranslatable ids instead of sending a bad model', withCleanEnv(async () => {
  process.env.MODEL_API_KEY = 'meta-key';
  process.env.NEBIUS_API_KEY = 'nebius-key';
  const realFetch = global.fetch;
  const calls = mockFetchByHost({ meta: null, nebius: LIVE_BODY('must not serve') });
  try {
    const res = await provider.callChatChain(META_MODELS, 'custom-override-9', []);
    assert.equal(res.live, false);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes('api.meta.ai'));
  } finally {
    global.fetch = realFetch;
  }
}));

test('Chain rescues with Baseten only when both primaries fail', withCleanEnv(async () => {
  process.env.MODEL_API_KEY = 'meta-key';
  process.env.NEBIUS_API_KEY = 'nebius-key';
  process.env.BASETEN_API_KEY = 'baseten-key';
  const realFetch = global.fetch;
  const calls = mockFetchByHost({ meta: null, nebius: null, baseten: LIVE_BODY('baseten verdict') });
  try {
    const res = await provider.callChatChain(META_MODELS, 'muse-wonder-1.0', []);
    assert.equal(res.live, true);
    assert.equal(res.via, 'baseten');
    assert.equal(res.content, 'baseten verdict');
    assert.equal(calls.length, 3);
  } finally {
    global.fetch = realFetch;
  }
}));

test('Chain without any key returns offline and never fetches', withCleanEnv(async () => {
  const realFetch = global.fetch;
  let called = 0;
  global.fetch = async () => { called += 1; throw new Error('must not fetch'); };
  try {
    const res = await provider.callChatChain(META_MODELS, 'muse-wonder-1.0', []);
    assert.equal(res.live, false);
    assert.equal(res.content, null);
    assert.equal(called, 0);
  } finally {
    global.fetch = realFetch;
  }
}));
