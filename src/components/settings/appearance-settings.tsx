"use client";

import * as React from "react";

import { useTheme } from "@/components/theme/theme-provider";
import { AccentSetting, ThemeSetting } from "@/components/theme/theme-setting";
import { Input } from "@/components/ui/input";
import { SwitchRow } from "@/components/ui/switch";


import { SettingRow, SettingsGroup, SettingsHeader, SettingsSkeleton, useSaveSettings } from "./parts";
import { useReadyShift } from "./use-ready-shift";

export function AppearanceSettings() {
  const view = useReadyShift();
  const save = useSaveSettings();
  const { motion, setMotion } = useTheme();
  if (!view.ready) return <SettingsSkeleton rows={5} />;
  const s = view.profile.settings;
  return (
    <div className="grid gap-8">
      <SettingsHeader title="Appearance" description="Applies at once on this device, and follows you when you sync." />
      <SettingsGroup title="Look" id="look">
        <SettingRow label="Theme" stack>
          <ThemeSetting onChange={(theme) => void save({ theme })} />
        </SettingRow>
        <SettingRow label="Accent colour" stack>
          <AccentSetting onChange={(accent) => void save({ accent })} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Feel" id="feel">
        {/* Same as <MotionSetting />, plus saving the choice to your settings. */}
        <SwitchRow
          id="reduce-motion"
          title="Reduce motion"
          description="Fewer animations. On automatically when your device asks for it."
          checked={motion === "reduce"}
          onCheckedChange={(on) => {
            setMotion(on ? "reduce" : "system");
            void save({ reducedMotion: on ? "reduce" : "system" });
          }}
        />
        <SwitchRow
          id="haptics"
          title="Haptics"
          description="A small buzz on clock in and out, on phones that support it."
          checked={s.haptics}
          onCheckedChange={(on) => void save({ haptics: on })}
        />
      </SettingsGroup>
      <SettingsGroup title="You" id="you">
        <SettingRow label="Your name" description="Used for greetings. Optional." htmlFor="display-name">
          <NameInput value={s.displayName} onSave={(displayName) => save({ displayName })} />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}

function NameInput({ value, onSave }: { value: string; onSave: (v: string) => Promise<boolean> }) {
  const [text, setText] = React.useState(value);
  const [synced, setSynced] = React.useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(value);
  }
  const commit = () => {
    const next = text.trim().slice(0, 60);
    if (next !== value) void onSave(next);
  };
  return (
    <Input
      id="display-name"
      value={text}
      maxLength={60}
      autoComplete="given-name"
      placeholder="What should Mochi call you?"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="sm:w-64"
    />
  );
}
