# EventSoft

Монорепозиторий приложений для проведения мероприятий: ToastMachine, FastQuiz, MusicBingo и другие.

## Структура

```
EventSoft/
├── apps/
│   ├── toastmachine/   # Десктопное приложение-слот для выбора тостующего (Next.js + Tauri)
│   ├── fastquiz/       # Быстрые викторины (заглушка)
│   └── musicbingo/     # Музыкальное бинго (заглушка)
├── license-server/     # Общий сервер лицензий и админ-панель
├── keys/               # Хранилища лицензионных ключей по приложениям
│   └── toastmachine/
│       └── keys.txt
└── .github/workflows/  # CI/CD для сборки и публикации
```

## Приложения

- **[ToastMachine](apps/toastmachine/)** — готовое десктопное приложение для macOS и Windows.
- **[FastQuiz](apps/fastquiz/)** — заглушка будущего приложения.
- **[MusicBingo](apps/musicbingo/)** — заглушка будущего приложения.

## Быстрые команды

```bash
# Разработка ToastMachine (веб-интерфейс)
npm run dev:toastmachine

# Разработка ToastMachine (Tauri, десктоп)
npm run dev:toastmachine:tauri

# Сборка ToastMachine под текущую платформу
cd apps/toastmachine
./scripts/build-local.sh

# Запуск лицензионного сервера
npm run dev:license-server

# Инициализация БД сервера лицензий
npm run init:license-server
```

## Лицензирование

- Источник ключей для ToastMachine: `keys/toastmachine/keys.txt`.
- Управление лицензиями: https://soft.eventhunt.ru/admin
- Публичная страница приложений: https://soft.eventhunt.ru/

## Требования

- Node.js 20+
- Rust + Cargo (для сборки Tauri)
- macOS: Xcode Command Line Tools
- Windows: Visual Studio Build Tools + WebView2

## CI/CD

- `.github/workflows/build-tauri.yml` — сборка артефактов по тегам `v*`.
- `.github/workflows/release.yml` — сборка + создание GitHub Release.

Для выпуска новой версии:

```bash
git tag v0.3.0
git push origin v0.3.0
```
