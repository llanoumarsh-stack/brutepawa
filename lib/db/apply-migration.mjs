import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const { Client } = pg;

const rawUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
if (!rawUrl) throw new Error("APP_DATABASE_URL must be set");

function parseDbUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    return {
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      database: u.pathname.replace(/^\//, ""),
      ssl: { rejectUnauthorized: false },
    };
  } catch {
    return { connectionString: url, ssl: { rejectUnauthorized: false } };
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlFile = process.argv[2] ?? join(__dirname, "drizzle/0000_broken_dazzler.sql");
const raw = readFileSync(sqlFile, "utf-8");

const statements = raw
  .split("--> statement-breakpoint")
  .map(s => s.trim())
  .filter(Boolean)
  .map(s =>
    s
      .replace(/^CREATE TABLE "/, 'CREATE TABLE IF NOT EXISTS "')
      .replace(/^CREATE TYPE "/, 'CREATE TYPE IF NOT EXISTS "')
      .replace(/^CREATE UNIQUE INDEX /, "CREATE UNIQUE INDEX IF NOT EXISTS ")
      .replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS ")
  );

const client = new Client(parseDbUrl(rawUrl));
await client.connect();

let applied = 0;
let skipped = 0;

for (const stmt of statements) {
  try {
    await client.query(stmt);
    applied++;
  } catch (err) {
    if (
      err.code === "42P07" || // duplicate_table
      err.code === "42710" || // duplicate_object (type)
      err.code === "42P06" || // duplicate_schema
      err.message?.includes("already exists")
    ) {
      skipped++;
    } else {
      console.error("Error on statement:", stmt.slice(0, 80));
      console.error(err.message);
    }
  }
}

await client.end();
console.log(`Done — ${applied} applied, ${skipped} already existed.`);
