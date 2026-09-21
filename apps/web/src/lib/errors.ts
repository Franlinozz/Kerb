/**
 * The error map (AGENTS.md 12.4 rule 6). No raw library, RPC or contract error text is ever
 * rendered: wallet failures and every KerbCredit, KerbMirror and MockUSDG custom error become a
 * sentence with its numbers decoded. The raw error goes to the console for whoever debugs it.
 */
import { BaseError, ContractFunctionRevertedError, decodeErrorResult, type Hex } from "viem";
import { KERB_ERRORS_ABI } from "./creditAbi";
import { REGIME_BY_INDEX } from "./api";

const WAD = 10n ** 18n;

function fixed(v: bigint, decimals: number, places: number): string {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const scaleUp = 10n ** BigInt(places);
  const q = (a * scaleUp + 10n ** BigInt(decimals) / 2n) / 10n ** BigInt(decimals);
  const whole = q / scaleUp;
  const frac = (q % scaleUp).toString().padStart(places, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${places ? `.${frac}` : ""}`;
}
const pct = (wad: unknown): string => fixed(BigInt(wad as bigint) * 100n, 18, 1);
const usd = (units: unknown, decimals = 6): string => fixed(BigInt(units as bigint), decimals, 2);
const hf = (wad: unknown): string => (BigInt(wad as bigint) > WAD * 1000n ? "above 1,000" : fixed(BigInt(wad as bigint), 18, 2));

export interface ErrorContext {
  /** "Carry" or "Session Max", when the action knows it. */
  mode?: string;
  /** Loan asset symbol, default mUSDG. */
  loanSymbol?: string;
  /** Decimals of the token a faucet or collateral amount is in. */
  tokenDecimals?: number;
  tokenSymbol?: string;
}

type Sentence = (args: readonly unknown[], ctx: ErrorContext) => string;
const L = (ctx: ErrorContext): string => ctx.loanSymbol ?? "mUSDG";

export const CONTRACT_ERROR_SENTENCES: Record<string, Sentence> = {
  ExceedsModeLTV: ([ltv, ceiling], ctx) => `This would take the position to ${pct(ltv)}% against a ${ctx.mode ?? "mode"} limit of ${pct(ceiling)}%.`,
  ExceedsDebtCeiling: ([debt, ceiling], ctx) => `This would take borrowing against this asset to ${usd(debt)} ${L(ctx)}, above its debt ceiling of ${usd(ceiling)} ${L(ctx)}. The ceiling follows measured exit depth.`,
  ExceedsPositionCap: ([debt, cap], ctx) => `This position would owe ${usd(debt)} ${L(ctx)}. One position may owe at most ${usd(cap)} ${L(ctx)}.`,
  InsufficientLiquidity: ([requested, available], ctx) => `The pool has ${usd(available)} ${L(ctx)} available and this needs ${usd(requested)} ${L(ctx)}.`,
  PositionUnsafe: ([h]) => `This would leave the position with a health factor of ${hf(h)}, below 1. Nothing was changed.`,
  TermsUnusable: ([, regime]) => `New borrowing is paused: the latest terms for this asset are not usable (${regimeWord(regime)}). Repay and cure still work.`,
  CureWindowClosed: () => "Last Call is not open for this asset, so nothing can be cured right now. Nothing was changed.",
  NotCurable: ([ltv, target]) => `This position is at ${pct(ltv)}%, at or below its ${pct(target)}% Carry target, so there is nothing to cure.`,
  CureTooLarge: ([requested, allowed], ctx) => `A cure can repay at most ${usd(allowed)} ${L(ctx)} right now and ${usd(requested)} was sent. The position moved between reading and signing; try again.`,
  NotLiquidatable: ([h]) => `This position has a health factor of ${hf(h)}, so it cannot be liquidated.`,
  CloseFactorExceeded: ([requested, allowed], ctx) => `One liquidation can repay at most ${usd(allowed)} ${L(ctx)}; this asked for ${usd(requested)} ${L(ctx)}.`,
  InsufficientCollateral: ([needed, held], ctx) => `This needs ${fixed(BigInt(needed as bigint), ctx.tokenDecimals ?? 18, 4)} of collateral and the position holds ${fixed(BigInt(held as bigint), ctx.tokenDecimals ?? 18, 4)}.`,
  MarkUnavailable: () => "There is no usable Credit Mark for this asset right now, so it cannot be valued. Repay still works.",
  BorrowPaused: () => "New borrowing is paused by the guardian. Repay, cure and withdrawals to safety still work.",
  DepositPaused: () => "New deposits are paused by the guardian. Nothing was changed.",
  FaucetCapExceeded: ([, remaining], ctx) => `This address has used its faucet allowance (${fixed(BigInt(remaining as bigint), ctx.tokenDecimals ?? 18, 2)}${ctx.tokenSymbol ? ` ${ctx.tokenSymbol}` : ""} left).`,
  ZeroAmount: () => "Enter an amount above zero.",
  NoDebt: () => "This position has no debt to repay or cure.",
  UnknownCollateral: () => "This collateral is not listed on Kerb Credit.",
  BadMode: () => "That credit mode does not exist. Choose Carry or Session Max.",
  NotAdmin: () => "Only the Kerb admin can do this.",
  NotGuardian: () => "Only the Kerb guardian can do this.",
  ZeroAddress: () => "That address is empty.",
  AlreadyListed: () => "This collateral is already listed.",
  MathOverflow: () => "That amount is too large for the contract to handle.",
};

function regimeWord(regime: unknown): string {
  const name = REGIME_BY_INDEX[Number(regime)];
  const words: Record<string, string> = { STALE: "stale", HALTED: "halted", ACTION: "corporate action", REFERENCE_CLOSED: "reference closed", PRE_TRANSITION: "Last Call", THIN: "thin", NORMAL: "normal", DEEP: "deep", RECOVERY: "recovering" };
  return name ? (words[name] ?? name.toLowerCase()) : "unknown regime";
}

/** Pull a custom error name and args out of whatever viem or the wallet threw. */
export function decodeContractError(err: unknown): { name: string; args: readonly unknown[] } | null {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (reverted?.data?.errorName) return { name: reverted.data.errorName, args: reverted.data.args ?? [] };
    const raw = reverted?.raw ?? (err.walk((e) => typeof (e as { data?: unknown }).data === "string") as { data?: Hex } | null)?.data;
    if (typeof raw === "string" && raw.startsWith("0x") && raw.length >= 10) {
      try {
        const d = decodeErrorResult({ abi: KERB_ERRORS_ABI, data: raw as Hex });
        return { name: d.errorName, args: (d.args ?? []) as readonly unknown[] };
      } catch { /* not one of ours */ }
    }
  }
  const text = err instanceof Error ? err.message : String(err);
  const m = /\b([A-Z][A-Za-z]+)\(/.exec(text);
  if (m && m[1] && CONTRACT_ERROR_SENTENCES[m[1]]) return { name: m[1], args: [] };
  return null;
}

const isRejection = (err: unknown): boolean => {
  const code = (err as { code?: number; cause?: { code?: number } })?.code ?? (err as { cause?: { code?: number } })?.cause?.code;
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return code === 4001 || /UserRejected|User rejected|User denied|rejected the request|request rejected|cancel/i.test(text);
};

export type ErrorKind = "cancelled" | "no-provider" | "wrong-chain" | "gas" | "contract" | "unknown";
export interface MappedError { kind: ErrorKind; title: string; message: string }

/** Wallet connection errors. */
export function mapWalletError(err: unknown): MappedError {
  console.error("[kerb] wallet", err);
  if (isRejection(err)) return { kind: "cancelled", title: "Connection cancelled", message: "Nothing was connected." };
  const text = err instanceof Error ? err.message : String(err);
  if (/ProviderNotFound|provider not found|no provider|window\.ethereum/i.test(text)) {
    return { kind: "no-provider", title: "No browser wallet found", message: "Install OKX Wallet or MetaMask, then try again." };
  }
  return { kind: "unknown", title: "Could not connect", message: "Could not connect. Try again or use another wallet." };
}

/** Transaction errors, with the action's context for the numbers. */
export function mapTxError(err: unknown, ctx: ErrorContext = {}): MappedError {
  console.error("[kerb] transaction", err);
  if (isRejection(err)) return { kind: "cancelled", title: "Transaction cancelled", message: "You cancelled it in your wallet. Nothing was sent." };
  const decoded = decodeContractError(err);
  if (decoded) {
    const s = CONTRACT_ERROR_SENTENCES[decoded.name];
    let message = "The contract refused this transaction. Nothing was changed.";
    if (s) { try { message = s(decoded.args, ctx); } catch { /* args missing: keep the general sentence */ } }
    return { kind: "contract", title: "Not sent: the contract refused it", message };
  }
  const text = err instanceof Error ? err.message : String(err);
  if (/insufficient funds|exceeds balance|gas required exceeds/i.test(text)) {
    return { kind: "gas", title: "Not enough test OKB", message: "This account needs a little test OKB for gas on X Layer testnet." };
  }
  if (/chain mismatch|does not match the target chain|ChainMismatch|switch chain/i.test(text)) {
    return { kind: "wrong-chain", title: "Wrong network", message: "Your wallet is on another network. Switch to X Layer testnet (1952)." };
  }
  return { kind: "unknown", title: "Transaction failed", message: "The transaction did not go through. Nothing was changed. Try again in a moment." };
}
