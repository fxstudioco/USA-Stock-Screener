// Server-only Yahoo Finance client (unofficial API via yahoo-finance2). Never import in client components.
import YahooFinance from "yahoo-finance2";
import { etInfo, type Bar } from "./quant/indicators";

export const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  queue: { concurrency: 6 },
});

export type ChartInterval = "1m" | "5m" | "15m" | "30m" | "60m" | "1h" | "1d" | "1wk";

export async function fetchBars(
  symbol: string,
  interval: ChartInterval,
  period1: Date,
  period2: Date = new Date(),
  includePrePost = false,
): Promise<Bar[]> {
  const res = await yf.chart(symbol, { period1, period2, interval, includePrePost, return: "array" });
  return (res.quotes ?? [])
    .filter(
      (q) =>
        q.open != null && q.high != null && q.low != null && q.close != null && Number.isFinite(q.close),
    )
    .map((q) => ({
      t: new Date(q.date).getTime(),
      o: q.open as number,
      h: q.high as number,
      l: q.low as number,
      c: q.close as number,
      v: (q.volume as number) ?? 0,
    }));
}

/** Aggregate bars into larger buckets (e.g. 1h -> 4h) anchored on the ET session open. */
export function aggregateBars(bars: Bar[], groupSize: number): Bar[] {
  const out: Bar[] = [];
  let dayKey = "";
  let bucket: Bar[] = [];
  const flush = () => {
    if (!bucket.length) return;
    out.push({
      t: bucket[0].t,
      o: bucket[0].o,
      h: Math.max(...bucket.map((b) => b.h)),
      l: Math.min(...bucket.map((b) => b.l)),
      c: bucket[bucket.length - 1].c,
      v: bucket.reduce((a, b) => a + b.v, 0),
    });
    bucket = [];
  };
  for (const b of bars) {
    const d = etInfo(b.t).date;
    if (d !== dayKey) {
      flush();
      dayKey = d;
    }
    bucket.push(b);
    if (bucket.length === groupSize) flush();
  }
  flush();
  return out;
}
