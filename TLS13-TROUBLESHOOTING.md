# Проблема с TLS 1.3 на berezovskyoleg.ru

## История

30 июня 2026 года сайт `berezovskyoleg.ru` периодически «падал» для части пользователей: страница могла открыться один раз, а при повторном обновлении браузер зависал и показывал ошибку соединения. Особенно часто проблема проявлялась в **Яндекс.Браузере** и **Chrome**.

## Симптомы

- Сайт открывается по HTTP, но не по HTTPS.
- Первый HTTPS-запрос после перезапуска nginx иногда проходит, повторные — таймаут.
- `curl https://berezovskyoleg.ru/` зависает.
- `curl --tls-max 1.2 https://berezovskyoleg.ru/` работает стабильно.
- В логах nginx периодически появлялись алерты:
  ```
  open socket #N left in connection N
  aborting
  ```
- TCPdump показывал: клиент отправляет `SYN`, сервер отвечает `SYN-ACK`, клиент отправляет `ACK`, но `Client Hello` либо не уходит, либо сервер на него не отвечает.

## Причина

Сервер работал на **Ubuntu 24.04** со стеком:
- `nginx/1.24.0` (затем обновлён до `1.30.3`)
- `OpenSSL 3.0.13`

При попытке современных браузеров использовать **TLS 1.3** происходил сбой handshake. Возможные факторы:
1. Известный баг в nginx с graceful shutdown / keepalive (`open socket left in connection`).
2. Некорректная обработка OpenSSL 3.0.13 TLS 1.3 `Client Hello` с ALPN/0-RTT для части клиентов (особенно LibreSSL на macOS и некоторых мобильных Chromium).
3. Конфликт `keepalive` клиентских HTTPS-соединений с повторным TLS-handshake.

## Быстрое решение (работает прямо сейчас)

Оставить только **TLS 1.2** в конфиге nginx.

Файл: `/etc/nginx/sites-available/default`

```nginx
server {
    listen 443 ssl;
    # ... остальные настройки ...

    ssl_certificate /etc/letsencrypt/live/berezovskyoleg.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/berezovskyoleg.ru/privkey.pem;

    # Временно отключаем TLS 1.3
    ssl_protocols TLSv1.2;

    # Консервативные cipher suites для максимальной совместимости
    ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305";
    ssl_prefer_server_ciphers off;

    ssl_session_cache shared:le_nginx_SSL:10m;
    ssl_session_timeout 1440m;
    ssl_session_tickets off;
}
```

Также рекомендуется отключить keepalive для клиентских HTTPS-соединений:

```nginx
location / {
    proxy_pass http://nextjs;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    keepalive_timeout 0;
    proxy_buffering off;
    # ... остальные proxy-заголовки ...
}
```

Применить:

```bash
nginx -t
systemctl reload nginx
```

## Правильное решение (на будущее)

TLS 1.2 — это временная мера. Для возврата TLS 1.3 нужно:

1. **Обновить OpenSSL** до версии, где исправлены проблемы с TLS 1.3 (например, OpenSSL 3.1+ или 3.2+).
2. **Обновить nginx** до свежей stable-версии (1.26.x/1.28.x), где исправлены проблемы graceful shutdown.
3. **Проверить совместимость** с основными браузерами и устройствами.

### Команды для обновления nginx из официального репозитория

```bash
# Установка зависимостей
apt-get install -y curl gnupg2 ca-certificates lsb-release ubuntu-keyring

# Добавление ключа nginx
curl https://nginx.org/keys/nginx_signing.key | gpg --dearmor \
  | tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null

# Добавление репозитория
echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] \
  http://nginx.org/packages/ubuntu $(lsb_release -cs) nginx" \
  | tee /etc/apt/sources.list.d/nginx.list >/dev/null

# Обновление
apt-get update
apt-get install -y nginx

# После обновления из официального репозитория нужно добавить include sites-enabled
# в /etc/nginx/nginx.conf:
# include /etc/nginx/sites-enabled/*;

nginx -t
systemctl restart nginx
```

### Включить TLS 1.3 обратно

После обновления OpenSSL/nginx заменить в конфиге:

```nginx
ssl_protocols TLSv1.2;
```

на:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
```

и перезагрузить nginx. Затем обязательно проверить на разных устройствах:
- Яндекс.Браузер (Android / desktop)
- Chrome
- Safari
- Firefox
- curl / LibreSSL

## Как диагностировать

### 1. Проверка с разными TLS-версиями

```bash
# TLS 1.2 — должно работать
curl --tls-max 1.2 -I https://berezovskyoleg.ru/

# TLS 1.3 — если падает, проблема в TLS 1.3
curl --tlsv1.3 -I https://berezovskyoleg.ru/
```

### 2. Проверка SSL-handshake через openssl

```bash
# С указанием TLS 1.2
echo | openssl s_client -connect berezovskyoleg.ru:443 -tls1_2

# С указанием TLS 1.3
echo | openssl s_client -connect berezovskyoleg.ru:443 -tls1_3
```

### 3. TCPdump на сервере

```bash
timeout 20 tcpdump -i ens3 -n port 443 and host <IP_клиента>
```

Если видно `SYN → SYN-ACK → ACK`, но `Client Hello` не приходит или на него нет `Server Hello` — это подтверждает проблему TLS-handshake.

### 4. Логи nginx

```bash
tail -f /var/log/nginx/error.log
```

Искать:
- `open socket #N left in connection`
- `aborting`
- `SSL_do_handshake() failed`

## Как откатить изменения

Бэкапы конфига лежат на сервере:

```bash
ls /etc/nginx/sites-available/default.*
# Пример: /etc/nginx/sites-available/default.stable
#         /etc/nginx/sites-available/default.working

# Восстановить рабочую конфигурацию
cp /etc/nginx/sites-available/default.working /etc/nginx/sites-available/default
nginx -t
systemctl reload nginx
```

## Резюме

| Параметр | Текущее значение | Целевое значение |
|----------|------------------|------------------|
| `ssl_protocols` | `TLSv1.2` | `TLSv1.2 TLSv1.3` после обновления OpenSSL/nginx |
| `keepalive_timeout` | `0` | можно вернуть `5-10` после стабилизации TLS 1.3 |
| OpenSSL | `3.0.13` | обновить до `3.1+` |
| nginx | `1.30.3` | следить за stable-веткой |

## Ссылки

- [Nginx issue #2411 — open socket left in connection](https://trac.nginx.org/nginx/ticket/2411)
- [OpenSSL TLS 1.3 RFC 8446](https://datatracker.ietf.org/doc/html/rfc8446)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
