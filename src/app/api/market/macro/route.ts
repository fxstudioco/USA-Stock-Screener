import { MACRO_SYMBOLS } from "@/lib/macro";
import { getQuotes } from "@/lib/server/quotes";
import { fetchBars } from "@/lib/yahoo";
import { cached, jsonCached } from "@/lib/server/cache";
import { mapLimit } from "@/lib/server/util";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await cached("macro", 240, async () => {
      const symbols = MACRO_SYMBOLS.map((m) => m.symbol);
      const quotes = await getQuotes(symbols);
      const p1 = new Date(Date.now() - 45 * 86400e3);
      const sparks = await mapLimit(symbols, 5, async (s) => {
        try {
          const bars = await fetchBars(s, "1d", p1);
          return { symbol: s, closes: bars.slice(-22).map((b) => b.c) };
        } catch {
          return { symbol: s, closes: [] as number[] };
        }
      });
      return { fetchedAt: new Date().toISOString(), quotes, sparks };
    });
    return jsonCached(data, 300);
  } catch (e) {
    return jsonCached({ error: (e as Error).message }, 0, 502);
  }
}
