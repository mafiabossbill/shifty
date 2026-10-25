import { Habitat } from "@/components/mochi/habitat";
import { Mochi } from "@/components/mochi/mochi";
import type { CatalogItem } from "@/components/mochi/catalog";
import type { AccessoryKey, BackgroundKey, DecorKey, HatKey, PaletteKey } from "@/components/mochi/parts";

export interface Look {
  palette: string;
  hat: string;
  accessory: string;
  background: string;
  decor: string[];
}

/** A small, still picture of what an item looks like on Mochi or in the room. */
export function ItemPreview({ item, look, theme, size = 56 }: { item: CatalogItem; look: Look; theme: "dark" | "light"; size?: number }) {
  if (item.kind === "background" || item.kind === "decor") {
    const background = (item.kind === "background" ? item.key : "dusk") as BackgroundKey;
    const decor = (item.kind === "decor" ? [item.key] : []) as DecorKey[];
    return (
      <Habitat
        background={background}
        decor={decor}
        theme={theme}
        timeOfDay="evening"
        animate={false}
        label={item.name}
        className="rounded-[10px]"
        style={{ width: "100%" }}
      />
    );
  }
  return (
    <Mochi
      size={size}
      mood="happy"
      animate={false}
      palette={(item.kind === "palette" ? item.key : look.palette) as PaletteKey}
      hat={(item.kind === "hat" ? item.key : "none") as HatKey}
      accessory={(item.kind === "accessory" ? item.key : "none") as AccessoryKey}
      title={item.name}
    />
  );
}
