// Tiny in-memory TTL cache (per serverless instance) + helper for CDN cache headers.
// The CDN header is the main rate-limit shield: Vercel's edge serves cached responses
// without invoking the function (and without calling Yahoo/Finnhub) until s-maxage expires.

type Entry = { exp: number; val: unknown };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.val as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = fn()
    .then((v) => {
      store.set(key, { exp: Date.now() + ttlSec * 1000, val: v });
      if (store.size > 500) store.delete(store.keys().next().value as string);
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function jsonCached(data: unknown, sMaxAge: number, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control":
        status === 200
          ? `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 5}`
          : "no-store",
    },
  });
}

export const SYMBOL_RE = /^[A-Za-z0-9.^=\-]{1,15}$/;

export function parseSymbols(raw: string | null, max = 200): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s)))].slice(0, max);
}
