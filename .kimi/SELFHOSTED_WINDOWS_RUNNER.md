# Self-hosted runner на Windows для MusicBingo

> Инструкция по настройке Windows-компьютера как GitHub Actions self-hosted runner для сборки `.msi` и `.exe` релизов MusicBingo.

## Что получится

- Windows-компьютер работает как runner для репозитория `berezovskyoleg/EventSoft`.
- Когда ты запускаешь workflow (push tag `musicbingo-v*`), сборка Windows-версии выполняется на этом компьютере.
- Минуты GitHub Actions не расходуются — runner использует свои ресурсы.

## Требования к Windows-компьютеру

- Windows 10/11 или Windows Server 2019/2022 (64-bit)
- Минимум 4 CPU / 8 GB RAM (лучше 16 GB)
- SSD с 50+ GB свободного места
- Постоянное интернет-соединение
- Компьютер должен быть включён во время сборки

---

## Шаг 1. Установить Git

1. Скачать: https://git-scm.com/download/win
2. Установить с настройками по умолчанию.
3. Проверить в PowerShell:
   ```powershell
   git --version
   ```

---

## Шаг 2. Установить Node.js 20 LTS

1. Скачать: https://nodejs.org/en/download/
2. Установить LTS версию (20.x).
3. Проверить в PowerShell:
   ```powershell
   node --version
   npm --version
   ```

---

## Шаг 3. Установить Rust

1. Открыть PowerShell и выполнить:
   ```powershell
   winget install Rustlang.Rustup
   ```
   Или скачать установщик: https://rustup.rs/
2. Перезапустить PowerShell.
3. Проверить:
   ```powershell
   rustc --version
   cargo --version
   ```

---

## Шаг 4. Установить Visual Studio Build Tools

1. Скачать: https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Запустить **Visual Studio Installer**.
3. Выбрать **Desktop development with C++**.
4. Установить.
5. Перезагрузить компьютер.

---

## Шаг 5. Установить GitHub Actions Runner

1. На Windows-компьютере создать папку, например:
   ```
   C:\actions-runner
   ```

2. Скачать runner для Windows x64:
   ```powershell
   cd C:\actions-runner
   Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-win-x64-2.319.1.zip -OutFile actions-runner-win-x64-2.319.1.zip
   ```
   Актуальную версию можно проверить тут: https://github.com/actions/runner/releases

3. Распаковать:
   ```powershell
   Add-Type -AssemblyName System.IO.Compression.FileSystem
   [System.IO.Compression.ZipFile]::ExtractToDirectory("C:\actions-runner\actions-runner-win-x64-2.319.1.zip", "C:\actions-runner")
   ```

---

## Шаг 6. Зарегистрировать runner в репозитории

1. Открыть в браузере:
   https://github.com/berezovskyoleg/EventSoft/settings/actions/runners

2. Нажать **New self-hosted runner** → выбрать **Windows** и **x64**.

3. Скопировать команду конфигурации. Она будет выглядеть примерно так:
   ```powershell
   .\config.cmd --url https://github.com/berezovskyoleg/EventSoft --token AAAAAAAAABBBBBBBBBBCCCCCC
   ```

4. Выполнить эту команду в PowerShell из папки `C:\actions-runner`.

5. На вопрос о имени runner ввести, например:
   ```
   windows-musicbingo
   ```

6. На вопрос о labels нажать Enter (можно добавить label позже) или ввести:
   ```
   windows,musicbingo
   ```

7. На вопрос о рабочей папке нажать Enter (по умолчанию `_work`).

---

## Шаг 7. Настроить runner как службу Windows

Чтобы runner запускался автоматически при включении компьютера:

```powershell
cd C:\actions-runner
.\svc.cmd install
```

После этого runner будет работать как служба. Проверить статус:

```powershell
.\svc.cmd status
```

---

## Шаг 8. Проверить, что runner онлайн

1. Открыть https://github.com/berezovskyoleg/EventSoft/settings/actions/runners
2. Runner `windows-musicbingo` должен быть в статусе **Idle**.

---

## Шаг 9. Обновить workflow для использования self-hosted runner

В файле `.github/workflows/release-musicbingo.yml` изменить `build-windows` job:

```yaml
  build-windows:
    runs-on: self-hosted
    # или runs-on: windows-musicbingo
```

Если настроил label `musicbingo`, можно указать:
```yaml
  build-windows:
    runs-on: musicbingo
```

---

## Шаг 10. Запустить сборку с MacBook

На MacBook в терминале выполнить:

```bash
cd /Users/komp/Documents/EventSoft/EventSoft
git tag musicbingo-v0.1.2
git push origin musicbingo-v0.1.2
```

GitHub отправит Windows-сборку на твой Windows-компьютер. Мониторить можно тут:
https://github.com/berezovskyoleg/EventSoft/actions

---

## Возможные проблемы

### Runner не появляется в списке
- Проверить, что служба запущена: `services.msc` → GitHub Actions Runner → **Start**.
- Проверить интернет-соединение и брандмауэр.

### Ошибка при сборке Rust/Tauri
- Убедиться, что Visual Studio Build Tools установлены с workload **Desktop development with C++**.
- Перезагрузить компьютер после установки.

### Нет прав на запуск скриптов
- Запускать PowerShell от имени администратора.

---

## Ссылки

- GitHub Actions Runner releases: https://github.com/actions/runner/releases
- Tauri Windows prerequisites: https://tauri.app/start/prerequisites/
