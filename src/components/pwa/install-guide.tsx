"use client";

import * as React from "react";
import { Download, Share, SquarePlus, Smartphone } from "lucide-react";

import { isStandalone, platformHints, type PlatformHints } from "@/lib/notify";
import { canPromptInstall, promptInstall, subscribeInstallPrompt, wasJustInstalled } from "@/lib/pwa/install-prompt";
import { cn } from "@/lib/utils";

type InstallState = {
  standalone: boolean;
  canPrompt: boolean;
  installed: boolean;
  hints: PlatformHints;
};

const SERVER_STATE: InstallState | null = null;

function readState(): InstallState {
  return { standalone: isStandalone(), canPrompt: canPromptInstall(), installed: wasJustInstalled(), hints: platformHints() };
}

/** Client-only snapshot (null during SSR and the first render, so markup never mismatches). */
function useInstallState(): InstallState | null {
  const [state, setState] = React.useState<InstallState | null>(SERVER_STATE);
  React.useEffect(() => {
    const update = () => setState(readState());
    update();
    const unsubscribe = subscribeInstallPrompt(update);
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(display-mode: standalone)") : null;
    media?.addEventListener?.("change", update);
    return () => {
      unsubscribe();
      media?.removeEventListener?.("change", update);
    };
  }, []);
  return state;
}

export type InstallGuideProps = {
  className?: string;
  /** Called after the person accepts the native install prompt. */
  onInstalled?: () => void;
};

/**
 * "Install SHIFTY" card. Renders nothing inside the installed app. Chrome/Edge/Android:
 * a button that opens the native prompt. iPhone/iPad: the three Add to Home Screen steps.
 * Elsewhere: one line pointing at the browser menu.
 */
export function InstallGuide({ className, onInstalled }: InstallGuideProps) {
  const state = useInstallState();
  const [busy, setBusy] = React.useState(false);

  if (!state || state.standalone) return null;

  if (state.installed) {
    return (
      <Card className={className} title="SHIFTY is installed">
        <p className="text-sm text-muted-foreground">Open it from your home screen or app list for the full-screen app.</p>
      </Card>
    );
  }

  if (state.canPrompt) {
    const install = async () => {
      setBusy(true);
      const outcome = await promptInstall();
      setBusy(false);
      if (outcome === "accepted") onInstalled?.();
    };
    return (
      <Card className={className} title="Install SHIFTY">
        <p className="text-sm text-muted-foreground">Opens full screen, starts without a connection and keeps your shifts on this device.</p>
        <button
          type="button"
          onClick={install}
          disabled={busy}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 sm:w-auto"
        >
          <Download className="size-4" aria-hidden />
          Install SHIFTY
        </button>
      </Card>
    );
  }

  if (state.hints.ios) {
    return (
      <Card className={className} title="Add SHIFTY to your Home Screen">
        <ol className="mt-2 space-y-2.5 text-[15px] leading-6">
          <Step n={1} icon={<Share className="size-4" aria-hidden />}>
            Tap <strong className="font-semibold">Share</strong> in the browser bar.
          </Step>
          <Step n={2} icon={<SquarePlus className="size-4" aria-hidden />}>
            Choose <strong className="font-semibold">Add to Home Screen</strong>, then Add.
          </Step>
          <Step n={3} icon={<Smartphone className="size-4" aria-hidden />}>
            Open SHIFTY from the new icon.
          </Step>
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">On iPhone, reminders and the app badge only work in the installed app.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The home-screen app keeps its own data, separate from Safari. Install before your first shift, or move shifts with Export and Import.
        </p>
      </Card>
    );
  }

  return (
    <Card className={className} title="Install SHIFTY">
      <p className="text-sm text-muted-foreground">
        {state.hints.android
          ? "Open the browser menu (⋮) and choose Install app or Add to Home screen."
          : "Use your browser's menu: Install app, or in Safari on a Mac, File → Add to Dock. Some browsers can't install web apps; SHIFTY still works in a tab."}
      </p>
    </Card>
  );
}

function Card({ className, title, children }: { className?: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn("rounded-2xl border border-border bg-card p-4 text-card-foreground", className)}>
      <h2 className="mb-1 text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground" aria-hidden>
        {n}
      </span>
      <span className="flex-1">{children}</span>
      <span className="mt-1 text-muted-foreground">{icon}</span>
    </li>
  );
}
