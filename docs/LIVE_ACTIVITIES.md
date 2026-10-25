# iOS Live Activities — feasibility and phase 3 spec

## Verdict
| Question | Answer |
| --- | --- |
| Can the SHIFTY PWA show a Live Activity or Dynamic Island timer on iPhone? | **No.** ActivityKit is a native API; Safari and home-screen PWAs have no web API for it. SHIFTY does not fake one. |
| Can web push give a continuously running lock-screen countdown? | **No.** A web push is a one-off notification; it cannot update itself every second. |
| What the PWA does instead (phase 1, shipped) | Live timer inside the app (computed from timestamps, correct after any sleep), opt-in milestone/rest notifications while the app is open or recently open, the app badge where the Badging API exists. Labelled in Settings as *not* a Live Activity. |
| Can a native companion show one for a 16 h shift? | Partly. Apple keeps a Live Activity **active for up to 8 hours**, then the system ends it; an ended activity can stay on the Lock Screen for **up to 4 more hours** (static, not updating). One activity cannot cover a 16 h shift. |

## Phase 3: thin native companion (spec)
| Part | Detail |
| --- | --- |
| App | SwiftUI iPhone app "SHIFTY Live", sign-in with the same Supabase account (only once SHIFTY's Supabase project exists). Reads/writes through the same `/api/sync/*` contract — no second rules engine; clock actions post the same events with device UUIDs. |
| Widget extension | WidgetKit + ActivityKit `ActivityAttributes`: `sessionId`, `startedAt`, `goalSeconds`; `ContentState`: `status` (working / on break), `netBeforeCurrentSegmentMs`, `currentSegmentStartedAt`, `breakStartedAt?`, `segment` (1, 2…). |
| Timer rendering | `Text(timerInterval: currentSegmentStartedAt...distantFuture, countsDown: false)` offset by `netBeforeCurrentSegmentMs`, so the OS animates seconds without updates. Breaks: a push (or app action) swaps the state to "On break since 02:00" and freezes net. |
| Updates | ActivityKit push tokens registered with the server; the server sends an APNs `liveactivity` push on break start/end and clock-out (`event: end`, dismissal policy "after 1 h"). Needs an Apple Developer account, APNs key (`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY` as server secrets) and a push sender job. |
| 16 h continuation | Segment 1 starts at clock-in. At ~7 h 50 m the server ends segment 1 and starts segment 2 with a **push-to-start** token (iOS 17.2+), state `segment: 2`, still showing total net since clock-in. Segment 2 covers to ~15 h 40 m, segment 3 beyond. The person gets a quiet notification "Your shift continues — Live Activity renewed" so the swap is explicit. |
| Honesty rules | Never promise uninterrupted 16 h presence: the system can throttle push-to-start, the person can dismiss it, Low Power Mode and Focus affect it. The in-app timer stays the source of truth; the Live Activity is a mirror. |
| Must be proven on a device before claiming | Push-to-start reliability at 8 h boundaries; behaviour across a reboot; Lock Screen after the 4 h retention; Dynamic Island compact/minimal layouts; break updates within 1–2 s; APNs budget for ~6 updates per shift. |
| Distribution | TestFlight first (Bill's device). App Store review needs the app to do more than wrap a website: native clock in/out + Live Activity qualifies, but decide later. |

## Android
Chrome PWAs can show notifications (when permitted) but no persistent ongoing-timer notification from the web; a native Android foreground-service notification would be the equivalent. Feature-detected and degraded gracefully in phase 1.
