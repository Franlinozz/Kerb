-- V3-06: one row per mainnet post: Kerb's tick-walk C(1%) against the OKX DEX quote at the same
-- notionals, which one bound the capacity, and how old the quote was. Append-only, keyed by post.
CREATE TABLE IF NOT EXISTS "exit_checks" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "chain_id" integer NOT NULL,
  "symbol" text NOT NULL,
  "at" timestamp with time zone NOT NULL,
  "post_id" bigint NOT NULL,
  "tx" text NOT NULL,
  "inputs_hash" text NOT NULL,
  "simulated_c1" text,
  "quoted_c1" text,
  "used_c1" text,
  "delta" text,
  "bound" text NOT NULL,
  "unavailable_reason" text,
  "quote_age_sec" integer,
  "router" text,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "exit_checks_unique" ON "exit_checks" ("chain_id","tx");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exit_checks_symbol_at" ON "exit_checks" ("chain_id","symbol","at");
--> statement-breakpoint
CREATE TRIGGER "exit_checks_no_mutation" BEFORE UPDATE OR DELETE ON "exit_checks" FOR EACH ROW EXECUTE FUNCTION kerb_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER "exit_checks_no_truncate" BEFORE TRUNCATE ON "exit_checks" FOR EACH STATEMENT EXECUTE FUNCTION kerb_reject_mutation();
