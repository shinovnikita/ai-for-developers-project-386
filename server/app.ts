import Fastify, { type FastifyServerOptions } from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import type { MeetingType, MeetingTypeNotFound } from '../api/generated/sdk/types.gen.ts';
import { getAvailability, type WeeklySchedule } from './availability.ts';
import { createMeetingTypeCatalog, registerMeetingTypeRoutes } from './meeting-types.ts';

export type CalendarOptions = {
  databasePath?: string;
  now?: () => Date;
  schedule?: WeeklySchedule;
};

export function buildApp(
  options: FastifyServerOptions = {},
  seed: readonly MeetingType[] = [],
  { databasePath = ':memory:', now = () => new Date(), schedule }: CalendarOptions = {},
) {
  const app = Fastify(options);
  const database = new DatabaseSync(databasePath);
  app.addHook('onClose', async () => database.close());
  const catalog = createMeetingTypeCatalog(database, seed);

  app.get('/health', async () => ({ status: 'ok' }));
  registerMeetingTypeRoutes(app, catalog);
  app.get<{ Params: { meetingTypeId: string } }>(
    '/api/meeting-types/:meetingTypeId/availability',
    async (request, reply) => {
      const meetingType = catalog.find(request.params.meetingTypeId);
      if (!meetingType) {
        return reply.code(404).send({
          code: 'MEETING_TYPE_NOT_FOUND',
          message: 'Тип встречи не найден',
        } satisfies MeetingTypeNotFound);
      }

      return getAvailability(meetingType.durationMinutes, now(), schedule);
    },
  );

  return app;
}
