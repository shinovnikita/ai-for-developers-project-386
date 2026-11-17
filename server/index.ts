import { buildApp } from './app.ts';

const demoCatalog = [
  { id: 'type-1', name: 'Консультация', description: 'Обсудим ваш вопрос', durationMinutes: 30 },
];
const catalog = process.argv.includes('--demo-catalog') ? demoCatalog : [];
const app = buildApp({ logger: true }, catalog);

try {
  await app.listen({ host: '127.0.0.1', port: 3000 });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
