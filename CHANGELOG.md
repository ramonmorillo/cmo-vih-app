# CHANGELOG.md

## Unreleased
- Reworked the AI-assisted free-text extraction status model (`assets/modules/ai-module.js`):
  - Root cause of "only 4 variables extracted from a rich clinical note": the module only had a
    PRESENT/no-match binary — an explicit denial ("no ingresos hospitalarios") and a concept never
    mentioned at all both collapsed into the same "missing" bucket, and several fields only matched
    a handful of fixed English/Spanish phrases with no numeric or narrative fallback.
  - Introduced four explicit outcomes per field: PRESENT (`extracted`/`inferred`, unchanged),
    ABSENT (`absent` — an explicit clinical denial, e.g. "niega depresión", resolved to the
    model's safe option value), REVIEW (`review` — a historical mention of a "current status"
    concept, a soft narrative cue without a formal instrument, or two contradictory mentions of the
    same concept; left unscored with a `suggestedValue` for the clinician to confirm), and UNKNOWN
    (no update at all — never treated as a negative finding).
  - Added narrative/numeric extraction paths that were previously all-or-nothing exact phrases:
    counting a listed "Tratamiento habitual" medication block for polypharmacy, normalizing
    "<20 copias/mL"-style viral load reporting, and recognizing a narrative admission of missed ART
    doses anchored to a TAR/antirretroviral mention.
  - Added a historical/temporality guard so a past, resolved mention (e.g. "episodio depresivo hace
    4 años") is flagged for review instead of being read as a current finding — this was a genuine
    false positive in the previous version, not just under-extraction.
  - Added an instrument-mention guard so a reference to an assessment tool by name (e.g. "no se ha
    realizado PHQ-9 ni otra escala de depresión") is never read as a clinical finding about the
    patient, positive or negative.
  - AI extraction no longer silently overwrites a field the clinician already confirmed or entered
    manually (`assets/app.js`).
  - The post-extraction message is now a dynamic breakdown (present/absent/unknown/review counts)
    instead of a fixed sentence that conflated "not found" with "absent".
  - Added `absent`/`review` status badges (Review stage field cards and AI panel) and recolored the
    "not documented" badge away from the danger/red styling that visually implied risk.
  - Expanded the automated test suite (`node:test`) with negation-to-ABSENT, UNKNOWN-never-ABSENT,
    historical-mention, contradiction, numeric-normalization, and narrative-admission cases, plus an
    end-to-end check against a realistic, information-dense clinical note.
  - No change to the CMO scoring model, field weights, thresholds, or the `comorbidityGoals`
    pattern (left untouched per its existing, documented scope decision).

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
