import { getQuotes } from "@/lib/server/quotes";
import { cached, jsonCached, parseSymbols } from "@/lib/server/cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbols = parseSymbols(new URL(req.url).searchParams.get("symbols"));
  if (!symbols.length) return jsonCached({ error: "symbols required" }, 0, 400);
  try {
    const key = `q:${symbols.join(",")}`;
    const quotes = await cached(key, 45, () => getQuotes(symbols));
    return jsonCached({ fetchedAt: new Date().toISOString(), quotes }, 60);
  } catch (e) {
    return jsonCached({ error: (e as Error).message }, 0, 502);
  }
}
