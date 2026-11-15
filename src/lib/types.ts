// Shared data contracts between the snapshot job, API routes and the UI.
import type { Sector } from "./universe";
import type { SwingLevels } from "./quant/swing";

export interface Fundamentals {
  revenueGrowth: number | null; // YoY, fraction
  earningsGrowth: number | null; // YoY, fraction
  profitMargin: number | null;
  grossMargin: number | null;
  institutionPct: number | null;
}

export interface ScreenerRow {
  symbol: string;
  name: string;
  sector: Sector;
  isEtf: boolean;
  price: number;
  changePct: number;
  marketCap: number | null;
  volume: number;
  avgVol50: number;
  rvol: number; // last session volume / 50d average
  sma50: number;
  sma200: number;
  ema9: number;
  ema21: number;
  rsi14: number;
  atr14: number;
  atrPct: number;
  ret1m: number;
  ret3m: number;
  volatility63: number; // annualized stdev of daily returns
  beta: number | null;
  stage2: boolean;
  nearEma21: boolean;
  aboveEma9: boolean;
  goldenCross: boolean; // SMA50 crossed above SMA200 in the last 30 sessions
  earningsDate: string | null; // ISO date
  fundamentals: Fundamentals | null;
}

export interface ScoreBreakdown {
  technical: number; // 0..50
  fundamental: number; // 0..30
  sentiment: number; // 0..20
  total: number; // 0..100
  parts: Record<string, number>;
}

export interface SwingPick {
  symbol: string;
  name: string;
  sector: Sector;
  price: number;
  levels: SwingLevels;
  riskPct: number;
  upsideTp1Pct: number;
  upsideTp2Pct: number;
  rrTp1: number;
  rrTp2: number;
  score: ScoreBreakdown;
  rsi14: number;
  sma50: number;
  sma200: number;
  ema21: number;
  distEma21Atr: number;
  volRatio5v50: number;
  avgVol50: number;
  earningsDate: string | null;
  daysToEarnings: number | null;
  fundamentals: Fundamentals | null;
  sectorRet1m: number;
  sectorRank: number; // 1 = strongest of 11
  roomR: number;
}

export interface SectorPerf {
  symbol: string;
  sector: Exclude<Sector, "ETF">;
  price: number;
  r1d: number;
  r1w: number;
  r1m: number;
  r3m: number;
  /** last 63 closes rebased to 100 */
  series: { t: number; v: number }[];
}

export interface Snapshot {
  generatedAt: string;
  asOf: string; // last daily bar date (ET)
  source: string;
  regime: {
    spy: number;
    spySma200: number;
    vix: number | null;
    riskOn: boolean;
    note: "risk-on" | "risk-off-trend" | "risk-off-vix";
  };
  sectors: SectorPerf[];
  rows: ScreenerRow[];
  swing: {
    picks: SwingPick[];
    candidatesPassed: number;
    excludedEarnings: string[];
    blockedByRegime: boolean;
  };
  errors: string[];
}

export interface QuoteLite {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  prevClose: number | null;
  volume: number | null;
  avgVolume3m: number | null;
  marketState: string | null;
  time: number | null; // epoch ms of regularMarketTime
  currency: string | null;
  preMarketPrice: number | null;
  preMarketChangePct: number | null;
  postMarketPrice: number | null;
  postMarketChangePct: number | null;
  dayHigh: number | null;
  dayLow: number | null;
}

export interface DayTradePick {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  rvolTime: number; // time-of-day adjusted RVOL
  rvolDaily: number; // naive: today's volume vs 3m avg daily volume
  dayHigh: number;
  dayLow: number;
  vwap: number;
  ema9: number;
  aboveVwap: boolean;
  aboveEma9: boolean;
  atrPct: number;
  avgVolume: number;
  marketCap: number | null;
  support1: number;
  breakout: number;
  target: number;
  score: number;
  source: "universe" | "market";
}

export interface DayTradeResponse {
  generatedAt: string;
  marketState: string;
  scanned: number;
  picks: DayTradePick[];
  nearMisses: (DayTradePick & { failed: string[] })[];
  note?: string;
  error?: string;
}

export interface IpoItem {
  name: string;
  symbol: string | null;
  exchange: string | null;
  date: string;
  priceRange: string | null;
  shares: number | null;
  offerValue: number | null;
  status: string | null;
  lockupEstimate: string | null;
}

export interface NewsItem {
  id: number | string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number; // epoch ms
  related: string[];
  impact: "High" | "Medium" | "Low";
  tags: ("Bullish" | "Bearish" | "Macro Risk")[];
}
