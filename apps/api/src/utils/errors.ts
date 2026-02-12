const SERVICE_UNAVAILABLE_DB_CODES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01',
  '28P01',
  '3D000',
  '42P01',
  '53300',
  '57P01',
  '57P02',
  '57P03',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN'
]);

const MESSAGE_HINTS = [
  'connection terminated unexpectedly',
  'could not connect to server',
  'database system is starting up',
  'timeout',
  'connection refused'
];

type ErrorLike = {
  code?: string;
  message?: string;
  cause?: unknown;
};

export function isServiceUnavailableError(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && !seen.has(current)) {
    seen.add(current);
    const candidate = current as ErrorLike;
    const code = typeof candidate.code === 'string' ? candidate.code : undefined;
    const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';

    if (code && SERVICE_UNAVAILABLE_DB_CODES.has(code)) {
      return true;
    }

    if (message && MESSAGE_HINTS.some((hint) => message.includes(hint))) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}

export function toServiceUnavailableResponse() {
  return { error: 'Service temporarily unavailable' };
}

