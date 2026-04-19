# EduGuard Mutual Exclusion and Anti-Exploitation Implementation Plan

Date: 2026-04-19

## 1) Problem focus

We need to prevent and detect exploit patterns in user scheme participation, especially:
- Mutual exclusion violations (example: NLY and NSVSY together)
- Eligibility bypasses
- Concurrent opt-in race conditions
- Rule drift between admin-edited rules, detector rules, and user enrollment checks

## 2) Current state summary

What is already good:
- Cross-scheme anomaly detection exists in detectors and risk scoring.
- Admin can edit scheme rules including mutual exclusions.
- User now has opt-in/opt-out endpoints and dashboard controls.

What is missing or inconsistent:
- Rules are split across multiple schemas and key names.
- User opt-in flow does not enforce mutual exclusions yet.
- Detector rule loading and admin rule editing are not fully aligned.
- Test coverage for exploit paths is minimal.

## 3) Target architecture

Single policy source + dual control model:
- Preventive control: block invalid opt-ins at write time.
- Detective control: continue flagging suspicious payment patterns from ledger.

Policy model (canonical):
- scheme_id
- status
- eligibility_rules
- mutual_exclusions
- priority
- effective_from / effective_to
- version

All consumers must use one policy loader/service:
- User enrollment endpoints
- Eligibility listing endpoint
- Detector (cross scheme)
- Admin rules update endpoint

## 4) Phased implementation

### Phase 0: Baseline and schema unification (P0)

Tasks:
- Create a policy adapter that maps legacy keys to canonical keys.
- Standardize on scheme_id and mutual_exclusions in runtime logic.
- Add a startup validation check that fails fast on malformed policy docs.

Deliverables:
- policy_service module with read + normalize + validate.
- Validation logs and health signal.

Exit criteria:
- All endpoints and detector code paths resolve rules through policy_service.

### Phase 1: Enrollment hardening and mutual exclusion enforcement (P0)

Tasks:
- On opt-in, enforce:
  - scheme status is ACTIVE
  - user is eligible
  - no conflict with already opted-in schemes
  - no conflict with historically active/paid schemes from payment_ledger (as business rule)
- Return structured errors with blocked_by list and reason codes.
- Add idempotency handling for repeated opt-in requests.

Data/transaction design:
- Atomic conditional update using findOneAndUpdate with conflict preconditions.
- Add unique/index strategy where needed for enrollment records.

Exit criteria:
- No user can hold mutually exclusive schemes through the API.

### Phase 2: Exploitation controls and abuse resistance (P1)

Tasks:
- Add server-side rate limits for opt-in/opt-out endpoints.
- Add audit trail collection for scheme preference changes:
  - user_id, action, scheme_id, before, after, source_ip, user_agent, timestamp
- Add cooldown rules for rapid toggle abuse (optional business rule).
- Add role-bound checks for any privileged scheme update routes.

Exit criteria:
- Every preference change is attributable and replay-resistant.

### Phase 3: Detector alignment and stronger analytics (P1)

Tasks:
- Update cross-scheme detector to read canonical policy via policy_service.
- Include mutual exclusion version in evidence_data for traceability.
- Add detector unit tests for:
  - policy from DB
  - policy fallback
  - symmetric exclusion handling

Exit criteria:
- Detector and enrollment checks use the same mutual exclusion set.

### Phase 4: Frontend contract and UX resilience (P2)

Tasks:
- Show blocking reasons in scheme management UI (not generic failures).
- Show conflict warnings before user confirms opt-in.
- Add optimistic update rollback handling for concurrent conflict responses.

Exit criteria:
- User always gets clear and actionable conflict messages.

### Phase 5: Test strategy and rollout (P0)

Test matrix:
- Unit:
  - policy normalization
  - eligibility evaluation
  - mutual exclusion conflict resolver
- API integration:
  - opt-in success
  - opt-in blocked by conflict
  - concurrent opt-in attempts
  - opt-out idempotency
- Security:
  - unauthorized role access
  - rate-limit behavior
  - malformed payload handling
- Regression:
  - analysis run still detects cross-scheme on payment ledger

Rollout:
- Feature flag new policy enforcement.
- Dry run mode for 1 sprint (log-only blocks).
- Enable hard-block after false-positive review.

## 5) Suggested priority backlog

P0:
1. Build policy_service and replace direct rule reads.
2. Enforce mutual exclusions in opt-in endpoint with atomic checks.
3. Add integration tests for all opt-in/opt-out conflict paths.

P1:
1. Add audit trail and rate limiting.
2. Align detector input with canonical policy service.
3. Add rule versioning in evidence output.

P2:
1. Improve UI conflict messaging and pre-check hints.
2. Add admin policy simulation mode (what-if impact by district).

## 6) Acceptance criteria

- Mutual exclusions are enforced at write time for all user opt-ins.
- Admin-updated exclusions immediately affect enrollment and detector behavior.
- Conflicting opt-ins are impossible even under concurrent requests.
- Every scheme preference change is auditable.
- Test suite includes exploit and race-condition cases.

## 7) Risks and mitigations

Risk: legacy data with conflicting enrollments.
Mitigation: one-time migration job to detect and mark conflicts; notify admins.

Risk: policy drift from multiple data sources.
Mitigation: canonical policy service + startup validation + strict schema checks.

Risk: false positives from strict exclusions.
Mitigation: staged rollout with dry-run logs and admin override workflow.
