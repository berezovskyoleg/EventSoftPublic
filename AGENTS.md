# Agent Instructions for EventSoft

## Deployment Safety Rules

### 1. Never leave backup nginx configs in `sites-enabled`
- After editing `/etc/nginx/sites-enabled/*`, always remove any `.bak` files you created.
- Duplicate `server_name` blocks cause nginx to pick the wrong config and break HTTPS.
- Run `nginx -t` after every change.
- If you touched SSL, HTTP/2, or WebSocket settings, use `systemctl restart nginx` instead of `reload`. Stale nginx workers can keep a broken SSL context alive and cause intermittent timeouts for users.

### 2. Keep TLS settings consistent across all server blocks on port 443
- This server runs **nginx 1.24 + OpenSSL 3.0**, which has a known TLS 1.3 handshake bug.
- If you disable TLS 1.3 for one host, disable it globally in `/etc/nginx/nginx.conf`:
  ```nginx
  ssl_protocols TLSv1.2;
  ```
- Do not mix `http2` and non-`http2` server blocks on the same port; it causes SSL instability.
- If disabling `http2`, disable it for **all** `listen 443 ssl` blocks.

### 3. Always test static SPA routes with and without trailing slash and query string
- For `/musicbingo/play` and `/toastmachine/play`, verify:
  - `https://soft.eventhunt.ru/musicbingo/play`
  - `https://soft.eventhunt.ru/musicbingo/play/`
  - `https://soft.eventhunt.ru/musicbingo/play?room=CODE`
- Use exact nginx locations or explicit `try_files` to avoid 301/404 on one of the variants.

### 4. Preserve working configs
- After a successful fix, copy the working config to a `.working` backup in `sites-available`:
  ```bash
  cp /etc/nginx/sites-enabled/eventhunt-soft /etc/nginx/sites-available/eventhunt-soft.working
  cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.working
  ```

### 5. Test HTTPS immediately after restart
- Run:
  ```bash
  for i in 1 2 3 4 5; do
    curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 https://soft.eventhunt.ru/musicbingo/play/
  done
  ```
- If any request times out or returns 5xx, investigate before declaring the deploy successful.

## Build & Deploy Checklist

1. `cd apps/web && npm run build`
2. Copy `apps/web/dist/*` to both:
   - `license-server/public/musicbingo/play/`
   - `license-server/public/toastmachine/play/`
3. Deploy server code if changed:
   - `license-server/src/ws/musicbingo.js`
   - `license-server/src/server.js`
   - `license-server/package.json`
4. Restart container: `docker compose restart`
5. Verify HTTPS endpoints (see rule 5 above).
6. Verify SPA routes (see rule 3 above).


---

## Параллельные сессии (worktrees)

Несколько сессий могут работать в этом репозитории одновременно. Каждая изолирована
managed worktree OpenClaw (`~/Documents/_worktrees/<hash>/<name>`, ветка `openclaw/<name>`).

Правила, которые нельзя нарушать:

- **Не трогай чужую работу.** Никаких `git add -A`, `git add .`, `git stash`, `git checkout .`,
  `git reset --hard`, `git clean -fd`. Добавляй только свои файлы, поимённо.
- **Не переключай ветки** за пределами своей. `main` занят главным чекаутом — git это и так
  запретит, но не пытайся обойти.
- **Не пушь в `main` напрямую.** Только своя ветка + PR.
- **`.env` в worktree есть** (копируется через `.worktreeinclude`). Если его нет — скопируй
  из главного чекаута, но не коммить.
- **`node_modules` нет.** Поставь зависимости перед запуском.
- **Порт для dev-сервера** бери уникальный (`PORT` из окружения или суффикс имени worktree),
  чтобы две сессии не подрались за 3000.

## Деплой

Деплой — общий ресурс на всех сессиях. Гонка двух деплоев ломает прод.

- Деплоить можно **только из главного чекаута**, не из worktree.
- Перед деплоем взять лок:

```sh
lockf -k -t 900 /tmp/deploy-PROJECT.lock ./deploy.sh prod
```

`lockf` есть на macOS, `flock` — нет. Если лок занят, деплой не начинать:
сообщить, что идёт другой деплой, и подождать. Замени `PROJECT` на имя этого проекта.
