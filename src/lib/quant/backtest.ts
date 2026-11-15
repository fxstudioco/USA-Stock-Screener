// Event-driven daily backtester for the swing engine.
// Conservative assumptions:
//  - Signal is computed on bar i close; a limit order at buyHigh is valid for bars i+1..i+3.
//  - If the open gaps below the limit we fill at the open (better price, still recorded honestly).
//  - If the open gaps through the stop we exit at the open (real gap loss, can exceed -1R).
//  - If stop and target are both touched on the same bar, the stop is assumed hit first.
//  - Round-trip cost of 0.10% of price is deducted (slippage + fees).
//  - One open position per symbol at a time. No earnings filter (historical dates unavailable for free).

import { SeriesPack, SwingParams, evaluateSwing } from "./swing";

export type ExitMode = "split" | "splitNoBE" | "splitTrail" | "fixed1" | "fixed2" | "trail50";

export interface Trade {
  symbol: string;
  entryTime: number;
  exitTime: number;
  entry: number;
  stop: number;
  r: number;
  holdBars: number;
  reason: string;
}

export interface BacktestOptions {
  params: SwingParams;
  exitMode: ExitMode;
  maxHoldBars: number;
  costPct: number;
  /** epoch-ms -> whether the market regime allows new longs (e.g. SPY > SMA200) */
  regimeOk?: (t: number) => boolean;
  startTime?: number;
}

export const runSymbolBacktest = (symbol: string, s: SeriesPack, o: BacktestOptions): Trade[] => {
  const trades: Trade[] = [];
  const n = s.bars.length;
  let i = 210;
  while (i < n - 2) {
    if (o.startTime && s.bars[i].t < o.startTime) {
      i++;
      continue;
    }
    const chk = evaluateSwing(s, i, o.params);
    if (!chk.passed || !chk.levels || (o.regimeOk && !o.regimeOk(s.bars[i].t))) {
      i++;
      continue;
    }
    const lv = chk.levels;
    // --- entry ---
    let entryIdx = -1;
    let entry = NaN;
    for (let k = i + 1; k <= Math.min(i + 3, n - 1); k++) {
      const b = s.bars[k];
      if (b.o <= lv.stop) break; // gapped below the stop before fill: skip setup
      if (b.o <= lv.buyHigh) {
        entry = b.o;
        entryIdx = k;
        break;
      }
      if (b.l <= lv.buyHigh) {
        entry = lv.buyHigh;
        entryIdx = k;
        break;
      }
    }
    if (entryIdx < 0) {
      i++;
      continue;
    }
    const stop = lv.stop;
    const risk = entry - stop;
    if (risk <= 0) {
      i++;
      continue;
    }
    const tp1 = entry + o.params.tp1R * risk;
    const tp2 = entry + o.params.tp2R * risk;
    let curStop = stop;
    let openFrac = 1;
    let realized = 0;
    let exitIdx = -1;
    let reason = "";
    for (let k = entryIdx; k < n; k++) {
      const b = s.bars[k];
      const isEntryBar = k === entryIdx;
      // stop check (on entry bar only the part of the bar after fill is unknown -> still check low)
      const gapOpen = !isEntryBar && b.o <= curStop;
      if (gapOpen || b.l <= curStop) {
        const px = gapOpen ? b.o : curStop;
        realized += openFrac * ((px - entry) / risk);
        openFrac = 0;
        exitIdx = k;
        reason = curStop >= entry ? "breakeven" : gapOpen ? "gap-stop" : "stop";
        break;
      }
      if (o.exitMode === "trail50") {
        if (b.c < s.sma50[k]) {
          realized += (b.c - entry) / risk;
          openFrac = 0;
          exitIdx = k;
          reason = "close<SMA50";
          break;
        }
      } else if (o.exitMode === "splitTrail") {
        if (openFrac === 1 && b.h >= tp1) {
          realized += 0.5 * o.params.tp1R;
          openFrac = 0.5;
        }
        if (openFrac === 0.5 && b.c < s.sma50[k]) {
          realized += 0.5 * ((b.c - entry) / risk);
          openFrac = 0;
          exitIdx = k;
          reason = "trail";
          break;
        }
      } else if (o.exitMode === "split" || o.exitMode === "splitNoBE") {
        if (openFrac === 1 && b.h >= tp1) {
          realized += 0.5 * o.params.tp1R;
          openFrac = 0.5;
          if (o.exitMode === "split") curStop = entry; // move to breakeven
        }
        if (openFrac === 0.5 && b.h >= tp2) {
          realized += 0.5 * o.params.tp2R;
          openFrac = 0;
          exitIdx = k;
          reason = "tp2";
          break;
        }
      } else {
        const target = o.exitMode === "fixed1" ? tp1 : tp2;
        if (b.h >= target) {
          realized += (target - entry) / risk;
          openFrac = 0;
          exitIdx = k;
          reason = "target";
          break;
        }
      }
      if (k - entryIdx >= o.maxHoldBars) {
        realized += openFrac * ((b.c - entry) / risk);
        openFrac = 0;
        exitIdx = k;
        reason = "time";
        break;
      }
    }
    if (exitIdx < 0) break; // still open at end of data: excluded (no look-ahead)
    const costR = (o.costPct * entry) / risk;
    trades.push({
      symbol,
      entryTime: s.bars[entryIdx].t,
      exitTime: s.bars[exitIdx].t,
      entry,
      stop,
      r: realized - costR,
      holdBars: exitIdx - entryIdx,
      reason,
    });
    i = exitIdx + 1;
  }
  return trades;
};

export interface BacktestStats {
  trades: number;
  winRate: number;
  avgR: number;
  medianR: number;
  profitFactor: number;
  avgHoldBars: number;
  maxDrawdownR: number;
  worstR: number;
  /** per-year average R, to check stability across regimes */
  byYear: Record<string, { n: number; avgR: number }>;
}

export const summarize = (trades: Trade[]): BacktestStats => {
  const rs = trades.map((t) => t.r);
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r <= 0);
  const sorted = [...rs].sort((a, b) => a - b);
  const byTime = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  let eq = 0;
  let peak = 0;
  let dd = 0;
  for (const t of byTime) {
    eq += t.r;
    peak = Math.max(peak, eq);
    dd = Math.min(dd, eq - peak);
  }
  const byYear: Record<string, { n: number; sum: number }> = {};
  for (const t of trades) {
    const y = String(new Date(t.entryTime).getUTCFullYear());
    byYear[y] ??= { n: 0, sum: 0 };
    byYear[y].n++;
    byYear[y].sum += t.r;
  }
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = -losses.reduce((a, b) => a + b, 0);
  return {
    trades: rs.length,
    winRate: rs.length ? wins.length / rs.length : NaN,
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : NaN,
    medianR: rs.length ? sorted[Math.floor(sorted.length / 2)] : NaN,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : NaN,
    avgHoldBars: trades.length ? trades.reduce((a, t) => a + t.holdBars, 0) / trades.length : NaN,
    maxDrawdownR: dd,
    worstR: sorted[0] ?? NaN,
    byYear: Object.fromEntries(
      Object.entries(byYear).map(([y, v]) => [y, { n: v.n, avgR: v.sum / v.n }]),
    ),
  };
};
