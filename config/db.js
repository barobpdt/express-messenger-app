import { ENV } from "./env.js";
import * as schema from "../db/schema.js";

let db;
let sql;

if (ENV.DB_DRIVER === "local") {
    // ── 로컬 PostgreSQL (postgres 패키지) ──────────────────────────────────────
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");

    const client = postgres(ENV.LOCAL_URL);
    sql = client;                         // raw SQL: sql`SELECT ...`
    db = drizzle(client, { schema });

    console.log("🐘 [DB] 로컬 PostgreSQL 연결:", ENV.LOCAL_URL?.split("@")[1]);
} else {
    // ── Neon 클라우드 PostgreSQL ────────────────────────────────────────────────
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");

    const client = neon(ENV.DATABASE_URL);
    sql = client;                         // raw SQL: sql`SELECT ...`
    db = drizzle(client, { schema });

    console.log("☁️  [DB] Neon 클라우드 연결");
}

export { db, sql };
