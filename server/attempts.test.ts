import { randomUUID } from 'node:crypto';
import { expect, test } from 'vitest';
import type { CreateMeetingInput, MeetingConfirmation, MeetingType, UpcomingMeetings } from '../api/generated/sdk/types.gen.ts';
import { buildApp } from './app.ts';

const opening = '2026-11-18T05:00:00Z';

async function startCalendar() {
  let now = new Date(opening);
  const app = buildApp({}, [], {
    now: () => now,
    schedule: { 3: [{ startsAt: '09:00', endsAt: '12:00' }] },
  });

  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    function request(path: string, options: RequestInit = {}) {
      return fetch(new URL(path, address), { signal: AbortSignal.timeout(3_000), ...options });
    }

    function post(path: string, input: unknown) {
      return request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    }

    const type = await post('/api/meeting-types', {
      name: 'Консультация', description: 'Обсудим ваш вопрос', durationMinutes: 30,
    });
    expect(type.status).toBe(201);
    const { id }: MeetingType = await type.json();
    const input: CreateMeetingInput = {
      meetingTypeId: id,
      startsAt: '2026-11-18T07:00:00Z',
      guestName: 'Ян',
      attemptId: randomUUID(),
    };

    return {
      input,
      book: (booking = input) => post('/api/meetings', booking),
      advanceClock: (instant: string) => { now = new Date(instant); },
      async upcoming(): Promise<UpcomingMeetings> {
        const response = await request('/api/meetings/upcoming');
        expect(response.status).toBe(200);
        return response.json();
      },
      close: () => app.close(),
    };
  } catch (error) {
    await app.close();
    throw error;
  }
}

test('повтор сохранённой попытки возвращает ту же встречу после её начала', async ({ onTestFinished }) => {
  const calendar = await startCalendar();
  onTestFinished(calendar.close);
  const first = await calendar.book();
  expect(first.status).toBe(201);
  const confirmation: MeetingConfirmation = await first.json();

  calendar.advanceClock('2026-11-18T07:01:00Z');
  const replay = await calendar.book({
    ...calendar.input,
    startsAt: '2026-11-18T07:00:00.000Z',
    guestName: '  Ян  ',
    attemptId: calendar.input.attemptId.toUpperCase(),
  });
  expect(replay.status).toBe(200);
  await expect(replay.json()).resolves.toEqual(confirmation);

  calendar.advanceClock(opening);
  expect((await calendar.upcoming()).meetings).toEqual([confirmation.meeting]);
});

test('сохранённая попытка отклоняет изменение имени, типа или времени', async ({ onTestFinished }) => {
  const calendar = await startCalendar();
  onTestFinished(calendar.close);
  const first = await calendar.book();
  expect(first.status).toBe(201);
  const confirmation: MeetingConfirmation = await first.json();

  for (const change of [
    { guestName: 'Лена' },
    { meetingTypeId: 'unknown' },
    { startsAt: '2026-11-18T04:00:00Z' },
  ]) {
    const replay = await calendar.book({ ...calendar.input, ...change });
    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toEqual({
      code: 'ATTEMPT_PAYLOAD_MISMATCH',
      message: 'Данные попытки записи изменились',
    });
  }

  const replay = await calendar.book();
  expect(replay.status).toBe(200);
  await expect(replay.json()).resolves.toEqual(confirmation);
  expect((await calendar.upcoming()).meetings).toEqual([confirmation.meeting]);
});
