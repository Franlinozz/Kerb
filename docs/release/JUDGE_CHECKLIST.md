# Judge checklist

Five minutes, no install.

1. **What it is.** Open https://www.usekerb.xyz. The hero says it: credit on the market's clock.
2. **It is live on mainnet.** Open `/proof`. The first tile shows the mainnet risk plane live with the time of the last post; follow "KerbTerms on OKLink".
3. **Builder Code.** On `/proof`, open "Latest Terms posts": each row decodes `kt0hl6xyhlx8xmt` from that transaction's calldata.
4. **The clock moves the credit.** Open `/asset/KOx`, tab "Terms history": Carry and Session Max step at each session change, with regime bands.
5. **The numbers are real.** On `/asset/BRK.Bx#liquidity`, hover the impact curve: every point is a sale simulated on the pool's real ticks.
6. **Recompute one.** `/proof` "Recompute" tile: the latest report recomputed from its bundle and compared with the chain, field by field. Or run `pnpm --filter @kerb/engine kerb verify <inputsHash>` from the repo.
7. **Borrow and cure.** `/credit` with any browser wallet on X Layer testnet (test OKB from https://www.okx.com/xlayer/faucet): mint, deposit, Session Max, borrow. The demo clock runs a trading week each hour; at Last Call cure from a second wallet in "Curable now".
8. **Measured research.** `/research/1`: what liquidity did over a closed weekend.
9. **Integrate.** `/developers`: SDK, REST and Solidity, each with a live response.
10. **Repository.** https://github.com/Franlinozz/Kerb: CI badge, `docs/API.md`, `docs/v2/KTS-0.2.md`, tests.
