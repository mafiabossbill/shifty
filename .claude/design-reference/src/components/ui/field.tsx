"use client";

import * as React from "react";
import { CircleAlertIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

/**
 * One form field, laid out the way the design standard asks (docs/factory/docs/UI_UX_STANDARD.md, Forms):
 * label, then the hint, then the error, then the control, in one column.
 *   - The label is always visible and outside the control; a placeholder is never the label.
 *   - The error sits above the control, where the keyboard and autofill cannot cover it. It is an
 *     icon and a sentence saying what to do, not colour alone; the control is marked aria-invalid.
 *   - Most fields are required, so only the rarer kind is marked: `optional` adds "(optional)".
 * The single child is the control (Input, Textarea, a select); it gets its id and descriptions here.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: React.ReactElement<ControlProps>;
}) {
  const generated = React.useId();
  const id = children.props.id ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
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
      {React.cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : children.props["aria-invalid"] })}
    </div>
  );
}
