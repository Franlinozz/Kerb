import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import type { DecString } from "@kerb/types";
import type { EngineConfig } from "./report.js";
import type { Guardrails } from "./capacity.js";
import type { StressConfig } from "./stress.js";

export interface ParamsFile {
  kts: "0.1";
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
