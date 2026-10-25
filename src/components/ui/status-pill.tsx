import { cn } from "@/lib/utils";

/**
 * Semantic status pill: color carries meaning, never decoration. Each feature maps its
 * statuses to one of these tones in its own component (a `Record<Status, Tone>`).
 */
export const TONES = {
  neutral: { pill: "bg-neutral-100 text-neutral-600", dot: "bg-neutral-400" },
  info: { pill: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  warning: { pill: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  danger: { pill: "bg-red-50 text-red-700", dot: "bg-red-500" },
  success: { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
} as const;
export type Tone = keyof typeof TONES;

export function StatusPill({ label, tone = "neutral", className }: { label: string; tone?: Tone; className?: string }) {
  const style = TONES[tone];
  return (
    <span className={cn("inline-flex h-5 w-fit items-center gap-1.5 rounded-[5px] px-1.5 text-xs font-medium whitespace-nowrap", style.pill, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
      {label}
    </span>
  );
}
