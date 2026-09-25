import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/lib/brand";

/** The KERB wordmark, traced from the master artwork. Height sets the size; takes the current text colour. */
export function Wordmark({ height = 14, className }: { height?: number; className?: string }): React.ReactElement {
  return (
    <svg className={className ?? "kerb-wordmark"} viewBox={WORDMARK_VIEWBOX} height={height} width={Math.round((height * 2772) / 420)} aria-hidden="true">
      <path d={WORDMARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
