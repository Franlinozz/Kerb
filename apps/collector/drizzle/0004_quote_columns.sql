-- The depth cross-check needs the exact input amount and the aggregator's own impact figure,
-- so a quote can be compared against the simulation at report time.
ALTER TABLE "obs_quote" ADD COLUMN IF NOT EXISTS "sell_token" text;
--> statement-breakpoint
ALTER TABLE "obs_quote" ADD COLUMN IF NOT EXISTS "buy_token" text;
--> statement-breakpoint
ALTER TABLE "obs_quote" ADD COLUMN IF NOT EXISTS "amount_in" numeric;
--> statement-breakpoint
ALTER TABLE "obs_quote" ADD COLUMN IF NOT EXISTS "price_impact_pct" numeric;
--> statement-breakpoint
ALTER TABLE "obs_quote" ADD COLUMN IF NOT EXISTS "router" text;
--> statement-breakpoint
ALTER TABLE "obs_quote" ADD COLUMN IF NOT EXISTS "symbol" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obs_quote_symbol_ts" ON "obs_quote" ("symbol","ts");
