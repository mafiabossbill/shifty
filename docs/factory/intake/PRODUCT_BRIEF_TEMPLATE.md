# Product brief — <name>

> Fill what you know; leave the rest. The orchestrator turns every gap into a **recorded assumption** (right column)
> and only asks Bill when the answer changes product behaviour, architecture, security, money or irreversible infrastructure.

| Question | Bill's answer | If blank, assume |
| --- | --- | --- |
| What is it, in one sentence? | | — (required: the only thing we always need) |
| Who uses it? (roles, rough numbers, how often: daily, weekly, once) Who pays? | | One admin + members, daily; managers read-only if mentioned; the company pays |
| What do they do today instead, step by step? Where does it hurt? | | The process implied by the one sentence, marked as a hunch |
| One real, recent example: the last time this happened | | None yet; Bill is asked for one story when convenient (does not block) |
| What should change if this works? (one number) | | Learning goal: the core loop completed weekly by each role; baseline unknown |
| What must not get worse? | | Time per task and error rate |
| How do you know? (customers you talked to, data, or a hunch) | | A hunch |
| Who can we show it to? (5–10 real users) | | Bill only |
| What do they do every day in it? (the core loop) | | The loop implied by the sentence above |
| What must never go wrong? (the one rule) | | Nothing is lost; every change is attributable (audit log) |
| What data exists today? (spreadsheets, systems) | | CSV import of the main entity |
| Phones or desktop? Network quality? | | Desktop and phone; good network |
| Installable app / offline needed? | | PWA on, offline page only |
| Messages to people? (WhatsApp, email, push) | | In-app notifications only |
| Payments or money? Currency? | | No payments; company currency, no decimals if the currency has none |
| Company timezone and language | | Company location's IANA zone; English |
| Integrations with other systems | | None in the first release |
| Who are the admins? (emails) | | Bill (`ADMIN_EMAIL`) |
| Domain | | A subdomain of the company domain, added at launch |
| One company or many customers? (tenancy) | | One company (company tenancy); SaaS self-serve only if customers sign up themselves |
| Signatures or legal sign-off? | | None; if yes: signer, what is signed, immutability, retention |
| Must it work without network? | | No (offline page only); if yes: what must work offline and for how long |
| Brand (logo, color) | | Neutral UI with one accent color from the logo |
| Deadline / first release scope | | Useful core in production, then waves |
| Anything you dislike or want copied? | | Doctrine §15 and §39 |

## Assumptions (filled by the orchestrator; rules in `docs/PRODUCT_DISCOVERY_STANDARD.md` §6)
| Id | Assumption (must be true) | Type | Evidence | Impact | Needs Bill? | Status |
| --- | --- | --- | --- | --- | --- | --- |
| A01 | | desirability / usability / feasibility / viability / ethical | observed / told / hunch | low/medium/high | yes/no | assumed |

## Questions for Bill (only blocking ones, one message)
1.
