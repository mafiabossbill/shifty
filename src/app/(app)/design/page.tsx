import type { Metadata } from "next";

import { DesignSystem } from "./design-system";

export const metadata: Metadata = { title: "Design", robots: { index: false } };

/** Living style guide (not in the nav): every token and primitive, in the current theme and accent. */
export default function DesignPage() {
  return <DesignSystem />;
}
