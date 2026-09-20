/**
 * EIP-712 signing of a KTS report. The attester key signs; it can never move funds, change
 * guardrails or unpause anything. The poster key pays gas and can do nothing else.
 */
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { requireKey } from "./chain.js";

export interface TermsStruct {
  observedAt: bigint;
  regime: number;
  creditMark: bigint;
  carryLTV: bigint;
  sessionMaxLTV: bigint;
  debtCeiling: bigint;
  maxPositionDebt: bigint;
  executableDepth1: bigint;
  inputsHash: Hex;
  engineVersion: Hex;
}

export const TERMS_TYPES = {
  TermsReport: [
    { name: "assetId", type: "bytes32" },
    { name: "observedAt", type: "uint64" },
    { name: "regime", type: "uint16" },
    { name: "creditMark", type: "uint128" },
    { name: "carryLTV", type: "uint64" },
    { name: "sessionMaxLTV", type: "uint64" },
    { name: "debtCeiling", type: "uint128" },
    { name: "maxPositionDebt", type: "uint128" },
    { name: "executableDepth1", type: "uint128" },
    { name: "inputsHash", type: "bytes32" },
    { name: "engineVersion", type: "bytes32" },
  ],
} as const;

export function attesterAccount() {
  return privateKeyToAccount(requireKey("KERB_ATTESTER_KEY"));
}

export async function signTerms(chainId: number, verifyingContract: Address, assetId: Hex, t: TermsStruct): Promise<Hex> {
  return attesterAccount().signTypedData({
    domain: { name: "Kerb Terms", version: "0.1", chainId, verifyingContract },
    types: TERMS_TYPES,
    primaryType: "TermsReport",
    message: { assetId, ...t },
  });
}
