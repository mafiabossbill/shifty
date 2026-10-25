"use client";

import * as React from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SwitchRow } from "@/components/ui/switch";
import { formatMinor, fromMinor, toMinor } from "@/lib/money";


import { SettingRow, SettingsGroup, SettingsHeader, SettingsSkeleton, useSaveSettings } from "./parts";
import { useReadyShift } from "./use-ready-shift";

const CURRENCIES = ["TZS", "KES", "UGX", "RWF", "ZAR", "NGN", "USD", "EUR", "GBP", "AED", "INR"];

export function PaySettings() {
  const view = useReadyShift();
  const save = useSaveSettings();
  if (!view.ready) return <SettingsSkeleton rows={3} />;
  const s = view.profile.settings;
  const currencies = CURRENCIES.includes(s.currency) ? CURRENCIES : [s.currency, ...CURRENCIES];
  return (
    <div className="grid gap-8">
      <SettingsHeader title="Pay" description="See what your time is worth. Estimates only — not payroll, tax or overtime rules." />
      <SettingsGroup id="pay">
        <SwitchRow
          id="pay-tracking"
          title="Track pay"
          description="Adds an hourly rate to new sessions and an earnings card to Insights."
          checked={s.payTracking}
          onCheckedChange={(on) => void save({ payTracking: on })}
        />
        {s.payTracking ? (
          <>
            <SettingRow label="Currency" htmlFor="pay-currency">
              <Select
                id="pay-currency"
                value={s.currency}
                className="sm:w-40"
                onChange={(e) => {
                  const next = e.target.value;
                  // Keep the same typed amount; re-read it in the new currency's minor units.
                  const rate = s.defaultPayRateMinor === null ? null : toMinor(String(fromMinor(s.defaultPayRateMinor, s.currency)), next);
                  void save({ currency: next, defaultPayRateMinor: rate });
                }}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow label="Default hourly rate" description="Used for new sessions. Change it per session from its page." htmlFor="pay-rate">
              <RateInput currency={s.currency} valueMinor={s.defaultPayRateMinor} onSave={(minor) => save({ defaultPayRateMinor: minor })} />
            </SettingRow>
          </>
        ) : null}
      </SettingsGroup>
      <p className="px-1 text-xs text-muted-foreground">Existing sessions keep the rate and currency they started with. Amounts are never converted.</p>
    </div>
  );
}

function RateInput({ currency, valueMinor, onSave }: { currency: string; valueMinor: number | null; onSave: (minor: number | null) => Promise<boolean> }) {
  const shown = valueMinor === null ? "" : String(fromMinor(valueMinor, currency));
  const [text, setText] = React.useState(shown);
  const [synced, setSynced] = React.useState(`${currency}:${valueMinor}`);
  const [error, setError] = React.useState<string | null>(null);
  if (synced !== `${currency}:${valueMinor}`) {
    setSynced(`${currency}:${valueMinor}`);
    setText(shown);
  }
  const commit = async () => {
    if (text.trim() === "") {
      setError(null);
      if (valueMinor !== null) await onSave(null);
      return;
    }
    const minor = toMinor(text, currency);
    if (minor === null || minor < 0) return setError(`Enter an amount like 5,000 in ${currency}.`);
    setError(null);
    if (minor !== valueMinor && (await onSave(minor))) toast.success(`Default rate: ${formatMinor(minor, currency)} an hour.`);
  };
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          id="pay-rate"
          inputMode="decimal"
          value={text}
          placeholder="0"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "pay-rate-error" : "pay-rate-hint"}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => e.key === "Enter" && void commit()}
          className="w-36 text-right tabular"
        />
        <span className="text-sm text-muted-foreground">{currency} / hour</span>
      </div>
      {error ? (
        <p id="pay-rate-error" role="alert" className="text-xs font-medium text-danger-ink">
          {error}
        </p>
      ) : (
        <p id="pay-rate-hint" className="text-xs text-muted-foreground">
          {valueMinor === null ? "No default rate yet." : `${formatMinor(valueMinor, currency)} an hour`}
        </p>
      )}
    </div>
  );
}
