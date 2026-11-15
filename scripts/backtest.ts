// Walk-through backtest of the swing engine over the curated universe.
// Usage: npm run backtest            -> prints a variant comparison table
//        npm run backtest -- --write -> also writes public/data/backtest.json (default params only)
import fs from "node:fs";
import path from "node:path";
import { STOCKS } from "../src/lib/universe";
import { buildSeries, DEFAULT_SWING_PARAMS, SwingParams, SeriesPack } from "../src/lib/quant/swing";
import { runSymbolBacktest, summarize, ExitMode, Trade } from "../src/lib/quant/backtest";
import { sma } from "../src/lib/quant/indicators";
import { getDaily, mapLimit } from "./history-cache";

const YEARS = 11;

interface Variant {
  name: string;
  params: Partial<SwingParams>;
  exit: ExitMode;
  regime: boolean;
}

const BASE: Partial<SwingParams> = { rsiMin: 0, rsiMax: 100, pullbackMinAtr: -99, pullbackMaxAtr: 99 };
// The first variant MUST be the production configuration (DEFAULT_SWING_PARAMS + splitNoBE + regime).
const VARIANTS: Variant[] = [
  { name: "FINAL: Stage2 + pullback + RSI35-60, wide stop, TP1 50% / TP2 3.5R, regime", params: {}, exit: "splitNoBE", regime: true },
  { name: "Original spec: RSI40-55 + room>=1.5R + stop to breakeven", params: { rsiMin: 40, rsiMax: 55, minRoomR: 1.5 }, exit: "split", regime: true },
  { name: "FINAL without regime filter", params: {}, exit: "splitNoBE", regime: false },
  { name: "FINAL with stop to breakeven after TP1", params: {}, exit: "split", regime: true },
  { name: "FINAL, stop = 1.5x ATR only", params: { stopMode: "atr" }, exit: "splitNoBE", regime: true },
  { name: "FINAL, stop = 10-day swing low", params: { stopMode: "structure" }, exit: "splitNoBE", regime: true },
  { name: "FINAL, exit all at 2R", params: {}, exit: "fixed1", regime: true },
  { name: "FINAL, exit all at 3.5R", params: {}, exit: "fixed2", regime: true },
  { name: "FINAL, TP1 50% then trail close<SMA50", params: {}, exit: "splitTrail", regime: true },
  { name: "Baseline: any Stage-2 day (no pullback/RSI rule)", params: BASE, exit: "splitNoBE", regime: true },
];

async function main() {
  const write = process.argv.includes("--write");
  const spy = await getDaily("SPY", YEARS);
  const spySma = sma(spy.map((b) => b.c), 200);
  const regimeMap = new Map<string, boolean>();
  spy.forEach((b, i) => regimeMap.set(new Date(b.t).toISOString().slice(0, 10), b.c > spySma[i]));
  const regimeOk = (t: number) => regimeMap.get(new Date(t).toISOString().slice(0, 10)) ?? false;

  const series: { symbol: string; s: SeriesPack }[] = [];
  await mapLimit(STOCKS, 4, async (u) => {
    try {
      const bars = await getDaily(u.symbol, YEARS);
      if (bars.length > 260) series.push({ symbol: u.symbol, s: buildSeries(bars) });
    } catch (e) {
      console.error("skip", u.symbol, (e as Error).message);
    }
  });
  console.log(`symbols loaded: ${series.length}/${STOCKS.length}`);

  const rows: Record<string, unknown>[] = [];
  const variantStats: { name: string; all: ReturnType<typeof summarize>; inSample: ReturnType<typeof summarize>; outOfSample: ReturnType<typeof summarize> }[] = [];
  let proposed: { trades: Trade[] } | null = null;
  for (const v of VARIANTS) {
    const params = { ...DEFAULT_SWING_PARAMS, ...v.params };
    const all: Trade[] = [];
    for (const { symbol, s } of series) {
      all.push(
        ...runSymbolBacktest(symbol, s, {
          params,
          exitMode: v.exit,
          maxHoldBars: 63,
          costPct: 0.001,
          regimeOk: v.regime ? regimeOk : undefined,
        }),
      );
    }
    const st = summarize(all);
    const cut = Date.UTC(2022, 0, 1);
    const ins = summarize(all.filter((t) => t.entryTime < cut));
    const oos = summarize(all.filter((t) => t.entryTime >= cut));
    if (!proposed) proposed = { trades: all };
    variantStats.push({ name: v.name, all: st, inSample: ins, outOfSample: oos });
    rows.push({
      variant: v.name,
      n: st.trades,
      win: (st.winRate * 100).toFixed(1) + "%",
      avgR: st.avgR.toFixed(3),
      medR: st.medianR.toFixed(2),
      PF: st.profitFactor.toFixed(2),
      hold: st.avgHoldBars.toFixed(0),
      worst: st.worstR.toFixed(2),
      "IS<2022 avgR": `${ins.avgR.toFixed(3)} (${ins.trades})`,
      "OOS>=2022 avgR": `${oos.avgR.toFixed(3)} (${oos.trades})`,
      "OOS PF": oos.profitFactor.toFixed(2),
    });
  }
  console.table(rows);

  if (proposed) {
    const st = summarize(proposed.trades);
    console.log("PROPOSED by year:", JSON.stringify(st.byYear));
    const reasons: Record<string, number> = {};
    proposed.trades.forEach((t) => (reasons[t.reason] = (reasons[t.reason] ?? 0) + 1));
    console.log("exit reasons:", reasons);
    if (write) {
      const out = {
        generatedAt: new Date().toISOString(),
        years: YEARS,
        symbols: series.length,
        params: DEFAULT_SWING_PARAMS,
        assumptions: [
          "Signal on daily close; limit buy at top of buy range valid 3 sessions",
          "Gap through stop exits at the open (losses can exceed 1R)",
          "Same-bar stop+target conflicts resolved as stop first",
          "0.10% round-trip cost; max hold 63 sessions; one position per symbol",
          "Regime filter: new entries only when SPY > SMA200",
          "In-sample = entries before 2022-01-01; out-of-sample = 2022 onward",
          "No historical earnings filter; survivorship bias (today's large caps)",
        ],
        stats: st,
        outOfSample: summarize(proposed.trades.filter((t) => t.entryTime >= Date.UTC(2022, 0, 1))),
        variants: variantStats.map((v) => ({
          name: v.name,
          trades: v.all.trades,
          winRate: v.all.winRate,
          avgR: v.all.avgR,
          profitFactor: v.all.profitFactor,
          oosAvgR: v.outOfSample.avgR,
          oosProfitFactor: v.outOfSample.profitFactor,
          oosTrades: v.outOfSample.trades,
        })),
        recent: [...proposed.trades].sort((a, b) => b.entryTime - a.entryTime).slice(0, 25),
      };
      const file = path.join(process.cwd(), "public", "data", "backtest.json");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(out));
      console.log("wrote", file);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
