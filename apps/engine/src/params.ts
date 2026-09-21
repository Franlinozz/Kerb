import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import type { DecString } from "@kerb/types";
import type { EngineConfig } from "./report.js";
import type { Guardrails } from "./capacity.js";
import type { StressConfig } from "./stress.js";

export interface ParamsFile {
  /** The formula version new bundles are built under. Verification reads it from each bundle. */
  kts: "0.1" | "0.2";
  paramsVersion: string;
  depth: EngineConfig["depth"] & { impactTargets: DecString[] };
  mark: EngineConfig["mark"];
  regime: Omit<EngineConfig["regime"], "cureWindowSec">;
  asymmetry: EngineConfig["asymmetry"];
  capacityDefaults: EngineConfig["capacity"];
  stress: StressConfig;
  guardrails: { default: Guardrails; assets: Record<string, Guardrails> };
}

export function loadParams(path = resolve(repoRoot(), "config/kts-params.json")): ParamsFile {
  return JSON.parse(readFileSync(path, "utf8")) as ParamsFile;
}

export function guardrailsFor(p: ParamsFile, symbol: string): Guardrails {
  return p.guardrails.assets[symbol] ?? p.guardrails.default;
}

export function engineConfig(p: ParamsFile, symbol: string, cureWindowSec: number): EngineConfig {
  return {
    mark: p.mark,
    regime: { ...p.regime, cureWindowSec },
    capacity: p.capacityDefaults,
    asymmetry: p.asymmetry,
    depth: p.depth,
    guardrails: guardrailsFor(p, symbol),
  };
}

/**
 * The engine configuration a bundle was built under, read from the bundle itself. Verification
 * uses this rather than the parameter file on disk, so a report stays reproducible after the
 * parameters move on (KTS-0.2 section 6).
 */
export function engineConfigFromBundle(b: { config: Record<string, unknown>; market: { cureWindowSec: number } }): EngineConfig {
  const c = b.config as unknown as {
    mark: EngineConfig["mark"];
    regime: Omit<EngineConfig["regime"], "cureWindowSec">;
    capacity: EngineConfig["capacity"];
    asymmetry: EngineConfig["asymmetry"];
    depth: EngineConfig["depth"];
    guardrails: Guardrails;
  };
  for (const k of ["mark", "regime", "capacity", "asymmetry", "depth", "guardrails"] as const) {
    if (c[k] === undefined) throw new Error(`bundle config is missing ${k}`);
  }
  return {
    mark: c.mark,
    regime: { ...c.regime, cureWindowSec: b.market.cureWindowSec },
    capacity: c.capacity,
    asymmetry: c.asymmetry,
    depth: c.depth,
    guardrails: c.guardrails,
  };
}
