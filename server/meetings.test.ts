import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import type { Availability, MeetingType } from '../api/generated/sdk/types.gen.ts';
import { buildApp, type CalendarOptions } from './app.ts';

const defaultOptions: CalendarOptions = {
  now: () => new Date('2026-11-18T05:00:00Z'),
  schedule: { 3: [{ startsAt: '09:00', endsAt: '12:00' }] },
};

async function startCalendar(options: CalendarOptions = defaultOptions) {
  const directory = await mkdtemp(join(tmpdir(), 'calendar-meetings-'));
  const databasePath = join(directory, 'calendar.sqlite');
  const app = buildApp({}, [], { ...options, databasePath });
  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    return {
      request(path: string, options: RequestInit = {}) {
        return fetch(new URL(path, address), { signal: AbortSignal.timeout(3_000), ...options });
      },
      async close() {
        await app.close();
        await rm(directory, { recursive: true, force: true });
      },
      countMeetings() {
        const database = new DatabaseSync(databasePath, { readOnly: true });
        try {
          return database.prepare('SELECT count(*) AS count FROM meetings').get()?.count;
        } finally {
          database.close();
        }
      },
    };
  } catch (error) {
    await app.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

type Calendar = Awaited<ReturnType<typeof startCalendar>>;

function post(calendar: Calendar, path: string, input: unknown) {
  return calendar.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

async function createType(calendar: Calendar, name: string, durationMinutes = 30): Promise<MeetingType> {
  const response = await post(calendar, '/api/meeting-types', {
    name,
    description: 'Обсудим ваш вопрос',
    durationMinutes,
  });
  expect(response.status).toBe(201);
  return response.json();
}

function book(calendar: Calendar, meetingTypeId: string, startsAt: string, guestName = 'Ян') {
  return post(calendar, '/api/meetings', { meetingTypeId, startsAt, guestName, attemptId: randomUUID() });
}

const singleBooking = {
  statuses: [201, 409],
  storedCount: 1,
  conflict: { code: 'SLOT_TAKEN', message: 'Это время уже занято' },
};

async function bookingOutcome(calendar: Calendar, requests: Promise<Response>[]) {
  const responses = await Promise.all(requests);
  return {
    statuses: responses.map(({ status }) => status).sort(),
    storedCount: calendar.countMeetings(),
    conflict: await responses.find(({ status }) => status === 409)?.json(),
  };
}

test('две параллельные записи на одинаковый слот сохраняют только одну встречу', async ({ onTestFinished }) => {
  const calendar = await startCalendar();
  onTestFinished(calendar.close);
  const { id } = await createType(calendar, 'Консультация');

  expect(await bookingOutcome(calendar, [
    book(calendar, id, '2026-11-18T07:00:00Z', 'Ян'),
    book(calendar, id, '2026-11-18T07:00:00Z', 'Лена'),
  ])).toEqual(singleBooking);
});

test('две параллельные записи на пересекающиеся слоты разных типов сохраняют только одну встречу', async ({ onTestFinished }) => {
  const calendar = await startCalendar();
  onTestFinished(calendar.close);
  const consultation = await createType(calendar, 'Консультация');
  const interview = await createType(calendar, 'Собеседование');

  expect(await bookingOutcome(calendar, [
    book(calendar, consultation.id, '2026-11-18T07:00:00Z', 'Ян'),
    book(calendar, interview.id, '2026-11-18T07:15:00Z', 'Лена'),
  ])).toEqual(singleBooking);
});

test('запись исключает пересечения из доступности всех типов и разрешает начало сразу после встречи', async ({ onTestFinished }) => {
  const calendar = await startCalendar();
  onTestFinished(calendar.close);
  const introduction = await createType(calendar, 'Знакомство', 17);
  const consultation = await createType(calendar, 'Консультация');

  const first = await book(calendar, introduction.id, '2026-11-18T06:00:00Z', '  Ян  ');
  expect(first.status).toBe(201);
  await expect(first.json()).resolves.toEqual({
    timeZone: 'Europe/Moscow',
    meeting: {
      id: expect.any(String),
      meetingTypeId: introduction.id,
      meetingTypeName: 'Знакомство',
      guestName: 'Ян',
      startsAt: '2026-11-18T06:00:00Z',
      endsAt: '2026-11-18T06:17:00Z',
    },
  });

  const response = await calendar.request(`/api/meeting-types/${consultation.id}/availability`);
  expect(response.status).toBe(200);
  const availability: Availability = await response.json();
  expect(availability.days[0]).toMatchObject({ date: '2026-11-18' });
  expect(availability.days[0].slots[0]).toEqual({
    startsAt: '2026-11-18T06:17:00Z',
    endsAt: '2026-11-18T06:47:00Z',
  });
  expect(availability.days[0].slots).not.toContainEqual(expect.objectContaining({ startsAt: '2026-11-18T06:15:00Z' }));

  const adjacent = await book(calendar, consultation.id, '2026-11-18T06:17:00Z');
  expect(adjacent.status).toBe(201);
});

test('запись отклоняет пустое и слишком длинное имя с подсказкой для поля', async ({ onTestFinished }) => {
  const calendar = await startCalendar();
  onTestFinished(calendar.close);
  const { id } = await createType(calendar, 'Консультация');

  const emptyName = await book(calendar, id, '2026-11-18T07:00:00Z', '  ');
  expect(emptyName.status).toBe(400);
  await expect(emptyName.json()).resolves.toEqual({
    code: 'VALIDATION_ERROR',
    message: 'Проверьте поля запроса',
    fieldErrors: { guestName: 'Укажите имя' },
  });

  const longName = await book(calendar, id, '2026-11-18T07:00:00Z', 'Я'.repeat(81));
  expect(longName.status).toBe(400);
  await expect(longName.json()).resolves.toMatchObject({
    code: 'VALIDATION_ERROR',
    fieldErrors: { guestName: 'Укажите имя до 80 символов' },
  });
  expect(calendar.countMeetings()).toBe(0);
});

test('запись возвращает согласованную ошибку при неверном формате запроса', async ({ onTestFinished }) => {
  const calendar = await startCalendar();
  onTestFinished(calendar.close);
  const { id } = await createType(calendar, 'Консультация');

  const invalid = await post(calendar, '/api/meetings', {
    meetingTypeId: id,
    startsAt: '2026-11-31T07:00:00Z',
    guestName: 'Ян',
    attemptId: 'no-uuid',
  });
  expect(invalid.status).toBe(400);
  await expect(invalid.json()).resolves.toMatchObject({
    code: 'VALIDATION_ERROR',
    fieldErrors: { startsAt: expect.any(String), attemptId: expect.any(String) },
  });

  const invalidJson = await calendar.request('/api/meetings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  expect(invalidJson.status).toBe(400);
  await expect(invalidJson.json()).resolves.toEqual({ code: 'VALIDATION_ERROR', message: 'Проверьте поля запроса' });
  expect(calendar.countMeetings()).toBe(0);
});

test('запись возвращает ошибку для неизвестного типа встречи', async ({ onTestFinished }) => {
  const calendar = await startCalendar();
  onTestFinished(calendar.close);

  const response = await book(calendar, 'unknown', '2026-11-18T07:00:00Z');
  expect(response.status).toBe(404);
  await expect(response.json()).resolves.toEqual({
    code: 'MEETING_TYPE_NOT_FOUND',
    message: 'Тип встречи не найден',
  });
});

test('запись повторно проверяет время и ограничения слота при подтверждении', async ({ onTestFinished }) => {
  let now = new Date('2026-11-18T05:00:00Z');
  const calendar = await startCalendar({ ...defaultOptions, now: () => now });
  onTestFinished(calendar.close);
  const { id } = await createType(calendar, 'Консультация');

  const availabilityResponse = await calendar.request(`/api/meeting-types/${id}/availability`);
  const availability: Availability = await availabilityResponse.json();
  expect(availability.days[0].slots[0]?.startsAt).toBe('2026-11-18T06:00:00Z');
  now = new Date('2026-11-18T06:00:00Z');

  for (const start of [
    '2026-11-18T06:00:00Z',
    '2026-11-18T06:01:00Z',
    '2026-11-18T06:05:00.0001Z',
    '2026-11-18T08:35:00Z',
    '2026-12-02T06:00:00Z',
  ]) {
    const response = await book(calendar, id, start);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code: 'SLOT_UNAVAILABLE',
      message: 'Это время больше недоступно',
    });
  }
  expect(calendar.countMeetings()).toBe(0);
});
