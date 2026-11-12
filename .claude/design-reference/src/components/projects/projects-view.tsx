"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusPill, type Tone } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import type { Project } from "@/lib/data/projects";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/validation";

interface Viewer {
  id: string;
  canCreate: boolean;
  /** project:update:any; otherwise only projects the viewer owns (mirrors canUpdateProject). */
  canUpdateAny: boolean;
  canUpdateOwn: boolean;
  canDelete: boolean;
}

const PROJECT_TONES: Record<ProjectStatus, Tone> = { planned: "neutral", active: "info", on_hold: "warning", done: "success" };

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "Something went wrong. Try again.";
}

function isStatus(value: string | null): value is ProjectStatus {
  return value !== null && (PROJECT_STATUSES as readonly string[]).includes(value);
}

/** Dates as people read them; "—" for none. */
function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The example entity screen and the factory's list pattern:
 * table on tablet/desktop, stacked cards on phones, filters in the URL,
 * create in a dialog (bottom sheet on phones), edit in a side drawer,
 * destructive actions behind the shared confirm dialog, errors as human sentences.
 */
export function ProjectsView({ initialProjects, viewer }: { initialProjects: Project[]; viewer: Viewer }) {
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = React.useState(initialProjects);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const statusParam = params.get("status");
  const status = isStatus(statusParam) ? statusParam : null;
  const visible = rows.filter(
    (row) => (!status || row.status === status) && (!query.trim() || row.name.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const open = rows.find((row) => row.id === openId) ?? null;

  const setStatusFilter = (next: ProjectStatus | null) => {
    const url = new URLSearchParams(params.toString());
    if (next) url.set("status", next);
    else url.delete("status");
    router.replace(`?${url.toString()}`, { scroll: false });
  };

  const upsert = (project: Project) =>
    setRows((current) =>
      current.some((r) => r.id === project.id) ? current.map((r) => (r.id === project.id ? project : r)) : [project, ...current],
    );
  const editable = (project: Project) => viewer.canUpdateAny || (viewer.canUpdateOwn && project.owner_id === viewer.id);

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-title font-semibold">
          Projects <span className="font-normal text-muted-foreground tabular-nums">{visible.length}</span>
        </h1>
        {viewer.canCreate && (
          <Button onClick={() => setCreating(true)}>
            <PlusIcon />
            New project
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects" className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          <Button size="sm" variant={status === null ? "outline" : "ghost"} aria-pressed={status === null} onClick={() => setStatusFilter(null)}>
            All
          </Button>
          {PROJECT_STATUSES.map((s) => (
            <Button key={s} size="sm" variant={status === s ? "outline" : "ghost"} aria-pressed={status === s} onClick={() => setStatusFilter(s)}>
              {PROJECT_STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "No projects yet" : "Nothing matches"}
          description={rows.length === 0 ? "Projects you create appear here." : "Try another search or status."}
          action={
            rows.length === 0 && viewer.canCreate ? (
              <Button onClick={() => setCreating(true)}>
                <PlusIcon />
                New project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Tablet and desktop: a dense table. */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full table-fixed text-left">
              <thead className="border-b bg-muted/50 text-caption text-muted-foreground">
                <tr>
                  <th className="h-8 px-3 font-normal">Name</th>
                  <th className="h-8 w-32 px-3 font-normal">Status</th>
                  <th className="h-8 w-36 px-3 font-normal">Due</th>
                  <th className="h-8 w-36 px-3 font-normal">Updated</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => setOpenId(row.id)}
                    onKeyDown={(e) => e.key === "Enter" && setOpenId(row.id)}
                    className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <td className="h-9 truncate px-3 font-semibold">{row.name}</td>
                    <td className="px-3">
                      <StatusPill tone={PROJECT_TONES[row.status]} label={PROJECT_STATUS_LABELS[row.status]} />
                    </td>
                    <td className="px-3 whitespace-nowrap text-muted-foreground tabular-nums">{formatDate(row.due_date)}</td>
                    <td className="px-3 whitespace-nowrap text-muted-foreground tabular-nums">{formatDate(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Phones: stacked cards (never a shrunken table). */}
          <ul className="grid gap-2 md:hidden">
            {visible.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => setOpenId(row.id)} className="grid w-full gap-1.5 rounded-lg border p-3 text-left active:bg-accent">
                  <span className="font-semibold">{row.name}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <StatusPill tone={PROJECT_TONES[row.status]} label={PROJECT_STATUS_LABELS[row.status]} />
                    <span className="tabular-nums">{row.due_date ? `Due ${formatDate(row.due_date)}` : "No due date"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {creating && (
        <CreateProjectDialog
          onClose={() => setCreating(false)}
          onCreated={(project) => {
            upsert(project);
            toast.success("Project created", { description: project.name });
          }}
        />
      )}
      <ProjectDrawer
        project={open}
        editable={open ? editable(open) : false}
        canDelete={viewer.canDelete}
        onClose={() => setOpenId(null)}
        onSaved={upsert}
        onDeleted={(id) => {
          setRows((current) => current.filter((r) => r.id !== id));
          setOpenId(null);
        }}
      />
    </div>
  );
}

function CreateProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (project: Project) => void }) {
  const [name, setName] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  // One id per dialog: a retry after a lost response returns the same project instead of a duplicate.
  const [clientId] = React.useState(() => crypto.randomUUID());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the project a name.");
    setPending(true);
    setError(null);
    try {
      onCreated(await api.createProject({ name, due_date: dueDate || null, client_id: clientId }));
      onClose();
    } catch (err) {
      setError(message(err));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="md:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>You can add details after creating it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="np-name">Name</Label>
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="np-due">Due date</Label>
            <Input id="np-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-body text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Side drawer: edit in place, Save only when something changed, Delete behind the confirm dialog. */
function ProjectDrawer({
  project,
  editable,
  canDelete,
  onClose,
  onSaved,
  onDeleted,
}: {
  project: Project | null;
  editable: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (project: Project) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <Sheet open={project !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        {project && <DrawerBody key={project.id} project={project} readOnly={!editable} canDelete={canDelete} onSaved={onSaved} onDeleted={onDeleted} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  project,
  readOnly,
  canDelete,
  onSaved,
  onDeleted,
}: {
  project: Project;
  readOnly: boolean;
  canDelete: boolean;
  onSaved: (project: Project) => void;
  onDeleted: (id: string) => void;
}) {
  const confirm = useConfirm();
  const [draft, setDraft] = React.useState({
    name: project.name,
    status: project.status,
    due_date: project.due_date ?? "",
    description: project.description ?? "",
  });
  const [pending, setPending] = React.useState(false);
  const dirty =
    draft.name !== project.name ||
    draft.status !== project.status ||
    draft.due_date !== (project.due_date ?? "") ||
    draft.description !== (project.description ?? "");

  async function save() {
    setPending(true);
    try {
      onSaved(
        await api.updateProject(project.id, {
          name: draft.name,
          status: draft.status,
          due_date: draft.due_date || null,
          description: draft.description,
        }),
      );
      toast.success("Saved");
    } catch (err) {
      toast.error(message(err));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${project.name}?`,
      description: "The project is removed for everyone. The audit log keeps a record.",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteProject(project.id);
      onDeleted(project.id);
      toast.success("Project deleted");
    } catch (err) {
      toast.error(message(err));
    }
  }

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="pr-8 text-title">{project.name}</SheetTitle>
        <SheetDescription>{readOnly ? "You can view this project." : "Changes save when you press Save."}</SheetDescription>
      </SheetHeader>
      <div className="grid gap-4 overflow-y-auto p-4" data-scroll-area>
        <div className="grid gap-1.5">
          <Label htmlFor="pd-name">Name</Label>
          <Input id="pd-name" value={draft.name} disabled={readOnly} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pd-status">Status</Label>
          <select
            id="pd-status"
            value={draft.status}
            disabled={readOnly}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })}
            className="h-8 rounded-md border border-control bg-transparent px-2 text-body max-md:h-10 dark:bg-input/30"
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pd-due">Due date</Label>
          <Input id="pd-due" type="date" value={draft.due_date} disabled={readOnly} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pd-description">Description</Label>
          <Textarea
            id="pd-description"
            value={draft.description}
            disabled={readOnly}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            maxLength={2000}
          />
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t p-4">
        {canDelete && (
          <Button variant="ghost" className="text-red-700" onClick={remove}>
            Delete
          </Button>
        )}
        {!readOnly && (
          <Button className="ml-auto" disabled={!dirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </>
  );
}
