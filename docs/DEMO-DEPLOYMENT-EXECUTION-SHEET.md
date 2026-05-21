# PhantomWall Deployment Execution Sheet (V2)

> Use this sheet during release validation.
> Fill one line per test item as you execute.

## Release Metadata

- Release Name: ____________________
- Commit SHA: ____________________
- Environment: dev / staging / prod
- Tester: ____________________
- Date: ____________________
- Browser/OS: ____________________

---

## Status Key

- `PASS` = Works as expected
- `FAIL` = Broken or incorrect behavior
- `N/A` = Not applicable for this release

Severity:
- `P0` demo blocker
- `P1` major issue
- `P2` minor issue

---

## Test Log Template (Copy This Block Per Test)

```text
ID:
Page/Area:
Test Case:
Expected:
Actual:
Status: PASS / FAIL / N/A
Severity: P0 / P1 / P2
Owner:
ETA:
Evidence (screenshot/video/log):
Notes:
```

---

## 1) Pre-Flight Gate

### Critical checks
- [ ] API base URL points to deployed environment
- [ ] `/events`, `/metrics`, `/fleet/instances`, `/costs` return valid responses
- [ ] WebSocket (if enabled) connects
- [ ] No blocking console/runtime errors
- [ ] Core AWS services healthy (Lambda, API GW, WAF)

Execution log:
- ID: PF-01 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- ID: PF-02 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- ID: PF-03 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____

---

## 2) Command Center

Test IDs:
- CC-01: KPI cards load real values
- CC-02: Navigation shortcuts route correctly
- CC-03: Quick actions work
- CC-04: Page remains stable after refresh

Execution log:
- CC-01 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- CC-02 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- CC-03 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- CC-04 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____

---

## 3) Traffic Ledger

Test IDs:
- TL-01: Events list loads
- TL-02: Filters/search work
- TL-03: Expand/details work
- TL-04: Block Source IP action works
- TL-05: Throttle Source action works
- TL-06: Create Incident action works
- TL-07: Buttons show busy state
- TL-08: CSV export works

Execution log:
- TL-01 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- TL-02 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- TL-03 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- TL-04 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- TL-05 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- TL-06 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- TL-07 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- TL-08 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____

---

## 4) Alerts & Investigation

Test IDs:
- AL-01: Alerts load + refresh
- AL-02: Severity/type filters work
- AL-03: Expand/detail works
- AL-04: Block IP in WAF works
- AL-05: Escalate to SOC queue works
- AL-06: Create incident ticket works
- AL-07: Side panels populate correctly

Execution log:
- AL-01 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- AL-02 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- AL-03 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- AL-04 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- AL-05 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- AL-06 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- AL-07 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____

---

## 5) Fleet Manager

Test IDs:
- FM-01: Fleet data loads in table/card views
- FM-02: Start/Stop/Reboot work
- FM-03: Destroy works in both views
- FM-04: Deploy modal works for implemented profiles
- FM-05: Non-implemented profiles blocked/labelled
- FM-06: WAF/rate/geo controls work

Execution log:
- FM-01 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- FM-02 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- FM-03 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- FM-04 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- FM-05 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- FM-06 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____

---

## 6) S3 Log Archive

Test IDs:
- S3-01: Queries return data
- S3-02: Filters apply correctly
- S3-03: Reset filters works
- S3-04: Replay history works
- S3-05: Summary cards align with query result
- S3-06: CSV export works

Execution log:
- S3-01 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- S3-02 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- S3-03 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- S3-04 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- S3-05 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- S3-06 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____

---

## 7) Intel & Analytics

Test IDs:
- IA-01: /events + /metrics load (or partial-data handled cleanly)
- IA-02: KPI cards render real values
- IA-03: Charts render correctly
- IA-04: Map renders and markers show
- IA-05: Range controls work
- IA-06: Auto-refresh timer works
- IA-07: Map tile provider setting reflects
- IA-08: CSV export works

Execution log:
- IA-01 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- IA-02 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- IA-03 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- IA-04 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- IA-05 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- IA-06 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- IA-07 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- IA-08 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____

---

## 8) Cloud Posture

Test IDs:
- CP-01: Security scan runs + updates health
- CP-02: Compliance sections render
- CP-03: Lambda/S3/IAM sections accurate
- CP-04: Cost source clearly shows Live vs Fallback
- CP-05: Live tag-scoped cost handles valid $0.00 correctly

Execution log:
- CP-01 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- CP-02 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- CP-03 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- CP-04 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- CP-05 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____

---

## 9) Settings (Tab-by-Tab)

Test IDs:
- ST-01: Profile values persist and display
- ST-02: Notification toggles persist
- ST-03: API test reports endpoint/path/latency
- ST-04: Appearance controls apply where implemented
- ST-05: Data settings persist + auto-refresh affects Intel
- ST-06: Session timeout lock works
- ST-07: Audit logging toggle behavior correct
- ST-08: About metadata accurate

Execution log:
- ST-01 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- ST-02 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- ST-03 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- ST-04 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- ST-05 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- ST-06 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- ST-07 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____
- ST-08 | Status: ____ | Severity: ____ | Owner: ____ | ETA: ____

---

## 10) Demo Script Validation (8-12 min)

- [ ] Command Center overview
- [ ] Traffic response action
- [ ] Alerts escalation action
- [ ] Fleet control action
- [ ] S3 query + export
- [ ] Intel live metrics + map
- [ ] Cloud Posture cost source explanation
- [ ] Settings persistence + session timeout proof

Result: PASS / FAIL
Notes:
- 

---

## 11) Defect Tracker

```text
ID | Area | Summary | Severity | Repro Steps | Owner | ETA | Status
---|------|---------|----------|------------|-------|-----|-------
```

---

## 12) Deployment Gate

- Total Passed: ______
- Total Failed: ______
- P0 Open: ______
- P1 Open: ______

Decision:
- [ ] GO to demo deployment
- [ ] HOLD (fix blockers)

Approvals:
- QA Owner: ____________________
- Engineering Owner: ____________________
- Date: ____________________
