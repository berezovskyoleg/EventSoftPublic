# Инструкция для ИИ: установка Windows self-hosted runner

> Этот файл предназначен для другого экземпляра Kimi Code CLI (или любого ИИ-агента), который будет настраивать Windows self-hosted runner для репозитория `berezovskyoleg/EventSoft`.
> Действуй по шагам. Не коммить sensitive-данные.

## Цель

Установить на физическом Windows-компьютере пользователя GitHub Actions self-hosted runner, чтобы job `build-windows` в `.github/workflows/release-musicbingo.yml` выполнялся локально и не расходовал GitHub Actions минуты.

## Контекст

- **Репозиторий:** `https://github.com/berezovskyoleg/EventSoft`
- **Workflow:** `.github/workflows/release-musicbingo.yml`
- **Job:** `build-windows`
  - `runs-on: self-hosted`
  - `shell: powershell`
  - `working-directory: apps/musicbingo`
  - Команды: `npm install`, `npm run build`, `npm run tauri:build -- --target x86_64-pc-windows-msvc`
- **Целевой target Rust:** `x86_64-pc-windows-msvc`
- **Ожидаемые артефакты:**
  - `apps/musicbingo/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi`
  - `apps/musicbingo/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`

## Где взять GitHub PAT

Открой файл проекта `.kimi/SECRETS.md`. В нём находится GitHub Fine-grained PAT.

Если файл отсутствует или токен не работает (401/403 при запросе registration token), попроси пользователя:
1. Открыть `https://github.com/settings/tokens?type=beta`
2. Создать/обновить fine-grained token для репозитория `berezovskyoleg/EventSoft` со следующими правами:
   - **Actions:** Read and write
   - **Administration:** Read and write
   - **Contents:** Read and write
   - **Metadata:** Read
   - **Releases:** Read and write
   - **Secrets:** Read
3. Вставить токен в `.kimi/SECRETS.md`.

## Шаг 1. Подготовить рабочую директорию

Если проект не клонирован:

```powershell
git clone https://github.com/berezovskyoleg/EventSoft.git
cd EventSoft
```

## Шаг 2. Установить зависимости Windows

Все команды ниже — в PowerShell от имени администратора (Run as Administrator).

### 2.1 Git

```powershell
winget install --id Git.Git -e --source winget
```

Перезапусти PowerShell, затем:

```powershell
git --version
```

### 2.2 Node.js 20 LTS

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget --version 20.11.1
```

Перезапусти PowerShell, затем:

```powershell
node --version
npm --version
```

### 2.3 Visual Studio Build Tools (C++ compiler + Windows SDK)

Tauri требует MSVC. Установи через winget:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget
```

Затем запусти Visual Studio Installer и добавь workload **"Desktop development with C++"**:

```powershell
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive --wait
```

Если `setup.exe` находится в другом пути — адаптируй.

Проверь наличие `cl.exe`:

```powershell
& "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && cl
```

### 2.4 WebView2 Runtime

Обычно уже установлен в Windows 11 / современных Windows 10. Проверь:

```powershell
Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" | Select-Object -ExpandProperty pv
```

Если не установлен:

```powershell
winget install --id Microsoft.EdgeWebView2Runtime -e --source winget
```

### 2.5 Rust

```powershell
curl --proto '=https' --tlsv1.2 -sSf https://win.rustup.rs/x86_64 -o rustup-init.exe
.\rustup-init.exe -y --default-host x86_64-pc-windows-msvc --default-toolchain stable
Remove-Item rustup-init.exe
```

Перезапусти PowerShell, затем:

```powershell
rustup target add x86_64-pc-windows-msvc
rustc --version
cargo --version
rustup target list --installed
```

## Шаг 3. Получить registration token

Используй PAT из `.kimi/SECRETS.md`:

```powershell
$env:GITHUB_TOKEN="<PAT_из_SECRETS.md>"
$resp = Invoke-RestMethod -Uri "https://api.github.com/repos/berezovskyoleg/EventSoft/actions/runners/registration-token" -Method Post -Headers @{
    Authorization="Bearer $env:GITHUB_TOKEN"
    Accept="application/vnd.github+json"
}
$resp.token
```

Токен живёт ~1 час. Если истёк — получи заново.

## Шаг 4. Скачать и зарегистрировать runner

```powershell
New-Item -ItemType Directory -Force -Path C:\actions-runner | Set-Location
Invoke-WebRequest -Uri "https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-win-x64-2.319.1.zip" -OutFile "actions-runner-win-x64-2.319.1.zip"
Expand-Archive -Path "actions-runner-win-x64-2.319.1.zip" -DestinationPath .
Remove-Item "actions-runner-win-x64-2.319.1.zip"
```

Зарегистрируй:

```powershell
.\config.cmd --url https://github.com/berezovskyoleg/EventSoft --token <TOKEN_ИЗ_ШАГА_3> --name windows-build-pc --labels self-hosted,windows,x64,windows-build-pc --unattended --replace
```

Если `config.cmd` требует интерактивного ввода — используй `config.sh` через Git Bash или WSL не нужно; `config.cmd` поддерживает `--unattended`.

## Шаг 5. Установить runner как службу Windows

```powershell
.\svc.cmd install
.\svc.cmd start
```

Проверь статус:

```powershell
.\svc.cmd status
```

## Шаг 6. Проверить, что runner онлайн в GitHub

```powershell
Invoke-RestMethod -Uri "https://api.github.com/repos/berezovskyoleg/EventSoft/actions/runners" -Headers @{
    Authorization="Bearer $env:GITHUB_TOKEN"
    Accept="application/vnd.github+json"
} | Select-Object -ExpandProperty runners | Select-Object name, status, os, labels
```

Должен появиться runner `windows-build-pc` со статусом `online`.

## Шаг 7. Протестировать сборку MusicBingo

В PowerShell (не обязательно от администратора):

```powershell
cd EventSoft\apps\musicbingo
npm install
npm run build
npm run tauri:build -- --target x86_64-pc-windows-msvc
```

Ожидаемый результат:

```text
apps/musicbingo/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi
apps/musicbingo/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe
```

## Шаг 8. Обновить документацию проекта

После успешной установки обнови `.kimi/SELFHOSTED_WINDOWS_RUNNER.md`:
- имя runner
- имя Windows-ПК
- версии установленного ПО
- особенности окружения

## Troubleshooting

### `npm run tauri:build` падает с ошибкой о `link.exe`

- Не установлен MSVC или не запущен `vcvars64.bat`.
- Решение: убедись, что Visual Studio Build Tools установлен с workload `Desktop development with C++`, и перезагрузи ПК.

### `rustup target add x86_64-pc-windows-msvc` не работает

- Rust установлен не для MSVC toolchain. Переустанови rustup с `--default-host x86_64-pc-windows-msvc`.

### Runner не появляется в GitHub

- Проверь, что registration token свежий.
- Проверь логи runner: `C:\actions-runner\_diag\`.

### PowerShell execution policy

Если `config.cmd` или `svc.cmd` не запускаются:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Что НЕ делать

- Не коммить `C:\actions-runner\.runner`, `.credentials`, `.env` и другие sensitive-файлы runner'а.
- Не вставляй PAT в код или в файлы репозитория.
