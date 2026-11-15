// Finnhub free tier (60 calls/min). Key is read server-side only.
export class MissingKeyError extends Error {}

export async function finnhub<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new MissingKeyError("FINNHUB_API_KEY not configured");
  const url = new URL(`https://finnhub.io/api/v1${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "X-Finnhub-Token": key }, cache: "no-store" });
  if (!res.ok) throw new Error(`Finnhub ${path} HTTP ${res.status}`);
  return (await res.json()) as T;
}
