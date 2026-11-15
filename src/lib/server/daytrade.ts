// Module 4 – intraday bullish momentum scanner.
// Funnel: (Yahoo predefined screeners `day_gainers` + `most_actives` over the WHOLE US market)
//       + (curated universe quotes) -> cheap prefilter on quote fields -> 5m bars for top ~24
//       -> time-of-day adjusted RVOL, session VWAP, EMA9 (5m), ATR% (from aggregated daily bars).
import { yf, fetchBars } from "../yahoo";
import { UNIVERSE } from "../universe";
import { ema, vwap, atr, Bar, round, etInfo } from "../quant/indicators";
import { getQuotes } from "./quotes";
import { mapLimit } from "./util";
import type { DayTradePick, DayTradeResponse, QuoteLite } from "../types";

export const DAYTRADE_RULES = {
  minRvol: 2.0,
  minChangePct: 2.0,
  minAvgVolume: 2_000_000,
  minAtrPct: 2.5,
  minPrice: 5,
};

const etDay = (t: number) => etInfo(t).date;
const etMin = (t: number) => etInfo(t).minute;

async function marketCandidates(): Promise<{ q: QuoteLite; marketCap: number | null; source: "market" }[]> {
  const out: { q: QuoteLite; marketCap: number | null; source: "market" }[] = [];
  for (const id of ["day_gainers", "most_actives"] as const) {
    try {
      const r = (await yf.screener({ scrIds: id, count: 100 }, undefined, { validateResult: false })) as {
        quotes?: Record<string, unknown>[];
      };
      for (const q of r.quotes ?? []) {
        const exch = String(q.exchange ?? "");
        if (!["NMS", "NYQ", "NGM", "NCM", "ASE", "PCX", "BTS"].includes(exch)) continue;
        if (q.quoteType !== "EQUITY" && q.quoteType !== "ETF") continue;
        out.push({
          q: {
            symbol: String(q.symbol),
            name: String(q.longName ?? q.shortName ?? q.symbol),
            price: (q.regularMarketPrice as number) ?? null,
            change: (q.regularMarketChange as number) ?? null,
            changePct: (q.regularMarketChangePercent as number) ?? null,
            prevClose: (q.regularMarketPreviousClose as number) ?? null,
            volume: (q.regularMarketVolume as number) ?? null,
            avgVolume3m: (q.averageDailyVolume3Month as number) ?? null,
            marketState: (q.marketState as string) ?? null,
            time: null,
            currency: "USD",
            preMarketPrice: null,
            preMarketChangePct: null,
            postMarketPrice: null,
            postMarketChangePct: null,
            dayHigh: (q.regularMarketDayHigh as number) ?? null,
            dayLow: (q.regularMarketDayLow as number) ?? null,
          },
          marketCap: (q.marketCap as number) ?? null,
          source: "market",
        });
      }
    } catch {
      // screener unavailable -> universe-only scan (reported via `note`)
    }
  }
  return out;
}

interface Analysis {
  pick: DayTradePick;
  failed: string[];
}

function analyze(
  base: { q: QuoteLite; marketCap: number | null; source: "market" | "universe" },
  bars: Bar[],
): Analysis | null {
  // regular-session bars only (09:30–16:00 ET)
  const reg = bars.filter((b) => {
    const m = etMin(b.t);
    return m >= 570 && m < 960;
  });
  if (reg.length < 20) return null;
  const byDay = new Map<string, Bar[]>();
  for (const b of reg) {
    const d = etDay(b.t);
    const arr = byDay.get(d);
    if (arr) arr.push(b);
    else byDay.set(d, [b]);
  }
  const days = [...byDay.keys()];
  const today = days[days.length - 1];
  const todayBars = byDay.get(today) ?? [];
  const lastMin = etMin(todayBars[todayBars.length - 1].t);
  const cumToday = todayBars.reduce((a, b) => a + b.v, 0);
  // time-of-day adjusted RVOL: today's cumulative volume vs avg cumulative volume up to the same minute
  const prior = days.slice(-11, -1);
  const priorCums = prior.map((d) =>
    (byDay.get(d) ?? []).filter((b) => etMin(b.t) <= lastMin).reduce((a, b) => a + b.v, 0),
  );
  const avgCum = priorCums.length ? priorCums.reduce((a, b) => a + b, 0) / priorCums.length : NaN;
  const rvolTime = avgCum > 0 ? cumToday / avgCum : NaN;
  // daily bars aggregated from 5m for ATR%
  const daily: Bar[] = days.map((d) => {
    const bs = byDay.get(d) ?? [];
    return {
      t: bs[0].t,
      o: bs[0].o,
      h: Math.max(...bs.map((b) => b.h)),
      l: Math.min(...bs.map((b) => b.l)),
      c: bs[bs.length - 1].c,
      v: bs.reduce((a, b) => a + b.v, 0),
    };
  });
  const atrArr = atr(daily, Math.min(10, daily.length - 1));
  const atrVal = atrArr[atrArr.length - 1];
  const vw = vwap(reg);
  const e9 = ema(reg.map((b) => b.c), 9);
  const price = base.q.price ?? reg[reg.length - 1].c;
  const v = vw[vw.length - 1];
  const e = e9[e9.length - 1];
  const dayHigh = Math.max(...todayBars.map((b) => b.h), base.q.dayHigh ?? 0);
  const dayLow = Math.min(...todayBars.map((b) => b.l), base.q.dayLow ?? Infinity);
  const prevClose = base.q.prevClose ?? daily[daily.length - 2]?.c ?? NaN;
  const atrPct = (atrVal / prevClose) * 100;
  const changePct = base.q.changePct ?? (price / prevClose - 1) * 100;
  const avgVolume = base.q.avgVolume3m ?? NaN;
  const support1 = Math.max(Math.min(v, e), dayLow);
  const breakout = dayHigh * 1.001;
  const target = breakout + Math.max(breakout - support1, atrVal * 0.5);
  const failed: string[] = [];
  if (!(rvolTime >= DAYTRADE_RULES.minRvol)) failed.push("rvol");
  if (!(changePct >= DAYTRADE_RULES.minChangePct)) failed.push("change");
  if (!(avgVolume >= DAYTRADE_RULES.minAvgVolume)) failed.push("avgVolume");
  if (!(atrPct >= DAYTRADE_RULES.minAtrPct)) failed.push("atr");
  if (!(price > v)) failed.push("vwap");
  if (!(price > e)) failed.push("ema9");
  if (!(price >= DAYTRADE_RULES.minPrice)) failed.push("price");
  const score =
    40 * Math.min(1, (rvolTime || 0) / 5) +
    30 * Math.min(1, Math.max(0, changePct) / 10) +
    30 * Math.min(1, Math.max(0, (price - v) / (atrVal || 1)));
  return {
    failed,
    pick: {
      symbol: base.q.symbol,
      name: base.q.name,
      price: round(price),
      changePct: round(changePct, 2),
      rvolTime: round(rvolTime, 2),
      rvolDaily: round((base.q.volume ?? cumToday) / avgVolume, 2),
      dayHigh: round(dayHigh),
      dayLow: round(dayLow),
      vwap: round(v),
      ema9: round(e),
      aboveVwap: price > v,
      aboveEma9: price > e,
      atrPct: round(atrPct, 2),
      avgVolume: Math.round(avgVolume),
      marketCap: base.marketCap,
      support1: round(support1),
      breakout: round(breakout),
      target: round(target),
      score: round(score, 1),
      source: base.source,
    },
  };
}

export async function runDayTradeScan(): Promise<DayTradeResponse> {
  const [market, uq] = await Promise.all([
    marketCandidates(),
    getQuotes(UNIVERSE.filter((u) => !u.isEtf).map((u) => u.symbol)).catch(() => [] as QuoteLite[]),
  ]);
  const map = new Map<string, { q: QuoteLite; marketCap: number | null; source: "market" | "universe" }>();
  for (const q of uq) map.set(q.symbol, { q, marketCap: null, source: "universe" });
  for (const m of market) if (!map.has(m.q.symbol)) map.set(m.q.symbol, m);
  const all = [...map.values()];
  const marketState = uq[0]?.marketState ?? market[0]?.q.marketState ?? "UNKNOWN";
  // cheap prefilter on quote fields, then rank by naive RVOL x change
  const pre = all
    .filter(
      (c) =>
        (c.q.price ?? 0) >= DAYTRADE_RULES.minPrice &&
        (c.q.changePct ?? 0) > 0 &&
        (c.q.avgVolume3m ?? 0) >= DAYTRADE_RULES.minAvgVolume * 0.8,
    )
    .map((c) => ({ c, k: ((c.q.volume ?? 0) / (c.q.avgVolume3m ?? 1)) * (c.q.changePct ?? 0) }))
    .sort((a, b) => b.k - a.k)
    .slice(0, 24)
    .map((x) => x.c);
  const p1 = new Date(Date.now() - 18 * 86400e3);
  const analyses = (
    await mapLimit(pre, 6, async (c) => {
      try {
        return analyze(c, await fetchBars(c.q.symbol, "5m", p1));
      } catch {
        return null;
      }
    })
  ).filter((a): a is Analysis => !!a);
  const passed = analyses.filter((a) => a.failed.length === 0).map((a) => a.pick).sort((a, b) => b.score - a.score);
  const near = analyses
    .filter((a) => a.failed.length > 0 && a.failed.length <= 2)
    .sort((a, b) => b.pick.score - a.pick.score)
    .slice(0, 5)
    .map((a) => ({ ...a.pick, failed: a.failed }));
  return {
    generatedAt: new Date().toISOString(),
    marketState,
    scanned: all.length,
    picks: passed.slice(0, 5),
    nearMisses: near,
    note: market.length === 0 ? "market-screener-unavailable" : undefined,
  };
}
