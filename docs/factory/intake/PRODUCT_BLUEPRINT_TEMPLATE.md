# Product blueprint — <App name>

> Written by the product-architect in phase 1 from the brief. The human view of `factory/blueprint.json`.
> The **Machine-readable blueprint** block at the end is the source: `node tools/blueprint-from-md.mjs <this file>`
> extracts it and `node tools/validate-blueprints.mjs` checks it against `intake/APP_BLUEPRINT.schema.json`.

## 1. Product
| Field | Value |
| --- | --- |
| One-liner | |
| Users | segment · count · devices · network |
| Core loop | |
| First release scope | |

## 1b. Outcome and evidence ([docs/PRODUCT_DISCOVERY_STANDARD.md](../docs/PRODUCT_DISCOVERY_STANDARD.md) §4)
| Field | Value |
| --- | --- |
| Product outcome | number · unit · period · baseline (or "learning goal") |
| Business result it should drive | |
| Must not get worse | |
| Buyer / users | who pays · each role: how often, skill, device, where |

| Today (step) | What happens | Where it hurts | Evidence |
| --- | --- | --- | --- |
| 1 | | | observed / told / hunch |

| Opportunity (a need, in the user's words) | Evidence | First release, next, or later | Why |
| --- | --- | --- | --- |

| Value moment | What must be true just before it |
| --- | --- |

| Alternative considered (only for what makes this product different) | Why it leads or lost |
| --- | --- |

| Riskiest assumptions | Type | Smallest test Bill can run | Pass mark (a count, fixed now) |
| --- | --- | --- | --- |

| Measured | People or actions | Where it is recorded |
| --- | --- | --- |

Harm check: data collected and who else sees it · who is excluded · how it could be abused.
First impact review: <date set at release>. Parked ideas: <list>.

## 2. Roles
| Role | Capabilities | Home | Signs in |
| --- | --- | --- | --- |

## 3. Entities and rules
| Entity | Table | Tenant | Deletion | Audit | Key fields |
| --- | --- | --- | --- | --- | --- |

| Rule | Statement | Enforced in | Test |
| --- | --- | --- | --- |

## 4. Flows and screens
| Flow | Steps | Roles | Core |
| --- | --- | --- | --- |

Screen plans (ux-architect, before feature lanes start; [docs/UI_UX_STANDARD.md](../docs/UI_UX_STANDARD.md) §2.1):

| Route | Purpose (the one thing done here) | Type (overview / focus / make / do) | Roles | Primary action (≤ 1) | Content, ranked 1 · 2 · 3 | Pattern | States | Phone | Next step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 5. Capabilities detected → team
| Capability | Evidence in brief |
| --- | --- |

| Agent | Chosen? | Why |
| --- | --- | --- |

## 6. Platform decisions
| Topic | Decision | Default or deviation |
| --- | --- | --- |
| Stack | nextjs-supabase template | default |
| PWA | | |
| Offline | | |
| Integrations | | |
| Jobs | | |
| Domain | | |

## 7. Assumptions and questions
| Id | Assumption | Impact | Needs Bill |
| --- | --- | --- | --- |

## Machine-readable blueprint
```json
{ "schemaVersion": 1 }
```
