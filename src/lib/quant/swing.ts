// Swing-trade (1–3 month) setup engine. Shared by the daily snapshot job and the backtester,
// so the rules shown in the UI are exactly the rules that were backtested.

import { Bar, sma, ema, rsi, atr, lowest, highest, mean } from "./indicators";

export type StopMode = "atr" | "wider" | "tighter" | "structure";

export interface SwingParams {
  rsiMin: number;
  rsiMax: number;
  /** allowed close distance from EMA21, in ATR units */
  pullbackMinAtr: number;
  pullbackMaxAtr: number;
  minAvgVolume: number;
  stopMode: StopMode;
  atrStopMult: number;
  tp1R: number;
  tp2R: number;
  /** reject setups whose nearest overhead resistance is closer than this (in R); null = informational only */
  minRoomR: number | null;
  /** reject setups whose stop is wider than this fraction of price */
  maxRiskPct: number;
  /** reject setups whose stop distance is smaller than this many ATRs (avoids noise stops) */
  minRiskAtr: number;
  requireVolumeContraction: boolean;
}

export const DEFAULT_SWING_PARAMS: SwingParams = {
  // Backtest-calibrated (see scripts/backtest.ts): RSI 35–60 beat 40–55 in- and out-of-sample.
  rsiMin: 35,
  rsiMax: 60,
  pullbackMinAtr: -0.5,
  pullbackMaxAtr: 1.0,
  minAvgVolume: 1_000_000,
  stopMode: "wider",
  atrStopMult: 1.5,
  tp1R: 2,
  tp2R: 3.5,
  // A hard 1.5R room filter lowered expectancy in the backtest -> shown as a warning only.
  minRoomR: null,
  maxRiskPct: 0.12,
  minRiskAtr: 1.0,
  requireVolumeContraction: false,
};

export interface SeriesPack {
  bars: Bar[];
  close: number[];
  high: number[];
  low: number[];
  vol: number[];
  sma50: number[];
  sma200: number[];
  ema21: number[];
  ema9: number[];
  rsi14: number[];
  atr14: number[];
}

export const buildSeries = (bars: Bar[]): SeriesPack => {
  const close = bars.map((b) => b.c);
  return {
    bars,
    close,
    high: bars.map((b) => b.h),
    low: bars.map((b) => b.l),
    vol: bars.map((b) => b.v),
    sma50: sma(close, 50),
    sma200: sma(close, 200),
    ema21: ema(close, 21),
    ema9: ema(close, 9),
    rsi14: rsi(close, 14),
    atr14: atr(bars, 14),
  };
};

export interface SwingLevels {
  buyLow: number;
  buyHigh: number;
  entryRef: number;
  stop: number;
  risk: number;
  tp1: number;
  tp2: number;
  resistance: number;
  roomR: number;
}

export interface SwingCheck {
  stage2: boolean;
  pullback: boolean;
  rsiOk: boolean;
  liquidityOk: boolean;
  volumeContraction: boolean;
  roomOk: boolean;
  riskOk: boolean;
  passed: boolean;
  levels: SwingLevels | null;
  metrics: {
    distEma21Atr: number;
    avgVol50: number;
    volRatio5v50: number;
    sma200Slope20: number;
  };
}

export const computeLevels = (s: SeriesPack, i: number, p: SwingParams): SwingLevels | null => {
  const a = s.atr14[i];
  const e21 = s.ema21[i];
  if (!Number.isFinite(a) || !Number.isFinite(e21)) return null;
  const buyLow = e21;
  const buyHigh = Math.min(e21 + 0.5 * a, Math.max(s.close[i], e21));
  const entryRef = (buyLow + buyHigh) / 2;
  const atrStop = entryRef - p.atrStopMult * a;
  const swingLow20 = lowest(s.low, i - 19, i) - 0.2 * a;
  const swingLow10 = lowest(s.low, i - 9, i) - 0.2 * a;
  let stop: number;
  switch (p.stopMode) {
    case "atr":
      stop = atrStop;
      break;
    case "wider":
      stop = Math.min(swingLow20, atrStop);
      break;
    case "tighter":
      stop = Math.max(swingLow20, atrStop);
      break;
    case "structure":
      stop = swingLow10;
      break;
  }
  if (stop >= buyLow) stop = buyLow - p.atrStopMult * a;
  const risk = entryRef - stop;
  const resistance = highest(s.high, i - 59, i);
  const roomR = risk > 0 ? (resistance - entryRef) / risk : 0;
  return {
    buyLow,
    buyHigh,
    entryRef,
    stop,
    risk,
    tp1: entryRef + p.tp1R * risk,
    tp2: entryRef + p.tp2R * risk,
    resistance,
    roomR,
  };
};

export const evaluateSwing = (s: SeriesPack, i: number, p: SwingParams = DEFAULT_SWING_PARAMS): SwingCheck => {
  const c = s.close[i];
  const a = s.atr14[i];
  const sma200Slope20 = i >= 20 ? s.sma200[i] / s.sma200[i - 20] - 1 : NaN;
  const stage2 = c > s.sma50[i] && s.sma50[i] > s.sma200[i] && sma200Slope20 > 0;
  const distEma21Atr = (c - s.ema21[i]) / a;
  const pullback = distEma21Atr >= p.pullbackMinAtr && distEma21Atr <= p.pullbackMaxAtr;
  const rsiOk = s.rsi14[i] >= p.rsiMin && s.rsi14[i] <= p.rsiMax;
  const avgVol50 = mean(s.vol.slice(Math.max(0, i - 49), i + 1));
  const avgVol5 = mean(s.vol.slice(Math.max(0, i - 4), i + 1));
  const volRatio5v50 = avgVol5 / avgVol50;
  const liquidityOk = avgVol50 >= p.minAvgVolume;
  const volumeContraction = volRatio5v50 < 1;
  const levels = computeLevels(s, i, p);
  const roomOk = levels ? p.minRoomR === null || levels.roomR >= p.minRoomR : false;
  const riskOk = levels
    ? levels.risk >= p.minRiskAtr * a && levels.risk / levels.entryRef <= p.maxRiskPct
    : false;
  const passed =
    stage2 &&
    pullback &&
    rsiOk &&
    liquidityOk &&
    roomOk &&
    riskOk &&
    (!p.requireVolumeContraction || volumeContraction);
  return {
    stage2,
    pullback,
    rsiOk,
    liquidityOk,
    volumeContraction,
    roomOk,
    riskOk,
    passed,
    levels,
    metrics: { distEma21Atr, avgVol50, volRatio5v50, sma200Slope20 },
  };
};
