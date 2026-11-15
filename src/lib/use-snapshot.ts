"use client";

import { useFetch } from "./use-fetch";
import type { Snapshot } from "./types";
import type { BacktestStats } from "./quant/backtest";

export interface BacktestFile {
  generatedAt: string;
  years: number;
  symbols: number;
  assumptions: string[];
  stats: BacktestStats;
  outOfSample: BacktestStats;
  variants: {
    name: string;
    trades: number;
    winRate: number;
    avgR: number;
    profitFactor: number;
    oosAvgR: number;
    oosProfitFactor: number;
    oosTrades: number;
  }[];
}

export const useSnapshot = () => useFetch<Snapshot>("/data/snapshot.json", 15 * 60 * 1000);
export const useBacktest = () => useFetch<BacktestFile>("/data/backtest.json");
