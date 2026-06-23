# Деплой ToastMachine на soft.eventhunt.ru

## Доступ к серверу

- **Хост:** `soft.eventhunt.ru` (`185.255.133.210`)
- **Пользователь:** `root`
- **Пароль:** спросить у Олега (не хранится в репозитории)
- **SSH-команда:**
  ```bash
  ssh root@soft.eventhunt.ru
  ```
  Если используется `sshpass`:
  ```bash
  sshpass -p 'ПАРОЛЬ' ssh -o StrictHostKeyChecking=no root@soft.eventhunt.ru
  ```

## Что нужно обновить

На сервере приложение и сайт работают через `license-server`:

- `/opt/eventhunt-license-server/` — рабочая копия сервера и сайта.
- `/opt/eventhunt-license-server/releases/` — директория с файлами для скачивания (`*.dmg`, `*.msi`, `*.exe`).
- Nginx отдаёт `/releases/` напрямую, а всё остальное проксирует на Node.js-сервер.

## Порядок деплоя новой версии

1. **Бамп версии** в:
   - `apps/toastmachine/package.json`
   - `apps/toastmachine/src-tauri/Cargo.toml`
   - `apps/toastmachine/src-tauri/tauri.conf.json`

2. **Собрать macOS-версию локально** (universal DMG):
   ```bash
   cd apps/toastmachine
   ./scripts/build-macos-universal.sh
   ```
   Результат: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/ToastMachine_*.dmg`

3. **Собрать Windows-версию** через GitHub Actions:
   - Запушить тег:
     ```bash
     git tag v0.2.6
     git push origin v0.2.6
     ```
   - Дождаться завершения `.github/workflows/release.yml`.
   - Скачать артефакты Windows (`*.msi` и/или `*.exe`) из GitHub Release.

4. **Подготовить релизы локально**:
   ```bash
   mkdir -p license-server/releases
   cp apps/toastmachine/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ToastMachine_*.dmg license-server/releases/
   cp /path/to/downloaded/ToastMachine_*.msi license-server/releases/
   ```

5. **Залить на сервер**:
   ```bash
   # Сайт (HTML/CSS/JS)
   rsync -avz --delete license-server/public/ root@soft.eventhunt.ru:/opt/eventhunt-license-server/public/

   # Релизы (DMG/MSI)
   rsync -avz license-server/releases/ root@soft.eventhunt.ru:/opt/eventhunt-license-server/releases/
   ```

6. **Перезапустить сервис** (если обновлялся код сервера):
   ```bash
   ssh root@soft.eventhunt.ru "cd /opt/eventhunt-license-server && docker compose restart"
   ```

7. **Проверить**:
   - Открыть https://soft.eventhunt.ru/toastmachine
   - Убедиться, что кнопки скачивания активны и ведут на `/releases/ToastMachine_*`

## Именование файлов

Файлы релизов должны содержать версию, например:
- `ToastMachine_0.2.6_x64.dmg`
- `ToastMachine_0.2.6_x64-setup.exe`

API `/api/releases/latest` берёт последний `.dmg` и последний `.msi`/`.exe` из `releases/`.

## Быстрая проверка API

```bash
curl -s https://soft.eventhunt.ru/api/releases/latest | jq
```

Ожидаемый ответ:
```json
{
  "ok": true,
  "version": "0.2.6",
  "macos": "/releases/ToastMachine_0.2.6_x64.dmg",
  "windows": "/releases/ToastMachine_0.2.6_x64-setup.exe"
}
```
