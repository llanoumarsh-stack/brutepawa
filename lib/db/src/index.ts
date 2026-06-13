import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// APP_DATABASE_URL takes priority over DATABASE_URL.
// Replit forcibly injects its own DATABASE_URL in production (managed DB),
// so we use a separate variable to guarantee our external DB is used.
const dbUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "APP_DATABASE_URL must be set.",
  );
}

function sanitizeDbUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return url;
  }
}

export const pool = new Pool({
  connectionString: sanitizeDbUrl(dbUrl),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 300000,
});
export const db = drizzle(pool, { schema });

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("DB unreachable after retries");
}

export * from "./schema";
