import { parseAbiItem } from "viem";

/** The events Kerb indexes. KerbClock has no RegimeChanged event: regime transitions are
 *  derived from consecutive TermsPosted rows, which is the only place a regime is decided. */
export const TERMS_POSTED = parseAbiItem(
  "event TermsPosted(bytes32 indexed assetId, address indexed attester, uint64 observedAt, uint16 regime, uint128 creditMark, uint64 carryLTV, uint64 sessionMaxLTV, uint128 debtCeiling, uint128 executableDepth1, bytes32 inputsHash)",
);
export const GUARDRAILS_UPDATED = parseAbiItem(
  "event GuardrailsUpdated(bytes32 indexed assetId, (uint64,uint64,uint128,uint128,uint64,uint32,uint32,uint64,bool) guardrails)",
);
export const HALT_SET = parseAbiItem("event HaltSet(bytes32 indexed assetId, bool halted, uint64 expiry)");
export const ASSET_MARKET_SET = parseAbiItem("event AssetMarketSet(bytes32 indexed assetId, bytes8 indexed marketCode, uint32 cureWindowSec)");
