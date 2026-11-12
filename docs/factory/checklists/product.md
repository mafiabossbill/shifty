# Product checklist

Before building (end of intake/blueprint) and again before launch. Sources: [../THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §1–3, [../docs/PRODUCT_DISCOVERY_STANDARD.md](../docs/PRODUCT_DISCOVERY_STANDARD.md).

## Outcome and evidence
- [ ] One product outcome named with unit and baseline (or "learning goal"); it is a change in what users do, not a thing shipped
- [ ] Each role: how often they use it, on what, where; the buyer named when different from the user
- [ ] Today's process written as steps, with where it hurts
- [ ] Every requested feature traced to a need in the user's words; evidence level on each (`observed`, `told`, `hunch`)
- [ ] First release serves one opportunity completely; others listed as next or later
- [ ] The two or three riskiest assumptions have a small test with a count-based pass mark; nothing is called validated
- [ ] Measurement plan names only the events the outcome needs; a date for the first impact review

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
- [ ] Every screen has a plan (purpose, one primary action, ranked content, states) and a gallery page
- [ ] Every screen in the core loop has loading, empty and error states

## Launch-ready product
- [ ] Go-live data pack requested from Bill ([../intake/GO_LIVE_DATA_PACK_TEMPLATE.md](../intake/GO_LIVE_DATA_PACK_TEMPLATE.md))
- [ ] Design review verdict PASS for every screen ([design-review.md](design-review.md)), by an agent that did not build it
- [ ] Copy reviewed: plain words, no jargon, errors say what to do
- [ ] A new user can complete the core loop without training (test with someone who hasn't seen it)
- [ ] `PRODUCT.md` matches what is actually built
