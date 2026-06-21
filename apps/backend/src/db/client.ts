import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { env } from "../env.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
  application_name: "homethread-backend"
});

export const db = drizzle(pool, { schema });
