// Indicator helpers built on the `technicalindicators` package.
// Every function returns an array aligned 1:1 with the input (leading values = NaN).

import { SMA, EMA, RSI, ATR, MACD } from "technicalindicators";

export interface Bar {
  t: number; // epoch ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

const pad = (out: number[], len: number): number[] =>
  Array(Math.max(0, len - out.length)).fill(NaN).concat(out);

export const sma = (values: number[], period: number): number[] =>
  values.length < period ? values.map(() => NaN) : pad(SMA.calculate({ period, values }), values.length);

export const ema = (values: number[], period: number): number[] =>
  values.length < period ? values.map(() => NaN) : pad(EMA.calculate({ period, values }), values.length);

export const rsi = (values: number[], period = 14): number[] =>
  values.length <= period ? values.map(() => NaN) : pad(RSI.calculate({ period, values }), values.length);

export const atr = (bars: Bar[], period = 14): number[] =>
  bars.length <= period
    ? bars.map(() => NaN)
    : pad(
        ATR.calculate({
          period,
          high: bars.map((b) => b.h),
          low: bars.map((b) => b.l),
          close: bars.map((b) => b.c),
        }),
        bars.length,
      );

export interface MacdPoint {
  macd: number;
  signal: number;
  hist: number;
}

export const macd = (values: number[], fast = 12, slow = 26, signal = 9): MacdPoint[] => {
  const nan = { macd: NaN, signal: NaN, hist: NaN };
  if (values.length < slow + signal) return values.map(() => nan);
  const out = MACD.calculate({
    values,
    fastPeriod: fast,
    slowPeriod: slow,
    signalPeriod: signal,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  }).map((p) => ({
    macd: p.MACD ?? NaN,
    signal: p.signal ?? NaN,
    hist: p.histogram ?? NaN,
  }));
  return Array(values.length - out.length).fill(nan).concat(out);
};

const ET_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});
const etHourCache = new Map<number, { date: string; hour: number }>();

/** Fast New-York calendar date + minute-of-day for an epoch-ms timestamp (cached per hour). */
export function etInfo(t: number): { date: string; minute: number } {
  const hourKey = Math.floor(t / 3600e3);
  let h = etHourCache.get(hourKey);
  if (!h) {
    const p = Object.fromEntries(ET_FMT.formatToParts(new Date(hourKey * 3600e3)).map((x) => [x.type, x.value]));
    h = { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
    if (etHourCache.size > 50000) etHourCache.clear();
    etHourCache.set(hourKey, h);
  }
  return { date: h.date, minute: h.hour * 60 + Math.floor((t % 3600e3) / 60e3) };
}

/** Session-anchored VWAP. A new session starts whenever the ET calendar day changes. */
export const vwap = (bars: Bar[]): number[] => {
  let pv = 0;
  let vol = 0;
  let day = "";
  return bars.map((b) => {
    const d = etInfo(b.t).date;
    if (d !== day) {
      day = d;
      pv = 0;
      vol = 0;
    }
    const typical = (b.h + b.l + b.c) / 3;
    pv += typical * b.v;
    vol += b.v;
    return vol > 0 ? pv / vol : typical;
  });
};

export const last = <T>(arr: T[]): T => arr[arr.length - 1];

export const lowest = (arr: number[], from: number, to: number): number => {
  let m = Infinity;
  for (let i = Math.max(0, from); i <= to; i++) if (arr[i] < m) m = arr[i];
  return m;
};

export const highest = (arr: number[], from: number, to: number): number => {
  let m = -Infinity;
  for (let i = Math.max(0, from); i <= to; i++) if (arr[i] > m) m = arr[i];
  return m;
};

export const mean = (arr: number[]): number =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;

export const round = (n: number, d = 2): number =>
  Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : NaN;
