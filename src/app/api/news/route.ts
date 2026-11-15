import { finnhub, MissingKeyError } from "@/lib/server/finnhub";
import { cached, jsonCached, SYMBOL_RE } from "@/lib/server/cache";
import { tagNews } from "@/lib/news-tagging";
import type { NewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface FinnhubNews {
  id: number;
  datetime: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  related: string;
}

const RANK = { High: 0, Medium: 1, Low: 2 } as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: Request) {
  const symbol = (new URL(req.url).searchParams.get("symbol") ?? "").toUpperCase();
  if (symbol && !SYMBOL_RE.test(symbol)) return jsonCached({ error: "bad symbol" }, 0, 400);
  try {
    const data = await cached(`news:${symbol}`, 600, async () => {
      const raw = symbol
        ? await finnhub<FinnhubNews[]>("/company-news", {
            symbol,
            from: iso(new Date(Date.now() - 7 * 86400e3)),
            to: iso(new Date()),
          })
        : await finnhub<FinnhubNews[]>("/news", { category: "general" });
      const seen = new Set<string>();
      const items: NewsItem[] = raw
        .filter((n) => n.headline && n.url)
        .filter((n) => (seen.has(n.headline) ? false : (seen.add(n.headline), true)))
        .slice(0, 80)
        .map((n) => ({
          id: n.id,
          headline: n.headline,
          summary: (n.summary ?? "").slice(0, 280),
          source: n.source,
          url: n.url,
          datetime: n.datetime * 1000,
          related: (n.related ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6),
          ...tagNews(n.headline, n.summary ?? ""),
        }))
        .sort((a, b) => RANK[a.impact] - RANK[b.impact] || b.datetime - a.datetime);
      return { fetchedAt: new Date().toISOString(), items };
    });
    return jsonCached(data, 600);
  } catch (e) {
    if (e instanceof MissingKeyError) return jsonCached({ error: "missing_key" }, 0, 503);
    return jsonCached({ error: (e as Error).message }, 0, 502);
  }
}
