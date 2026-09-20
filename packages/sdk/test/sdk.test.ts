import { describe, expect, it } from "vitest";
import { Kerb, KerbError, regimeName, toDecimalString } from "../src/index.js";

const fakeFetch = (body: unknown, status = 200): typeof globalThis.fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof globalThis.fetch;

describe("@kerb/sdk", () => {
  it("scales raw values exactly, with no floating point", () => {
    expect(toDecimalString({ raw: "14916843749", decimals: 6 })).toBe("14916.843749");
    expect(toDecimalString({ raw: "550000000000000000", decimals: 18 })).toBe("0.55");
    expect(toDecimalString({ raw: "0", decimals: 18 })).toBe("0");
    expect(toDecimalString({ raw: "1", decimals: 18 })).toBe("0.000000000000000001");
  });

  it("reads terms in five lines", async () => {
    const kerb = new Kerb({ baseUrl: "https://api.test", fetch: fakeFetch({ symbol: "KOx", usable: true, carryLTV: { raw: "550000000000000000", decimals: 18, label: "Attested" } }) });
    const terms = await kerb.terms("KOx");
    expect(terms.symbol).toBe("KOx");
    expect(terms.usable).toBe(true);
    expect(toDecimalString(terms.carryLTV)).toBe("0.55");
  });

  it("surfaces HTTP failures as KerbError with the status", async () => {
    const kerb = new Kerb({ baseUrl: "https://api.test", fetch: fakeFetch({ error: "unknown asset" }, 404) });
    await expect(kerb.terms("NOPEx")).rejects.toBeInstanceOf(KerbError);
  });

  it("maps regime indexes and rejects unknown ones", () => {
    expect(regimeName(4)).toBe("REFERENCE_CLOSED");
    expect(regimeName(3)).toBe("PRE_TRANSITION");
    expect(() => regimeName(99)).toThrow();
  });
});
