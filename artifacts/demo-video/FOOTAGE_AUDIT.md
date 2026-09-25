# Footage audit (M1)

Audited 25 Sep 2026, 14:00 to 15:00 UTC, from 2 fps timestamped contact sheets (`review2/`), full resolution gridded stills (`stills/`) and a 10 fps motion map of every clip (`scripts/demo-video/motion_profile.py`).

## Source facts

- All twelve recordings are 1920x1080, 30 fps CFR, H.264, with a silent AAC track (max volume -90 dB). The film's sound is narration, music and three accents only.
- Every recording is a Chrome window at Windows 125 percent scaling. Browser chrome takes the top 118 px, and the Chrome bar shows "Ask Gemini", tabs and extensions. Standard crop: x 98, y 120, 1704 x 958 (16:9), scaled 1.1268 to 1920x1080. It keeps the Kerb nav, the Live pill and the wallet pill (`0xc995...a4dc · X Layer testnet`), and drops the Chrome bar and the dotted recording border.
- The OKX Wallet pop-up opens outside that crop (x 1446 to 1920, y 0 to 965). It is shown as a magnified insert over the dimmed page, not by cropping into the browser.
- Page scrolls are fast. Still windows are short, so every trim sits on a measured still window from the motion map.

## Clip by clip

| Clip | Usable | Strong moments (source seconds) | Defects |
|---|---|---|---|
| 01 Home | yes | 0.0 to 2.6 hero with New York pre-market and Hong Kong closed clocks; 4.8 to 7.0 "Every asset keeps its own hours" session rail; 7.9 to 11.3 "Measured, not modelled" (pool observations tick 128,760 to 128,790 live); 13.3 to 13.9 "Read by a credit market, contracts, agents and code"; 15.3 to 19.6 "How long should your loan survive without you?" Carry vs Session Max; 21.0 to 22.9 "Verify everything" | fast scrolls between sections |
| 02 Board | yes | 0.3 to 3.6 KPI row (In Last Call now 0, Executable at 1% $78.9K, Debt capacity $18.4K, Sources healthy 14 of 14); 8.4 to 11.6 table under the session rail; 20 to 27 row hover flips the rail between New York pre-market and Hong Kong closed; 29.4 to 33.0 Hong Kong rows Stale and Closed, "14 sources reporting · 14 healthy" | none |
| 03 Asset KOx | yes | 37.9 to 40.2 KOx terms row (Carry 46.2%, Session Max 58.0%, Liquidation fixed 65.0%, C(1%) $19.2K, Debt ceiling $8,787); 7.5 to 9.9 terms bar and rail; 15.0 to 19.9 overview sentence "sessions move what you can borrow, never the line"; 20.1 to 22.3 and 26.7 to 29.9 "Exit check · C(1%) measured two ways": Kerb tick-walk $19.2K, OKX DEX quote $19.2K, difference 0.06% | 1.7 to 3.8 the page dims while refreshing live data (avoided) |
| 04 Methodology | partly | 9.0 to 15.7 depth curve "What the market could actually absorb" with the cursor reading impact along the curve | no Carry or Session Max content, so KTS comes from 01 and 03 |
| 05 Borrow | yes | 7.5 to 11.0 10 kKOx collateral, Session Max card selected; 12.5 to 16.5 borrow 100 mUSDG with the before-signing preview (LTV after 3.2%, Health after 21.49, Liquidation line 68.0% fixed, mirror listing); 19.0 to 21.0 "Borrow 100.00 mUSDG with Session Max"; 29.0 to 31.2 wallet "Confirm Deposit -10 kKOx, X Layer Testnet"; 44.0 to 45.6 wallet "+100 mUSDG"; 46.2 to 50.5 position "Session Max · Health 21.49" and toast "Borrowed 100.00 mUSDG"; 60.5 to 62.5 OKLink "Accepted on L2" | 22 to 29 and 32 to 43 wallet loading and a white pop-up frame (cut) |
| 06 Last Call and Cure | yes, hero | 14.5 to 22.4 NEXT LAST CALL counts "in 7s" to "in 0s" and flips to the next cycle at 21.9; 24.1 to 27.7 "Last Call is open until 12:03 UTC and no position needs a cure right now"; 27.8 the row appears: 0xaccd...c0f4, kKOx, Session Max, LTV/target 55.7% / 46.3%, required repay 632.55 mUSDG, bonus 1.5%, Cure; 41 to 44 Cure pressed; 52.5 to 55.6 wallet: -631.92126 mUSDG, +7.306215 kKOx, X Layer Testnet; 56 to 59.3 "Cured kKOx"; 69.8 to 72 OKLink: Accepted on L2, both transfers, Builder Code chip; 74 to 80 the same row at 46.3% / 46.3% | 45 to 52 wallet loading (cut) |
| 06b | salvage only | a second cure of the 0.64 mUSDG remainder on the same row | nothing 06 lacks; the cure it shows is trivial |
| 07 Proof | yes, short holds | 0.1 to 1.1 "Kerb is independently verifiable"; 4.8 to 7.2 tiles (mainnet risk plane live, Sourcify exact match, Builder Code, bundles 2,570 of 2,570 retrievable, recompute reproduces the chain, 594 TS · 120 Sol, x402 settled); 13.6 to 15.2 "Reproduce a report" with the last verify matching field by field; 16.8 to 20.1 Limitations (credit on testnet with mirror collateral, risk plane on mainnet, contracts unaudited) | holds are 1 to 3 s |
| 08 Agents and contracts | yes | 0.8 to 3.6 Agents tab: $0.01 in USDT0 per call, x402 on X Layer mainnet, latest settled payment; 4.8 to 7.9 curl example; 8.9 to 11.2 free MCP server and "What you can build"; 24.0 to 27.2 KerbQuote on X Layer mainnet, Sourcify exact match | documentation surface rather than a live call; enough for the claim as narrated |
| 09 Report #2 | yes | 6.7 to 9.5 report header: 48.00 h, 43,185 readings across 15 pools, 6 of 10, -99.44%; 11.4 to 13.4 liquidity change by pool; 14.7 to 16.5 "Before and after the campaign end" with Hold verdicts and the later C(1%) column | none |
| 10 Home closer | partly | 0.0 to 3.2 hero; 11 to 13 consumers; 16 to 18 "Verify everything" | hero hold too short for the close |
| 11 Minting | not needed | faucet mints | 05 already shows "Get set up 4 of 4" complete |

## Answers the masterplan requires

- **Is 06 sufficient by itself?** Yes. It contains every beat of Gate B in order: an open Session Max position, the clock counting to Last Call and flipping, the empty "no position needs a cure" state, the curable row appearing with LTV above target and the required repay, a different wallet (0xc995...a4dc) pressing Cure, the wallet confirmation, "Cured kKOx", the OKLink receipt, and the same position back at 46.3% / 46.3%.
- **Is any part of 06b cleaner and worth salvaging?** No. 06b is a second cure of the 0.64 mUSDG remainder. It adds no state 06 lacks.
- **Does 05 clearly show Session Max selection and a confirmed borrow?** Yes: the Session Max card selection, the before-signing preview, both wallet confirmations and the resulting Session Max position with the "Borrowed 100.00 mUSDG" toast.
- **Does 03 show executable depth and the OKX DEX cross-check?** Yes. The exit check shows the Kerb tick-walk and the OKX DEX quote side by side, with the difference and the capacity used.
- **Does 08 show both the agent and the contract consumer story?** Yes, as documentation of live endpoints: the x402 price and settled payment for agents, and KerbQuote on X Layer mainnet for contracts. The Home consumers band (01, 10) gives the four-consumer overview.
- **Does 09 show Report #2 and its result?** Yes. The footage shows the final report (window 23 Sep 07:00 to 25 Sep 07:00 UTC). Its numbers differ from the planning script: C(1%) held for all ten at the 07:00 cliff (06:55 against 07:05 on 24 Sep); by the 25 Sep 07:00 capture it had fallen 10 percent or more for six of ten and risen for four, largest fall KUAIx at -99.44%. The narration follows the report and the footage, as CLAIM_GUARDRAILS directs.
- **Is 11 needed at all?** No.

## Important story fact

The curable position in 06 is the demo keeper's standing Session Max position (0xaccd...c0f4, 2,000 mUSDG), which is designed to become curable each demo Last Call. The operator's own 05 position (3.2% LTV) is below Carry and never becomes curable. The cure is made by the operator's wallet 0xc995...a4dc, which is a different wallet from the borrower's. The narration says "a Session Max position that borrowed above its Carry target" and "any other wallet". It does not claim the 05 position was cured. The Last Call is the testnet demo clock (hh:53:58 UTC), and the narration says so once.

## Replacement captures

- `captures/home_hero_live.mkv`: the live Home hero, 16 s, recorded 25 Sep about 14:45 UTC at the operator's layout scale (device scale 1.4085, native 1920x1080, no chrome, no cursor). It gives the close a steady hero long enough for the thesis. New York shows OPEN in this capture, against PRE-MARKET in the morning footage. The time difference is real and visible.
