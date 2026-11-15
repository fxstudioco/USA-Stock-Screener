// Daily snapshot builder. Runs in GitHub Actions after the US close (and manually via `npm run snapshot`).
// Output: public/data/snapshot.json (served statically by Vercel; zero runtime Yahoo load for Modules 2/3/7).
import fs from "node:fs";
import path from "node:path";
import { UNIVERSE, SECTOR_ETFS, SECTOR_TO_ETF } from "../src/lib/universe";
import { yf, fetchBars } from "../src/lib/yahoo";
import { buildSeries, evaluateSwing, DEFAULT_SWING_PARAMS } from "../src/lib/quant/swing";
import { mean, round, Bar } from "../src/lib/quant/indicators";
import { scoreSwing } from "../src/lib/quant/scoring";
import { mapLimit } from "./history-cache";
import type { Fundamentals, ScreenerRow, SectorPerf, Snapshot, SwingPick } from "../src/lib/types";

const DAY = 86400e3;
const errors: string[] = [];

const ret = (c: number[], n: number) => (c.length > n ? c[c.length - 1] / c[c.length - 1 - n] - 1 : NaN);
const etDate = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

async function getHistory(symbol: string): Promise<Bar[] | null> {
  try {
    const p1 = new Date(Date.now() - 420 * DAY);
    const bars = await fetchBars(symbol, "1d", p1);
    return bars.length > 210 ? bars : null;
  } catch (e) {
    errors.push(`history ${symbol}: ${(e as Error).message}`);
    return null;
  }
}

async function getFundamentals(symbol: string): Promise<{ f: Fundamentals | null; earnings: string | null; beta: number | null }> {
  try {
    const q = await yf.quoteSummary(symbol, {
      modules: ["financialData", "calendarEvents", "defaultKeyStatistics", "summaryDetail"],
    });
    const fd = q.financialData;
    const dates = (q.calendarEvents?.earnings?.earningsDate ?? [])
      .map((d) => new Date(d))
      .filter((d) => d.getTime() >= Date.now() - DAY)
      .sort((a, b) => a.getTime() - b.getTime());
    return {
      f: {
        revenueGrowth: fd?.revenueGrowth ?? null,
        earningsGrowth: fd?.earningsGrowth ?? null,
        profitMargin: fd?.profitMargins ?? null,
        grossMargin: fd?.grossMargins ?? null,
        institutionPct: q.defaultKeyStatistics?.heldPercentInstitutions ?? null,
      },
      earnings: dates[0] ? dates[0].toISOString().slice(0, 10) : null,
      beta: q.summaryDetail?.beta ?? q.defaultKeyStatistics?.beta ?? null,
    };
  } catch (e) {
    errors.push(`fundamentals ${symbol}: ${(e as Error).message}`);
    return { f: null, earnings: null, beta: null };
  }
}

async function main() {
  const t0 = Date.now();
  // 1) live quote batch for market caps / names
  const quoteMap = new Map<string, { marketCap?: number; longName?: string; shortName?: string }>();
  const syms = UNIVERSE.map((u) => u.symbol);
  for (let i = 0; i < syms.length; i += 50) {
    try {
      const qs = await yf.quote(syms.slice(i, i + 50));
      for (const q of qs) quoteMap.set(q.symbol, q as never);
    } catch (e) {
      errors.push(`quote batch ${i}: ${(e as Error).message}`);
    }
  }

  // 2) daily history
  const hist = new Map<string, Bar[]>();
  const allSyms = [...syms, ...SECTOR_ETFS.map((s) => s.symbol), "^VIX"];
  await mapLimit(allSyms, 4, async (s) => {
    const h = await getHistory(s);
    if (h) hist.set(s, h);
  });

  // 3) regime
  const spyBars = hist.get("SPY");
  if (!spyBars) throw new Error("SPY history unavailable - aborting snapshot (keeping previous file)");
  const spyS = buildSeries(spyBars);
  const spy = spyS.close[spyS.close.length - 1];
  const spySma200 = spyS.sma200[spyS.sma200.length - 1];
  const vixBars = hist.get("^VIX");
  const vix = vixBars ? vixBars[vixBars.length - 1].c : null;
  const trendOk = spy > spySma200;
  const vixOk = vix == null || vix <= 30;
  const regime = {
    spy: round(spy),
    spySma200: round(spySma200),
    vix: vix != null ? round(vix) : null,
    riskOn: trendOk && vixOk,
    note: (!trendOk ? "risk-off-trend" : !vixOk ? "risk-off-vix" : "risk-on") as Snapshot["regime"]["note"],
  };

  // 4) sectors
  const sectors: SectorPerf[] = [];
  for (const e of SECTOR_ETFS) {
    const b = hist.get(e.symbol);
    if (!b) continue;
    const c = b.map((x) => x.c);
    const tail = b.slice(-64);
    sectors.push({
      symbol: e.symbol,
      sector: e.sector,
      price: round(c[c.length - 1]),
      r1d: ret(c, 1),
      r1w: ret(c, 5),
      r1m: ret(c, 21),
      r3m: ret(c, 63),
      series: tail.map((x) => ({ t: x.t, v: round((x.c / tail[0].c) * 100, 3) })),
    });
  }
  const sectorRank = new Map(
    [...sectors].sort((a, b) => b.r1m - a.r1m).map((s, i) => [s.sector as string, i + 1]),
  );
  const sectorRet = new Map(sectors.map((s) => [s.sector as string, s.r1m]));

  // 5) fundamentals (stocks only)
  const fund = new Map<string, Awaited<ReturnType<typeof getFundamentals>>>();
  await mapLimit(
    UNIVERSE.filter((u) => !u.isEtf),
    3,
    async (u) => fund.set(u.symbol, await getFundamentals(u.symbol)),
  );

  // 6) screener rows
  const rows: ScreenerRow[] = [];
  const swingRaw: { u: (typeof UNIVERSE)[number]; s: ReturnType<typeof buildSeries>; i: number }[] = [];
  for (const u of UNIVERSE) {
    const b = hist.get(u.symbol);
    if (!b) continue;
    const s = buildSeries(b);
    const i = b.length - 1;
    const c = s.close;
    const dailyRets = c.slice(-64).map((v, k, a) => (k ? v / a[k - 1] - 1 : 0)).slice(1);
    const m = mean(dailyRets);
    const vol63 = Math.sqrt(mean(dailyRets.map((r) => (r - m) ** 2))) * Math.sqrt(252);
    const avgVol50 = mean(s.vol.slice(-51, -1));
    let golden = false;
    for (let k = i - 29; k <= i; k++) if (s.sma50[k - 1] <= s.sma200[k - 1] && s.sma50[k] > s.sma200[k]) golden = true;
    const chk = evaluateSwing(s, i, DEFAULT_SWING_PARAMS);
    const fq = fund.get(u.symbol);
    const q = quoteMap.get(u.symbol);
    rows.push({
      symbol: u.symbol,
      name: u.name,
      sector: u.sector,
      isEtf: !!u.isEtf,
      price: round(c[i]),
      changePct: c[i] / c[i - 1] - 1,
      marketCap: q?.marketCap ?? null,
      volume: s.vol[i],
      avgVol50: Math.round(avgVol50),
      rvol: round(s.vol[i] / avgVol50, 2),
      sma50: round(s.sma50[i]),
      sma200: round(s.sma200[i]),
      ema9: round(s.ema9[i]),
      ema21: round(s.ema21[i]),
      rsi14: round(s.rsi14[i], 1),
      atr14: round(s.atr14[i]),
      atrPct: s.atr14[i] / c[i],
      ret1m: ret(c, 21),
      ret3m: ret(c, 63),
      volatility63: vol63,
      beta: fq?.beta ?? null,
      stage2: chk.stage2,
      nearEma21: chk.pullback,
      aboveEma9: c[i] > s.ema9[i],
      goldenCross: golden,
      earningsDate: fq?.earnings ?? null,
      fundamentals: fq?.f ?? null,
    });
    if (!u.isEtf && chk.passed) swingRaw.push({ u, s, i });
  }

  // 7) swing picks
  const stockRows = rows.filter((r) => !r.isEtf && Number.isFinite(r.ret3m));
  const sortedMom = stockRows.map((r) => r.ret3m).sort((a, b) => a - b);
  const pct = (v: number) => sortedMom.findIndex((x) => x >= v) / Math.max(1, sortedMom.length - 1);
  const excludedEarnings: string[] = [];
  const picks: SwingPick[] = [];
  for (const { u, s, i } of swingRaw) {
    const row = rows.find((r) => r.symbol === u.symbol)!;
    const chk = evaluateSwing(s, i, DEFAULT_SWING_PARAMS);
    const lv = chk.levels!;
    const days = row.earningsDate ? Math.ceil((new Date(row.earningsDate).getTime() - Date.now()) / DAY) : null;
    if (days != null && days >= 0 && days < 14) {
      excludedEarnings.push(u.symbol);
      continue;
    }
    let above = 0;
    for (let k = i - 49; k <= i; k++) if (s.close[k] > s.sma50[k]) above++;
    const rank = sectorRank.get(u.sector) ?? 6;
    const score = scoreSwing({
      momentumPercentile: pct(row.ret3m),
      pctAboveSma50Last50: above / 50,
      distEma21Atr: chk.metrics.distEma21Atr,
      fundamentals: row.fundamentals,
      sectorRank: rank,
      daysToEarnings: days,
    });
    const r2 = (n: number) => round(n, 2);
    picks.push({
      symbol: u.symbol,
      name: u.name,
      sector: u.sector,
      price: row.price,
      levels: {
        // If price already dipped below EMA21 the zone extends down to the current price.
        buyLow: r2(Math.min(lv.buyLow, row.price)),
        buyHigh: r2(lv.buyHigh),
        entryRef: r2(lv.entryRef),
        stop: r2(lv.stop),
        risk: r2(lv.risk),
        tp1: r2(lv.tp1),
        tp2: r2(lv.tp2),
        resistance: r2(lv.resistance),
        roomR: r2(lv.roomR),
      },
      riskPct: lv.risk / lv.entryRef,
      upsideTp1Pct: lv.tp1 / lv.entryRef - 1,
      upsideTp2Pct: lv.tp2 / lv.entryRef - 1,
      rrTp1: DEFAULT_SWING_PARAMS.tp1R,
      rrTp2: DEFAULT_SWING_PARAMS.tp2R,
      score,
      rsi14: row.rsi14,
      sma50: row.sma50,
      sma200: row.sma200,
      ema21: row.ema21,
      distEma21Atr: r2(chk.metrics.distEma21Atr),
      volRatio5v50: r2(chk.metrics.volRatio5v50),
      avgVol50: row.avgVol50,
      earningsDate: row.earningsDate,
      daysToEarnings: days,
      fundamentals: row.fundamentals,
      sectorRet1m: sectorRet.get(u.sector) ?? NaN,
      sectorRank: rank,
      roomR: r2(lv.roomR),
    });
  }
  picks.sort((a, b) => b.score.total - a.score.total);

  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    asOf: etDate(spyBars[spyBars.length - 1].t),
    source: "Yahoo Finance (unofficial, via yahoo-finance2) - end-of-day",
    regime,
    sectors,
    rows,
    swing: {
      picks: regime.riskOn ? picks.slice(0, 5) : [],
      candidatesPassed: picks.length,
      excludedEarnings,
      blockedByRegime: !regime.riskOn,
    },
    errors: errors.slice(0, 50),
  };
  const out = path.join(process.cwd(), "public", "data", "snapshot.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // Safety: never overwrite a good snapshot with a mostly-failed run.
  if (rows.length < UNIVERSE.length * 0.7) {
    throw new Error(`only ${rows.length}/${UNIVERSE.length} symbols loaded - refusing to overwrite snapshot`);
  }
  fs.writeFileSync(out, JSON.stringify(snapshot));
  console.log(
    `snapshot ok: rows=${rows.length} sectors=${sectors.length} passed=${picks.length} picks=${snapshot.swing.picks.length} regime=${regime.note} errors=${errors.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );
  if (errors.length) console.log(errors.slice(0, 10).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
