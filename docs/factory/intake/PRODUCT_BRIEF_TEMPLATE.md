# Product brief — <name>

> Fill what you know; leave the rest. The orchestrator turns every gap into a **recorded assumption** (right column)
> and only asks Bill when the answer changes product behaviour, architecture, security, money or irreversible infrastructure.

| Question | Bill's answer | If blank, assume |
| --- | --- | --- |
| What is it, in one sentence? | | — (required: the only thing we always need) |
| Who uses it? (roles, rough numbers) | | One admin + members; managers read-only if mentioned |
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

## Assumptions (filled by the orchestrator)
| Id | Assumption | Impact | Needs Bill? | Status |
| --- | --- | --- | --- | --- |
| A01 | | low/medium/high | yes/no | assumed |

## Questions for Bill (only blocking ones, one message)
1.
