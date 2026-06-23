# EventSoft — контекст для Kimi Code

## О проекте

EventSoft — монорепозиторий приложений для проведения мероприятий.
Все приложения используют общий license-server и единую систему лицензирования.

## Структура репозитория

```
/Users/komp/Documents/EventSoft/EventSoft/
├── apps/
│   ├── toastmachine/   # Готовое приложение (Next.js + Tauri)
│   ├── fastquiz/       # Заглушка / будущее приложение
│   └── musicbingo/     # Заглушка / будущее приложение
├── license-server/     # Общий сервер лицензий + админ-панель
├── keys/               # Лицензионные ключи по приложениям
│   └── toastmachine/
│       └── keys.txt    # 100 ключей ToastMachine
├── .github/workflows/  # CI/CD
│   ├── build-tauri.yml
│   └── release.yml
├── package.json        # Корневой workspace-манифест
└── README.md           # Корневая документация
```

## Важные ссылки

- GitHub репозиторий: https://github.com/berezovskyoleg/EventSoft
- Публичная страница приложений: https://soft.eventhunt.ru/
- Админ-панель лицензий: https://soft.eventhunt.ru/admin

## Ключевые команды

```bash
# Разработка ToastMachine (веб)
cd apps/toastmachine && npm run dev

# Разработка ToastMachine (Tauri)
cd apps/toastmachine && npm run tauri:dev

# Сборка ToastMachine под текущую платформу
cd apps/toastmachine && ./scripts/build-local.sh

# Сборка admin CLI (Rust)
cargo build --release --manifest-path apps/toastmachine/src-tauri/Cargo.toml --bin admin

# Запуск license-server
cd license-server && npm run dev

# Инициализация БД license-server
cd license-server && npm run init
```

## Критические пути

- Ключи ToastMachine: `keys/toastmachine/keys.txt`
- Лицензионная логика Rust: `apps/toastmachine/src-tauri/src/license.rs`
- Инициализация ключей на сервере: `license-server/scripts/init.js`
- Главный Tauri-манифест: `apps/toastmachine/src-tauri/Cargo.toml`

## Что уже сделано

1. Репозиторий переименован с `toast-machine` в `EventSoft`.
2. Файлы ToastMachine перенесены из корня в `apps/toastmachine/`.
3. Ключи перенесены из `src-tauri/keys.txt` в `keys/toastmachine/keys.txt`.
4. Пути в `license.rs` и `license-server/scripts/init.js` обновлены.
5. GitHub Actions настроены на `apps/toastmachine`.
6. Корневой `README.md` и `package.json` созданы.
7. Сборка admin CLI проверена локально.

## Деплой

Подробная инструкция по обновлению сайта и релизов: `.kimi/DEPLOY.md`.

Кратко:
1. Бамп версии в `apps/toastmachine/package.json`, `Cargo.toml`, `tauri.conf.json`.
2. Запушить тег `v*`, дождаться GitHub Actions.
3. Скачать артефакты macOS и Windows из workflow.
4. Залить в `license-server/releases/` и на сервер `root@soft.eventhunt.ru:/opt/eventhunt-license-server/releases/`.
5. Синхронизировать `license-server/public/` на сервер.

## Безопасность

- Токены, пароли и приватные ключи не хранятся в этом файле.
- `.env` и `license-keys.txt` находятся в `.gitignore`.
- Для работы с GitHub API требуется токен (спросить у пользователя при необходимости).

## Заметки

- При переименовании/перемещении папок важно удалять `src-tauri/target/`, иначе Cargo может использовать закешированные абсолютные пути.
- Лицензионный сервер использует SQLite (`license-server/var/license_server.db` или переменную `DATABASE_URL`).
