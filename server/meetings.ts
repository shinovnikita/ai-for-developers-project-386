import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import type { CreateMeetingInput, Meeting, MeetingConfirmation, Slot, UpcomingMeetings } from '../api/generated/sdk/types.gen.ts';
import { calendarTimeZone } from '../shared/calendar-time.ts';
import { getSlot, overlaps, utcTimestamp, type WeeklySchedule } from './availability.ts';
import { meetingTypeNotFound, type createMeetingTypeCatalog } from './meeting-types.ts';

type MeetingRequest = Partial<Record<keyof CreateMeetingInput, unknown>> | null | undefined;
type Booking = Omit<CreateMeetingInput, 'startsAt'> & { startsAt: number };

function meetingFromRow(row: Record<string, SQLOutputValue>): Meeting {
  return {
    id: String(row.id),
    meetingTypeId: String(row.meeting_type_id),
    meetingTypeName: String(row.meeting_type_name),
    guestName: String(row.guest_name),
    startsAt: utcTimestamp(Number(row.starts_at)),
    endsAt: utcTimestamp(Number(row.ends_at)),
  };
}

const validationError = {
  code: 'VALIDATION_ERROR',
  message: 'Проверьте поля запроса',
};
const utcDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d+))?Z$/;
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function parseStart(value: unknown) {
  if (typeof value !== 'string') return NaN;
  const match = utcDateTime.exec(value);
  if (!match) return NaN;

  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 19) !== value.slice(0, 19)) {
    return NaN;
  }
  // Date.parse truncates fractions beyond milliseconds. Keep such a start off the slot grid.
  return /[1-9]/.test(match[1]?.slice(3) ?? '') ? time + 0.5 : time;
}

function validateBooking(body: MeetingRequest) {
  const meetingTypeId = body?.meetingTypeId;
  const startsAt = parseStart(body?.startsAt);
  const guestName = typeof body?.guestName === 'string' ? body.guestName.trim() : '';
  const attemptId = body?.attemptId;
  const validName = guestName !== '' && [...guestName].length <= 80;
  const validType = typeof meetingTypeId === 'string' && meetingTypeId.trim() !== '';
  const validAttempt = typeof attemptId === 'string' && uuid.test(attemptId);

  if (validType && Number.isFinite(startsAt) && validName && validAttempt) {
    return { input: { meetingTypeId, startsAt, guestName, attemptId: attemptId.toLowerCase() } };
  }

  const fieldErrors: Partial<Record<keyof CreateMeetingInput, string>> = {};
  if (!validType) fieldErrors.meetingTypeId = 'Выберите тип встречи';
  if (!Number.isFinite(startsAt)) fieldErrors.startsAt = 'Укажите время начала в UTC';
  if (!validName) fieldErrors.guestName = guestName ? 'Укажите имя до 80 символов' : 'Укажите имя';
  if (!validAttempt) fieldErrors.attemptId = 'Укажите UUID попытки записи';
  return { fieldErrors };
}

export function createMeetingStore(
  database: DatabaseSync,
  catalog: ReturnType<typeof createMeetingTypeCatalog>,
  now: () => Date,
  schedule?: WeeklySchedule,
) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      meeting_type_id TEXT NOT NULL REFERENCES meeting_types(id),
      meeting_type_name TEXT NOT NULL,
      guest_name TEXT NOT NULL,
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      attempt_id TEXT NOT NULL UNIQUE
    ) STRICT
  `);

  const selectUpcoming = database.prepare(`
    SELECT id, meeting_type_id, meeting_type_name, guest_name, starts_at, ends_at
    FROM meetings WHERE starts_at > ? ORDER BY starts_at ASC
  `);

  const selectActive = database.prepare('SELECT starts_at, ends_at FROM meetings WHERE ends_at > ?');
  const insert = database.prepare(`
    INSERT INTO meetings (id, meeting_type_id, meeting_type_name, guest_name, starts_at, ends_at, attempt_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (attempt_id) DO NOTHING
  `);

  function listActiveSlots(currentTime: Date): Slot[] {
    return selectActive.all(currentTime.getTime()).map(({ starts_at, ends_at }) => ({
      startsAt: utcTimestamp(Number(starts_at)),
      endsAt: utcTimestamp(Number(ends_at)),
    }));
  }

  function save({ meetingTypeId, startsAt, guestName, attemptId }: Booking) {
    const meetingType = catalog.find(meetingTypeId);
    if (!meetingType) return { status: 404, body: meetingTypeNotFound } as const;

    const currentTime = now();
    const activeSlots = listActiveSlots(currentTime);
    const slot = getSlot(meetingType.durationMinutes, startsAt, currentTime, schedule, activeSlots);
    if (!slot) {
      return { status: 422, body: { code: 'SLOT_UNAVAILABLE', message: 'Это время больше недоступно' } } as const;
    }
    if (activeSlots.some((meeting) => overlaps(slot, meeting))) {
      return { status: 409, body: { code: 'SLOT_TAKEN', message: 'Это время уже занято' } } as const;
    }

    const meeting: Meeting = {
      id: randomUUID(),
      meetingTypeId,
      meetingTypeName: meetingType.name,
      guestName,
      ...slot,
    };
    const inserted = insert.run(meeting.id, meetingTypeId, meetingType.name, guestName, startsAt, Date.parse(slot.endsAt), attemptId);
    if (inserted.changes === 0) {
      return { status: 409, body: { code: 'ATTEMPT_PAYLOAD_MISMATCH', message: 'Данные попытки записи изменились' } } as const;
    }

    return { status: 201, body: { timeZone: calendarTimeZone, meeting } satisfies MeetingConfirmation } as const;
  }

  return {
    listActiveSlots,
    book(input: Booking) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const result = save(input);
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    listUpcoming(): UpcomingMeetings {
      return {
        timeZone: calendarTimeZone,
        meetings: selectUpcoming.all(now().getTime()).map(meetingFromRow),
      };
    },
  };
}

export function registerMeetingRoutes(app: FastifyInstance, meetings: ReturnType<typeof createMeetingStore>) {
  app.post<{ Body: MeetingRequest }>('/api/meetings', {
    errorHandler(error, _request, reply) {
      if (error.statusCode === 400) return reply.code(400).send(validationError);
      return reply.send(error);
    },
  }, async (request, reply) => {
    const { input, fieldErrors } = validateBooking(request.body);
    if (!input) return reply.code(400).send({ ...validationError, fieldErrors });

    const { status, body } = meetings.book(input);
    return reply.code(status).send(body);
  });

  app.get('/api/meetings/upcoming', async (_request, reply) => {
    return reply.header('Cache-Control', 'no-store').send(meetings.listUpcoming());
  });
}
