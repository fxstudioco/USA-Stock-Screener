import { finnhub, MissingKeyError } from "@/lib/server/finnhub";
import { cached, jsonCached } from "@/lib/server/cache";
import type { IpoItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface FinnhubIpo {
  date: string;
  exchange: string | null;
  name: string;
  numberOfShares: number | null;
  price: string | null;
  status: string | null;
  symbol: string | null;
  totalSharesValue: number | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function GET() {
  try {
    const data = await cached("ipo", 3 * 3600, async () => {
      const now = new Date();
      const from = new Date(now.getTime() - 30 * 86400e3);
      const to = new Date(now.getTime() + 60 * 86400e3);
      const r = await finnhub<{ ipoCalendar?: FinnhubIpo[] }>("/calendar/ipo", { from: iso(from), to: iso(to) });
      const today = iso(now);
      const items: IpoItem[] = (r.ipoCalendar ?? [])
        .filter((x) => x.status !== "withdrawn")
        .filter((x) => !x.exchange || /nasdaq|nyse/i.test(x.exchange))
        .map((x) => {
          const lock = new Date(new Date(x.date).getTime() + 180 * 86400e3);
          return {
            name: x.name,
            symbol: x.symbol || null,
            exchange: x.exchange,
            date: x.date,
            priceRange: x.price || null,
            shares: x.numberOfShares,
            offerValue: x.totalSharesValue,
            status: x.status,
            lockupEstimate: iso(lock),
          };
        });
      return {
        fetchedAt: new Date().toISOString(),
        upcoming: items.filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
        recent: items
          .filter((x) => x.date < today && (x.status === "priced" || !x.status))
          .sort((a, b) => b.date.localeCompare(a.date)),
      };
    });
    return jsonCached(data, 3 * 3600);
  } catch (e) {
    if (e instanceof MissingKeyError) return jsonCached({ error: "missing_key" }, 0, 503);
    return jsonCached({ error: (e as Error).message }, 0, 502);
  }
}
