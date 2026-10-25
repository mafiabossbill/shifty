import type { MetadataRoute } from "next";

import { buildManifest } from "@/lib/pwa/manifest";

/** Served at /manifest.webmanifest; see src/lib/pwa/manifest.ts. */
export default function manifest(): MetadataRoute.Manifest {
  return buildManifest();
}
