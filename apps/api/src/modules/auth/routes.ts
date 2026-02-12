import type { FastifyInstance, FastifyReply } from 'fastify';
import { parseOrThrow, sendValidationError } from '../../utils/validate.js';
import { loginSchema, registerSchema } from './schema.js';
import { attachAuth, getMe, loginUser, logoutUser, registerUser } from './service.js';

function sendAuthError(reply: FastifyReply, err: unknown): void {
  const dbError = err as { code?: string };

  if (dbError.code === '23505') {
    reply.code(409).send({ error: 'Email already registered' });
    return;
  }

  sendValidationError(reply, err);
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', async (request, reply) => {
    try {
      const body = parseOrThrow(registerSchema, request.body);
      await registerUser(request, reply, body.email, body.password);
    } catch (err) {
      sendAuthError(reply, err);
    }
  });

  app.post('/login', async (request, reply) => {
    try {
      const body = parseOrThrow(loginSchema, request.body);
      await loginUser(request, reply, body.email, body.password);
    } catch (err) {
      sendAuthError(reply, err);
    }
  });

  app.post('/logout', async (request, reply) => {
    await logoutUser(request, reply);
  });

  app.get('/me', async (request, reply) => {
    await attachAuth(request);
    await getMe(request, reply);
  });
}
