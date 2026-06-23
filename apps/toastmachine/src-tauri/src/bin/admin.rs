use sha2::{Digest, Sha256};
use std::env;
use std::path::PathBuf;

#[path = "../license.rs"]
mod license;

use license::LicenseStore;

const APP_ID: &str = "com.toastmachine.toast-slot";
const DB_NAME: &str = "toast_slot.db";

fn compute_machine_fingerprint() -> String {
    let uid = machine_uid::get().unwrap_or_default();
    let user = whoami::username();
    let raw = format!("{}|{}|toast-slot-v1", uid, user);
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let hash = hex::encode(hasher.finalize());
    format!("fp1.{}", hash)
}

fn default_db_path() -> Result<PathBuf, String> {
    let dir = dirs::data_dir().ok_or("Не удалось определить папку данных пользователя.")?;
    Ok(dir.join(APP_ID).join(DB_NAME))
}

fn print_usage() {
    eprintln!(
        "Использование:
  admin list [путь_к_бд]
  admin export <файл> [путь_к_бд]
  admin available [путь_к_бд]
  admin sell <ключ> [путь_к_бд]
  admin fingerprint
  admin activate <ключ> <fingerprint> [путь_к_бд]
  admin verify <ключ> <fingerprint> [путь_к_бд]
  admin disable <ключ> [путь_к_бд]
  admin enable <ключ> [путь_к_бд]
  admin reset <ключ> [путь_к_бд]
  admin reset-all [путь_к_бд]

sell      — пометить ключ как проданный (чтобы не выдать его повторно).
available — показать ключи, которые ещё можно продать.
reset     — сбросить привязку к устройству, чтобы ключ можно было активировать снова.
reset-all — сбросить привязку для всех ключей (полезно при тестировании).

Если путь к БД не указан, используется стандартная папка приложения."
    );
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_usage();
        std::process::exit(1);
    }

    let command = args[1].as_str();
    let db_path = match args.last().map(|s| s.as_str()) {
        Some(last) if last.ends_with(".db") && args.len() > 2 => PathBuf::from(last),
        _ => default_db_path().unwrap_or_else(|e| {
            eprintln!("Ошибка: {}", e);
            std::process::exit(1);
        }),
    };

    let store = LicenseStore::open(&db_path).unwrap_or_else(|e| {
        eprintln!("Ошибка открытия БД '{}': {}", db_path.display(), e);
        std::process::exit(1);
    });

    match command {
        "list" => {
            let keys = store.list_keys().unwrap_or_else(|e| {
                eprintln!("Ошибка чтения ключей: {}", e);
                std::process::exit(1);
            });
            println!(
                "{:<30} {:<12} {:<10} {}",
                "КЛЮЧ", "АКТИВИРОВАН", "ПРОДАН", "ДЕЙСТВУЕТ"
            );
            for (key, fp, active, sold) in keys {
                println!(
                    "{:<30} {:<12} {:<10} {}",
                    key,
                    if fp.is_some() { "да" } else { "нет" },
                    if sold.is_some() { "да" } else { "нет" },
                    if active { "да" } else { "нет" }
                );
            }
        },
        "available" => {
            let keys = store.list_available_keys().unwrap_or_else(|e| {
                eprintln!("Ошибка чтения ключей: {}", e);
                std::process::exit(1);
            });
            println!("Доступно для продажи: {}", keys.len());
            for key in keys {
                println!("{}", key);
            }
        },
        "sell" => {
            if args.len() < 3 {
                print_usage();
                std::process::exit(1);
            }
            let key_arg = &args[2];
            store.sell_key(key_arg).unwrap_or_else(|e| {
                eprintln!("Ошибка пометки ключа: {}", e);
                std::process::exit(1);
            });
            println!("Ключ {} помечен как проданный.", key_arg);
        },
        "export" => {
            if args.len() < 3 {
                print_usage();
                std::process::exit(1);
            }
            let out = PathBuf::from(&args[2]);
            let count = store.export_keys(&out).unwrap_or_else(|e| {
                eprintln!("Ошибка экспорта: {}", e);
                std::process::exit(1);
            });
            println!("Экспортировано {} ключей в '{}'.", count, out.display());
        },
        "fingerprint" => {
            println!("{}", compute_machine_fingerprint());
        },
        "activate" => {
            if args.len() < 4 {
                print_usage();
                std::process::exit(1);
            }
            let key_arg = &args[2];
            let fp_arg = &args[3];
            match store.activate(key_arg, fp_arg) {
                Ok(value) => println!("{}", value),
                Err(e) => {
                    eprintln!("{{\"error\":\"{}\"}}", e.replace('"', "\\\""));
                    std::process::exit(1);
                }
            }
        },
        "verify" => {
            if args.len() < 4 {
                print_usage();
                std::process::exit(1);
            }
            let key_arg = &args[2];
            let fp_arg = &args[3];
            match store.verify(key_arg, fp_arg) {
                Ok(value) => println!("{}", value),
                Err(e) => {
                    eprintln!("{{\"error\":\"{}\"}}", e.replace('"', "\\\""));
                    std::process::exit(1);
                }
            }
        },
        "disable" | "enable" => {
            if args.len() < 3 {
                print_usage();
                std::process::exit(1);
            }
            let key_arg = &args[2];
            let active = command == "enable";
            store.set_key_active(key_arg, active).unwrap_or_else(|e| {
                eprintln!("Ошибка изменения статуса ключа: {}", e);
                std::process::exit(1);
            });
            println!(
                "Ключ {} {}.",
                key_arg,
                if active { "активирован" } else { "отключён" }
            );
        },
        "reset" => {
            if args.len() < 3 {
                print_usage();
                std::process::exit(1);
            }
            let key_arg = &args[2];
            store.reset_key(key_arg).unwrap_or_else(|e| {
                eprintln!("Ошибка сброса ключа: {}", e);
                std::process::exit(1);
            });
            println!("Ключ {} сброшен. Теперь его можно активировать заново.", key_arg);
        },
        "reset-all" => {
            let count = store.reset_all_keys().unwrap_or_else(|e| {
                eprintln!("Ошибка сброса ключей: {}", e);
                std::process::exit(1);
            });
            println!("Сброшено {} ключей. Все ключи снова доступны для активации.", count);
        }
        _ => {
            print_usage();
            std::process::exit(1);
        }
    }
}
