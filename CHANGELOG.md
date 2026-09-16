# CHANGELOG.md

## v3 — September 2026
- Hardened the AI-assisted free-text extraction module (`assets/modules/ai-module.js`):
  - Added negation detection (English/Spanish cues such as "no", "sin", "niega", "denies", "without", "negative for") to avoid false-positive extractions on negated findings.
  - Fixed the hospitalization pattern so a "recent" classification requires an explicit recency marker (e.g. "6 months"/"6 meses"), instead of matching any mention of hospitalization.
  - Added a minimal automated test suite (`node:test`) covering positive, negative, and negation cases for the extraction patterns.
- Updated the version banner and its duplicated occurrences (header, page title, meta description, footer/legal strings, README, VERSION.md) from v2 — March 2026 to v3 — September 2026.
- No other module, UI flow, clinical text, or CMO scoring/weighting logic was changed.

## v2 — March 2026
- Added `PLAN_V2.md` audit and transformation roadmap.
- Replaced the monolithic single-file app with a modular static architecture.
- Added bilingual English / Spanish support using centralized JSON translation files.
- Added a deterministic CMO engine with explicit rule contributions and explainability.
- Added clinician override and traceability metadata.
- Added AI-assisted free-text extraction with extracted / inferred / confirmed / missing states.
- Added JSON / CSV import and future-ready EHR schema positioning.
- Added dashboard summary, risk flags, suggested interventions, and follow-up intensity.
- Added research exports, printable report, and clinical summary output.
- Added legal, privacy, terms, AI policy, and version documentation.
