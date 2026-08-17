---
name: brutepawa.com domain split
description: brutepawa.com pointed at an OLD separate deployment, not this repl's deployment
---
When the user reports "prod is stale" for BrutePawa, first check WHICH domain they browse.
**Why:** In Aug 2026, `brutepawa.com` served a June-era bundle with a broken API while `brutepawa-jeanmarcjpadme.replit.app` (this repl's deployment, per getDeploymentInfo) was fully up to date. The custom domain was attached to an old deployment/repl (additionalUrls was empty here).
**How to apply:** Compare `curl <domain>/sw.js` cache version against local `artifacts/fblite/public/sw.js` and check `getDeploymentInfo().additionalUrls`. If the custom domain is absent there, it points elsewhere — fix is domain relinking, not code.
