---
Task ID: 1
Agent: main (Z.ai Code)
Task: Build a toast-speaker slot machine ("однорукий Джек") web app with machine-bound license keys (100 pre-generated), runnable locally without internet.

Work Log:
- Explored existing Next.js 16 + TypeScript + Prisma/SQLite + shadcn/ui scaffold. Dev server already running on port 3000.
- Designed `LicenseKey` Prisma model: key (unique), machineFingerprint (nullable → unbound), activatedAt, lastVerifiedAt, isActive (revocation), createdAt. Ran `bun run db:push`.
- Wrote `src/lib/license.ts`: secure key generation (`TOAST-XXXX-XXXX-XXXX`, crypto randomBytes, unambiguous alphabet), SHA-256 fingerprint hashing, HMAC-style session token create/verify.
- Wrote `scripts/generate-keys.ts` seed script (idempotent, tops up to 100). Ran it → 100 keys inserted, also written to `download/license-keys.txt`.
- Built API routes:
  - `POST /api/license/activate` — binds key to machine on first use; rejects if bound to a different fingerprint (403); rejects revoked keys; rejects unknown keys (404).
  - `POST /api/license/verify` — re-checks key+machine on each app load.
  - `GET /api/license/admin/list` — lists all keys with status (admin-secret protected).
  - `POST /api/license/admin/revoke` — revoke / restore a key (admin-secret protected).
- Built client-side `src/lib/fingerprint.ts`: combines canvas, webgl, audio, screen, CPU, timezone, UA into a stable SHA-256 hash per machine/browser.
- Built UI:
  - `src/components/toast-slot/license-gate.tsx` — activation screen (gold/burgundy theme, error/success states).
  - `src/components/toast-slot/admin-panel.tsx` — admin dialog (auth + key list with copy/revoke/restore, status counters).
  - `src/components/toast-slot/slot-machine.tsx` — the game: guest-list textarea (one name per line), casino cabinet with a single vertical reel (3 visible rows, center = winner), one-armed-bandit lever, marquee lights, big spin button, progress bar, winner overlay with looping confetti + ambient glow + trophy.
  - `src/app/page.tsx` — orchestrates loading → locked (gate) → unlocked (slot machine) using localStorage + /verify on mount.
- Slot reel spin: strips names repeated 14×, instant reset (no transition) to current winner centered, then a 7–10s CSS transform transition with ease-out cubic-bezier landing on a random winner near the end of the strip. Motion-blur while spinning.
- Updated `.env` (DATABASE_URL, SESSION_SECRET, ADMIN_SECRET) and layout metadata (Russian title).
- Lint: clean (0 errors / 0 warnings).

Stage Summary:
- 100 license keys generated and stored in SQLite; full list in `download/license-keys.txt`.
- Security verified end-to-end with Agent Browser + curl:
  - Valid key activates & binds to machine ✓
  - Same key on a DIFFERENT fingerprint → 403 "привязан к другому устройству" ✓
  - Unknown key → 404 ✓
  - Admin with wrong secret → 401; correct secret → 200 ✓
- Full UX verified in browser: license gate → activate → load 8 default guests → spin (7–10s) → winner "Дмитрий Козлов" → confetti overlay → spin again → new winner "Анна Петрова" → admin panel lists 100 keys.
- VLM visual review: slot cabinet "polished, casino-like, no visual problems"; winner screen has visible confetti + ambient glow; mobile (390px) layout clean, no overflow.
- Reset 2 test-activated keys back to available → all 100 keys available for delivery.
- No runtime/console errors in dev.log; all API routes return 200.
- Artifacts: `src/lib/license.ts`, `src/lib/fingerprint.ts`, `src/app/api/license/{activate,verify,admin/list,admin/revoke}/route.ts`, `src/components/toast-slot/{license-gate,slot-machine,admin-panel}.tsx`, `scripts/generate-keys.ts`, `download/license-keys.txt`.
