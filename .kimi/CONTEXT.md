# EventSoft — контекст для Kimi Code

## О проекте

EventSoft — монорепозиторий приложений для проведения мероприятий.
Все приложения используют общий license-server и единую систему лицензирования.

## Структура репозитория

```
/Users/komp/Documents/EventSoft/EventSoft/
├── apps/
│   ├── toastmachine/   # Готовое приложение (Next.js + Tauri)
│   ├── musicbingo/     # Готовое приложение: музыкальное бинго (Next.js + Tauri + Axum)
│   └── fastquiz/       # Заглушка / будущее приложение
├── license-server/     # Общий сервер лицензий + админ-панель
├── .github/workflows/  # CI/CD
│   ├── build-tauri.yml
│   ├── release.yml            # ToastMachine
│   └── release-musicbingo.yml # MusicBingo
├── package.json        # Корневой workspace-манифест
└── README.md           # Корневая документация
```

## Важные ссылки

- **Публичный GitHub репозиторий (CI/CD):** https://github.com/berezovskyoleg/EventSoftPublic
- Старый приватный репозиторий: https://github.com/berezovskyoleg/EventSoft (содержит историю с секретами, не используется для сборок)
- Публичная страница приложений: https://soft.eventhunt.ru/
- MusicBingo: https://soft.eventhunt.ru/musicbingo/
- Админ-панель лицензий: https://soft.eventhunt.ru/admin

Доступы к серверу и GitHub: см. `.kimi/ACCESS.md` (пароли не хранятся в файле).

## Ключевые команды

```bash
# Разработка ToastMachine (веб)
cd apps/toastmachine && npm run dev

# Разработка ToastMachine (Tauri)
cd apps/toastmachine && npm run tauri:dev

# Разработка MusicBingo (веб)
cd apps/musicbingo && npm run dev

# Разработка MusicBingo (Tauri)
cd apps/musicbingo && npm run tauri:dev

# Запуск license-server
 cd license-server && npm run dev

# Инициализация БД license-server
 cd license-server && npm run init
```

## Критические пути

- Лицензионная логика Rust (устаревшая локальная): `apps/<app>/src-tauri/src/license.rs` — удалена, используется `online_license.rs`
- Онлайн-лицензирование Rust: `apps/<app>/src-tauri/src/online_license.rs`
- Инициализация ключей на сервере: `license-server/scripts/init.js`
- Главный Tauri-манифест: `apps/<app>/src-tauri/Cargo.toml`
- MusicBingo сервер: `apps/musicbingo/src-tauri/src/server/`
- MusicBingo игровая логика: `apps/musicbingo/src-tauri/src/game/`
- MusicBingo плейлисты: `apps/musicbingo/src-tauri/src/playlist/`

## Что уже сделано

1. Создан публичный репозиторий `EventSoftPublic` для бесплатных GitHub Actions.
2. Удалены секреты из репозитория: `.env`, `keys/`, `license-keys.txt`, устаревшие локальные license-файлы.
3. Десктопные приложения используют онлайн-проверку лицензий через `soft.eventhunt.ru`.
4. CI/CD переключены на GitHub-hosted runners (`macos-latest`, `windows-latest`, `ubuntu-latest`).
5. Релизы MusicBingo автоматически публикуются в GitHub Releases.

## Деплой

Кратко:
1. Бамп версии в `apps/<app>/package.json`, `Cargo.toml`, `tauri.conf.json`.
2. Запушить тег в `EventSoftPublic`:
   - ToastMachine: `v*` → `release.yml`
   - MusicBingo: `musicbingo-v*` → `release-musicbingo.yml`
3. Дождаться GitHub Actions. Для деплоя сайта секрет `EVENTHUNT_SSH_KEY` должен быть настроен в `EventSoftPublic`.
4. Релизы лежат на сервере: `/opt/eventhunt-license-server/releases/<app>/`.
5. Статические страницы: `/opt/eventhunt-license-server/public/<app>/`.

## Безопасность

- Токены, пароли и приватные ключи не хранятся в этом файле.
- `.env`, `license-keys.txt`, `keys/`, приватные PEM-ключи находятся в `.gitignore`.
- Для работы с GitHub API требуется токен (спросить у пользователя при необходимости).
