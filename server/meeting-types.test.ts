import { expect, test } from 'vitest';
import { buildApp } from './app.ts';

async function getCatalog(app: ReturnType<typeof buildApp>) {
  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const response = await fetch(new URL('/api/meeting-types', address), {
      signal: AbortSignal.timeout(3_000),
    });

    return { status: response.status, body: await response.json() };
  } finally {
    await app.close();
  }
}

test('GET /api/meeting-types возвращает каталог типов встреч', async () => {
  const app = buildApp({}, [
    { id: 'type-1', name: 'Консультация', description: 'Обсудим ваш вопрос', durationMinutes: 30 },
  ]);

  await expect(getCatalog(app)).resolves.toEqual({
    status: 200,
    body: [
      { id: 'type-1', name: 'Консультация', description: 'Обсудим ваш вопрос', durationMinutes: 30 },
    ],
  });
});

test('GET /api/meeting-types возвращает пустой массив, пока нет типов встреч', async () => {
  await expect(getCatalog(buildApp())).resolves.toEqual({ status: 200, body: [] });
});
