# Voiceover Script

Preferred voice: Antoni.

Performance:
- calm
- precise
- slightly warm
- no sales hype
- no movie trailer delivery
- no excessive downward inflection
- short pauses after core ideas
- pronounce `Kerb` like `curb`
- pronounce `KTS` as individual letters
- pronounce `C one percent` rather than reading punctuation
- pronounce `x402` as `x four oh two`
- pronounce `X Layer` clearly as two words

The final editor may make small timing edits, but product claims must not be expanded beyond current repo evidence.

## Segment 01 - Cold open

Tokenized stocks can trade around the clock. Their underlying markets and executable exits do not.

Kerb is the market-time risk layer for tokenized stocks on X Layer.

## Segment 02 - Board

The Board shows that mismatch live. Each asset keeps its own market clock, its own liquidity regime, and its own executable capacity.

Kerb measures how much the real X Layer pool can absorb now, not how much liquidity a dashboard says exists in theory.

## Segment 03 - Exit measurement

For every asset, Kerb walks the Uniswap V3 liquidity tick by tick to measure the sale that could actually clear.

It cross-checks that exit against OKX DEX quotes and uses the conservative answer.

That becomes C one percent: the amount that can be exited within one percent price impact.

## Segment 04 - KTS

Then the Kerb Terms Standard binds capacity to time.

Carry is sized to survive until the next weak market without the borrower touching the position.

Session Max can provide more credit now because it only has to survive to Last Call.

The liquidation threshold stays fixed.

## Segment 05 - Borrow

Here, the borrower chooses Session Max.

Before anything is signed, Kerb shows the amount, the resulting loan to value, the fixed liquidation line, and exactly when the covenant changes.

The borrow confirms on X Layer testnet.

## Segment 06 - Last Call and Cure

Now the clock crosses into Last Call.

The position is still above its durable Carry target, so only the excess becomes curable.

A second wallet can repay that difference and earn the cure bonus.

This is not a full liquidation.

The position is repaired before the weak session, while the liquidation threshold never moves.

## Segment 07 - Proof

Every Kerb term is published with the hash of the inputs that produced it.

The Proof surface recomputes the report from those inputs and compares the result with what Kerb posted on X Layer.

Recent posts also carry the Kerb Builder Code.

## Segment 08 - Consumers

Kerb Terms are not tied to Kerb Credit.

Agents can buy a credit check over x four oh two.

Contracts can read KerbQuote directly.

Developers can use the public API or SDK.

Kerb Credit is the reference consumer that proves the terms can govern real behavior.

## Segment 09 - Research

And the system has already seen why this matters.

When the X Liquidity campaign ended, executable depth changed materially across the same pools Kerb had been measuring.

By the later capture, at least five of ten assets had lost ten percent or more of C one percent, and HKEXCx showed the largest move.

Kerb measured that change. It did not predict it.

## Segment 10 - Limitations and close

The risk plane is live on X Layer mainnet.

Kerb Credit is a testnet reference market using mirror collateral and mUSDG, and the contracts are unaudited.

Most systems ask what an asset is worth.

Kerb also asks whether the exit will still be there.

Never lend more than you can liquidate.
