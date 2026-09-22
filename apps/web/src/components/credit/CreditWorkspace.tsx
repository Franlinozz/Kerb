"use client";

/**
 * Kerb Credit, the hero workflow (V2-08, V2-DESIGN-SYSTEM.md section 11.4). Three zones: collateral
 * and setup on the left, the action in the centre, the position on the right. Every number is read
 * from the contracts or computed the way KerbCredit computes it, before anyone signs.
 */
import { Check, CircleDashed, ExternalLink, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useHydratedAccount } from "@/lib/useHydrated";
import type { Hex } from "viem";
import type { CreditCollateral, CreditMarket, DemoClock } from "@/lib/api";
import { REGIME_BY_INDEX } from "@/lib/api";
import { CREDIT_ABI, ERC20_ABI } from "@/lib/creditAbi";
import { mapTxError } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useTxFlow, type FlowStep } from "@/lib/txflow";
import { utcHm } from "@/lib/time";
import { Field } from "@/components/ui/Field";
import { TxStepper } from "@/components/ui/TxStepper";
import { Tabs } from "@/components/ui/Tabs";
import { WalletSheet } from "@/components/shell/WalletButton";
import { RegimePill } from "@/components/kerb/RegimePill";
import { scheduleAt } from "@/components/kerb/SessionRail";
import { useNow } from "@/components/kerb/useLive";
import { fmtUnits, hfOf, hfWad, ltvOf, MAX, parseAmount, pctWad, usePosition, valueOf, WAD, type PositionState } from "./usePosition";
import { PositionPanel } from "./PositionPanel";

const FAUCET = "https://www.okx.com/xlayer/faucet";

// ----------------------------------------------------------------------------- collateral cards

function CollateralCard({ c, selected, onSelect, demo }: { c: CreditCollateral; selected: boolean; onSelect: () => void; demo: DemoClock }): React.ReactElement {
  const regime = REGIME_BY_INDEX[c.terms.regime] ?? null;
  return (
    <button type="button" className="coll-card" aria-pressed={selected} onClick={onSelect}>
      <span className="row between"><span className="dt-tick">k{c.mirrors}</span><RegimePill regime={regime} size="sm" /></span>
      <span className="dt-under">Mirror of {c.relayedFrom?.symbol ?? c.mirrors} · Credit Mark ${fmtUnits(BigInt(c.terms.creditMark), 18, 2)}</span>
      <span className="coll-terms">
        <span><span className="t-label">Carry</span>{pctWad(BigInt(c.terms.carryLTV))}</span>
        <span><span className="t-label">Session Max</span>{pctWad(BigInt(c.terms.sessionMaxLTV))}</span>
        <span><span className="t-label">Liquidation</span>{pctWad(BigInt(c.liquidationThreshold))}</span>
      </span>
      <span className="t-small ink-3">Next Last Call {utcHm(Date.parse(demo.nextCureOpensAt))} UTC · relayed from mainnet {c.relayedFrom?.symbol ?? ""}</span>
      {!c.terms.usable ? <span className="t-small brass">New borrowing paused: the relayed terms are not usable right now.</span> : null}
    </button>
  );
}

// ----------------------------------------------------------------------------- setup

type StepState = "done" | "needed" | "blocked";
function SetupStep({ n, title, state, children }: { n: number; title: string; state: StepState; children?: React.ReactNode }): React.ReactElement {
  return (
    <li className="setup-step" data-state={state}>
      <span className="setup-mark" aria-hidden="true">{state === "done" ? <Check size={13} /> : state === "blocked" ? <TriangleAlert size={13} /> : <CircleDashed size={13} />}</span>
      <div><span className="setup-title">{n}. {title}<span className="sr-only">: {state}</span></span>{children ? <div className="setup-body t-small ink-2">{children}</div> : null}</div>
    </li>
  );
}

function Setup({ market, c, pos }: { market: CreditMarket; c: CreditCollateral; pos: PositionState }): React.ReactElement {
  const { isConnected } = useHydratedAccount(useAccount());
  const chainId = useChainId();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [sheet, setSheet] = useState(false);
  const flow = useTxFlow({ tokenDecimals: 18, tokenSymbol: `k${c.mirrors}` }, pos.refresh);
  const onChain = isConnected && chainId === 1952;
  const hasGas = pos.gas !== null && pos.gas > 0n;
  const hasColl = pos.collBalance > 0n || pos.held > 0n;
  const hasLoan = pos.loanBalance > 0n;
  const done = [onChain, onChain && hasGas, onChain && hasColl, onChain && hasLoan].filter(Boolean).length;
  const collFaucet = pos.collRemaining !== null ? (pos.collRemaining < 100n * WAD ? pos.collRemaining : 100n * WAD) : 100n * WAD;
  const loanDec = market.loanAsset.decimals;
  const loanFaucet = pos.loanRemaining !== null ? (pos.loanRemaining < 10_000n * 10n ** BigInt(loanDec) ? pos.loanRemaining : 10_000n * 10n ** BigInt(loanDec)) : 10_000n * 10n ** BigInt(loanDec);
  return (
    <div className="setup">
      <div className="row between"><span className="t-label">Get set up</span><span className="t-label ink-3">{done} of 4</span></div>
      <ol className="setup-list" role="list">
        <SetupStep n={1} title="Wallet on X Layer testnet" state={onChain ? "done" : "needed"}>
          {!isConnected ? <button type="button" className="btn btn-sm mt-2" onClick={() => setSheet(true)}>Connect a wallet</button>
            : chainId !== 1952 ? <button type="button" className="btn btn-sm mt-2" disabled={isPending} onClick={async () => { try { await switchChainAsync({ chainId: 1952 }); } catch (e) { const m = mapTxError(e); toast({ tone: m.kind === "cancelled" ? "info" : "warn", title: m.kind === "cancelled" ? "Network switch cancelled" : "Could not switch network", body: m.kind === "cancelled" ? undefined : "Add X Layer testnet (chain 1952) in your wallet, then try again." }); } }}>Switch to X Layer testnet</button>
            : "Connected on chain 1952."}
        </SetupStep>
        <SetupStep n={2} title="Test OKB for gas" state={!onChain ? "blocked" : hasGas ? "done" : "needed"}>
          {!onChain ? "Needs step 1." : hasGas ? `${fmtUnits(pos.gas ?? 0n, 18, 4)} OKB.` : <>This address has no test OKB. Get some from the <a href={FAUCET} target="_blank" rel="noreferrer">official X Layer faucet <ExternalLink size={12} style={{ display: "inline" }} /></a>; this checks again when you come back.</>}
        </SetupStep>
        <SetupStep n={3} title={`Test collateral (k${c.mirrors})`} state={!onChain || !hasGas ? "blocked" : hasColl ? "done" : "needed"}>
          {!onChain || !hasGas ? "Needs steps 1 and 2." : (
            <>
              {fmtUnits(pos.collBalance, 18, 2)} in the wallet{pos.held > 0n ? `, ${fmtUnits(pos.held, 18, 2)} deposited` : ""}. {pos.collRemaining !== null ? `Faucet allowance left: ${fmtUnits(pos.collRemaining, 18, 0)}.` : ""}
              {pos.collRemaining === null || pos.collRemaining > 0n ? <div className="mt-2"><button type="button" className="btn btn-sm" disabled={flow.running || collFaucet === 0n} onClick={() => void flow.run([{ label: `Mint ${fmtUnits(collFaucet, 18, 0)} k${c.mirrors}`, call: { address: pos.token, abi: ERC20_ABI, functionName: "faucet", args: [collFaucet] } }], `Minted ${fmtUnits(collFaucet, 18, 0)} k${c.mirrors}`)}>Mint {fmtUnits(collFaucet, 18, 0)} k{c.mirrors}</button></div> : null}
            </>
          )}
        </SetupStep>
        <SetupStep n={4} title={`${market.loanAsset.symbol} to supply or repay`} state={!onChain || !hasGas ? "blocked" : hasLoan ? "done" : "needed"}>
          {!onChain || !hasGas ? "Needs steps 1 and 2." : (
            <>
              {fmtUnits(pos.loanBalance, loanDec, 2)} {market.loanAsset.symbol} in the wallet. {market.loanAsset.isMock ? "A labelled test stand-in for USDG." : ""}
              {pos.loanRemaining === null || pos.loanRemaining > 0n ? <div className="mt-2"><button type="button" className="btn btn-sm" disabled={flow.running || loanFaucet === 0n} onClick={() => void flow.run([{ label: `Mint ${fmtUnits(loanFaucet, loanDec, 0)} ${market.loanAsset.symbol}`, call: { address: pos.loan, abi: ERC20_ABI, functionName: "faucet", args: [loanFaucet] } }], `Minted ${fmtUnits(loanFaucet, loanDec, 0)} ${market.loanAsset.symbol}`)}>Mint {fmtUnits(loanFaucet, loanDec, 0)} {market.loanAsset.symbol}</button></div> : null}
            </>
          )}
        </SetupStep>
      </ol>
      {flow.steps.length ? <TxStepper steps={flow.steps} note={flow.note} tone={flow.tone} explorerHref={flow.hash ? `https://www.oklink.com/x-layer-testnet/tx/${flow.hash}` : null} /> : null}
      <WalletSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}

// ----------------------------------------------------------------------------- actions

function Preview({ rows }: { rows: [string, string][] }): React.ReactElement {
  return <dl className="preview">{rows.map(([k, v]) => <div key={k}><dt className="t-label">{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function BorrowTab({ market, c, pos, demo }: { market: CreditMarket; c: CreditCollateral; pos: PositionState; demo: DemoClock }): React.ReactElement {
  const dec = market.loanAsset.decimals, sym = market.loanAsset.symbol;
  const [collIn, setCollIn] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<0 | 1>(1);
  const flow = useTxFlow({ mode: mode === 1 ? "Session Max" : "Carry", loanSymbol: sym, tokenDecimals: 18, tokenSymbol: `k${c.mirrors}` }, pos.refresh);
  const mark = BigInt(c.terms.creditMark), carry = BigInt(c.terms.carryLTV), smax = BigInt(c.terms.sessionMaxLTV), lt = BigInt(c.liquidationThreshold);
  const addColl = parseAmount(collIn, 18);
  const value = valueOf(pos.held + addColl, mark, dec);
  const room = (l: bigint): bigint => { const cap = (value * l) / WAD; return cap > pos.owed ? cap - pos.owed : 0n; };
  const carryRoom = room(carry), smaxRoom = room(smax);
  const want = parseAmount(amount, dec);
  const debtAfter = pos.owed + want;
  const ltvAfter = ltvOf(debtAfter, value);
  const hfAfter = hfOf(debtAfter, value, lt);
  const limit = mode === 1 ? smax : carry;
  const over = ltvAfter !== null && ltvAfter > limit && want > 0n;
  const overCap = debtAfter > BigInt(c.terms.maxPositionDebt);
  const noColl = pos.held + addColl === 0n;
  const cureAt = Date.parse(demo.nextCureOpensAt);
  const steps: FlowStep[] = [];
  if (addColl > 0n && pos.collAllowance < addColl) steps.push({ label: `Approve k${c.mirrors}`, call: { address: pos.token, abi: ERC20_ABI, functionName: "approve", args: [pos.credit, MAX] } });
  if (addColl > 0n) steps.push({ label: `Deposit ${fmtUnits(addColl, 18, 2)} k${c.mirrors}`, call: { address: pos.credit, abi: CREDIT_ABI, functionName: "deposit", args: [pos.assetId, addColl] } });
  if (want > 0n) steps.push({ label: `Borrow ${fmtUnits(want, dec, 2)} ${sym}`, call: { address: pos.credit, abi: CREDIT_ABI, functionName: "borrow", args: [pos.assetId, want, mode] } });
  const label = want > 0n ? `Borrow ${fmtUnits(want, dec, 2)} ${sym} with ${mode === 1 ? "Session Max" : "Carry"}` : addColl > 0n ? `Deposit ${fmtUnits(addColl, 18, 2)} k${c.mirrors}` : "Enter an amount";
  const disabled = flow.running || steps.length === 0 || over || overCap || (want > 0n && !c.terms.usable) || noColl || !pos.isConnected;
  return (
    <div className="action">
      <Field label={`Collateral to add (k${c.mirrors})`} value={collIn} onChange={setCollIn} unit={`k${c.mirrors}`} onMax={() => setCollIn(fmtUnits(pos.collBalance, 18, 6).replace(/,/g, ""))}
        help={`Wallet ${fmtUnits(pos.collBalance, 18, 2)} · deposited ${fmtUnits(pos.held, 18, 2)} · valued at the Credit Mark $${fmtUnits(mark, 18, 2)}`} />
      <fieldset className="modes-q">
        <legend>How long should this loan survive without you?</legend>
        <div className="mode-pick">
          <button type="button" className="mode-opt" aria-pressed={mode === 0} onClick={() => setMode(0)}>
            <span className="t-label">Carry · {pctWad(carry)}</span>
            <span className="t-num-l">{fmtUnits(carryRoom, dec, 2)} <span className="kpi-unit">{sym}</span></span>
            <span className="t-small ink-2">No cure events. Sized to survive the next closure unattended.</span>
          </button>
          <button type="button" className="mode-opt" aria-pressed={mode === 1} onClick={() => setMode(1)}>
            <span className="t-label">Session Max · {pctWad(smax)}</span>
            <span className="t-num-l">{fmtUnits(smaxRoom, dec, 2)} <span className="kpi-unit">{sym}</span>{smaxRoom > carryRoom ? <span className="moss t-small"> +{fmtUnits(smaxRoom - carryRoom, dec, 2)}</span> : null}</span>
            <span className="t-small ink-2">Cure back to Carry when the demo Last Call opens at {utcHm(cureAt)} UTC, or anyone may cure it for a {pctWad(BigInt(c.cureBonus))} bonus.</span>
          </button>
        </div>
      </fieldset>
      <Field label={`Borrow (${sym})`} value={amount} onChange={setAmount} unit={sym} onMax={() => setAmount(fmtUnits(mode === 1 ? smaxRoom : carryRoom, dec, 2).replace(/,/g, ""))}
        error={over ? `Above the ${mode === 1 ? "Session Max" : "Carry"} limit of ${pctWad(limit)}. ${mode === 0 && ltvAfter !== null && ltvAfter <= smax ? "Session Max allows it, with the cure covenant." : "Borrow less or add collateral."}` : overCap ? `One position may owe at most ${fmtUnits(BigInt(c.terms.maxPositionDebt), dec, 2)} ${sym}.` : null} />
      <Preview rows={[
        ["LTV after", ltvAfter === null ? "No debt" : pctWad(ltvAfter)],
        ["Health after", hfWad(hfAfter)],
        ["Owing after", `${fmtUnits(debtAfter, dec, 2)} ${sym}`],
        ["Liquidation line", `${pctWad(lt)}, fixed`],
      ]} />
      <button type="button" className="btn btn-primary action-go" disabled={disabled} onClick={async () => { if (await flow.run(steps, want > 0n ? `Borrowed ${fmtUnits(want, dec, 2)} ${sym}` : `Deposited ${fmtUnits(addColl, 18, 2)} k${c.mirrors}`)) { setCollIn(""); setAmount(""); } }}>{label}</button>
      {!pos.isConnected ? <p className="t-small ink-3">Connect a wallet in the setup steps to act. Everything here reads without one.</p> : null}
      {flow.steps.length ? <TxStepper steps={flow.steps} note={flow.note} tone={flow.tone} explorerHref={flow.hash ? `https://www.oklink.com/x-layer-testnet/tx/${flow.hash}` : null} /> : null}
    </div>
  );
}

function RepayTab({ market, c, pos }: { market: CreditMarket; c: CreditCollateral; pos: PositionState }): React.ReactElement {
  const dec = market.loanAsset.decimals, sym = market.loanAsset.symbol;
  const [amount, setAmount] = useState("");
  const flow = useTxFlow({ loanSymbol: sym }, pos.refresh);
  const want = parseAmount(amount, dec);
  const pay = want > pos.owed ? pos.owed : want;
  const value = valueOf(pos.held, BigInt(c.terms.creditMark), dec);
  const after = pos.owed - pay;
  const steps: FlowStep[] = [];
  if (pay > 0n && pos.loanAllowance < pay) steps.push({ label: `Approve ${sym}`, call: { address: pos.loan, abi: ERC20_ABI, functionName: "approve", args: [pos.credit, MAX] } });
  if (pay > 0n) steps.push({ label: `Repay ${fmtUnits(pay, dec, 2)} ${sym}`, call: { address: pos.credit, abi: CREDIT_ABI, functionName: "repay", args: [pos.assetId, want >= pos.owed ? MAX : pay] } });
  return (
    <div className="action">
      <Field label={`Repay (${sym})`} value={amount} onChange={setAmount} unit={sym} onMax={() => setAmount(fmtUnits(pos.owed, dec, 6).replace(/,/g, ""))}
        help={`Owing ${fmtUnits(pos.owed, dec, 2)} · wallet ${fmtUnits(pos.loanBalance, dec, 2)} ${sym}. Repay works in every state, paused included.`}
        error={pay > pos.loanBalance && pay > 0n ? `The wallet holds ${fmtUnits(pos.loanBalance, dec, 2)} ${sym}. Mint more in the setup steps.` : null} />
      <Preview rows={[["LTV after", pctWad(ltvOf(after, value))], ["Health after", hfWad(hfOf(after, value, BigInt(c.liquidationThreshold)))], ["Owing after", `${fmtUnits(after, dec, 2)} ${sym}`]]} />
      <button type="button" className="btn btn-primary action-go" disabled={flow.running || steps.length === 0 || pay > pos.loanBalance} onClick={async () => { if (await flow.run(steps, `Repaid ${fmtUnits(pay, dec, 2)} ${sym}`)) setAmount(""); }}>{pay > 0n ? `Repay ${fmtUnits(pay, dec, 2)} ${sym}` : "Enter an amount"}</button>
      {flow.steps.length ? <TxStepper steps={flow.steps} note={flow.note} tone={flow.tone} explorerHref={flow.hash ? `https://www.oklink.com/x-layer-testnet/tx/${flow.hash}` : null} /> : null}
    </div>
  );
}

function WithdrawTab({ market, c, pos }: { market: CreditMarket; c: CreditCollateral; pos: PositionState }): React.ReactElement {
  const dec = market.loanAsset.decimals;
  const [amount, setAmount] = useState("");
  const flow = useTxFlow({ tokenDecimals: 18, tokenSymbol: `k${c.mirrors}` }, pos.refresh);
  const want = parseAmount(amount, 18);
  const left = pos.held > want ? pos.held - want : 0n;
  const value = valueOf(left, BigInt(c.terms.creditMark), dec);
  const hf = hfOf(pos.owed, value, BigInt(c.liquidationThreshold));
  const unsafe = pos.owed > 0n && (hf === null || hf < WAD);
  return (
    <div className="action">
      <Field label={`Withdraw collateral (k${c.mirrors})`} value={amount} onChange={setAmount} unit={`k${c.mirrors}`} onMax={() => setAmount(fmtUnits(pos.held, 18, 6).replace(/,/g, ""))}
        help={`Deposited ${fmtUnits(pos.held, 18, 2)} k${c.mirrors}.`} error={unsafe && want > 0n ? "That would leave the position below a health factor of 1. Repay first or withdraw less." : null} />
      <Preview rows={[["Collateral after", `${fmtUnits(left, 18, 2)} k${c.mirrors}`], ["LTV after", pctWad(ltvOf(pos.owed, value))], ["Health after", hfWad(hf)]]} />
      <button type="button" className="btn btn-primary action-go" disabled={flow.running || want === 0n || want > pos.held || unsafe} onClick={async () => { if (await flow.run([{ label: `Withdraw ${fmtUnits(want, 18, 2)} k${c.mirrors}`, call: { address: pos.credit, abi: CREDIT_ABI, functionName: "withdrawCollateral", args: [pos.assetId, want] } }], `Withdrew ${fmtUnits(want, 18, 2)} k${c.mirrors}`)) setAmount(""); }}>{want > 0n ? `Withdraw ${fmtUnits(want, 18, 2)} k${c.mirrors}` : "Enter an amount"}</button>
      {flow.steps.length ? <TxStepper steps={flow.steps} note={flow.note} tone={flow.tone} explorerHref={flow.hash ? `https://www.oklink.com/x-layer-testnet/tx/${flow.hash}` : null} /> : null}
    </div>
  );
}

function SupplyTab({ market, pos }: { market: CreditMarket; pos: PositionState }): React.ReactElement {
  const dec = market.loanAsset.decimals, sym = market.loanAsset.symbol;
  const [amount, setAmount] = useState("");
  const [dir, setDir] = useState<"supply" | "withdraw">("supply");
  const flow = useTxFlow({ loanSymbol: sym }, pos.refresh);
  const want = parseAmount(amount, dec);
  const available = BigInt(market.pool.available);
  const steps: FlowStep[] = [];
  if (dir === "supply") {
    if (want > 0n && pos.loanAllowance < want) steps.push({ label: `Approve ${sym}`, call: { address: pos.loan, abi: ERC20_ABI, functionName: "approve", args: [pos.credit, MAX] } });
    if (want > 0n) steps.push({ label: `Supply ${fmtUnits(want, dec, 2)} ${sym}`, call: { address: pos.credit, abi: CREDIT_ABI, functionName: "supply", args: [want] } });
  } else if (want > 0n && pos.supplied > 0n) {
    const shares = want >= pos.supplied ? pos.shares : (pos.shares * want) / pos.supplied;
    steps.push({ label: `Withdraw ${fmtUnits(want, dec, 2)} ${sym}`, call: { address: pos.credit, abi: CREDIT_ABI, functionName: "withdraw", args: [shares] } });
  }
  return (
    <div className="action">
      <div className="segmented" role="radiogroup" aria-label="Supply or withdraw">
        <button type="button" role="radio" aria-checked={dir === "supply"} onClick={() => setDir("supply")}>Supply</button>
        <button type="button" role="radio" aria-checked={dir === "withdraw"} onClick={() => setDir("withdraw")}>Withdraw</button>
      </div>
      <Field label={`${dir === "supply" ? "Supply" : "Withdraw"} (${sym})`} value={amount} onChange={setAmount} unit={sym}
        onMax={() => setAmount(fmtUnits(dir === "supply" ? pos.loanBalance : (pos.supplied < available ? pos.supplied : available), dec, 6).replace(/,/g, ""))}
        help={`You have supplied ${fmtUnits(pos.supplied, dec, 2)} · wallet ${fmtUnits(pos.loanBalance, dec, 2)} · the pool has ${fmtUnits(available, dec, 2)} ${sym} not lent out.`} />
      <button type="button" className="btn btn-primary action-go" disabled={flow.running || steps.length === 0} onClick={async () => { if (await flow.run(steps, `${dir === "supply" ? "Supplied" : "Withdrew"} ${fmtUnits(want, dec, 2)} ${sym}`)) setAmount(""); }}>{want > 0n ? `${dir === "supply" ? "Supply" : "Withdraw"} ${fmtUnits(want, dec, 2)} ${sym}` : "Enter an amount"}</button>
      {flow.steps.length ? <TxStepper steps={flow.steps} note={flow.note} tone={flow.tone} explorerHref={flow.hash ? `https://www.oklink.com/x-layer-testnet/tx/${flow.hash}` : null} /> : null}
    </div>
  );
}

// ----------------------------------------------------------------------------- workspace

export function CreditWorkspace({ market, demo }: { market: CreditMarket; demo: DemoClock }): React.ReactElement {
  const [idx, setIdx] = useState(0);
  const c = market.collaterals[idx] ?? market.collaterals[0]!;
  const now = useNow();
  const d = now === null ? demo : scheduleAt(demo, now);
  const pos = usePosition(market, c, d.state === "LAST_CALL");
  const [tab, setTab] = useState<string>("borrow");
  useEffect(() => { const on = (): void => pos.refresh(); window.addEventListener("focus", on); return () => window.removeEventListener("focus", on); }); // re-check gas and balances when a visitor returns from the faucet
  const tabs = useMemo(() => [
    { id: "borrow", label: "Borrow", content: <BorrowTab market={market} c={c} pos={pos} demo={d} /> },
    { id: "supply", label: "Supply", content: <SupplyTab market={market} pos={pos} /> },
    { id: "repay", label: "Repay", content: <RepayTab market={market} c={c} pos={pos} /> },
    { id: "withdraw", label: "Withdraw", content: <WithdrawTab market={market} c={c} pos={pos} /> },
  ], [market, c, pos, d]);
  return (
    <div className="credit-zones">
      <aside className="zone zone-left" aria-label="Collateral and setup">
        <span className="t-label">Collateral</span>
        <div className="coll-list">{market.collaterals.map((x, i) => <CollateralCard key={x.assetId} c={x} selected={i === idx} onSelect={() => setIdx(i)} demo={d} />)}</div>
        <Setup market={market} c={c} pos={pos} />
      </aside>
      <section className="zone zone-centre" aria-label="Action">
        <Tabs label="Credit action" tabs={tabs} onChange={setTab} value={tab} />
      </section>
      <aside className="zone zone-right" aria-label="Your position">
        <PositionPanel market={market} c={c} pos={pos} demo={d} onRepay={() => { setTab("repay"); document.querySelector(".zone-centre")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} onAddCollateral={() => { setTab("borrow"); document.querySelector(".zone-centre")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
      </aside>
    </div>
  );
}

