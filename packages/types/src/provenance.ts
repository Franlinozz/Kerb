/** AGENTS.md section 2.3 and ARCHITECTURE.md section 6. A number without one of these does not ship. */
export const PROVENANCE_LABELS = ["Verified", "Observed", "Attested", "Computed"] as const;
export type ProvenanceLabel = (typeof PROVENANCE_LABELS)[number];

export interface Provenance {
  label: ProvenanceLabel;
  /** Named source id, e.g. "xlayer:uniswap-v3:0x...", "xstocks:price-data", "pyth:hermes". */
  source: string;
  /** ISO-8601 UTC timestamp of the observation or computation. */
  at: string;
  /** keccak256 of the raw payload or input bundle. */
  contentHash?: `0x${string}`;
}

export interface Labelled<T> {
  value: T;
  provenance: Provenance;
}
