"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { CATALOG } from "./catalog";
import { Habitat, type HabitatTheme, type HabitatTimeOfDay } from "./habitat";
import { Mochi } from "./mochi";
import { moodFor, type MoodInput } from "./mood";
import {
  ACCESSORY_KEYS,
  BACKGROUND_KEYS,
  DECOR_KEYS,
  HAT_KEYS,
  MOODS,
  PALETTE_KEYS,
  type MochiMood,
} from "./parts";

/** Review sheet: every mood, palette, hat, accessory and habitat. Not linked from the app's navigation. */

const SURFACE: Record<HabitatTheme, { bg: string; card: string; text: string; muted: string; border: string; accent: string }> = {
  dark: { bg: "#0c0a18", card: "#15122a", text: "#ece9f8", muted: "#a49fc0", border: "#2a2546", accent: "#8b7bff" },
  light: { bg: "#fbf8f1", card: "#ffffff", text: "#231d33", muted: "#6b6480", border: "#e9e2d4", accent: "#6a58f0" },
};

const nameOf = (key: string) => CATALOG.find((item) => item.key === key)?.name ?? key;
const unlockOf = (key: string) => {
  const unlock = CATALOG.find((item) => item.key === key)?.unlock;
  if (!unlock) return "always";
  if ("default" in unlock) return "starting set";
  if ("level" in unlock) return `level ${unlock.level}`;
  return unlock.achievement.replace(/_/g, " ");
};

const HAT_MOODS: MochiMood[] = ["happy", "proud", "curious", "sleepy", "celebrating", "focused", "resting", "happy"];
const ACCESSORY_MOODS: MochiMood[] = ["happy", "curious", "proud", "focused", "celebrating"];

const LINE_CASES: { label: string; input: MoodInput }[] = [
  { label: "Idle, 08:00", input: { status: "idle", localHour: 8, netMs: 0, goalMs: 16 * 3.6e6, recentlyCelebrated: false } },
  { label: "Active, 3h", input: { status: "active", localHour: 14, netMs: 3 * 3.6e6, goalMs: 16 * 3.6e6, recentlyCelebrated: false } },
  { label: "On a break", input: { status: "on_break", localHour: 15, netMs: 6 * 3.6e6, goalMs: 16 * 3.6e6, recentlyCelebrated: false } },
  { label: "Active, 13h", input: { status: "active", localHour: 3, netMs: 13 * 3.6e6, goalMs: 16 * 3.6e6, recentlyCelebrated: false } },
  { label: "Active, past goal", input: { status: "active", localHour: 5, netMs: 17 * 3.6e6, goalMs: 16 * 3.6e6, recentlyCelebrated: false } },
  { label: "Just finished", input: { status: "just_finished", localHour: 18, netMs: 8 * 3.6e6, goalMs: 16 * 3.6e6, recentlyCelebrated: false } },
];

export function MochiGallery() {
  const [theme, setTheme] = useState<HabitatTheme>("dark");
  const [animate, setAnimate] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState<HabitatTimeOfDay>("evening");
  const s = SURFACE[theme];

  const grid = (min: number): CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 12 });
  const card: CSSProperties = {
    background: s.card,
    border: `1px solid ${s.border}`,
    borderRadius: 16,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  };
  const caption: CSSProperties = { fontSize: 13, fontWeight: 600, color: s.text, textAlign: "center" };
  const sub: CSSProperties = { fontSize: 12, color: s.muted, textAlign: "center" };

  const toggle = (active: boolean): CSSProperties => ({
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 999,
    border: `1px solid ${active ? s.accent : s.border}`,
    background: active ? s.accent : s.card,
    color: active ? "#fff" : s.text,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <div style={{ background: s.bg, color: s.text, minHeight: "100%", padding: "20px 16px 48px", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Mochi mood="happy" size={48} animate={animate} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Mochi</h1>
              <p style={{ ...sub, textAlign: "left", margin: 0 }}>Every mood, item and habitat, for review.</p>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="group" aria-label="Preview options">
            <button type="button" style={toggle(theme === "dark")} onClick={() => setTheme("dark")} aria-pressed={theme === "dark"}>
              Dark
            </button>
            <button type="button" style={toggle(theme === "light")} onClick={() => setTheme("light")} aria-pressed={theme === "light"}>
              Light
            </button>
            <button type="button" style={toggle(animate)} onClick={() => setAnimate((a) => !a)} aria-pressed={animate}>
              Motion {animate ? "on" : "off"}
            </button>
            <button
              type="button"
              style={toggle(false)}
              onClick={() => setTimeOfDay((t) => (t === "day" ? "evening" : t === "evening" ? "night" : "day"))}
            >
              Time: {timeOfDay}
            </button>
          </div>
        </header>

        <Section title="Moods" s={s}>
          <div style={grid(150)}>
            {MOODS.map((mood) => (
              <div key={mood} style={card}>
                <Mochi mood={mood} size={140} animate={animate} />
                <div style={caption}>{mood}</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <Mochi mood={mood} size={48} animate={animate} />
                  <Mochi mood={mood} size={32} animate={animate} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Palettes" s={s}>
          <div style={grid(110)}>
            {PALETTE_KEYS.map((palette) => (
              <div key={palette} style={card}>
                <Mochi palette={palette} size={88} animate={animate} />
                <div style={caption}>{nameOf(palette)}</div>
                <div style={sub}>{unlockOf(palette)}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Hats" s={s}>
          <div style={grid(130)}>
            {HAT_KEYS.map((hat, i) => (
              <div key={hat} style={card}>
                <Mochi hat={hat} mood={HAT_MOODS[i]} palette={PALETTE_KEYS[i % PALETTE_KEYS.length]} size={112} animate={animate} />
                <div style={caption}>{nameOf(hat)}</div>
                <div style={sub}>{unlockOf(hat)}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Accessories" s={s}>
          <div style={grid(130)}>
            {ACCESSORY_KEYS.map((accessory, i) => (
              <div key={accessory} style={card}>
                <Mochi accessory={accessory} mood={ACCESSORY_MOODS[i]} palette={PALETTE_KEYS[(i + 3) % PALETTE_KEYS.length]} size={112} animate={animate} />
                <div style={caption}>{nameOf(accessory)}</div>
                <div style={sub}>{unlockOf(accessory)}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Habitats" s={s}>
          <div style={grid(300)}>
            {BACKGROUND_KEYS.map((background, i) => (
              <div key={background} style={{ ...card, padding: 0, overflow: "hidden", alignItems: "stretch" }}>
                <Habitat
                  background={background}
                  decor={i % 2 === 0 ? DECOR_KEYS : ["rug", "plant", "lamp", "string-lights", "cushion"]}
                  theme={theme}
                  timeOfDay={timeOfDay}
                  animate={animate}
                >
                  <Mochi
                    mood={MOODS[i % MOODS.length]}
                    palette={PALETTE_KEYS[i % PALETTE_KEYS.length]}
                    hat={i === 3 ? "flower-crown" : i === 2 ? "night-cap" : "none"}
                    size={150}
                    animate={animate}
                  />
                </Habitat>
                <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={caption}>{nameOf(background)}</span>
                  <span style={sub}>{unlockOf(background)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...grid(150), marginTop: 12 }}>
            {DECOR_KEYS.map((key) => (
              <div key={key} style={{ ...card, alignItems: "flex-start", gap: 2 }}>
                <div style={caption}>{nameOf(key)}</div>
                <div style={sub}>{unlockOf(key)}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="What Mochi says" s={s}>
          <div style={grid(260)}>
            {LINE_CASES.map(({ label, input }) => {
              const { mood, line } = moodFor(input);
              return (
                <div key={label} style={{ ...card, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Mochi mood={mood} size={56} animate={animate} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...sub, textAlign: "left" }}>{label}</div>
                    <div style={{ fontSize: 14, color: s.text }}>{line}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, s, children }: { title: string; s: { muted: string }; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: s.muted, margin: 0 }}>{title}</h2>
      {children}
    </section>
  );
}
