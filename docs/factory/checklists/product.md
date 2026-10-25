# Product checklist

Before building (end of intake/blueprint) and again before launch. Sources: [../THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §1–3.

## Understanding
- [ ] One sentence in `PRODUCT.md`: who uses it, to do what, instead of what
- [ ] Every role listed with what it can do and its home page (`PRODUCT.md` → Users and roles)
- [ ] The core loop written step by step and buildable end to end in the first wave
- [ ] The one or two non-negotiable rules named, each with where it is enforced (DB function / constraint)
- [ ] Entities listed with owner and lifecycle (create → change → archive/delete)

## Assumptions and decisions
- [ ] Every gap in the brief recorded as an assumption (brief → Assumptions), none left implicit
- [ ] Questions to Bill only for behaviour, architecture, security, money or irreversible infrastructure — batched in one message
- [ ] Deviations from the default stack recorded in `factory/DECISIONS.md`

## Scope
- [ ] "Out of scope (for now)" list written; nothing in it is half-built
- [ ] Integrations listed with provider, direction, credentials needed and mock mode
- [ ] Locale defaults set: currency, timezone, week start, language (`src/lib/app-config.ts`)
- [ ] PWA decision recorded (on/off and why)

## Real, not a demo
- [ ] Runs on real auth, a real database and real permissions — no hardcoded users or fake data paths
- [ ] Seed/demo data is clearly marked and removable; never presented as "complete"
- [ ] Every screen in the core loop has loading, empty and error states

## Launch-ready product
- [ ] Go-live data pack requested from Bill ([../intake/GO_LIVE_DATA_PACK_TEMPLATE.md](../intake/GO_LIVE_DATA_PACK_TEMPLATE.md))
- [ ] Copy reviewed: plain words, no jargon, errors say what to do
- [ ] A new user can complete the core loop without training (test with someone who hasn't seen it)
- [ ] `PRODUCT.md` matches what is actually built
