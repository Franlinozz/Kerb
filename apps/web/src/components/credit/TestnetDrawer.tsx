"use client";
import { Info } from "lucide-react";
import Link from "@/components/ui/Link";
import { useState } from "react";
import type { CreditMarket } from "@/lib/api";
import { Drawer } from "@/components/ui/Drawer";
import { AddressChip } from "@/components/ui/AddressChip";

/** The disclosure chip and the drawer that says, in full, what is test and what is real. */
export function TestnetDrawer({ market }: { market: CreditMarket }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const x = "https://www.oklink.com/x-layer-testnet/address/";
  return (
    <>
      <button type="button" className="disclose-chip" onClick={() => setOpen(true)}><Info size={14} />Testnet · mirror collateral · risk from mainnet</button>
      <Drawer open={open} onClose={() => setOpen(false)} label="About this testnet market">
        <div className="drawer-prose">
          <h2>What is real here, and what is test.</h2>
          <p><b>The risk is real.</b> Each mirror token&rsquo;s Credit Mark and terms are the ones Kerb computes and posts on X Layer mainnet for the real asset, relayed onto testnet every five minutes.</p>
          <p><b>The collateral is a mirror.</b> kKOx and kHKEXCx are test tokens with no claim on any security. Kerb does not acquire, hold or route around restrictions on the production tokenized assets.</p>
          <p><b>The loan asset is a stand-in.</b> {market.loanAsset.symbol} replaces USDG on testnet because the real Paxos testnet USDG has a permissioned mint and no faucet. It says so in its own name.</p>
          <p><b>The clock is compressed.</b> KerbClockDemo runs one trading week per hour, so Last Call and the cure can be seen in minutes. It is never deployed to mainnet.</p>
          <p><b>The liquidation line.</b> {market.disclaimer.split(". ").filter((s) => s.startsWith("Mirror listings") || s.startsWith("A listed threshold")).join(". ")}</p>
          <span className="t-label">Contracts on X Layer testnet 1952</span>
          <dl className="facts mt-3">
            {Object.entries({ KerbCredit: market.contracts.KerbCredit, KerbTerms: market.contracts.KerbTerms, "Demo clock": market.contracts.clock, [market.loanAsset.symbol]: market.contracts.loanAsset, ...Object.fromEntries(market.collaterals.map((c) => [`k${c.mirrors}`, c.token])) })
              .filter((e): e is [string, string] => typeof e[1] === "string")
              .map(([k, a]) => <div key={k}><dt className="t-label">{k}</dt><dd><AddressChip value={a} href={`${x}${a}`} label={k} /></dd></div>)}
          </dl>
          <p className="mt-4"><Link href="/proof#contracts" onClick={() => setOpen(false)}>Every contract and its verification on the proof page</Link></p>
        </div>
      </Drawer>
    </>
  );
}
