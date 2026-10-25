# MANUAL CHECKS — SHIFTY

> Read by `scripts/release preflight`: every box must be ticked for the release candidate (commit the ticked
> file with the release; untick them again after the release). Add product-specific checks below the line.

- [ ] Preview opened at 375, 430, tablet (768/1024) and desktop (1280), light and dark: no sideways scroll, 44px targets, 16px inputs
- [ ] Every flow changed in this release tried by hand on the preview, for each affected role
- [ ] Installed PWA opened on a phone (if PWA is on): launches, safe areas right, offline page shows offline
- [ ] Rollback known: the previous Vercel deployment to promote is identified; migrations are forward-only and a fix-forward plan exists
- [ ] Integrations touched by this release tested live (or explicitly listed as mock-only in the release note)

---
<!-- Product-specific checks, e.g. "Stripe live webhook endpoint receives a test event" -->
