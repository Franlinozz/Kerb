import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The app reads the Kerb API; nothing else is fetched at runtime.
  env: { KERB_API_INTERNAL: process.env["KERB_API_INTERNAL"] ?? "http://127.0.0.1:8720" },
};

export default config;
