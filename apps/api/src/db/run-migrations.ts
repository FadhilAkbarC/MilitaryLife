import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({
    connectionString,
    max: 1
  });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = join(__dirname, 'migrations');
    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const filename of files) {
      const already = await client.query<{ filename: string }>(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if ((already.rowCount ?? 0) > 0) {
        continue;
      }

      const sql = await readFile(join(migrationsDir, filename), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
