'use strict';

/**
 * Stashov — Baseten rescue provider for the Meta hackathon.
 *
 * Baseten serves the hackathon-gated Muse Spark open model over an
 * OpenAI-compatible API. The key works ONLY with that model, so the model id
 * stays pinned by default. Baseten never leads: `rescueWithBaseten` fires
 * only when the primary provider (Meta, then Nebius) already failed, keeping
 * the demo alive on judge hardware when the primary key is rate-limited or
 * unreachable. Result shape matches the Meta path, plus `via`/`model` so
 * telemetry labels the rescue honestly.
 */

const BASETEN_BASE_URL_DEFAULT = 'https://inference.baseten.co/v1';
const BASETEN_MODEL_DEFAULT = 'meta-models/muse-spark-open-1026';

const PLACEHOLDER_KEYS = new Set(['', 'your_baseten_api_key_here']);

function basetenBaseUrl() {
  return String(process.env.BASETEN_BASE_URL || BASETEN_BASE_URL_DEFAULT).replace(/\/$/, '');
}

function basetenModel() {
  const override = String(process.env.BASETEN_MODEL || '').trim();
  return override || BASETEN_MODEL_DEFAULT;
}

function basetenApiKey() {
  return String(process.env.BASETEN_API_KEY || '').trim();
}

function isBasetenConfigured() {
  return !PLACEHOLDER_KEYS.has(basetenApiKey());
}

async function callBasetenChat(messages, maxTokens = 900, options = {}) {
  const start = Date.now();
  const model = basetenModel();
  if (!isBasetenConfigured()) {
    return { live: false, latency_ms: Date.now() - start + 380, content: null, via: 'baseten', model };
  }
  try {
    const resp = await fetch(`${basetenBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${basetenApiKey()}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.2,
        // The hackathon Spark model reasons to fill any budget (8k tokens of
        // reasoning, zero content). Low effort returns a real verdict.
        reasoning_effort: options.reasoning_effort || 'low',
      }),
      signal: AbortSignal.timeout(Number.isFinite(Number(options.timeout_ms)) ? Number(options.timeout_ms) : 60_000),
    });
    if (!resp.ok) {
      return { live: false, latency_ms: Date.now() - start, content: null, via: 'baseten', model };
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? null;
    return {
      live: true,
      latency_ms: Date.now() - start,
      content: typeof content === 'string' ? content : content ? JSON.stringify(content) : null,
      usage: data.usage || null,
      via: 'baseten',
      model,
    };
  } catch (_) {
    return { live: false, latency_ms: Date.now() - start, content: null, via: 'baseten', model };
  }
}

/**
 * Rescue cascade used by the server's callChat: a live primary passes
 * through untouched (no second call, no extra spend); a dead primary falls
 * through to Baseten when configured.
 */
async function rescueWithBaseten(primary, messages, maxTokens = 900, options = {}) {
  if ((primary && primary.live) || !isBasetenConfigured()) return primary;
  return callBasetenChat(messages, maxTokens, options);
}

module.exports = {
  BASETEN_BASE_URL_DEFAULT,
  BASETEN_MODEL_DEFAULT,
  basetenApiKey,
  basetenBaseUrl,
  basetenModel,
  callBasetenChat,
  isBasetenConfigured,
  rescueWithBaseten,
};
