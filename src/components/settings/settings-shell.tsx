"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { DemoLink } from "./demo-link";
import { SETTINGS_GROUPS, isSettingsActive } from "./nav";
import { SettingsIcon } from "./settings-icon";

/** Settings shell: grouped side nav from 1024px; below that the /settings menu page and back links. */
export function SettingsSideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="sticky top-0 hidden content-start gap-5 self-start lg:grid">
      <p className="type-display">Settings</p>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.title} className="grid gap-1">
          <p className="type-eyebrow px-3 text-muted-foreground">{group.title}</p>
          <ul className="grid gap-0.5">
            {group.links.map((link) => {
              const active = isSettingsActive(pathname, link);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors focus-ring",
                      active ? "bg-brand-soft font-medium text-brand-strong" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <SettingsIcon name={link.icon} className="size-4" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="border-t border-border px-3 pt-4">
        <DemoLink compact />
      </div>
    </nav>
  );
}

export function SettingsSideNavFrame() {
  return <div className="hidden lg:block" />;
}
