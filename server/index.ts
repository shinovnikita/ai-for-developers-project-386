import { buildApp } from './app.ts';
import { readWeeklySchedule } from './working-hours.ts';

const demoCatalog = [
  { id: 'type-1', name: 'Консультация', description: 'Обсудим ваш вопрос', durationMinutes: 30 },
];
const demo = process.argv.includes('--demo-catalog');
const app = buildApp({ logger: true }, demo ? demoCatalog : [], {
  databasePath: demo ? ':memory:' : (process.env.CALENDAR_DB_PATH ?? 'calendar.sqlite'),
  schedule: readWeeklySchedule(process.env.CALENDAR_SCHEDULE),
});

try {
  await app.listen({ host: '127.0.0.1', port: 3000 });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
