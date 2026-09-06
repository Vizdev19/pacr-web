// ─────────────────────────────────────────────────────────────────────────────
// Supabase client for the website
//
// Mirrors the app's lazy-singleton shape (pacr/src/services/supabase.ts): the
// client is created on first use, and when the project is not configured the
// accessor returns null rather than throwing. Every caller on this site treats
// null as "leave the static markup alone", which is what keeps the page working
// with JS disabled, with the CDN blocked, or before the anon key is filled in.
//
// detectSessionInUrl is false because sign-in is a 6-digit code, not a magic
// link — the same flow the app uses — so nothing is ever parsed out of the URL.
// ─────────────────────────────────────────────────────────────────────────────

import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './config.js';

let clientPromise = null;

export async function getSupabase() {
  if (!isConfigured()) return null;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    try {
      const { createClient } = await import(
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm'
      );
      return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'pacr.web.auth',
        },
      });
    } catch (e) {
      // CDN blocked, offline, or an ad blocker ate the module. Static content
      // stays on screen; that is the whole point of the fallback.
      console.warn('[pacr] supabase-js failed to load', e);
      return null;
    }
  })();

  return clientPromise;
}

// ── Shared helpers ──

/** Escape text before it goes anywhere near innerHTML. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** "Dawn Riders" → "DR". Matches the app's Avatar fallback. */
export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** 1240 → "1,240" */
export function num(n) {
  return Number(n ?? 0).toLocaleString('en-IN');
}

/**
 * Batch-sign private storage paths.
 *
 * Ported from pacr/src/services/signedUrls.ts — same 24 h TTL and same chunking
 * (createSignedUrls caps out on very large batches). The app's LRU cache is
 * deliberately not ported: a page load is the cache lifetime here.
 */
export async function signedUrlsFor(sb, bucket, paths) {
  const out = new Map();
  const unique = [...new Set((paths ?? []).filter(Boolean))];
  if (!sb || unique.length === 0) return out;

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const { data, error } = await sb.storage
        .from(bucket)
        .createSignedUrls(chunk, 60 * 60 * 24);
      if (error || !Array.isArray(data)) continue;
      for (const row of data) {
        if (row?.path && row?.signedUrl) out.set(row.path, row.signedUrl);
      }
    } catch {}
  }
  return out;
}
