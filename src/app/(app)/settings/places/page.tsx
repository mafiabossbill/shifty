import type { Metadata } from "next";

import { PlacesSettings } from "@/components/settings/places-settings";

export const metadata: Metadata = { title: "Places" };

export default function Page() {
  return <PlacesSettings />;
}
