// Fetch daily history with a local disk cache (.cache/) so repeated script runs are cheap.
import fs from "node:fs";
import path from "node:path";
import { fetchBars } from "../src/lib/yahoo";
import type { Bar } from "../src/lib/quant/indicators";

const DIR = path.join(process.cwd(), ".cache", "history");

export async function getDaily(symbol: string, years: number, maxAgeHours = 12): Promise<Bar[]> {
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${symbol}_${years}y.json`);
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < maxAgeHours * 3600e3) {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Bar[];
  }
  const p1 = new Date();
  p1.setFullYear(p1.getFullYear() - years);
  const bars = await fetchBars(symbol, "1d", p1);
  fs.writeFileSync(file, JSON.stringify(bars));
  return bars;
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (idx < items.length) {
        const my = idx++;
        out[my] = await fn(items[my]);
      }
    }),
  );
  return out;
}
