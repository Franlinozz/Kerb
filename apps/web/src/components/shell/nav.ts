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
        { href: "/developers#sdk", label: "SDK", note: "npm i kerb-sdk", icon: "package" },
        { href: "/developers#rest", label: "REST API", note: "Public, no key", icon: "braces" },
        { href: "/developers#solidity", label: "Solidity", note: "KerbQuote and feeds", icon: "code" },
        { href: "/developers#agents", label: "Agents and MCP", note: "x402, MCP, OKX.AI", icon: "bot" },
      ] },
      { label: "Verify", items: [
        { href: "/proof", label: "Proof", note: "A term recomputed live", icon: "check" },
        { href: "/proof#contracts", label: "Contracts", note: "34, Sourcify verified", icon: "layers" },
        { href: "https://github.com/Franlinozz/Kerb", label: "Source on GitHub", note: "Engine, contracts, tests", icon: "git", external: true },
      ] },
    ],
    foot: { href: "https://api.usekerb.xyz/health", label: "API status" },
  },
  {
    href: "/docs", label: "Docs",
    menu: [
      { label: "Learn", items: [
        { href: "/docs", label: "Docs", note: "Start to finish", icon: "book" },
        { href: "/faq", label: "FAQ", note: "Quick answers", icon: "help" },
        { href: "/film", label: "The film", note: "Kerb in 3½ minutes", icon: "play" },
        { href: "/whitepaper", label: "Whitepaper", note: "Design and formula", icon: "paper" },
        { href: "/changelog", label: "Changelog", note: "What changed, when", icon: "history" },
        { href: "#tour", label: "Take the tour", note: "Sixty seconds", icon: "compass", tour: true },
      ] },
      { label: "Legal", items: [
        { href: "/legal/terms", label: "Terms of use", note: "What Kerb is and isn't", icon: "scale" },
        { href: "/legal/privacy", label: "Privacy", note: "What is stored", icon: "shield" },
        { href: "/legal/risk", label: "Risk disclosure", note: "Read before you borrow", icon: "alert" },
      ] },
    ],
    foot: { href: "/kerb-whitepaper.pdf", label: "Whitepaper PDF" },
  },
];

export const isActive = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`) || (href === "/board" && pathname.startsWith("/asset/")) ||
  (href === "/docs" && (pathname === "/faq" || pathname === "/film" || pathname === "/whitepaper" || pathname === "/changelog" || pathname.startsWith("/legal/"))) ||
  (href === "/developers" && pathname === "/proof");
