import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The app reads the Kerb API; nothing else is fetched at runtime.
  env: { KERB_API_INTERNAL: process.env["KERB_API_INTERNAL"] ?? "http://127.0.0.1:8720" },
  // V2 route names. 308s, so every link to the V1 names keeps working, method and all.
  async redirects() {
    return [
      { source: "/market", destination: "/credit", permanent: true },
      { source: "/reports", destination: "/research", permanent: true },
      { source: "/reports/:id", destination: "/research/:id", permanent: true },
    ];
  },
};

export default config;
