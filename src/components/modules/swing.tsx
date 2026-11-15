"use client";

import { AlertTriangle, CandlestickChart, Calculator } from "lucide-react";
import { useApp } from "../providers";
import { Card, ErrorBox, LatencyBadge, Notice, Pill, Skeleton } from "../ui";
import { RegimeBanner } from "./macro";
import { useBacktest, useSnapshot } from "@/lib/use-snapshot";
import { fmtCompact, fmtPct, fmtPctPlain, fmtPrice, toneClass } from "@/lib/format";
import type { SwingPick } from "@/lib/types";

function ScoreBar({ label, v, max }: { label: string; v: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-24 shrink-0 text-muted">{label}</span>
      <div className="h-1.5 flex-1 rounded bg-bg">
        <div className="h-full rounded bg-accent" style={{ width: `${(v / max) * 100}%` }} />
      </div>
      <span className="num w-10 text-right">{v.toFixed(1)}/{max}</span>
    </div>
  );
}

function Rationale({ p }: { p: SwingPick }) {
  const { t } = useApp();
  const f = p.fundamentals;
  const pct = (v: number | null | undefined) => (v == null ? "N/A" : fmtPctPlain(v));
  return (
    <div className="space-y-2 text-[11px] leading-relaxed text-muted">
      <p>
        <span className="font-semibold text-fg">{t("technical")}: </span>
        {t("ratTech", {
          price: fmtPrice(p.price),
          sma50: fmtPrice(p.sma50),
          sma200: fmtPrice(p.sma200),
          dist: p.distEma21Atr.toFixed(2),
          ema21: fmtPrice(p.ema21),
          rsi: p.rsi14.toFixed(1),
          vol: p.volRatio5v50.toFixed(2),
          volNote: p.volRatio5v50 < 1 ? t("volContract") : t("volExpand"),
        })}
      </p>
      <p>
        <span className="font-semibold text-fg">{t("fundamental")}: </span>
        {t("ratFund", {
          rev: pct(f?.revenueGrowth),
          eps: pct(f?.earningsGrowth),
          margin: pct(f?.profitMargin),
          inst: pct(f?.institutionPct),
          avgVol: fmtCompact(p.avgVol50),
        })}
      </p>
      <p>
        <span className="font-semibold text-fg">{t("sentiment")}: </span>
        {t("ratSent", {
          sector: p.sector,
          rank: p.sectorRank,
          secRet: fmtPct(p.sectorRet1m),
          earn: p.earningsDate ? `${p.earningsDate} (${t("daysAway", { n: p.daysToEarnings ?? "?" })})` : t("earningsUnknown"),
        })}
      </p>
    </div>
  );
}

function PickCard({ p, rank }: { p: SwingPick; rank: number }) {
  const { t, openChart, openCalculator, sendToCalculator } = useApp();
  const lv = p.levels;
  const earnSoon = p.daysToEarnings != null && p.daysToEarnings < 14;
  const toCalc = { symbol: p.symbol, entry: lv.entryRef, stop: lv.stop, tp1: lv.tp1, tp2: lv.tp2 };
  return (
    <article className="flex flex-col rounded-lg border border-line bg-card">
      <button
        className="block w-full border-b border-line p-3 text-left hover:bg-accent/5"
        onClick={() => {
          sendToCalculator(toCalc);
          openChart(p.symbol, "swing");
        }}
        title={`${t("openInChart")} + ${t("openInCalc")}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="num text-[10px] text-muted">#{rank}</span>
              <span className="num text-lg font-bold">{p.symbol}</span>
            </div>
            <div className="truncate text-xs text-muted">{p.name} · {p.sector}</div>
          </div>
          <div className="text-right">
            <div className="num text-lg font-semibold">${fmtPrice(p.price)}</div>
            <Pill tone="info">{t("score")} {p.score.total.toFixed(0)}</Pill>
          </div>
        </div>
      </button>
      <div className="space-y-3 p-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted">{t("buyRange")}</dt>
          <dd className="num text-right">{fmtPrice(lv.buyLow)} – {fmtPrice(lv.buyHigh)}</dd>
          <dt className="text-muted">{t("stopLoss")}</dt>
          <dd className="num text-right text-down">{fmtPrice(lv.stop)} <span className="text-muted">({fmtPct(-p.riskPct)})</span></dd>
          <dt className="text-muted">{t("tp1")}</dt>
          <dd className="num text-right text-up">{fmtPrice(lv.tp1)} <span className="text-muted">({fmtPct(p.upsideTp1Pct)})</span></dd>
          <dt className="text-muted">{t("tp2")}</dt>
          <dd className="num text-right text-up">{fmtPrice(lv.tp2)} <span className="text-muted">({fmtPct(p.upsideTp2Pct)})</span></dd>
          <dt className="text-muted">{t("rr")}</dt>
          <dd className="num text-right">1 : {p.rrTp1} / 1 : {p.rrTp2}</dd>
          <dt className="text-muted">{t("earnings")}</dt>
          <dd className={`num text-right ${earnSoon ? "text-amber-300" : ""}`}>
            {p.earningsDate ? `${p.earningsDate} · ${t("daysAway", { n: p.daysToEarnings ?? "?" })}` : t("earningsUnknown")}
          </dd>
        </dl>
        {earnSoon && (
          <Notice tone="warn"><AlertTriangle size={12} className="mr-1 inline" aria-hidden />{t("earningsWarn")}</Notice>
        )}
        {p.roomR < p.rrTp1 && <Notice tone="warn">{t("resistanceWarn", { r: p.roomR.toFixed(2) })}</Notice>}
        <div className="space-y-1">
          <ScoreBar label={t("technical")} v={p.score.technical} max={50} />
          <ScoreBar label={t("fundamental")} v={p.score.fundamental} max={30} />
          <ScoreBar label={t("sentiment")} v={p.score.sentiment} max={20} />
        </div>
        <Rationale p={p} />
        <div className="flex gap-2 pt-1">
          <button className="btn" onClick={() => openChart(p.symbol, "swing")}><CandlestickChart size={12} aria-hidden />{t("openInChart")}</button>
          <button className="btn" onClick={() => openCalculator(toCalc)}><Calculator size={12} aria-hidden />{t("openInCalc")}</button>
        </div>
      </div>
    </article>
  );
}

function BacktestPanel() {
  const { t } = useApp();
  const { data } = useBacktest();
  if (!data) return null;
  const s = data.stats;
  const o = data.outOfSample;
  const row = (label: string, a: string, b: string) => (
    <tr>
      <td className="text-muted">{label}</td>
      <td className="num text-right">{a}</td>
      <td className="num text-right">{b}</td>
    </tr>
  );
  return (
    <Card title={t("backtestTitle")} sub={t("backtestSub", { years: data.years, symbols: data.symbols })} right={<LatencyBadge kind="eod" time={data.generatedAt} />}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div>
          <table className="tbl">
            <thead>
              <tr><th></th><th className="text-right">All</th><th className="text-right">{t("oos")}</th></tr>
            </thead>
            <tbody>
              {row(t("trades"), String(s.trades), String(o.trades))}
              {row(t("winRate"), fmtPctPlain(s.winRate), fmtPctPlain(o.winRate))}
              {row(t("avgR"), s.avgR.toFixed(3), o.avgR.toFixed(3))}
              {row(t("profitFactor"), s.profitFactor.toFixed(2), o.profitFactor.toFixed(2))}
              {row(t("maxDD"), s.maxDrawdownR.toFixed(1), o.maxDrawdownR.toFixed(1))}
            </tbody>
          </table>
          <div className="mt-3 space-y-1.5 text-[11px] text-muted">
            <p>{t("stopRule")}</p>
            <p>{t("exitRule")}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <h3 className="label">{t("variantsTitle")}</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("variant")}</th>
                <th className="text-right">{t("trades")}</th>
                <th className="text-right">{t("winRate")}</th>
                <th className="text-right">{t("avgR")}</th>
                <th className="text-right">PF</th>
                <th className="text-right">{t("oos")} R</th>
                <th className="text-right">{t("oos")} PF</th>
              </tr>
            </thead>
            <tbody>
              {data.variants.map((v, i) => (
                <tr key={v.name} className={i === 0 ? "bg-accent/10" : ""}>
                  <td className="max-w-[340px] truncate" title={v.name}>{v.name}</td>
                  <td className="num text-right">{v.trades}</td>
                  <td className="num text-right">{fmtPctPlain(v.winRate)}</td>
                  <td className={`num text-right ${toneClass(v.avgR)}`}>{v.avgR.toFixed(3)}</td>
                  <td className="num text-right">{v.profitFactor.toFixed(2)}</td>
                  <td className={`num text-right ${toneClass(v.oosAvgR)}`}>{v.oosAvgR.toFixed(3)}</td>
                  <td className="num text-right">{v.oosProfitFactor.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-3 list-disc space-y-0.5 pl-4 text-[10px] text-muted">
            {data.assumptions.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      </div>
    </Card>
  );
}

export function SwingPicks() {
  const { t, openChart } = useApp();
  const { data, error, loading, reload } = useSnapshot();
  const sw = data?.swing;
  return (
    <div className="space-y-4">
      <Card title={t("swingTitle")} sub={t("swingSub")} right={<LatencyBadge kind="eod" time={data?.generatedAt} />}>
        <div className="space-y-3">
          <RegimeBanner />
          {error && <ErrorBox message={error} onRetry={reload} />}
          {!data && loading && <Skeleton h={400} />}
          {sw && (
            <>
              <p className="text-xs text-muted">
                {t("passedCount", { n: sw.candidatesPassed, k: sw.picks.length })}
                {sw.excludedEarnings.length > 0 && <> · {t("excludedEarn", { list: sw.excludedEarnings.join(", ") })}</>}
              </p>
              {sw.picks.length === 0 ? (
                <Notice tone="warn">{t("noSetups")}</Notice>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  {sw.picks.map((p, i) => <PickCard key={p.symbol} p={p} rank={i + 1} />)}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
      {sw && sw.picks.length > 0 && (
        <Card title={t("compareTable")}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("symbol")}</th><th>{t("sector")}</th><th className="text-right">{t("price")}</th>
                  <th className="text-right">{t("buyRange")}</th><th className="text-right">{t("stopLoss")}</th>
                  <th className="text-right">TP1</th><th className="text-right">TP2</th>
                  <th className="text-right">{t("riskPct")}</th><th className="text-right">{t("upside")} TP2</th>
                  <th className="text-right">RSI</th><th className="text-right">{t("technical")}</th>
                  <th className="text-right">{t("fundamental")}</th><th className="text-right">{t("sentiment")}</th>
                  <th className="text-right">{t("score")}</th><th>{t("earnings")}</th>
                </tr>
              </thead>
              <tbody>
                {sw.picks.map((p) => (
                  <tr key={p.symbol}>
                    <td><button className="num font-semibold text-accent hover:underline" onClick={() => openChart(p.symbol, "swing")}>{p.symbol}</button></td>
                    <td className="text-muted">{p.sector}</td>
                    <td className="num text-right">{fmtPrice(p.price)}</td>
                    <td className="num text-right">{fmtPrice(p.levels.buyLow)}–{fmtPrice(p.levels.buyHigh)}</td>
                    <td className="num text-right text-down">{fmtPrice(p.levels.stop)}</td>
                    <td className="num text-right text-up">{fmtPrice(p.levels.tp1)}</td>
                    <td className="num text-right text-up">{fmtPrice(p.levels.tp2)}</td>
                    <td className="num text-right">{fmtPctPlain(p.riskPct)}</td>
                    <td className="num text-right">{fmtPctPlain(p.upsideTp2Pct)}</td>
                    <td className="num text-right">{p.rsi14.toFixed(1)}</td>
                    <td className="num text-right">{p.score.technical.toFixed(1)}</td>
                    <td className="num text-right">{p.score.fundamental.toFixed(1)}</td>
                    <td className="num text-right">{p.score.sentiment.toFixed(1)}</td>
                    <td className="num text-right font-semibold">{p.score.total.toFixed(1)}</td>
                    <td className="num">{p.earningsDate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <BacktestPanel />
    </div>
  );
}
