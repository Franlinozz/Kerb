"use client";

/**
 * Your positions, across every collateral in the market, in one place.
 * Renders nothing when there is nothing to show: an empty list is noise.
 */
import { useAccount } from "wagmi";
import type { CreditMarket } from "@/lib/api";
import { PositionCard } from "./PositionCard";

export function Positions({ market }: { market: CreditMarket }): React.ReactElement | null {
  const { address, isConnected } = useAccount();
  if (!isConnected || !address) return null;
  return (
    <section className="section">
      <h2>Your positions</h2>
      <p className="section-note">
        Health is measured against the fixed liquidation threshold, which does not move with the session. The
        cure deadline is what the session moves.
      </p>
      {market.collaterals.map((c) => (
        <PositionCard key={c.assetId} market={market} collateral={c} user={address} />
      ))}
      <p className="faint" style={{ fontSize: "0.8rem" }}>
        Nothing shown here means no collateral and no debt against it yet.
      </p>
    </section>
  );
}
