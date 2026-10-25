/**
 * Release gate: the legal pages may not go live with [placeholders] in src/lib/legal.ts.
 * `npm run legal:check` — exits 1 and lists what's missing.
 */
import { LEGAL, legalPlaceholders } from "../src/lib/legal";

const missing = legalPlaceholders(LEGAL);
if (missing.length) {
  console.error(`Legal details still to fill in src/lib/legal.ts (${missing.length}):`);
  for (const path of missing) console.error(`  - ${path}`);
  console.error("Get them from the go-live data pack (docs/factory/intake/GO_LIVE_DATA_PACK_TEMPLATE.md).");
  process.exit(1);
}
console.log("Legal details complete: /privacy, /terms, /cookies and /data-deletion are ready to publish.");
