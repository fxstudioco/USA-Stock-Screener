// US equity market session clock (NYSE/Nasdaq) with holiday & early-close calendar.
// Yahoo's `marketState` (from live quotes) is used to confirm when available.
// Holiday list must be extended each year (source: NYSE published holiday calendar).

export const NYSE_HOLIDAYS = new Set([
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

/** 13:00 ET early closes */
export const NYSE_EARLY_CLOSES = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

export type SessionState = "PRE" | "REGULAR" | "POST" | "CLOSED";

export interface EtParts {
  date: string; // YYYY-MM-DD
  minutes: number; // minutes since 00:00 ET
  weekday: number; // 0 = Sunday
}

export function etParts(d: Date = new Date()): EtParts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const hour = Number(p.hour) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + Number(p.minute), weekday: wd };
}

export function isTradingDay(date: string, weekday: number): boolean {
  return weekday > 0 && weekday < 6 && !NYSE_HOLIDAYS.has(date);
}

export function sessionState(d: Date = new Date()): SessionState {
  const { date, minutes, weekday } = etParts(d);
  if (!isTradingDay(date, weekday)) return "CLOSED";
  const close = NYSE_EARLY_CLOSES.has(date) ? 13 * 60 : 16 * 60;
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return "PRE";
  if (minutes >= 9 * 60 + 30 && minutes < close) return "REGULAR";
  if (minutes >= close && minutes < 20 * 60) return "POST";
  return "CLOSED";
}

/** Fraction of the regular session elapsed (0..1). */
export function sessionElapsed(d: Date = new Date()): number {
  const { date, minutes } = etParts(d);
  const close = NYSE_EARLY_CLOSES.has(date) ? 13 * 60 : 16 * 60;
  return Math.max(0, Math.min(1, (minutes - (9 * 60 + 30)) / (close - (9 * 60 + 30))));
}

export function fmtClock(d: Date, tz: "America/New_York" | "Asia/Jakarta"): string {
  return d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
}
