-- Every Terms transaction Kerb sends, recorded append-only for /proof and burn-rate tracking.
CREATE TABLE IF NOT EXISTS "terms_posts" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "ts" timestamp with time zone DEFAULT now() NOT NULL,
  "chain_id" integer NOT NULL,
  "asset_id" text NOT NULL,
  "symbol" text NOT NULL,
  "tx_hash" text NOT NULL,
  "block_number" bigint NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "regime" integer NOT NULL,
  "credit_mark" numeric NOT NULL,
  "carry_ltv" numeric NOT NULL,
  "session_max_ltv" numeric NOT NULL,
  "debt_ceiling" numeric NOT NULL,
  "executable_depth1" numeric NOT NULL,
  "inputs_hash" text NOT NULL,
  "bundle_cid" text NOT NULL,
  "pin_status" text NOT NULL,
  "gas_used" bigint NOT NULL,
  "fee_wei" numeric NOT NULL,
  "clamped" jsonb
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "terms_posts_tx" ON "terms_posts" ("tx_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terms_posts_symbol_ts" ON "terms_posts" ("symbol","ts");
--> statement-breakpoint
CREATE TRIGGER "terms_posts_no_mutation" BEFORE UPDATE OR DELETE ON "terms_posts" FOR EACH ROW EXECUTE FUNCTION kerb_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER "terms_posts_no_truncate" BEFORE TRUNCATE ON "terms_posts" FOR EACH STATEMENT EXECUTE FUNCTION kerb_reject_mutation();
