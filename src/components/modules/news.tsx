"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useApp } from "../providers";
import { Card, ErrorBox, LatencyBadge, Notice, Pill, Skeleton } from "../ui";
import { TradingViewWidget, tvLocale } from "../tv-widget";
import { useFetch } from "@/lib/use-fetch";
import { ECON_GUIDE } from "@/lib/i18n";
import { relTime } from "@/lib/format";
import type { NewsItem } from "@/lib/types";

export function NewsCalendar() {
  const { t, lang, openChart } = useApp();
  const [impact, setImpact] = useState<"all" | "High" | "Medium">("all");
  const [symbol, setSymbol] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useFetch<{ fetchedAt: string; items: NewsItem[] }>(
    `/api/news${query ? `?symbol=${encodeURIComponent(query)}` : ""}`,
    10 * 60 * 1000,
  );
  const items = useMemo(
    () => (data?.items ?? []).filter((n) => (impact === "all" ? n.impact !== "Low" || !!query : n.impact === impact)),
    [data, impact, query],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{t("newsTitle")}</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t("econCalendar")} right={<LatencyBadge kind="widget" />}>
          <TradingViewWidget
            script="embed-widget-events.js"
            height={620}
            config={{
              colorTheme: "dark",
              isTransparent: true,
              width: "100%",
              height: "100%",
              locale: tvLocale(lang),
              importanceFilter: "0,1",
              countryFilter: "us",
            }}
          />
        </Card>
        <Card
          title={t("marketNews")}
          sub={t("newsHeuristic")}
          right={<LatencyBadge kind="finnhub" time={data?.fetchedAt} />}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "High", "Medium"] as const).map((i) => (
                <button key={i} onClick={() => setImpact(i)} className={`btn ${impact === i ? "border-accent bg-accent/15" : ""}`}>
                  {i === "all" ? `${t("filterImpact")}: High + Medium` : i}
                </button>
              ))}
              <form
                className="ml-auto flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuery(symbol.trim().toUpperCase());
                }}
              >
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  className="input num w-24 py-1 text-xs"
                  aria-label={t("symbol")}
                />
                <button className="btn" type="submit">
                  Go
                </button>
              </form>
            </div>
            {error === "missing_key" ? (
              <Notice tone="warn">{t("missingKey")}</Notice>
            ) : (
              error && <ErrorBox message={error} onRetry={reload} />
            )}
            {!data && loading && <Skeleton h={400} />}
            <ul className="max-h-[560px] space-y-2 overflow-auto pr-1">
              {items.map((n) => (
                <li key={n.id} className="rounded-md border border-line bg-bg/60 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Pill tone={n.impact === "High" ? "down" : n.impact === "Medium" ? "warn" : "neutral"}>{n.impact}</Pill>
                    {n.tags.map((tg) => (
                      <Pill key={tg} tone={tg === "Bullish" ? "up" : tg === "Bearish" ? "down" : "info"}>
                        {tg}
                      </Pill>
                    ))}
                    <span className="ml-auto text-[10px] text-muted">
                      {n.source} · {relTime(n.datetime, lang)}
                    </span>
                  </div>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-1 text-sm font-medium hover:text-accent">
                    <span>{n.headline}</span>
                    <ExternalLink size={12} className="mt-1 shrink-0 opacity-50 group-hover:opacity-100" aria-hidden />
                  </a>
                  {n.summary && <p className="mt-1 line-clamp-2 text-xs text-muted">{n.summary}</p>}
                  {n.related.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-muted">
                      {t("related")}:
                      {n.related.map((s) => (
                        <button key={s} onClick={() => openChart(s)} className="num rounded border border-line px-1 text-accent hover:bg-accent/10">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
      <Card title={t("econGuideTitle")}>
        <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ECON_GUIDE.map((g) => (
            <div key={g.key} className="rounded-md border border-line bg-bg/60 p-3">
              <dt className="num text-xs font-semibold text-accent">{g.key}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted">{g[lang]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
