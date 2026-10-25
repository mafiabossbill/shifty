# PRODUCT.md — <App name>

> Product source of truth inside the app repo. Updated by every PR that changes behaviour.

## One sentence
<Who uses it, to do what, instead of what.>

## Users and roles
| Role | Who | Can (capabilities) | Home page | Signs in? |
| --- | --- | --- | --- | --- |

## Core rules (never break; enforced in the database)
| Id | Rule | Enforced in | Test |
| --- | --- | --- | --- |
| R01 | | database / api / ui | |

## Entities
| Entity | Table | Key fields | Owner | Lifecycle / statuses | Deletion |
| --- | --- | --- | --- | --- | --- |

## Flows
### F01 <core loop> (core)
1.

## Screens
| Route | Purpose | Roles | Primary action | Phone layout |
| --- | --- | --- | --- | --- |

## Notifications and messages
| Event | Who | Channel (in-app / push / email / WhatsApp) | When |
| --- | --- | --- | --- |

## Integrations
| Provider | Purpose | Direction | Credentials (names) | Status (planned/mock/live) |
| --- | --- | --- | --- | --- |

## Scheduled jobs
| Job | Schedule (org timezone) | Purpose | Idempotency key |
| --- | --- | --- | --- |

## Non-functional
| Topic | Requirement |
| --- | --- |
| Locale | timezone, currency (+ decimals), language, week start |
| Devices | phone / tablet / desktop share |
| Offline | none / offline page / read cache / offline queue |
| Data volume | rows per main entity in year one |
| Retention / deletion | |

## Out of scope (for now)
-

## Assumptions
| Id | Assumption | Status (assumed / confirmed / replaced) |
| --- | --- | --- |
