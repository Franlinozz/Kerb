#!/usr/bin/env python3
"""Regenerate docs/API.md: every endpoint with one real response captured from production.
Arrays are cut to their first items and long strings shortened, and the doc says so; nothing is
invented. Usage: python3 scripts/api-doc.py [base-url]"""
import json, sys, urllib.request, datetime

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://api.usekerb.xyz"

def get(path):
    with urllib.request.urlopen(BASE + path, timeout=90) as r:
        return json.loads(r.read())

def trim(o, depth=0):
    if depth >= 5 and isinstance(o, (list, dict)) and o:
        return f"... {len(o)} {'items' if isinstance(o, list) else 'fields'} omitted"
    if isinstance(o, list):
        return [trim(x, depth + 1) for x in o[:2]] + ([f"... {len(o) - 2} more"] if len(o) > 2 else [])
    if isinstance(o, dict):
        return {k: trim(v, depth + 1) for k, v in o.items()}
    if isinstance(o, str) and len(o) > 160:
        return o[:157] + "..."
    return o

board = get("/v1/board")
kox = next(r for r in board["rows"] if r["symbol"] == "KOx")
latest = get("/v1/reports")["reports"][-1]
positions = get("/v1/credit/1952/positions")
pos = positions["positions"][0] if positions["positions"] else None
bundle_hash = kox["carryLTV"].get("inputsHash")

E = [
    ("GET", "/health", "Observation freshness and post counts per chain.", "/health"),
    ("GET", "/v1/board?chain=196", "One row per asset: posted terms with provenance, the fixed LT, market, next transition, Last Call window, KTS version and margins, a 24 h C(1%) spark; plus a summary. Cache 15 s.", "/v1/board?chain=196"),
    ("GET", "/v1/terms/:chain/:asset", "Latest posted terms for one asset (symbol, token address or assetId), with the bundle link.", "/v1/terms/196/KOx"),
    ("GET", "/v1/clock/:chain/:asset?from&to", "The asset's market clock and session segments over a window (max 31 days).", "/v1/clock/196/KOx"),
    ("GET", "/v1/report/:chain/:asset", "The full KTS report recomputed now from observations: depth curve, mark, stress, capacity, margins. Cache 60 s.", "/v1/report/196/KOx"),
    ("GET", "/v1/proof", "Deployments and verification, recent posts, data coverage, pinning, limitations.", "/v1/proof"),
    ("GET", "/v1/params", "The live KTS parameter file.", "/v1/params"),
    ("GET", "/v1/tape?limit=20", "Newest Terms posts across both chains (limit 1 to 100). Cache 15 s.", "/v1/tape?limit=3"),
    ("GET", "/v1/stats", "Headline counts: observation rows, posts by chain, assets, markets, latest Market-Time Report. Cache 60 s.", "/v1/stats"),
    ("GET", "/v1/credit/:chain", "Credit market state: pool, collaterals with their fixed LT and relayed terms, disclaimer.", "/v1/credit/1952"),
    ("GET", "/v1/credit/:chain/demo-clock", "The testnet demo clock as a schedule: phase, state, next Last Call. Cache 5 s.", "/v1/credit/1952/demo-clock"),
    ("GET", "/v1/credit/:chain/positions?state=curable|all", "Every open position found from KerbCredit events, curable first, then by deadline. Cache 30 s.", "/v1/credit/1952/positions"),
    ("GET", "/v1/credit/:chain/position/:user/:assetId", "One position: debt, LTV, health against the fixed LT, covenant status.",
        f"/v1/credit/1952/position/{pos['user']}/{pos['assetId']}" if pos else None),
    ("GET", "/v1/market-time", "Published Market-Time Reports.", "/v1/market-time"),
    ("GET", "/v1/market-time/:id", "One Market-Time Report.", "/v1/market-time/1"),
    ("GET", "/v1/reports", "Stored KTS report ids.", "/v1/reports"),
    ("GET", "/v1/reports/:id", "One stored KTS report.", f"/v1/reports/{latest}"),
    ("GET", "/v1/bundle/:hash", "The exact input bundle posted under an inputsHash (or a report id). keccak256 of the bytes equals the hash.", f"/v1/bundle/{bundle_hash}" if bundle_hash else None),
]

now = datetime.datetime.now(datetime.timezone.utc).strftime("%d %b %Y %H:%M UTC")
out = [
    "# Kerb API",
    "",
    f"Base URL `{BASE}`. Read-only, JSON, CORS open for GET. Every number carries a provenance label: Verified, Observed, Attested or Computed. A chain or source that does not answer returns a labelled error (502 with `label: \"Unavailable\"`), never a stack trace.",
    "",
    f"Examples below were captured from production on {now} by `scripts/api-doc.py`. Arrays are cut to their first two items and long strings shortened; nothing is invented.",
    "",
    "| Method | Path | What |",
    "|---|---|---|",
]
for m, p, what, _ in E:
    out.append(f"| {m} | `{p.replace('|', chr(92) + '|')}` | {what} |")
for m, p, what, sample in E:
    out += ["", f"## `{m} {p}`", "", what, ""]
    if not sample:
        out += ["No live example available at capture time.", ""]
        continue
    out += [f"`{sample}`", "", "```json", json.dumps(trim(get(sample)), indent=1), "```"]
open("docs/API.md", "w").write("\n".join(out) + "\n")
print("wrote docs/API.md")
