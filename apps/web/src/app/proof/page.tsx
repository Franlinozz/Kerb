import type { Metadata } from "next";
import { SourceTrouble } from "@/components/States";
import { getProof, PUBLIC_API } from "@/lib/api";
import { age, group, shortHash, utcStamp } from "@/lib/format";

export const metadata: Metadata = { title: "Proof" };
export const dynamic = "force-dynamic";

export default async function ProofPage(): Promise<React.ReactElement> {
  const proof = await getProof();
  if (!proof.ok) {
    return (
      <>
        <h1>Proof</h1>
        <SourceTrouble what="the proof endpoint" detail={proof.error} />
      </>
    );
  }
  const p = proof.data;

  return (
    <>
      <h1>Proof</h1>
      <p className="lede">
        Everything here is read from live state when this page loads: the repository, the chain, the observation
        store and the test run. Nothing on this page is typed in by hand. Check any of it yourself against the
        same public API at <span className="mono">{PUBLIC_API}</span>.
      </p>

      {/* --------------------------------------------------------- build */}
      <section className="section">
        <h2>Build period</h2>
        <p className="section-note">
          {p.build.commits} commits{p.build.firstCommitAt ? `, first on ${p.build.firstCommitAt.slice(0, 10)}` : ""}
          {p.build.latestCommitAt ? `, latest ${p.build.latestCommitAt.slice(0, 10)}` : ""}. Repository:{" "}
          <a href={p.build.repo} target="_blank" rel="noreferrer">{p.build.repo.replace("https://", "")}</a>
        </p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th className="num">Commits</th>
              </tr>
            </thead>
            <tbody>
              {p.build.commitsPerDay.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td className="num">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.build.tests ? (
          <p className="section-note" style={{ marginTop: 12 }}>
            Last test run finished {utcStamp(p.build.tests.finishedAt)} on commit{" "}
            <span className="mono">{p.build.tests.commit.slice(0, 7)}</span>:{" "}
            <strong>{p.build.tests.typescript.passed}</strong> TypeScript tests passed (
            <span className="mono">{p.build.tests.typescript.command}</span>) and{" "}
            <strong>{p.build.tests.solidity.passed}</strong> Solidity tests passed (
            <span className="mono">{p.build.tests.solidity.command}</span>), with{" "}
            {p.build.tests.solidity.failed + p.build.tests.typescript.suitesWithFailures} failures.
          </p>
        ) : (
          <p className="section-note">No test run has been recorded yet.</p>
        )}
      </section>

      {/* --------------------------------------------------------- onchain */}
      <section className="section">
        <h2>Onchain</h2>
        <p className="section-note">Every contract Kerb has deployed, with its verification status.</p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Chain</th>
                <th>Address</th>
                <th className="num">Block</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {p.onchain.deployments.map((d) => (
                <tr key={d.key}>
                  <td>{d.contract}</td>
                  <td className="dim">{d.chainId === 196 ? "X Layer mainnet" : "X Layer testnet"}</td>
                  <td>
                    <a className="mono" href={d.explorer} target="_blank" rel="noreferrer">{shortHash(d.address, 10, 6)}</a>
                  </td>
                  <td className="num">{d.block ?? "—"}</td>
                  <td className="dim">
                    {d.verificationUrl ? (
                      <a href={d.verificationUrl} target="_blank" rel="noreferrer">{d.verification}</a>
                    ) : (
                      d.verification ?? "no"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="section-note" style={{ marginTop: 14 }}>
          Terms posted so far:{" "}
          {p.onchain.postCounts.map((c) => `${c.count} on chain ${c.chainId}`).join(", ")}.
          {p.onchain.latestPosts[0]?.builderCode
            ? ` Builder Code decoded from the calldata of the most recent transaction: ${p.onchain.latestPosts[0].builderCode.join(", ")}.`
            : " No Builder Code could be decoded from the most recent transaction."}
        </p>

        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Posted</th>
                <th>Asset</th>
                <th>Chain</th>
                <th className="num">Gas</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {p.onchain.latestPosts.map((t) => (
                <tr key={t.tx}>
                  <td className="dim">{utcStamp(t.observedAt)}</td>
                  <td>{t.symbol ?? "—"}</td>
                  <td className="dim">{t.chainId}</td>
                  <td className="num">{t.gasUsed ? group(t.gasUsed) : "—"}</td>
                  <td>
                    <a className="mono" href={t.explorer} target="_blank" rel="noreferrer">{shortHash(t.tx)}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------------- data */}
      <section className="section">
        <h2>Data</h2>
        <p className="section-note">
          The observation store is append-only: database triggers reject UPDATE, DELETE and TRUNCATE, so a
          number Kerb published can never be quietly revised.
        </p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Table</th>
                <th className="num">Rows</th>
              </tr>
            </thead>
            <tbody>
              {p.data.totals.map((t) => (
                <tr key={t.table}>
                  <td className="mono">{t.table}</td>
                  <td className="num">{group(String(t.rows))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginTop: 20 }}>Sources</h3>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Last observation</th>
                <th className="num">Age</th>
                <th className="num">Rows</th>
              </tr>
            </thead>
            <tbody>
              {p.data.sources.map((s) => (
                <tr key={s.source}>
                  <td className="mono">{s.source}</td>
                  <td className="dim">{s.lastObservedAt ? utcStamp(s.lastObservedAt) : "never"}</td>
                  <td className="num">{age(s.ageSec)}</td>
                  <td className="num">{group(String(s.rows))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------------- risk */}
      <section className="section">
        <h2>Reproduce a report</h2>
        {p.risk.report ? (
          <>
            <p className="section-note">
              The most recent report Kerb posted, for {p.risk.report.symbol}, observed{" "}
              {utcStamp(p.risk.report.observedAt)}. Its inputs were canonicalised, hashed, and the hash was
              posted on chain with the report. The bundle itself is pinned to IPFS, so anyone can fetch the exact
              bytes and recompute every number from them.
            </p>
            <dl>
              <div className="field">
                <dt>Inputs hash</dt>
                <dd className="mono">{p.risk.report.inputsHash}</dd>
              </div>
              <div className="field">
                <dt>Bundle CID</dt>
                <dd>
                  {p.data.latestBundle?.gateway ? (
                    <a className="mono" href={p.data.latestBundle.gateway} target="_blank" rel="noreferrer">
                      {p.risk.report.cid}
                    </a>
                  ) : (
                    <span className="mono">{p.risk.report.cid ?? "not pinned"}</span>
                  )}
                  <div className="faint field-note">
                    {p.data.latestBundle?.pinStatus === "pinned"
                      ? "Pinned. The CID is computed locally from the canonical bytes and matches what the pinning service returns."
                      : "The CID is computed locally; pinning is not currently configured."}
                  </div>
                </dd>
              </div>
              <div className="field">
                <dt>Recompute it</dt>
                <dd className="mono">{p.risk.report.recomputeCommand}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="section-note">No report has been posted yet.</p>
        )}
      </section>

      {/* --------------------------------------------------------- limitations */}
      <section className="section">
        <h2>Limitations</h2>
        <p className="section-note">
          Where Kerb is running on a lower rung than it could, and what is testnet rather than mainnet. Stated
          here so nobody has to discover it from the code.
        </p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Subsystem</th>
                <th>Rung</th>
                <th className="wrap-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {p.limitations.map((l) => (
                <tr key={l.subsystem}>
                  <td>{l.subsystem}</td>
                  <td className="dim">{l.rung}</td>
                  <td className="dim wrap-cell" style={{ maxWidth: 520 }}>{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="faint" style={{ marginTop: 26, fontSize: "0.8rem" }}>
        Generated {utcStamp(p.generatedAt)}.
      </p>
    </>
  );
}
