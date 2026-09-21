import type { Metadata } from "next";
import Link from "next/link";
import { Prov } from "@/components/Value";
import { SourceTrouble } from "@/components/States";
import { getBoard, getCreditMarket, getProof, PUBLIC_API } from "@/lib/api";
import { shortHash } from "@/lib/format";

export const metadata: Metadata = { title: "Developers" };
export const dynamic = "force-dynamic";

const SDK_SNIPPET = `import { Kerb } from "@kerb/sdk";

const kerb = new Kerb();                        // defaults to X Layer mainnet
const terms = await kerb.terms("KOx");

if (!terms.usable) return;                      // no new risk may be taken
const maxDebt = Number(terms.carryLTV.raw) / 1e18 * collateralValue;`;

const VIEM_SNIPPET = `import { createPublicClient, http, keccak256, encodeAbiParameters } from "viem";
import { KERB_TERMS_ABI } from "@kerb/sdk";

const client = createPublicClient({ transport: http("https://rpc.xlayer.tech") });
const assetId = keccak256(
  encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [196n, tokenAddress]),
);

// usable === false means "no new risk may be taken". It never means "liquidate everything".
const [carryLTV, sessionMaxLTV, creditMark, regime, usable] = await client.readContract({
  address: KERB_TERMS,
  abi: KERB_TERMS_ABI,
  functionName: "effectiveTerms",
  args: [assetId],
});`;

const ENDPOINTS: { method: string; path: string; what: string }[] = [
  { method: "GET", path: "/health", what: "Observation freshness and post counts per chain." },
  { method: "GET", path: "/v1/board", what: "Every tracked asset with its regime, mark, depth and capacities, each with provenance." },
  { method: "GET", path: "/v1/terms/:chain/:asset", what: "The latest posted Terms, the pinned bundle behind them, and the last 50 posts." },
  { method: "GET", path: "/v1/clock/:chain/:asset", what: "Session now, next transition, next weakening, the Last Call window, and the week's session geometry." },
  { method: "GET", path: "/v1/report/:chain/:asset", what: "The full Market-Time Report recomputed from current observations, including the impact curve venue by venue." },
  { method: "GET", path: "/v1/credit/:chain", what: "The credit market: pool state, listed collateral, the fixed liquidation thresholds." },
  { method: "GET", path: "/v1/credit/:chain/position/:user/:assetId", what: "A position's health, covenant target and exact cure amount. Public, because cure is permissionless." },
  { method: "GET", path: "/v1/params", what: "The KTS parameter set the engine is running on." },
  { method: "GET", path: "/v1/proof", what: "Build period, deployments, observation counts, the latest pinned bundle and the degradation rungs." },
  { method: "GET", path: "/v1/market-time", what: "Published Market-Time Reports." },
  { method: "GET", path: "/v1/bundle/:hash", what: "The canonical input bundle behind a report, by its inputs hash." },
];

export default async function DevelopersPage(): Promise<React.ReactElement> {
  const [board, credit, proof] = await Promise.all([getBoard(), getCreditMarket(), getProof()]);
  const mainnet = proof.ok ? proof.data.onchain.deployments.filter((d) => d.chainId === 196) : [];
  const testnet = proof.ok ? proof.data.onchain.deployments.filter((d) => d.chainId === 1952) : [];

  return (
    <>
      <h1>Developers</h1>
      <p className="lede">
        Kerb Terms are published on chain and over a public read API, so another lender, curator or venue
        operator can act on them without rebuilding equity market risk logic. Everything below is live. Nothing
        needs a key.
      </p>

      <section className="section">
        <h2>Read the Terms from the chain</h2>
        <p className="section-note">
          The authoritative source. No API in the path, no trust in Kerb&rsquo;s servers — just the contract.
        </p>
        <pre className="code">{VIEM_SNIPPET}</pre>
        <p className="section-note">
          <code className="mono">usable</code> is the field that matters: false means no new risk may be taken
          against this asset right now, because the report is stale or the regime is STALE or HALTED. It never
          means liquidate. Repayment and cures keep working in every state.
        </p>
      </section>

      <section className="section">
        <h2>Or with the SDK</h2>
        <pre className="code">{SDK_SNIPPET}</pre>
        <p className="section-note">
          Every value is a decimal string with the provenance label it was published under. Ratios are WAD;
          depth and ceilings are in loan-asset units, and the response says which.
        </p>
      </section>

      <section className="section">
        <h2>REST</h2>
        <p className="section-note">
          Base URL <span className="mono">{PUBLIC_API}</span>. CORS is open for reads. No key, no rate limit
          beyond what is reasonable, no secrets in any error payload.
        </p>
        <p className="scroll-hint">Scroll the table sideways for what each endpoint returns.</p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th className="wrap-cell">Returns</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path}>
                  <td className="dim">{e.method}</td>
                  <td className="mono">{e.path}</td>
                  <td className="dim wrap-cell">{e.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="section-note" style={{ marginTop: 10 }}>
          Try one now:{" "}
          <a href={`${PUBLIC_API}/v1/board`} target="_blank" rel="noreferrer" className="mono">
            {PUBLIC_API}/v1/board
          </a>
          {board.ok ? (
            <>
              {" "}
              — currently {board.data.rows.length} assets <Prov label="Observed" />
            </>
          ) : null}
        </p>
      </section>

      <section className="section">
        <h2>Contracts and ABIs</h2>
        <p className="section-note">
          ABIs are the Foundry artefacts in <span className="mono">contracts/out/</span> of the repository, and
          the source is verified on Sourcify for everything on mainnet.
        </p>
        {proof.ok ? (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Chain</th>
                  <th>Address</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {[...mainnet, ...testnet].map((d) => (
                  <tr key={d.key}>
                    <td>{d.contract}</td>
                    <td className="dim">{d.chainId === 196 ? "mainnet 196" : "testnet 1952"}</td>
                    <td>
                      <a className="mono" href={d.explorer} target="_blank" rel="noreferrer">
                        {shortHash(d.address, 10, 6)}
                      </a>
                    </td>
                    <td className="dim">
                      {d.verificationUrl ? (
                        <a href={d.verificationUrl} target="_blank" rel="noreferrer">{d.verification}</a>
                      ) : (
                        d.verification ?? "in the repository"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <SourceTrouble what="the deployment list" detail={proof.error} />
        )}
      </section>

      <section className="section">
        <h2>The credit market</h2>
        {credit.ok ? (
          <p className="section-note">
            <span className="mono">KerbCredit</span> at{" "}
            <span className="mono">{credit.data.contracts.KerbCredit}</span> on X Layer testnet, loan asset{" "}
            <span className="mono">{credit.data.loanAsset.symbol}</span>. Collateral is mirror collateral with no
            claim on any security, and the clock is a compressed demo clock. Both are flagged in the API
            response itself — <span className="mono">loanAsset.isMock</span> and{" "}
            <span className="mono">contracts.clockIsDemo</span> — so an integrator cannot mistake this for a
            production market even if they never read this page.
          </p>
        ) : (
          <p className="section-note">The credit market is not reachable right now.</p>
        )}
      </section>

      <section className="section">
        <h2>Reproduce anything</h2>
        <p className="section-note">
          Every report pins its input bundle and posts the hash on chain.{" "}
          <span className="mono">pnpm --filter @kerb/engine kerb verify &lt;inputsHash&gt;</span> fetches those
          bytes, checks they hash to the CID they were pinned under, recomputes every number and compares the
          result with what is on chain.{" "}
          <Link href="/methodology">The methodology page walks the whole calculation →</Link>
        </p>
      </section>
    </>
  );
}
