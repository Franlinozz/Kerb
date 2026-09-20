import { describe, expect, it } from "vitest";
import { encodeFunctionData, parseAbi, type Hex } from "viem";
import { dataSuffix, decodeBuilderCode, hasBuilderCode } from "../src/builder-code.js";

const abi = parseAbi(["function postTerms(bytes32 assetId, bytes32 inputsHash)"]);

describe("ERC-8021 Builder Code attribution", () => {
  it("round-trips the code through real calldata", () => {
    const suffix = dataSuffix("kerb");
    expect(suffix).toBeDefined();
    const call = encodeFunctionData({ abi, functionName: "postTerms", args: ["0x".padEnd(66, "1") as Hex, "0x".padEnd(66, "2") as Hex] });
    const withSuffix = `${call}${(suffix as string).slice(2)}` as Hex;
    expect(decodeBuilderCode(withSuffix)).toEqual(["kerb"]);
    expect(hasBuilderCode(withSuffix, "kerb")).toBe(true);
    // The suffix is appended, so the call itself is untouched.
    expect(withSuffix.startsWith(call)).toBe(true);
  });

  it("returns no codes for calldata without a suffix", () => {
    const call = encodeFunctionData({ abi, functionName: "postTerms", args: ["0x".padEnd(66, "1") as Hex, "0x".padEnd(66, "2") as Hex] });
    expect(decodeBuilderCode(call)).toEqual([]);
    expect(hasBuilderCode(call, "kerb")).toBe(false);
  });

  it("is undefined when no code is configured, so nothing fake is attached", () => {
    expect(dataSuffix(null)).toBeUndefined();
  });

  it("decodes junk calldata without throwing", () => {
    expect(decodeBuilderCode("0x1234" as Hex)).toEqual([]);
  });
});
