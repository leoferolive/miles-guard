import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { DATABASE_URL } from './env.js';
import * as schema from './schema.js';

/**
 * Cliente postgres-js. Também é o barramento LISTEN/NOTIFY (ADR-0003):
 * use `sql.listen(channel, cb)` e `sql.notify(channel, payload)`.
 */
export const sql = postgres(DATABASE_URL);

export const db = drizzle(sql, { schema });

/** Encerra o pool do Postgres (e desfaz LISTEN/NOTIFY) de forma graciosa no shutdown. */
export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
