"use client";

/**
 * Read any position on the credit market. Cure is permissionless, so a curer must be able to see
 * what a position owes and what it would take to bring it back to target, without a wallet and
 * without asking anyone.
 */
import { useState } from "react";
import type { CreditPosition } from "@/lib/api";
import { duration, group, round, scale, shift, utcStamp } from "@/lib/format";
import { Prov } from "./Value";

const pct = (raw: string | null, places = 2): string =>
  raw === null ? "No debt" : `${round(shift(scale(raw, 18), 2), places)}%`;

export function PositionLookup({ collaterals, chainId, loanDecimals, loanSymbol }: {
  collaterals: { assetId: string; label: string }[];
  chainId: number;
  loanDecimals: number;
  loanSymbol: string;
}): React.ReactElement {
  const [address, setAddress] = useState("");
  const [assetId, setAssetId] = useState(collaterals[0]?.assetId ?? "");
  const [state, setState] = useState<{ status: "idle" | "loading" | "error" | "done"; error?: string; data?: CreditPosition }>({
    status: "idle",
  });

  const look = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
      setState({ status: "error", error: "That is not an address. It should be 0x followed by 40 hex characters." });
      return;
    }
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/credit/${chainId}/position/${address.trim()}/${assetId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState({ status: "error", error: body.error ?? `the lookup returned ${res.status}` });
        return;
      }
      setState({ status: "done", data: (await res.json()) as CreditPosition });
    } catch (err) {
      setState({ status: "error", error: err instanceof Error ? err.message : "the lookup failed" });
    }
  };

  const p = state.data;
  const healthy = p?.healthFactor !== null && p?.healthFactor !== undefined && BigInt(p.healthFactor) >= 10n ** 18n;

  return (
    <>
      <form onSubmit={look} className="lookup">
        <label>
          <span className="faint">Address</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            className="mono"
            aria-label="Address to look up"
          />
        </label>
        {collaterals.length > 1 ? (
          <label>
            <span className="faint">Collateral</span>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)} aria-label="Collateral">
              {collaterals.map((c) => (
                <option key={c.assetId} value={c.assetId}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" disabled={state.status === "loading"}>
          {state.status === "loading" ? "Looking up…" : "Look up"}
        </button>
      </form>

      {state.status === "error" ? (
        <div className="callout callout-danger" role="alert">
          {state.error}
        </div>
      ) : null}

      {state.status === "done" && p ? (
        p.collateralShares === "0" && p.debt === "0" ? (
          <div className="empty">This address holds no position in this market.</div>
        ) : (
          <dl>
            <div className="field">
              <dt>Collateral</dt>
              <dd>
                {group(round(scale(p.collateralShares, 18), 6))} <Prov label="Verified" />
              </dd>
            </div>
            <div className="field">
              <dt>Debt</dt>
              <dd>
                {group(round(scale(p.debt, loanDecimals), 6))} {loanSymbol} <Prov label="Verified" />
              </dd>
            </div>
            <div className="field">
              <dt>Position LTV</dt>
              <dd>
                {pct(p.positionLTV)} <Prov label="Computed" />
                <div className="faint field-note">Covenant target {pct(p.carryTarget)}, drawn in {p.modeName} mode.</div>
              </dd>
            </div>
            <div className="field">
              <dt>Health</dt>
              <dd>
                {p.healthFactor === null ? (
                  <span className="faint">no mark to price against</span>
                ) : (
                  <>
                    {round(scale(p.healthFactor, 18), 4)} <Prov label="Computed" />
                    {healthy ? null : <span className="badge badge-danger" style={{ marginLeft: 8 }}>liquidatable</span>}
                  </>
                )}
                <div className="faint field-note">Against the fixed liquidation threshold. Below 1 the position may be liquidated.</div>
              </dd>
            </div>
            <div className="field">
              <dt>Cure</dt>
              <dd>
                {p.cure.eligible ? (
                  <>
                    <span className="badge badge-warn">curable now</span>{" "}
                    {group(round(scale(p.cure.requiredRepay, loanDecimals), 6))} {loanSymbol} would bring it to target
                  </>
                ) : p.cure.requiredRepay === "0" ? (
                  "at or below target, nothing to cure"
                ) : (
                  <>
                    not yet: the Last Call window is closed. {group(round(scale(p.cure.requiredRepay, loanDecimals), 6))}{" "}
                    {loanSymbol} would be required when it opens
                  </>
                )}
                {p.cure.deadline ? (
                  <div className="faint field-note">
                    {p.cure.eligible ? "Window closes" : "Next weakening"} {utcStamp(p.cure.deadline)}
                    {" · in "}
                    {duration(Date.parse(p.cure.deadline) - Date.now())}
                  </div>
                ) : null}
              </dd>
            </div>
          </dl>
        )
      ) : null}
    </>
  );
}
