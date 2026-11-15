export const fmtPrice = (n: number | null | undefined, d = 2): string =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPct = (n: number | null | undefined, d = 2, isFraction = true): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = isFraction ? n * 100 : n;
  return `${v > 0 ? "+" : ""}${v.toFixed(d)}%`;
};

export const fmtPctPlain = (n: number | null | undefined, d = 1): string =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(d)}%`;

export const fmtCompact = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

export const fmtUsd = (n: number | null | undefined, d = 2): string =>
  n == null || !Number.isFinite(n) ? "—" : `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;

export const toneClass = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) || n === 0 ? "text-muted" : n > 0 ? "text-up" : "text-down";

export const relTime = (ms: number, lang: "en" | "id"): string => {
  const s = Math.round((Date.now() - ms) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang === "id" ? "id" : "en", { numeric: "auto" });
  if (s < 60) return rtf.format(-s, "second");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
};

export const fmtDateTime = (iso: string | number, lang: "en" | "id"): string =>
  new Date(iso).toLocaleString(lang === "id" ? "id-ID" : "en-US", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WIB";

/** Yahoo -> TradingView symbol mapping (class shares use a dot on TradingView). */
export const toTvSymbol = (s: string): string => s.replace("-", ".");
