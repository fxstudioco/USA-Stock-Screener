// Curated liquid US universe (~150 symbols). Static METADATA only (name/sector).
// Prices, market caps and volumes are always fetched live / from the daily snapshot.

export type Sector =
  | "Technology"
  | "Communication Services"
  | "Consumer Discretionary"
  | "Consumer Staples"
  | "Energy"
  | "Financials"
  | "Health Care"
  | "Industrials"
  | "Materials"
  | "Real Estate"
  | "Utilities"
  | "ETF";

export interface UniverseItem {
  symbol: string;
  name: string;
  sector: Sector;
  isEtf?: boolean;
}

const s = (sector: Sector, rows: [string, string][]): UniverseItem[] =>
  rows.map(([symbol, name]) => ({ symbol, name, sector }));

export const UNIVERSE: UniverseItem[] = [
  ...s("Technology", [
    ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["NVDA", "NVIDIA"], ["AVGO", "Broadcom"],
    ["ORCL", "Oracle"], ["CRM", "Salesforce"], ["AMD", "Advanced Micro Devices"], ["ADBE", "Adobe"],
    ["CSCO", "Cisco"], ["ACN", "Accenture"], ["INTC", "Intel"], ["QCOM", "Qualcomm"],
    ["TXN", "Texas Instruments"], ["IBM", "IBM"], ["NOW", "ServiceNow"], ["INTU", "Intuit"],
    ["AMAT", "Applied Materials"], ["MU", "Micron"], ["LRCX", "Lam Research"], ["KLAC", "KLA"],
    ["PANW", "Palo Alto Networks"], ["CRWD", "CrowdStrike"], ["PLTR", "Palantir"], ["ANET", "Arista Networks"],
    ["DELL", "Dell Technologies"], ["MRVL", "Marvell"], ["SHOP", "Shopify"], ["SNOW", "Snowflake"],
  ]),
  ...s("Communication Services", [
    ["GOOGL", "Alphabet"], ["META", "Meta Platforms"], ["NFLX", "Netflix"], ["DIS", "Walt Disney"],
    ["CMCSA", "Comcast"], ["T", "AT&T"], ["VZ", "Verizon"], ["TMUS", "T-Mobile US"],
    ["RBLX", "Roblox"], ["SPOT", "Spotify"],
  ]),
  ...s("Consumer Discretionary", [
    ["AMZN", "Amazon"], ["TSLA", "Tesla"], ["HD", "Home Depot"], ["MCD", "McDonald's"],
    ["NKE", "Nike"], ["SBUX", "Starbucks"], ["LOW", "Lowe's"], ["BKNG", "Booking Holdings"],
    ["TJX", "TJX Companies"], ["CMG", "Chipotle"], ["ABNB", "Airbnb"], ["F", "Ford"],
    ["GM", "General Motors"], ["DASH", "DoorDash"], ["MELI", "MercadoLibre"], ["ROST", "Ross Stores"],
  ]),
  ...s("Consumer Staples", [
    ["WMT", "Walmart"], ["COST", "Costco"], ["PG", "Procter & Gamble"], ["KO", "Coca-Cola"],
    ["PEP", "PepsiCo"], ["PM", "Philip Morris"], ["MO", "Altria"], ["MDLZ", "Mondelez"],
    ["CL", "Colgate-Palmolive"], ["TGT", "Target"], ["KR", "Kroger"],
  ]),
  ...s("Energy", [
    ["XOM", "Exxon Mobil"], ["CVX", "Chevron"], ["COP", "ConocoPhillips"], ["SLB", "SLB"],
    ["EOG", "EOG Resources"], ["OXY", "Occidental"], ["MPC", "Marathon Petroleum"], ["PSX", "Phillips 66"],
    ["HAL", "Halliburton"], ["DVN", "Devon Energy"],
  ]),
  ...s("Financials", [
    ["JPM", "JPMorgan Chase"], ["BAC", "Bank of America"], ["WFC", "Wells Fargo"], ["GS", "Goldman Sachs"],
    ["MS", "Morgan Stanley"], ["C", "Citigroup"], ["BRK-B", "Berkshire Hathaway"], ["V", "Visa"],
    ["MA", "Mastercard"], ["AXP", "American Express"], ["SCHW", "Charles Schwab"], ["BLK", "BlackRock"],
    ["PYPL", "PayPal"], ["COIN", "Coinbase"], ["SOFI", "SoFi Technologies"], ["HOOD", "Robinhood"],
  ]),
  ...s("Health Care", [
    ["LLY", "Eli Lilly"], ["UNH", "UnitedHealth"], ["JNJ", "Johnson & Johnson"], ["ABBV", "AbbVie"],
    ["MRK", "Merck"], ["PFE", "Pfizer"], ["TMO", "Thermo Fisher"], ["ABT", "Abbott"],
    ["DHR", "Danaher"], ["AMGN", "Amgen"], ["ISRG", "Intuitive Surgical"], ["GILD", "Gilead"],
    ["VRTX", "Vertex"], ["BMY", "Bristol-Myers Squibb"], ["CVS", "CVS Health"], ["REGN", "Regeneron"],
  ]),
  ...s("Industrials", [
    ["CAT", "Caterpillar"], ["GE", "GE Aerospace"], ["HON", "Honeywell"], ["UNP", "Union Pacific"],
    ["BA", "Boeing"], ["RTX", "RTX"], ["LMT", "Lockheed Martin"], ["DE", "Deere"],
    ["UPS", "UPS"], ["ETN", "Eaton"], ["UBER", "Uber"], ["DAL", "Delta Air Lines"],
    ["FDX", "FedEx"], ["WM", "Waste Management"], ["GEV", "GE Vernova"],
  ]),
  ...s("Materials", [
    ["LIN", "Linde"], ["SHW", "Sherwin-Williams"], ["FCX", "Freeport-McMoRan"], ["NEM", "Newmont"],
    ["APD", "Air Products"], ["ECL", "Ecolab"], ["DOW", "Dow"], ["NUE", "Nucor"],
  ]),
  ...s("Real Estate", [
    ["PLD", "Prologis"], ["AMT", "American Tower"], ["EQIX", "Equinix"], ["O", "Realty Income"],
    ["SPG", "Simon Property"], ["CCI", "Crown Castle"], ["PSA", "Public Storage"],
  ]),
  ...s("Utilities", [
    ["NEE", "NextEra Energy"], ["SO", "Southern Co"], ["DUK", "Duke Energy"], ["CEG", "Constellation Energy"],
    ["VST", "Vistra"], ["AEP", "American Electric Power"], ["D", "Dominion Energy"],
  ]),
  ...s("ETF", [
    ["SPY", "SPDR S&P 500 ETF"], ["QQQ", "Invesco QQQ"], ["IWM", "iShares Russell 2000"],
    ["DIA", "SPDR Dow Jones ETF"], ["SMH", "VanEck Semiconductor ETF"], ["GLD", "SPDR Gold Shares"],
    ["TLT", "iShares 20+Y Treasury"],
  ]).map((x) => ({ ...x, isEtf: true })),
];

export const SECTOR_ETFS: { symbol: string; sector: Exclude<Sector, "ETF"> }[] = [
  { symbol: "XLK", sector: "Technology" },
  { symbol: "XLF", sector: "Financials" },
  { symbol: "XLE", sector: "Energy" },
  { symbol: "XLV", sector: "Health Care" },
  { symbol: "XLI", sector: "Industrials" },
  { symbol: "XLY", sector: "Consumer Discretionary" },
  { symbol: "XLP", sector: "Consumer Staples" },
  { symbol: "XLU", sector: "Utilities" },
  { symbol: "XLB", sector: "Materials" },
  { symbol: "XLRE", sector: "Real Estate" },
  { symbol: "XLC", sector: "Communication Services" },
];

export const SECTOR_TO_ETF: Record<string, string> = Object.fromEntries(
  SECTOR_ETFS.map((e) => [e.sector, e.symbol]),
);

export const SECTORS = SECTOR_ETFS.map((e) => e.sector);

export const STOCKS = UNIVERSE.filter((u) => !u.isEtf);
