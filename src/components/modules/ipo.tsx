"use client";

import { useApp } from "../providers";
import { Card, ErrorBox, LatencyBadge, Notice, Pill, Skeleton } from "../ui";
import { useFetch } from "@/lib/use-fetch";
import { fmtCompact, fmtUsd } from "@/lib/format";
import type { IpoItem } from "@/lib/types";

interface IpoResp {
  fetchedAt: string;
  upcoming: IpoItem[];
  recent: IpoItem[];
}

function IpoTable({ items, kind }: { items: IpoItem[]; kind: "upcoming" | "recent" }) {
  const { t, openChart } = useApp();
  if (!items.length) return <p className="text-xs text-muted">{t("noIpos")}</p>;
  return (
    <div className="max-h-[520px] overflow-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>{t("company")}</th>
            <th>{t("symbol")}</th>
            <th>{t("exchange")}</th>
            <th>{t("date")}</th>
            <th className="text-right">{t("priceRange")}</th>
            <th className="text-right">{t("shares")}</th>
            <th className="text-right">{t("offerValue")}</th>
            <th>{t("status")}</th>
            <th>{t("lockup")}</th>
            <th>{t("riskNote")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x) => {
            const sym = x.symbol;
            return (
              <tr key={`${x.name}-${x.date}`}>
                <td className="max-w-[220px] truncate" title={x.name}>
                  {x.name}
                </td>
                <td>
                  {sym && kind === "recent" ? (
                    <button className="num font-semibold text-accent hover:underline" onClick={() => openChart(sym, "day")}>
                      {sym}
                    </button>
                  ) : (
                    <span className="num font-semibold">{sym ?? "—"}</span>
                  )}
                </td>
                <td className="text-muted">{x.exchange ?? "—"}</td>
                <td className="num">{x.date}</td>
                <td className="num text-right">{x.priceRange ? `$${x.priceRange}` : "—"}</td>
                <td className="num text-right">{fmtCompact(x.shares)}</td>
                <td className="num text-right">{x.offerValue ? fmtUsd(x.offerValue, 0) : "—"}</td>
                <td>
                  <Pill tone={x.status === "priced" ? "up" : x.status === "expected" ? "info" : "neutral"}>{x.status ?? "—"}</Pill>
                </td>
                <td className="num text-muted">{x.lockupEstimate ?? "—"}</td>
                <td className="max-w-[360px] whitespace-normal text-[11px] leading-snug text-muted">
                  {kind === "upcoming" ? t("ipoRiskUpcoming") : t("ipoRiskRecent", { date: x.lockupEstimate ?? "—" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function IpoTracker() {
  const { t } = useApp();
  const { data, error, loading, reload } = useFetch<IpoResp>("/api/ipo");
  return (
    <div className="space-y-4">
      <Card title={t("ipoTitle")} sub={t("ipoSub")} right={<LatencyBadge kind="finnhub" time={data?.fetchedAt} />}>
        <div className="space-y-3">
          <Notice>{t("ipoMissingFields")}</Notice>
          {error === "missing_key" ? (
            <Notice tone="warn">{t("missingKey")}</Notice>
          ) : (
            error && <ErrorBox message={error} onRetry={reload} />
          )}
          {!data && loading && <Skeleton h={240} />}
        </div>
      </Card>
      {data && (
        <>
          <Card title={`${t("upcoming")} (${data.upcoming.length})`}>
            <IpoTable items={data.upcoming} kind="upcoming" />
          </Card>
          <Card title={`${t("recent")} (${data.recent.length})`}>
            <IpoTable items={data.recent} kind="recent" />
          </Card>
        </>
      )}
    </div>
  );
}
