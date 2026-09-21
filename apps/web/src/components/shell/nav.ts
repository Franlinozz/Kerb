export const NAV = [
  { href: "/board", label: "Board" },
  { href: "/credit", label: "Credit" },
  { href: "/research", label: "Research" },
  { href: "/methodology", label: "Methodology" },
  { href: "/developers", label: "Developers" },
] as const;

export const isActive = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`) || (href === "/board" && pathname.startsWith("/asset/"));
