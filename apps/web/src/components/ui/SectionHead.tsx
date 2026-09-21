import type { ReactNode } from "react";

/** Crosshair, rule, tracked label left, tracked annotation right, h2 below (section 5). */
export function SectionHead({ label, annotation, title, lede, id }: { label: string; annotation?: ReactNode; title?: ReactNode; lede?: ReactNode; id?: string }): React.ReactElement {
  return (
    <div className="section-head" id={id}>
      <span className="cross" aria-hidden="true" />
      <div className="section-head-row">
        <span className="t-label">{label}</span>
        {annotation ? <span className="t-label ink-3">{annotation}</span> : null}
      </div>
      {title ? <h2>{title}</h2> : null}
      {lede ? <p className="lede-s">{lede}</p> : null}
    </div>
  );
}
