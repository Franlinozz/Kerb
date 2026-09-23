# KERB V3: START HERE
## Final Ascension pack for OKX Dev Day 2026 (Build a Market, Remote)

Built from: repo `Franlinozz/Kerb` at `d7202a7` (22 Sep 16:23 UTC), your 13 production screenshots (23 Sep, 08:32 UTC), the OKX Builder Kit and submission form, the OKX.AI A2MCP, ASP registration and Payment SDK docs, current market research, and ChatGPT's final-ascension pack (reviewed, partly adopted, partly overruled; see `V3-ASCENSION.md` section 16).

Honest limit: my fetch tool served a cached V1 copy of usekerb.xyz and cannot reach api.usekerb.xyz, so live behaviour was audited from your screenshots plus the source that renders them. Every live defect below is traced to a line of code, not guessed.

---

## What V3 is, in one paragraph

V2 made Kerb look and work like a product. V3 makes Kerb **the thing it claims to be**: a market-time risk layer that other systems consume. Today exactly one thing consumes Kerb Terms (Kerb Credit, on testnet, through relayed mirror terms). V3 adds three real consumers, fixes the one defect that shows every judge stale data on first load, turns the Last Call hero into something a judge can trigger alone, explains every term change in plain numbers, publishes Report #2 as evidence for OKX's own liquidity programme, and ships the video.

## The files

| File | What it is | Who reads it |
|---|---|---|
| `00_START_HERE.md` | This file | You |
| `V3-ASCENSION.md` | The full ASCENSION analysis, scores, decisions, ChatGPT review | You, then agents once |
| `V3-LIVE-AUDIT.md` | Every production defect with root cause and fix | Agents |
| `AGENTS-V3-ADDENDUM.md` | Append to `AGENTS.md` as section 13 | Agents, every session |
| `V3-BUILD-PROMPTS.md` | Paste-ready phases V3-00 to V3-12 | You paste, agents run |
| `SPEC-AGENTS.md` | Kerb for Agents: x402 on OKX.AI plus an MCP server | Agents |
| `SPEC-ONCHAIN-CONSUMERS.md` | `KerbQuote` and `KerbMarkFeed` on X Layer mainnet | Agents |
| `SPEC-TERM-ATTRIBUTION.md` | "Why did this term change?", computed, never written by hand | Agents |
| `V3-POSITIONING.md` | Copy deck, allowed and forbidden claims, README and form text | Agents and you |
| `V3-DEMO.md` | Video script, shot list, filming windows, fallbacks | You |
| `V3-SUBMISSION.md` | Every form field, answered | You |
| `V3-CRUCIBLE.md` | Final certification checklist | Agents, then you |

## How to start (15 minutes)

1. Copy every file into `docs/v3/` in the repo.
2. Append `AGENTS-V3-ADDENDUM.md` to `AGENTS.md`.
3. Open `V3-BUILD-PROMPTS.md`. Paste **V3-00** into Claude Code from the repo root. It returns CHECKPOINT 0 before touching code.
4. Run two sessions in parallel if you can (two Claude Code terminals, or Claude Code plus Codex): **Lane A** backend, contracts, infra; **Lane B** frontend. If you run one agent, use the single-agent order at the top of `V3-BUILD-PROMPTS.md`.
5. Do the operator actions below the moment each one is asked for. Two of them have a clock on them.

## Your operator actions (the agents cannot do these)

| # | Action | Deadline | Why it has a deadline |
|---|---|---|---|
| 1 | Claim 0.02 test OKB from the X Layer faucet to the keeper wallet `0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4`, and write "go keeper" | Wed 23, as soon as V3-02 asks | The standing demo position is the only way a remote judge can press Cure alone |
| 2 | Onchain OS login: tell your agent `Install Onchain OS via npx skills add okx/onchainos-skills --yes -g, then log in to Agentic Wallet with my email` | Wed 23, early | Needed to register on OKX.AI |
| 3 | Confirm the OKX Developer Portal key (the DEX key you already have, or a new one with Payments) and a receive-only X Layer address for payments | Wed 23 | x402 settlement needs the facilitator key |
| 4 | Register the A2MCP ASP and request listing (the agent drives it; you approve) | **Wed 23 by 18:00 UTC** | OKX reviews listings within 24 hours; later than this and approval may land after filming |
| 5 | Put about 2 USDT0 on X Layer mainnet into your Agentic Wallet | Thu 24 | One real paid call is the evidence; it costs one cent |
| 6 | Approve the mainnet deploy of the two read-only consumer contracts (gas well under 0.01 OKB) | Thu 24 | New mainnet contracts are a gate |
| 7 | Hands off the whole production stack Thu 24 **05:00 to 09:00 UTC** | Thu 24 | Campaign end at 07:00 UTC; captures read the API |
| 8 | Record the video | **Fri 25, 07:30 to 08:00 UTC** (be ready 07:15) for the live Hong Kong Last Call | HKEX closes 08:00 UTC; its 30-minute Last Call is the last live one before the deadline in your daylight (08:30 Lagos) |
| 9 | Fill the form from `V3-SUBMISSION.md`, exact legal name, submit | Fri 25 by 16:00 UTC | Buffer to 23:59 |

Optional: an npm account (publishes `@kerb/sdk`), a Telegram bot token (Last Call alerts). Neither blocks anything.

## Schedule (UTC)

| Block | Lane A (backend, contracts, infra) | Lane B (frontend) |
|---|---|---|
| Wed 23 morning | V3-00 truth, V3-02 keeper | V3-01 freshness |
| Wed 23 afternoon | V3-03 Kerb for Agents (register by 18:00) | V3-04 attribution UI (after Lane A's API) |
| Wed 23 evening | V3-04 attribution engine and API, V3-05 contracts | V3-06 exit evidence UI |
| Thu 24 05:00 to 09:00 | **Protected window: no production deploys of anything** | Staging only |
| Thu 24 | V3-05 deploy, V3-09 Report #2 after 09:00 | V3-07 consumers and positioning, V3-08 alerts (cut first) |
| Thu 24 16:00 to 22:00 | V3-10 hardening | V3-10 hardening |
| **Thu 24 22:00** | **Feature freeze** | |
| Fri 25 00:00 to 04:00 | V3-11 certification, tag `v3.0.0` | V3-11 certification |
| Fri 25 06:00 to 10:30 | No deploys. Filming | Filming |
| Fri 25 by 16:00 | V3-12 submission | |

If you start later, shift everything except the protected window, the ASP registration deadline and the filming window. Those three are set by the outside world.

## What gets cut, in order, if you fall behind at Thu 12:00 UTC

1. Last Call alerts (V3-08)
2. The open dataset download (part of V3-09)
3. The `KerbMarkFeed` factory (keep `KerbQuote` only)
4. The exit-check 72-hour divergence history (keep the live panel)
5. MCP server (keep the x402 A2MCP endpoints, which are the sponsor integration)

Never cut: freshness, keeper, truth sweep, Report #2, the x402 endpoint with one real settled payment, the video.
