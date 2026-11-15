"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RotateCcw, ArrowDownUp } from "lucide-react";
import { safeStorage, useApp } from "../providers";
import { Card, ErrorBox, LatencyBadge, Notice, Pill, Skeleton } from "../ui";
import { useSnapshot } from "@/lib/use-snapshot";
import { useFetch } from "@/lib/use-fetch";
import { fmtCompact, fmtPct, fmtPrice, toneClass } from "@/lib/format";
import { SECTORS, UNIVERSE } from "@/lib/universe";
import type { QuoteLite, ScreenerRow } from "@/lib/types";
import type { DictKey } from "@/lib/i18n";

type TrendKey = "stage2" | "pullback" | "momentum" | "golden";

interface Filters {
  cap: "all" | "mega" | "large" | "mid" | "small" | "megaLarge";
  sector: string;
  price: "any" | "lt20" | "lt50" | "50to200" | "gt200";
  liq: "any" | "500k" | "1m" | "5m";
  rvol: "any" | "1.2" | "1.5" | "2.0";
  trends: TrendKey[];
  rsi: "any" | "oversold" | "pullback" | "momentum" | "overbought";
  hideEarnings: boolean;
  lowVol: boolean;
}

const DEFAULT: Filters = {
  cap: "all",
  sector: "all",
  price: "any",
  liq: "any",
  rvol: "any",
  trends: [],
  rsi: "any",
  hideEarnings: false,
  lowVol: false,
};

const PRESETS: { key: DictKey; f: Filters }[] = [
  { key: "presetSwing", f: { ...DEFAULT, liq: "1m", trends: ["stage2", "pullback"], rsi: "pullback", hideEarnings: true } },
  { key: "presetDay", f: { ...DEFAULT, liq: "1m", rvol: "2.0", trends: ["momentum"] } },
  { key: "presetCompounders", f: { ...DEFAULT, cap: "megaLarge", trends: ["stage2"], lowVol: true, hideEarnings: true } },
];

type Live = ScreenerRow & { livePrice: number; liveChange: number; liveRvol: number };
type SortKey = keyof Pick<Live, "symbol" | "livePrice" | "liveChange" | "marketCap" | "avgVol50" | "liveRvol" | "rsi14" | "atrPct" | "ret3m" | "volatility63">;

const DAY = 86400e3;

function passes(r: Live, f: Filters): boolean {
  const cap = r.marketCap ?? NaN;
  const capOk = {
    all: true,
    mega: cap > 200e9,
    large: cap >= 10e9 && cap <= 200e9,
    mid: cap >= 2e9 && cap < 10e9,
    small: cap >= 300e6 && cap < 2e9,
    megaLarge: cap >= 10e9,
  }[f.cap];
  if (!capOk) return false;
  if (f.sector !== "all" && r.sector !== f.sector) return false;
  const p = r.livePrice;
  if (f.price === "lt20" && !(p < 20)) return false;
  if (f.price === "lt50" && !(p < 50)) return false;
  if (f.price === "50to200" && !(p >= 50 && p <= 200)) return false;
  if (f.price === "gt200" && !(p > 200)) return false;
  const liqMin = { any: 0, "500k": 5e5, "1m": 1e6, "5m": 5e6 }[f.liq];
  if (r.avgVol50 < liqMin) return false;
  if (f.rvol !== "any" && !(r.liveRvol > Number(f.rvol))) return false;
  for (const tr of f.trends) {
    if (tr === "stage2" && !r.stage2) return false;
    if (tr === "pullback" && !r.nearEma21) return false;
    if (tr === "momentum" && !(p > r.ema9)) return false;
    if (tr === "golden" && !r.goldenCross) return false;
  }
  const rs = r.rsi14;
  if (f.rsi === "oversold" && !(rs < 35)) return false;
  if (f.rsi === "pullback" && !(rs >= 40 && rs <= 55)) return false;
  if (f.rsi === "momentum" && !(rs > 55 && rs <= 70)) return false;
  if (f.rsi === "overbought" && !(rs > 75)) return false;
  if (f.hideEarnings && r.earningsDate) {
    const d = (new Date(r.earningsDate).getTime() - Date.now()) / DAY;
    if (d >= -1 && d < 14) return false;
  }
  if (f.lowVol && !(r.volatility63 < 0.25 && (r.beta ?? 1) < 1.1)) return false;
  return true;
}

function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Screener() {
  const { t, openChart } = useApp();
  const { data, error, loading, reload } = useSnapshot();
  const [f, setF] = useState<Filters>(DEFAULT);
  const [live, setLive] = useState(true);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "marketCap", dir: -1 });

  useEffect(() => {
    const raw = safeStorage.get("uss.screener");
    if (raw) {
      try {
        setF({ ...DEFAULT, ...(JSON.parse(raw) as Partial<Filters>) });
      } catch {
        /* ignore corrupted value */
      }
    }
  }, []);
  useEffect(() => safeStorage.set("uss.screener", JSON.stringify(f)), [f]);

  const symbols = useMemo(() => UNIVERSE.map((u) => u.symbol).join(","), []);
  const quotes = useFetch<{ quotes: QuoteLite[]; fetchedAt: string }>(live ? `/api/market/quotes?symbols=${symbols}` : null, 60_000);
  const qMap = useMemo(() => new Map(quotes.data?.quotes.map((q) => [q.symbol, q])), [quotes.data]);

  const rows: Live[] = useMemo(
    () =>
      (data?.rows ?? []).map((r) => {
        const q = live ? qMap.get(r.symbol) : undefined;
        const livePrice = q?.price ?? r.price;
        const liveChange = q?.changePct != null ? q.changePct / 100 : r.changePct;
        const liveRvol = q?.volume != null && q.avgVolume3m ? q.volume / q.avgVolume3m : r.rvol;
        return { ...r, livePrice, liveChange, liveRvol };
      }),
    [data, qMap, live],
  );

  const filtered = useMemo(() => {
    const list = rows.filter((r) => passes(r, f));
    return list.sort((a, b) => {
      const av = a[sort.k];
      const bv = b[sort.k];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sort.dir;
      return (((av as number) ?? -Infinity) - ((bv as number) ?? -Infinity)) * sort.dir;
    });
  }, [rows, f, sort]);

  const exportCsv = () => {
    const head = ["symbol", "name", "sector", "price", "change_pct", "market_cap", "avg_vol_50", "rvol", "rsi14", "atr_pct", "sma50", "sma200", "ema21", "stage2", "near_ema21", "golden_cross", "ret_3m", "earnings_date"];
    const lines = filtered.map((r) =>
      [r.symbol, `"${r.name}"`, r.sector, r.livePrice, (r.liveChange * 100).toFixed(2), r.marketCap ?? "", r.avgVol50, r.liveRvol.toFixed(2), r.rsi14, (r.atrPct * 100).toFixed(2), r.sma50, r.sma200, r.ema21, r.stage2, r.nearEma21, r.goldenCross, (r.ret3m * 100).toFixed(2), r.earningsDate ?? ""].join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `screener_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const th = (k: SortKey, label: string, right = true) => (
    <th className={right ? "text-right" : ""}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : -1 }))} className={`inline-flex items-center gap-1 ${sort.k === k ? "text-fg" : ""}`}>
        {label} <ArrowDownUp size={10} aria-hidden />
      </button>
    </th>
  );

  const toggleTrend = (k: TrendKey) =>
    setF((p) => ({ ...p, trends: p.trends.includes(k) ? p.trends.filter((x) => x !== k) : [...p.trends, k] }));

  return (
    <div className="space-y-4">
      <Card
        title={t("screenerTitle")}
        sub={t("screenerSub")}
        right={
          <>
            <LatencyBadge kind="eod" time={data?.generatedAt} />
            {live && <LatencyBadge kind="delayed" time={quotes.data?.fetchedAt} />}
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label mb-0">{t("presets")}:</span>
            {PRESETS.map((p) => (
              <button key={p.key} className="btn" onClick={() => setF(p.f)} title={p.key === "presetCompounders" ? t("presetCompoundersDesc") : undefined}>
                {t(p.key)}
              </button>
            ))}
            <button className="btn" onClick={() => setF(DEFAULT)}>
              <RotateCcw size={12} aria-hidden /> {t("reset")}
            </button>
            <button className="btn ml-auto" onClick={exportCsv} disabled={!filtered.length}>
              <Download size={12} aria-hidden /> {t("exportCsv")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Select
              label={t("marketCap")}
              value={f.cap}
              onChange={(v) => setF({ ...f, cap: v })}
              options={[
                { v: "all", l: t("all") },
                { v: "mega", l: t("mega") },
                { v: "large", l: t("large") },
                { v: "megaLarge", l: `${t("mega")} + ${t("large")}` },
                { v: "mid", l: t("mid") },
                { v: "small", l: t("small") },
              ]}
            />
            <Select
              label={t("sector")}
              value={f.sector}
              onChange={(v) => setF({ ...f, sector: v })}
              options={[{ v: "all", l: t("all") }, ...SECTORS.map((s) => ({ v: s, l: s })), { v: "ETF", l: "ETF" }]}
            />
            <Select
              label={t("priceFilter")}
              value={f.price}
              onChange={(v) => setF({ ...f, price: v })}
              options={[
                { v: "any", l: t("anyFractional") },
                { v: "lt20", l: "< $20" },
                { v: "lt50", l: "< $50" },
                { v: "50to200", l: "$50 – $200" },
                { v: "gt200", l: "> $200" },
              ]}
            />
            <Select
              label={t("liquidity")}
              value={f.liq}
              onChange={(v) => setF({ ...f, liq: v })}
              options={[
                { v: "any", l: t("any") },
                { v: "500k", l: "> 500K" },
                { v: "1m", l: "> 1M" },
                { v: "5m", l: "> 5M" },
              ]}
            />
            <Select
              label={t("rvol")}
              value={f.rvol}
              onChange={(v) => setF({ ...f, rvol: v })}
              options={[
                { v: "any", l: t("any") },
                { v: "1.2", l: "> 1.2×" },
                { v: "1.5", l: "> 1.5×" },
                { v: "2.0", l: "> 2.0×" },
              ]}
            />
            <Select
              label={t("rsiFilter")}
              value={f.rsi}
              onChange={(v) => setF({ ...f, rsi: v })}
              options={[
                { v: "any", l: t("any") },
                { v: "oversold", l: t("rsiOversold") },
                { v: "pullback", l: t("rsiPullback") },
                { v: "momentum", l: t("rsiMomentum") },
                { v: "overbought", l: t("rsiOverbought") },
              ]}
            />
            <label className="flex items-end gap-2 pb-1.5 text-xs">
              <input type="checkbox" checked={f.hideEarnings} onChange={(e) => setF({ ...f, hideEarnings: e.target.checked })} className="accent-blue-500" />
              <span>{t("hideEarnings")}</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label mb-0">{t("trend")}:</span>
            {(
              [
                ["stage2", "trendStage2"],
                ["pullback", "trendPullback"],
                ["momentum", "trendMomentum"],
                ["golden", "trendGolden"],
              ] as [TrendKey, DictKey][]
            ).map(([k, key]) => (
              <button key={k} onClick={() => toggleTrend(k)} aria-pressed={f.trends.includes(k)} className={`btn ${f.trends.includes(k) ? "border-accent bg-accent/15" : ""}`}>
                {t(key)}
              </button>
            ))}
            {f.lowVol && <Pill tone="info">{t("presetCompoundersDesc")}</Pill>}
            <label className="ml-auto flex items-center gap-2 text-xs">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-blue-500" />
              {t("liveOverlay")}
            </label>
          </div>
          {live && <p className="text-[11px] text-muted">{t("rvolNoteLive")}</p>}
          {error && <ErrorBox message={error} onRetry={reload} />}
          {quotes.error && <Notice tone="warn">{t("error")}: {quotes.error}</Notice>}
        </div>
      </Card>
      <Card title={t("results", { n: filtered.length })}>
        {!data && loading ? (
          <Skeleton h={400} />
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  {th("symbol", t("symbol"), false)}
                  <th>{t("sector")}</th>
                  {th("livePrice", t("price"))}
                  {th("liveChange", t("change"))}
                  {th("marketCap", t("marketCap"))}
                  {th("avgVol50", t("liquidity"))}
                  {th("liveRvol", "RVOL")}
                  {th("rsi14", "RSI")}
                  {th("atrPct", "ATR%")}
                  {th("ret3m", "3M")}
                  {th("volatility63", "Vol 63d")}
                  <th>{t("trend")}</th>
                  <th>{t("earnings")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.symbol}>
                    <td>
                      <button className="num font-semibold text-accent hover:underline" onClick={() => openChart(r.symbol)}>
                        {r.symbol}
                      </button>
                      <div className="max-w-[150px] truncate text-[10px] text-muted">{r.name}</div>
                    </td>
                    <td className="text-muted">{r.sector}</td>
                    <td className="num text-right">{fmtPrice(r.livePrice)}</td>
                    <td className={`num text-right ${toneClass(r.liveChange)}`}>{fmtPct(r.liveChange)}</td>
                    <td className="num text-right">{fmtCompact(r.marketCap)}</td>
                    <td className="num text-right">{fmtCompact(r.avgVol50)}</td>
                    <td className={`num text-right ${r.liveRvol >= 1.5 ? "text-amber-300" : ""}`}>{r.liveRvol.toFixed(2)}×</td>
                    <td className="num text-right">{r.rsi14.toFixed(1)}</td>
                    <td className="num text-right">{(r.atrPct * 100).toFixed(2)}%</td>
                    <td className={`num text-right ${toneClass(r.ret3m)}`}>{fmtPct(r.ret3m, 1)}</td>
                    <td className="num text-right">{(r.volatility63 * 100).toFixed(0)}%</td>
                    <td>
                      <span className="flex gap-1">
                        {r.stage2 && <Pill tone="up">S2</Pill>}
                        {r.nearEma21 && <Pill tone="info">EMA21</Pill>}
                        {r.livePrice > r.ema9 && <Pill tone="neutral">EMA9↑</Pill>}
                        {r.goldenCross && <Pill tone="warn">GC</Pill>}
                      </span>
                    </td>
                    <td className="num text-muted">{r.earningsDate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
