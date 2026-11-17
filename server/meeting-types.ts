import type { FastifyInstance } from 'fastify';
import type { MeetingType } from '../api/generated/sdk/types.gen.ts';

export function registerMeetingTypeRoutes(app: FastifyInstance, catalog: readonly MeetingType[]) {
  app.get('/api/meeting-types', async () => catalog);
}
