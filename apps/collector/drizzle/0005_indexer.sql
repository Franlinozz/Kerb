-- Indexer state and decoded chain events. Derived and rebuildable: unlike the observation
-- tables these may be rewritten, which is what makes reorg handling possible.
CREATE TABLE IF NOT EXISTS "indexer_cursor" (
  "chain_id" integer NOT NULL,
  "name" text NOT NULL,
  "last_block" bigint NOT NULL,
  "last_block_hash" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "indexer_cursor_pk" PRIMARY KEY ("chain_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chain_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "chain_id" integer NOT NULL,
  "address" text NOT NULL,
  "event" text NOT NULL,
  "block_number" bigint NOT NULL,
  "block_hash" text NOT NULL,
  "block_ts" timestamp with time zone NOT NULL,
  "tx_hash" text NOT NULL,
  "log_index" integer NOT NULL,
  "asset_id" text,
  "args" jsonb NOT NULL,
  "indexed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chain_events_unique" ON "chain_events" ("chain_id","tx_hash","log_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chain_events_block" ON "chain_events" ("chain_id","block_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chain_events_asset" ON "chain_events" ("chain_id","asset_id","block_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terms_reports" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "chain_id" integer NOT NULL,
  "asset_id" text NOT NULL,
  "symbol" text,
  "observed_at" timestamp with time zone NOT NULL,
  "regime" integer NOT NULL,
  "credit_mark" numeric NOT NULL,
  "carry_ltv" numeric NOT NULL,
  "session_max_ltv" numeric NOT NULL,
  "debt_ceiling" numeric NOT NULL,
  "executable_depth1" numeric NOT NULL,
  "inputs_hash" text NOT NULL,
  "attester" text NOT NULL,
  "tx_hash" text NOT NULL,
  "block_number" bigint NOT NULL,
  "block_hash" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "terms_reports_unique" ON "terms_reports" ("chain_id","tx_hash","asset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terms_reports_asset_ts" ON "terms_reports" ("chain_id","asset_id","observed_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regime_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "chain_id" integer NOT NULL,
  "asset_id" text NOT NULL,
  "symbol" text,
  "from_regime" integer,
  "to_regime" integer NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "tx_hash" text NOT NULL,
  "block_number" bigint NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regime_events_unique" ON "regime_events" ("chain_id","tx_hash","asset_id");
