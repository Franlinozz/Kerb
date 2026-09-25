export interface NavSub { href: string; label: string; note: string; icon: string; external?: boolean; tour?: boolean }
export interface NavGroup { label: string; items: NavSub[] }
export interface NavItem { href: string; label: string; menu?: NavGroup[]; foot?: { href: string; label: string } }

export const NAV: readonly NavItem[] = [
  { href: "/board", label: "Board" },
  { href: "/credit", label: "Credit" },
  { href: "/research", label: "Research" },
  { href: "/methodology", label: "Methodology" },
  {
    href: "/developers", label: "Developers",
    menu: [
      { label: "Integrate", items: [
        { href: "/developers#sdk", label: "SDK", note: "npm i kerb-sdk: typed terms in one call", icon: "package" },
        { href: "/developers#rest", label: "REST API", note: "No key, decimal strings, provenance on every value", icon: "braces" },
        { href: "/developers#solidity", label: "Solidity", note: "KerbQuote and Credit Mark feeds on mainnet", icon: "code" },
        { href: "/developers#agents", label: "Agents and MCP", note: "x402 paid checks, a free MCP server, OKX.AI", icon: "bot" },
      ] },
      { label: "Verify", items: [
        { href: "/proof", label: "Proof", note: "Every contract, and a term recomputed live", icon: "check" },
        { href: "/proof#contracts", label: "Contracts", note: "34 deployments, Sourcify exact match", icon: "layers" },
        { href: "https://github.com/Franlinozz/Kerb", label: "Source on GitHub", note: "Engine, contracts, tests and CI", icon: "git", external: true },
      ] },
    ],
    foot: { href: "https://api.usekerb.xyz/health", label: "API status" },
  },
  {
    href: "/docs", label: "Docs",
    menu: [
      { label: "Learn", items: [
        { href: "/docs", label: "Docs", note: "Every surface, start to finish", icon: "book" },
        { href: "/faq", label: "FAQ", note: "Short answers, searchable", icon: "help" },
        { href: "/whitepaper", label: "Whitepaper", note: "The design and the formula, KTS 0.2", icon: "paper" },
        { href: "/changelog", label: "Changelog", note: "Every release and what it changed", icon: "history" },
        { href: "#tour", label: "Take the tour", note: "Kerb in sixty seconds", icon: "compass", tour: true },
      ] },
      { label: "Legal", items: [
        { href: "/legal/terms", label: "Terms of use", note: "What Kerb is and is not", icon: "scale" },
        { href: "/legal/privacy", label: "Privacy", note: "What is stored, and for how long", icon: "shield" },
        { href: "/legal/risk", label: "Risk disclosure", note: "Unaudited, testnet credit, one attester", icon: "alert" },
      ] },
    ],
    foot: { href: "/kerb-whitepaper.pdf", label: "Whitepaper PDF" },
  },
];

export const isActive = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`) || (href === "/board" && pathname.startsWith("/asset/")) ||
  (href === "/docs" && (pathname === "/faq" || pathname === "/whitepaper" || pathname === "/changelog" || pathname.startsWith("/legal/"))) ||
  (href === "/developers" && pathname === "/proof");
