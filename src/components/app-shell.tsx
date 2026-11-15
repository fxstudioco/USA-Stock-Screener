"use client";

import { AppProvider, TabId, useApp } from "./providers";
import { TopNav } from "./top-nav";
import { MacroDashboard } from "./modules/macro";
import { SectorRotation } from "./modules/sectors";
import { SwingPicks } from "./modules/swing";
import { DayTradeScanner } from "./modules/daytrade";
import { IpoTracker } from "./modules/ipo";
import { ChartModule } from "./modules/chart";
import { Screener } from "./modules/screener";
import { NewsCalendar } from "./modules/news";
import { ToolsInfo } from "./modules/tools";
import {
  Globe2, PieChart, TrendingUp, Zap, Rocket, CandlestickChart, Filter, Newspaper, Wrench,
} from "lucide-react";
import type { DictKey } from "@/lib/i18n";

const TABS: { id: TabId; key: DictKey; Icon: typeof Globe2 }[] = [
  { id: "macro", key: "tabMacro", Icon: Globe2 },
  { id: "sectors", key: "tabSectors", Icon: PieChart },
  { id: "swing", key: "tabSwing", Icon: TrendingUp },
  { id: "day", key: "tabDay", Icon: Zap },
  { id: "ipo", key: "tabIpo", Icon: Rocket },
  { id: "chart", key: "tabChart", Icon: CandlestickChart },
  { id: "screener", key: "tabScreener", Icon: Filter },
  { id: "news", key: "tabNews", Icon: Newspaper },
  { id: "tools", key: "tabTools", Icon: Wrench },
];

function Body() {
  const { tab, setTab, t } = useApp();
  return (
    <>
      <TopNav />
      <nav className="sticky top-[57px] z-30 border-b border-line bg-bg/95 backdrop-blur" aria-label="Modules">
        <div className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 py-1.5">
          {TABS.map(({ id, key, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === id ? "bg-accent/20 text-fg ring-1 ring-accent/50" : "text-muted hover:bg-card hover:text-fg"
              }`}
            >
              <Icon size={14} aria-hidden /> {t(key)}
            </button>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-[1500px] px-4 py-5">
        {/* Modules stay mounted only when active to keep free-tier API usage minimal */}
        {tab === "macro" && <MacroDashboard />}
        {tab === "sectors" && <SectorRotation />}
        {tab === "swing" && <SwingPicks />}
        {tab === "day" && <DayTradeScanner />}
        {tab === "ipo" && <IpoTracker />}
        {tab === "chart" && <ChartModule />}
        {tab === "screener" && <Screener />}
        {tab === "news" && <NewsCalendar />}
        {/* Tools stays mounted so calculator inputs survive tab switches */}
        <div hidden={tab !== "tools"}>
          <ToolsInfo />
        </div>
      </main>
      <footer className="mx-auto max-w-[1500px] px-4 pb-8 text-[11px] leading-relaxed text-muted">
        {t("disclaimer")}
      </footer>
    </>
  );
}

export function AppShell() {
  return (
    <AppProvider>
      <Body />
    </AppProvider>
  );
}
