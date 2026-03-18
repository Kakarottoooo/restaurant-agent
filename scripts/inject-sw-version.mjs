/**
 * Injects the Next.js BUILD_ID into sw.js cache name so each deployment
 * gets a fresh cache key and old caches are evicted on activation.
 * Runs automatically via "postbuild" script in package.json.
 */
import { readFileSync, writeFileSync } from "fs";

let buildId;
try {
  buildId = readFileSync(".next/BUILD_ID", "utf8").trim();
} catch {
  // BUILD_ID not available (e.g., dev mode) — skip silently
  process.exit(0);
}

const swPath = "public/sw.js";
const sw = readFileSync(swPath, "utf8");

// Replace whatever version is currently set (idempotent across multiple builds)
const versioned = sw.replace(/"folio-[^"]*"/, `"folio-${buildId}"`);
writeFileSync(swPath, versioned);
console.log(`[sw] Cache versioned: folio-${buildId}`);
