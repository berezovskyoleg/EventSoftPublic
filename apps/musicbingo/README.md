# 🎵 MusicBingo

> Приложение в составе монорепозитория [EventSoft](../README.md).

Музыкальное бинго для вечеринок и мероприятий. Ведущий запускает короткие отрывки песен со своего ноутбука, а гости отмечают услышанные треки на карточках 5×5 прямо на телефоне через QR-код.

## Как это работает

1. **Ведущий** готовит плейлист из MP3/WAV-отрывков (10–40 секунд) в десктопном приложении.
2. Гости заходят на локальный адрес ведущего по QR-коду, вводят имя и получают уникальную карточку.
3. Ведущий запускает раунд с выбранным паттерном (линия, две линии, X, полный дом и др.).
4. После каждого трека игроки отмечают ячейки. Кто собрал паттерн — нажимает «Бинго!».
5. Приложение автоматически проверяет карточку и показывает победителя.

## Архитектура

- **Десктопное приложение** на Tauri + Next.js — экран ведущего.
- **Встроенный HTTP-сервер** на Axum — раздаёт карточки игрокам по локальной сети/Wi-Fi.
- **SQLite** — хранит плейлисты и треки.
- **Лицензирование** — ключи `MUSIC-XXXX-XXXX-XXXX`, привязка к устройству, проверка через `soft.eventhunt.ru`.

## Запуск разработки

```bash
npm install
npm run tauri:dev
```

## Сборка

### macOS Universal (Intel + Apple Silicon)

```bash
npm run tauri:build -- --target universal-apple-darwin
```

Результат:
- `src-tauri/target/universal-apple-darwin/release/bundle/macos/MusicBingo.app`
- `src-tauri/target/universal-apple-darwin/release/bundle/dmg/MusicBingo_*.dmg`

### Windows x64

```bash
npm run tauri:build -- --target x86_64-pc-windows-msvc
```

Результат:
- `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/MusicBingo_*.msi`
- `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/MusicBingo_*.exe`

## Релиз

Создайте и запушьте тег:

```bash
git tag musicbingo-v0.1.0
git push origin musicbingo-v0.1.0
```

GitHub Actions соберёт macOS и Windows артефакты, создаст релиз и обновит страницу `https://soft.eventhunt.ru/musicbingo/`.

## Деплой вручную

```bash
./scripts/deploy-release.sh 0.1.0
```
