-- V3-04: every material change between two consecutive posted terms, with its computed causes.
-- Append-only (same triggers as the observation store); a rerun inserts nothing new because each
-- change is keyed by the post that made it.
CREATE TABLE IF NOT EXISTS "term_changes" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "chain_id" integer NOT NULL,
  "symbol" text NOT NULL,
  "at" timestamp with time zone NOT NULL,
  "field" text NOT NULL,
  "from_value" text NOT NULL,
  "to_value" text NOT NULL,
  "delta" text,
  "headline" text NOT NULL,
  "causes" jsonb NOT NULL,
  "residual" text,
  "prev_post_id" bigint NOT NULL,
  "next_post_id" bigint NOT NULL,
  "prev_tx" text NOT NULL,
  "next_tx" text NOT NULL,
  "prev_inputs_hash" text NOT NULL,
  "next_inputs_hash" text NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "term_changes_unique" ON "term_changes" ("chain_id","next_tx","field");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "term_changes_symbol_at" ON "term_changes" ("chain_id","symbol","at");
--> statement-breakpoint
CREATE TRIGGER "term_changes_no_mutation" BEFORE UPDATE OR DELETE ON "term_changes" FOR EACH ROW EXECUTE FUNCTION kerb_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER "term_changes_no_truncate" BEFORE TRUNCATE ON "term_changes" FOR EACH STATEMENT EXECUTE FUNCTION kerb_reject_mutation();
