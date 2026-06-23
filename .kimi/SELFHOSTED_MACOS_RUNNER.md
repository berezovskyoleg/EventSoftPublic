# Self-hosted runner на macOS (Apple Silicon) для MusicBingo

> Фактическая установка выполнена на MacBook Pro M1 (`komp`) 23 июня 2026.
> Runner запущен из `~/actions-runner` как пользовательский `launchd` агент.

## Текущий статус

- **Имя runner в GitHub:** `macbook-pro-m1`
- **Labels:** `self-hosted`, `macOS`, `ARM64`, `macbook-pro-m1`
- **Статус:** online (проверить можно в `Settings → Actions → Runners` репозитория)
- **Service:** `actions.runner.berezovskyoleg-EventSoft.macbook-pro-m1`

## Что установлено

- Xcode 26.5 (`/Applications/Xcode.app`)
- Xcode Command Line Tools
- Node.js 20.11.1 (`/usr/local/bin/node`)
- npm 10.2.4
- rustup + stable toolchain (`~/.cargo/bin`)
- Rust targets: `aarch64-apple-darwin`, `x86_64-apple-darwin`
- GitHub Actions runner `v2.319.1` в `~/actions-runner`

## Управление runner

```bash
cd ~/actions-runner
./svc.sh status
./svc.sh stop
./svc.sh start
```

Логи:

```bash
tail -f ~/Library/Logs/actions.runner.berezovskyoleg-EventSoft.macbook-pro-m1/runner.log
```

## Важно: принять лицензию Xcode

После установки/обновления Xcode нужно принять лицензию, иначе сборка Tauri упадёт с ошибкой:

```
You have not agreed to the Xcode license agreements.
```

Выполнить в терминале:

```bash
sudo xcodebuild -license accept
```

Или интерактивно:

```bash
sudo xcodebuild -license
# нажать q, затем agree
```

## Переустановка runner

Если нужно пересоздать runner:

1. Получить новый registration token:
   https://github.com/berezovskyoleg/EventSoft/settings/actions/runners/new

2. Выполнить:

```bash
cd ~/actions-runner
./svc.sh stop
./svc.sh uninstall
cd ~ && rm -rf ~/actions-runner
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -O -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-osx-arm64-2.319.1.tar.gz
tar xzf actions-runner-osx-arm64-2.319.1.tar.gz
rm actions-runner-osx-arm64-2.319.1.tar.gz
./config.sh --url https://github.com/berezovskyoleg/EventSoft --token <TOKEN> --name macbook-pro-m1 --labels self-hosted,macOS,ARM64,macbook-pro-m1 --unattended --replace
./svc.sh install
./svc.sh start
```

## Использование в workflow

```yaml
jobs:
  build-macos:
    runs-on: self-hosted
    # или runs-on: macbook-pro-m1
```

## Ограничения

- Runner работает только пока Mac включён и пользователь залогинен.
- Рекомендуется подключить Mac к питанию и отключить сон:
  - System Settings → Lock Screen → **Turn display off on battery when inactive**: Never
  - System Settings → Lock Screen → **Turn display off on power adapter when inactive**: Never

## Ссылки

- GitHub Actions Runner releases: https://github.com/actions/runner/releases
- Tauri macOS prerequisites: https://tauri.app/start/prerequisites/
