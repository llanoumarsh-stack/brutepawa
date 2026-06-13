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
const migrationSql = readFileSync(join(__dirname, "migrations/001_full_text_search.sql"), "utf-8");

const client = new Client(parseDbUrl(rawUrl));
await client.connect();
try {
  console.log("Running migration: 001_full_text_search.sql");
  await client.query(migrationSql);
  console.log("Migration complete.");
} finally {
  await client.end();
}
