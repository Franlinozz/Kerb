import type { MetadataRoute } from "next";

const BASE = "https://www.usekerb.xyz";
const ASSETS = ["BRK.Bx", "HKEXCx", "COINx", "KUAIx", "ICEx", "MIXUx", "KOx", "SHEINx", "BMNRx", "SLVx"];
const PAGES = ["", "/board", "/credit", "/research", "/research/1", "/research/2", "/methodology", "/developers", "/proof", "/docs", "/faq", "/whitepaper", "/changelog", "/legal/terms", "/legal/privacy", "/legal/risk", "/llms.txt"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...PAGES.map((p) => ({ url: `${BASE}${p}`, lastModified: now, changeFrequency: "hourly" as const, priority: p === "" ? 1 : 0.7 })),
    ...ASSETS.map((a) => ({ url: `${BASE}/asset/${encodeURIComponent(a)}`, lastModified: now, changeFrequency: "hourly" as const, priority: 0.6 })),
  ];
}
