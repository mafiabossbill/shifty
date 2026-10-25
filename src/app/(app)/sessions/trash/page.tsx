import type { Metadata } from "next";

import { TrashScreen } from "@/components/sessions/trash-screen";

export const metadata: Metadata = { title: "Trash" };

export default function TrashPage() {
  return <TrashScreen />;
}
