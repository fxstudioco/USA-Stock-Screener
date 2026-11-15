"use client";

import { ReactNode } from "react";
import { AlertTriangle, RefreshCw, Radio, Clock, Database } from "lucide-react";
import { useApp } from "./providers";

export function Card({ title, sub, right, children, className = "" }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-card ${className}`}>
      {(title || right) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-wide text-fg">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs leading-relaxed text-muted">{sub}</p>}
          </div>
          {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export type LatencyKind = "eod" | "delayed" | "widget" | "finnhub";

export function LatencyBadge({ kind, time }: { kind: LatencyKind; time?: string | number | null }) {
  const { t, lang } = useApp();
  const map = {
    eod: { label: t("latencyEod"), Icon: Database, cls: "border-sky-500/30 text-sky-300" },
    delayed: { label: t("latencyDelayed"), Icon: Clock, cls: "border-amber-500/30 text-amber-300" },
    widget: { label: t("latencyWidget"), Icon: Radio, cls: "border-emerald-500/30 text-emerald-300" },
    finnhub: { label: t("latencyFinnhub"), Icon: Clock, cls: "border-violet-500/30 text-violet-300" },
  }[kind];
  const ts =
    time != null
      ? new Date(time).toLocaleString(lang === "id" ? "id-ID" : "en-US", {
          timeZone: "Asia/Jakarta",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB"
      : null;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${map.cls}`}>
      <map.Icon size={11} aria-hidden />
      {map.label}
      {ts && <span className="text-muted">· {ts}</span>}
    </span>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useApp();
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-md border border-down/40 bg-down/10 p-3 text-xs text-fg">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-down" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("error")}</p>
        <p className="text-muted">{t("errorHint")}</p>
        <p className="mt-1 break-all font-mono text-[11px] text-muted">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn">
          <RefreshCw size={12} aria-hidden /> {t("retry")}
        </button>
      )}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "ok" }) {
  const cls = {
    info: "border-line bg-bg/60 text-muted",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    ok: "border-up/40 bg-up/10 text-emerald-200",
  }[tone];
  return <div className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</div>;
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="animate-pulse rounded-md bg-line/50" style={{ height: h }} />;
}

export function Spark({ values, width = 120, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`);
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      <polyline fill="none" stroke={up ? "var(--color-up)" : "var(--color-down)"} strokeWidth="1.5" points={pts.join(" ")} />
    </svg>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "up" | "down" | "neutral" | "warn" | "info" }) {
  const cls = {
    up: "bg-up/15 text-up border-up/30",
    down: "bg-down/15 text-down border-down/30",
    neutral: "bg-line/40 text-muted border-line",
    warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}
