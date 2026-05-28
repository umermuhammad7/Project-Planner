import "dotenv/config";
import pg from "pg";

import { env } from "../env.js";

const { Client } = pg;

const client = new Client({
  connectionString: env.DATABASE_URL
});

try {
  await client.connect();
  const result = await client.query<{ current_database: string; current_user: string }>(
    "select current_database(), current_user"
  );
  const row = result.rows[0];
  console.log(`Connected to ${row.current_database} as ${row.current_user}`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown database connection error";
  console.error(`Database connection failed: ${message}`);
  console.error("Check apps/backend/.env and make sure DATABASE_URL points to your local HomeThread database.");
  process.exitCode = 1;
} finally {
  await client.end();
}
