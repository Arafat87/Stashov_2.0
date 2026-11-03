'use strict';

/**
 * TikTok data-download import.
 *
 * TikTok's "Download your data" file (JSON or TXT) lists favourite videos
 * as { Date, Link } entries under names that have shifted between export
 * versions, so extraction is structural: walk any JSON tree collecting
 * link-bearing objects, and fall back to a raw URL scan for TXT exports.
 */

function tikTokVideoId(url) {
  const match = String(url || '').match(/\/video\/(\d+)/);
  return match ? match[1] : '';
}

function cleanUrl(value) {
  const raw = String(value || '').trim().replace(/[",]+$/, '');
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    return new URL(raw).href;
  } catch (_) {
    return '';
  }
}

function collectFromJson(node, out, seen) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectFromJson(child, out, seen);
    return;
  }
  const link = cleanUrl(node.Link || node.link || node.url || node.URL || '');
  if (link && /tiktok\.com/i.test(link)) {
    const id = tikTokVideoId(link) || link;
    if (!seen.has(id)) {
      seen.add(id);
      out.push({
        url: link,
        date: String(node.Date || node.date || node.CreatedAt || '').slice(0, 40),
        title: String(node.Title || node.title || '').slice(0, 140),
      });
    }
  }
  for (const value of Object.values(node)) collectFromJson(value, out, seen);
}

function extractTikTokLinks(content) {
  const text = String(content || '');
  const out = [];
  const seen = new Set();
  try {
    collectFromJson(JSON.parse(text), out, seen);
  } catch (_) {
    /* not JSON: fall through to the URL scan */
  }
  if (!out.length) {
    const urls = text.match(/https?:\/\/[^\s"'<>\]]+/gi) || [];
    for (const raw of urls) {
      const link = cleanUrl(raw);
      if (!link || !/tiktok\.com/i.test(link)) continue;
      const id = tikTokVideoId(link) || link;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ url: link, date: '', title: '' });
    }
  }
  return out.slice(0, 1000);
}

module.exports = { extractTikTokLinks, tikTokVideoId };
