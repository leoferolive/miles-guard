import 'dotenv/config';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://nossoradar:nossoradar@localhost:5432/nossoradar';

const migrationClient = postgres(databaseUrl, { max: 1 });

await migrate(drizzle(migrationClient), { migrationsFolder: './src/migrations' });
await migrationClient.end();

// eslint-disable-next-line no-console
console.log('Migrations aplicadas.');
