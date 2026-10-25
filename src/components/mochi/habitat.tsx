import { useId, type CSSProperties, type ReactNode } from "react";

import { OUTDOOR_BACKGROUNDS, WALL_DECOR, type BackgroundKey, type DecorKey } from "./parts";

/**
 * Mochi's cosy scene: one SVG drawn behind whatever is passed as children (usually <Mochi />), which stands
 * centred on the floor. Decor items have fixed slots, so any combination stays tidy. Wall decor is not drawn
 * on outdoor backgrounds (starfield, meadow). Aspect ratio 4:3 by default; pass `className`/`style` to size it.
 */
export type HabitatTheme = "dark" | "light";
export type HabitatTimeOfDay = "day" | "evening" | "night";

export type HabitatProps = {
  background?: BackgroundKey;
  decor?: readonly DecorKey[];
  theme?: HabitatTheme;
  /** Lights glow in the evening and at night; night also dims the room a little. Default "evening". */
  timeOfDay?: HabitatTimeOfDay;
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible description of the scene. Default: "Mochi's room" style sentence from the background. */
  label?: string;
  children?: ReactNode;
};

type Tone = {
  wallTop: string;
  wallBottom: string;
  floorTop: string;
  floorBottom: string;
  board: string;
  baseboard: string;
  frame: string;
  frameDark: string;
  wood: string;
  woodDark: string;
  ink: string;
  glow: string;
  shadow: string;
};

const TONES: Record<HabitatTheme, Tone> = {
  dark: {
    wallTop: "#1a1533",
    wallBottom: "#2a2150",
    floorTop: "#2c2350",
    floorBottom: "#1c1736",
    board: "#3a2f66",
    baseboard: "#14102a",
    frame: "#463a7a",
    frameDark: "#2e2558",
    wood: "#6b4f7a",
    woodDark: "#4a3560",
    ink: "#0c0a18",
    glow: "#ffcf8a",
    shadow: "#05040c",
  },
  light: {
    wallTop: "#f7f1e6",
    wallBottom: "#efe4d2",
    floorTop: "#e6d4bb",
    floorBottom: "#d9c4a6",
    board: "#cdb594",
    baseboard: "#d2bc9c",
    frame: "#c9ad8c",
    frameDark: "#a98a68",
    wood: "#c69a72",
    woodDark: "#9c7552",
    ink: "#3b2f4a",
    glow: "#ffd58f",
    shadow: "#6b5440",
  },
};

const CSS = `
.habitat-anim .habitat-twinkle{animation:habitat-twinkle 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.habitat-anim .habitat-rain{animation:habitat-rain 1.1s linear infinite}
.habitat-anim .habitat-flicker{animation:habitat-flicker 4s ease-in-out infinite}
.habitat-anim .habitat-drift{animation:habitat-drift 26s ease-in-out infinite alternate}
.habitat-anim .habitat-spin{animation:habitat-spin 3s linear infinite;transform-box:fill-box;transform-origin:center}
@keyframes habitat-twinkle{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes habitat-rain{0%{transform:translate(0,-24px)}100%{transform:translate(-6px,24px)}}
@keyframes habitat-flicker{0%,100%{opacity:.85}50%{opacity:1}}
@keyframes habitat-drift{0%{transform:translateX(-10px)}100%{transform:translateX(14px)}}
@keyframes habitat-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.habitat-anim,.habitat-anim *{animation:none!important}}
`;

const W = 400;
const H = 300;
const FLOOR = 214;

const d = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

type Ctx = { t: Tone; theme: HabitatTheme; lit: boolean; uid: string };

// ── Backgrounds ─────────────────────────────────────────────────────────────────────────────────────────

function Room({ t, uid, wallTop, wallBottom }: Ctx & { wallTop?: string; wallBottom?: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={wallTop ?? t.wallTop} />
          <stop offset="1" stopColor={wallBottom ?? t.wallBottom} />
        </linearGradient>
        <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.floorTop} />
          <stop offset="1" stopColor={t.floorBottom} />
        </linearGradient>
      </defs>
      <rect width={W} height={FLOOR} fill={`url(#${uid}-wall)`} />
      <rect y={FLOOR} width={W} height={H - FLOOR} fill={`url(#${uid}-floor)`} />
      <rect y={FLOOR - 7} width={W} height={7} fill={t.baseboard} />
      <g stroke={t.board} strokeWidth={1.5} opacity={0.6}>
        <path d={`M0 236H${W}M0 262H${W}M0 290H${W}`} />
        <path d="M70 214V236M250 214V236M150 236V262M330 236V262M40 262V290M220 262V290M370 262V290" />
      </g>
    </g>
  );
}

function ArchWindow({ t, uid, sky, children }: Ctx & { sky: [string, string, string]; children?: ReactNode }) {
  const arch = "M152 178V92A48 48 0 0 1 248 92V178Z";
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="0.55" stopColor={sky[1]} />
          <stop offset="1" stopColor={sky[2]} />
        </linearGradient>
        <clipPath id={`${uid}-arch`}>
          <path d={arch} />
        </clipPath>
      </defs>
      <path d={arch} fill={`url(#${uid}-sky)`} />
      <g clipPath={`url(#${uid}-arch)`}>{children}</g>
      <path d={arch} fill="none" stroke={t.frame} strokeWidth={7} strokeLinejoin="round" />
      <path d="M200 44V178M152 120H248" stroke={t.frame} strokeWidth={4} />
      <rect x={142} y={176} width={116} height={9} rx={3} fill={t.frameDark} />
    </g>
  );
}

const BACKGROUNDS: Record<BackgroundKey, (c: Ctx) => ReactNode> = {
  dusk: (c) => (
    <g>
      <Room {...c} />
      <ArchWindow {...c} sky={c.theme === "dark" ? ["#3b2f7a", "#b0619a", "#ff9a72"] : ["#9e8fe6", "#f2a3b8", "#ffc48f"]}>
        <circle cx={214} cy={170} r={18} fill="#ffd79a" opacity={0.95} />
        <path d="M140 170Q170 148 200 162T260 156V190H140Z" fill={c.theme === "dark" ? "#2a2052" : "#8a6fb8"} />
        <path d="M140 178Q180 164 220 174T260 170V190H140Z" fill={c.theme === "dark" ? "#1e1740" : "#6e58a0"} />
        <circle cx={176} cy={74} r={1.4} fill="#fff4d6" className="habitat-twinkle" />
        <circle cx={230} cy={66} r={1.2} fill="#fff4d6" className="habitat-twinkle" style={d(1.2)} />
      </ArchWindow>
    </g>
  ),
  dawn: (c) => (
    <g>
      <Room {...c} wallTop={c.theme === "dark" ? "#231c40" : "#fbf6ec"} wallBottom={c.theme === "dark" ? "#33284f" : "#f3e7d6"} />
      <ArchWindow {...c} sky={c.theme === "dark" ? ["#4b5aa8", "#d18aa6", "#ffc89a"] : ["#bcd8ff", "#ffd3d8", "#ffe6c2"]}>
        <circle cx={194} cy={168} r={22} fill="#fff1b8" />
        <circle cx={194} cy={168} r={32} fill="#fff1b8" opacity={0.35} />
        <path d="M140 172Q176 156 210 166T260 162V190H140Z" fill={c.theme === "dark" ? "#3d3a78" : "#a7c9a6"} />
        <path d="M172 84q4-4 8 0q4-4 8 0M214 100q3-3 6 0q3-3 6 0" fill="none" stroke={c.theme === "dark" ? "#2a2350" : "#6b5f80"} strokeWidth={1.8} strokeLinecap="round" />
      </ArchWindow>
    </g>
  ),
  "rainy-window": (c) => {
    const dark = c.theme === "dark";
    const win = "M128 40H272V176H128Z";
    return (
      <g>
        <Room {...c} wallTop={dark ? "#171a33" : "#eef0f2"} wallBottom={dark ? "#232847" : "#e2e4e6"} />
        <defs>
          <linearGradient id={`${c.uid}-rain`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={dark ? "#2a3458" : "#9fb1cc"} />
            <stop offset="1" stopColor={dark ? "#3c4a73" : "#c9d5e4"} />
          </linearGradient>
          <clipPath id={`${c.uid}-win`}>
            <path d={win} />
          </clipPath>
        </defs>
        <path d={win} fill={`url(#${c.uid}-rain)`} />
        <g clipPath={`url(#${c.uid}-win)`}>
          <path d="M120 150Q160 136 200 146T280 140V180H120Z" fill={dark ? "#222a48" : "#8c9fba"} />
          <g className="habitat-rain" stroke={dark ? "#8fa3d6" : "#ffffff"} strokeWidth={1.6} strokeLinecap="round" opacity={0.7}>
            {[136, 152, 168, 184, 200, 216, 232, 248, 264].map((x, i) => (
              <path key={x} d={`M${x + 8} ${30 + ((i * 37) % 90)}l-4 12M${x} ${90 + ((i * 53) % 70)}l-4 12`} />
            ))}
          </g>
          <g fill={dark ? "#9fb2e0" : "#ffffff"} opacity={0.6}>
            <circle cx={150} cy={70} r={2.4} />
            <circle cx={236} cy={96} r={2} />
            <circle cx={190} cy={130} r={2.6} />
            <circle cx={258} cy={60} r={1.8} />
          </g>
        </g>
        <path d={win} fill="none" stroke={c.t.frame} strokeWidth={7} strokeLinejoin="round" />
        <path d="M200 40V176M128 108H272" stroke={c.t.frame} strokeWidth={4} />
        <rect x={118} y={174} width={164} height={10} rx={3} fill={c.t.frameDark} />
      </g>
    );
  },
  library: (c) => {
    const dark = c.theme === "dark";
    const books = dark
      ? ["#5b4b8a", "#7a4f6e", "#3f5a6e", "#8a6a4a", "#4d4580", "#6e5a8a"]
      : ["#b7a3d6", "#e0a8a0", "#9fc2b4", "#e6c58f", "#a9b7d9", "#d6a6c0"];
    const shelfRows = [58, 102, 146];
    return (
      <g>
        <Room {...c} wallTop={dark ? "#1f1830" : "#f3e9da"} wallBottom={dark ? "#2b2140" : "#eadcc6"} />
        <rect x={112} y={26} width={176} height={FLOOR - 26} rx={6} fill={c.t.woodDark} />
        <rect x={120} y={34} width={160} height={FLOOR - 40} rx={3} fill={dark ? "#1a1428" : "#d9c4a6"} />
        {shelfRows.map((y, row) => (
          <g key={y}>
            {Array.from({ length: 13 }, (_, i) => {
              const h = 26 + ((i * 7 + row * 5) % 12);
              const w = 9 + ((i + row) % 3) * 2;
              const x = 124 + i * 12 + ((row * 3) % 5);
              return x + w < 278 ? <rect key={i} x={x} y={y + 38 - h} width={w - 1.5} height={h} rx={1.5} fill={books[(i + row * 2) % books.length]} /> : null;
            })}
            <rect x={116} y={y + 38} width={168} height={6} fill={c.t.wood} />
          </g>
        ))}
        <rect x={116} y={196} width={168} height={6} fill={c.t.wood} />
      </g>
    );
  },
  starfield: (c) => {
    const dark = c.theme === "dark";
    const stars: [number, number, number][] = [
      [30, 30, 1.6], [72, 70, 1.2], [110, 24, 1.8], [150, 92, 1.1], [196, 40, 1.4], [240, 18, 1.2], [262, 84, 1.7],
      [300, 40, 1.3], [342, 70, 1.1], [376, 26, 1.6], [56, 128, 1.1], [352, 126, 1.3], [128, 140, 1], [286, 150, 1],
    ];
    return (
      <g>
        <defs>
          <linearGradient id={`${c.uid}-night`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={dark ? "#0b0920" : "#3f3889"} />
            <stop offset="1" stopColor={dark ? "#2a2160" : "#9d8fdc"} />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${c.uid}-night)`} />
        {stars.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff4d6" className="habitat-twinkle" style={d((i % 5) * 0.6)} />
        ))}
        <path d="M318 56a20 20 0 1 0 22 26a16 16 0 1 1-22-26z" fill="#fff1c1" />
        <path d="M0 236Q100 196 200 212T400 222V300H0Z" fill={dark ? "#1c1840" : "#5a4f9e"} />
        <path d="M0 252Q120 228 230 240T400 246V300H0Z" fill={dark ? "#151233" : "#4a4088"} />
        <g stroke={dark ? "#2c2760" : "#6a5fb0"} strokeWidth={2} strokeLinecap="round">
          <path d="M60 252l-2-7M64 252l2-6M330 248l-2-7M334 248l2-6" />
        </g>
      </g>
    );
  },
  meadow: (c) => {
    const dark = c.theme === "dark";
    return (
      <g>
        <defs>
          <linearGradient id={`${c.uid}-meadow`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={dark ? "#1a1740" : "#cfe6ff"} />
            <stop offset="1" stopColor={dark ? "#3d3470" : "#fff2df"} />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${c.uid}-meadow)`} />
        {dark ? (
          <path d="M330 52a18 18 0 1 0 20 24a14 14 0 1 1-20-24z" fill="#fff1c1" />
        ) : (
          <circle cx={330} cy={60} r={20} fill="#fff1b8" />
        )}
        <g className="habitat-drift" fill={dark ? "#4a4282" : "#ffffff"} opacity={dark ? 0.6 : 0.9}>
          <path d="M60 70a14 14 0 0 1 26-6a11 11 0 0 1 18 10H52a8 8 0 0 1 8-4z" />
          <path d="M220 44a12 12 0 0 1 22-5a9 9 0 0 1 15 8H214a7 7 0 0 1 6-3z" />
        </g>
        <path d="M0 200Q90 168 190 190T400 182V300H0Z" fill={dark ? "#2b4a48" : "#b6dcb0"} />
        <path d="M0 228Q110 204 220 220T400 214V300H0Z" fill={dark ? "#24403e" : "#9ccf9c"} />
        <g>
          {[[40, 246, "#ffb3cf"], [80, 266, "#fff1b8"], [120, 240, "#ffd0a8"], [300, 250, "#ffb3cf"], [344, 270, "#fff1b8"], [370, 238, "#d9ccff"]].map(([x, y, col], i) => (
            <g key={i}>
              <path d={`M${x} ${Number(y) + 2}v10`} stroke={dark ? "#3c6a5c" : "#6aa874"} strokeWidth={1.6} />
              <circle cx={x} cy={y} r={3.4} fill={String(col)} opacity={dark ? 0.75 : 1} />
            </g>
          ))}
        </g>
        {dark ? (
          <g fill="#ffe58a">
            {[[90, 180], [150, 150], [270, 170], [330, 196], [60, 210]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={2} className="habitat-twinkle" style={d(i * 0.7)} />
            ))}
          </g>
        ) : null}
      </g>
    );
  },
};

// ── Decor ───────────────────────────────────────────────────────────────────────────────────────────────

function quad(p0: [number, number], p1: [number, number], p2: [number, number], s: number): [number, number] {
  const u = 1 - s;
  return [u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0], u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1]];
}

const DECOR: Record<DecorKey, (c: Ctx) => ReactNode> = {
  "string-lights": ({ t, lit }) => {
    const bulbs: [number, number][] = [];
    for (const seg of [
      [[0, 14], [100, 50], [200, 18]],
      [[200, 18], [300, 50], [400, 14]],
    ] as [number, number][][]) {
      for (const s of [0.15, 0.38, 0.62, 0.85]) bulbs.push(quad(seg[0], seg[1], seg[2], s));
    }
    const colors = ["#ffd27a", "#ffb38a", "#f5b3d0", "#c8bdff"];
    return (
      <g>
        <path d="M0 14Q100 50 200 18Q300 50 400 14" fill="none" stroke={t.ink} strokeOpacity={0.55} strokeWidth={1.4} />
        {bulbs.map(([x, y], i) => (
          <g key={i}>
            {lit ? <circle cx={x} cy={y + 6} r={9} fill={colors[i % 4]} opacity={0.22} className="habitat-flicker" style={d(i * 0.5)} /> : null}
            <rect x={x - 1.6} y={y - 1} width={3.2} height={3} fill={t.ink} opacity={0.6} />
            <ellipse cx={x} cy={y + 6} rx={3.2} ry={4.4} fill={colors[i % 4]} opacity={lit ? 1 : 0.7} />
          </g>
        ))}
      </g>
    );
  },
  "window-moon": ({ t }) => (
    <g>
      <rect x={292} y={44} width={62} height={62} rx={10} fill="#2c2a66" />
      <path d="M332 62a12 12 0 1 0 12 16a9 9 0 1 1-12-16z" fill="#fff1c1" />
      <circle cx={306} cy={60} r={1.3} fill="#fff4d6" className="habitat-twinkle" />
      <circle cx={314} cy={88} r={1} fill="#fff4d6" className="habitat-twinkle" style={d(1)} />
      <rect x={292} y={44} width={62} height={62} rx={10} fill="none" stroke={t.frame} strokeWidth={5} />
      <path d="M323 44V106M292 75H354" stroke={t.frame} strokeWidth={3} />
      <rect x={286} y={104} width={74} height={6} rx={2} fill={t.frameDark} />
    </g>
  ),
  clock: ({ t, theme }) => (
    <g>
      <circle cx={112} cy={48} r={15} fill={theme === "dark" ? "#efe6ff" : "#fffaf2"} stroke={t.woodDark} strokeWidth={3.5} />
      <path d="M112 48V39M112 48l6 4" stroke={t.ink} strokeWidth={2} strokeLinecap="round" />
      <circle cx={112} cy={48} r={1.6} fill="#ff9a3c" />
      <g fill={t.ink} opacity={0.5}>
        <circle cx={112} cy={36} r={1} />
        <circle cx={124} cy={48} r={1} />
        <circle cx={112} cy={60} r={1} />
        <circle cx={100} cy={48} r={1} />
      </g>
    </g>
  ),
  "trophy-shelf": ({ t }) => (
    <g>
      <path d="M300 122h22v8a11 11 0 0 1-22 0z" fill="#ffc94d" stroke="#b97d0e" strokeWidth={1.8} />
      <path d="M300 125h-4a5 5 0 0 0 5 7M322 125h4a5 5 0 0 1-5 7" fill="none" stroke="#b97d0e" strokeWidth={1.8} />
      <path d="M309 140h4v4h4v4h-12v-4h4z" fill="#ffc94d" stroke="#b97d0e" strokeWidth={1.4} />
      <path d="M340 126l3.3 6.6 7.3 1-5.3 5.2 1.3 7.2-6.6-3.4-6.6 3.4 1.3-7.2-5.3-5.2 7.3-1z" fill="#ffd36b" stroke="#c58a12" strokeWidth={1.4} />
      <circle cx={362} cy={140} r={6} fill="#c8bdff" stroke="#6650c8" strokeWidth={1.6} />
      <path d="M359 134l3-8 3 8" fill="none" stroke="#6650c8" strokeWidth={1.4} />
      <rect x={290} y={148} width={84} height={6} rx={2} fill={t.wood} />
      <path d="M296 154v6M368 154v6" stroke={t.woodDark} strokeWidth={3} />
    </g>
  ),
  bookshelf: ({ t, theme }) => {
    const books = theme === "dark" ? ["#5b4b8a", "#7a4f6e", "#3f5a6e", "#8a6a4a", "#6e5a8a"] : ["#b7a3d6", "#e0a8a0", "#9fc2b4", "#e6c58f", "#a9b7d9"];
    return (
      <g>
        <rect x={16} y={92} width={84} height={FLOOR - 88} rx={4} fill={t.woodDark} />
        <rect x={22} y={98} width={72} height={FLOOR - 104} rx={2} fill={theme === "dark" ? "#1a1428" : "#e9dac4"} />
        {[98, 136, 174].map((y, row) => (
          <g key={y}>
            {Array.from({ length: 6 }, (_, i) => {
              const h = 22 + ((i * 5 + row * 3) % 10);
              const x = 25 + i * 11 + (row % 2) * 2;
              const lean = row === 1 && i === 5;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y + 34 - h}
                  width={9}
                  height={h}
                  rx={1.5}
                  fill={books[(i + row) % books.length]}
                  transform={lean ? `rotate(14 ${x} ${y + 34})` : undefined}
                />
              );
            })}
            <rect x={20} y={y + 34} width={76} height={4} fill={t.wood} />
          </g>
        ))}
      </g>
    );
  },
  lamp: ({ t, theme, lit, uid }) => (
    <g>
      {lit ? (
        <>
          <defs>
            <radialGradient id={`${uid}-lamp`}>
              <stop offset="0" stopColor={t.glow} stopOpacity={0.55} />
              <stop offset="1" stopColor={t.glow} stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx={372} cy={140} r={70} fill={`url(#${uid}-lamp)`} className="habitat-flicker" />
        </>
      ) : null}
      <path d="M372 136V262" stroke={t.woodDark} strokeWidth={4} />
      <ellipse cx={372} cy={264} rx={16} ry={5} fill={t.woodDark} />
      <path d="M356 112H388L396 140H348Z" fill={lit ? "#ffe2a8" : theme === "dark" ? "#b7a7d6" : "#f3e2c8"} stroke={t.woodDark} strokeWidth={2} strokeLinejoin="round" />
    </g>
  ),
  "record-player": ({ t, theme }) => (
    <g>
      <rect x={290} y={206} width={68} height={52} rx={5} fill={t.wood} />
      <rect x={296} y={220} width={26} height={32} rx={3} fill={t.woodDark} />
      <rect x={326} y={220} width={26} height={32} rx={3} fill={t.woodDark} />
      <rect x={294} y={196} width={60} height={12} rx={3} fill={theme === "dark" ? "#efe6ff" : "#fffaf2"} />
      <g className="habitat-spin">
        <ellipse cx={318} cy={198} rx={17} ry={4.5} fill="#2b2147" />
        <ellipse cx={318} cy={198} rx={5} ry={1.6} fill="#ff9a3c" />
      </g>
      <path d="M346 192v6l-10 3" fill="none" stroke={t.ink} strokeWidth={1.8} strokeLinecap="round" />
      <g className="habitat-twinkle" fill={theme === "dark" ? "#c8bdff" : "#8b7bff"} stroke={theme === "dark" ? "#c8bdff" : "#8b7bff"} strokeWidth={1.6} strokeLinecap="round">
        <ellipse cx={302} cy={186} rx={2.6} ry={2} />
        <path d="M304.4 186V176l5 2" fill="none" />
        <ellipse cx={336} cy={180} rx={2.2} ry={1.7} />
        <path d="M338 180V172" fill="none" />
      </g>
    </g>
  ),
  plant: ({ theme }) => {
    const leaf = theme === "dark" ? "#4f8f78" : "#7fbf94";
    const leafDark = theme === "dark" ? "#3a6e5c" : "#5fa278";
    return (
      <g>
        <path d="M36 236C20 210 18 186 30 172C40 196 40 214 40 236Z" fill={leafDark} />
        <path d="M44 236C40 200 48 176 64 164C66 196 56 216 50 236Z" fill={leaf} />
        <path d="M40 236C30 214 8 206 0 210C8 228 26 236 40 238Z" fill={leaf} />
        <path d="M48 236C56 216 78 206 88 210C80 228 62 236 48 238Z" fill={leafDark} />
        <path d="M24 234H70L64 276H30Z" fill="#e8a27c" />
        <rect x={20} y={230} width={54} height={9} rx={3} fill="#d58a64" />
      </g>
    );
  },
  "treasure-chest": ({ t }) => (
    <g strokeLinejoin="round">
      <ellipse cx={92} cy={274} rx={30} ry={4} fill={t.shadow} opacity={0.25} />
      <path d="M66 246h52v26H66z" fill="#b07a4a" stroke="#6e4426" strokeWidth={2} />
      <path d="M66 246q0-16 26-16t26 16z" fill="#c68d58" stroke="#6e4426" strokeWidth={2} />
      <path d="M78 231v41M106 231v41" stroke="#ffc94d" strokeWidth={3} />
      <rect x={87} y={243} width={10} height={11} rx={2} fill="#ffc94d" stroke="#b97d0e" strokeWidth={1.4} />
      <circle cx={92} cy={248} r={1.4} fill="#6e4426" />
      <circle cx={122} cy={236} r={1.6} fill="#fff1b8" className="habitat-twinkle" />
    </g>
  ),
  rug: ({ theme }) => (
    <g>
      <ellipse cx={200} cy={268} rx={118} ry={24} fill={theme === "dark" ? "#3b2f6a" : "#e9c9b4"} />
      <ellipse cx={200} cy={268} rx={100} ry={18} fill="none" stroke={theme === "dark" ? "#8b7bff" : "#f3a98a"} strokeOpacity={0.55} strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" />
    </g>
  ),
  cushion: ({ theme }) => (
    <g>
      <path d="M146 270Q146 252 200 252Q254 252 254 270Q254 286 200 286Q146 286 146 270Z" fill={theme === "dark" ? "#6a5ab8" : "#c8bdff"} />
      <path d="M152 266Q200 256 248 266" fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" />
      <circle cx={200} cy={270} r={2.4} fill={theme === "dark" ? "#4a3d94" : "#a596f0"} />
    </g>
  ),
  "coffee-mug": ({ theme }) => (
    <g strokeLinejoin="round" transform="translate(38 10)">
      <g fill="none" stroke={theme === "dark" ? "#b8aee0" : "#b09a86"} strokeWidth={1.8} strokeLinecap="round" opacity={0.8}>
        <path className="habitat-flicker" d="M302 254q-3-4 0-8t0-8" />
        <path className="habitat-flicker" style={d(1.5)} d="M310 255q-3-4 0-8t0-8" />
      </g>
      <path d="M296 260h20v12q0 8-10 8t-10-8z" fill="#fff4e6" stroke="#b07d5b" strokeWidth={2} />
      <path d="M316 263q6 0 6 4.5t-6 4.5" fill="none" stroke="#b07d5b" strokeWidth={2} />
      <path d="M300 268q6 3 12 0" fill="none" stroke="#ff9a3c" strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
};

/** Back to front, so overlapping slots layer sensibly. */
const DRAW_ORDER: readonly DecorKey[] = [
  "string-lights",
  "window-moon",
  "clock",
  "trophy-shelf",
  "bookshelf",
  "lamp",
  "record-player",
  "rug",
  "plant",
  "treasure-chest",
  "cushion",
  "coffee-mug",
];

const NAMES: Record<BackgroundKey, string> = {
  dusk: "a cosy room at dusk",
  dawn: "a cosy room at dawn",
  starfield: "a hill under the stars",
  meadow: "a meadow",
  "rainy-window": "a cosy room with rain on the window",
  library: "a quiet library",
};

export function Habitat({
  background = "dusk",
  decor = [],
  theme = "dark",
  timeOfDay = "evening",
  animate = true,
  className,
  style,
  label,
  children,
}: HabitatProps) {
  const uid = `habitat${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const t = TONES[theme];
  const ctx: Ctx = { t, theme, lit: timeOfDay !== "day", uid };
  const outdoor = OUTDOOR_BACKGROUNDS.includes(background);
  const chosen = new Set(decor);
  const items = DRAW_ORDER.filter((key) => chosen.has(key) && !(outdoor && WALL_DECOR.includes(key)));
  const draw = BACKGROUNDS[background] ?? BACKGROUNDS.dusk;

  return (
    <div
      className={[animate ? "habitat-anim" : "", className ?? ""].join(" ").trim() || undefined}
      style={{ position: "relative", overflow: "hidden", aspectRatio: "4 / 3", width: "100%", ...style }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax slice"
        role="img"
        aria-label={label ?? `Mochi's place: ${NAMES[background]}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      >
        <style>{CSS}</style>
        {draw(ctx)}
        <ellipse cx={200} cy={258} rx={150} ry={60} fill={t.glow} opacity={theme === "dark" ? 0.06 : 0.1} />
        {items.map((key) => (
          <g key={key}>{DECOR[key](ctx)}</g>
        ))}
        {timeOfDay === "night" ? <rect width={W} height={H} fill="#05040f" opacity={theme === "dark" ? 0.22 : 0.12} pointerEvents="none" /> : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "4%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
