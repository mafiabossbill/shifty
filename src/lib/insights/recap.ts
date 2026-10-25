/**
 * The shareable recap card as a standalone SVG string (rendered to PNG in the browser). Privacy by type:
 * the input has no coordinates at all, and place names only appear when the person ticked
 * "Include place names" (`places` is then non-empty).
 */
import { formatDuration } from "@/lib/format";

import { hourScale } from "./scale";

export interface RecapColors {
  background: string;
  card: string;
  foreground: string;
  muted: string;
  brand: string;
  brandSoft: string;
  track: string;
  border: string;
}

export interface RecapInput {
  eyebrow: string;
  title: string;
  netMs: number;
  breakMs: number;
  sessions: number;
  daysWorked: number;
  modeLabel: string;
  bars: { label: string; netMs: number; breakMs: number; highlight?: boolean }[];
  referenceMs: number | null;
  /** Only when the person opted in. */
  places?: { label: string; netMs: number }[];
  colors: RecapColors;
}

export const RECAP_WIDTH = 1080;
export const RECAP_HEIGHT = 1350;

export function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function recapSvg(input: RecapInput): string {
  const { colors: c } = input;
  const W = RECAP_WIDTH;
  const Hh = RECAP_HEIGHT;
  const pad = 96;
  const places = input.places ?? [];
  const chartTop = 640;
  const chartBottom = places.length ? 930 : 1110;
  const chartH = chartBottom - chartTop;
  const n = Math.max(1, input.bars.length);
  const scale = hourScale(Math.max(input.referenceMs ?? 0, ...input.bars.map((b) => b.netMs + b.breakMs)), 3);
  const slot = (W - pad * 2) / n;
  const barW = Math.min(88, slot * 0.62);
  const y = (ms: number) => chartBottom - (ms / scale.maxMs) * chartH;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">`,
    `<rect width="${W}" height="${Hh}" fill="${c.background}"/>`,
    `<rect x="40" y="40" width="${W - 80}" height="${Hh - 80}" rx="56" fill="${c.card}" stroke="${c.border}" stroke-width="2"/>`,
    `<text x="${pad}" y="168" font-family="${FONT}" font-size="30" font-weight="700" letter-spacing="5" fill="${c.brand}">SHIFTY</text>`,
    `<text x="${pad}" y="262" font-family="${FONT}" font-size="30" font-weight="600" letter-spacing="3" fill="${c.muted}">${escapeXml(input.eyebrow.toUpperCase())}</text>`,
    `<text x="${pad}" y="420" font-family="${FONT}" font-size="150" font-weight="700" letter-spacing="-5" fill="${c.foreground}">${escapeXml(formatDuration(input.netMs))}</text>`,
    `<text x="${pad}" y="486" font-family="${FONT}" font-size="36" fill="${c.muted}">${escapeXml(
      `net worked · ${input.daysWorked} ${input.daysWorked === 1 ? "day" : "days"} · ${input.sessions} ${input.sessions === 1 ? "session" : "sessions"}`,
    )}</text>`,
    `<text x="${pad}" y="538" font-family="${FONT}" font-size="32" fill="${c.muted}">${escapeXml(`${formatDuration(input.breakMs)} of breaks`)}</text>`,
  );
  for (const t of scale.ticks.slice(1)) {
    parts.push(`<line x1="${pad}" x2="${W - pad}" y1="${y(t)}" y2="${y(t)}" stroke="${c.border}" stroke-width="2"/>`);
  }
  input.bars.forEach((b, i) => {
    const cx = pad + slot * (i + 0.5);
    const x = cx - barW / 2;
    const netTop = y(b.netMs);
    const brkTop = y(b.netMs + b.breakMs);
    parts.push(`<rect x="${x}" y="${chartTop}" width="${barW}" height="${chartH}" rx="${barW / 2}" fill="${c.track}"/>`);
    if (b.breakMs > 0) parts.push(`<rect x="${x}" y="${brkTop}" width="${barW}" height="${Math.max(0, chartBottom - brkTop)}" rx="${barW / 2}" fill="${c.brandSoft}"/>`);
    if (b.netMs > 0) parts.push(`<rect x="${x}" y="${netTop}" width="${barW}" height="${Math.max(barW, chartBottom - netTop)}" rx="${barW / 2}" fill="${c.brand}" opacity="${b.highlight === false ? 0.8 : 1}"/>`);
    if (n <= 12) parts.push(`<text x="${cx}" y="${chartBottom + 52}" text-anchor="middle" font-family="${FONT}" font-size="30" fill="${c.muted}">${escapeXml(b.label)}</text>`);
  });
  if (input.referenceMs && input.referenceMs <= scale.maxMs) {
    const ry = y(input.referenceMs);
    parts.push(`<line x1="${pad}" x2="${W - pad}" y1="${ry}" y2="${ry}" stroke="${c.foreground}" stroke-opacity="0.55" stroke-width="3" stroke-dasharray="12 12"/>`);
  }
  if (places.length) {
    const top = chartBottom + 112;
    parts.push(`<text x="${pad}" y="${top}" font-family="${FONT}" font-size="28" font-weight="600" letter-spacing="3" fill="${c.muted}">PLACES</text>`);
    places.slice(0, 3).forEach((p, i) => {
      parts.push(
        `<text x="${pad}" y="${top + 52 + i * 44}" font-family="${FONT}" font-size="32" fill="${c.foreground}">${escapeXml(p.label)}</text>`,
        `<text x="${W - pad}" y="${top + 52 + i * 44}" text-anchor="end" font-family="${FONT}" font-size="32" fill="${c.muted}">${escapeXml(formatDuration(p.netMs))}</text>`,
      );
    });
  }
  parts.push(`<text x="${pad}" y="${Hh - 92}" font-family="${FONT}" font-size="28" fill="${c.muted}">${escapeXml(input.modeLabel)}</text>`);
  parts.push(`<text x="${W - pad}" y="${Hh - 92}" text-anchor="end" font-family="${FONT}" font-size="28" fill="${c.muted}">${escapeXml(input.title)}</text>`);
  parts.push("</svg>");
  return parts.join("");
}
