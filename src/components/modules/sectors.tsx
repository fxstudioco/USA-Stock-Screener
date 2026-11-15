"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { useApp } from "../providers";
import { Card, ErrorBox, LatencyBadge, Notice, Skeleton } from "../ui";
import { useSnapshot } from "@/lib/use-snapshot";
import { fmtPct, fmtPrice, toneClass } from "@/lib/format";
import type { SectorPerf } from "@/lib/types";

type Tf = "r1d" | "r1w" | "r1m" | "r3m";
const TFS: { id: Tf; label: string }[] = [
  { id: "r1d", label: "1D" },
  { id: "r1w", label: "1W" },
  { id: "r1m", label: "1M" },
  { id: "r3m", label: "3M" },
];
const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#ec4899", "#eab308", "#84cc16", "#06b6d4", "#f97316"];
const CYCLICAL = ["XLK", "XLY", "XLC", "XLF", "XLI"];
const DEFENSIVE = ["XLU", "XLP", "XLV", "XLRE"];

function RotationChart({ sectors, active, onToggle }: { sectors: SectorPerf[]; active: Set<string>; onToggle: (s: string) => void }) {
  const W = 900;
  const H = 300;
  const P = { l: 40, r: 50, t: 10, b: 24 };
  const shown = sectors.filter((s) => active.has(s.symbol));
  const all = shown.flatMap((s) => s.series.map((p) => p.v));
  const min = Math.min(...all, 100);
  const max = Math.max(...all, 100);
  const n = Math.max(...sectors.map((s) => s.series.length));
  const x = (i: number) => P.l + (i / Math.max(1, n - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - min) / (max - min || 1)) * (H - P.t - P.b);
  const ticks = [min, (min + max) / 2, max];
  const first = sectors[0]?.series[0]?.t;
  const lastT = sectors[0]?.series[sectors[0].series.length - 1]?.t;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {sectors.map((s) => {
          const c = COLORS[sectors.indexOf(s) % COLORS.length];
          const on = active.has(s.symbol);
          return (
            <button
              key={s.symbol}
              onClick={() => onToggle(s.symbol)}
              aria-pressed={on}
              className={`num flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${on ? "border-line text-fg" : "border-transparent text-muted line-through"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c }} aria-hidden />
              {s.symbol}
            </button>
          );
        })}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Sector comparison chart">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#232832" />
            <text x={4} y={y(v) + 3} fill="#8b93a3" fontSize="10" fontFamily="JetBrains Mono">{v.toFixed(1)}</text>
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={y(100)} y2={y(100)} stroke="#8b93a3" strokeDasharray="3 3" />
        {shown.map((s) => {
          const c = COLORS[sectors.indexOf(s) % COLORS.length];
          const pts = s.series.map((p, i) => `${x(i)},${y(p.v)}`).join(" ");
          const lastP = s.series[s.series.length - 1];
          return (
            <g key={s.symbol}>
              <polyline fill="none" stroke={c} strokeWidth="1.6" points={pts} />
              <text x={x(s.series.length - 1) + 4} y={y(lastP.v) + 3} fill={c} fontSize="10" fontFamily="JetBrains Mono">{s.symbol}</text>
            </g>
          );
        })}
        {first && <text x={P.l} y={H - 6} fill="#8b93a3" fontSize="10">{new Date(first).toISOString().slice(0, 10)}</text>}
        {lastT && <text x={W - P.r} y={H - 6} fill="#8b93a3" fontSize="10" textAnchor="end">{new Date(lastT).toISOString().slice(0, 10)}</text>}
      </svg>
    </div>
  );
}

export function SectorRotation() {
  const { t, openChart } = useApp();
  const { data, error, loading, reload } = useSnapshot();
  const [sortKey, setSortKey] = useState<Tf>("r1m");
  const [barTf, setBarTf] = useState<Tf>("r1m");
  const [active, setActive] = useState<Set<string>>(new Set(["XLK", "XLE", "XLU", "XLF", "XLV"]));
  const sectors = data?.sectors ?? [];
  const sorted = useMemo(() => [...sectors].sort((a, b) => b[sortKey] - a[sortKey]), [sectors, sortKey]);
  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s[barTf])), 0.0001);

  const read = useMemo(() => {
    const avg = (list: string[]) => {
      const v = sectors.filter((s) => list.includes(s.symbol)).map((s) => s.r1m);
      return v.reduce((a, b) => a + b, 0) / (v.length || 1);
    };
    const d = avg(CYCLICAL) - avg(DEFENSIVE);
    return { d, text: d > 0.01 ? t("riskOnRead") : d < -0.01 ? t("riskOffRead") : t("mixedRead") };
  }, [sectors, t]);

  return (
    <div className="space-y-4">
      <Card title={t("sectorsTitle")} sub={t("sectorsSub")} right={<LatencyBadge kind="eod" time={data?.generatedAt} />}>
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!data && loading && <Skeleton h={300} />}
        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t("sector")}</th>
                    <th>ETF</th>
                    <th className="text-right">{t("price")}</th>
                    {TFS.map((f) => (
                      <th key={f.id} className="text-right">
                        <button onClick={() => setSortKey(f.id)} className={`inline-flex items-center gap-1 ${sortKey === f.id ? "text-fg" : ""}`}>
                          {f.label} <ArrowDownUp size={10} aria-hidden />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.symbol}>
                      <td className="text-fg">{s.sector}</td>
                      <td>
                        <button className="num font-semibold text-accent hover:underline" onClick={() => openChart(s.symbol, "swing")}>{s.symbol}</button>
                      </td>
                      <td className="num text-right">{fmtPrice(s.price)}</td>
                      {TFS.map((f) => (
                        <td key={f.id} className={`num text-right ${toneClass(s[f.id])}`}>{fmtPct(s[f.id])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3">
                <Notice tone={read.d > 0.01 ? "ok" : read.d < -0.01 ? "warn" : "info"}>
                  <span className="font-semibold">{t("riskOnOff")}: </span>
                  {read.text} <span className="num">(Δ {fmtPct(read.d)})</span>
                </Notice>
              </div>
            </div>
            <div>
              <div className="mb-2 flex gap-1">
                {TFS.map((f) => (
                  <button key={f.id} onClick={() => setBarTf(f.id)} className={`btn ${barTf === f.id ? "border-accent" : ""}`}>{f.label}</button>
                ))}
              </div>
              <div className="space-y-1.5">
                {[...sectors].sort((a, b) => b[barTf] - a[barTf]).map((s) => {
                  const v = s[barTf];
                  const w = (Math.abs(v) / maxAbs) * 50;
                  return (
                    <div key={s.symbol} className="flex items-center gap-2 text-[11px]">
                      <span className="num w-10 shrink-0 font-semibold">{s.symbol}</span>
                      <div className="relative h-4 flex-1 rounded bg-bg">
                        <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
                        <div
                          className={`absolute top-0 h-full rounded ${v >= 0 ? "bg-up/70" : "bg-down/70"}`}
                          style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
                        />
                      </div>
                      <span className={`num w-16 shrink-0 text-right ${toneClass(v)}`}>{fmtPct(v)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>
      {data && (
        <Card title={t("rotationChart")}>
          <RotationChart
            sectors={sectors}
            active={active}
            onToggle={(s) =>
              setActive((prev) => {
                const n = new Set(prev);
                if (n.has(s)) n.delete(s);
                else n.add(s);
                return n;
              })
            }
          />
        </Card>
      )}
    </div>
  );
}
