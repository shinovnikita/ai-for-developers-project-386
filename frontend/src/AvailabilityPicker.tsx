import { Button, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { calendarDate, calendarMidnight, calendarTimeZone, shiftCalendarDate } from '../../shared/calendar-time';
import { getMeetingTypeAvailability, type Availability } from './api';

type AvailabilityState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; availability: Availability };

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

export function AvailabilityPicker({ meetingTypeId }: { meetingTypeId: string }) {
  const [state, setState] = useState<AvailabilityState>({ status: 'loading' });
  const [today, setToday] = useState(() => calendarDate(Date.now()));
  const [selectedDate, setSelectedDate] = useState<string>();
  const [selectedStart, setSelectedStart] = useState<string>();

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
    const controller = new AbortController();

    getMeetingTypeAvailability({
      path: { meetingTypeId },
      signal: controller.signal,
      throwOnError: true,
    })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setState({ status: 'loaded', availability: data });
        setSelectedDate((date) => data.days.some((day) => day.date === date && day.slots.length) ? date : undefined);
        setSelectedStart((start) => data.days.some((day) => day.slots.some((slot) => slot.startsAt === start)) ? start : undefined);
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });

    return () => controller.abort();
  }, [meetingTypeId, today]);

  if (state.status === 'loading') return <Text role="status">Загружаем свободное время</Text>;
  if (state.status === 'error') return <Text role="alert">Не удалось загрузить свободное время</Text>;

  const { days, timeZone } = state.availability;
  const selectedDay = days.find((day) => day.date === selectedDate);

  return (
    <Stack component="section" aria-label="Свободное время" w="100%">
      <Title order={2}>Выберите дату</Title>
      <Text c="dimmed">Время по часовому поясу {timeZone}</Text>
      {days.every((day) => day.slots.length === 0) && (
        <Text role="status">В ближайшие 14 дней нет свободного времени</Text>
      )}
      <SimpleGrid cols={{ base: 2, xs: 3, sm: 5, md: 7 }} role="group" aria-label="Даты">
        {days.map((day) => (
          <Button
            key={day.date}
            variant={day.date === selectedDate ? 'filled' : 'default'}
            aria-pressed={day.date === selectedDate}
            disabled={day.slots.length === 0}
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
      {selectedDay && (
        <>
          <Title order={2}>Выберите время</Title>
          <Group role="group" aria-label="Время" gap="xs">
            {selectedDay.slots.map((slot) => (
              <Button
                key={slot.startsAt}
                variant={slot.startsAt === selectedStart ? 'filled' : 'default'}
                aria-pressed={slot.startsAt === selectedStart}
                onClick={() => setSelectedStart(slot.startsAt)}
              >
                {timeFormat.format(new Date(slot.startsAt))}–{timeFormat.format(new Date(slot.endsAt))}
              </Button>
            ))}
          </Group>
        </>
      )}
    </Stack>
  );
}
