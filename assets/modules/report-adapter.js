// Adaptador de CMO-VIH al informe único del núcleo (cmo-report/1). Sin reglas clínicas: traduce el resultado del
// motor (a través de la vista de review-gate.js) y el registro de intervenciones a la estructura común.
// El texto para historia clínica, la impresión y el PDF salen de la misma estructura y en el idioma de la interfaz.
import { APP_VERSION, FIELD_DEFINITIONS, INTERVENTION_KEYS, SECTION_LABEL_KEYS, SECTION_ORDER } from './config.js';
import { unconfirmedFieldIds } from './review-gate.js';

export const INTERVENTION_STATUS_VALUES = ['recommended', 'done', 'planned', 'not_applicable'];
export const TOOL_NAME = 'CMO-VIH Pro';
/** Versión declarada en cmo-app-meta (solo en el navegador). */
export function toolVersion() {
  try { return String(JSON.parse(document.getElementById('cmo-app-meta').textContent).appVersion || ''); } catch { return ''; }
}

/** Intervenciones del nivel final con identificador estable (la clave de traducción del propio modelo). */
export const interventionItems = (analysis, translate) => INTERVENTION_KEYS[analysis.finalLevel].map((key) => ({ id: key, label: translate(key) }));
export const interventionStatus = (patientCase, id) => (INTERVENTION_STATUS_VALUES.includes(patientCase.interventionStatus?.[id]) ? patientCase.interventionStatus[id] : 'recommended');

export function buildReportInput(state, analysis, translate, { version = '' } = {}) {
  const pc = state.patientCase, review = analysis.review;
  const items = interventionItems(analysis, translate);
  const by = (status) => items.filter((i) => interventionStatus(pc, i.id) === status).map((i) => ({ group: '', label: i.label }));
  const pendingLabels = [...analysis.explainability.missing.map((m) => m.label)];
  const warnings = [];
  if (review?.provisional) warnings.push(translate('gate.provisionalDetail', { missing: review.missing, unconfirmed: review.unconfirmed.length }));
  if (review?.overrideLowersAutomatic) warnings.push(translate('gate.overrideLowersAuto'));
  if (review?.overrideNotApplied) warnings.push(translate('gate.overrideNotApplied', { min: 12 }));
  for (const flag of analysis.riskFlags) warnings.push(flag);
  return {
    locale: state.locale,
    title: translate('exports.summaryTitle'),
    tool: { name: TOOL_NAME, version },
    model: { name: APP_VERSION, source: translate('footer.modelNote') === 'footer.modelNote' ? '' : translate('footer.modelNote') },
    evaluationDate: analysis.traceability.timestamp,
    status: review?.provisional ? 'provisional' : 'final',
    hospital: pc.clinician?.center, pharmacist: pc.clinician?.name, patientId: pc.pseudonymizedPatientLabel,
    stratification: {
      score: analysis.total,
      subtotals: SECTION_ORDER.map((section) => ({ label: translate(SECTION_LABEL_KEYS[section]), points: analysis.sectionScores[section] })),
      calculatedLevel: analysis.automaticPriorityLabel, finalLevel: analysis.priorityLabel, levelCode: analysis.finalLevel,
      override: review?.overrideApplied ? { level: analysis.priorityLabel, motive: '', justification: String(pc.override.reason).trim() } : null,
      pending: pendingLabels
    },
    factors: analysis.explainability.contributions.filter((c) => c.score > 0).map((c) => ({ dimension: c.sectionLabel, label: c.label, detail: c.valueLabel, points: c.score })),
    // Necesidades potenciales: las variables que todavía no se han valorado (el modelo no define otras necesidades).
    needs: { confirmed: [], potential: [] },
    interventions: { done: by('done'), planned: by('planned'), recommended: by('recommended'), notApplicableCount: by('not_applicable').length },
    plan: { periodicity: analysis.followUp, nextReview: pc.plan?.nextReview || '', notes: pc.plan?.notes || '' },
    warnings,
    disclaimer: translate('legal.clinicalDisclaimer')
  };
}

/** Necesidades y datos pendientes para la etapa «Seguimiento»: contribuciones por sección y variables sin valorar. */
export function followUpView(state, analysis) {
  const unconfirmed = new Set(unconfirmedFieldIds(state.patientCase));
  return {
    bySection: SECTION_ORDER.map((section) => ({ section, items: analysis.explainability.contributions.filter((c) => c.section === section && c.score > 0) })),
    pending: FIELD_DEFINITIONS.filter((f) => analysis.explainability.missing.some((m) => m.fieldId === f.id)).map((f) => ({ id: f.id, labelKey: f.labelKey, unconfirmed: unconfirmed.has(f.id) }))
  };
}

/** Sanea el registro de intervenciones y el plan de un caso (importación, borrador o caso guardado). */
export function normalizePlan(patientCase = {}) {
  const status = {};
  const all = new Set(Object.values(INTERVENTION_KEYS).flat());
  for (const [id, value] of Object.entries(patientCase.interventionStatus && typeof patientCase.interventionStatus === 'object' ? patientCase.interventionStatus : {})) {
    if (all.has(id) && INTERVENTION_STATUS_VALUES.includes(value) && value !== 'recommended') status[id] = value;
  }
  const plan = patientCase.plan || {};
  return { interventionStatus: status, plan: { nextReview: /^\d{4}-\d{2}-\d{2}$/.test(plan.nextReview || '') ? plan.nextReview : '', notes: String(plan.notes || '').trim().slice(0, 2000) } };
}
