/**
 * The credit plane, read side. Everything a market UI needs to show a position honestly:
 * the market's own state, the terms it is acting on, and for a given address the position,
 * its health against the FIXED liquidation threshold, and its covenant status.
 *
 * Read straight from chain rather than from the indexer, because a borrower deciding whether
 * to repay must not be shown a number that is one block behind.
 */
import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";
import { publicClient, loadAssets, resolvedAssets } from "@kerb/adapters";
import { loadDeployments } from "@kerb/attester";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";

const abiOf = (name: string): readonly unknown[] =>
  (JSON.parse(readFileSync(resolve(repoRoot(), `contracts/out/${name}.sol/${name}.json`), "utf8")) as { abi: unknown[] })
    .abi;

export const assetIdOf = (chainId: number, token: Address): Hex =>
  keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [BigInt(chainId), token]));

export interface CreditCollateral {
  key: string;
  mirrors: string;
  token: Address;
  assetId: Hex;
  tokenDecimals: number;
  /** Fixed at listing. Never moves with the session. */
  liquidationThreshold: string;
  closeFactor: string;
  cureBonus: string;
  defaultBonus: string;
  terms: {
    carryLTV: string;
    sessionMaxLTV: string;
    creditMark: string;
    regime: number;
    usable: boolean;
    debtCeiling: string;
    maxPositionDebt: string;
    observedAt: string | null;
  };
  /** The real mainnet asset whose Credit Mark is relayed onto this mirror. */
  relayedFrom: { symbol: string; chainId: number; token: Address } | null;
}

export interface CreditMarket {
  chainId: number;
  contracts: {
    KerbCredit: Address | null;
    KerbTerms: Address | null;
    clock: Address | null;
    clockIsDemo: boolean;
    loanAsset: Address | null;
  };
  loanAsset: { symbol: string; decimals: number; isMock: boolean; standsInFor: Address | null };
  pool: {
    totalSupplied: string;
    totalDebt: string;
    reserves: string;
    utilisation: string;
    borrowRate: string;
    available: string;
  };
  collaterals: CreditCollateral[];
  /** Testnet mirror collateral has no claim on any security. Said here so a UI cannot omit it. */
  disclaimer: string;
}

const DISCLAIMER =
  "The credit plane runs on X Layer testnet with mirror collateral. Mirror tokens have no claim on any security. The risk data underneath them is the real mainnet Credit Mark for the underlying.";

export async function buildCreditMarket(chainId: number): Promise<CreditMarket | null> {
  const d = loadDeployments();
  const credit = d[`${chainId}:KerbCredit`]?.address;
  const terms = d[`${chainId}:KerbTerms`]?.address;
  if (!credit || !terms) return null;

  const client = publicClient(chainId as 196 | 1952);
  const creditAbi = abiOf("KerbCredit");
  const termsAbi = abiOf("KerbTerms");

  const read = async <T>(address: Address, abi: readonly unknown[], functionName: string, args: unknown[] = []): Promise<T> =>
    (await client.readContract({ address, abi, functionName, args } as never)) as T;

  const [loanAsset, totalSupplied, totalDebt, reserves, utilisation, borrowRate, clock] = await Promise.all([
    read<Address>(credit, creditAbi, "loanAsset"),
    read<bigint>(credit, creditAbi, "totalSuppliedAssets"),
    read<bigint>(credit, creditAbi, "totalDebtAssets"),
    read<bigint>(credit, creditAbi, "reserves"),
    read<bigint>(credit, creditAbi, "utilisation"),
    read<bigint>(credit, creditAbi, "borrowRate"),
    read<Address>(credit, creditAbi, "clock"),
  ]);

  // A demo clock must announce itself, and the UI must be able to badge it.
  let clockIsDemo = false;
  try {
    clockIsDemo = await read<boolean>(clock, abiOf("KerbClockDemo"), "isDemo");
  } catch {
    clockIsDemo = false;
  }

  const isMock = loanAsset.toLowerCase() === (d[`${chainId}:MockUSDG`]?.address ?? "").toLowerCase();
  let standsInFor: Address | null = null;
  if (isMock) {
    try {
      standsInFor = await read<Address>(loanAsset, abiOf("MockUSDG"), "STANDS_IN_FOR");
    } catch {
      standsInFor = null;
    }
  }

  const cfg = loadAssets();
  const mainnetAssets = resolvedAssets(cfg);

  const collaterals: CreditCollateral[] = [];
  for (const [key, dep] of Object.entries(d)) {
    if (!key.startsWith(`${chainId}:KerbMirror`)) continue;
    const token = dep.address;
    const assetId = assetIdOf(chainId, token);
    const c = await read<{
      tokenDecimals: number; liquidationThreshold: bigint; closeFactor: bigint;
      cureBonus: bigint; defaultBonus: bigint; listed: boolean;
    }>(credit, creditAbi, "collateral", [assetId]);
    if (!c.listed) continue;

    const eff = await read<[bigint, bigint, bigint, number, boolean]>(terms, termsAbi, "effectiveTerms", [assetId]);
    const latest = await read<{ debtCeiling: bigint; maxPositionDebt: bigint; observedAt: bigint }>(
      terms, termsAbi, "latest", [assetId],
    );
    const mirrors = (dep.args?.[0] as string) ?? key.split(":")[2] ?? "";
    const source = mainnetAssets.find((a) => a.symbol === mirrors);

    collaterals.push({
      key,
      mirrors,
      token,
      assetId,
      tokenDecimals: c.tokenDecimals,
      liquidationThreshold: c.liquidationThreshold.toString(),
      closeFactor: c.closeFactor.toString(),
      cureBonus: c.cureBonus.toString(),
      defaultBonus: c.defaultBonus.toString(),
      terms: {
        carryLTV: eff[0].toString(),
        sessionMaxLTV: eff[1].toString(),
        creditMark: eff[2].toString(),
        regime: eff[3],
        usable: eff[4],
        debtCeiling: latest.debtCeiling.toString(),
        maxPositionDebt: latest.maxPositionDebt.toString(),
        observedAt: latest.observedAt === 0n ? null : new Date(Number(latest.observedAt) * 1000).toISOString(),
      },
      relayedFrom: source ? { symbol: source.symbol, chainId: 196, token: source.token.address as Address } : null,
    });
  }

  return {
    chainId,
    contracts: {
      KerbCredit: credit,
      KerbTerms: terms,
      clock,
      clockIsDemo,
      loanAsset,
    },
    loanAsset: { symbol: isMock ? "mUSDG" : "USDG", decimals: 6, isMock, standsInFor },
    pool: {
      totalSupplied: totalSupplied.toString(),
      totalDebt: totalDebt.toString(),
      reserves: reserves.toString(),
      utilisation: utilisation.toString(),
      borrowRate: borrowRate.toString(),
      available: (totalSupplied - totalDebt).toString(),
    },
    collaterals,
    disclaimer: DISCLAIMER,
  };
}

export interface CreditPosition {
  user: Address;
  assetId: Hex;
  collateralShares: string;
  debt: string;
  positionLTV: string | null;
  healthFactor: string | null;
  carryTarget: string;
  mode: number;
  modeName: "Carry" | "Session Max";
  cure: { eligible: boolean; deadline: string | null; requiredRepay: string };
}

export async function buildCreditPosition(chainId: number, user: Address, assetId: Hex): Promise<CreditPosition | null> {
  const d = loadDeployments();
  const credit = d[`${chainId}:KerbCredit`]?.address;
  if (!credit) return null;
  const client = publicClient(chainId as 196 | 1952);
  const creditAbi = abiOf("KerbCredit");

  const read = async <T>(functionName: string, args: unknown[]): Promise<T> =>
    (await client.readContract({ address: credit, abi: creditAbi, functionName, args } as never)) as T;

  const p = await read<{ collateralShares: bigint; debtShares: bigint; carryTarget: bigint; mode: number }>(
    "position", [user, assetId],
  );
  const debt = await read<bigint>("debtOf", [user, assetId]);

  // These revert when there is no mark to price against, which is a real answer, not a zero.
  let ltv: string | null = null;
  let hf: string | null = null;
  try {
    ltv = (await read<bigint>("positionLTV", [user, assetId])).toString();
    hf = (await read<bigint>("healthFactor", [user, assetId])).toString();
  } catch {
    ltv = null;
    hf = null;
  }

  const [eligible, deadline, requiredRepay] = await read<[boolean, bigint, bigint]>("cureStatus", [user, assetId]);

  return {
    user,
    assetId,
    collateralShares: p.collateralShares.toString(),
    debt: debt.toString(),
    positionLTV: ltv,
    healthFactor: hf,
    carryTarget: p.carryTarget.toString(),
    mode: p.mode,
    modeName: p.mode === 1 ? "Session Max" : "Carry",
    cure: {
      eligible,
      deadline: deadline === 0n ? null : new Date(Number(deadline) * 1000).toISOString(),
      requiredRepay: requiredRepay.toString(),
    },
  };
}
