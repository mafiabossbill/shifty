# Go-live data pack — <company> / <App name>

> What the company provides before launch. Send as one sheet/document; nothing is pasted in chat
> that is a password or secret. Import formats match the app's CSV importers.

## 1. Organization
| Field | Value |
| --- | --- |
| Legal name / display name | |
| Timezone · currency (+ decimals) · week start | |
| Logo (PNG/SVG) and brand color | |
| Domain for the app (e.g. app.company.com) and who controls DNS | |
| Email sending domain (SMTP provider, sender address) | |

## 2. Structure (teams / departments / sites)
| Name | Head (person) | Notes |
| --- | --- | --- |

## 3. People (import sheet)
| Full name | Job title | Work email (optional) | Role | Team | WhatsApp (E.164) | WhatsApp OK (yes/no) | Signs in (yes/no) |
| --- | --- | --- | --- | --- | --- | --- | --- |

## 4. Current work / records (import format of the main entity)
Columns as in the app's import template (download it from Settings → Import). One row per record; current status and owner.

## 5. Workflow decisions
| Question | Decision |
| --- | --- |
| Who can create / edit / approve what? | |
| Which fields are mandatory? | |
| What needs approval? | |
| Escalation (overdue, blocked) | |

## 6. Reporting and messages
| Report | Who gets it | Channel | Days and time |
| --- | --- | --- | --- |

## 7. Legal (fills `src/lib/legal.ts`; `npm run legal:check` must pass)
| Field | Value |
| --- | --- |
| Legal entity that runs the app (operator) | |
| Registered address | |
| Privacy contact email (a monitored inbox) | |
| Governing law / country | |
| Data protection regulator | |
| Effective date of the policies | |
| Supabase project region; any other processors (email, SMS, payments, analytics) | |
| Retention: server logs, backups, days to finish a deletion request | |
| Paid plans? (adds pricing and refund terms to `/terms`) | |

## 8. Launch
| Item | Owner | Done |
| --- | --- | --- |
| Demo and test data removed (seeded rows, test accounts) | release-engineer | |
| Admins confirmed (`ADMIN_EMAIL` first) | | |
| People invited or created | | |
| Training: 10-minute walkthrough per role | | |
| First-week feedback channel (e.g. feedback register) | | |
