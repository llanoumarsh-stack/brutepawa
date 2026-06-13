import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

try {
  const rawDbUrl = process.env["APP_DATABASE_URL"] ?? process.env["DATABASE_URL"] ?? "";
  const dbUrl = new URL(rawDbUrl);
  dbUrl.searchParams.delete("channel_binding");
  logger.info({ host: dbUrl.hostname, db: dbUrl.pathname, pooler: dbUrl.hostname.includes("pooler") }, "DB config");
} catch {
  logger.warn("Could not parse database URL");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
