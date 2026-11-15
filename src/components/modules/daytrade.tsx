"use client";

import { CandlestickChart, Calculator, RefreshCw } from "lucide-react";
import { useApp } from "../providers";
import { Card, ErrorBox, LatencyBadge, Notice, Pill, Skeleton } from "../ui";
import { useFetch } from "@/lib/use-fetch";
import { fmtCompact, fmtPct, fmtPrice, toneClass } from "@/lib/format";
import type { DayTradePick, DayTradeResponse } from "@/lib/types";
import type { DictKey } from "@/lib/i18n";

function Row({ p, failed }: { p: DayTradePick; failed?: string[] }) {
  const { t, openChart, openCalculator } = useApp();
  return (
    <tr>
      <td>
        <button className="num font-semibold text-accent hover:underline" onClick={() => openChart(p.symbol, "day")}>
          {p.symbol}
        </button>
        <div className="max-w-[160px] truncate text-[10px] text-muted">{p.name}</div>
      </td>
      <td className="num text-right">{fmtPrice(p.price)}</td>
      <td className={`num text-right ${toneClass(p.changePct)}`}>{fmtPct(p.changePct, 2, false)}</td>
      <td className="num text-right font-semibold">{p.rvolTime.toFixed(2)}×</td>
      <td className="num text-right text-muted">{p.rvolDaily.toFixed(2)}×</td>
      <td className="num text-right">
        {fmtPrice(p.dayHigh)} / {fmtPrice(p.dayLow)}
      </td>
      <td className="text-right">
        <span className="inline-flex gap-1">
          <Pill tone={p.aboveVwap ? "up" : "down"}>VWAP {fmtPrice(p.vwap)}</Pill>
          <Pill tone={p.aboveEma9 ? "up" : "down"}>EMA9 {fmtPrice(p.ema9)}</Pill>
        </span>
      </td>
      <td className="num text-right">{p.atrPct.toFixed(2)}%</td>
      <td className="num text-right text-muted">{fmtCompact(p.avgVolume)}</td>
      <td className="num text-right text-down">{fmtPrice(p.support1)}</td>
      <td className="num text-right text-amber-300">{fmtPrice(p.breakout)}</td>
      <td className="num text-right text-up">{fmtPrice(p.target)}</td>
      <td>
        {failed ? (
          <span className="flex flex-wrap gap-1">
            {failed.map((f) => (
              <Pill key={f} tone="warn">
                {t(`fr_${f}` as DictKey)}
              </Pill>
            ))}
          </span>
        ) : (
          <span className="flex gap-1">
            <button className="btn" onClick={() => openChart(p.symbol, "day")} aria-label={t("openInChart")}>
              <CandlestickChart size={12} aria-hidden />
            </button>
            <button
              className="btn"
              aria-label={t("openInCalc")}
              onClick={() =>
                openCalculator({
                  symbol: p.symbol,
                  entry: p.breakout,
                  stop: p.support1,
                  tp1: p.target,
                  tp2: p.target + (p.target - p.breakout),
                })
              }
            >
              <Calculator size={12} aria-hidden />
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}

function Head({ last }: { last: string }) {
  const { t } = useApp();
  return (
    <thead>
      <tr>
        <th>{t("symbol")}</th>
        <th className="text-right">{t("last")}</th>
        <th className="text-right">{t("change")}</th>
        <th className="text-right">{t("rvolTime")}</th>
        <th className="text-right">{t("rvolDaily")}</th>
        <th className="text-right">{t("hiLo")}</th>
        <th className="text-right">{t("vwapEma")}</th>
        <th className="text-right">ATR%</th>
        <th className="text-right">{t("liquidity")}</th>
        <th className="text-right">{t("support1")}</th>
        <th className="text-right">{t("breakoutTrig")}</th>
        <th className="text-right">{t("intradayTarget")}</th>
        <th>{last}</th>
      </tr>
    </thead>
  );
}

export function DayTradeScanner() {
  const { t } = useApp();
  const { data, error, loading, reload } = useFetch<DayTradeResponse>("/api/market/daytrade", 2 * 60 * 1000);
  const closed = data && data.marketState !== "REGULAR";
  return (
    <div className="space-y-4">
      <Card
        title={t("dayTitle")}
        sub={t("daySub")}
        right={
          <>
            <LatencyBadge kind="delayed" time={data?.generatedAt} />
            <button className="btn" onClick={reload} disabled={loading} aria-label={t("retry")}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} aria-hidden />
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[11px] text-muted">
            {t("dayRefresh")}
            {data && (
              <>
                {" "}
                · {t("scanned", { n: data.scanned })} · marketState: <span className="num">{data.marketState}</span>
              </>
            )}
          </p>
          {closed && <Notice tone="warn">{t("dayClosedNote")}</Notice>}
          {error && <ErrorBox message={error} onRetry={reload} />}
          {!data && loading && <Skeleton h={260} />}
          {data &&
            (data.picks.length === 0 ? (
              <Notice tone="warn">{t("noDayPicks")}</Notice>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <Head last="" />
                  <tbody>
                    {data.picks.map((p) => (
                      <Row key={p.symbol} p={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          <p className="text-[11px] text-muted">{t("pivotNote")}</p>
        </div>
      </Card>
      {data && data.nearMisses.length > 0 && (
        <Card title={t("nearMisses")}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <Head last={t("failed")} />
              <tbody>
                {data.nearMisses.map((p) => (
                  <Row key={p.symbol} p={p} failed={p.failed} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
