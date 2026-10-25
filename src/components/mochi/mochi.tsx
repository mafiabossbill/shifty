import { useId, type CSSProperties, type ReactNode } from "react";

import {
  PALETTES,
  type AccessoryKey,
  type HatKey,
  type MochiMood,
  type MochiPalette,
  type PaletteKey,
} from "./parts";

/**
 * Mochi, SHIFTY's companion: a soft star-blob drawn as inline SVG (no images). Works from 32px (nav) to
 * 240px+ (companion hero). Animations are CSS only, off with `animate={false}` and under reduced motion.
 */
export type MochiProps = {
  mood?: MochiMood;
  /** Rendered width and height in px. */
  size?: number;
  palette?: PaletteKey;
  hat?: HatKey | "none";
  accessory?: AccessoryKey | "none";
  animate?: boolean;
  className?: string;
  /** Accessible name. Defaults to "Mochi, feeling <mood>". */
  title?: string;
};

// ── Geometry ────────────────────────────────────────────────────────────────────────────────────────────
// viewBox 0 0 200 200; body centre C. Five tips in angle order: top tuft, right arm, right foot, left foot,
// left arm (degrees, SVG y-down, 0 = right). Valleys sit halfway between tips at radius `valley`.

type Pt = [number, number];
type Limb = { a: number; r: number };
type Pose = { tips: [Limb, Limb, Limb, Limb, Limb]; valley: number; tilt: number; squash: number };

const CX = 100;
const CY = 112;

const POSES: Record<MochiMood, Pose> = {
  happy: { tips: [{ a: -90, r: 86 }, { a: -16, r: 88 }, { a: 56, r: 82 }, { a: 124, r: 82 }, { a: 196, r: 88 }], valley: 55, tilt: 0, squash: 1 },
  focused: { tips: [{ a: -92, r: 86 }, { a: -8, r: 86 }, { a: 56, r: 82 }, { a: 124, r: 82 }, { a: 190, r: 84 }], valley: 55, tilt: -4, squash: 1 },
  sleepy: { tips: [{ a: -86, r: 84 }, { a: -4, r: 84 }, { a: 58, r: 81 }, { a: 122, r: 81 }, { a: 184, r: 84 }], valley: 56, tilt: 4, squash: 0.97 },
  resting: { tips: [{ a: -90, r: 84 }, { a: -8, r: 86 }, { a: 54, r: 82 }, { a: 126, r: 82 }, { a: 188, r: 86 }], valley: 57, tilt: 0, squash: 0.94 },
  celebrating: { tips: [{ a: -90, r: 84 }, { a: -30, r: 92 }, { a: 60, r: 82 }, { a: 120, r: 82 }, { a: 210, r: 92 }], valley: 55, tilt: 0, squash: 1 },
  proud: { tips: [{ a: -90, r: 90 }, { a: -10, r: 86 }, { a: 57, r: 82 }, { a: 123, r: 82 }, { a: 190, r: 86 }], valley: 56, tilt: 0, squash: 1 },
  curious: { tips: [{ a: -90, r: 86 }, { a: -30, r: 90 }, { a: 56, r: 82 }, { a: 124, r: 82 }, { a: 200, r: 86 }], valley: 55, tilt: 7, squash: 1 },
};

const polar = (deg: number, r: number): Pt => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const f1 = (n: number) => Math.round(n * 10) / 10;
const pt = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`;

/** A five-point star with generously rounded tips and valleys. */
export function starPath(pose: Pose): string {
  const verts: { p: Pt; tip: boolean }[] = [];
  pose.tips.forEach((tip, i) => {
    verts.push({ p: polar(tip.a, tip.r), tip: true });
    const next = pose.tips[(i + 1) % 5];
    const a2 = next.a <= tip.a ? next.a + 360 : next.a;
    // Wider gaps between limbs fill out a little, so a raised arm leaves a chubby side, not a dent.
    const gap = a2 - tip.a;
    verts.push({ p: polar((tip.a + a2) / 2, pose.valley + Math.max(0, gap - 72) * 0.12), tip: false });
  });
  const n = verts.length;
  const corners = verts.map((v, i) => {
    const prev = verts[(i - 1 + n) % n].p;
    const next = verts[(i + 1) % n].p;
    const cut = v.tip ? 0.4 : 0.3;
    const k = v.tip ? 0.72 : 0.55;
    const a = lerp(v.p, prev, cut);
    const b = lerp(v.p, next, cut);
    return { a, b, c1: lerp(a, v.p, k), c2: lerp(b, v.p, k) };
  });
  let d = `M${pt(corners[0].b)}`;
  for (let j = 1; j <= n; j += 1) {
    const c = corners[j % n];
    d += `L${pt(c.a)}C${pt(c.c1)} ${pt(c.c2)} ${pt(c.b)}`;
  }
  return `${d}Z`;
}

// ── Animation ───────────────────────────────────────────────────────────────────────────────────────────

const CSS = `
.mochi-anim .mochi-breathe{animation:mochi-breathe 4.2s ease-in-out infinite;transform-origin:100px 188px}
.mochi-anim .mochi-blink{animation:mochi-blink 5.6s infinite;transform-box:fill-box;transform-origin:center}
.mochi-anim .mochi-hop{animation:mochi-hop 1.4s ease-in-out infinite;transform-origin:100px 190px}
.mochi-anim .mochi-twinkle{animation:mochi-twinkle 1.9s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.mochi-anim .mochi-float{animation:mochi-float 3.6s ease-in-out infinite}
.mochi-anim .mochi-steam{animation:mochi-steam 3s ease-in-out infinite}
.mochi-anim .mochi-shadow{animation:mochi-shadow 1.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes mochi-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,.972)}}
@keyframes mochi-blink{0%,93%,100%{transform:scaleY(1)}95.5%{transform:scaleY(.08)}}
@keyframes mochi-hop{0%,55%,100%{transform:translateY(0) scale(1,1)}12%{transform:translateY(0) scale(1.04,.95)}30%{transform:translateY(-9px) scale(.98,1.03)}}
@keyframes mochi-shadow{0%,55%,100%{transform:scale(1)}30%{transform:scale(.85)}}
@keyframes mochi-twinkle{0%,100%{opacity:.35;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}
@keyframes mochi-float{0%{opacity:0;transform:translate(0,6px)}25%{opacity:1}100%{opacity:0;transform:translate(7px,-12px)}}
@keyframes mochi-steam{0%{opacity:0;transform:translateY(4px)}35%{opacity:.8}100%{opacity:0;transform:translateY(-8px)}}
@media (prefers-reduced-motion:reduce){.mochi-anim,.mochi-anim *{animation:none!important}}
`;

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

// ── Small shapes ────────────────────────────────────────────────────────────────────────────────────────

const WARM = "#ff9a3c";
const GOLD = "#ffc94d";
const ACCENT = "#8b7bff";

function Sparkle({ x, y, s, fill, d = 0 }: { x: number; y: number; s: number; fill: string; d?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        className="mochi-twinkle"
        style={delay(d)}
        d={`M0 ${-s}Q${s * 0.16} ${-s * 0.16} ${s} 0Q${s * 0.16} ${s * 0.16} 0 ${s}Q${-s * 0.16} ${s * 0.16} ${-s} 0Q${-s * 0.16} ${-s * 0.16} 0 ${-s}Z`}
        fill={fill}
      />
    </g>
  );
}

function Zee({ x, y, s, color, d }: { x: number; y: number; s: number; color: string; d: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        className="mochi-float"
        style={delay(d)}
        d={`M0 0h${s}l${-s} ${s * 1.1}h${s}`}
        fill="none"
        stroke={color}
        strokeWidth={Math.max(2.4, s * 0.28)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

// ── Face ────────────────────────────────────────────────────────────────────────────────────────────────

const EYE_Y = 110;
const EYE_DX = 21;

type EyeStyle = "open" | "lidded" | "half" | "closed" | "joy";

function OpenEye({ x, y, p, rx = 9.5, ry = 12, clip }: { x: number; y: number; p: MochiPalette; rx?: number; ry?: number; clip?: string }) {
  return (
    <g clipPath={clip ? `url(#${clip})` : undefined}>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={p.eye} />
      <ellipse cx={x} cy={y + ry * 0.45} rx={rx * 0.62} ry={ry * 0.36} fill={p.outline} opacity={0.6} />
      <ellipse cx={x + rx * 0.3} cy={y - ry * 0.36} rx={rx * 0.4} ry={ry * 0.34} fill="#fff" />
      <circle cx={x - rx * 0.36} cy={y + ry * 0.38} r={rx * 0.17} fill="#fff" opacity={0.9} />
    </g>
  );
}

function Eyes({ style, p, uid, look }: { style: EyeStyle; p: MochiPalette; uid: string; look: Pt }) {
  const L: Pt = [CX - EYE_DX + look[0], EYE_Y + look[1]];
  const R: Pt = [CX + EYE_DX + look[0], EYE_Y + look[1]];
  const stroke = { fill: "none", stroke: p.eye, strokeWidth: 3.4, strokeLinecap: "round" as const };
  switch (style) {
    case "open":
      return (
        <g className="mochi-blink">
          <OpenEye x={L[0]} y={L[1]} p={p} />
          <OpenEye x={R[0]} y={R[1]} p={p} />
        </g>
      );
    case "lidded": {
      // Determined: lids slope down towards the middle.
      const inner = 1.5;
      const top = -7;
      return (
        <g className="mochi-blink">
          <defs>
            <clipPath id={`${uid}-el`}>
              <path d={`M${L[0] - 13} ${L[1] + top}L${L[0] + 13} ${L[1] + top + inner}V${L[1] + 16}H${L[0] - 13}Z`} />
            </clipPath>
            <clipPath id={`${uid}-er`}>
              <path d={`M${R[0] - 13} ${R[1] + top + inner}L${R[0] + 13} ${R[1] + top}V${R[1] + 16}H${R[0] - 13}Z`} />
            </clipPath>
          </defs>
          <OpenEye x={L[0]} y={L[1]} p={p} ry={11.5} clip={`${uid}-el`} />
          <OpenEye x={R[0]} y={R[1]} p={p} ry={11.5} clip={`${uid}-er`} />
          <path d={`M${L[0] - 10.5} ${L[1] + top + 0.4}L${L[0] + 10.5} ${L[1] + top + inner * 0.82 + 0.4}`} {...stroke} strokeWidth={2.6} />
          <path d={`M${R[0] - 10.5} ${R[1] + top + inner * 0.82 + 0.4}L${R[0] + 10.5} ${R[1] + top + 0.4}`} {...stroke} strokeWidth={2.6} />
        </g>
      );
    }
    case "half":
      return (
        <g>
          {[L, R].map(([x, y], i) => (
            <g key={i}>
              <path d={`M${x - 9.5} ${y}A9.5 10 0 0 0 ${x + 9.5} ${y}Z`} fill={p.eye} />
              <ellipse cx={x} cy={y + 6} rx={5} ry={2.6} fill={p.outline} opacity={0.6} />
              <circle cx={x + 3} cy={y + 3} r={1.9} fill="#fff" />
              <path d={`M${x - 10.5} ${y + 0.3}Q${x} ${y - 2.2} ${x + 10.5} ${y + 0.3}`} {...stroke} strokeWidth={2.8} />
            </g>
          ))}
        </g>
      );
    case "closed":
      return (
        <g>
          <path d={`M${L[0] - 8.5} ${L[1] + 1}Q${L[0]} ${L[1] + 8} ${L[0] + 8.5} ${L[1] + 1}`} {...stroke} />
          <path d={`M${R[0] - 8.5} ${R[1] + 1}Q${R[0]} ${R[1] + 8} ${R[0] + 8.5} ${R[1] + 1}`} {...stroke} />
        </g>
      );
    case "joy":
      return (
        <g>
          <path d={`M${L[0] - 9} ${L[1] + 4}Q${L[0]} ${L[1] - 8} ${L[0] + 9} ${L[1] + 4}`} {...stroke} strokeWidth={3.8} />
          <path d={`M${R[0] - 9} ${R[1] + 4}Q${R[0]} ${R[1] - 8} ${R[0] + 9} ${R[1] + 4}`} {...stroke} strokeWidth={3.8} />
        </g>
      );
  }
}

const MOUTH_Y = 126;

function Mouth({ mood, p, uid }: { mood: MochiMood; p: MochiPalette; uid: string }) {
  const line = { fill: "none", stroke: p.eye, strokeWidth: 2.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const y = MOUTH_Y;
  switch (mood) {
    case "happy":
    case "celebrating": {
      const w = mood === "celebrating" ? 10.5 : 7;
      const h = mood === "celebrating" ? 16 : 10;
      const d = `M${CX - w} ${y - 1}Q${CX} ${y - 2.5} ${CX + w} ${y - 1}Q${CX + w * 0.6} ${y + h} ${CX} ${y + h * 0.82}Q${CX - w * 0.6} ${y + h} ${CX - w} ${y - 1}Z`;
      return (
        <g>
          <defs>
            <clipPath id={`${uid}-m`}>
              <path d={d} />
            </clipPath>
          </defs>
          <path d={d} fill={p.mouth} stroke={p.eye} strokeWidth={1.6} strokeLinejoin="round" />
          <ellipse cx={CX} cy={y + h * 0.82} rx={w * 0.62} ry={h * 0.32} fill={p.cheek} clipPath={`url(#${uid}-m)`} />
        </g>
      );
    }
    case "focused":
      return (
        <g>
          <path d={`M${CX - 5} ${y}Q${CX} ${y + 3.5} ${CX + 5} ${y}`} {...line} />
          <path d={`M${CX + 3.4} ${y + 1.4}q2.6 3.4 4.6 .4`} fill={p.cheek} stroke={p.eye} strokeWidth={1.4} strokeLinejoin="round" />
        </g>
      );
    case "sleepy":
      return <ellipse cx={CX} cy={y + 2} rx={3} ry={3.6} fill={p.mouth} stroke={p.eye} strokeWidth={1.4} />;
    case "resting":
      return <path d={`M${CX - 4.5} ${y}Q${CX} ${y + 4.5} ${CX + 4.5} ${y}`} {...line} />;
    case "proud":
      return <path d={`M${CX - 7.5} ${y - 1}Q${CX + 1} ${y + 7} ${CX + 7.5} ${y - 2}`} {...line} />;
    case "curious":
      return <ellipse cx={CX + 1} cy={y + 1.5} rx={2.6} ry={3} fill={p.mouth} stroke={p.eye} strokeWidth={1.4} />;
  }
}

function Brows({ mood, p, look }: { mood: MochiMood; p: MochiPalette; look: Pt }) {
  const s = { fill: "none", stroke: p.eye, strokeWidth: 2.6, strokeLinecap: "round" as const };
  const lx = CX - EYE_DX + look[0];
  const rx = CX + EYE_DX + look[0];
  if (mood === "focused") {
    return (
      <g>
        <path d={`M${lx - 7} ${EYE_Y - 20}Q${lx} ${EYE_Y - 23} ${lx + 7} ${EYE_Y - 20}`} {...s} />
        <path d={`M${rx - 7} ${EYE_Y - 20}Q${rx} ${EYE_Y - 23} ${rx + 7} ${EYE_Y - 20}`} {...s} />
      </g>
    );
  }
  if (mood === "curious") {
    return <path d={`M${rx - 8} ${EYE_Y - 20}Q${rx} ${EYE_Y - 27} ${rx + 8} ${EYE_Y - 21}`} {...s} />;
  }
  return null;
}

const EYE_STYLE: Record<MochiMood, EyeStyle> = {
  happy: "open",
  focused: "lidded",
  sleepy: "half",
  resting: "closed",
  celebrating: "joy",
  proud: "joy",
  curious: "open",
};

const LOOK: Record<MochiMood, Pt> = {
  happy: [0, 0],
  focused: [2, 1],
  sleepy: [0, 1],
  resting: [0, 0],
  celebrating: [0, -1],
  proud: [0, -1],
  curious: [2.5, -1],
};

// ── Hats ────────────────────────────────────────────────────────────────────────────────────────────────

const INK = "#2b2147";
/** Hats are drawn around a 76-wide crown at y≈66 and scaled to sit snugly over the top point. */
const HAT_FIT = "translate(100 72) scale(1.22) translate(-100 -66)";

type PartProps = { p: MochiPalette; uid: string; hand: Pt };

const HATS: Record<HatKey, (props: PartProps) => ReactNode> = {
  beanie: () => (
    <g strokeLinejoin="round">
      <path d="M66 66C64 26 136 26 134 66Z" fill="#ff9472" stroke="#c4553a" strokeWidth={2.6} />
      <path d="M84 36Q82 50 84 62M100 31V62M116 36Q118 50 116 62" stroke="#e36f4f" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <rect x={62} y={58} width={76} height={15} rx={7.5} fill="#ffd2bd" stroke="#c4553a" strokeWidth={2.6} />
      <path d="M72 61v9M80 61v9M88 61v9M96 61v9M104 61v9M112 61v9M120 61v9M128 61v9" stroke="#f0a88c" strokeWidth={2} strokeLinecap="round" />
      <circle cx={100} cy={26} r={9} fill="#fff4ea" stroke="#c4553a" strokeWidth={2.6} />
    </g>
  ),
  "party-hat": () => (
    <g strokeLinejoin="round">
      <path d="M76 66L104 8L126 64Z" fill={ACCENT} stroke="#4c3db0" strokeWidth={2.6} />
      <path d="M91 35L111 39M84 50L118 55" stroke={GOLD} strokeWidth={5} strokeLinecap="round" />
      <path d="M72 66Q80 58 88 66Q96 58 104 66Q112 58 120 66Q126 60 130 64" fill="none" stroke="#fff3c4" strokeWidth={4.5} strokeLinecap="round" />
      <circle cx={104} cy={8} r={6.5} fill={WARM} stroke="#c86a17" strokeWidth={2.2} />
    </g>
  ),
  "flower-crown": () => {
    const flowers: [number, number, string][] = [
      [70, 66, "#ffb3cf"],
      [84, 56, "#fff1b8"],
      [100, 52, "#ff9fc4"],
      [116, 56, "#fff1b8"],
      [130, 66, "#ffb3cf"],
    ];
    return (
      <g>
        <path d="M64 70Q100 40 136 70" fill="none" stroke="#5aa57f" strokeWidth={3.4} strokeLinecap="round" />
        <path d="M77 63q-2-8 5-10q1 7-5 10M123 63q2-8-5-10q-1 7 5 10M92 54q-1-8 6-9q0 7-6 9" fill="#7fc8a0" stroke="#4a8f6c" strokeWidth={1.2} />
        {flowers.map(([x, y, c], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <circle key={a} cx={5.2 * Math.cos((a * Math.PI) / 180)} cy={5.2 * Math.sin((a * Math.PI) / 180)} r={4.4} fill={c} stroke="#d77fa0" strokeWidth={1} />
            ))}
            <circle r={3.2} fill={WARM} />
          </g>
        ))}
      </g>
    );
  },
  "night-cap": () => (
    <g strokeLinejoin="round">
      <path d="M66 66C66 30 102 14 140 26C156 31 164 44 160 58C150 46 136 40 128 46C132 52 134 58 134 66Z" fill="#4c45b0" stroke="#2a2470" strokeWidth={2.6} />
      <path d="M86 38l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="#ffe08a" />
      <circle cx={112} cy={30} r={2.2} fill="#ffe08a" />
      <circle cx={140} cy={40} r={1.8} fill="#ffe08a" />
      <circle cx={104} cy={50} r={1.6} fill="#ffe08a" />
      <rect x={62} y={58} width={76} height={14} rx={7} fill="#e9e1ff" stroke="#2a2470" strokeWidth={2.6} />
      <circle cx={161} cy={62} r={8} fill="#fff4d6" stroke="#2a2470" strokeWidth={2.4} />
    </g>
  ),
  wizard: () => (
    <g strokeLinejoin="round">
      <path d="M76 64C84 44 94 22 120 4C114 26 118 46 126 64Z" fill="#5b4bc4" stroke="#33268a" strokeWidth={2.6} />
      <ellipse cx={100} cy={66} rx={42} ry={9} fill="#4a3cae" stroke="#33268a" strokeWidth={2.6} />
      <path d="M78 64Q100 70 124 64" fill="none" stroke={GOLD} strokeWidth={3.5} />
      <path d="M102 34l1.8 3.8 4 .5-3 2.7.9 4-3.7-2.1-3.7 2.1.9-4-3-2.7 4-.5z" fill={GOLD} />
      <circle cx={112} cy={20} r={2} fill="#fff3c4" />
      <circle cx={92} cy={50} r={1.8} fill="#fff3c4" />
      <circle cx={114} cy={50} r={1.4} fill="#fff3c4" />
    </g>
  ),
  headphones: () => (
    <g strokeLinejoin="round">
      <path d="M50 98C46 30 154 30 150 98" fill="none" stroke="#3a3358" strokeWidth={7} strokeLinecap="round" />
      <path d="M50 98C46 30 154 30 150 98" fill="none" stroke="#5a5280" strokeWidth={2.5} strokeLinecap="round" />
      <rect x={38} y={80} width={20} height={32} rx={9} fill={ACCENT} stroke="#3a3358" strokeWidth={2.6} />
      <rect x={142} y={80} width={20} height={32} rx={9} fill={ACCENT} stroke="#3a3358" strokeWidth={2.6} />
      <rect x={42} y={86} width={7} height={20} rx={3.5} fill="#b9aeff" />
      <rect x={151} y={86} width={7} height={20} rx={3.5} fill="#b9aeff" />
    </g>
  ),
  chef: () => (
    <g strokeLinejoin="round">
      <path d="M74 58C60 54 60 30 78 32C80 16 98 12 104 24C114 14 134 22 128 38C142 42 138 60 126 58Z" fill="#fffaf2" stroke="#b8ab98" strokeWidth={2.6} />
      <path d="M90 40Q92 48 90 56M108 38Q110 48 108 56" fill="none" stroke="#e2d8c8" strokeWidth={2.2} strokeLinecap="round" />
      <rect x={72} y={54} width={56} height={16} rx={5} fill="#fffaf2" stroke="#b8ab98" strokeWidth={2.6} />
    </g>
  ),
  crown: () => (
    <g strokeLinejoin="round">
      <path d="M70 68L70 36L86 50L100 26L114 50L130 36L130 68Z" fill={GOLD} stroke="#b97d0e" strokeWidth={2.6} />
      <path d="M70 60H130" stroke="#f0a91f" strokeWidth={3} />
      <circle cx={70} cy={34} r={4} fill={GOLD} stroke="#b97d0e" strokeWidth={2} />
      <circle cx={100} cy={24} r={4.5} fill={GOLD} stroke="#b97d0e" strokeWidth={2} />
      <circle cx={130} cy={34} r={4} fill={GOLD} stroke="#b97d0e" strokeWidth={2} />
      <ellipse cx={100} cy={50} rx={5} ry={6} fill="#ff6f93" stroke="#b0466f" strokeWidth={1.6} />
      <circle cx={82} cy={56} r={3.4} fill={ACCENT} />
      <circle cx={118} cy={56} r={3.4} fill={ACCENT} />
      <circle cx={98} cy={47.5} r={1.5} fill="#fff" opacity={0.85} />
    </g>
  ),
};

// ── Accessories ─────────────────────────────────────────────────────────────────────────────────────────

/** Drawn behind the body. */
const ACCESSORIES_BEHIND: Partial<Record<AccessoryKey, (props: PartProps) => ReactNode>> = {
  backpack: () => (
    <g strokeLinejoin="round">
      <rect x={118} y={46} width={50} height={58} rx={16} fill="#ffb44c" stroke="#b8741a" strokeWidth={2.6} transform="rotate(14 143 75)" />
      <path d="M128 52q14-8 30 4" fill="none" stroke="#b8741a" strokeWidth={2.4} strokeLinecap="round" transform="rotate(14 143 75)" />
    </g>
  ),
};

const ACCESSORIES: Record<AccessoryKey, (props: PartProps) => ReactNode> = {
  scarf: ({ uid }) => (
    <g strokeLinejoin="round">
      <g clipPath={`url(#${uid}-body)`}>
        <path d="M30 136Q100 156 170 136L172 152Q100 174 28 152Z" fill="#ff7a59" stroke="#c2462c" strokeWidth={2.6} />
        <path d="M60 145L64 160M84 150L86 165M116 150L114 165M140 145L136 160" stroke="#ffd1a1" strokeWidth={4} />
      </g>
      <path d="M122 150L118 184L134 182L136 152Z" fill="#ff7a59" stroke="#c2462c" strokeWidth={2.6} />
      <path d="M119 164L135 163M118 174L134 173" stroke="#ffd1a1" strokeWidth={3.5} />
      <path d="M118 184l1 5M124 184l0 5M130 183l1 5" stroke="#c2462c" strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  glasses: () => (
    <g fill="none" stroke={INK} strokeWidth={2.6}>
      <circle cx={CX - EYE_DX} cy={EYE_Y} r={14} fill="#ffffff" fillOpacity={0.14} />
      <circle cx={CX + EYE_DX} cy={EYE_Y} r={14} fill="#ffffff" fillOpacity={0.14} />
      <path d="M93 106Q100 101 107 106M65 106L54 100M135 106L146 100" strokeLinecap="round" />
      <path d="M73 101q3-3 7-3M115 101q3-3 7-3" stroke="#fff" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  bowtie: () => (
    <g strokeLinejoin="round" stroke="#b8383a" strokeWidth={2.4}>
      <path d="M100 146L82 136Q77 147 82 157Z" fill="#ff7a6b" />
      <path d="M100 146L118 136Q123 147 118 157Z" fill="#ff7a6b" />
      <path d="M86 141Q84 147 86 152M114 141Q116 147 114 152" fill="none" stroke="#ffb0a6" strokeWidth={2} strokeLinecap="round" />
      <rect x={94} y={140} width={12} height={12} rx={4} fill="#e8564f" />
    </g>
  ),
  backpack: ({ uid }) => (
    <g clipPath={`url(#${uid}-body)`} fill="none" strokeLinecap="round">
      <path d="M64 58Q58 82 34 104" stroke="#b8741a" strokeWidth={10} />
      <path d="M136 58Q142 82 166 104" stroke="#b8741a" strokeWidth={10} />
      <path d="M64 58Q58 82 34 104" stroke="#ffb44c" strokeWidth={6} />
      <path d="M136 58Q142 82 166 104" stroke="#ffb44c" strokeWidth={6} />
      <rect x={52} y={80} width={10} height={9} rx={2} fill="#fff3c4" stroke="#b8741a" strokeWidth={1.8} transform="rotate(40 57 84)" />
      <rect x={138} y={80} width={10} height={9} rx={2} fill="#fff3c4" stroke="#b8741a" strokeWidth={1.8} transform="rotate(-40 143 84)" />
    </g>
  ),
  "star-wand": ({ hand }) => {
    const [hx, hy] = hand;
    const tx = hx + 16;
    const ty = hy - 30;
    return (
      <g strokeLinejoin="round">
        <path d={`M${hx - 2} ${hy + 6}L${tx} ${ty}`} stroke="#8a5a2b" strokeWidth={4.5} strokeLinecap="round" />
        <g transform={`translate(${tx} ${ty})`}>
          <path d="M0-13l3.8 7.6 8.4 1.2-6.1 5.9 1.4 8.4L0 6.2l-7.5 3.9 1.4-8.4L-12.2-4.2l8.4-1.2z" fill={GOLD} stroke="#c58a12" strokeWidth={2.2} />
          <circle cx={-2.5} cy={-3} r={1.6} fill="#fff" />
        </g>
        <Sparkle x={tx + 16} y={ty - 10} s={5} fill="#ffe08a" />
        <Sparkle x={tx - 14} y={ty - 14} s={3.5} fill="#ffe08a" d={0.7} />
      </g>
    );
  },
};

// ── Mood extras (outside the tilt) ──────────────────────────────────────────────────────────────────────

function Extras({ mood, p }: { mood: MochiMood; p: MochiPalette }) {
  switch (mood) {
    case "sleepy":
      return (
        <g>
          <Zee x={146} y={50} s={9} color={p.outline} d={0} />
          <Zee x={160} y={30} s={12} color={p.outline} d={1.2} />
          <Zee x={176} y={8} s={9} color={p.outline} d={2.4} />
        </g>
      );
    case "resting":
      return (
        <g strokeLinejoin="round">
          <g fill="none" stroke="#b8aee0" strokeWidth={2.4} strokeLinecap="round">
            <path className="mochi-steam" d="M167 158q-4-5 0-10t0-10" />
            <path className="mochi-steam" style={delay(1.4)} d="M176 160q-4-5 0-10t0-10" />
          </g>
          <path d="M162 165h22v12q0 9-11 9t-11-9z" fill="#fff4e6" stroke="#b07d5b" strokeWidth={2.4} />
          <path d="M184 168q7 0 7 5t-7 5" fill="none" stroke="#b07d5b" strokeWidth={2.4} />
          <path d="M162 165h22" stroke="#b07d5b" strokeWidth={2.4} />
          <path d="M166 172q7 3 14 0" fill="none" stroke="#ffb3cf" strokeWidth={2.4} strokeLinecap="round" />
        </g>
      );
    case "celebrating":
      return (
        <g>
          <Sparkle x={26} y={50} s={9} fill={GOLD} />
          <Sparkle x={178} y={30} s={8} fill={WARM} d={0.6} />
          <Sparkle x={186} y={112} s={6} fill={GOLD} d={1.1} />
          <Sparkle x={16} y={120} s={6} fill={WARM} d={0.3} />
          <rect x={46} y={22} width={7} height={4} rx={1.5} fill={WARM} transform="rotate(-25 49 24)" />
          <rect x={150} y={8} width={7} height={4} rx={1.5} fill={ACCENT} transform="rotate(30 153 10)" />
          <rect x={168} y={74} width={7} height={4} rx={1.5} fill={GOLD} transform="rotate(60 171 76)" />
          <rect x={30} y={88} width={7} height={4} rx={1.5} fill="#6fd3a8" transform="rotate(-50 33 90)" />
          <circle cx={130} cy={16} r={2.6} fill={GOLD} />
          <circle cx={70} cy={12} r={2.4} fill="#6fd3a8" />
          <circle cx={190} cy={60} r={2.2} fill={WARM} />
        </g>
      );
    case "proud":
      return <Sparkle x={168} y={56} s={7} fill={GOLD} />;
    case "curious":
      return (
        <g transform="translate(160 26)">
          <path
            d="M-6-4q0-8 7-8t7 7q0 4-5 6.5q-2 1.2-2 4.5"
            fill="none"
            stroke={p.outline}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={1} cy={12.5} r={2.2} fill={p.outline} />
        </g>
      );
    default:
      return null;
  }
}

const SPECKS: Pt[] = [
  [70, 84],
  [134, 90],
  [60, 142],
  [142, 150],
  [96, 160],
  [116, 72],
];

// ── Component ───────────────────────────────────────────────────────────────────────────────────────────

export function Mochi({
  mood = "happy",
  size = 120,
  palette = "lilac",
  hat = "none",
  accessory = "none",
  animate = true,
  className,
  title,
}: MochiProps) {
  const uid = `mochi${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const p = PALETTES[palette] ?? PALETTES.lilac;
  const pose = POSES[mood] ?? POSES.happy;
  const body = starPath(pose);
  const look = LOOK[mood];
  const armTip = pose.tips[1];
  const hand = polar(armTip.a, armTip.r - 10);
  const parts: PartProps = { p, uid, hand };
  const label = title ?? `Mochi, feeling ${mood}`;
  const Behind = accessory !== "none" ? ACCESSORIES_BEHIND[accessory] : undefined;
  const squash = pose.squash !== 1 ? `translate(0 ${f1(188 * (1 - pose.squash))}) scale(1 ${pose.squash})` : undefined;
  const tilt = pose.tilt ? `rotate(${pose.tilt} 100 186)` : undefined;

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={[animate ? "mochi-anim" : "", className ?? ""].join(" ").trim() || undefined}
      style={{ overflow: "visible" }}
    >
      <style>{CSS}</style>
      <defs>
        <radialGradient id={`${uid}-fill`} cx="0.38" cy="0.3" r="0.78">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.5" stopColor={p.body} />
          <stop offset="1" stopColor={p.shade} />
        </radialGradient>
        <clipPath id={`${uid}-body`}>
          <path d={body} />
        </clipPath>
      </defs>

      <ellipse className={mood === "celebrating" ? "mochi-shadow" : undefined} cx={100} cy={185} rx={46} ry={6} fill="#1b1430" opacity={0.16} />

      <g className={mood === "celebrating" ? "mochi-hop" : undefined}>
        <g transform={tilt}>
          <g className="mochi-breathe" style={mood === "sleepy" || mood === "resting" ? { animationDuration: "6s" } : undefined}>
            <g transform={squash}>
              {Behind ? Behind(parts) : null}
              <path d={body} fill={`url(#${uid}-fill)`} stroke={p.outline} strokeWidth={3.6} strokeLinejoin="round" />
              {p.speck ? (
                <g clipPath={`url(#${uid}-body)`} fill={p.speck} opacity={0.8}>
                  {SPECKS.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={i % 2 ? 1.4 : 1.9} />
                  ))}
                </g>
              ) : null}
              <ellipse cx={72} cy={76} rx={11} ry={6.5} fill="#fff" opacity={0.5} transform="rotate(-38 72 76)" />
              <circle cx={86} cy={66} r={2.6} fill="#fff" opacity={0.55} />
              <ellipse cx={CX - 34} cy={125} rx={8.5} ry={5.2} fill={p.cheek} opacity={0.75} />
              <ellipse cx={CX + 34} cy={125} rx={8.5} ry={5.2} fill={p.cheek} opacity={0.75} />
              <Brows mood={mood} p={p} look={look} />
              <Eyes style={EYE_STYLE[mood]} p={p} uid={uid} look={look} />
              <Mouth mood={mood} p={p} uid={uid} />
              {accessory !== "none" ? ACCESSORIES[accessory](parts) : null}
              {hat !== "none" ? <g transform={hat === "headphones" ? undefined : HAT_FIT}>{HATS[hat](parts)}</g> : null}
            </g>
          </g>
        </g>
      </g>

      <Extras mood={mood} p={p} />
    </svg>
  );
}
