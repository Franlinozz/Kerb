/**
 * Developers (V2-10, V2-DESIGN-SYSTEM.md section 11.8). The endpoint table is generated from
 * docs/API.md by scripts/api-doc.py, so it cannot drift from the documented API.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { getAddress } from "viem";
import { DevConsole } from "@/components/kerb/DevConsole";
import { PageRail } from "@/components/kerb/PageRail";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProof, PUBLIC_API } from "@/lib/api";
import { shortHash } from "@/lib/format";
import ENDPOINTS from "@/lib/endpoints.json";

export const metadata: Metadata = { title: "Developers", description: "Read Kerb Terms from anywhere: the TypeScript SDK, the REST API and the onchain effectiveTerms call." };
export const revalidate = 60;

const BUILD: { who: string; what: string; code: string }[] = [
  { who: "Lender", what: "Read Carry and the debt ceiling before accepting collateral, and size nothing past either.", code: "if (debt + ask > t.debtCeiling || ltv > t.carryLTV) reject();" },
  { who: "Venue", what: "Use the regime and measured depth to set margin and size limits by market time.", code: "limits = t.regime.value === \"THIN\" ? tight : normal;" },
  { who: "Agent", what: "Refuse new exposure whenever usable is false; keep repaying and curing.", code: "if (!t.usable) return hold();" },
];
/** A runnable example for an endpoint, or null when it needs an id only the reader has. */
function exampleUrl(path: string): string | null {
  const credit = path.startsWith("/v1/credit");
  const u = path.replace(":chain", credit ? "1952" : "196").replace(":asset", "BRK.Bx").replace(/\?.*$/, "");
  return u.includes(":") ? null : u;
}
const ABIS = ["KerbTerms", "KerbClock", "KerbCredit"];

export default async function DevelopersPage(): Promise<React.ReactElement> {
  const proof = await getProof();
  const deps = proof.ok ? proof.data.onchain.deployments : [];
  const terms196 = deps.find((d) => d.chainId === 196 && d.contract === "KerbTerms");

  return (
    <div className="developers">
      <header className="page-head">
        <span className="t-label">Developers · public API, no key</span>
        <h1>Read Kerb Terms from anywhere.</h1>
        <p className="lede">Terms are posted on chain and served over a public read API, so a lender, venue or agent can act on them without rebuilding equity market risk. Everything below is live.</p>
      </header>
      <PageRail subject={{ kind: "lanes" }} />

      <section className="section">
        <DevConsole api={PUBLIC_API} kerbTerms={terms196 ? getAddress(terms196.address) : "KERB_TERMS_ADDRESS"} symbol="BRK.Bx" />
      </section>

      <section className="section">
        <h2>What you can build</h2>
        <ul className="dev-build" role="list">
          {BUILD.map((b) => (
            <li key={b.who}>
              <span className="t-label">{b.who}</span>
              <p>{b.what}</p>
              <code className="mono">{b.code}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>Endpoints</h2>
        <p className="t-small ink-2">Base URL <span className="mono">{PUBLIC_API}</span>. Every endpoint with a real captured response is in <a href="https://github.com/Franlinozz/Kerb/blob/main/docs/API.md">docs/API.md</a>.</p>
        <dl className="dev-endpoints">
          {ENDPOINTS.map((e) => (
            <div key={e.path}>
              <dt><span className="dev-method mono">{e.method}</span> {exampleUrl(e.path) ? <a className="mono" href={`${PUBLIC_API}${exampleUrl(e.path)}`} target="_blank" rel="noreferrer">{e.path}</a> : <span className="mono">{e.path}</span>}</dt>
              <dd className="ink-2">{e.what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="section">
        <h2>Contracts and ABIs</h2>
        <p className="t-small ink-2">
          ABIs:{" "}
          {ABIS.map((a, i) => <span key={a}>{i ? " · " : ""}<a href={`/abi/${a}.json`} download>{a}.json</a></span>)}
          . Foundry artefacts from <span className="mono">contracts/out</span>, matching the verified sources.
        </p>
        {proof.ok ? (
          <dl className="dev-endpoints">
            {deps.map((d) => (
              <div key={d.key}>
                <dt>{d.contract.replace(":", " ")} <span className="t-small ink-3">· {d.chainId === 196 ? "X Layer mainnet" : "X Layer testnet"}</span></dt>
                <dd><a className="mono" href={d.explorer} target="_blank" rel="noreferrer">{shortHash(d.address, 8, 6)}</a> · {d.verificationUrl ? <a href={d.verificationUrl} target="_blank" rel="noreferrer">{d.verification}</a> : d.verification ?? "Source in repo, verification pending"}</dd>
              </div>
            ))}
          </dl>
        ) : <ErrorState source="The deployment list" />}
        <p className="t-small ink-3 mt-4">Credit runs on X Layer testnet with mirror collateral and a compressed demo clock; the API flags both (<span className="mono">loanAsset.isMock</span>, <span className="mono">contracts.clockIsDemo</span>). <Link href="/methodology#reproducibility">Reproduce any number</Link>.</p>
      </section>
    </div>
  );
}
