# DECISIONS — SHIFTY

> Architecture and product decisions that would surprise a newcomer. One entry per decision, newest first.
> Default choices from the factory doctrine need no entry; deviations always do.

## Format
```
### D<nn> — <title> (<YYYY-MM-DD>, <who decided: Bill | orchestrator | agent>)
Context: <what forced a choice>
Decision: <what we do>
Alternatives: <what we didn't do, one line each>
Consequences: <cost, follow-ups, how to revisit>
```

## Entries
### D01 — Stack from the factory defaults (<date>, orchestrator)
Context: new app bootstrapped from bill-app-factory `nextjs-supabase`.
Decision: Next.js 16 App Router + TypeScript, Supabase (Postgres, Auth, RLS, Storage), Vercel, Tailwind v4 + Radix primitives, Zod, Vitest, Playwright.
Alternatives: see THE_WAY_BILL_MAKES_APPS.md § Default stack.
Consequences: deviations get their own entry.
