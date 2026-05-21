# PhantomWall Demo Readiness Test Plan

> Purpose: Final pre-deployment testing checklist for demo-stage readiness.
> Owner: ____________________
> Environment: dev / staging / prod (circle one)
> Date: ____________________
> Build/Commit: ____________________

---

## 1) Pre-Flight (Run Before Page Testing)

- [ ] App loads without blank screen or console fatal errors.
- [ ] `VITE_SURICATA_API_URL` points to deployed API.
- [ ] Core APIs respond: `/events`, `/metrics`, `/fleet/instances`, `/costs`.
- [ ] WebSocket connects (if enabled) and live updates appear.
- [ ] No critical browser errors in DevTools Console.
- [ ] IAM, Lambda, API Gateway, and WAF resources are healthy in AWS.

Notes:
- 

---

## 2) Command Center Page

### Functional Checks
- [ ] KPIs load real data (not stuck placeholders).
- [ ] Navigation shortcuts route to correct pages.
- [ ] Any quick actions/buttons execute expected behavior.
- [ ] Refresh/reload preserves app stability.

### UX Checks
- [ ] Layout is readable on laptop viewport.
- [ ] No broken cards, clipped text, or overflow bugs.

Notes:
- **CC-01 to CC-04:** PASS — core Command Center behavior works (KPIs, navigation shortcuts, quick actions, refresh stability).
- **CC-footer-links:** PARTIAL — GitHub link works (`https://github.com/Heero04/phantomwall/tree/main`). Still placeholder (`href="#"`): Privacy Policy, Terms of Service, Website icon, Email icon. Fine for demo if not clicked during walkthrough, or hide/disable before external demo.
- **TODO:** Change laptop icon to GitHub (footer social links).

---

## 3) Traffic Ledger Page

### Data + Live Stream
- [ ] Events list loads from API.
- [ ] Filters/search update results correctly.
- [ ] Event details/expand actions work.

### Response Buttons
- [ ] `Block Source IP` calls WAF API and returns success/failure feedback.
- [ ] `Throttle Source` executes expected flow and logs result.
- [ ] `Create Incident` saves item as expected.
- [ ] Buttons disable while action is in-flight.

### Export/Utility
- [ ] CSV export downloads valid data.
- [ ] Copy-to-clipboard actions work.

Notes:
- 

---

## 4) Alerts & Investigation Page

### Alerts Pipeline
- [ ] Alerts table loads and refreshes.
- [ ] Severity/type filters behave correctly.
- [ ] Alert detail/expand works.

### Response Actions
- [ ] `Block IP in WAF` works and gives clear status.
- [ ] `Escalate to SOC Queue` creates local queue entry.
- [ ] `Create Incident Ticket` creates local incident entry.
- [ ] Busy/loading states prevent duplicate actions.

### Side Panels
- [ ] Severity breakdown reflects table data.
- [ ] Top origins panel populates.
- [ ] SOC Queue panel shows newly added items.

Notes:
- 

---

## 5) Fleet Manager Page

### Fleet Operations
- [ ] Fleet list/card views load instance data.
- [ ] Start/Stop/Reboot actions work and update status.
- [ ] Destroy works in both table and card views.
- [ ] Operation feedback messages are clear.

### Deploy Modal
- [ ] Deploy opens and submits successfully for implemented profiles.
- [ ] Non-implemented profiles are clearly marked and blocked.
- [ ] Validation errors are readable.

### WAF Controls
- [ ] Rate limit toggle works.
- [ ] Geo/rule toggles perform expected API updates.

Notes:
- 

---

## 6) S3 Log Archive Page

### Query + Filters
- [ ] Query returns data from backend.
- [ ] Date/type/IP/protocol filters apply correctly.
- [ ] Reset filters button clears all fields.
- [ ] Replay history reruns query with prior params.

### Data Handling
- [ ] Summary cards reflect queried dataset.
- [ ] Empty state appears correctly when no data.
- [ ] CSV export downloads expected rows.

Notes:
- 

---

## 7) Intel & Analytics Page

### Analytics Data
- [ ] `/events` + `/metrics` both load (or partial-data message appears correctly).
- [ ] KPI cards show real values.
- [ ] Charts render without crashes.

### Map + Controls
- [ ] Map loads and markers display.
- [ ] Range selector updates analytics windows.
- [ ] Auto-refresh countdown works.
- [ ] Map tile provider changes from Settings are reflected.

### Exports
- [ ] Top attackers CSV export works.

Notes:
- 

---

## 8) Cloud Posture Page

### Security/Infra Views
- [ ] Security scan runs and updates health indicators.
- [ ] Compliance sections render all checks.
- [ ] Lambda/S3/IAM tables display expected entries.

### Cost Section
- [ ] Cost source banner clearly shows `Live` vs `Fallback`.
- [ ] Live `/costs` tag-scoped result is shown correctly (including valid `$0.00` case).
- [ ] Tag scope hint is visible and accurate.

Notes:
- 

---

## 9) Settings Page (Tab-by-Tab)

### Profile Tab
- [ ] Display name saves and updates sidebar label.
- [ ] Email/timezone save and persist after refresh.

### Notifications Tab
- [ ] Toggles save and persist.
- [ ] Slack webhook field appears only when Slack toggle is on.

### API & Integrations Tab
- [ ] API test button validates endpoint and reports status/path/latency.
- [ ] Timeout/retry/rate controls save and persist.
- [ ] API key show/hide/generate works.

### Appearance Tab
- [ ] Accent color visibly updates major UI accents.
- [ ] Font size visibly changes across pages.
- [ ] Compact mode visibly tightens spacing.
- [ ] Animations toggle disables transitions/animations.
- [ ] Theme controls clearly indicate what is implemented.

### Data & Retention Tab
- [ ] Auto-refresh interval affects live pages (Intel timer).
- [ ] Cache/export/row limit settings save and persist.

### Security Tab
- [ ] Session timeout lock screen triggers after idle period.
- [ ] Resume session unlocks app.
- [ ] Audit logging toggle controls local audit writes.

### About Tab
- [ ] Build metadata displays correctly (API ID, env, version, counts).

Notes:
- 

---

## 10) Cross-Cutting Demo Readiness Checks

- [ ] Navigation between all pages is smooth.
- [ ] No blocking visual defects on 1366x768 and 1920x1080.
- [ ] No major regressions after hard refresh.
- [ ] Error states are user-readable (not raw stack traces).
- [ ] Loading states exist for async actions.
- [ ] All exports (CSV) produce usable files.
- [ ] No security-sensitive values are unintentionally displayed.

Notes:
- 

---

## 11) Demo Run Script (Fast Pass)

- [ ] Open Command Center (show live overview).
- [ ] Open Traffic Ledger and execute one response action.
- [ ] Open Alerts page and escalate one alert.
- [ ] Open Fleet Manager and demonstrate one control action.
- [ ] Open S3 Log Archive and run one filtered query + export.
- [ ] Open Intel page and show live metrics/map.
- [ ] Open Cloud Posture and show cost source clarity.
- [ ] Open Settings and show persistence + session timeout.

Total target runtime: 8-12 minutes.

---

## 12) Go / No-Go Signoff

- [ ] GO for external demo
- [ ] NO-GO (fix blockers first)

### Blockers (if NO-GO)
1. 
2. 
3. 

### Final Signoff
- QA Owner: ____________________
- Date: ____________________
- Notes: 
