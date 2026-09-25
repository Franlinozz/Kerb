import { MARK_LOWER, MARK_UPPER, MARK_VIEWBOX } from "@/lib/brand";

/** The Kerb mark: two offset slabs, the lower one a tone lighter. Takes the current text colour. */
export function Mark({ size = 22 }: { size?: number }): React.ReactElement {
  return (
    <svg className="kerb-mark" viewBox={MARK_VIEWBOX} width={Math.round(size * 1.45)} height={Math.round(size * 0.7)} aria-hidden="true">
      <path d={MARK_UPPER} fill="currentColor" />
      <path d={MARK_LOWER} fill="currentColor" className="kerb-mark-lower" />
    </svg>
  );
}
