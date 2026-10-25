import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: React.ReactNode;
  /** id of the control inside; the label and messages point at it. */
  htmlFor: string;
  /** One line under the control that helps fill it in. */
  hint?: React.ReactNode;
  /** A sentence that says what to fix. Also set aria-invalid on the control. */
  error?: React.ReactNode;
  /** Shown after the label in muted text, e.g. "Optional". */
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label + control + hint/error, stacked. Pass the ids yourself:
 *   <Field label="Goal" htmlFor="goal" hint="Net hours, breaks excluded" error={err}>
 *     <Input id="goal" aria-describedby="goal-hint goal-error" aria-invalid={!!err} />
 *   </Field>
 */
export function Field({ label, htmlFor, hint, error, optional, className, children }: FieldProps) {
  return (
    <div data-slot="field" className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">Optional</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-danger-ink" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
