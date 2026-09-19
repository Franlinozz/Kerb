import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function databaseUrl(): string {
  const u = process.env["DATABASE_URL"];
  if (!u) throw new Error("DATABASE_URL is not set");
  return u;
}

export function connect(url = databaseUrl()) {
  const sql = postgres(url, { max: 5, idle_timeout: 30, connect_timeout: 15, onnotice: () => {} });
  return { sql, db: drizzle(sql, { schema }) };
}

export type Db = ReturnType<typeof connect>["db"];
export type Sql = ReturnType<typeof connect>["sql"];
