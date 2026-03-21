# PLAN_V2.md

## Audit of the current application

### Current limitations

#### UX limitations
- Single-page, single-file interface with limited information hierarchy and no progressive workflow.
- No bilingual support; the entire experience is hardcoded in Spanish.
- No collapsible sections, dashboard summary, autosave status, or guided progress indicator.
- Input experience is split between free text and a score form, but neither provides source traceability, missing-data visibility, or clinician confirmation state.
- Reporting is copy-only and not structured for printing, downstream analytics, or reusable exports.

#### Architecture limitations
- All HTML, CSS, business rules, and text-analysis logic are embedded in `index.html`, making maintenance and validation difficult.
- Strings, scoring rules, UI rendering, and data persistence are tightly coupled.
- No modular separation between UI, rules engine, text extraction, exports, legal content, and data persistence.
- No versioned state model or extensible schema for future integrations.

#### Clinical logic limitations
- The CMO-VIH scoring logic is implicit and partly duplicated across manual and text-analysis paths.
- Free-text analysis uses loose keyword matching and silently infers variables without evidence labeling.
- The current app does not distinguish extracted vs inferred vs confirmed values.
- There is no explainability layer showing variable-level contributions and rationale.
- No clinician override pathway, no documented uncertainty handling, and no structured missing-data detection.
- Outputs do not clearly state that the tool is decision support and not a medical device.

## Missing features required for real clinical use
- Bilingual UI and report generation (Spanish / English).
- Explicit CMO rule catalog with weights, thresholds, automatic classification, and override support.
- Explainability panel with score breakdown, key drivers, and rationale.
- AI-assisted text intake that extracts structured variables from pasted clinical notes.
- Manual / free-text / JSON / CSV input pathways unified in a single patient-case model.
- Traceability metadata: timestamp, version, source, and clinician modifications.
- Dashboard summarizing CMO level, follow-up intensity, suggested interventions, and risk flags.
- Privacy-first governance content, visible disclaimers, and regulatory positioning.
- Printable report and machine-readable export format for research or pilot workflows.
- Autosave and recoverable local state to support real clinical pilot usage.

## Risks

### Technical risks
- Heuristic text extraction may miss clinical nuance or produce false positives if not clearly labeled.
- Static deployment limits secure collaboration, authentication, and server-side audit trails.
- CSV/JSON imports may contain inconsistent schemas or malformed content.
- Browser-only local storage can be cleared by users and is not a full audit repository.

### Legal and governance risks
- Misinterpretation as a diagnostic or treatment-directing medical device if disclaimers are weak.
- Use with identifiable health data could create privacy risk if clinicians paste protected information.
- AI-assisted extraction may be overtrusted if extracted/inferred/confirmed states are not obvious.
- Local-only exports could be shared outside approved governance channels without policy controls.

## Proposed architecture

### 1. UI layer
- Static HTML shell with hospital-grade layout.
- Central rendering helpers and collapsible sections.
- Progress indicator, autosave banner, bilingual controls, and dashboard panels.

### 2. CMO engine
- Explicit variable catalog with labels, weights, thresholds, domains, and evidence expectations.
- Deterministic scoring, automatic classification, override handling, and explainability output.

### 3. AI module
- Browser-side heuristic NLP for pasted text.
- Extraction output with `extracted`, `inferred`, `missing`, and `confirmed` states.
- No fabrication of absent values; unresolved fields remain missing.

### 4. Data layer
- Canonical case model, local autosave, import parsing, schema normalization, and traceability metadata.
- Future-ready mapping stubs for external EHR ingestion without implementing fake integrations.

### 5. Export layer
- Clinical summary, structured report, printable view, JSON export, and CSV export.

### 6. Legal module
- Centralized disclaimers, privacy messaging, regulatory positioning, and footer/version metadata.

## Implementation phases

### Phase 1 — Audit and foundation
- Document current-state gaps.
- Split the application into HTML/CSS/JS modules.
- Define the shared case schema and explicit CMO variable catalog.

### Phase 2 — Bilingual modular app shell
- Add JSON-based i18n.
- Build a dashboard-first UI with collapsible sections, progress tracking, and autosave.

### Phase 3 — Clinical decision-support core
- Implement deterministic scoring engine.
- Add explainability panel, contribution breakdown, key drivers, and clinician override.

### Phase 4 — AI-assisted intake and imports
- Add free-text extraction with evidence states.
- Add JSON/CSV import and normalized ingestion pipeline.

### Phase 5 — Governance and outputs
- Add legal documents, in-app disclaimers, printable report, research exports, README, and changelog.

### Phase 6 — Validation
- Run static validation checks for JavaScript and JSON.
- Perform manual review of representative workflows and export output.
