# Self-hosted Linux runner на soft.eventhunt.ru

Runner установлен в `/opt/actions-runner` и запущен как systemd-сервис от пользователя `github-runner`.

## Параметры

- **Сервер:** `soft.eventhunt.ru` (`185.255.133.210`)
- **OS:** Ubuntu 24.04 LTS
- **Пользователь runner:** `github-runner`
- **Имя runner в GitHub:** `soft-eventhunt-linux`
- **Labels:** `self-hosted`, `linux`, `soft-eventhunt`
- **Service:** `actions.runner.berezovskyoleg-EventSoft.soft-eventhunt-linux.service`

## Управление

```bash
# статус
systemctl status actions.runner.berezovskyoleg-EventSoft.soft-eventhunt-linux.service

# перезапуск
systemctl restart actions.runner.berezovskyoleg-EventSoft.soft-eventhunt-linux.service

# логи
journalctl -u actions.runner.berezovskyoleg-EventSoft.soft-eventhunt-linux.service -f
```

## Переустановка runner (если нужно)

1. Получить новый registration token:  
   `https://github.com/berezovskyoleg/EventSoft/settings/actions/runners/new`

2. На сервере:

```bash
systemctl stop actions.runner.berezovskyoleg-EventSoft.soft-eventhunt-linux.service
rm -rf /opt/actions-runner
mkdir -p /opt/actions-runner
cd /opt/actions-runner
curl -O -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-x64-2.319.1.tar.gz
tar xzf actions-runner-linux-x64-2.319.1.tar.gz
rm actions-runner-linux-x64-2.319.1.tar.gz
./bin/installdependencies.sh
useradd -m -s /bin/bash github-runner || true
usermod -aG docker github-runner
chown -R github-runner:github-runner /opt/actions-runner
su - github-runner -c "cd /opt/actions-runner && ./config.sh --url https://github.com/berezovskyoleg/EventSoft --token <TOKEN> --name soft-eventhunt-linux --labels self-hosted,linux,soft-eventhunt --unattended --replace"
cd /opt/actions-runner && ./svc.sh install github-runner && ./svc.sh start
```

## Использование в workflow

```yaml
jobs:
  release:
    runs-on: self-hosted
    ...
```

Теперь jobs `release` и `deploy-site` в `release-musicbingo.yml` используют этот runner и не тратят GitHub Actions минуты.
