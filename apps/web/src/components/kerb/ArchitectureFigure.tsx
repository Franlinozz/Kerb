/**
 * The system diagram (scripts/architecture-svg.py draws it, for the README and here). Two files,
 * one per palette, swapped by theme; the flow lines animate inside the SVG and stop under reduced
 * motion. On narrow screens the figure scrolls sideways inside its frame instead of shrinking
 * past legibility.
 */
export function ArchitectureFigure({ caption = true }: { caption?: boolean }): React.ReactElement {
  const alt = "Kerb architecture: X Layer pools, OKX DEX quotes, reference prices and exchange calendars feed the collector and an append-only store; the KTS 0.2 engine computes terms and an input bundle; the attester signs and posts to X Layer mainnet with the Builder Code; a relay mirrors terms to testnet where Kerb Credit lends; contracts, agents and developers read the same terms.";
  return (
    <figure className="arch-fig">
      <div className="arch-frame" tabIndex={0} aria-label="System diagram, scrolls sideways on small screens">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="arch-img arch-dark" src="/architecture-dark.svg" alt={alt} width={1600} height={1010} loading="lazy" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="arch-img arch-light" src="/architecture-light.svg" alt="" aria-hidden="true" width={1600} height={1010} loading="lazy" decoding="async" />
      </div>
      {caption ? <figcaption className="t-small ink-3">Dashed lines carry data; brass lines are signed posts on chain. The same file is in the README: <a href="https://github.com/Franlinozz/Kerb/blob/main/scripts/architecture-svg.py" target="_blank" rel="noreferrer">scripts/architecture-svg.py</a>.</figcaption> : null}
    </figure>
  );
}
