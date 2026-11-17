import { Button, Group, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { calendarDate, calendarMidnight, calendarTimeZone, shiftCalendarDate } from '../../shared/calendar-time';
import { createMeeting, getMeetingTypeAvailability, type Availability, type MeetingConfirmation } from './api';

type AvailabilityState = { date: string; refresh: number } & (
  | { status: 'error' }
  | { status: 'loaded'; availability: Availability }
);

type Submission =
  | { status: 'idle' | 'submitting' }
  | { status: 'error'; message: string; nameError?: string }
  | { status: 'confirmed'; confirmation: MeetingConfirmation };

const defaultError = 'Не удалось подтвердить запись. Попробуйте ещё раз.';

const dateFormat = new Intl.DateTimeFormat('ru', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const timeFormat = new Intl.DateTimeFormat('ru', {
  timeZone: calendarTimeZone,
  hour: '2-digit',
  minute: '2-digit',
});
const confirmationDateFormat = new Intl.DateTimeFormat('ru', {
  timeZone: calendarTimeZone,
  dateStyle: 'long',
});

function formatTimeRange(startsAt: string, endsAt: string) {
  return `${timeFormat.format(new Date(startsAt))}–${timeFormat.format(new Date(endsAt))}`;
}

export function AvailabilityPicker({ meetingTypeId }: { meetingTypeId: string }) {
  const [state, setState] = useState<AvailabilityState>();
  const [refresh, setRefresh] = useState(0);
  const [today, setToday] = useState(() => calendarDate(Date.now()));
  const [selectedDate, setSelectedDate] = useState<string>();
  const [selectedStart, setSelectedStart] = useState<string>();
  const [guestName, setGuestName] = useState<string>();
  const [submission, setSubmission] = useState<Submission>({ status: 'idle' });
  const submitRequest = useRef<AbortController | null>(null);

  const currentState = state?.date === today && state.refresh === refresh ? state : undefined;
  const availability = currentState?.status === 'loaded' ? currentState.availability : undefined;
  const selectedDay = availability?.days.find((day) => day.date === selectedDate);
  const selectedSlot = selectedDay?.slots.find((slot) => slot.startsAt === selectedStart);
  const confirmed = submission.status === 'confirmed';
  const submitting = submission.status === 'submitting';
  const nameError = submission.status === 'error' ? submission.nameError : undefined;

  useEffect(() => {
    let timer: number;
    function updateCalendarDate() {
      const now = Date.now();
      const date = calendarDate(now);
      setToday(date);
      window.clearTimeout(timer);
      timer = window.setTimeout(
        updateCalendarDate,
        calendarMidnight(shiftCalendarDate(date, 1)) - now,
      );
    }

    updateCalendarDate();
    document.addEventListener('visibilitychange', updateCalendarDate);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', updateCalendarDate);
    };
  }, []);

  useEffect(() => {
    if (confirmed) return;
    const controller = new AbortController();

    getMeetingTypeAvailability({
      path: { meetingTypeId },
      signal: controller.signal,
      throwOnError: true,
    })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setState({ status: 'loaded', date: today, refresh, availability: data });
        setSelectedDate((date) => data.days.some((day) => day.date === date && day.slots.length) ? date : undefined);
        setSelectedStart((start) => data.days.some((day) => day.slots.some((slot) => slot.startsAt === start)) ? start : undefined);
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error', date: today, refresh });
      });

    return () => controller.abort();
  }, [confirmed, meetingTypeId, refresh, today]);

  useEffect(() => () => submitRequest.current?.abort(), []);

  async function submitMeeting(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot || guestName === undefined || submitRequest.current) return;

    const controller = new AbortController();
    submitRequest.current = controller;
    setSubmission({ status: 'submitting' });

    try {
      const attemptId = crypto.randomUUID();
      const { data, error } = await createMeeting({
        body: { meetingTypeId, startsAt: selectedSlot.startsAt, guestName, attemptId },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      if (data) {
        setSubmission({ status: 'confirmed', confirmation: data });
        return;
      }

      if (error?.code === 'SLOT_TAKEN' || error?.code === 'SLOT_UNAVAILABLE') {
        setSelectedStart(undefined);
        setRefresh((version) => version + 1);
      }

      setSubmission({
        status: 'error',
        message: error?.message || defaultError,
        nameError: error?.code === 'VALIDATION_ERROR' ? error.fieldErrors?.guestName : undefined,
      });
    } catch {
      if (!controller.signal.aborted) setSubmission({ status: 'error', message: defaultError });
    } finally {
      submitRequest.current = null;
    }
  }

  if (submission.status === 'confirmed') {
    const { meeting, timeZone } = submission.confirmation;
    return (
      <Stack component="section" aria-label="Подтверждение записи" w="100%" gap="xs">
        <Title order={2}>Встреча подтверждена</Title>
        <Text>{meeting.meetingTypeName}</Text>
        <Text>{confirmationDateFormat.format(new Date(meeting.startsAt))}</Text>
        <Text>{formatTimeRange(meeting.startsAt, meeting.endsAt)}</Text>
        <Text c="dimmed">{timeZone}</Text>
      </Stack>
    );
  }

  return (
    <Stack component="section" aria-label="Свободное время" w="100%">
      {!currentState && <Text role="status">Загружаем свободное время</Text>}
      {currentState?.status === 'error' && <Text role="alert">Не удалось загрузить свободное время</Text>}
      {availability && (
        <>
          <Title order={2}>Выберите дату</Title>
          <Text c="dimmed">Время по часовому поясу {availability.timeZone}</Text>
          {availability.days.every((day) => day.slots.length === 0) && (
            <Text role="status">В ближайшие 14 дней нет свободного времени</Text>
          )}
          <SimpleGrid cols={{ base: 2, xs: 3, sm: 5, md: 7 }} role="group" aria-label="Даты">
            {availability.days.map((day) => (
              <Button
                key={day.date}
                variant={day.date === selectedDate ? 'filled' : 'default'}
                aria-pressed={day.date === selectedDate}
                disabled={submitting || day.slots.length === 0}
                onClick={() => {
                  if (day.date !== selectedDate) {
                    setSelectedDate(day.date);
                    setSelectedStart(undefined);
                  }
                }}
              >
                {dateFormat.format(new Date(day.date))}
              </Button>
            ))}
          </SimpleGrid>
        </>
      )}
      {selectedDay && (
        <>
          <Title order={2}>Выберите время</Title>
          <Group role="group" aria-label="Время" gap="xs">
            {selectedDay.slots.map((slot) => (
              <Button
                key={slot.startsAt}
                variant={slot.startsAt === selectedStart ? 'filled' : 'default'}
                aria-pressed={slot.startsAt === selectedStart}
                disabled={submitting}
                onClick={() => {
                  setSelectedStart(slot.startsAt);
                  setGuestName((name) => name ?? '');
                  setSubmission({ status: 'idle' });
                }}
              >
                {formatTimeRange(slot.startsAt, slot.endsAt)}
              </Button>
            ))}
          </Group>
        </>
      )}
      {guestName !== undefined && (
        <form onSubmit={submitMeeting} noValidate>
          <Stack>
            <TextInput
              label="Имя"
              name="guestName"
              autoComplete="name"
              required
              disabled={submitting}
              value={guestName}
              error={nameError}
              onChange={(event) => {
                setGuestName(event.currentTarget.value);
                if (nameError) setSubmission({ status: 'idle' });
              }}
            />
            <Button type="submit" disabled={!selectedSlot} loading={submitting} w="fit-content">
              Подтвердить запись
            </Button>
            {submission.status === 'error' && !nameError && <Text role="alert" c="red">{submission.message}</Text>}
          </Stack>
        </form>
      )}
    </Stack>
  );
}
