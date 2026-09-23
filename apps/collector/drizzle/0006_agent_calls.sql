-- V3-03: every paid x402 call to Kerb for Agents. Append-only, like the observation store: a
-- payment record is evidence and is never rewritten.
CREATE TABLE IF NOT EXISTS "agent_calls" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "ts" timestamp with time zone DEFAULT now() NOT NULL,
  "route" text NOT NULL,
  "network" text NOT NULL,
  "payer" text,
  "amount" text NOT NULL,
  "currency" text NOT NULL,
  "settlement_tx" text,
  "response_sha256" text NOT NULL,
  "inputs_hash" text,
  "as_of" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_calls_network_ts" ON "agent_calls" ("network","ts");
--> statement-breakpoint
CREATE TRIGGER "agent_calls_no_mutation" BEFORE UPDATE OR DELETE ON "agent_calls" FOR EACH ROW EXECUTE FUNCTION kerb_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER "agent_calls_no_truncate" BEFORE TRUNCATE ON "agent_calls" FOR EACH STATEMENT EXECUTE FUNCTION kerb_reject_mutation();
