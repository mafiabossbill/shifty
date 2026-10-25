"use client";

import { useMemo, type ComponentProps } from "react";

import { Select } from "@/components/ui/select";
import { zoneOptions } from "@/lib/sessions/rezone";

/** Native timezone picker: the zones in use first, then every zone this browser knows. */
export function ZoneSelect({
  id,
  value,
  onChange,
  suggested,
  ...rest
}: { id: string; value: string; onChange: (zone: string) => void; suggested: string[] } & Omit<ComponentProps<"select">, "onChange" | "value">) {
  const options = useMemo(() => zoneOptions([value, ...suggested]), [value, suggested]);
  const first = new Set([value, ...suggested]);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      <optgroup label="Suggested">
        {options
          .filter((z) => first.has(z))
          .map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
      </optgroup>
      <optgroup label="All timezones">
        {options
          .filter((z) => !first.has(z))
          .map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
      </optgroup>
    </Select>
  );
}
