# AGENTS.md

- Бэкенд Fastify находится в `server/`, фронтенд React и Vite — в `frontend/`. Зависимости закреплены в общем `package-lock.json`.
- Команды установки и запуска описаны в [README.md](README.md#установка). Там же перечислены [команды линтера и тестов](README.md#проверки). Выполняйте их из корня проекта.
- Перед коммитом запускайте `mise run check`. Эту же команду выполняет GitHub Actions.
- Сообщения коммитов оформляйте по Conventional Commits. Примеры форматов — `feat: ...`, `fix: ...` и `chore: scaffold Fastify and React app`.
