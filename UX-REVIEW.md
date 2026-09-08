# Experience review, 8 September 2026

Baseline: main 9c1a5ca. Production tested at the public Health alias, desktop 1365x900 and mobile 390x844. Historical PASS reports are not acceptance evidence for this review.

## Observed priorities

- P0: `.shell aside` styles make Live Understanding a narrow desktop strip and fixed mobile overlay; mobile hides actual assertions and corrections.
- P0: Today places three long-range strategy recommendations before any completable action. A first screen cannot answer what to execute. Score is optimistically approximated with equal weights, so it can disagree with the engine.
- P0: Strategic traces claim action-to-metric causality without a stored link. Baselines are labelled current; a draft can be the primary route. Open focus dims every other stage, not a relevant path.
- P1: Active Health opens a maintenance interview with a multi-line giant question before the current plan. The actual strategy is several screens away.
- P1: Alignment repeats the Health destination three times and repeats the operating-loop explanation. Undefined areas are presented as failures rather than optional decisions.
- P1: Check-in uses a large header and score before input; empty answers advance to a false 'all signals recorded' state; decimal values change by whole units; text metrics use numeric steppers; there is no recoverable save error.
- P1: Weekly Review mixes the current week's numbers with an older cached AI answer, visibly contradicting the strongest area. The persisted deterministic recommendation is not shown.
- P1: Dashboard has undated, non-interactive score bars and no link to actual goal trajectory. A zero daily score is presented as a life verdict.
- P1: Generic dialog lacks focus containment/Escape. Corrections remove assertions without visible failure or semantic context. Alignment claims an answer is saved even after network failures.
- P2: Motion runs for static cards and previously completed actions; broad CSS selectors and repeated overrides produce inconsistent states.

## Scope

Simplify the current surfaces, derive explanations from existing relationships, use existing mutations, and verify real flows against an isolated local PostgreSQL database. No schema, runtime-model or integration change. Test data remains local. Production acceptance uses the public alias only.

## Verified changes and evidence

- Today leads with at most three executable actions. Immediate completion feedback is optimistic; score updates use the server calculation, not equal-weight guesses. An actual local database outage proved rollback and visible recovery. Rapid double taps produced one task, habit and supplement record. Refresh reproduced the saved state.
- Check-in supports rating, text, boolean and precision-aware numeric controls. Three entered values and one skipped value produced exactly three database entries. A browser-discovered before/after-score regression was corrected and retested: 97 -> 100. An unchanged-value save correctly reports no score change.
- Historical days show persisted completion records and snapshot scores, not today's configuration projected backwards. A stored 75/100 historical snapshot remained unchanged during current-day tests.
- Health starts with the current observation, desired state, qualified trajectory and next milestone. The strategic spine opens an accessible sheet with actual relationships; shared-objective membership is never presented as proven causation.
- Alignment retains a stable logical turn identity. One offline browser double-submit produced one user message, one assistant message and one new assertion. A correction retained the old assertion as inactive and appended correction history. Refresh retained the question and understanding.
- A genuine existing approval-boundary defect was fixed: generating a replacement previously edited the active strategy. Generation now persists a proposal without altering existing strategy data; explicit acceptance uses one transaction, records a revision, retains old checkpoints and actions, and updates the primary binding. A browser double acceptance produced exactly one revision and one active primary binding. The live production database was not used.
- Weekly Review reads only the current week's cached interpretation, surfaces the deterministic recommendation, saves reflection visibly, and distinguishes absent evidence from proven neglect. Weekly numeric movement now respects configured direction and the current-week window instead of treating every increase as improvement.
- Advanced configuration remains available, its forms remain intact, and the local metric editor was opened and saved at 390px.
- Native modal semantics supply Escape, background isolation and return focus. Roving keyboard navigation was tested between overview/refinement tabs. Reduced-motion overrides disable animation and transitions; no continuous decorative animation remains on the working surfaces.

## Verification scope

The initial audit used the public Health production URL. All writes in this review were against an isolated local PostgreSQL database and a clearly identified QA account. The final browser pass used an optimized local production build at 1365x900 and exactly 390x844.

OpenAI transport was mocked outside the repository. Four explicit offline transport attempts covered an Alignment turn, a pathway proposal, a forced Ask failure and its successful retry. No live OpenAI request was made. Navigating, opening relationship/understanding sheets, corrections, completing tasks, saving check-in, refreshing, and reopening the saved review added zero transport requests.

These are engineering and expert UX checks, not an independent user study, physical-phone keyboard test or comprehensive assistive-technology certification. Existing live-model behavior was preserved, not re-certified.

Quality gates: typecheck PASS; lint PASS; 54 tests in 12 files PASS; production build PASS. Shared first-load JavaScript: 103 kB. No dependencies, Prisma schema or runtime-model configuration were changed. Runtime logs contain no unexpected application errors; controlled failure responses were expected. The local Node runtime reports its existing url.parse deprecation warning.

## Delivery

Implementation is preserved as an uncommitted Health-only worktree. This review does not deploy or change production infrastructure. Test secrets and the offline transport mechanism are excluded from the deliverable. Browser evidence is stored separately from application source.

The next useful evidence is longitudinal daily use: whether the prioritised actions are genuinely the right few actions, whether users understand/act on uncertainty, and how often they correct the model. Another speculative feature pass cannot establish those facts.
