"use client";

import * as React from "react";
import { CircleAlertIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" };

export interface FieldProps {
  /** A short noun in the person's words. Always visible; a placeholder is never the label. */
  label: React.ReactNode;
  /** Help that matters while filling the field in. Sits between the label and the control. */
  hint?: React.ReactNode;
  /** A sentence that says what to do ("Enter an end time after the start"), never "Invalid input". */
  error?: React.ReactNode;
  /** Most fields are required, so only the rarer kind is marked: adds "(optional)". */
  optional?: boolean;
  /**
   * Only when the control is not the single child (it sits inside a wrapper, or there are several
   * elements): the id of the control. You then set `id`, `aria-describedby="<id>-hint <id>-error"`
   * and `aria-invalid` on it yourself.
   */
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * One form field, laid out the way the design standard asks (§9): label, then the hint, then the
 * error, then the control, in one column.
 *   - The error sits above the control, where the keyboard and autofill cannot cover it. It is an
 *     icon and a sentence, not colour alone; the control is marked aria-invalid.
 *   - With a single control as the child (Input, Textarea, Select…) the ids and aria attributes are
 *     wired here:  <Field label="Goal" hint="Net hours, breaks excluded" error={err}><Input /></Field>
 */
export function Field({ label, hint, error, optional, htmlFor, className, children }: FieldProps) {
  const generated = React.useId();
  const only = !htmlFor && React.isValidElement<ControlProps>(children) ? children : null;
  const id = htmlFor ?? only?.props.id ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [only?.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div data-slot="field" className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
      </Label>
      {hint ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-caption font-semibold text-red-700">
          <CircleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {only ? React.cloneElement(only, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : only.props["aria-invalid"] }) : children}
    </div>
  );
}
