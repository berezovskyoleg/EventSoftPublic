# Деплой приложений на soft.eventhunt.ru

## Доступ к серверу

- **Хост:** `soft.eventhunt.ru` (`185.255.133.210`)
- **Пользователь:** `root`
- **SSH-ключ:** `~/.ssh/eventhuntssh` (уже добавлен в `/root/.ssh/authorized_keys`)
- **SSH-команда:**
  ```bash
  ssh -i ~/.ssh/eventhuntssh root@soft.eventhunt.ru
  ```
  Если ключ не работает, спросить пароль у Олега.

> На сервере нет `rsync`, поэтому используем `scp`.

## Структура на сервере

- `/opt/eventhunt-license-server/` — рабочая копия license-server и сайта.
- `/opt/eventhunt-license-server/releases/<app>/` — файлы для скачивания (`*.dmg`, `*.msi`, `*.exe`).
- `/opt/eventhunt-license-server/public/<app>/` — лендинги приложений.
- Nginx отдаёт `/releases/` и `/musicbingo/` напрямую, остальное проксирует на Node.js-сервер.

## ToastMachine

### Порядок деплоя новой версии

1. **Бамп версии** в:
   - `apps/toastmachine/package.json`
   - `apps/toastmachine/src-tauri/Cargo.toml`
   - `apps/toastmachine/src-tauri/tauri.conf.json`

2. **Запушить тег**:
   ```bash
   git tag v0.2.7
   git push origin v0.2.7
   ```

3. Дождаться `.github/workflows/release.yml`.

4. **Залить артефакты на сервер** (если CI deploy-site не настроен):
   ```bash
   scp -i ~/.ssh/eventhuntssh apps/toastmachine/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ToastMachine_*.dmg root@soft.eventhunt.ru:/opt/eventhunt-license-server/releases/toastmachine/
   scp -i ~/.ssh/eventhuntssh apps/toastmachine/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/ToastMachine_*.msi root@soft.eventhunt.ru:/opt/eventhunt-license-server/releases/toastmachine/
   ```

## MusicBingo

### Порядок деплоя новой версии

1. **Бамп версии** в:
   - `apps/musicbingo/package.json`
   - `apps/musicbingo/src-tauri/Cargo.toml`
   - `apps/musicbingo/src-tauri/tauri.conf.json`

2. **Запушить тег**:
   ```bash
   git tag musicbingo-v0.1.1
   git push origin musicbingo-v0.1.1
   ```

3. Дождаться `.github/workflows/release-musicbingo.yml`.
   - Если секрет `EVENTHUNT_SSH_KEY` не настроен, этап `deploy-site` упадёт. Тогда скачать DMG/MSI/EXE из GitHub Release вручную.

4. **Залить артефакты на сервер**:
   ```bash
   scp -i ~/.ssh/eventhuntssh MusicBingo_*.dmg root@soft.eventhunt.ru:/opt/eventhunt-license-server/releases/musicbingo/
   scp -i ~/.ssh/eventhuntssh MusicBingo_*.msi root@soft.eventhunt.ru:/opt/eventhunt-license-server/releases/musicbingo/
   scp -i ~/.ssh/eventhuntssh MusicBingo_*.exe root@soft.eventhunt.ru:/opt/eventhunt-license-server/releases/musicbingo/
   ```

5. **Обновить лендинг** при необходимости:
   ```bash
   scp -r -i ~/.ssh/eventhuntssh apps/musicbingo/public/musicbingo root@soft.eventhunt.ru:/opt/eventhunt-license-server/public/
   ```

## Перезапуск license-server

Если обновлялся код сервера:

```bash
ssh -i ~/.ssh/eventhuntssh root@soft.eventhunt.ru "docker restart eventhunt-license-server"
```

## Проверка

```bash
# ToastMachine
curl -s 'https://soft.eventhunt.ru/api/releases/latest?app=toastmachine' | jq

# MusicBingo
curl -s 'https://soft.eventhunt.ru/api/releases/latest?app=musicbingo' | jq
```

Ожидаемый ответ:
```json
{
  "ok": true,
  "version": "0.1.0",
  "macos": "/releases/musicbingo/MusicBingo_0.1.0_universal.dmg",
  "windows": "/releases/musicbingo/MusicBingo_0.1.0_x64_en-US.msi"
}
```
