/**
 * "Why these terms" (V3-04, SPEC-TERM-ATTRIBUTION.md section 8): the three sentences the API
 * computes from the latest post's own input bundle, each with its ProvMark to that bundle. Never
 * written by hand: when the bundle cannot be read the block says so instead.
 */
import { ProvMark } from "@/components/ui/ProvMark";
import { PUBLIC_API, type Why, type WhyField } from "@/lib/api";

const TITLE: Record<WhyField, string> = { carryLTV: "Carry", sessionMaxLTV: "Session Max", debtCeiling: "Debt ceiling" };

export function WhyTerms({ why, only }: { why: Why | null; only?: WhyField[] }): React.ReactElement {
  if (!why) return <p className="t-small ink-3">The explanation of these terms could not be read right now.</p>;
  const rows = (why.sentences ?? []).filter((s) => !only || only.includes(s.field));
  if (!rows.length) return <p className="t-small ink-3">{why.note ?? "No explanation for these terms yet."}</p>;
  const source = `Computed from input bundle ${why.inputsHash.slice(0, 10)}, posted in ${why.tx.slice(0, 10)} (KTS ${why.kts})`;
  return (
    <ul className="why-list">
      {rows.map((s) => (
        <li key={s.field}>
          {only?.length === 1 ? null : <span className="t-label">{TITLE[s.field]}</span>}
          <p>{s.sentence} <ProvMark label="Computed" source={source} observedAt={why.asOf} href={`${PUBLIC_API}/v1/bundle/${why.inputsHash}`} hrefLabel="The input bundle" /></p>
        </li>
      ))}
    </ul>
  );
}
