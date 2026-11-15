# US Stock Screener & Market Intelligence (EN / ID)

A bilingual (English / Bahasa Indonesia) US stock market terminal built on a **$0 free-tier stack**:
Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + Lucide, deployed on **Vercel Hobby**,
data from **yahoo-finance2** (unofficial Yahoo Finance), **Finnhub free tier** and **TradingView free widgets**,
with user state in browser `localStorage`.

> Educational tool — not investment advice. Free data can be delayed, incomplete or wrong.
> Vercel Hobby and Yahoo data are for **personal, non-commercial use** only.

## Modules

| # | Module | Data source | Freshness |
|---|--------|-------------|-----------|
| 1 | Global Macro & Intermarket dashboard (+ regime banner) | Yahoo via `/api/market/macro`, TradingView Market Overview (optional) | Live quote, CDN-cached 5 min |
| 2 | Sector performance & rotation (11 SPDR ETFs, 1D/1W/1M/3M, rebased comparison chart) | Daily snapshot | End of day |
| 3 | Top 5 swing setups with full trade plan, 3-pillar rationale, backtest evidence | Daily snapshot + weekly backtest | End of day |
| 4 | Top 5 day-trade momentum scanner (whole-market funnel) | Yahoo screeners + 5m bars via `/api/market/daytrade` | Snapshot every 2 min (not tick data) |
| 5 | IPO tracker (upcoming 60 days / recent 30 days) | Finnhub `/calendar/ipo` | CDN-cached 3 h |
| 6 | Interactive chart, Day vs Swing mode, live rule cheat-sheet | Lightweight Charts + Yahoo bars (precise indicators); TradingView Advanced Chart as a 2nd tab | 1 min (intraday) |
| 7 | Multi-filter screener (~150 symbols), presets, CSV export | Daily snapshot + live quote overlay | EOD indicators, 1-min prices |
| 8 | News (impact/sentiment heuristics) & US economic calendar | Finnhub `/news`, TradingView Events widget | 10 min |
| 9 | Fractional position-size calculator, pre-trade checklist, glossary | Client-side | — |

## Architecture

```
GitHub Actions (cron, after US close)          Vercel (Hobby)
  scripts/build-snapshot.ts  ──commit──►  public/data/snapshot.json  ──► Modules 2, 3, 7
  scripts/backtest.ts (weekly) ─commit──►  public/data/backtest.json  ──► Module 3 evidence
                                           /api/market/* (yahoo-finance2) ─► Modules 1, 4, 6, 7, search
                                           /api/ipo, /api/news (Finnhub)   ─► Modules 5, 8
```

* Heavy work (150 symbols × history + fundamentals) runs in GitHub Actions, not in serverless functions,
  so it never hits Vercel timeouts and the site keeps working (with a timestamp) if Yahoo is down.
* Every API route sends `Cache-Control: s-maxage=…`, so Vercel's CDN absorbs repeat traffic and
  free-tier rate limits are respected. There is also an in-memory TTL cache per function instance.
* Every panel shows a latency badge (`EOD snapshot`, `Yahoo feed`, `TradingView widget feed`, `Finnhub`).

## Swing rules: how they were chosen (backtest evidence)

`npm run backtest` replays the exact production rules (`src/lib/quant/swing.ts`) over 11 years of
daily data for the 144 stocks in the universe. Conservative fills: gaps through the stop exit at the open,
stop is assumed first when stop and target hit on the same bar, 0.10% round-trip cost, one position per
symbol, and the market regime filter is applied (SPY > SMA200).

| Variant | Trades | Win | Avg R | PF | Out-of-sample (2022+) Avg R / PF |
|---|---|---|---|---|---|
| **Final rules** (RSI 35–60, wide stop, 50% at 2R / rest at 3.5R, no breakeven move) | 3,484 | 43.8% | 0.222 | 1.39 | 0.122 / 1.20 |
| Original spec (RSI 40–55, ≥1.5R room filter, stop to breakeven) | 1,513 | 39.6% | 0.150 | 1.23 | 0.063 / 1.09 |
| Final without regime filter | 3,694 | 43.3% | 0.204 | 1.36 | 0.076 / 1.12 |
| Stop = 1.5× ATR only | 5,279 | 38.8% | 0.154 | 1.23 | 0.078 / 1.11 |
| Baseline: any Stage-2 day (no pullback/RSI rule) | 3,649 | 44.9% | 0.228 | 1.41 | 0.153 / 1.26 |

How to read this: the edge is **small and weaker after 2022**. **Survivorship bias** (only today's
large caps were tested) inflates every number. The pullback/RSI filter did **not** beat a plain Stage-2
baseline. It is kept because the spec asks for a pullback entry plan, and it costs little in expectancy.
The 100-point ranking (Technical 50 / Fundamental 30 / Sentiment 20) only orders setups that already
qualify. It is **not** backtested, because historical fundamentals are not freely available.

## Local development

```bash
npm install
```

```bash
cp .env.example .env.local
```

Then put your free Finnhub key in `.env.local`. Optional: IPO and news show a setup hint without it.

```bash
npm run snapshot
```

```bash
npm run dev
```

Behind an HTTPS proxy on Node ≥ 22.21, prefix commands with `NODE_USE_ENV_PROXY=1`.

## Deploy to GitHub + Vercel Free Tier (3 steps)

1. **Push to GitHub.** Push this repository to your GitHub account (public repos get unlimited Actions minutes; private repos get 2,000 min/month, and this workflow uses about 40–60).
   In the repo, open **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**, so the bot can commit `public/data/*.json`.
2. **Import in Vercel (Hobby).** On vercel.com, click **Add New → Project → Import** this repo. The framework is detected as Next.js automatically; keep the defaults.
   Under **Environment Variables**, add `FINNHUB_API_KEY` (free key from https://finnhub.io/register — needs an email, no credit card). Click **Deploy**.
3. **Start the data pipeline.** In GitHub, open **Actions → Market data snapshot → Run workflow** (tick "Also re-run the 11-year backtest" the first time).
   After that it runs automatically every weekday after the US close. Each data commit triggers a Vercel redeploy.

### Deploy (Bahasa Indonesia)

1. **Push ke GitHub.** Di repo, buka **Settings → Actions → General → Workflow permissions** dan pilih **Read and write**.
2. **Impor ke Vercel (Hobby).** Pilih **Add New → Project → Import** repo ini, tambahkan env `FINNHUB_API_KEY` (gratis dari finnhub.io/register, cukup email, tanpa kartu kredit), lalu klik **Deploy**.
3. **Jalankan pipeline data.** Buka **Actions → Market data snapshot → Run workflow** (centang backtest untuk run pertama). Selanjutnya workflow berjalan otomatis setiap hari bursa setelah pasar AS tutup.

## Known limitations (by design of the $0 constraint)

* `yahoo-finance2` is unofficial. Yahoo may rate-limit cloud IPs or change endpoints without notice. Panels then show an error with the last cached data.
* The day-trade scanner is a 2-minute snapshot, not a tick feed. Time-of-day RVOL needs about 10 prior sessions of 5m bars.
* The free Finnhub IPO feed has no sector or company valuation. The lock-up date is estimated as listing + 180 days.
* News headlines and IPO names stay in their original language. Only the UI, notes and rationale are translated.
* The NYSE holiday calendar (`src/lib/market-hours.ts`) covers 2026–2027 and must be extended yearly.
* TradingView widget indicator lengths cannot be customised reliably on the free widget. The default chart is therefore Lightweight Charts with locally computed indicators.
