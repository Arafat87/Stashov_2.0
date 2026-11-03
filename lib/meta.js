'use strict';

/**
 * Stashov — Meta Model API provider.
 *
 * Primary inference path for the Meta Global AI Developer Hackathon (Indie
 * track). The Meta Model API is OpenAI-compatible, so chat calls use the same
 * shape shared by every chat call ({ live, latency_ms, content, usage }):
 *   base URL https://api.meta.ai/v1, key from MODEL_API_KEY.
 *
 * Env resolution is deliberately lazy (read inside functions, not at require
 * time) so tests and long-lived servers both see current values.
 */

const META_BASE_URL_DEFAULT = 'https://api.meta.ai/v1';

const META_MODEL_DEFAULTS = {
  // Long-horizon reasoning: vault audits, impulse-gate deep audits.
  reason: 'muse-wonder-1.0',
  // Agentic synthesis: wishlist promotion, protocol generation, dupe compare.
  agent: 'muse-spark-1.3',
  // Fast structured extraction: classification, tagging, price schemas.
  fast: 'muse-spark-1.1',
  // Text-to-image generation.
  image: 'muse-image-1.0',
  // Detection / segmentation / tracking.
  segment: 'sam-3.1',
};

const PLACEHOLDER_KEYS = new Set([
  '',
  'your_model_api_key_here',
  'your_meta_api_key_here',
]);

function metaBaseUrl() {
  return String(process.env.META_BASE_URL || META_BASE_URL_DEFAULT).replace(/\/$/, '');
}

function metaApiKey() {
  return String(process.env.MODEL_API_KEY || process.env.META_API_KEY || '').trim();
}

function isMetaConfigured() {
  return !PLACEHOLDER_KEYS.has(metaApiKey());
}

function metaModels() {
  return {
    reason: String(process.env.MODEL_WONDER || META_MODEL_DEFAULTS.reason).trim() || META_MODEL_DEFAULTS.reason,
    agent: String(process.env.MODEL_SPARK || META_MODEL_DEFAULTS.agent).trim() || META_MODEL_DEFAULTS.agent,
    fast: String(process.env.MODEL_SPARK_FAST || META_MODEL_DEFAULTS.fast).trim() || META_MODEL_DEFAULTS.fast,
    image: String(process.env.MODEL_IMAGE || META_MODEL_DEFAULTS.image).trim() || META_MODEL_DEFAULTS.image,
    segment: String(process.env.MODEL_SAM || META_MODEL_DEFAULTS.segment).trim() || META_MODEL_DEFAULTS.segment,
  };
}

/**
 * OpenAI-compatible chat call. Returns the same result shape as the legacy
 * Standard result shape: { live, latency_ms, content, usage }.
 * `messages` may carry multimodal content parts; they pass through untouched.
 */
async function callMetaChat(model, messages, maxTokens = 900, options = {}) {
  const start = Date.now();
  const key = metaApiKey();
  if (!isMetaConfigured()) {
    return { live: false, latency_ms: Date.now() - start + 380, content: null };
  }
  try {
    const body = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.2,
      // Muse reasoning models fill any token budget with reasoning and return
      // zero content (verified at 600, 2000, and 8000 tokens). Low effort
      // returns real verdicts; callers can raise it per task.
      reasoning_effort: options.reasoning_effort || 'low',
    };
    if (options.response_format) body.response_format = options.response_format;
    const resp = await fetch(`${metaBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number.isFinite(Number(options.timeout_ms)) ? Number(options.timeout_ms) : 60_000),
    });
    if (!resp.ok) {
      return { live: false, latency_ms: Date.now() - start, content: null };
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? null;
    return {
      live: true,
      latency_ms: Date.now() - start,
      content: typeof content === 'string' ? content : content ? JSON.stringify(content) : null,
      usage: data.usage || null,
    };
  } catch (_) {
    return { live: false, latency_ms: Date.now() - start, content: null };
  }
}

/**
 * Text-to-image via POST /images/generations.
 * Returns { live, latency_ms, b64_json, url } — whichever the API returns.
 */
async function callMetaImage(prompt, options = {}) {
  const start = Date.now();
  const text = String(prompt || '').trim().slice(0, 2000);
  if (!text || !isMetaConfigured()) {
    return { live: false, latency_ms: Date.now() - start, b64_json: null, url: null };
  }
  try {
    const body = { model: metaModels().image, prompt: text };
    if (options.size) body.size = options.size;
    if (options.response_format) body.response_format = options.response_format;
    const resp = await fetch(`${metaBaseUrl()}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${metaApiKey()}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number.isFinite(Number(options.timeout_ms)) ? Number(options.timeout_ms) : 60_000),
    });
    if (!resp.ok) {
      return { live: false, latency_ms: Date.now() - start, b64_json: null, url: null };
    }
    const data = await resp.json();
    const first = Array.isArray(data?.data) ? data.data[0] : null;
    return {
      live: true,
      latency_ms: Date.now() - start,
      b64_json: (first && first.b64_json) || null,
      url: (first && first.url) || null,
    };
  } catch (_) {
    return { live: false, latency_ms: Date.now() - start, b64_json: null, url: null };
  }
}

module.exports = {
  META_BASE_URL_DEFAULT,
  META_MODEL_DEFAULTS,
  metaBaseUrl,
  metaApiKey,
  isMetaConfigured,
  metaModels,
  callMetaChat,
  callMetaImage,
};
