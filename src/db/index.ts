import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

function createDb() {
  if (!url) return null;
  try {
    const client = postgres(url, { prepare: false, max: 5 });
    return drizzlePg(client, { schema });
  } catch {
    return null;
  }
}

// Lazy singleton — null when DATABASE_URL is unset (build/CI without DB).
// All data-access code must handle `db === null` with graceful empty states.
export const db = createDb();
export type Db = NonNullable<ReturnType<typeof createDb>>;
export const hasDb = () => db !== null;
