'use strict';

/**
 * Stashov — dual-provider cascade.
 *
 * Chat inference runs Meta Model API first, Nebius Token Factory second,
 * Baseten rescue third, and the local deterministic fallback last:
 *
 *   1. Meta Muse (MODEL_API_KEY) — primary. Serves every reasoning call
 *      when configured and reachable.
 *   2. Nebius Token Factory (NEBIUS_API_KEY) — automatic fallback. Serves
 *      when Meta is unconfigured, and per-request when a Meta call fails.
 *      Muse model ids are translated to their Nemotron tier twin.
 *   3. Baseten (BASETEN_API_KEY) — rescue. Fires only when both primaries
 *      already failed.
 *   4. Offline — deterministic local report, zero model spend.
 *
 * Env resolution is deliberately lazy (read inside functions, not at require
 * time) so tests and long-lived servers both see current values.
 */

const meta = require('./meta');
const baseten = require('./baseten');

const NEBIUS_BASE_URL_DEFAULT = 'https://api.tokenfactory.nebius.com/v1';

const NEBIUS_MODEL_DEFAULTS = {
  ultra: 'nvidia/Nemotron-3-Ultra-550b-a55b',
  super: 'nvidia/Nemotron-3-Super-120b-a12b',
  nano: 'nvidia/Nemotron-3-Nano-30B-A3B',
  lightning: 'nvidia/Nemotron-3.5-Lightning',
  vision: 'zai-org/GLM-5.3-Flash',
  embedding: 'Qwen/Qwen3-Embedding-8B',
};

const PLACEHOLDER_KEYS = new Set(['', 'your_nebius_token_factory_api_key_here']);

function nebiusBaseUrl() {
  return String(process.env.NEBIUS_BASE_URL || NEBIUS_BASE_URL_DEFAULT).replace(/\/$/, '');
}

function nebiusApiKey() {
  return String(process.env.NEBIUS_API_KEY || '').trim();
}

function isNebiusConfigured() {
  return !PLACEHOLDER_KEYS.has(nebiusApiKey());
}

/** Boot-time primary: 'meta' | 'nebius' | 'offline'. */
function resolveProvider() {
  if (meta.isMetaConfigured()) return 'meta';
  if (isNebiusConfigured()) return 'nebius';
  return 'offline';
}

function providerClause(provider) {
  if (provider === 'meta') return 'Meta Muse via the Meta Model API';
  if (provider === 'nebius') return 'NVIDIA Nemotron via Nebius Token Factory';
  return 'the local deterministic fallback';
}

function reasonTier(provider) {
  if (provider === 'meta') return 'Frontier Reasoning (Muse Wonder)';
  if (provider === 'nebius') return '1M-Context Deep Reasoning';
  return 'Local Fallback';
}

/**
 * Translate a Meta-set model id to its Nebius tier twin (ultra/super/nano/
 * lightning/vision) by matching it against the active MODELS table. Returns
 * null for unknown ids (custom MODEL_* overrides), in which case the Nebius
 * leg is skipped rather than sent an id it cannot serve.
 */
function nebiusModelFor(model, models) {
  const table = models && typeof models === 'object' ? models : {};
  for (const tier of ['ultra', 'super', 'nano', 'lightning', 'vision']) {
    if (table[tier] && model === table[tier] && NEBIUS_MODEL_DEFAULTS[tier]) {
      return NEBIUS_MODEL_DEFAULTS[tier];
    }
  }
  return null;
}

/**
 * OpenAI-compatible chat call against Nebius Token Factory.
 * Standard result shape: { live, latency_ms, content, usage, via, model }.
 */
async function callNebiusChat(model, messages, maxTokens = 900, options = {}) {
  const start = Date.now();
  if (!isNebiusConfigured()) {
    return { live: false, latency_ms: Date.now() - start + 380, content: null, via: 'nebius', model };
  }
  try {
    const resp = await fetch(`${nebiusBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nebiusApiKey()}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.2,
      }),
      // A 1M-context audit can run long; never let a hung socket hold the request.
      signal: AbortSignal.timeout(Number.isFinite(Number(options.timeout_ms)) ? Number(options.timeout_ms) : 60_000),
    });
    if (!resp.ok) {
      return { live: false, latency_ms: Date.now() - start, content: null, via: 'nebius', model };
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || null;
    return {
      live: true,
      latency_ms: Date.now() - start,
      content,
      usage: data.usage || null,
      via: 'nebius',
      model,
    };
  } catch (_) {
    return { live: false, latency_ms: Date.now() - start, content: null, via: 'nebius', model };
  }
}

/**
 * Full cascade for one chat call. `models` is the active MODELS table, used
 * only to translate model ids for the Nebius leg. Every result carries `via`
 * ('meta' | 'nebius' | 'baseten' | undefined when fully offline) and `model`
 * so telemetry and the UI label the serving provider honestly.
 */
async function callChatChain(models, model, messages, maxTokens = 900, options = {}) {
  const metaReady = meta.isMetaConfigured();
  if (metaReady) {
    const res = await meta.callMetaChat(model, messages, maxTokens, options);
    if (res.live) return { ...res, via: 'meta', model };
  }
  if (isNebiusConfigured()) {
    // With Meta primary the model id is a Muse id, so translate it; with
    // Nebius primary (no Meta key) the id is already a Nebius id.
    const nebiusModel = metaReady ? nebiusModelFor(model, models) : model;
    if (nebiusModel) {
      const res = await callNebiusChat(nebiusModel, messages, maxTokens, options);
      if (res.live) return res;
    }
  }
  const offline = { live: false, latency_ms: 380, content: null };
  return baseten.rescueWithBaseten(offline, messages, maxTokens, options);
}

module.exports = {
  NEBIUS_BASE_URL_DEFAULT,
  NEBIUS_MODEL_DEFAULTS,
  nebiusApiKey,
  nebiusBaseUrl,
  isNebiusConfigured,
  resolveProvider,
  providerClause,
  reasonTier,
  nebiusModelFor,
  callNebiusChat,
  callChatChain,
};
