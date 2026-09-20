-- Daily bar history for the underlyings (stress statistics only). Append-only like every
-- other observation table: a re-ingest inserts nothing for dates already recorded.
CREATE TABLE IF NOT EXISTS "ref_daily_bars" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source" text NOT NULL,
  "symbol" text NOT NULL,
  "underlying" text NOT NULL,
  "date" text NOT NULL,
  "open" numeric NOT NULL,
  "close" numeric NOT NULL,
  "currency" text NOT NULL,
  "raw_blob_cid" text NOT NULL,
  "content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ref_daily_bars_key" ON "ref_daily_bars" ("source","symbol","date");
--> statement-breakpoint
CREATE TRIGGER "ref_daily_bars_no_mutation" BEFORE UPDATE OR DELETE ON "ref_daily_bars" FOR EACH ROW EXECUTE FUNCTION kerb_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER "ref_daily_bars_no_truncate" BEFORE TRUNCATE ON "ref_daily_bars" FOR EACH STATEMENT EXECUTE FUNCTION kerb_reject_mutation();
