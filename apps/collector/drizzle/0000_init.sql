CREATE TABLE "blobs" (
	"cid" text PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"media_type" text NOT NULL,
	"encoding" text NOT NULL,
	"size" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collector_cycles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"loop" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"ok" integer NOT NULL,
	"failed" integer NOT NULL,
	"mode" text NOT NULL,
	"host" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "input_bundles" (
	"hash" text PRIMARY KEY NOT NULL,
	"cid" text,
	"ts" timestamp with time zone NOT NULL,
	"asset_id" text NOT NULL,
	"size" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obs_multiplier" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"asset_id" text NOT NULL,
	"symbol" text NOT NULL,
	"source" text NOT NULL,
	"multiplier" numeric NOT NULL,
	"pending_multiplier" numeric,
	"pending_activates_at" timestamp with time zone,
	"wrapper_assets_per_share" numeric,
	"block_number" bigint,
	"halted" text,
	"raw_blob_cid" text NOT NULL,
	"content_hash" text NOT NULL,
	"mode" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obs_pool_state" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"chain_id" integer NOT NULL,
	"pool" text NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" text NOT NULL,
	"block_ts" timestamp with time zone NOT NULL,
	"sqrt_price_x96" numeric NOT NULL,
	"tick" integer NOT NULL,
	"liquidity" numeric NOT NULL,
	"tick_spacing" integer NOT NULL,
	"fee" integer NOT NULL,
	"ticks_count" integer NOT NULL,
	"ticks_blob_cid" text NOT NULL,
	"source" text NOT NULL,
	"content_hash" text NOT NULL,
	"mode" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obs_price" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"asset_id" text,
	"symbol" text NOT NULL,
	"source" text NOT NULL,
	"value" numeric NOT NULL,
	"currency" text NOT NULL,
	"source_ts" timestamp with time zone,
	"confidence" numeric,
	"raw_blob_cid" text NOT NULL,
	"content_hash" text NOT NULL,
	"mode" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obs_quote" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"asset_id" text NOT NULL,
	"notional" numeric NOT NULL,
	"quote_out" numeric NOT NULL,
	"source" text NOT NULL,
	"raw_blob_cid" text NOT NULL,
	"content_hash" text NOT NULL,
	"mode" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obs_source_error" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"loop" text NOT NULL,
	"source" text NOT NULL,
	"subject" text NOT NULL,
	"error" text NOT NULL,
	"http_status" integer,
	"raw_blob_cid" text,
	"mode" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collector_cycles_loop_started" ON "collector_cycles" USING btree ("loop","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "input_bundles_cid" ON "input_bundles" USING btree ("cid");--> statement-breakpoint
CREATE INDEX "obs_multiplier_symbol_ts" ON "obs_multiplier" USING btree ("symbol","ts");--> statement-breakpoint
CREATE INDEX "obs_pool_state_pool_ts" ON "obs_pool_state" USING btree ("pool","ts");--> statement-breakpoint
CREATE INDEX "obs_pool_state_ts" ON "obs_pool_state" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "obs_price_symbol_ts" ON "obs_price" USING btree ("symbol","ts");--> statement-breakpoint
CREATE INDEX "obs_price_source_ts" ON "obs_price" USING btree ("source","ts");--> statement-breakpoint
CREATE INDEX "obs_source_error_ts" ON "obs_source_error" USING btree ("ts");