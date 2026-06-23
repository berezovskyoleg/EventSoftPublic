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
├── keys/               # Лицензионные ключи по приложениям
│   ├── toastmachine/
│   │   └── keys.txt    # 100 ключей ToastMachine
│   └── musicbingo/
│       └── keys.txt    # 100 ключей MusicBingo
├── .github/workflows/  # CI/CD
│   ├── build-tauri.yml
│   ├── release.yml            # ToastMachine
│   └── release-musicbingo.yml # MusicBingo
├── package.json        # Корневой workspace-манифест
└── README.md           # Корневая документация
```

## Важные ссылки

- GitHub репозиторий: https://github.com/berezovskyoleg/EventSoft
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

# Сборка ToastMachine под текущую платформу
cd apps/toastmachine && ./scripts/build-local.sh

# Сборка admin CLI ToastMachine (Rust)
cargo build --release --manifest-path apps/toastmachine/src-tauri/Cargo.toml --bin admin

# Запуск license-server
cd license-server && npm run dev

# Инициализация БД license-server
cd license-server && npm run init
```

## Критические пути

- Ключи ToastMachine: `keys/toastmachine/keys.txt`
- Ключи MusicBingo: `keys/musicbingo/keys.txt`
- Лицензионная логика Rust: `apps/<app>/src-tauri/src/license.rs`
- Онлайн-лицензирование Rust: `apps/<app>/src-tauri/src/online_license.rs`
- Инициализация ключей на сервере: `license-server/scripts/init.js`
- Главный Tauri-манифест: `apps/<app>/src-tauri/Cargo.toml`
- MusicBingo сервер: `apps/musicbingo/src-tauri/src/server/`
- MusicBingo игровая логика: `apps/musicbingo/src-tauri/src/game/`
- MusicBingo плейлисты: `apps/musicbingo/src-tauri/src/playlist/`

## Что уже сделано

1. Репозиторий переименован с `toast-machine` в `EventSoft`.
2. ToastMachine перенесён в `apps/toastmachine/`, ключи — в `keys/toastmachine/`.
3. GitHub Actions настроены на `apps/toastmachine`.
4. Создано и задеплоено приложение **MusicBingo** в `apps/musicbingo/`:
   - Tauri + Next.js интерфейс ведущего.
   - Встроенный Axum HTTP-сервер для игроков по QR-коду.
   - SQLite плейлисты и импорт MP3/WAV.
   - Генерация карточек 5×5, паттерны, автопроверка бинго.
   - Отдельный пул ключей `MUSIC-XXXX-XXXX-XXXX`.
   - CI/CD через `.github/workflows/release-musicbingo.yml`.
   - Сайт https://soft.eventhunt.ru/musicbingo/ и релизы DMG/MSI/EXE.

## Деплой

Подробная инструкция по обновлению сайта и релизов: `.kimi/DEPLOY.md`.

Кратко:
1. Бамп версии в `apps/<app>/package.json`, `Cargo.toml`, `tauri.conf.json`.
2. Запушить тег:
   - ToastMachine: `v*` → `release.yml`
   - MusicBingo: `musicbingo-v*` → `release-musicbingo.yml`
3. Дождаться GitHub Actions. Для MusicBingo секрет `EVENTHUNT_SSH_KEY` должен быть настроен, иначе deploy-site упадёт — тогда артефакты скачать вручную из GitHub Release и залить на сервер.
4. Релизы лежат на сервере: `/opt/eventhunt-license-server/releases/<app>/`.
5. Статические страницы: `/opt/eventhunt-license-server/public/<app>/`.

## Безопасность

- Токены, пароли и приватные ключи не хранятся в этом файле.
- `.env` и `license-keys.txt` находятся в `.gitignore`.
- Для работы с GitHub API требуется токен (спросить у пользователя при необходимости).

## Заметки

- При переименовании/перемещении папок важно удалять `src-tauri/target/`, иначе Cargo может использовать закешированные абсолютные пути.
- Лицензионный сервер использует SQLite (`license-server/var/license_server.db` или переменную `DATABASE_URL`).
