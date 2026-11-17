import Fastify, { type FastifyServerOptions } from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import type { MeetingType } from '../api/generated/sdk/types.gen.ts';
import { createMeetingTypeCatalog, registerMeetingTypeRoutes } from './meeting-types.ts';

export function buildApp(
  options: FastifyServerOptions = {},
  seed: readonly MeetingType[] = [],
  { databasePath = ':memory:' } = {},
) {
  const app = Fastify(options);
  const database = new DatabaseSync(databasePath);
  app.addHook('onClose', async () => database.close());
  const catalog = createMeetingTypeCatalog(database, seed);

  app.get('/health', async () => ({ status: 'ok' }));
  registerMeetingTypeRoutes(app, catalog);

  return app;
}
