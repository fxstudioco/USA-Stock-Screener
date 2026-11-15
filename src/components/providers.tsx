"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { DictKey, Lang, translate } from "@/lib/i18n";

export type TabId = "macro" | "sectors" | "swing" | "day" | "ipo" | "chart" | "screener" | "news" | "tools";
export type ChartMode = "day" | "swing";
export const TAB_IDS: TabId[] = ["macro", "sectors", "swing", "day", "ipo", "chart", "screener", "news", "tools"];

export interface CalcPrefill {
  symbol: string;
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  nonce: number;
}

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  tab: TabId;
  setTab: (t: TabId) => void;
  symbol: string;
  chartMode: ChartMode;
  openChart: (symbol: string, mode?: ChartMode) => void;
  calcPrefill: CalcPrefill | null;
  openCalculator: (p: Omit<CalcPrefill, "nonce">) => void;
  sendToCalculator: (p: Omit<CalcPrefill, "nonce">) => void;
  setSymbol: (s: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, val: string) {
    try {
      window.localStorage.setItem(key, val);
    } catch {
      /* storage unavailable (private mode) — app still works without persistence */
    }
  },
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [tab, setTabState] = useState<TabId>("macro");
  const [symbol, setSymbol] = useState("SPY");
  const [chartMode, setChartMode] = useState<ChartMode>("swing");
  const [calcPrefill, setCalcPrefill] = useState<CalcPrefill | null>(null);

  useEffect(() => {
    const l = safeStorage.get("uss.lang");
    if (l === "en" || l === "id") setLangState(l);
    const tb = safeStorage.get("uss.tab") as TabId | null;
    if (tb && TAB_IDS.includes(tb)) setTabState(tb);
    const fromHash = () => {
      const hash = window.location.hash.replace("#", "") as TabId;
      if (TAB_IDS.includes(hash)) setTabState(hash);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    safeStorage.set("uss.lang", l);
  }, []);

  const setTab = useCallback((t: TabId) => {
    setTabState(t);
    safeStorage.set("uss.tab", t);
    if (typeof window !== "undefined") history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openChart = useCallback(
    (s: string, mode?: ChartMode) => {
      setSymbol(s.toUpperCase());
      if (mode) setChartMode(mode);
      setTab("chart");
    },
    [setTab],
  );

  const sendToCalculator = useCallback((p: Omit<CalcPrefill, "nonce">) => {
    setCalcPrefill({ ...p, nonce: Date.now() });
  }, []);

  const openCalculator = useCallback(
    (p: Omit<CalcPrefill, "nonce">) => {
      sendToCalculator(p);
      setTab("tools");
    },
    [sendToCalculator, setTab],
  );

  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, tab, setTab, symbol, setSymbol, chartMode, openChart, calcPrefill, openCalculator, sendToCalculator }),
    [lang, setLang, t, tab, setTab, symbol, chartMode, openChart, calcPrefill, openCalculator, sendToCalculator],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
