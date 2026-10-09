# Missiq --- Remaining Phases (Low-Credit Build Plan)

**Purpose:** Finish the ProtocolX "The Unread Problem --- What Did I
Miss?" MVP with as few AI-agent calls as practical.

**Project files:** `PRD.md`, `prompt.md`\
**Brand:** Missiq --- "Miss less. Know more."\
**Core constraint:** Private conversations and derived insights must
remain on-device. Do not add cloud AI inference, a backend, analytics,
telemetry, or persistent storage for private conversation data.

## How to use this file

1.  Save this file in the project root beside `PRD.md` and `prompt.md`.
2.  Use one phase prompt at a time in Antigravity.
3.  Before each phase, inspect the workspace and current git/change
    state if available.
4.  Do not ask the agent to repeat work already completed. Each prompt
    requires inspection and continuation.
5.  Let the agent finish the requested phase, run checks, update
    `prompt.md`, and stop.
6.  Run terminal commands yourself when possible; terminal checks
    usually do not consume model credits.
7.  If credits are very low, prioritize Phases 3, 5, and 6. Do not spend
    credits on optional AI models, elaborate animations, or nonessential
    features.

------------------------------------------------------------------------

# Phase 3 --- Resume and finish local analysis engine

**Use this prompt first if Phase 3 was interrupted.**

``` text
MISSIQ — RESUME AND FINISH PHASE 3 (LOW-CREDIT MODE)

Read PRD.md, prompt.md, and this phase's existing code/tests. Inspect the current workspace before editing. Continue from the actual state; do not restart, recreate, or overwrite working code. Avoid broad refactors and unnecessary explanations.

Goal: complete the local deterministic transcript-analysis engine specified in the PRD.

1. Implement only missing requirements for formats F1–F4, multiline messages, normalization/duplicate handling, deadlines, tasks/ownership, decisions vs suggestions, configured-user mentions, announcements/open questions, explainable prioritization, concise rule-based summary, and source references.
2. Reuse `src/types/model.ts` and `src/analysis/sourceRefs.ts`; preserve existing model contracts and validation rules unless a PRD requirement clearly requires a change.
3. Use Appendix A fixtures and acceptance expectations from PRD.md. Do not invent expected results or silently weaken tests.
4. Keep all processing local and in memory. No backend, cloud inference, analytics, telemetry, browser storage, or external transcript transmission.
5. Add focused tests for missing requirements and high-risk edge cases. Do not duplicate tests that already cover correct behavior.
6. Run the existing test, typecheck, lint, and build scripts. Fix failures caused by this work.
7. Update prompt.md once with the actual prompt, changed files, checks actually run, results, known limitations, and status.

Work in small targeted edits. Do not implement the UI results dashboard or start the next phase. If a PRD requirement is unclear, document it and choose the safest compatible behavior. Stop with a concise report of completed items, incomplete items, and actual verification results.
```

**Acceptance gate:** the supported transcript fixtures pass; outputs are
deterministic; significant findings cite valid source messages; all
configured checks pass or remaining failures are clearly reported.

------------------------------------------------------------------------

# Phase 4 --- Performance and safe execution (only if needed by the PRD)

``` text
MISSIQ — PHASE 4: PERFORMANCE AND SAFE LOCAL EXECUTION (LOW-CREDIT MODE)

Inspect PRD.md, prompt.md, and the current implementation. First determine whether the PRD requires a Web Worker and whether current synchronous processing causes a real UI-blocking risk. Do not add complexity without a requirement or demonstrated need.

If a Worker is required or justified:
- Move CPU-heavy parsing/analysis into a typed Web Worker.
- Keep worker messages limited to the current in-memory analysis request and response.
- Handle loading, success, cancellation/reset, and errors safely.
- Do not persist or transmit transcript data.
- Prevent stale results from replacing results for a newer conversation.
- Preserve the existing public analysis API where practical.
- Add focused tests for worker messaging, errors, and stale-result handling where supported by the existing test setup.

If a Worker is not required or cannot be implemented safely within the current architecture, document why and keep the simplest working local implementation.

Run relevant tests, typecheck, lint, and build. Update prompt.md with actual changes and results. Do not rebuild the UI, add a model, or begin deployment. Stop after this phase.
```

**Credit-saving rule:** if the PRD does not require a Worker and tests
show the MVP remains responsive for the supported input size, do not add
one just for architecture points.

------------------------------------------------------------------------

# Phase 5 --- Connect the engine to the complete MVP UI

``` text
MISSIQ — PHASE 5: COMPLETE MVP UI INTEGRATION (LOW-CREDIT MODE)

Read PRD.md, prompt.md, and inspect the current UI and analysis API. Preserve working components and the Missiq design tokens. Implement only missing required UI behavior; do not redesign the entire application.

Connect the real local analysis engine to a complete end-to-end workflow:

1. Paste a transcript and upload a supported .txt file.
2. Validate input and show useful errors/warnings.
3. Allow the user to configure the name/identifier used for mention detection.
4. Require an explicit Analyze action.
5. Show honest processing status and the exact method: “Local rule-based analysis”.
6. Display a concise summary and prioritized insights, action items/deadlines, decisions, mentions, announcements/open questions where supported.
7. Let the user open each finding's original source message.
8. Support task completion and useful filters if required by the PRD.
9. Provide clearly labelled sample data, never confused with real user content.
10. Provide a clear/reset action that removes the input, results, task state, and selected source from memory.

Requirements:
- No mock analysis results and no cloud AI calls.
- Every finding must come from the real engine and preserve source references through sorting/filtering.
- Do not persist transcripts/results in browser storage or URLs.
- No nonfunctional buttons; implement or remove every visible control.
- Handle empty, malformed, oversized, and unsupported input.
- Maintain accessible labels, keyboard use, focus states, and responsive layout.
- Keep the existing architecture; avoid unnecessary dependencies and unrelated refactors.

Add focused tests for the critical user flow and edge cases. Run all existing tests, typecheck, lint, and build. Update prompt.md and README.md only where necessary, recording actual results and limitations. Do not begin the final audit or deployment. Stop with a concise report.
```

**Acceptance gate:** a user can import/paste a real transcript, analyze
it, inspect source evidence, interact with tasks, and clear all content
without fake results.

------------------------------------------------------------------------

# Phase 6 --- Final privacy, correctness, and release audit

``` text
MISSIQ — PHASE 6: FINAL PRIVACY, CORRECTNESS, AND RELEASE AUDIT (LOW-CREDIT MODE)

Act as a skeptical QA and privacy reviewer. Read PRD.md and prompt.md, inspect the current code, and audit the working MVP. Do not assume the implementation is correct because it builds.

Check and fix only real issues:
1. Private transcript/results are never sent to external endpoints or cloud AI services.
2. No analytics, telemetry, private-content logging, secrets, or unintended persistent storage.
3. Clear/reset removes all in-memory transcript-derived data and task state.
4. Imported text is treated as untrusted input; no unsafe HTML or dynamic execution.
5. Source references resolve correctly and evidence supports displayed findings.
6. Decisions are not confused with suggestions; deadlines and ownership are not fabricated.
7. Empty/malformed input and analysis failures are handled safely.
8. UI controls, keyboard navigation, accessible labels, and responsive layout work.
9. CSP and development/production configuration are accurately documented. Do not claim the CSP meta tag alone proves complete privacy.
10. Tests cover the critical journey and important regressions.

Use browser/network inspection if available to check requests during analysis. Report exactly what was checked; do not claim comprehensive security from limited evidence.

Run the existing unit tests, E2E tests, typecheck, lint, and production build. Fix high-impact defects, add focused regression tests, and rerun relevant checks. Do not weaken tests or perform broad cosmetic refactors.

Update prompt.md with actual audit findings, fixes, commands and results, unresolved risks, and honest release status. Update README.md if needed. Do not deploy yet. Stop with a prioritized list of remaining blockers.
```

**Acceptance gate:** no known critical defect; all checks and
limitations are reported truthfully; local-first claims match the
implementation and evidence.

------------------------------------------------------------------------

# Phase 7 --- Demo preparation and deployment

``` text
MISSIQ — PHASE 7: SUBMISSION-READY DEMO AND DEPLOYMENT (LOW-CREDIT MODE)

Read PRD.md, prompt.md, and README.md. Inspect the actual current status. Do not assume deployment or repository publication has happened.

Prioritize a reliable hackathon demo over optional features.

1. Run the configured tests, typecheck, lint, and production build. Fix only release-blocking issues.
2. Ensure README.md has accurate setup commands, supported input formats, current features, privacy/AI disclosures, known limitations, and a concise demo guide.
3. Ensure prompt.md has one consistent project-status summary and truthful records of prompts, changes, and verification. Remove contradictory stale status statements without deleting useful history.
4. Verify `.gitignore` excludes dependencies, build output, secrets, local environment files, and private test transcripts. Never commit credentials or real private chats.
5. Provide a short demo script using clearly labelled synthetic chat data. Demonstrate a deadline, assigned task, decision vs suggestion, mention, source evidence, and clear/reset behavior only where the app actually supports them.
6. Check the PRD and organizer requirements for required repository visibility, deployment, and AI disclosure. Do not assume requirements that are not stated.
7. If deployment is requested and authorized, use the simplest compatible static host. Inspect configuration first; do not expose secrets or claim success without actual confirmation. If account access is unavailable, provide exact manual deployment steps instead.
8. If a live deployment is completed, verify the real URL and critical workflow. Otherwise report “not deployed”.
9. Record actual command results, repository/deployment status, remaining limitations, and the final demo script in the documentation.

Do not add cloud AI, a backend, a database, authentication, or optional features unless explicitly required. Stop with a concise final submission checklist and honest readiness assessment.
```

------------------------------------------------------------------------

# Optional emergency prompt --- credits nearly exhausted

Use this only if there is not enough credit to finish the current phase
normally.

``` text
MISSIQ — MINIMAL SAFE COMPLETION

Inspect PRD.md, prompt.md, the current code, and existing test results. Do not restart or refactor. Identify the single most important incomplete P0 requirement for a working demo and implement only that requirement with a focused regression test. Preserve local-only processing and source traceability. Run the smallest relevant checks plus the production build if possible. Update prompt.md with actual changes, actual results, and remaining blockers. Do not claim completion without evidence. Stop.
```

------------------------------------------------------------------------

# Local verification commands

Run these in the project terminal when needed; they do not require a
separate AI prompt:

``` bash
npm test
npm run typecheck
npm run lint
npm run build
npx playwright test
```

Use only commands that exist in `package.json`; if a script is missing,
inspect the scripts before running alternatives.

## Final priority order

1.  Finish Phase 3 accurately.
2.  Complete Phase 5 end-to-end UI integration.
3.  Run Phase 6 privacy and correctness checks.
4.  Do Phase 4 only if the PRD or observed performance justifies it.
5.  Do Phase 7 documentation, demo, and deployment according to actual
    submission requirements.

**Do not chase optional AI-model integration before the deterministic
MVP works.** A small, reliable, evidence-backed local app is better than
a larger unfinished app.
