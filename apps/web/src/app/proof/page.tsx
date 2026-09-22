/**
 * Proof (V2-10, V2-DESIGN-SYSTEM.md section 11.7): a status matrix, every tile with a state and a
 * link, then the disclosures behind each claim. Read from /v1/proof and /health when the page
 * loads; nothing is typed in by hand, and no cell ever reads a bare "no".
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";
import { Disclosure } from "@/components/ui/Disclosure";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { PageRail } from "@/components/kerb/PageRail";
import { PlateHero } from "@/components/kerb/PlateHero";
import { getHealth, getProof, PUBLIC_API, type Proof } from "@/lib/api";
import { age, group, shortHash, utcStamp } from "@/lib/format";

export const metadata: Metadata = { title: "Proof", description: "Every Kerb claim, checkable: contracts and verification, onchain posts, input bundles, the build period and the limitations." };
export const revalidate = 30;

type State = "ok" | "warn" | "info";
interface Tile { name: string; value: string; note: string; state: State; href: string; hrefLabel: string; external?: boolean }

const chainName = (id: number): string => (id === 196 ? "X Layer mainnet" : "X Layer testnet");

/** BUILD_PERIOD.md is a table of date, task, what; rendered grouped by day. */
function buildRows(md: string | null): { date: string; task: string; what: string }[] {
  if (!md) return [];
  return md.split("\n").filter((l) => /^\|\s*\d{1,2} \w{3}/.test(l)).map((l) => {
    const [date = "", task = "", what = ""] = l.split("|").slice(1, -1).map((c) => c.trim());
    return { date, task, what };
  });
}

/** Inline markdown in a BUILD_PERIOD cell: code spans and bold, nothing else. */
function Inline({ text }: { text: string }): React.ReactElement {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return <>{parts.map((p, i) => p.startsWith("`") ? <code key={i}>{p.slice(1, -1)}</code> : p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>)}</>;
}

function tiles(p: Proof, healthPosts: { chainId: number; count: number; lastAt: string | null }[] | null): Tile[] {
  const main = p.onchain.postCounts.find((c) => c.chainId === 196)?.count ?? 0;
  const mainLast = healthPosts?.find((h) => h.chainId === 196)?.lastAt ?? p.onchain.latestPosts.find((x) => x.chainId === 196)?.observedAt ?? null;
  const mainAge = mainLast ? Math.round((Date.parse(p.generatedAt) - Date.parse(mainLast)) / 1000) : null;
  const terms196 = p.onchain.deployments.find((d) => d.chainId === 196 && d.contract === "KerbTerms");
  const riskPlane = p.onchain.deployments.filter((d) => d.chainId === 196);
  const exact = riskPlane.every((d) => d.verification === "Sourcify exact match");
  const credit = p.onchain.deployments.find((d) => d.contract === "KerbCredit");
  const withCode = p.onchain.latestPosts.find((x) => x.builderCode?.length);
  const pin = p.data.pinning;
  const t = p.build.tests;
  const fails = t ? t.typescript.suitesWithFailures + t.solidity.failed : null;
  const v = p.verify ?? null;
  return [
    { name: "Mainnet risk plane", value: `${mainAge !== null && mainAge < 900 ? "Live" : "Behind"} · ${group(String(main))} posts`, note: mainLast ? `Chain 196, last post ${age(mainAge)} ago` : "Chain 196", state: mainAge !== null && mainAge < 900 ? "ok" : "warn", href: terms196?.explorer ?? p.build.repo, hrefLabel: "KerbTerms on OKLink", external: true },
    { name: "KerbClock and KerbTerms source", value: exact ? "Sourcify exact match" : "Source in repo, verification pending", note: `${riskPlane.length} mainnet contracts, bytecode and metadata`, state: exact ? "ok" : "warn", href: terms196?.verificationUrl ?? p.build.repo, hrefLabel: "The Sourcify record", external: true },
    { name: "Builder Code", value: withCode?.builderCode?.join(", ") ?? "Not decoded", note: withCode ? `Decoded from the calldata of ${shortHash(withCode.tx)}` : "The latest transactions could not be read", state: withCode ? "ok" : "warn", href: withCode?.explorer ?? p.build.repo, hrefLabel: "The transaction", external: true },
    { name: "Credit plane", value: `X Layer testnet · ${credit?.verification ?? "Source in repo, verification pending"}`, note: "KerbCredit, mirrors and mock USDG on chain 1952", state: credit?.verification === "Sourcify exact match" ? "ok" : "info", href: "/credit", hrefLabel: "Open Credit" },
    { name: "Input bundles", value: `${group(String(pin.retrievable))} of ${group(String(pin.recentPosts))} retrievable`, note: `Last 24 h: ${pin.pinned} from IPFS, ${group(String(pin.storedByApi))} from the API. Since K-43`, state: pin.retrievable === pin.recentPosts ? "ok" : "warn", href: p.data.latestBundle ? `${PUBLIC_API}${p.data.latestBundle.apiUrl}` : "#reproduce", hrefLabel: "The latest bundle", external: true },
    { name: "Recompute", value: v ? (v.ok ? "Reproduces the chain" : "Mismatch") : "Not checked", note: v ? `${v.symbol ?? "Latest"} under KTS ${v.kts}, ${v.fields.length} fields, checked ${utcStamp(v.checkedAt)}` : "The latest bundle could not be read", state: v?.ok ? "ok" : "warn", href: "#reproduce", hrefLabel: "The field by field result" },
    { name: "Tests", value: t ? `${t.typescript.passed} TS · ${t.solidity.passed} Sol` : "Not recorded", note: t ? `${fails} failing, run ${utcStamp(t.finishedAt)} on ${t.commit.slice(0, 7)}` : "No test run recorded", state: t && fails === 0 ? "ok" : "warn", href: `${p.build.repo}/blob/main/data/test-report.json`, hrefLabel: "The test report", external: true },
    { name: "Mainnet user funds", value: "None held", note: "The mainnet contracts carry terms, not money. Credit runs on testnet", state: "info", href: "#limitations", hrefLabel: "Limitations" },
  ];
}

export default async function ProofPage(): Promise<React.ReactElement> {
  const [proof, health] = await Promise.all([getProof(), getHealth()]);
  if (!proof.ok) {
    return (
      <>
        <PlateHero plate="geometric" label="Proof" title="Kerb is independently verifiable." lede={<p>Everything here is read from live state when this page loads.</p>} />
        <ErrorState source="The proof endpoint" />
      </>
    );
  }
  const p = proof.data;
  const hp = health.ok ? health.data.posts : null;
  const rows = buildRows(p.build.buildPeriodMarkdown);
  const days = [...new Set(rows.map((r) => r.date))];
  const maxDay = Math.max(1, ...p.build.commitsPerDay.map((d) => d.count));

  return (
    <div className="proof">
      <PlateHero
        plate="geometric"
        label={`Proof · generated ${utcStamp(p.generatedAt)}`}
        title="Kerb is independently verifiable."
        lede={<p>Read from live state when this page loads: the repository, the chain, the observation store and the test run. Nothing here is typed in by hand. Check any of it against the same public API at <span className="mono">{PUBLIC_API}</span>.</p>}
      />
      <PageRail subject={{ kind: "lanes" }} />

      <ul className="proof-tiles" role="list">
        {tiles(p, hp).map((t) => (
          <li key={t.name} className="ptile" data-state={t.state}>
            <span className="t-label">{t.name}</span>
            <span className="ptile-value">{t.value}</span>
            <span className="t-small ink-2">{t.note}</span>
            {t.external ? <a href={t.href} target="_blank" rel="noreferrer" className="t-small">{t.hrefLabel}</a> : <Link href={t.href} className="t-small">{t.hrefLabel}</Link>}
          </li>
        ))}
      </ul>

      <div className="proof-disclosures">
        <Disclosure summary={<span>Contracts <span className="ink-3 t-small">· {p.onchain.deployments.length} deployed</span></span>} open>
          <div className="scroll-x">
            <table className="ptable">
              <thead><tr><th>Contract</th><th>Chain</th><th>Address</th><th className="num">Block</th><th>Verification</th></tr></thead>
              <tbody>
                {p.onchain.deployments.map((d) => (
                  <tr key={d.key}>
                    <td data-label="Contract">{d.contract.replace(":", " ")}</td>
                    <td data-label="Chain" className="ink-2">{chainName(d.chainId)}</td>
                    <td data-label="Address"><a className="mono" href={d.explorer} target="_blank" rel="noreferrer">{shortHash(d.address, 8, 6)}</a></td>
                    <td data-label="Block" className="num mono">{d.block ?? "Not recorded"}</td>
                    <td data-label="Verification">{d.verificationUrl ? <a href={d.verificationUrl} target="_blank" rel="noreferrer">{d.verification}</a> : d.verification ?? "Source in repo, verification pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>

        <Disclosure summary={<span>Latest Terms posts <span className="ink-3 t-small">· {p.onchain.postCounts.map((c) => `${group(String(c.count))} on ${c.chainId}`).join(", ")}</span></span>}>
          <div className="scroll-x">
            <table className="ptable">
              <thead><tr><th>Posted</th><th>Asset</th><th>Chain</th><th className="num">Gas</th><th>Builder Code</th><th>Transaction</th></tr></thead>
              <tbody>
                {p.onchain.latestPosts.map((t) => (
                  <tr key={t.tx}>
                    <td data-label="Posted" className="ink-2">{utcStamp(t.observedAt)}</td>
                    <td data-label="Asset">{t.symbol ?? "Unknown asset"}</td>
                    <td data-label="Chain" className="ink-2">{chainName(t.chainId)}</td>
                    <td data-label="Gas" className="num mono">{t.gasUsed ? group(t.gasUsed) : "Not recorded"}</td>
                    <td data-label="Builder Code" className="mono">{t.builderCode?.join(", ") ?? "Not decoded"}</td>
                    <td data-label="Transaction"><a className="mono" href={t.explorer} target="_blank" rel="noreferrer">{shortHash(t.tx)}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-small ink-3 mt-3">Each Builder Code is decoded from that transaction&apos;s own calldata (ERC-8021 suffix), not repeated from configuration.</p>
        </Disclosure>

        <Disclosure summary={<span>Build period <span className="ink-3 t-small">· {p.build.commits} commits{p.build.firstCommitAt ? ` since ${p.build.firstCommitAt.slice(0, 10)}` : ""}</span></span>}>
          <figure className="commit-bars" aria-label="Commits per day">
            {p.build.commitsPerDay.map((d) => (
              <div key={d.date} className="cb">
                <span className="cb-n mono">{d.count}</span>
                <span className="cb-bar" style={{ height: `${Math.max(4, (d.count / maxDay) * 96)}px` }} />
                <span className="cb-d t-small ink-3">{d.date.slice(5)}</span>
              </div>
            ))}
          </figure>
          <p className="t-small ink-2">Repository <a href={p.build.repo} target="_blank" rel="noreferrer">{p.build.repo.replace("https://", "")}</a>. BUILD_PERIOD.md, one line per functionality:</p>
          <div className="build-log">
            {days.map((day) => (
              <section key={day}>
                <h3 className="t-label">{day}</h3>
                <ul role="list">
                  {rows.filter((r) => r.date === day).map((r, i) => <li key={i}><span className="mono ink-3">{r.task}</span><span><Inline text={r.what} /></span></li>)}
                </ul>
              </section>
            ))}
          </div>
        </Disclosure>

        <Disclosure summary={<span>Data store <span className="ink-3 t-small">· append-only</span></span>}>
          <p className="t-small ink-2">Database triggers reject UPDATE, DELETE and TRUNCATE on every observation table, so a number Kerb published can never be quietly revised.</p>
          <div className="proof-two">
            <div className="scroll-x">
              <table className="ptable">
                <thead><tr><th>Table</th><th className="num">Rows</th></tr></thead>
                <tbody>{p.data.totals.map((t) => <tr key={t.table}><td data-label="Table" className="mono">{t.table}</td><td data-label="Rows" className="num mono">{group(String(t.rows))}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="scroll-x">
              <table className="ptable">
                <thead><tr><th>Source</th><th className="num">Age</th><th className="num">Rows</th></tr></thead>
                <tbody>{p.data.sources.map((s) => <tr key={s.source}><td data-label="Source" className="mono">{s.source}</td><td data-label="Age" className="num">{s.lastObservedAt ? age(s.ageSec) : "No observation yet"}</td><td data-label="Rows" className="num mono">{group(String(s.rows))}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </Disclosure>

        <div id="reproduce">
          <Disclosure summary={<span>Reproduce a report <span className="ink-3 t-small">· {p.verify ? (p.verify.ok ? "last check reproduces" : "last check mismatched") : "run it yourself"}</span></span>} open>
            {p.risk.report ? (
              <>
                <p className="t-small ink-2">The most recent report Kerb posted, {p.risk.report.symbol}, observed {utcStamp(p.risk.report.observedAt)}. Its inputs were canonicalised and hashed, and the hash went on chain with the terms. {p.data.pinning.note}</p>
                <dl className="proof-dl">
                  <div><dt>Inputs hash</dt><dd className="mono">{p.risk.report.inputsHash}</dd></div>
                  <div><dt>Bundle CID</dt><dd className="mono">{p.risk.report.cid ?? "Not computed"}{p.data.latestBundle?.pinStatus === "pinned" ? " · pinned on IPFS" : " · served by the API"}</dd></div>
                  {p.data.latestBundle ? <div><dt>The bytes</dt><dd><a href={`${PUBLIC_API}${p.data.latestBundle.apiUrl}`} target="_blank" rel="noreferrer">Fetch this bundle</a></dd></div> : null}
                </dl>
                <CodeBlock variants={[{ lang: "shell", code: p.risk.report.recomputeCommand }]} />
                {p.verify ? (
                  <div className="verify-result" data-ok={p.verify.ok || undefined}>
                    <span className="t-label">Last verify · {utcStamp(p.verify.checkedAt)} · {p.verify.symbol} on {chainName(p.verify.chainId)} · KTS {p.verify.kts}</span>
                    <ul role="list">
                      {p.verify.fields.map((f) => <li key={f.field}><span className="mono">{f.field}</span><span>{f.verdict === "matches" ? "Matches" : f.verdict === "clamped tighter onchain" ? "Clamped tighter onchain" : "Differs"}</span></li>)}
                    </ul>
                    <p className="t-small ink-3">Recomputed by the API from the stored bundle under the formula and parameters it carries, then compared with the posted transaction <a className="mono" href={`https://www.oklink.com/${p.verify.chainId === 196 ? "xlayer" : "x-layer-testnet"}/tx/${p.verify.tx}`} target="_blank" rel="noreferrer">{shortHash(p.verify.tx)}</a>. The attester may only clamp tighter, never looser.</p>
                  </div>
                ) : null}
              </>
            ) : <p className="t-small ink-2">No report has been posted yet.</p>}
          </Disclosure>
        </div>

        <div id="limitations">
          <Disclosure summary={<span>Limitations <span className="ink-3 t-small">· {p.limitations.length} subsystems</span></span>} open>
            <p className="t-small ink-2">Where Kerb runs on a lower rung than it could, and what is testnet rather than mainnet. Stated here so nobody has to find it in the code.</p>
            <dl className="proof-dl">
              {p.limitations.map((l) => <div key={l.subsystem}><dt>{l.subsystem}</dt><dd className="ink-2">{l.note}{/^n\/?a$/i.test(l.rung.trim()) ? null : <span className="proof-rung t-small ink-3">Rung {l.rung}</span>}</dd></div>)}
            </dl>
          </Disclosure>
        </div>
      </div>
    </div>
  );
}
