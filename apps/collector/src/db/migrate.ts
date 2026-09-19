import { migrate } from "drizzle-orm/postgres-js/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "./client.js";

const { db, sql } = connect();
await migrate(db, { migrationsFolder: resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle") });
console.log("migrations applied");
await sql.end();
