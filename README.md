# Календарь звонков


[![hexlet-check](https://github.com/shinovnikita/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/shinovnikita/ai-for-developers-project-386/actions)

Разработайте совместно с ИИ сервис для бронирования календаря

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Сценарий записи на звонок

1. Владелец календаря создаёт тип встречи, указывает название, описание и длительность. После сохранения тип появляется в каталоге для гостей.
2. Гость без регистрации выбирает тип встречи в каталоге. Он открывает календарь на ближайшие 14 календарных дней, выбирает день и видит свободное время. Длительность каждого слота совпадает с длительностью выбранного типа встречи.
3. Гость выбирает время и подтверждает запись. Если слот ещё свободен, приложение создаёт встречу и показывает подтверждение с датой и временем. Если слот уже заняли, приложение предлагает выбрать другое время.
4. Владелец открывает общий список предстоящих встреч и видит новую запись с типом встречи, датой и временем.

У приложения один заранее заданный владелец и один календарь для всех типов встреч. Частичное и полное пересечение записей запрещено, в том числе при одновременных запросах. Следующая встреча может начаться в момент окончания предыдущей. В проекте нет авторизации, личных кабинетов и интеграций с внешними календарями.

Для API используем контракт TypeSpec. Из него генерируется OpenAPI, а из OpenAPI — клиентский SDK для фронтенда. Приложение должно собираться в Docker-образ и запускаться в контейнере.

Референс Cal.com. [Создание типа встречи](https://cal.com/blog/event-types-guide-calcom) · [Запись гостя](https://cal.com/scheduling) · [Список встреч владельца](https://cal.com/blog/a-complete-walkthrough-of-cal-com-s-booking-dashboard-its-key-features)

## Стек

- Node.js 24 LTS, TypeScript и Fastify 5.
- React, Vite и Mantine.

## Установка

Для установки закреплённой версии Node.js нужен [mise](https://mise.jdx.dev/).

```bash
git clone https://github.com/shinovnikita/ai-for-developers-project-386.git
cd ai-for-developers-project-386
mise install
mise exec -- npm ci
mise exec -- npm run generate:openapi
mise exec -- npm run generate:sdk
```

## Использование

Запустите сервер из корня проекта.

```bash
mise exec -- npm start
```

В другом терминале проверьте, что сервер отвечает `200 OK` с телом `{"status":"ok"}`.

```bash
curl --noproxy 127.0.0.1 -i http://127.0.0.1:3000/health
```

Для разработки фронтенда запустите Vite из корня проекта.

```bash
mise exec -- npm run dev
```

Страница откроется по адресу [127.0.0.1:5173](http://127.0.0.1:5173/).

Чтобы открыть каталог с демонстрационным типом встречи, запустите `mise exec -- npm run demo:catalog` вместо `npm start` и перейдите на [страницу записи](http://127.0.0.1:5173/booking). Ответ каталога можно проверить напрямую.

```bash
curl --noproxy 127.0.0.1 --fail-with-body -i http://127.0.0.1:3000/api/meeting-types
```

Для сборки и локального предпросмотра собранной страницы выполните следующие команды.

```bash
mise exec -- npm run build
mise exec -- npm run preview
```

Сборка сохраняется в `frontend/dist`. Предпросмотр доступен по адресу [127.0.0.1:4173](http://127.0.0.1:4173/).

## Проверки

Из корня проекта запустите ту же команду, которую выполняет GitHub Actions при каждом push.

```bash
mise run check
```

Линтер и тесты можно запустить отдельно.

```bash
mise exec -- npm run lint
mise exec -- npm test
```

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## Выпуск версии

При каждом обновлении `main` запускается Release Please. Для ручного запуска откройте **Actions → Release Please → Run workflow** и выберите `main`. [Workflow Release Please](.github/workflows/release-please.yml)

До первого запуска настройте один из способов доступа к GitHub API.

- Для встроенного `GITHUB_TOKEN` включите **Allow GitHub Actions to create and approve pull requests** в **Settings → Actions → General → Workflow permissions**. [Настройки GitHub Actions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#preventing-github-actions-from-creating-or-approving-pull-requests)
- Чтобы push в ветку release PR запускал проверки CI, добавьте секрет `RELEASE_PLEASE_TOKEN` в **Settings → Secrets and variables → Actions**. Используйте fine-grained personal access token с доступом к этому репозиторию и правом записи в **Contents**, **Issues** и **Pull requests**. [Учётные данные Release Please](https://github.com/googleapis/release-please-action/tree/45996ed1f6d02564a971a2fa1b5860e934307cf7#other-actions-on-release-please-prs)

1. Добавьте в `main` изменение с сообщением по Conventional Commits, например `feat: add a meeting type catalog` или `fix: handle an empty catalog`. При squash merge используйте этот формат в сообщении итогового коммита.
2. Release Please создаст или обновит release PR. Проверьте версию в `package.json` и `package-lock.json` и описание изменений в `CHANGELOG.md`.
3. Объедините release PR с `main`. При следующем запуске Release Please создаст тег версии и GitHub Release.

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
