import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BaseError, ContractFunctionRevertedError, encodeErrorResult } from "viem";
import { KERB_ERRORS_ABI } from "../src/lib/creditAbi";
import { CONTRACT_ERROR_SENTENCES, mapTxError, mapWalletError } from "../src/lib/errors";

const src = (f: string): string => readFileSync(resolve(__dirname, "../../../contracts/src", f), "utf8");
const declared = new Set(
  ["KerbCredit.sol", "KerbMirror.sol", "MockUSDG.sol"].flatMap((f) => [...src(f).matchAll(/^\s*error\s+(\w+)\(/gm)].map((m) => m[1] as string)),
);

/** What viem throws when a simulated call reverts with one of our errors. */
function reverted(errorName: string, args: readonly unknown[]): BaseError {
  const data = encodeErrorResult({ abi: KERB_ERRORS_ABI, errorName, args } as never);
  return new BaseError("call reverted", { cause: new ContractFunctionRevertedError({ abi: KERB_ERRORS_ABI as never, data, functionName: "borrow" }) });
}

describe("error map", () => {
  it("has a sentence for every custom error the contracts can revert with", () => {
    for (const name of declared) expect(CONTRACT_ERROR_SENTENCES[name], name).toBeTypeOf("function");
    expect(declared.size).toBeGreaterThanOrEqual(20);
  });

  it("every declared error is in the ABI the UI decodes with", () => {
    const inAbi = new Set(KERB_ERRORS_ABI.map((e) => e.name));
    for (const name of declared) expect(inAbi.has(name as never), name).toBe(true);
  });

  it.each([
    ["ExceedsModeLTV", [579_000_000_000_000_000n, 556_000_000_000_000_000n], "This would take the position to 57.9% against a Session Max limit of 55.6%."],
    ["TermsUnusable", [`0x${"11".repeat(32)}`, 7], "New borrowing is paused: the latest terms for this asset are not usable (stale). Repay and cure still work."],
    ["FaucetCapExceeded", [5_000_000_000_000_000_000n, 1_250_000_000_000_000_000n], "This address has used its faucet allowance (1.25 kKOx left)."],
    ["InsufficientLiquidity", [90_000_000_000n, 77_283_570_000n], "The pool has 77,283.57 mUSDG available and this needs 90,000.00 mUSDG."],
    ["CureTooLarge", [500_000_000n, 486_220_000n], "A cure can repay at most 486.22 mUSDG right now and 500.00 was sent. The position moved between reading and signing; try again."],
  ] as const)("%s decodes its numbers into the sentence", (name, args, sentence) => {
    const m = mapTxError(reverted(name, args), { mode: "Session Max", tokenSymbol: "kKOx", tokenDecimals: 18 });
    expect(m.kind).toBe("contract");
    expect(m.message).toBe(sentence);
    expect(m.message).not.toMatch(/0x|Error\(|revert/i);
  });

  it("a user rejection is a cancellation, not an error", () => {
    const e = Object.assign(new Error("User rejected the request."), { code: 4001 });
    expect(mapWalletError(e)).toMatchObject({ kind: "cancelled", title: "Connection cancelled" });
    expect(mapTxError(e).kind).toBe("cancelled");
  });

  it("anything unknown becomes a plain sentence, never the raw text", () => {
    const m = mapWalletError(new Error("TypeError: cannot read properties of undefined (reading 'request') at viem/_esm/..."));
    expect(m.message).toBe("Could not connect. Try again or use another wallet.");
    expect(mapTxError(new Error("HTTP request failed. URL: https://testrpc.xlayer.tech")).message).not.toContain("http");
  });
});
