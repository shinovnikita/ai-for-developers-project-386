# AGENTS.md

- Бэкенд Fastify находится в `server/`, фронтенд React и Vite — в `frontend/`. Зависимости закреплены в общем `package-lock.json`.
- Команды установки и запуска описаны в [README.md](README.md#установка). Там же перечислены [команды линтера и тестов](README.md#проверки). Выполняйте их из корня проекта.
- Перед коммитом запускайте `mise run check`. Эту же команду выполняет GitHub Actions.
- Сообщения коммитов оформляйте по Conventional Commits. Примеры форматов — `feat: ...`, `fix: ...` и `chore: scaffold Fastify and React app`.

## Agent skills

### Issue tracker

Задачи и спецификации ведём в GitHub Issues. Порядок работы — в [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

При разборе задач и назначении меток сверяйтесь с [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Один доменный контекст (single-context) для всего проекта. Перед работой с предметной областью прочитайте [docs/agents/domain.md](docs/agents/domain.md).
