/**
 * File upload rules shared by the browser (before uploading) and the server (when registering
 * the file). Storage paths start with the organization id so bucket policies can scope them:
 * `<organization_id>/<entity_id>/<uuid>-<safe-name>` (see supabase/optional/storage.sql.example).
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
  "text/csv",
] as const;
export type UploadMimeType = (typeof UPLOAD_MIME_TYPES)[number];

/** Lowercase, ASCII, no path separators; keeps the extension. */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return (cleaned || "file").slice(-100);
}

export function storagePath(organizationId: string, entityId: string, fileName: string, id: string = crypto.randomUUID()): string {
  return `${organizationId}/${entityId}/${id}-${safeFileName(fileName)}`;
}

export function uploadProblem(file: { size: number; type: string }): string | null {
  if (!(UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) return "Attach a photo, PDF or CSV.";
  if (file.size > MAX_UPLOAD_BYTES) return "Files must be 10 MB or smaller.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

/** Target size for phone photos: longest side at most `max` px, aspect ratio kept, never upscaled. */
export function fitWithin(width: number, height: number, max = 1600): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Browser only: re-encode a photo as JPEG at most `max` px (phone photos are 3–8 MB; this makes them
 * ~200–400 KB). Drops EXIF (including GPS) because the pixels are redrawn: keep location separately if needed.
 */
export async function compressImage(file: File, { max = 1600, quality = 0.8 } = {}): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = new OffscreenCanvas(size.width, size.height);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}
