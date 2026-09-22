/**
 * What each token is a claim on, from the issuer's instrument data (xStocks), as recorded in
 * PROJECT_STATE.md section 3. Display names only; nothing is computed from them.
 */
export const INSTRUMENTS: Record<string, { name: string; code: string; group: "ny" | "hk" | "metals" }> = {
  KOx: { name: "Coca-Cola", code: "KO", group: "ny" },
  "BRK.Bx": { name: "Berkshire Hathaway, class B", code: "BRK.B", group: "ny" },
  ICEx: { name: "Intercontinental Exchange", code: "ICE", group: "ny" },
  COINx: { name: "Coinbase Global", code: "COIN", group: "ny" },
  BMNRx: { name: "BitMine Immersion Technologies", code: "BMNR", group: "ny" },
  SLVx: { name: "iShares Silver Trust", code: "SLV", group: "metals" },
  HKEXCx: { name: "Hong Kong Exchanges and Clearing", code: "388", group: "hk" },
  MIXUx: { name: "Mixue Group", code: "2097", group: "hk" },
  KUAIx: { name: "Kuaishou Technology", code: "1024", group: "hk" },
  SHEINx: { name: "SHEIN", code: "625", group: "hk" },
};
export const instrument = (symbol: string): { name: string; code: string; group: "ny" | "hk" | "metals" } =>
  INSTRUMENTS[symbol] ?? { name: symbol, code: symbol, group: "ny" };
