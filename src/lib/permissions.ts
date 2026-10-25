/**
 * Central capability map. Every server-side authorization decision goes through
 * `can()`; Postgres mirrors ROLE_CAPABILITIES in `private.role_capabilities()` (the
 * LAST migration that defines it wins) and `has_capability()`. tests/permissions.test.ts
 * fails if the two drift. To add a capability: add it here AND in a new migration that
 * replaces `private.role_capabilities()` with the full map.
 *
 * Lines marked `@example` belong to the example `projects` entity; `scripts/bootstrap --no-example`
 * removes them together with the entity.
 */
export const ROLES = ["admin", "manager", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  /** Invite, change role, deactivate members. */
  "member:manage",
  /** Organization name, timezone, currency. */
  "settings:manage",
  "audit:view",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  admin: [
    "member:manage",
    "settings:manage",
    "audit:view",
  ],
  manager: [
  ],
  member: [
  ],
  viewer: [
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(user: { role: Role }, capability: Capability): boolean {
  return ROLE_CAPABILITIES[user.role].includes(capability);
}

/** What client components may know about the viewer (never the raw map). */
export function viewerCapabilities(user: { role: Role }): Capability[] {
  return [...ROLE_CAPABILITIES[user.role]];
}

