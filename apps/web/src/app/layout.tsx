import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { Toaster } from "@/components/ui/Toaster";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "@/styles/index.css";

/**
 * Fonts are actually loaded (AGENTS.md 12.4 rule 2). General Sans is self-hosted from files fetched
 * at build time (scripts/fetch-fonts.mjs); a missing file fails the build.
 */
const generalSans = localFont({
  src: [
    { path: "../fonts/GeneralSans-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/GeneralSans-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-general-sans",
  display: "swap",
  fallback: ["Hanken Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
});
const instrumentSerif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-instrument-serif", display: "swap", preload: false });
const plexMono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-plex-mono", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Kerb · Credit on the market's clock", template: "%s · Kerb" },
  description: "The market-time risk layer for tokenized stocks on X Layer. Kerb measures the exit in real pools, then lends against it. Never lend more than you can liquidate.",
  metadataBase: new URL("https://usekerb.xyz"),
  applicationName: "Kerb",
  openGraph: { type: "website", siteName: "Kerb", url: "https://usekerb.xyz" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0C0A" },
    { media: "(prefers-color-scheme: light)", color: "#EFEBE3" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" data-theme="night" suppressHydrationWarning className={`${generalSans.variable} ${instrumentSerif.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <Providers>
          {/* Separate Suspense boundaries hydrate as separate tasks, so the main thread can breathe
              between the header, the page and the footer instead of one long hydration. */}
          <Suspense><SiteHeader /></Suspense>
          <main id="main" className="wrap site-main"><Suspense>{children}</Suspense></main>
          <Suspense><SiteFooter /></Suspense>
          <Suspense><Toaster /></Suspense>
        </Providers>
      </body>
    </html>
  );
}
