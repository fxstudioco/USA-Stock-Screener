"use client";

import { useEffect, useRef } from "react";

/**
 * Generic TradingView free embeddable widget loader.
 * `script` is the widget file name, e.g. "embed-widget-advanced-chart.js".
 */
export function TradingViewWidget({ script, config, height }: { script: string; config: Record<string, unknown>; height: number | string }) {
  const ref = useRef<HTMLDivElement>(null);
  const cfg = JSON.stringify(config);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "100%";
    inner.style.width = "100%";
    el.appendChild(inner);
    const s = document.createElement("script");
    s.src = `https://s3.tradingview.com/external-embedding/${script}`;
    s.async = true;
    s.type = "text/javascript";
    s.innerHTML = cfg;
    el.appendChild(s);
    return () => {
      el.innerHTML = "";
    };
  }, [script, cfg]);
  return <div ref={ref} className="tradingview-widget-container w-full overflow-hidden rounded-md" style={{ height }} />;
}

export const tvLocale = (lang: "en" | "id") => (lang === "id" ? "id_ID" : "en");
