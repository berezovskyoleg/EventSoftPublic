# 🎰 Toast Slot

Слот-машина для выбора гостя, который будет произносить тост. Работает офлайн как десктопное приложение на macOS и Windows.

## Что нового

- **Мягкие звуки по умолчанию** — больше не режут слух.
- **Свои звуки** — можно загрузить собственные аудиофайлы для каждого события (кнопка «Звуки» в шапке).
- **Один файл для заказчика** — собирается через Tauri в `.app` / `.dmg` (macOS) или `.msi` / `.exe` (Windows).
- **Лицензионные ключи** — 100 предсгенерированных ключей, привязка к устройству, управление ключами через CLI-скрипт.

## Запуск разработки

```bash
npm install
npm run tauri:dev
```

## Сборка финального приложения

### macOS (текущая архитектура)

```bash
./scripts/build-macos.sh
```

Результат:
- `src-tauri/target/release/bundle/macos/Toast Slot.app`
- `src-tauri/target/release/bundle/dmg/Toast Slot_*.dmg`

### macOS Universal (Intel + Apple Silicon в одном файле)

```bash
./scripts/build-macos-universal.sh
```

Результат:
- `src-tauri/target/universal-apple-darwin/release/bundle/macos/Toast Slot.app`
- `src-tauri/target/universal-apple-darwin/release/bundle/dmg/Toast Slot_*.dmg`

### Windows (x64)

```bash
# Только на Windows или через GitHub Actions
./scripts/build-windows.sh
```

Результат:
- `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi`
- `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`

### Текущая платформа

```bash
./scripts/build-local.sh
```

## Кросс-платформенная сборка через GitHub Actions

1. Запушь тег `v*`, например:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
2. GitHub Actions соберёт:
   - macOS Universal `.dmg` + `.app`
   - Windows x64 `.msi` + `.exe`
3. Артефакты появятся в разделе **Releases** репозитория.

Также можно запустить сборку вручную: **Actions → Release Desktop Builds → Run workflow**.

## Передача заказчику

Для macOS достаточно передать `.dmg` — заказчик открывает его и перетаскивает `Toast Slot.app` в `Applications`.

Для Windows передай `.msi` (установщик) или `.exe` (portable-установщик NSIS).

## Настройка секретов

По умолчанию используется dev-секрет сессий: `toast-slot-machine-session-secret-dev`.

Перед продажей **обязательно** поменяй его. Есть два способа:

### 1. Файл конфигурации (удобнее для заказчика)

Скопируй `toast-slot-config.example.toml` в `toast-slot-config.toml` и положи рядом с исполняемым файлом:
- macOS: `Toast Slot.app/Contents/MacOS/toast-slot-config.toml`
- Windows: рядом с `Toast Slot.exe`

```toml
session_secret = "my-very-long-random-string"
```

### 2. Переменные окружения

```bash
export TOAST_SESSION_SECRET="your-very-long-random-string"
npm run tauri:build
```

Или задай её в GitHub Actions в `env:` секции workflow.

Приоритет: файл рядом с приложением → переменные окружения → dev-значение.

## Как добавить свои звуки

1. Открой приложение.
2. Нажми кнопку **Звуки** в правом верхнем углу.
3. Для нужного события нажми **стрелку вверх** и выбери файл.
4. Нажми **▶** чтобы прослушать.

Поддерживаемые форматы: MP3, WAV, OGG, M4A, WEBM, FLAC.

Для события **«Фоновое кручение»** лучше использовать короткий бесшовный loop — он будет повторяться, пока крутится барабан.

## Управление ключами через CLI

Админ-панель убрана из приложения. Управление ключами ведётся через отдельную утилиту `admin`, написанную на Rust и лежащую в `src-tauri/src/bin/admin.rs`.

Собрать утилиту:

```bash
cd src-tauri
cargo build --release --bin admin
```

После сборки бинарник находится здесь:
- macOS: `src-tauri/target/release/admin`
- Windows: `src-tauri/target/release/admin.exe`

Команды:

```bash
# Показать все ключи и статус
./src-tauri/target/release/admin list

# Экспортировать ключи в файл
./src-tauri/target/release/admin export license-keys.txt

# Отозвать (отключить) ключ
./src-tauri/target/release/admin disable TOAST-XXXX-XXXX-XXXX

# Восстановить отключённый ключ
./src-tauri/target/release/admin enable TOAST-XXXX-XXXX-XXXX

# Сбросить привязку ключа к устройству (чтобы активировать заново)
./src-tauri/target/release/admin reset TOAST-XXXX-XXXX-XXXX

# Сбросить привязку всех ключей (полезно при тестировании после переустановки)
./src-tauri/target/release/admin reset-all
```

Утилита находит базу данных автоматически в стандартных путях:
- macOS: `~/Library/Application Support/com.toastmachine.toast-slot/toast_slot.db`
- Windows: `%APPDATA%/com.toastmachine.toast-slot/toast_slot.db`
- Linux: `~/.local/share/com.toastmachine.toast-slot/toast_slot.db`

Или можно явно передать путь к БД последним аргументом:

```bash
./src-tauri/target/release/admin list /path/to/toast_slot.db
./src-tauri/target/release/admin export license-keys.txt /path/to/toast_slot.db
```

## Локальное тестирование в браузере (без сборки приложения)

Можно запустить интерфейс как обычный Next.js-сервер и проверить ключи из `license-keys.txt`:

```bash
npm run dev
```

Открой http://localhost:3000, вставь любой ключ из `license-keys.txt`.

В этом режиме лицензионные запросы идут на локальные API-роуты (`/api/license/activate` и `/api/license/verify`), которые делегируют проверку тому же Rust-бинарнику `admin`. Перед первым запуском убедись, что `admin` собран:

```bash
cd src-tauri
cargo build --release --bin admin
```

Проверить API вручную:

```bash
KEY="TOAST-XXXX-XXXX-XXXX"
FP="fp1.test123456789012345678901234567890123456789012345678901234567890"

curl -s -X POST http://localhost:3000/api/license/activate \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"$KEY\",\"fingerprint\":\"$FP\"}"

curl -s -X POST http://localhost:3000/api/license/verify \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"$KEY\",\"fingerprint\":\"$FP\"}"
```

## Структура проекта

- `src/` — интерфейс (Next.js + React + Tailwind + shadcn/ui)
- `src-tauri/` — десктопная оболочка и лицензионная логика на Rust + SQLite
- `src/app/api/license/` — локальные API-роуты для веб-тестирования
- `scripts/` — скрипты сборки под разные платформы
- `.github/workflows/release.yml` — автоматическая кросс-платформенная сборка

## Требования

- Node.js 20+
- Rust + Cargo (устанавливается через [rustup.rs](https://rustup.rs))
- macOS: Xcode Command Line Tools (для сборки под macOS)
- Windows: Visual Studio Build Tools + WebView2 (для сборки под Windows)
