/**
 * Seed script: ensures exactly TARGET_KEYS (100) license keys exist in the DB.
 * Idempotent — running it again only tops up missing keys, never duplicates.
 *
 * Also writes the full key list to download/license-keys.txt so the seller
 * has a copy to hand out to buyers.
 *
 * Run with: bun run scripts/generate-keys.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { db } from "../src/lib/db";
import { generateLicenseKeys } from "../src/lib/license";

const TARGET_KEYS = 100;

async function main() {
  console.log("Counting existing license keys...");
  const existing = await db.licenseKey.findMany({ select: { key: true } });
  const existingKeys = existing.map((k) => k.key);
  console.log(`Found ${existingKeys.length} existing keys.`);

  const missing = TARGET_KEYS - existingKeys.length;
  if (missing <= 0) {
    console.log(`Already have ${TARGET_KEYS}+ keys. Nothing to generate.`);
  } else {
    console.log(`Generating ${missing} new keys...`);
    const newKeys = generateLicenseKeys(missing, existingKeys);
    await db.licenseKey.createMany({
      data: newKeys.map((key) => ({ key })),
    });
    console.log(`Inserted ${newKeys.length} new keys.`);
  }

  const all = await db.licenseKey.findMany({
    orderBy: { createdAt: "asc" },
    select: { key: true, machineFingerprint: true, isActive: true, activatedAt: true },
  });

  const outPath = resolve(process.cwd(), "download/license-keys.txt");
  mkdirSync(dirname(outPath), { recursive: true });
  const lines = all.map((k, i) => {
    const status = !k.isActive
      ? "[REVOKED]"
      : k.machineFingerprint
        ? "[ACTIVATED]"
        : "[AVAILABLE]";
    return `${String(i + 1).padStart(3, "0")}.  ${k.key}   ${status}`;
  });
  const header = [
    "# Toast Slot Machine — License Keys",
    `# Total: ${all.length} keys`,
    `# Available: ${all.filter((k) => !k.machineFingerprint && k.isActive).length}`,
    `# Activated: ${all.filter((k) => k.machineFingerprint).length}`,
    `# Revoked: ${all.filter((k) => !k.isActive).length}`,
    "# Generated: " + new Date().toISOString(),
    "",
  ].join("\n");
  writeFileSync(outPath, header + lines.join("\n") + "\n", "utf8");

  console.log(`\nDone. ${all.length} keys total.`);
  console.log(`Available keys written to: ${outPath}`);
  console.log("\nFirst 5 keys:");
  all.slice(0, 5).forEach((k, i) => console.log(`  ${i + 1}. ${k.key}`));

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
