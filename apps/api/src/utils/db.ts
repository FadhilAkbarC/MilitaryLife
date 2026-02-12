import type { Pool, PoolClient } from 'pg';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function probeDatabase(db: Queryable, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Database probe timed out after ${timeoutMs}ms`) as Error & { code?: string };
      error.code = 'ETIMEDOUT';
      reject(error);
    }, timeoutMs);
  });

  try {
    await Promise.race([db.query('SELECT 1'), timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

