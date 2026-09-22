/**
 * next/link without viewport prefetch. Prefetching every visible link (ten Board rows, the nav,
 * the footer) parsed a route payload each on the main thread during load. Routes are served from
 * the ISR cache, so a click still answers quickly without it.
 */
import NextLink from "next/link";
import type { ComponentProps } from "react";

export default function Link(props: ComponentProps<typeof NextLink>): React.ReactElement {
  return <NextLink prefetch={false} {...props} />;
}
