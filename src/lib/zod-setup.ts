/**
 * Zod 4 probes `new Function("")` on first parse to pick a faster JIT path. Under the page CSP (no
 * 'unsafe-eval', next.config.ts) the probe throws and is caught, but the browser still reports a
 * script-src violation. jitless skips the probe; parsing stays identical, just interpreted.
 * Imported first by every module that defines schemas used in the browser (src/lib/shifts/*).
 */
import { z } from "zod";

z.config({ jitless: true });
