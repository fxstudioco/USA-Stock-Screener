// Transparent 100-point ranking for swing candidates that ALREADY passed the hard rules.
// Weights (user-approved): Technical 50 / Fundamental 30 / Sentiment & Catalyst 20.
// NOTE: only the hard entry/exit rules are backtested. This ranking is a tie-breaker between
// qualified setups; historical fundamentals are not freely available, so it cannot be backtested.

import type { Fundamentals, ScoreBreakdown } from "../types";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface ScoreInput {
  momentumPercentile: number; // 0..1, 3M return rank within universe
  pctAboveSma50Last50: number; // 0..1
  distEma21Atr: number;
  fundamentals: Fundamentals | null;
  sectorRank: number; // 1..11
  daysToEarnings: number | null;
}

export function scoreSwing(x: ScoreInput): ScoreBreakdown {
  const momentum = 20 * clamp01(x.momentumPercentile);
  const trendQuality = 15 * clamp01((x.pctAboveSma50Last50 - 0.5) / 0.5);
  const entryProximity = 15 * (1 - clamp01(Math.abs(x.distEma21Atr)));
  const f = x.fundamentals;
  const rev = f?.revenueGrowth != null ? 10 * clamp01(f.revenueGrowth / 0.3) : 0;
  const eps = f?.earningsGrowth != null ? 10 * clamp01(f.earningsGrowth / 0.4) : 0;
  const margin = f?.profitMargin != null ? 10 * clamp01(f.profitMargin / 0.3) : 0;
  const sector = 10 * clamp01((11 - x.sectorRank) / 10);
  const earnings =
    x.daysToEarnings == null ? 5 : x.daysToEarnings > 30 ? 10 : x.daysToEarnings >= 14 ? 5 : 0;
  const technical = momentum + trendQuality + entryProximity;
  const fundamental = rev + eps + margin;
  const sentiment = sector + earnings;
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    technical: r(technical),
    fundamental: r(fundamental),
    sentiment: r(sentiment),
    total: r(technical + fundamental + sentiment),
    parts: {
      momentum: r(momentum),
      trendQuality: r(trendQuality),
      entryProximity: r(entryProximity),
      revenueGrowth: r(rev),
      epsGrowth: r(eps),
      profitMargin: r(margin),
      sectorMomentum: r(sector),
      earningsBuffer: r(earnings),
    },
  };
}
