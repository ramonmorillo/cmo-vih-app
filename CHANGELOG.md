# CHANGELOG.md

## 3.2.0 — 2026-11-11

Puerta de revisión profesional, importación validada y estado provisional. **Sin cambios en el modelo clínico**: `assets/modules/config.js`, `assets/modules/cmo-engine.js` y `assets/modules/ai-module.js` son idénticos byte a byte a la 3.1.0 (huellas SHA-256 en `tests/fixtures/clinical.sha256.json`). El motor recibe una *vista* del caso (`assets/modules/review-gate.js`). La versión y la fecha se fijan en el commit de publicación.

### Revisión profesional (cambio de comportamiento: requiere validación del autor)
- **Las propuestas del análisis de texto ya no puntúan hasta que el profesional las confirma** (antes puntuaban de inmediato con `clinicianConfirmed: false`: «Antecedente de deterioro cognitivo no confirmado» sumaba +2 y generaba una alerta). Cada propuesta muestra «Confirmar» y «Descartar»; una propuesta sin confirmar tampoco activa la prioridad automática, no genera alertas, no cuenta en el progreso y no se exporta (ni su valor ni el fragmento de texto).
- **Resultado provisional**: si hay variables sin valorar o propuestas sin confirmar, el resultado se rotula «provisional» en pantalla y en todas las salidas, con el recuento. Antes, con 0 datos se mostraba «Prioridad 3 — Baja, cada 12 meses» indistinguible de un resultado real. Una variable sin valorar nunca se interpreta como «No».
- **Modificación del clínico**: solo se aplica con nivel válido y justificación de al menos 12 caracteres (antes se aplicaba con el motivo vacío). Figura en el resumen, el texto para historia clínica, el CSV, el JSON y la impresión, junto con la clasificación automática que se conserva. Si rebaja una prioridad automática del modelo (p. ej. embarazo → P1) se advierte; la regla no se ha endurecido (decisión pendiente del autor).

### Importación y datos
- **Importación validada**: solo variables del modelo con valores admitidos; el resto se descarta y se informa. Antes, `{"viralLoad":"banana"}` lanzaba `TypeError`, se guardaba el estado inválido y la aplicación quedaba en blanco tras recargar. Un estado corrupto ya guardado también se sanea al abrir.
- El CSV importado admite comillas (antes `"P, 01"` quedaba en `"P`).
- **Privacidad**: el JSON exportado ya no incluye el texto clínico pegado y el borrador del navegador (`localStorage`, sin cifrar) ya no conserva el texto pegado, el contenido importado, los fragmentos de evidencia ni el resultado calculado. Los casos guardados explícitamente («Guardar caso») no cambian.
- JSON con esquema (`cmo-vih-export/1`) y estado; CSV con columnas nuevas al final (`status`, `automaticLevel`, `overrideLevel`, `overrideReason`, `pendingVariables`, `unconfirmedProposals`) y protegido frente a fórmulas.

### Defectos corregidos
- XSS por la evidencia extraída del texto pegado y por la etiqueta del paciente en la ventana de impresión.
- El primer clic en «Analizar texto clínico» se perdía (el cambio del campo de texto volvía a dibujar la página y sustituía el botón).
- Avisos no bloqueantes y anunciados (`toast`) en lugar de `alert()`; aviso al salir con cambios sin guardar; selector de tipo de importación sin nombre accesible.
- Textos en español, inglés y portugués para todo lo nuevo (`gate.*`, `exports.*`). **Portugués: pendiente de revisión** (ver `PT_REVIEW.md`).

### Pruebas
- `npm test`: 61 en el primer bloque (50 previas + 11: huellas, paridad con el motor en 300 casos, propuestas sin confirmar, modificación, importación, estado corrupto, exportaciones, borrador). `npm run test:e2e`: 4 recorridos en Chromium con axe WCAG A/AA opcional (`AXE_PATH`).

### Flujo común (etapas 5–6 e informe)
- Nueva etapa **Seguimiento** tras la estratificación: variables que puntúan por sección del modelo, variables pendientes de valorar (con las propuestas sin confirmar señaladas), **estado de cada intervención del modelo** (realizada, planificada, no procede) y plan (próxima valoración y observaciones). El modelo no define otras «necesidades»: no se ha inventado ninguna.
- **Informe único** (`cmo-report/1`, núcleo 0.3.0) en el idioma de la interfaz (es/en/pt): el texto para historia clínica, la vista previa, la impresión y el nuevo **PDF** salen de la misma estructura. Las funciones anteriores (`buildClinicalSummary`, `buildClinicalRecordText`, `buildPrintableHtml`) siguen exportadas pero la aplicación ya no las usa. Botón nuevo «Descargar texto (.txt)».
- Casos guardados: incluyen el estado de las intervenciones y el plan; los casos anteriores se abren con valores vacíos.
- Pruebas: 68 unitarias (7 nuevas del informe y del plan) y e2e ampliado (etapa de seguimiento, PDF, informe en inglés).

### Pendiente
- Revisión del portugués del núcleo (`LABELS.pt` en el hub) y de los textos nuevos (`PT_REVIEW.md`).
- Heredados: `APP_VERSION` «v3 — September 2026»; claves de almacenamiento «v2»; idioma por defecto `en`.

## 3.1.0 — 2026-10-30

Release (author's decision: minor version bump for the interface change). `package.json` and `cmo-app-meta` 3.0.0 → 3.1.0; `cmo-app-meta`: `status: "released"`, `releaseDate: "2026-10-30"`. Includes both sections below, previously unreleased. CMO scoring logic unchanged. The «CMO-VIH Pro v3 — September 2026» texts in `data/i18n` are unchanged (major version 3).

### CMO Design System 0.2.0 identity

Visual-only change. No changes to `assets/modules/*`, `assets/app.js` or `data/i18n/*`; `APP_VERSION` unchanged.
- Pinned copy of CMO Design System 0.2.0 in `assets/cmo-ds/` (SHA-256 manifest).
- `assets/cmo-visual.css` rewritten as the «Estratos» theme (loaded after `styles.css`); `styles.css` maps its neutral and brand variables to tokens. `--success/--warning/--danger` unchanged.
- Multilingual `<cmo-author-signature>` (es/en/pt) that follows the app's active language; credits taken verbatim from `data/i18n/*.json` (authorship, scientific reference and ©).
- Accessibility: keyboard focus from #ffbf47 (1.6:1) to #1f3aa8 (9.4:1); field borders from #d7dce5 (1.4:1) to #7b8495 (≥3:1). Fixes a pre-existing insufficient contrast in data-origin badges (`.badge--*`), keeping each state's hue.
- Tests: `tests/cmo-ds.test.js`.

### Extraction status model
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
