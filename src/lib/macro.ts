export type MacroGroup = "indices" | "fx" | "commodities" | "global";

export interface MacroSymbol {
  symbol: string;
  label: string;
  group: MacroGroup;
  tv: string; // TradingView symbol for the live widget
  unit?: "pct-yield" | "idr";
}

export const MACRO_SYMBOLS: MacroSymbol[] = [
  { symbol: "SPY", label: "S&P 500 (SPY)", group: "indices", tv: "AMEX:SPY" },
  { symbol: "QQQ", label: "Nasdaq 100 (QQQ)", group: "indices", tv: "NASDAQ:QQQ" },
  { symbol: "DIA", label: "Dow Jones (DIA)", group: "indices", tv: "AMEX:DIA" },
  { symbol: "IWM", label: "Russell 2000 (IWM)", group: "indices", tv: "AMEX:IWM" },
  { symbol: "^VIX", label: "VIX", group: "indices", tv: "CBOE:VIX" },
  { symbol: "DX-Y.NYB", label: "US Dollar Index", group: "fx", tv: "TVC:DXY" },
  { symbol: "IDR=X", label: "USD/IDR", group: "fx", tv: "FX_IDC:USDIDR", unit: "idr" },
  { symbol: "^TNX", label: "US 10Y Yield", group: "fx", tv: "TVC:US10Y", unit: "pct-yield" },
  { symbol: "GC=F", label: "Gold", group: "commodities", tv: "OANDA:XAUUSD" },
  { symbol: "CL=F", label: "WTI Crude", group: "commodities", tv: "TVC:USOIL" },
  { symbol: "BZ=F", label: "Brent Crude", group: "commodities", tv: "TVC:UKOIL" },
  { symbol: "HG=F", label: "Copper", group: "commodities", tv: "COMEX:HG1!" },
  { symbol: "NG=F", label: "Natural Gas", group: "commodities", tv: "NYMEX:NG1!" },
  { symbol: "^N225", label: "Nikkei 225", group: "global", tv: "TVC:NI225" },
  { symbol: "^HSI", label: "Hang Seng", group: "global", tv: "TVC:HSI" },
  { symbol: "^GDAXI", label: "DAX", group: "global", tv: "XETR:DAX" },
  { symbol: "^FTSE", label: "FTSE 100", group: "global", tv: "TVC:UKX" },
];
