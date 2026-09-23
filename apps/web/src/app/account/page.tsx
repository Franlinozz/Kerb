/**
 * Your account (V3): the connected wallet's holdings, positions and history in Kerb Credit, or
 * any address through ?addr=. Client-rendered: it depends on the wallet, not on a cached page.
 */
import type { Metadata } from "next";
import { AccountView } from "@/components/account/AccountView";

export const metadata: Metadata = { title: "Your account", description: "Holdings, positions, covenant status and history in Kerb Credit for any address, read from X Layer." };

export default function AccountPage(): React.ReactElement {
  return (
    <div className="account">
      <header className="page-head">
        <span className="t-label">Kerb Credit · X Layer testnet 1952 · read from chain</span>
        <h1>Your account.</h1>
        <p className="lede">What you hold, what you owe, where each position stands against its Carry target, and everything this address has done in the market, from borrowing to curing someone else at Last Call.</p>
      </header>
      <AccountView />
    </div>
  );
}
