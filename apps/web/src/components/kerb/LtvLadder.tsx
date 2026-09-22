/**
 * The LTV ladder (V2-DESIGN-SYSTEM.md section 9), the signature data visual: a 0 to 100% scale,
 * a filled bar to Carry, a hatched extension to Session Max, an oxide rule at the fixed
 * liquidation threshold and, when a position exists, a brass diamond at its LTV. Under it, one
 * line saying why the margin is what it is (KTS-0.2) or that it is fixed (KTS-0.1).
 */
import type { BoardMargins } from "@/lib/api";
import { ltv, round, shift } from "@/lib/format";

const pctOf = (v: string): number => Math.max(0, Math.min(100, Number(shift(v, 2)))); // geometry only, never a value

function horizonWords(iso: string): string {
  const d = new Date(iso);
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${d.toISOString().slice(11, 16)} UTC`;
}

export function marginSentence(kts: "0.1" | "0.2" | null | undefined, margins: BoardMargins | null | undefined): string {
  if (kts === "0.2" && margins) {
    return `Margin below the fixed line: ${margins.stressMultiplier} × the stressed gap to ${horizonWords(margins.carry.horizonEndsAt)}, plus ${round(shift(margins.carry.exitCost, 2), 1)}% exit cost.`;
  }
  if (kts === "0.2") return "Under KTS 0.2 each margin below the fixed line follows the time its mode must survive: Carry to the next deep market, Session Max to the next Last Call.";
  return "In KTS-0.1 the Carry to Session Max margin is fixed. What moves with market time is the debt ceiling, through measured depth, and the cure deadline.";
}

export function LtvLadder({ carry, session, lt, position, kts, margins, compact = false, label, why = true }: {
  carry: string | null; session: string | null; lt: string | null; position?: string | null;
  kts?: "0.1" | "0.2" | null; margins?: BoardMargins | null; compact?: boolean; label?: string; why?: boolean;
}): React.ReactElement {
  if (carry === null || session === null || lt === null) {
    return <span className="ink-3 t-small">Not yet posted</span>;
  }
  const c = pctOf(carry), s = pctOf(session), l = pctOf(lt);
  const p = position ? pctOf(position) : null;
  const desc = `Carry ${ltv(carry)}, Session Max ${ltv(session)}, liquidation ${ltv(lt)} fixed${position ? `, position at ${ltv(position)}` : ""}.`;
  if (compact) {
    return (
      <span className="ladder-mini" role="img" aria-label={label ? `${label}: ${desc}` : desc}>
        <span className="ladder-fill" style={{ width: `${c}%` }} />
        <span className="ladder-hatch" style={{ left: `${c}%`, width: `${Math.max(0, s - c)}%` }} />
        <span className="ladder-lt" style={{ left: `${l}%` }} />
        {p !== null ? <span className="ladder-dia" style={{ left: `${p}%` }} /> : null}
      </span>
    );
  }
  const close = s - c < 9;
  return (
    <figure className="ladder" aria-label={desc}>
      <div className="ladder-scale" role="img" aria-label={desc}>
        <span className="ladder-fill" style={{ width: `${c}%` }} />
        <span className="ladder-hatch" style={{ left: `${c}%`, width: `${Math.max(0, s - c)}%` }} />
        <span className="ladder-lt" style={{ left: `${l}%` }} />
        {p !== null ? <span className="ladder-dia" style={{ left: `${p}%` }} /> : null}
      </div>
      <div className="ladder-marks" aria-hidden="true">
        <span className="ladder-mark ladder-mark-carry" style={{ left: `${c}%` }}>CARRY<b>{ltv(carry)}</b></span>
        <span className={`ladder-mark ladder-mark-session${close ? " ladder-mark-low" : ""}`} style={{ left: `${s}%` }}>SESSION MAX <b>{ltv(session)}</b></span>
        <span className="ladder-mark ladder-mark-lt" style={{ left: `${l}%` }}>LIQUIDATION<b>{ltv(lt)} · FIXED</b></span>
        {p !== null && position ? <span className="ladder-mark ladder-mark-pos" style={{ left: `${p}%` }}>YOU<b>{ltv(position)}</b></span> : null}
      </div>
      {why ? <figcaption className="ladder-why">{marginSentence(kts, margins)}</figcaption> : null}
    </figure>
  );
}
