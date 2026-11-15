import { yf } from "@/lib/yahoo";
import { cached, jsonCached } from "@/lib/server/cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  if (q.length < 1) return jsonCached({ results: [] }, 60);
  try {
    const results = await cached(`s:${q.toLowerCase()}`, 3600, async () => {
      const r = (await yf.search(q, { quotesCount: 8, newsCount: 0 }, { validateResult: false })) as {
        quotes?: Record<string, unknown>[];
      };
      return (r.quotes ?? [])
        .filter((x) => (x.quoteType === "EQUITY" || x.quoteType === "ETF") && typeof x.symbol === "string")
        .filter((x) => !String(x.symbol).includes(".") || String(x.symbol).endsWith(".B"))
        .map((x) => ({
          symbol: String(x.symbol),
          name: String(x.longname ?? x.shortname ?? x.symbol),
          exchange: String(x.exchDisp ?? x.exchange ?? ""),
          type: String(x.quoteType),
        }));
    });
    return jsonCached({ results }, 3600);
  } catch (e) {
    return jsonCached({ error: (e as Error).message, results: [] }, 0, 502);
  }
}
