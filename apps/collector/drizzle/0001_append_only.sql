-- AGENTS.md hard gate 3: never delete or mutate raw observations. Roll forward.
-- Any UPDATE, DELETE or TRUNCATE on an observation table raises. Changing this requires operator approval.
CREATE OR REPLACE FUNCTION kerb_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'kerb: % on append-only table % is forbidden', TG_OP, TG_TABLE_NAME;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['blobs','obs_pool_state','obs_price','obs_multiplier','obs_quote','obs_source_error','collector_cycles','input_bundles'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION kerb_reject_mutation()', t || '_no_mutation', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION kerb_reject_mutation()', t || '_no_truncate', t);
  END LOOP;
END;
$$;
