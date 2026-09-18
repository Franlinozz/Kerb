My call is to drop Originline and build Kerb: a credit market for tokenized stocks on X Layer where the borrowing terms follow the real market session. The full war room brief is in the file.

Why Kerb

The assets are already on X Layer. OKX launched 40+ tokenized US stocks trading 24/7 against USDT, and xStocks and its atomic RFQ engine are deployed on X Layer. 
xStocks
The prices behind them stop. Chainlink's equity streams on X Layer are 24/5, so weekends have no reference price. 
OKX
Lenders already hold more than they could sell. About $111M of tokenized stock sits in DeFi as collateral against roughly $20M of liquidity that could actually be sold. 
Todayindefi
Nobody lends against stocks on X Layer yet. Aave on X Layer launched with assets like USDT and USDG, and I found no xStocks listing. 
Phemex

Kerb's hero mechanism is Last Call. In the final hour before the close, terms ramp down and over-extended loans get trimmed while liquidity is still deep. The rule underneath it all: never lend more than you can liquidate.

It hits Build A Market directly, and it uses OKX AI for real through a paid agent service. There's also a free demo hook: your finale slot lands during the US overnight session, so the board will be showing overnight terms live while you pitch.

Why Originline dies

There's no buyer during the hackathon, so the hero moment is you publishing statements from a fictional issuer to yourself.
OKX distributes third-party xStocks, and xStocks is a partner in the room. A product built around "the company disputes this token" puts both of them on the defensive.
It barely produces onchain data, which the T&Cs say counts.

From ChatGPT's version I kept the /proof page, the ban on fake claims, the evidence model, keeping AI out of the risk path, and the feature freeze. Section 27 has the full adopt/modify/kill list.

What needs you before Sep 17

Submit the application by 18:00 UTC tomorrow. Applications close 11 September at 23:59 UTC. The paste-ready pack is in Section 26. Verify the Assay numbers first. 
luma
Run the Day-0 checks in Section 28. The one that matters most: can you buy about $20 of an xStock on X Layer from Nigeria and wrap it? That decides whether the mainnet market is real.
Approve one exception to your one-key rule. The build needs a low-privilege attester key on the VPS that can only post bounded terms. It holds no funds and can't move anyone's money.
Decide on travel now. Teams that demo live on 6 October compete for the headline awards, while remote teams are still judged and can win. Nigeria is on Singapore's visa-required list, and finalists only hear on 28 to 30 Sep, which leaves very little time. If you won't travel, Best Remote Build is the target. 
luma
Pick the domain: kerb.markets first, usekerb.xyz as the fallback.

Hold product code until Sep 17. Once you've cross-reviewed and locked this, I'll write AGENTS.md, KTS-0.1 and the D1 to D9 build prompt pack







Nine files, ready to paste. Verdict first, then the things that change the build.

Kerb survives, upgraded. ChatGPT's rework was mostly right and I took the good parts: the market-time framing over the weekend framing, per-asset clocks, Depth as first class, Carry and Session Max, KTS as an open standard. Three places I overruled it:

The liquidation threshold is now fixed. ChatGPT's version still had terms moving under live borrowers. That is the first thing a technical judge attacks and it is indefensible. Sessions move borrowing capacity and the cure covenant. The hard line moves only by timelock. This also gives you two clean liquidation types (Cure, partial and cheap, executed in deep liquidity; Default, standard) which is a better story than one fuzzy one.
Depth is computed by walking Uniswap V3 ticks, not estimated from an API. The pools are on X Layer and readable, so the number is reproducible and it is the single hardest component for another team to copy in a week.
Kerb Desk and Autopilot drop to P1 and P2. You have seven days. Build a Market is won by one complete vertical, not by touching both tracks.

Three things I found that nobody had:

The X Liquidity campaign on those exact pools runs to 24 September 15:00 UTC+8, which is 07:00 UTC, one day before submission. Roughly $240K of incentives switch off across BRK.Bx, HKEXCx, KOx, MIXUx and the rest. That is a scheduled liquidity regime shift with a known timestamp, landing inside your build window, on pools you will have been measuring for six days. It is the empirical centrepiece of the video and no other team can manufacture it. 
okx

The live pools include Hong Kong names (MIXUx is Mixue tokenized stock, plus KUAIx and HKEXCx) alongside US names and SLVx. HKEX has a lunch break. That gives you a real regime transition every weekday, so the hero moment does not depend on waiting for a weekend. 
CoinMarketCap

The SEC's Innovation Exemption of 17 September requires trading halts synchronized with the underlying, symbol and volume caps, and auditable smart contracts on open ledgers, for venues using permissioned AMM liquidity pools. That is Kerb's spec written into a regulatory order. Halt sync is the Clock, caps are capacity, AMM pools are the exit path. 
TechFlow
Quartz

Verified and wired into the docs: USDG at 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8 on mainnet and 0xF0863D7A29a55d0c4263c11bFac754312ff078DF on testnet, Builder Codes via viem dataSuffix with testnet registerAuto at 0x00a3b805dbf39e5d54f9d09c130ff2132b4a0a21, chain 196 and 1952 RPCs.

Do these today, in this order:

Paste Phase 0 into Codex. The collector must be recording before 20:00 UTC, because the weekend closure starts tonight and you cannot recreate missing history.
Ask the six Telegram questions in section 12 of the master plan. Two matter most: whether a mainnet data plane plus a testnet credit market satisfies Build a Market given your jurisdiction, and whether the finale is 6 or 7 October (the EU mirror of the Builder Kit says 6 Oct, your copy updated 18 Sep says 7 Oct).
Decide the participation route by 24 September. In-person is $35K plus Flash Track eligibility; remote is a $15K pool with zero travel risk. Do not declare in-person unless you will actually fund the trip.

One thing I need from you before Phase 4A: your written approval and cap for the mainnet deploy, and confirmation that the attester key lives only on the VPS while the admin key stays local.
