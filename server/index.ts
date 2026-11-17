import { buildApp } from './app.ts';

const demoCatalog = [
  { id: 'type-1', name: 'Консультация', description: 'Обсудим ваш вопрос', durationMinutes: 30 },
];
const demo = process.argv.includes('--demo-catalog');
const app = buildApp({ logger: true }, demo ? demoCatalog : [], {
  databasePath: demo ? ':memory:' : (process.env.CALENDAR_DB_PATH ?? 'calendar.sqlite'),
});

try {
  await app.listen({ host: '127.0.0.1', port: 3000 });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
