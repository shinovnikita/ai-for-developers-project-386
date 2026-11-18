# Вход в MCP хостинга из Codex

Добавьте секцию нужного хостинга из [шаблона](codex-mcp.example.toml) в личный файл `~/.codex/config.toml`, сохранив остальные настройки. В шаблоне только адрес сервера, публичный идентификатор клиента OAuth и команда запуска. Учётные данные остаются на компьютере пользователя. [Настройка MCP в Codex](https://developers.openai.com/codex/mcp/)

## Render

1. Скопируйте обе секции Render и выполните `codex mcp login render`. Войдите в Render в открывшемся браузере и подтвердите доступ.
2. В Codex запросите список рабочих пространств Render и выберите пространство для календаря. Перед созданием проверьте, есть ли там сервис этого репозитория.
3. Для нового Web Service выберите план `free`, репозиторий `shinovnikita/ai-for-developers-project-386`, ветку `main`, среду `docker`, путь `./Dockerfile` и контекст `.`. Хостинг задаёт `PORT`. В настройках сервиса укажите `/health` в поле **Health Check Path** и проверьте, что на публичном адресе этот путь возвращает HTTP 200.

Если Render предлагает только платный ресурс, проверьте бесплатный вариант Railway. [Официальный Render MCP](https://render.com/docs/mcp-server) · [Бесплатные сервисы](https://render.com/docs/free) · [Health Check Path](https://render.com/docs/health-checks)

## Railway

1. Установите актуальный Railway CLI и выполните `railway login`. Подтвердите вход в браузере. Секция Railway запускает официальный MCP-сервер из CLI с этой сессией. [Установка Railway CLI](https://docs.railway.com/cli) · [Доступные MCP-инструменты](https://docs.railway.com/ai/mcp-server#run-the-server-locally)
2. В Codex запросите `whoami` у Railway. Проверьте тариф и остаток кредита в рабочем пространстве. Согласуйте платный ресурс до создания. [Условия бесплатного тарифа и пробного периода](https://docs.railway.com/pricing/free-trial)
3. Через Railway MCP подключите тот же репозиторий и ветку `main`. Railway обнаруживает `Dockerfile` в корне. Установите **Healthcheck Path** в `/health`, оставьте назначение `PORT` хостингу и создайте публичный домен для сервиса. Сверьте SHA успешного деплоя с GitHub и проверьте `/health` по HTTPS. [Сборка из Dockerfile](https://docs.railway.com/builds/dockerfiles) · [Проверка готовности](https://docs.railway.com/deployments/healthchecks)
