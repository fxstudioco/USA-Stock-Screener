import { fetchBars, aggregateBars, ChartInterval } from "@/lib/yahoo";
import { cached, jsonCached, SYMBOL_RE } from "@/lib/server/cache";

export const dynamic = "force-dynamic";

const TF: Record<string, { interval: ChartInterval; days: number; group?: number; ttl: number; prepost?: boolean }> = {
  "1m": { interval: "1m", days: 5, ttl: 60 },
  "5m": { interval: "5m", days: 12, ttl: 60 },
  "15m": { interval: "15m", days: 30, ttl: 120 },
  "1h": { interval: "60m", days: 180, ttl: 300 },
  "4h": { interval: "60m", days: 365, group: 4, ttl: 600 },
  "1d": { interval: "1d", days: 760, ttl: 1800 },
  "1wk": { interval: "1wk", days: 3650, ttl: 3600 },
};

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const symbol = (sp.get("symbol") ?? "").toUpperCase();
  const tf = sp.get("tf") ?? "1d";
  const cfg = TF[tf];
  if (!SYMBOL_RE.test(symbol) || !cfg) return jsonCached({ error: "bad params" }, 0, 400);
  try {
    const bars = await cached(`h:${symbol}:${tf}`, cfg.ttl, async () => {
      const raw = await fetchBars(symbol, cfg.interval, new Date(Date.now() - cfg.days * 86400e3));
      return cfg.group ? aggregateBars(raw, cfg.group) : raw;
    });
    return jsonCached({ symbol, tf, fetchedAt: new Date().toISOString(), bars }, cfg.ttl);
  } catch (e) {
    return jsonCached({ error: (e as Error).message }, 0, 502);
  }
}
