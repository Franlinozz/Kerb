/** The Kerb mark: the kerb step with one observation (V2-DESIGN-SYSTEM.md section 6). */
export function Mark({ size = 22 }: { size?: number }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M2 8.5h11v5h9V20H2z" fill="currentColor" />
      <rect x="15.5" y="4" width="4" height="4" fill="currentColor" />
    </svg>
  );
}
