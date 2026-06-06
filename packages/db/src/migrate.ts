import 'dotenv/config';

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://nossoradar:nossoradar@localhost:5432/nossoradar';

/**
 * Resolve a pasta de migrations de forma independente do CWD — o initContainer
 * do k8s roda `node packages/db/dist/migrate.js` a partir de `/app`. Tentamos,
 * em ordem: override por env, ao lado do fonte (`src/migrations`, em dev via
 * tsx) e ao lado do build (`dist/migrations`, copiado na imagem).
 */
function resolveMigrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.MIGRATIONS_FOLDER,
    resolve(here, 'migrations'), // dist/migrations (imagem) | src/migrations (tsx)
    resolve(here, '../src/migrations'), // dist/ -> ../src/migrations (monorepo buildado)
    resolve(process.cwd(), 'src/migrations'),
  ].filter((p): p is string => Boolean(p));
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error(
    `pasta de migrations não encontrada (tentado: ${candidates.join(', ')}). ` +
      'Defina MIGRATIONS_FOLDER.',
  );
}

const migrationClient = postgres(databaseUrl, { max: 1 });

await migrate(drizzle(migrationClient), { migrationsFolder: resolveMigrationsFolder() });
await migrationClient.end();

// eslint-disable-next-line no-console
console.log('Migrations aplicadas.');
