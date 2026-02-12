ALTER TABLE IF EXISTS users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS profiles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS sessions ALTER COLUMN id DROP DEFAULT;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM users
      GROUP BY lower(email)
      HAVING COUNT(*) > 1
    ) THEN
      RAISE NOTICE 'Skipping idx_users_email_lower_unique due duplicate case-insensitive email rows';
    ELSE
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique ON users ((lower(email)));
    END IF;
  END IF;
END$$;
