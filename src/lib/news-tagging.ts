// Keyword-based (heuristic) impact & sentiment tagging. Not an NLP model; labeled as heuristic in the UI.
import type { NewsItem } from "./types";

const HIGH = [
  /\bfed\b/i, /\bfomc\b/i, /powell/i, /rate (cut|hike)s?/i, /interest rates?/i, /\bcpi\b/i, /inflation/i,
  /\bpce\b/i, /payrolls?|jobs report|unemployment/i, /\bgdp\b/i, /recession/i, /tariff/i,
  /treasury yields?|bond yields?/i, /shutdown/i, /\bwar\b|missile|invasion/i, /sanction/i, /debt ceiling/i,
];
const MEDIUM = [
  /earnings|quarterly results|revenue/i, /guidance|outlook|forecast/i, /upgrade|downgrade/i,
  /merger|acquisition|acquire|buyout|deal/i, /\bipo\b/i, /\bsec\b|antitrust|regulator/i, /layoffs?|job cuts/i,
  /buyback|dividend/i, /\boil\b|opec|crude/i, /\bchips?\b|semiconductor|\bai\b/i,
];
const BULL = [
  /beats?\b|tops estimates/i, /surges?|soars?|jumps?|rall(y|ies)|climbs?|gains?\b/i, /record high/i,
  /upgrade/i, /raises? (guidance|outlook|forecast)/i, /approv(al|ed)/i, /rate cuts?/i, /strong demand/i,
];
const BEAR = [
  /miss(es)?\b|falls short/i, /plunges?|tumbles?|slumps?|sinks?|drops?|falls?\b|slides?/i, /downgrade/i,
  /cuts? (guidance|outlook|forecast)/i, /lawsuit|probe|investigation|recall/i, /layoffs?/i, /warns?|warning/i,
  /rate hikes?/i, /bankrupt/i,
];
const MACRO = [/\bfed\b|fomc|inflation|\bcpi\b|\bpce\b/i, /tariff|trade war/i, /\bwar\b|geopolitic|sanction/i, /recession|yields?|shutdown|debt/i];

export function tagNews(headline: string, summary: string): Pick<NewsItem, "impact" | "tags"> {
  const text = `${headline} ${summary}`;
  const impact: NewsItem["impact"] = HIGH.some((r) => r.test(text))
    ? "High"
    : MEDIUM.some((r) => r.test(text))
      ? "Medium"
      : "Low";
  const tags: NewsItem["tags"] = [];
  const bull = BULL.filter((r) => r.test(headline)).length;
  const bear = BEAR.filter((r) => r.test(headline)).length;
  if (bull > bear) tags.push("Bullish");
  if (bear > bull) tags.push("Bearish");
  if (MACRO.some((r) => r.test(text))) tags.push("Macro Risk");
  return { impact, tags };
}
