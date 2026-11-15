"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckSquare, RotateCcw } from "lucide-react";
import { safeStorage, useApp } from "../providers";
import { Card, Notice } from "../ui";
import { GLOSSARY } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n";
import { fmtPctPlain, fmtUsd } from "@/lib/format";

interface CalcInputs {
  capital: string;
  riskPct: string;
  entry: string;
  stop: string;
  tp1: string;
  tp2: string;
}

const CALC_DEFAULT: CalcInputs = { capital: "1000", riskPct: "2", entry: "100", stop: "95", tp1: "110", tp2: "117.5" };

export interface CalcResult {
  valid: boolean;
  dollarRisk: number;
  shares: number;
  positionValue: number;
  capped: boolean;
  actualRisk: number;
  profitTp1: number;
  profitTp2: number;
  profitPlan: number;
  rr1: number;
  rr2: number;
  rrPlan: number;
  breakEvenTp1: number;
  breakEvenPlan: number;
  gapLoss: number;
}

/** Pure position-sizing math (exported for reuse/testing). */
export function calcPosition(capital: number, riskPct: number, entry: number, stop: number, tp1: number, tp2: number, gapPct = 0.05): CalcResult {
  const valid = capital > 0 && riskPct > 0 && entry > 0 && stop > 0 && stop < entry && tp1 > 0 && tp2 > 0;
  const perShare = entry - stop;
  const dollarRisk = (capital * riskPct) / 100;
  let shares = valid ? dollarRisk / perShare : 0;
  let capped = false;
  if (shares * entry > capital) {
    shares = capital / entry;
    capped = true;
  }
  const rr1 = (tp1 - entry) / perShare;
  const rr2 = (tp2 - entry) / perShare;
  const rrPlan = 0.5 * rr1 + 0.5 * rr2;
  return {
    valid,
    dollarRisk,
    shares,
    positionValue: shares * entry,
    capped,
    actualRisk: shares * perShare,
    profitTp1: shares * (tp1 - entry),
    profitTp2: shares * (tp2 - entry),
    profitPlan: shares * 0.5 * (tp1 - entry) + shares * 0.5 * (tp2 - entry),
    rr1,
    rr2,
    rrPlan,
    breakEvenTp1: rr1 > 0 ? 1 / (1 + rr1) : NaN,
    breakEvenPlan: rrPlan > 0 ? 1 / (1 + rrPlan) : NaN,
    gapLoss: shares * (entry - stop * (1 - gapPct)),
  };
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input inputMode="decimal" className="input num" value={value} onChange={(e) => onChange(e.target.value.replace(",", "."))} />
    </label>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-line bg-bg/60 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`num mt-0.5 text-sm font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function Calculator() {
  const { t, calcPrefill } = useApp();
  const [inp, setInp] = useState<CalcInputs>(CALC_DEFAULT);
  const [symbol, setSymbol] = useState<string | null>(null);

  useEffect(() => {
    const raw = safeStorage.get("uss.calc");
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<CalcInputs>;
        setInp((p) => ({ ...p, capital: saved.capital ?? p.capital, riskPct: saved.riskPct ?? p.riskPct }));
      } catch {
        /* ignore */
      }
    }
  }, []);
  useEffect(() => safeStorage.set("uss.calc", JSON.stringify({ capital: inp.capital, riskPct: inp.riskPct })), [inp.capital, inp.riskPct]);

  useEffect(() => {
    if (!calcPrefill) return;
    const f = (n: number) => String(Math.round(n * 100) / 100);
    setInp((p) => ({ ...p, entry: f(calcPrefill.entry), stop: f(calcPrefill.stop), tp1: f(calcPrefill.tp1), tp2: f(calcPrefill.tp2) }));
    setSymbol(calcPrefill.symbol);
  }, [calcPrefill]);

  const n = (s: string) => Number(s);
  const r = useMemo(() => calcPosition(n(inp.capital), n(inp.riskPct), n(inp.entry), n(inp.stop), n(inp.tp1), n(inp.tp2)), [inp]);
  const set = (k: keyof CalcInputs) => (v: string) => setInp((p) => ({ ...p, [k]: v }));

  return (
    <Card title={t("calcTitle")} sub={symbol ? t("loadFromPick", { s: symbol }) : undefined}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("capital")} value={inp.capital} onChange={set("capital")} />
          <Field label={t("riskPerTrade")} value={inp.riskPct} onChange={set("riskPct")} />
          <Field label={t("entryPrice")} value={inp.entry} onChange={set("entry")} />
          <Field label={t("stopPrice")} value={inp.stop} onChange={set("stop")} />
          <Field label={t("tp1Price")} value={inp.tp1} onChange={set("tp1")} />
          <Field label={t("tp2Price")} value={inp.tp2} onChange={set("tp2")} />
          <div className="col-span-2 flex flex-wrap gap-1">
            {["33", "100", "500", "1000", "5000"].map((c) => (
              <button key={c} className="btn num" onClick={() => setInp((p) => ({ ...p, capital: c }))}>
                ${c}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {!r.valid ? (
            <Notice tone="warn">{t("invalidInputs")}</Notice>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <Stat label={t("dollarRisk")} value={fmtUsd(r.dollarRisk)} tone="text-down" />
                <Stat label={t("positionSize")} value={fmtUsd(r.positionValue)} />
                <Stat label={t("fractionalShares")} value={r.shares.toFixed(4)} />
                <Stat label={t("profitTp1")} value={`${fmtUsd(r.profitTp1)} (${r.rr1.toFixed(2)}R)`} tone="text-up" />
                <Stat label={t("profitTp2")} value={`${fmtUsd(r.profitTp2)} (${r.rr2.toFixed(2)}R)`} tone="text-up" />
                <Stat label="50% TP1 + 50% TP2" value={`${fmtUsd(r.profitPlan)} (${r.rrPlan.toFixed(2)}R)`} tone="text-up" />
                <Stat label={`${t("rr")} TP1 / TP2`} value={`1:${r.rr1.toFixed(2)} / 1:${r.rr2.toFixed(2)}`} />
                <Stat label={`${t("minWinRate")} (TP1)`} value={fmtPctPlain(r.breakEvenTp1)} />
                <Stat label={`${t("minWinRate")} (50/50)`} value={fmtPctPlain(r.breakEvenPlan)} />
              </div>
              {r.capped && <Notice tone="warn">{t("capped", { risk: fmtUsd(r.actualRisk) })}</Notice>}
              {r.positionValue < 1 && <Notice tone="warn">{t("minOrderWarn")}</Notice>}
              <Notice tone="warn">
                <AlertTriangle size={12} className="mr-1 inline" aria-hidden />
                {t("gapScenario", { gap: 5, loss: fmtUsd(r.gapLoss) })}
              </Notice>
              <Notice>{t("brokerStopWarn")}</Notice>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

const CHECKS: DictKey[] = ["ck1", "ck2", "ck3", "ck4", "ck5", "ck6"];

function Checklist() {
  const { t } = useApp();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const raw = safeStorage.get("uss.checklist");
    if (raw) {
      try {
        setChecked(JSON.parse(raw) as Record<string, boolean>);
      } catch {
        /* ignore */
      }
    }
  }, []);
  const update = (next: Record<string, boolean>) => {
    setChecked(next);
    safeStorage.set("uss.checklist", JSON.stringify(next));
  };
  const all = CHECKS.every((k) => checked[k]);
  return (
    <Card
      title={t("checklistTitle")}
      right={
        <button className="btn" onClick={() => update({})}>
          <RotateCcw size={12} aria-hidden /> {t("ckReset")}
        </button>
      }
    >
      <ul className="space-y-2">
        {CHECKS.map((k) => (
          <li key={k}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-blue-500" checked={!!checked[k]} onChange={(e) => update({ ...checked, [k]: e.target.checked })} />
              <span className={checked[k] ? "text-muted line-through" : ""}>{t(k)}</span>
            </label>
          </li>
        ))}
      </ul>
      {all && (
        <div className="mt-3">
          <Notice tone="ok">
            <CheckSquare size={12} className="mr-1 inline" aria-hidden />
            {t("ckAll")}
          </Notice>
        </div>
      )}
    </Card>
  );
}

function Glossary() {
  const { t, lang } = useApp();
  return (
    <Card title={t("glossaryTitle")}>
      <dl className="grid gap-3 md:grid-cols-2">
        {GLOSSARY.map((g) => (
          <div key={g.term} className="rounded-md border border-line bg-bg/60 p-3">
            <dt className="num text-xs font-semibold text-accent">{g.term}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-muted">{g[lang]}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function ToolsInfo() {
  const { t } = useApp();
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{t("toolsTitle")}</h2>
      <Calculator />
      <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <Checklist />
        <Glossary />
      </div>
    </div>
  );
}
