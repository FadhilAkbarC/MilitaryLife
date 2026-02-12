import { env } from '../config/env.js';
import { runMigrations } from './run-migrations.js';

runMigrations(env.DATABASE_URL).catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed', error);
  process.exit(1);
});
