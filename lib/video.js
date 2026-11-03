'use strict';

/**
 * Video reference capture.
 *
 * Turns a pasted video URL into a reference card: platform metadata via
 * oEmbed, a YouTube transcript when captions are public, and products
 * spotted in the thumbnail by the same Spark vision path the Shelf scan
 * uses. Every network step is best-effort — an unreachable platform still
 * yields a card, just with less on it, and says so in `warnings`.
 */

const { callMetaChat, metaModels } = require('./meta');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stashov/2.0';

function parseVideoUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch (_) {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0] || ''
      : (url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop() || '');
    return { platform: 'youtube', id: String(id).slice(0, 32), url: url.href };
  }
  if (host.endsWith('tiktok.com')) {
    const match = url.pathname.match(/\/video\/(\d+)/);
    return { platform: 'tiktok', id: match ? match[1] : '', url: url.href };
  }
  if (host.endsWith('instagram.com')) {
    return { platform: 'instagram', id: url.pathname.split('/').filter(Boolean).pop() || '', url: url.href };
  }
  return { platform: 'web', id: '', url: url.href };
}

async function fetchText(target, timeoutMs = 9000) {
  const resp = await fetch(target, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`fetch-${resp.status}`);
  return resp.text();
}

async function fetchJson(target, timeoutMs = 9000) {
  return JSON.parse(await fetchText(target, timeoutMs));
}

/** Caption-track list out of a YouTube watch page (pure; testable). */
function parseCaptionTracks(html) {
  const match = String(html || '').match(/"captionTracks":(\[.*?\])\s*[,}]/s);
  if (!match) return [];
  try {
    const tracks = JSON.parse(match[1].replace(/\\u0026/g, '&'));
    return Array.isArray(tracks) ? tracks : [];
  } catch (_) {
    return [];
  }
}

function pickCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  const english = tracks.filter((t) => String(t.languageCode || '').startsWith('en'));
  const pool = english.length ? english : tracks;
  return pool.find((t) => t.kind !== 'asr') || pool[0] || null;
}

/** Timed-text XML to plain words (pure; testable). */
function transcriptXmlToText(xml) {
  return String(xml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20000);
}

function unfence(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

/** Vision reply to a product list (pure; testable). */
function parseSpottedProducts(content) {
  let parsed = null;
  try {
    parsed = JSON.parse(unfence(content));
  } catch (_) {
    return [];
  }
  const rows = Array.isArray(parsed) ? parsed : (parsed && parsed.products) || [];
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const name = String((row && row.name) || '').trim().slice(0, 120);
    if (!name) continue;
    out.push({
      name,
      brand: String((row && row.brand) || '').trim().slice(0, 80),
      where: String((row && row.where) || 'thumbnail').trim().slice(0, 60),
    });
    if (out.length >= 8) break;
  }
  return out;
}

function buildSpotMessages(dataUrl, title) {
  return [
    {
      role: 'system',
      content: 'You are Stashov Lens, a precise product spotter for video thumbnails and frames. You list only physical products clearly visible in the image as strict JSON. Never invent products that are not visible.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: [
            'List every distinct buyable product clearly visible in this video thumbnail/frame (skincare, fragrance, clothing, footwear, accessories, gear, food items).',
            'Reply with JSON only, no code fences and no commentary:',
            '{"products":[{"name":"Glycolic acid toner 240ml","brand":"The Ordinary","where":"left hand"}]}',
            title ? `Video title for context only: ${title}` : '',
          ].filter(Boolean).join('\n'),
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];
}

async function spotProductsInThumbnail(thumbnailUrl, title) {
  try {
    const resp = await fetch(thumbnailUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(9000),
    });
    if (!resp.ok) return { products: [], live: false };
    const buf = Buffer.from(await resp.arrayBuffer());
    if (!buf.length || buf.length > 2_500_000) return { products: [], live: false };
    const mime = resp.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${mime.split(';')[0]};base64,${buf.toString('base64')}`;
    const result = await callMetaChat(metaModels().agent, buildSpotMessages(dataUrl, title), 700, { temperature: 0.1, timeout_ms: 30000 });
    if (!result.live || !result.content) return { products: [], live: false };
    return { products: parseSpottedProducts(result.content), live: true };
  } catch (_) {
    return { products: [], live: false };
  }
}

async function buildVideoReference(value) {
  const parsed = parseVideoUrl(value);
  if (!parsed) return null;
  const ref = {
    platform: parsed.platform, video_id: parsed.id, url: parsed.url,
    title: '', author: '', thumbnail: '', transcript: '',
    products: [], vision_live: false, warnings: [],
  };
  try {
    if (parsed.platform === 'youtube' && parsed.id) {
      const oembed = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.url)}&format=json`);
      ref.title = String(oembed.title || '').slice(0, 180);
      ref.author = String(oembed.author_name || '').slice(0, 90);
      ref.thumbnail = String(oembed.thumbnail_url || '');
      try {
        const html = await fetchText(parsed.url, 12000);
        const track = pickCaptionTrack(parseCaptionTracks(html));
        if (track && track.baseUrl) {
          ref.transcript = transcriptXmlToText(await fetchText(track.baseUrl, 9000));
        }
        if (!ref.transcript) ref.warnings.push('No public captions found; card saved from title and thumbnail.');
      } catch (_) {
        ref.warnings.push('Transcript could not be fetched; card saved from title and thumbnail.');
      }
    } else if (parsed.platform === 'tiktok') {
      try {
        const oembed = await fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(parsed.url)}`);
        ref.title = String(oembed.title || '').slice(0, 180);
        ref.author = String(oembed.author_name || '').slice(0, 90);
        ref.thumbnail = String(oembed.thumbnail_url || '');
      } catch (_) {
        ref.warnings.push('TikTok would not serve metadata to the server; card saved from the link. Open it and screenshot-capture for products.');
      }
    } else {
      ref.warnings.push(`No fetcher for ${parsed.platform}; card saved from the link alone.`);
    }
  } catch (_) {
    ref.warnings.push('Metadata could not be fetched; card saved from the link alone.');
  }
  if (ref.thumbnail) {
    const spotted = await spotProductsInThumbnail(ref.thumbnail, ref.title);
    ref.products = spotted.products;
    ref.vision_live = spotted.live;
  }
  return ref;
}

/**
 * Routine extraction from a transcript (pure; testable). A routine needs
 * at least two imperative steps plus a schedule hint — otherwise the
 * video is treated as product-only and Rules stays untouched.
 */
function extractRoutineSteps(transcript) {
  const text = String(transcript || '').replace(/\s+/g, ' ').trim();
  if (!text) return { steps: [], schedule: '' };
  const scheduleMatch = text.match(/\b(morning|am|evening|night|pm|daily|twice a day|once a day|weekly|every day)\b/i);
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const stepLike = /^(apply|use|start|begin|first|then|next|after|wait|rinse|wash|cleanse|layer|massage|pat|leave|repeat|finish|follow)\b/i;
  const steps = [];
  for (const sentence of sentences) {
    if (sentence.length < 12 || sentence.length > 220) continue;
    if (stepLike.test(sentence)) steps.push(sentence.replace(/\.$/, ''));
    if (steps.length >= 8) break;
  }
  if (steps.length < 2 || !scheduleMatch) return { steps: [], schedule: '' };
  const hint = scheduleMatch[1].toLowerCase();
  const schedule = /morning|am/.test(hint) ? 'AM routine'
    : /evening|night|pm/.test(hint) ? 'PM routine' : 'Daily';
  return { steps, schedule };
}

/** Best-effort readable text from a web page (scripts/styles stripped). */
async function fetchPageText(target, timeoutMs = 9000) {
  const html = await fetchText(target, timeoutMs);
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const titleMatch = String(html || '').match(/<title[^>]*>([^<]{3,180})<\/title>/i);
  return { title: titleMatch ? titleMatch[1].trim() : '', text: text.slice(0, 12000) };
}

module.exports = {
  buildVideoReference,
  extractRoutineSteps,
  fetchPageText,
  parseCaptionTracks,
  parseSpottedProducts,
  parseVideoUrl,
  pickCaptionTrack,
  transcriptXmlToText,
};
