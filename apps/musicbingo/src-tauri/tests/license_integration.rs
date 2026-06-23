use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

#[path = "../src/license.rs"]
mod license;

use license::LicenseStore;

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn temp_db() -> PathBuf {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!(
        "toast_slot_test_{}_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        n
    ));
    if dir.exists() {
        std::fs::remove_dir_all(&dir).ok();
    }
    std::fs::create_dir_all(&dir).unwrap();
    dir.join("toast_slot.db")
}

fn first_key(store: &LicenseStore) -> String {
    store
        .list_keys()
        .unwrap()
        .into_iter()
        .next()
        .expect("в базе должны быть ключи")
        .0
}

#[test]
fn keys_are_generated_on_open() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let keys = store.list_keys().unwrap();
    assert_eq!(keys.len(), 100, "в базе должно быть 100 ключей");
    for (_, _, active, _) in &keys {
        assert!(*active, "все ключи должны быть активны по умолчанию");
    }
}

#[test]
fn activation_and_verify_work() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let key = first_key(&store);
    let fp = "fp1.aabbccddeeff00112233445566778899";

    let res = store.activate(&key, fp).unwrap();
    assert_eq!(res["ok"], true);
    assert_eq!(res["activated"], true);
    assert_eq!(res["key"], key);

    let verify = store.verify(&key, fp).unwrap();
    assert_eq!(verify["ok"], true);
    assert_eq!(verify["key"], key);
}

#[test]
fn second_activation_with_different_fingerprint_fails() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let key = first_key(&store);

    store.activate(&key, "fp1.first_device").unwrap();

    let err = store
        .activate(&key, "fp1.second_device")
        .expect_err("должна быть ошибка привязки к другому устройству");
    assert!(
        err.contains("другому устройству"),
        "неожиданное сообщение об ошибке: {}",
        err
    );
}

#[test]
fn disabled_key_cannot_be_used() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let key = first_key(&store);
    let fp = "fp1.disabled_test";

    store.set_key_active(&key, false).unwrap();

    let err = store
        .activate(&key, fp)
        .expect_err("отозванный ключ не должен активироваться");
    assert!(
        err.contains("отозван") || err.contains("отключ"),
        "неожиданное сообщение об ошибке: {}",
        err
    );
}

#[test]
fn re_enabled_key_can_be_activated_again() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let key = first_key(&store);
    let fp = "fp1.reenable_test";

    store.set_key_active(&key, false).unwrap();
    store.set_key_active(&key, true).unwrap();

    let res = store.activate(&key, fp).unwrap();
    assert_eq!(res["ok"], true);
}

#[test]
fn reset_key_clears_machine_binding() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let key = first_key(&store);
    let fp1 = "fp1.1111111111111111111111111111111111111111111111111111111111111111";
    let fp2 = "fp1.2222222222222222222222222222222222222222222222222222222222222222";

    store.activate(&key, fp1).unwrap();
    store.reset_key(&key).unwrap();

    let res = store.activate(&key, fp2).unwrap();
    assert_eq!(res["ok"], true);
    assert_eq!(res["activated"], true);
}

#[test]
fn reset_all_keys_clears_all_bindings() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let keys = store.list_keys().unwrap();

    store.activate(&keys[0].0, "fp1.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").unwrap();
    store.activate(&keys[1].0, "fp1.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb").unwrap();

    let count = store.reset_all_keys().unwrap();
    assert_eq!(count, 100);

    let refreshed = store.list_keys().unwrap();
    for (_, fp, active, sold) in refreshed {
        assert!(fp.is_none());
        assert!(active);
        assert!(sold.is_none());
    }
}

#[test]
fn key_normalization_ignores_case_and_whitespace() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let key = first_key(&store);
    let fp = "fp1.normalization_test";

    let malformed = key
        .to_lowercase()
        .replace('-', " - ")
        .replace("TOAST", "toast");

    let res = store.activate(&malformed, fp).unwrap();
    assert_eq!(res["ok"], true);
    assert_eq!(res["key"], key);
}

#[test]
fn fixed_key_works_without_being_pre_inserted() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();

    // Remove all keys to simulate an old/empty database on a customer device.
    store.reset_all_keys().unwrap();
    let conn = rusqlite::Connection::open(&db).unwrap();
    conn.execute("DELETE FROM license_keys", []).unwrap();
    drop(conn);

    // A key from the shipped fixed pool should still activate, even though
    // it is not present in the local database yet.
    let fixed_key = "MUSIC-2BAZ-Q4V9-65YM-B3RV";
    let fp = "fp1.bbddccdd11223344556677889900aabbccddeeff00112233445566778899aa";
    let res = store.activate(fixed_key, fp).unwrap();
    assert_eq!(res["ok"], true);
    assert_eq!(res["activated"], true);

    let verify = store.verify(fixed_key, fp).unwrap();
    assert_eq!(verify["ok"], true);
}

#[test]
fn unknown_key_still_rejected() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let err = store
        .activate("MUSIC-XXXX-XXXX-XXXX-XXXX", "fp1.bbddccdd11223344556677889900aabbccddeeff00112233445566778899aa")
        .expect_err("случайный ключ не должен активироваться");
    assert!(err.contains("не найден"), "неожиданная ошибка: {}", err);
}

#[test]
fn sell_key_marks_it_as_sold() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let key = first_key(&store);

    store.sell_key(&key).unwrap();

    let available = store.list_available_keys().unwrap();
    assert!(!available.contains(&key));

    let keys = store.list_keys().unwrap();
    let row = keys.iter().find(|(k, _, _, _)| k == &key).unwrap();
    assert!(row.3.is_some());
}

#[test]
fn sold_key_cannot_be_sold_again() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let key = first_key(&store);

    store.sell_key(&key).unwrap();
    let err = store.sell_key(&key).expect_err("повторная продажа должна быть запрещена");
    assert!(err.contains("уже продан"), "неожиданная ошибка: {}", err);
}

#[test]
fn export_keys_creates_file() {
    let db = temp_db();
    let store = LicenseStore::open(&db).unwrap();
    let out = db.with_file_name("exported_keys.txt");

    let count = store.export_keys(&out).unwrap();
    assert_eq!(count, 100);
    assert!(out.exists());

    let content = std::fs::read_to_string(&out).unwrap();
    assert!(content.starts_with("# ToastMachine — License Keys"));
    assert!(content.contains("Total: 100 keys"));
    assert!(content.contains("Available: 100"));
    assert!(content.contains("Sold: 0"));
    // 7 header lines + 1 empty line + 100 key lines
    assert_eq!(content.lines().count(), 108);
}
