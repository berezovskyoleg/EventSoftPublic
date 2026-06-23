# Доступы для EventSoft

> Этот файл содержит только публичные параметры и пути. Пароли и токены не хранятся здесь — спросить у Олега при необходимости.

## Проект

- **Локальная папка:** `/Users/komp/Documents/EventSoft/EventSoft`
- **GitHub:** https://github.com/berezovskyoleg/EventSoft
- **Сайт:** https://soft.eventhunt.ru/
- **Админка лицензий:** https://soft.eventhunt.ru/admin

## Сервер

- **Хост:** `soft.eventhunt.ru`
- **IP:** `185.255.133.210`
- **Пользователь:** `root`
- **SSH-ключ:** `~/.ssh/eventhuntssh`
- **SSH-команда:**
  ```bash
  ssh -i ~/.ssh/eventhuntssh root@soft.eventhunt.ru
  ```
- **Рабочая директория на сервере:** `/opt/eventhunt-license-server/`
- **Релизы:** `/opt/eventhunt-license-server/releases/`
- **Сайт:** `/opt/eventhunt-license-server/public/`

## GitHub-токен

Если нужен API-доступ, токен хранится в macOS Keychain для `https://github.com`.
Получить можно через:
```bash
echo 'url=https://github.com/berezovskyoleg/EventSoft' | git credential fill
```

## Пароль от сервера

Не хранится в репозитории. Спросить у Олега.
