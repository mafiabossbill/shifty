#!/usr/bin/env node
/**
 * Generates the PWA and favicon set from one brand color, with no image library:
 * RGBA PNGs (Turbopack rejects .ico files whose PNGs lack alpha) and an .ico that
 * embeds a 32px RGBA PNG.
 *
 *   node scripts/generate-icons.mjs [#hex]   (default: brandColor in src/lib/app-config.ts)
 *
 * Writes public/icons/{icon-192,icon-512,icon-maskable-192,icon-maskable-512,apple-touch-icon}.png,
 * src/app/icon.png, src/app/apple-icon.png and src/app/favicon.ico. Replace them with real
 * artwork when the brand has some (keep the names and sizes; maskable art inside the 80% safe zone).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const root = process.cwd();
const config = readFileSync(path.join(root, "src/lib/app-config.ts"), "utf8");
const color = process.argv[2] ?? config.match(/brandColor:\s*"(#[0-9a-fA-F]{6})"/)?.[1];
if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
  console.error("Usage: node scripts/generate-icons.mjs '#RRGGBB'");
  process.exit(1);
}
const brand = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * The mark: a brand-colored square (rounded unless full-bleed) with a white ring.
 * `inset` shrinks the mark into the maskable safe zone.
 */
function png(size, { fullBleed = false, inset = 0 } = {}) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const radius = fullBleed ? 0 : size * 0.22;
  const c = (size - 1) / 2;
  const ringOuter = size * (0.26 - inset * 0.26);
  const ringInner = ringOuter * 0.58;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const dx = Math.max(radius - x, 0, x - (size - 1 - radius));
      const dy = Math.max(radius - y, 0, y - (size - 1 - radius));
      const inside = fullBleed || dx * dx + dy * dy <= radius * radius;
      const d = Math.hypot(x - c, y - c);
      const ring = d <= ringOuter && d >= ringInner;
      const [r, g, b] = ring ? [255, 255, 255] : brand;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = inside ? 255 : 0;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ico(pngData, size) {
  const header = Buffer.from([0, 0, 1, 0, 1, 0]);
  const entry = Buffer.alloc(16);
  entry[0] = size;
  entry[1] = size;
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngData.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngData]);
}

const out = (rel, data) => {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`wrote ${rel}`);
};

out("public/icons/icon-192.png", png(192));
out("public/icons/icon-512.png", png(512));
out("public/icons/icon-maskable-192.png", png(192, { fullBleed: true, inset: 0.2 }));
out("public/icons/icon-maskable-512.png", png(512, { fullBleed: true, inset: 0.2 }));
out("public/icons/apple-touch-icon.png", png(180, { fullBleed: true }));
out("src/app/icon.png", png(64));
out("src/app/apple-icon.png", png(180, { fullBleed: true }));
out("src/app/favicon.ico", ico(png(32), 32));
