"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, ApiError } from "@/lib/api-client";
import { SELF_SERVE } from "@/lib/app-config";
import { cn } from "@/lib/utils";

export interface WorkspaceOption {
  id: string;
  name: string;
}

/**
 * The active workspace's name; a menu when there is somewhere to switch to (several memberships)
 * or SaaS tenancy lets people create another. Switching sets the cookie and reloads server data.
 */
export function WorkspaceSwitcher({ workspaces, activeId, className }: { workspaces: WorkspaceOption[]; activeId: string; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const active = workspaces.find((w) => w.id === activeId);
  const label = active?.name ?? "";

  if (workspaces.length < 2 && !SELF_SERVE) {
    return <span className={cn("truncate text-[11px] text-muted-foreground", className)}>{label}</span>;
  }

  async function switchTo(id: string) {
    if (id === activeId) return;
    setPending(true);
    try {
      await api.switchWorkspace(id);
      // Pages of the old workspace's records would 404: start from its dashboard.
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't switch workspace. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label={`Workspace: ${label}. Switch workspace`}
        className={cn(
          "flex min-w-0 cursor-pointer items-center gap-1 rounded-sm px-1 text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 max-md:min-h-11",
          className,
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDownIcon className="size-3 shrink-0" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => switchTo(w.id)}>
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            {w.id === activeId ? <CheckIcon aria-label="Current workspace" /> : null}
          </DropdownMenuItem>
        ))}
        {SELF_SERVE ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
              <PlusIcon aria-hidden />
              New workspace
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
