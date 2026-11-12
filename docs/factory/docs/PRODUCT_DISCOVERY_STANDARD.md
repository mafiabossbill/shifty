# Product discovery standard

What must be known and written down before a screen is designed, and what is measured after it ships.
Applies to phases 0–2 (brief, blueprint, plan) and to every post-launch change. Design itself: [UI_UX_STANDARD.md](UI_UX_STANDARD.md).
Sources: *Continuous Discovery Habits* (CDH), *UX for Business* (UXB), *Designing Interfaces* (DI). Tags: **[U]** universal · **[P]** preferred default.

## 1. The rule that keeps this fast [U]
Discovery never stops the build. An unknown is written down with its evidence and the smallest test that would settle it, and work
continues on the best current answer. Bill is asked only what changes behaviour, architecture, security, money or irreversible
infrastructure (unchanged). What changes is that nothing is silently assumed, and nothing is called proven that was not tested.

## 2. Words
| Word | Meaning |
| --- | --- |
| Value | A user need and a business need met in the same act. User first, always both (UXB) |
| Output / outcome | The thing shipped / the change in what people do because of it. Success is the outcome (CDH) |
| Product outcome | A number the app itself can move (invoices sent the same day, checks completed on site) |
| Business result | What the company gets (revenue, cost, time). Slow to move, moved by many things |
| Opportunity | A need, pain or wish of the user, in their words. Never a feature |
| Assumption | Something that must be true for the plan to work |
| Evidence level | `observed` (seen in use or in data) · `told` (a customer said it) · `hunch` (the owner or an agent believes it) |
| Buyer / user | Who pays / who uses it. Often different people in a business app; a company is never a user (UXB) |

## 3. What the brief must answer
The brief template carries these questions ([../intake/PRODUCT_BRIEF_TEMPLATE.md](../intake/PRODUCT_BRIEF_TEMPLATE.md)). A blank takes the default and becomes an assumption at evidence level `hunch`.

| Question | Why it is asked |
| --- | --- |
| Who uses it, in which role, how often (daily, weekly, once)? Who pays? | Daily users need speed and density; rare users need guidance. Buyer and user want different things (DI, UXB) |
| What do they do today instead, step by step? Where does it hurt, and what do they keep in private spreadsheets or chats? | The app replaces a real process; the pain points are the opportunities (CDH, UXB) |
| One real, recent example: the last time this happened | People describe what they did far more truthfully than what they usually do or would do (CDH) |
| What should change if this works? One number | The product outcome. No number yet = a learning goal: get a baseline first (CDH) |
| What must not get worse? | Health metrics, so a win in one place is not paid for in another (CDH) |
| How does the business gain? | Decides what to measure and which actions matter most (UXB) |
| How do you know? | Sets the evidence level of everything above |
| Who can we show it to? | 5–10 real users are enough for the small tests in §6 (CDH, UXB) |

## 4. What the blueprint must record
In `factory/PRODUCT_BLUEPRINT.md` § Outcome and evidence ([template](../intake/PRODUCT_BLUEPRINT_TEMPLATE.md)).

- [ ] **Outcome:** one product outcome with unit, period and baseline (or "learning goal"), the business result it should drive, the health metrics.
- [ ] **People:** each role with frequency of use, skill, device and place of use; buyer named separately when different.
- [ ] **Today:** the current process as numbered steps, off-path steps included, each marked `observed`, `told` or `hunch`.
- [ ] **Opportunities:** each a need in the user's words, with its evidence level. One is chosen for the first release; the others are listed as next or later with the reason.
- [ ] **Value moments:** the one or few moments where the user gets what they came for. The plan is worked backward from each: what must be true just before, and before that (UXB).
- [ ] **Alternatives:** for the part that makes this product different, three clearly different ways to serve the chosen opportunity and why one leads. Standard parts (sign-in, settings, plain lists) use the standard pattern and need no alternatives (CDH).
- [ ] **Assumptions:** typed, with evidence level, importance, and for the riskiest two or three a test (§6).
- [ ] **Harm check:** what data is collected and who else sees it; who is excluded; how it could be abused or gamed (CDH, UXB).
- [ ] **Measurement plan:** §7.
- [ ] **Screen plans and flow plans:** [UI_UX_STANDARD.md](UI_UX_STANDARD.md) §2.

## 5. Rules for turning a brief into a plan
| # | Rule | Source |
| --- | --- | --- |
| 1 | Turn every requested feature into the need behind it. Test: is there more than one way to meet it? If not, it is still a feature; ask what it would do for the user and record that | CDH |
| 2 | An outcome that names something shipped ("launch reports") is an output. Ask what would change for the user once it exists | CDH |
| 3 | Decide between alternatives, never "build it or not" | CDH |
| 4 | The first release solves one opportunity completely rather than several partly | CDH |
| 5 | Build the smallest version that delivers both the user's value and the business's | UXB |
| 6 | Ask "why" behind each request until the real goal shows, and delete every form, field and step that goal does not need. Nobody's goal is to fill in a form | DI |
| 7 | The builder is not the user. Words, categories and order come from the users' work, not from the database or the org chart | DI, UXB |
| 8 | Efficiency tools are judged by time, cost and errors per task. Time spent in the app is a warning sign, not a goal | UXB |
| 9 | Say "evidence for" and "evidence against". Never "validated" | CDH |
| 10 | Ideas that belong to another opportunity are parked in the blueprint, not dropped and not built | CDH |
| 11 | Never show a control for something that is not built | RUI |

## 6. Assumptions and small tests
| Type | Question |
| --- | --- |
| Desirability | Do they want it, and will they do what it asks of them? |
| Usability | Can they find it, understand it and finish? |
| Feasibility | Can it be built, and do law, security and regulation allow it? |
| Viability | Does it pay back what it costs to build and run? |
| Ethical | Could it harm someone, exclude someone, or be abused? |

- [ ] Each assumption is one sentence that must be true, specific enough to be wrong.
- [ ] Ranked by two things: how weak the evidence is, and how badly the plan fails if it is false. The top two or three go to Bill; the rest stay in the log.
- [ ] Each of those carries the smallest test Bill can run in a day or two: show one moment of the product (a screen in the design gallery, a mock, a message) to 5–10 people who have the need.
- [ ] The pass mark is a count fixed before the test ("at least 3 of 8 enter the amount without help"), and it counts what people did, not what they said they would do.
- [ ] Testing stops when the remaining risk is acceptable or the next test costs as much as building. Most assumptions are never tested.

## 7. Measurement plan
- [ ] Record only the events the outcome and the tests need. No blanket tracking.
- [ ] For each event say whether people or actions are counted: people show how many succeed, actions show how hard each had to work.
- [ ] Flows are measured step by step; the step that loses the most people is the first thing to fix.
- [ ] Fewer than a few hundred users: measure the business result (time per task, errors, support questions, output per person), not analytics.
- [ ] A metric is named without a promised uplift. Targets come after a baseline exists.
- [ ] A date for the first impact review is set at release. A passed test is not success; the outcome moving is.

## 8. After launch
1. Keep a dated log of symptoms: support questions, errors, steps where people stop, requests.
2. Group them, write the likeliest cause of each group, and ship the change that tests the top cause with a stated prediction.
3. When the numbers contradict the plan, revise the understanding of the opportunity first, then the screen.

## 9. What only Bill can do
| Habit | How |
| --- | --- |
| One user conversation a week | Five minutes at the end of a call counts. Ask "Tell me about the last time you…", then "what happened next?" and "what got in the way?". Do not ask what they want or would do |
| One snapshot per conversation | Who, one sentence they said, the story as steps, the needs in their words. Hand it to the orchestrator; it goes into the blueprint as `told` evidence |
| Small tests | Show the screen to 5–10 users and count against the pass mark |
| Impact review | On the date set at release: did the number move? |

## 10. Never
A feature list as the plan · an outcome that is an output · one option where a choice was possible · "validated" · questions about the
future as evidence · engagement as the goal of a work tool · tracking everything · a promised uplift before a baseline · a control for
something that does not exist · designing by vote or by copying a competitor.
