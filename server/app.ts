import Fastify, { type FastifyServerOptions } from 'fastify';
import type { MeetingType } from '../api/generated/sdk/types.gen.ts';
import { registerMeetingTypeRoutes } from './meeting-types.ts';

export function buildApp(options: FastifyServerOptions = {}, catalog: readonly MeetingType[] = []) {
  const app = Fastify(options);

  app.get('/health', async () => ({ status: 'ok' }));
  registerMeetingTypeRoutes(app, catalog);

  return app;
}
