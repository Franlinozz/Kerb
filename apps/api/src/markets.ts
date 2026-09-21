/**
 * Where each market actually is. Static, public reference data (the exchange floors), used by the
 * frontend for the market clocks and the corner coordinates. Nothing here is a measurement.
 */
export interface MarketMeta {
  code: string;
  city: string;
  label: string;
  tz: string;
  lat: number;
  lon: number;
}

export const MARKET_META: Record<string, MarketMeta> = {
  XNYS: { code: "XNYS", city: "New York", label: "NYSE", tz: "America/New_York", lat: 40.7069, lon: -74.0113 },
  XNAS: { code: "XNAS", city: "New York", label: "Nasdaq", tz: "America/New_York", lat: 40.7566, lon: -73.9863 },
  ARCX: { code: "ARCX", city: "New York", label: "NYSE Arca", tz: "America/New_York", lat: 40.7069, lon: -74.0113 },
  XHKG: { code: "XHKG", city: "Hong Kong", label: "HKEX", tz: "Asia/Hong_Kong", lat: 22.284, lon: 114.158 },
};

export function marketMeta(code: string): MarketMeta {
  return MARKET_META[code] ?? { code, city: code, label: code, tz: "UTC", lat: 0, lon: 0 };
}
