"use client";

import { useState } from "react";
import { useApp } from "../providers";
import { Card, ErrorBox, LatencyBadge, Notice, Skeleton, Spark } from "../ui";
import { useFetch } from "@/lib/use-fetch";
import { useSnapshot } from "@/lib/use-snapshot";
import { MACRO_SYMBOLS, MacroGroup } from "@/lib/macro";
import { MACRO_NOTES } from "@/lib/i18n";
import { fmtPct, fmtPrice, toneClass } from "@/lib/format";
import type { QuoteLite } from "@/lib/types";
import { TradingViewWidget, tvLocale } from "../tv-widget";
import type { DictKey } from "@/lib/i18n";

interface MacroResp {
  fetchedAt: string;
  quotes: QuoteLite[];
  sparks: { symbol: string; closes: number[] }[];
}

const GROUPS: { id: MacroGroup; key: DictKey }[] = [
  { id: "indices", key: "grpIndices" },
  { id: "fx", key: "grpFx" },
  { id: "commodities", key: "grpCommodities" },
  { id: "global", key: "grpGlobal" },
];

export function RegimeBanner() {
  const { t } = useApp();
  const { data } = useSnapshot();
  if (!data) return null;
  const r = data.regime;
  const msg = r.note === "risk-on" ? t("regimeOn") : r.note === "risk-off-vix" ? t("regimeOffVix") : t("regimeOffTrend");
  return (
    <Notice tone={r.riskOn ? "ok" : "warn"}>
      <span className="font-semibold">{t("regimeTitle")}: </span>
      {msg}{" "}
      <span className="num text-muted">
        (SPY {fmtPrice(r.spy)} / SMA200 {fmtPrice(r.spySma200)} · VIX {fmtPrice(r.vix)} · {t("asOf")} {data.asOf})
      </span>
    </Notice>
  );
}

export function MacroDashboard() {
  const { t, lang } = useApp();
  const { data, error, loading, reload } = useFetch<MacroResp>("/api/market/macro", 5 * 60 * 1000);
  const [showTv, setShowTv] = useState(false);
  const qMap = new Map(data?.quotes.map((q) => [q.symbol, q]));
  const sMap = new Map(data?.sparks.map((s) => [s.symbol, s.closes]));

  return (
    <div className="space-y-4">
      <Card
        title={t("macroTitle")}
        sub={t("macroSub")}
        right={<LatencyBadge kind="delayed" time={data?.fetchedAt} />}
      >
        <div className="space-y-4">
          <RegimeBanner />
          {error && <ErrorBox message={error} onRetry={reload} />}
          {!data && loading && <Skeleton h={300} />}
          {data &&
            GROUPS.map((g) => (
              <div key={g.id}>
                <h3 className="label">{t(g.key)}</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {MACRO_SYMBOLS.filter((m) => m.group === g.id).map((m) => {
                    const q = qMap.get(m.symbol);
                    const closes = sMap.get(m.symbol) ?? [];
                    const note = MACRO_NOTES[m.symbol]?.[lang];
                    return (
                      <div key={m.symbol} className="rounded-md border border-line bg-bg/60 p-3" title={note}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold">{m.label}</div>
                            <div className="num text-[10px] text-muted">{m.symbol}</div>
                          </div>
                          <Spark values={closes} width={84} height={28} />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="num text-base font-semibold">
                            {fmtPrice(q?.price, m.unit === "idr" ? 0 : 2)}
                            {m.unit === "pct-yield" && "%"}
                          </span>
                          <span className={`num text-xs font-semibold ${toneClass(q?.changePct)}`}>
                            {fmtPct(q?.changePct, 2, false)}
                          </span>
                        </div>
                        {note && <p className="mt-2 text-[11px] leading-snug text-muted">{note}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </Card>
      <Card
        title={t("tvLiveView")}
        right={
          <>
            <LatencyBadge kind="widget" />
            <button className="btn" onClick={() => setShowTv((v) => !v)}>
              {showTv ? t("hide") : t("show")}
            </button>
          </>
        }
      >
        {showTv ? (
          <TradingViewWidget
            script="embed-widget-market-overview.js"
            height={520}
            config={{
              colorTheme: "dark",
              dateRange: "1M",
              showChart: true,
              locale: tvLocale(lang),
              isTransparent: true,
              width: "100%",
              height: "100%",
              showSymbolLogo: true,
              tabs: GROUPS.map((g) => ({
                title: t(g.key),
                symbols: MACRO_SYMBOLS.filter((m) => m.group === g.id).map((m) => ({ s: m.tv, d: m.label })),
              })),
            }}
          />
        ) : (
          <p className="text-xs text-muted">{t("latencyWidget")}</p>
        )}
      </Card>
    </div>
  );
}
