/**
 * One signed-in screen in the registry: either where it can be seen in the gallery, in every state it
 * can be in (the first state is always "default"), or the written reason it is not there.
 */
export type GalleryEntry = { gallery: string; states: readonly string[] } | { exempt: string };

export type GalleryArea = Record<string, GalleryEntry>;

/** The reason on a screen whose redesign lane has not landed yet. The lane replaces it with gallery pages. */
export const awaiting = (lane: "R1" | "R2" | "R3" | "R4" | "R5"): GalleryEntry => ({ exempt: `awaiting redesign lane ${lane}` });
