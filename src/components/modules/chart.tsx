"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  IChartApi,
  Time,
  LineStyle,
  UTCTimestamp,
} from "lightweight-charts";
import { CheckCircle2, XCircle, Target } from "lucide-react";
import { ChartMode, useApp } from "../providers";
import { Card, ErrorBox, LatencyBadge, Notice, Skeleton } from "../ui";
import { TradingViewWidget, tvLocale } from "../tv-widget";
import { useFetch } from "@/lib/use-fetch";
import { useSnapshot } from "@/lib/use-snapshot";
import { ema, sma, rsi, macd, vwap, Bar } from "@/lib/quant/indicators";
import { fmtPrice, toTvSymbol } from "@/lib/format";
import type { DictKey } from "@/lib/i18n";

type Tf = "1m" | "5m" | "15m" | "4h" | "1d" | "1wk";

const MODE_CFG: Record<ChartMode, { tfs: Tf[]; def: Tf; indicators: string[] }> = {
  day: { tfs: ["1m", "5m", "15m"], def: "5m", indicators: ["VWAP", "EMA 9", "EMA 21", "RSI 14", "Volume"] },
  swing: { tfs: ["4h", "1d", "1wk"], def: "1d", indicators: ["EMA 21", "SMA 50", "SMA 200", "MACD 12/26/9", "RSI 14", "Volume"] },
};

const TV_INTERVAL: Record<Tf, string> = { "1m": "1", "5m": "5", "15m": "15", "4h": "240", "1d": "D", "1wk": "W" };

const COLORS = {
  ema9: "#f59e0b",
  ema21: "#3b82f6",
  sma50: "#a855f7",
  sma200: "#ef4444",
  vwap: "#14b8a6",
  rsi: "#e6e9ef",
  macd: "#3b82f6",
  signal: "#f59e0b",
};

const offsetCache = new Map<string, number>();
/** seconds to add to a UTC timestamp so the chart axis shows New York wall-clock time */
function etShift(tMs: number): number {
  const key = new Date(tMs).toISOString().slice(0, 13);
  const hit = offsetCache.get(key);
  if (hit != null) return hit;
  const d = new Date(tMs);
  const et = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const off = (et.getTime() - utc.getTime()) / 1000;
  offsetCache.set(key, off);
  return off;
}

function toTime(b: Bar, intraday: boolean): Time {
  if (intraday) return (Math.floor(b.t / 1000) + etShift(b.t)) as UTCTimestamp;
  return new Date(b.t).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) as Time;
}

interface LevelLine {
  price: number;
  label: string;
  color: string;
}

function LwChart({ bars, mode, tf, levels }: { bars: Bar[]; mode: ChartMode; tf: Tf; levels: LevelLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || bars.length < 2) return;
    const intraday = !["1d", "1wk"].includes(tf);
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: "#14171D" },
        textColor: "#8b93a3",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        panes: { separatorColor: "#232832", separatorHoverColor: "#3b82f6" },
      },
      grid: { vertLines: { color: "#1b1f27" }, horzLines: { color: "#1b1f27" } },
      rightPriceScale: { borderColor: "#232832" },
      timeScale: { borderColor: "#232832", timeVisible: intraday, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    const time = bars.map((b) => toTime(b, intraday));
    const close = bars.map((b) => b.c);
    const line = (vals: number[]) =>
      vals.map((v, i) => ({ time: time[i], value: v })).filter((p) => Number.isFinite(p.value));

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candles.setData(bars.map((b, i) => ({ time: time[i], open: b.o, high: b.h, low: b.l, close: b.c })));

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(bars.map((b, i) => ({ time: time[i], value: b.v, color: b.c >= b.o ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)" })));

    const overlay = (vals: number[], color: string, title: string) =>
      chart
        .addSeries(LineSeries, { color, lineWidth: 1, title, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        .setData(line(vals));

    if (mode === "day") {
      overlay(vwap(bars), COLORS.vwap, "VWAP");
      overlay(ema(close, 9), COLORS.ema9, "EMA9");
      overlay(ema(close, 21), COLORS.ema21, "EMA21");
    } else {
      overlay(ema(close, 21), COLORS.ema21, "EMA21");
      overlay(sma(close, 50), COLORS.sma50, "SMA50");
      overlay(sma(close, 200), COLORS.sma200, "SMA200");
      const m = macd(close);
      const pane = 1;
      chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false, title: "MACD" }, pane).setData(
        m.map((p, i) => ({ time: time[i], value: p.hist, color: p.hist >= 0 ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)" })).filter((p) => Number.isFinite(p.value)),
      );
      chart.addSeries(LineSeries, { color: COLORS.macd, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane).setData(line(m.map((p) => p.macd)));
      chart.addSeries(LineSeries, { color: COLORS.signal, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane).setData(line(m.map((p) => p.signal)));
    }
    const rsiPane = mode === "day" ? 1 : 2;
    const rsiSeries = chart.addSeries(LineSeries, { color: COLORS.rsi, lineWidth: 1, title: "RSI14", priceLineVisible: false }, rsiPane);
    rsiSeries.setData(line(rsi(close, 14)));
    const bands = mode === "day" ? [70, 50, 30] : [70, 55, 40];
    for (const b of bands) rsiSeries.createPriceLine({ price: b, color: "#3a4150", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "" });

    for (const lv of levels) {
      candles.createPriceLine({ price: lv.price, color: lv.color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: lv.label });
    }

    const panes = chart.panes();
    panes[0]?.setStretchFactor(3);
    panes.slice(1).forEach((p) => p.setStretchFactor(1));
    const visible = intraday ? Math.min(bars.length, tf === "1m" ? 240 : 160) : Math.min(bars.length, tf === "1wk" ? 160 : 180);
    chart.timeScale().setVisibleLogicalRange({ from: bars.length - visible, to: bars.length + 3 });
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, mode, tf, levels]);

  return <div ref={ref} className="h-[560px] w-full" />;
}

function CheatSheet({ mode, bars }: { mode: ChartMode; bars: Bar[] | null }) {
  const { t } = useApp();
  const keys: Record<ChartMode, { entry: DictKey[]; stop: DictKey[]; exit: DictKey[] }> = {
    day: { entry: ["dayEntry1", "dayEntry2", "dayEntry3"], stop: ["dayStop1", "dayStop2"], exit: ["dayExit1", "dayExit2"] },
    swing: { entry: ["swingEntry1", "swingEntry2", "swingEntry3"], stop: ["swingStop1", "swingStop2"], exit: ["swingExit1", "swingExit2"] },
  };
  // live rule status on the latest bar
  const status = useMemo(() => {
    if (!bars || bars.length < 30) return [];
    const c = bars.map((b) => b.c);
    const i = c.length - 1;
    const r = rsi(c, 14)[i];
    if (mode === "day") {
      const v = vwap(bars)[i];
      const e9 = ema(c, 9)[i];
      return [
        { ok: c[i] > v, label: `Price ${fmtPrice(c[i])} > VWAP ${fmtPrice(v)}` },
        { ok: c[i] > e9, label: `Price > EMA9 ${fmtPrice(e9)}` },
        { ok: r >= 50 && r <= 75, label: `RSI14 ${r.toFixed(1)} in 50–75` },
      ];
    }
    const s50 = sma(c, 50)[i];
    const s200 = sma(c, 200)[i];
    const e21 = ema(c, 21)[i];
    return [
      { ok: c[i] > s50 && s50 > s200, label: `Price > SMA50 ${fmtPrice(s50)} > SMA200 ${fmtPrice(s200)}` },
      { ok: Math.abs(c[i] / e21 - 1) < 0.04, label: `Near EMA21 ${fmtPrice(e21)}` },
      { ok: r >= 35 && r <= 60, label: `RSI14 ${r.toFixed(1)} in 35–60` },
    ];
  }, [bars, mode]);
  const block = (title: string, list: DictKey[], tone: string) => (
    <div>
      <h4 className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${tone}`}>{title}</h4>
      <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
        {list.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <Card title={`${t("cheatTitle")} — ${mode === "day" ? t("dayMode") : t("swingMode")}`}>
      <div className="space-y-4">
        {status.length > 0 && (
          <ul className="space-y-1">
            {status.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                {s.ok ? <CheckCircle2 size={14} className="text-up" aria-hidden /> : <XCircle size={14} className="text-down" aria-hidden />}
                <span className="num">{s.label}</span>
              </li>
            ))}
          </ul>
        )}
        {block(t("entry"), keys[mode].entry, "text-up")}
        {block(t("stopLoss"), keys[mode].stop, "text-down")}
        {block(t("exit"), keys[mode].exit, "text-amber-300")}
      </div>
    </Card>
  );
}

export function ChartModule() {
  const { t, lang, symbol, chartMode, openChart, calcPrefill } = useApp();
  const [mode, setMode] = useState<ChartMode>(chartMode);
  const [tf, setTf] = useState<Tf>(MODE_CFG[chartMode].def);
  const [engine, setEngine] = useState<"lw" | "tv">("lw");
  const [input, setInput] = useState(symbol);
  const { data: snap } = useSnapshot();

  useEffect(() => {
    setMode(chartMode);
    setTf(MODE_CFG[chartMode].def);
  }, [chartMode]);
  useEffect(() => setInput(symbol), [symbol]);

  const switchMode = (m: ChartMode) => {
    setMode(m);
    setTf(MODE_CFG[m].def);
  };

  const { data, error, loading, reload } = useFetch<{ bars: Bar[]; fetchedAt: string }>(
    `/api/market/history?symbol=${encodeURIComponent(symbol)}&tf=${tf}`,
    ["1m", "5m", "15m"].includes(tf) ? 60_000 : 0,
  );

  const levels = useMemo<LevelLine[]>(() => {
    const pick = snap?.swing.picks.find((p) => p.symbol === symbol);
    if (mode === "swing" && pick) {
      return [
        { price: pick.levels.buyHigh, label: "Buy", color: "#3b82f6" },
        { price: pick.levels.buyLow, label: "Buy", color: "#3b82f6" },
        { price: pick.levels.stop, label: "Stop", color: "#ef4444" },
        { price: pick.levels.tp1, label: "TP1", color: "#22c55e" },
        { price: pick.levels.tp2, label: "TP2", color: "#22c55e" },
      ];
    }
    if (calcPrefill && calcPrefill.symbol === symbol) {
      return [
        { price: calcPrefill.entry, label: "Entry", color: "#3b82f6" },
        { price: calcPrefill.stop, label: "Stop", color: "#ef4444" },
        { price: calcPrefill.tp1, label: "TP1", color: "#22c55e" },
        { price: calcPrefill.tp2, label: "TP2", color: "#22c55e" },
      ];
    }
    return [];
  }, [snap, symbol, mode, calcPrefill]);

  const bars = data?.bars ?? null;
  const lastBar = bars?.[bars.length - 1];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card
        title={`${t("chartTitle")} — ${symbol}`}
        sub={`${t("indicatorsOn")}: ${MODE_CFG[mode].indicators.join(" · ")}`}
        right={<LatencyBadge kind={engine === "lw" ? "delayed" : "widget"} time={engine === "lw" ? data?.fetchedAt : undefined} />}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => switchMode("day")} className={mode === "day" ? "btn-primary" : "btn"}>
              {t("dayMode")}
            </button>
            <button onClick={() => switchMode("swing")} className={mode === "swing" ? "btn-primary" : "btn"}>
              {t("swingMode")}
            </button>
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            {MODE_CFG[mode].tfs.map((x) => (
              <button key={x} onClick={() => setTf(x)} className={`btn num ${tf === x ? "border-accent bg-accent/15" : ""}`}>
                {x.toUpperCase()}
              </button>
            ))}
            <form
              className="ml-auto flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) openChart(input.trim().toUpperCase(), mode);
              }}
            >
              <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} className="input num w-28 py-1 text-xs" aria-label={t("symbol")} />
              <button className="btn" type="submit">
                Go
              </button>
            </form>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <button onClick={() => setEngine("lw")} className={`btn ${engine === "lw" ? "border-accent" : ""}`}>
              {t("engineLw")}
            </button>
            <button onClick={() => setEngine("tv")} className={`btn ${engine === "tv" ? "border-accent" : ""}`}>
              {t("engineTv")}
            </button>
            {levels.length > 0 && (
              <span className="inline-flex items-center gap-1 text-muted">
                <Target size={12} aria-hidden /> {t("loadFromPick", { s: symbol })}
              </span>
            )}
          </div>
          {engine === "lw" ? (
            <>
              {error && <ErrorBox message={error} onRetry={reload} />}
              {!bars && loading && <Skeleton h={560} />}
              {bars && bars.length > 1 && <LwChart bars={bars} mode={mode} tf={tf} levels={levels} />}
              {lastBar && (
                <p className="num text-[11px] text-muted">
                  O {fmtPrice(lastBar.o)} H {fmtPrice(lastBar.h)} L {fmtPrice(lastBar.l)} C {fmtPrice(lastBar.c)}
                </p>
              )}
            </>
          ) : (
            <>
              <Notice>{t("tvNote")}</Notice>
              <TradingViewWidget
                script="embed-widget-advanced-chart.js"
                height={600}
                config={{
                  autosize: true,
                  symbol: toTvSymbol(symbol),
                  interval: TV_INTERVAL[tf],
                  timezone: "America/New_York",
                  theme: "dark",
                  style: "1",
                  locale: tvLocale(lang),
                  allow_symbol_change: true,
                  hide_side_toolbar: false,
                  backgroundColor: "#14171D",
                  studies:
                    mode === "day"
                      ? ["STD;VWAP", "STD;EMA", "STD;RSI"]
                      : ["STD;EMA", "STD;SMA", "STD;MACD", "STD;RSI"],
                }}
              />
            </>
          )}
        </div>
      </Card>
      <CheatSheet mode={mode} bars={engine === "lw" ? bars : null} />
    </div>
  );
}
