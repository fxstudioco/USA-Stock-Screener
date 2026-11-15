"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Activity } from "lucide-react";
import { useApp } from "./providers";
import { sessionState, fmtClock, SessionState } from "@/lib/market-hours";

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

function MarketBadge() {
  const { t } = useApp();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <div className="h-7 w-48" />;
  const st: SessionState = sessionState(now);
  const cfg = {
    REGULAR: { label: t("marketOpen"), cls: "border-up/50 bg-up/10 text-up", dot: "bg-up animate-pulse" },
    PRE: { label: t("marketPre"), cls: "border-amber-500/50 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
    POST: { label: t("marketPost"), cls: "border-violet-500/50 bg-violet-500/10 text-violet-300", dot: "bg-violet-400" },
    CLOSED: { label: t("marketClosed"), cls: "border-line bg-card text-muted", dot: "bg-muted" },
  }[st];
  return (
    <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${cfg.cls}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} aria-hidden />
      <span className="font-semibold">{cfg.label}</span>
      <span className="num hidden text-[11px] text-muted sm:inline">
        {fmtClock(now, "America/New_York")} ET · {fmtClock(now, "Asia/Jakarta")} WIB
      </span>
    </div>
  );
}

function TickerSearch() {
  const { t, openChart } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/market/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        const j = (await r.json()) as { results: SearchResult[] };
        setResults(j.results ?? []);
        setOpen(true);
      } catch {
        /* aborted or offline */
      }
    }, 250);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (s: string) => {
    openChart(s);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) pick(results[0]?.symbol ?? q.trim().toUpperCase());
        }}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="input pl-8"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-line bg-card shadow-xl">
          {results.map((r) => (
            <li key={r.symbol}>
              <button onClick={() => pick(r.symbol)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-accent/10">
                <span className="num font-semibold">{r.symbol}</span>
                <span className="flex-1 truncate text-muted">{r.name}</span>
                <span className="text-[10px] text-muted">{r.exchange}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TopNav() {
  const { t, lang, setLang } = useApp();
  return (
    <header className="sticky top-0 z-40 h-[57px] border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1500px] items-center gap-3 px-4">
        <div className="flex shrink-0 items-center gap-2">
          <Activity size={18} className="text-accent" aria-hidden />
          <div className="hidden leading-tight md:block">
            <div className="text-sm font-bold tracking-tight">{t("appName")}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">{t("appTagline")}</div>
          </div>
        </div>
        <MarketBadge />
        <div className="flex flex-1 justify-end md:justify-center">
          <TickerSearch />
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-line text-xs font-semibold" role="group" aria-label="Language">
          {(["id", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`px-2.5 py-1.5 ${lang === l ? "bg-accent/25 text-fg" : "text-muted hover:text-fg"}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
