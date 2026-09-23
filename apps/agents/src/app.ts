/**
 * Kerb for Agents (V3-03): the Express app, built from its parts so tests can swap the upstream
 * API and the facilitator. Order matters: rate limit, then input validation (bad input gets a
 * plain 400 or 404, never a 402), then the x402 middleware, then the answer. No stack trace or
 * library error text ever reaches a caller.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { paymentMiddleware } from "@okxweb3/x402-express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { creditCheck, decimalInput, exitCheck, explainNow, InputError, resolveAsset } from "./compute.js";
import { routeConfig, type PayConfig } from "./pay.js";
import { mcpServer } from "./mcp.js";
import { UpstreamError, type Upstream } from "./upstream.js";
import type { x402ResourceServer } from "@okxweb3/x402-express";

export interface AppDeps {
  upstream: Upstream;
  pay: PayConfig;
  server: x402ResourceServer;
  publicBase?: string;
  /** Fetch the facilitator's supported kinds on start; off in tests. */
  syncFacilitatorOnStart?: boolean;
  limits?: { paidPerMin: number; freePerMin: number; mcpPerMin: number };
}

/** A fixed-window limiter per IP. Plain words when it trips. */
function limiter(perMin: number): (req: Request, res: Response, next: NextFunction) => void {
  const hits = new Map<string, { start: number; n: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const h = hits.get(key);
    if (!h || now - h.start >= 60_000) { hits.set(key, { start: now, n: 1 }); if (hits.size > 10_000) hits.clear(); return next(); }
    if (++h.n > perMin) { res.status(429).set("retry-after", String(Math.ceil((h.start + 60_000 - now) / 1000))).json({ error: `rate limit: at most ${perMin} requests a minute from one address` }); return; }
    next();
  };
}

const params = (req: Request): Record<string, unknown> => ({ ...(req.query as Record<string, unknown>), ...(req.method === "POST" && req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {}) });

export function createApp(d: AppDeps): express.Express {
  const app = express();
  const base = d.publicBase ?? "https://api.usekerb.xyz";
  const lim = d.limits ?? { paidPerMin: 60, freePerMin: 120, mcpPerMin: 60 };
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(express.json({ limit: "8kb" }));

  // Validate before asking for payment: an agent is never charged for a question Kerb cannot answer.
  const validate = (kind: "credit" | "exit") => (req: Request, res: Response, next: NextFunction): void => {
    try {
      const p = params(req);
      // An empty request is discovery (x402 clients and directories probe this way): it gets the
      // 402 with the payment requirements. If paid with no question, the answer is a 400, never settled.
      if (Object.keys(p).length === 0) { next(); return; }
      resolveAsset(p["asset"], d.upstream.assets());
      if (kind === "credit") decimalInput(p["amount"], "amount"); else decimalInput(p["sizeUSDG"], "sizeUSDG");
      next();
    } catch (e) { next(e); }
  };
  const credit = routeConfig(d.pay, "Kerb Credit Check: safe borrow and cure deadline for a tokenized stock on X Layer");
  const exit = routeConfig(d.pay, "Kerb Exit Check: measured executable exit for a tokenized stock on X Layer");
  app.use(["/agents/credit-check", "/agents/exit-check"], limiter(lim.paidPerMin));
  app.use("/agents/credit-check", validate("credit"));
  app.use("/agents/exit-check", validate("exit"));
  app.use(paymentMiddleware({
    "GET /agents/credit-check": credit, "POST /agents/credit-check": credit,
    "GET /agents/exit-check": exit, "POST /agents/exit-check": exit,
  }, d.server, undefined, undefined, d.syncFacilitatorOnStart ?? true));

  const answerCredit = async (req: Request, res: Response): Promise<void> => {
    const p = params(req);
    const asset = resolveAsset(p["asset"], d.upstream.assets());
    const terms = await d.upstream.terms(asset.symbol);
    const [report, board] = await Promise.all([d.upstream.report(terms.inputsHash), d.upstream.boardRow(asset.symbol)]);
    res.json(creditCheck({ asset: p["asset"], amount: p["amount"], unit: p["unit"], mode: p["mode"], chain: p["chain"] }, { asset: { ...asset, assetId: terms.assetId }, terms, report, board }));
  };
  const answerExit = async (req: Request, res: Response): Promise<void> => {
    const p = params(req);
    const asset = resolveAsset(p["asset"], d.upstream.assets());
    const terms = await d.upstream.terms(asset.symbol);
    res.json(exitCheck({ asset: p["asset"], sizeUSDG: p["sizeUSDG"] }, { asset, terms, report: await d.upstream.report(terms.inputsHash) }));
  };
  app.get("/agents/credit-check", answerCredit);
  app.post("/agents/credit-check", answerCredit);
  app.get("/agents/exit-check", answerExit);
  app.post("/agents/exit-check", answerExit);

  // Free: public terms stay public.
  app.use(["/agents/terms", "/agents/health"], limiter(lim.freePerMin));
  app.get("/agents/health", (_req, res) => { res.json({ status: "ok", network: d.pay.network, price: d.pay.price }); });
  app.get("/agents/terms", (_req, res) => { res.json({ assets: d.upstream.assets().map((a) => ({ symbol: a.symbol, token: a.token })), paid: [`${base}/agents/credit-check`, `${base}/agents/exit-check`], network: d.pay.network, price: d.pay.price }); });
  app.get("/agents/terms/:asset", async (req, res) => {
    const a = resolveAsset(req.params["asset"], d.upstream.assets());
    const t = await d.upstream.terms(a.symbol);
    const r = await d.upstream.report(t.inputsHash);
    const { history: _h, ...rest } = t as unknown as Record<string, unknown>;
    res.json({ ...rest, why: explainNow(r), whyKind: "now" });
  });

  // MCP: stateless streamable HTTP, a fresh server and transport per request.
  app.all("/mcp", limiter(lim.mcpPerMin), async (req, res) => {
    if (req.method !== "POST") { res.status(405).set("allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "use POST: this MCP server is stateless" }, id: null }); return; }
    const server = mcpServer(d.upstream, d.pay, base);
    // Stateless: no session id generator (the SDK's own stateless mode), JSON answers rather than SSE.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);
    res.on("close", () => { void transport.close(); void server.close(); });
    await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
    await transport.handleRequest(req, res, req.body);
  });

  app.use((_req, res) => { res.status(404).json({ error: "not found; see GET /agents/terms" }); });
  // Labelled errors only: never a stack trace or a library message.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    if (err instanceof InputError) { res.status(err.status).json({ error: err.message }); return; }
    if (err instanceof UpstreamError) { res.status(503).json({ error: `Kerb could not answer right now: ${err.message}` }); return; }
    if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.parse.failed") { res.status(400).json({ error: "the body is not valid JSON" }); return; }
    res.status(500).json({ error: "Kerb could not answer right now" });
  });
  return app;
}
