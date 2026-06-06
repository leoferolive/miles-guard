const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL não definida — configure o .env (veja .env.example).');
}

export const DATABASE_URL: string = databaseUrl;
