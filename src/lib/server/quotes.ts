import { yf } from "../yahoo";
import type { QuoteLite } from "../types";

type YQ = Record<string, unknown> & { symbol: string };
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function toQuoteLite(q: YQ): QuoteLite {
  const t = q.regularMarketTime;
  return {
    symbol: q.symbol,
    name: (q.longName as string) ?? (q.shortName as string) ?? q.symbol,
    price: num(q.regularMarketPrice),
    change: num(q.regularMarketChange),
    changePct: num(q.regularMarketChangePercent),
    prevClose: num(q.regularMarketPreviousClose),
    volume: num(q.regularMarketVolume),
    avgVolume3m: num(q.averageDailyVolume3Month),
    marketState: (q.marketState as string) ?? null,
    time: t instanceof Date ? t.getTime() : typeof t === "number" ? t * 1000 : null,
    currency: (q.currency as string) ?? null,
    preMarketPrice: num(q.preMarketPrice),
    preMarketChangePct: num(q.preMarketChangePercent),
    postMarketPrice: num(q.postMarketPrice),
    postMarketChangePct: num(q.postMarketChangePercent),
    dayHigh: num(q.regularMarketDayHigh),
    dayLow: num(q.regularMarketDayLow),
  };
}

export async function getQuotes(symbols: string[]): Promise<QuoteLite[]> {
  const out: QuoteLite[] = [];
  for (let i = 0; i < symbols.length; i += 60) {
    const chunk = symbols.slice(i, i + 60);
    const res = (await yf.quote(chunk, {}, { validateResult: false })) as unknown;
    const arr = (Array.isArray(res) ? res : [res]) as YQ[];
    out.push(...arr.filter((q) => q && q.symbol).map(toQuoteLite));
  }
  return out;
}
