# CMO-VIH Pro v2 — March 2026

CMO-VIH Pro v2 is a static, bilingual, semi-clinical decision-support web app designed for HIV pharmaceutical care workflows at pilot level.

## What changed in v2
- Rebuilt the app from a single-file calculator into a modular static architecture.
- Added bilingual Spanish / English support using centralized JSON-based i18n files.
- Added a deterministic CMO engine with explicit variable-level contributions and explainability.
- Added clinician override, dashboard summary, risk flags, follow-up intensity, and structured interventions.
- Added AI-assisted free-text intake that marks findings as extracted, inferred, confirmed, or missing.
- Added JSON / CSV import, privacy-first traceability, autosave, printable outputs, and research exports.
- Added visible legal and governance positioning suitable for support / pilot / research use.

## Architecture
- `index.html`: static shell.
- `assets/styles.css`: hospital-grade visual system.
- `assets/app.js`: orchestration and event wiring.
- `assets/modules/config.js`: versioning, field catalog, and rule metadata.
- `assets/modules/cmo-engine.js`: deterministic scoring and explainability.
- `assets/modules/ai-module.js`: heuristic text extraction with evidence labeling.
- `assets/modules/data-layer.js`: state schema, autosave, imports, and traceability.
- `assets/modules/export-layer.js`: summary, JSON, CSV, and printable outputs.
- `assets/modules/legal-module.js`: in-app legal highlights.
- `assets/modules/i18n.js`: JSON-based localization loader.
- `assets/modules/ui.js`: UI rendering.
- `data/i18n/*.json`: centralized translations.

## Core workflow
1. Enter data manually, paste de-identified clinical text, or import JSON/CSV.
2. Review extracted vs inferred vs confirmed variables.
3. Validate or edit variables manually.
4. Review automatic CMO classification and explainability.
5. Apply a clinician override if needed.
6. Export a clinical summary, structured JSON/CSV, or printable report.

## Governance positioning
- Decision support only.
- Not a substitute for clinician judgment.
- AI outputs require human validation.
- Privacy-first and static; no live hospital integrations are implemented.
- Not a certified medical device.

## Running locally
Because the app loads JSON translation files, run it through a local static server instead of opening `index.html` directly.

### Python
```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Input schema for import
Supported field IDs:
- `pregnancy`
- `ageBand`
- `comorbidities`
- `polypharmacy`
- `complexity`
- `adherenceArt`
- `adherenceConcomitant`
- `hospitalization`
- `qualityOfLife`
- `depression`
- `substanceUse`
- `neurocognitive`
- `frailty`
- `socioeconomic`
- `viralLoad`
- `comorbidityGoals`
- `narrative`

Example JSON:
```json
{
  "ageBand": "over50",
  "comorbidities": "high",
  "polypharmacy": "high",
  "viralLoad": "undetectable",
  "comorbidityGoals": "notAchieved",
  "narrative": "De-identified HIV clinical summary"
}
```

## Deliverables added in this version
- `PLAN_V2.md`
- `LEGAL_NOTICE.md`
- `PRIVACY.md`
- `TERMS.md`
- `AI_POLICY.md`
- `VERSION.md`
- `CHANGELOG.md`

## Important note
This version is designed to be usable in real clinical workflows at pilot level, but it deliberately avoids claiming backend integrations, regulatory certification, or autonomous clinical decision-making.
