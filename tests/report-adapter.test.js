// Informe único de CMO-VIH (cmo-report/1) en es/en/pt, registro de intervenciones y plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FIELD_DEFINITIONS, INTERVENTION_KEYS } from '../assets/modules/config.js';
import { evaluateCase } from '../assets/modules/cmo-engine.js';
import { buildNewPatientCase, normalizeFields, normalizePatientCase, buildSavedCaseRecord, hydrateStateFromSavedCase } from '../assets/modules/case-model.js';
import { createDefaultState } from '../assets/modules/data-layer.js';
import { reviewSummary, scoringView } from '../assets/modules/review-gate.js';
import { buildReportInput, followUpView, normalizePlan, interventionStatus } from '../assets/modules/report-adapter.js';
import { createReport, validateReport, reportToText, LABELS } from '../assets/cmo-ds/cmo-report.js';
import { reportToPdf } from '../assets/cmo-ds/cmo-pdf.js';

const dict = Object.fromEntries(['es', 'en', 'pt'].map((l) => [l, JSON.parse(fs.readFileSync(new URL(`../data/i18n/${l}.json`, import.meta.url), 'utf8'))]));
const translator = (locale) => (key, params = {}) => {
  const value = key.split('.').reduce((o, k) => o?.[k], dict[locale]);
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '') : key;
};
const confirmed = (value) => ({ value, status: 'confirmed', source: 'manual', evidence: 'x', clinicianConfirmed: true });
function makeState(locale, fields, extra = {}) {
  const base = buildNewPatientCase({});
  const patientCase = { ...base, language: locale, pseudonymizedPatientLabel: 'VIH-0001', clinician: { name: 'Farmacéutica Ficticia', center: 'Hospital Ficticio' }, ...extra, fields: { ...normalizeFields({}), ...fields } };
  const state = { ...createDefaultState(), locale, patientCase };
  const t = translator(locale);
  state.analysis = evaluateCase(scoringView(patientCase), t);
  state.analysis.review = reviewSummary(patientCase, state.analysis);
  return { state, t };
}
const allFields = Object.fromEntries(FIELD_DEFINITIONS.map((f) => [f.id, confirmed(f.optionKeys[f.optionKeys.length - 1])]));

test('el informe único se genera en el idioma de la interfaz, sin rótulos de otro idioma', () => {
  for (const locale of ['es', 'en', 'pt']) {
    const { state, t } = makeState(locale, { pregnancy: confirmed('yes'), viralLoad: confirmed('detectable') });
    const report = createReport(buildReportInput(state, state.analysis, t, { version: '3.2.0' }));
    assert.equal(report.locale, locale); assert.deepEqual(validateReport(report), []);
    const text = reportToText(report);
    assert.ok(text.includes(LABELS[locale].sStrat.toUpperCase()) && text.includes(t('legal.clinicalDisclaimer')) && text.includes('VIH-0001') && text.includes(state.analysis.priorityLabel));
    if (locale !== 'es') for (const spanish of ['Fecha de evaluación', 'Valoración CMO', 'Resultado de estratificación']) assert.ok(!text.includes(spanish), `${locale}: ${spanish}`);
    assert.equal(Buffer.from(reportToPdf(report)).subarray(0, 8).toString('latin1'), '%PDF-1.4');
  }
});

test('provisional, modificación y avisos del informe vienen de la puerta de revisión', () => {
  const { state, t } = makeState('es', { pregnancy: confirmed('yes'), depression: { value: 'yes', status: 'extracted', source: 'ai', evidence: 'Presenta depresión', clinicianConfirmed: false } }, { override: { enabled: true, level: '3', reason: 'Justificación clínica documentada' } });
  const report = createReport(buildReportInput(state, state.analysis, t));
  const text = reportToText(report);
  assert.equal(report.status, 'provisional');
  assert.match(text, /\(PROVISIONAL\)/); assert.match(text, /Modificación por criterio profesional: [^\n]*Justificación clínica documentada/);
  assert.match(text, /Resultado calculado por el modelo: /); assert.match(text, new RegExp(t('gate.overrideLowersAuto').slice(0, 30)));
  assert.ok(!text.includes('Presenta depresión'), 'el fragmento de una propuesta sin confirmar no llega al informe');
  assert.equal(report.factors.some((f) => /epres/.test(f.label)), false, 'una propuesta sin confirmar no es un factor');
});

test('con todo confirmado el informe es definitivo y cada variable que puntúa aparece una vez', () => {
  const { state, t } = makeState('es', allFields);
  const report = createReport(buildReportInput(state, state.analysis, t));
  assert.equal(report.status, 'final');
  assert.equal(report.factors.length, state.analysis.explainability.contributions.filter((c) => c.score > 0).length);
  assert.equal(report.stratification.pending.length, 0);
});

test('intervenciones: el estado se registra por clave del modelo y el informe las agrupa', () => {
  const { state, t } = makeState('es', allFields, { interventionStatus: { [INTERVENTION_KEYS[1][0]]: 'done', [INTERVENTION_KEYS[1][1]]: 'planned', [INTERVENTION_KEYS[1][2]]: 'not_applicable' } });
  const level = state.analysis.finalLevel;
  assert.equal(level, 1);
  const report = createReport(buildReportInput(state, state.analysis, t));
  assert.equal(report.interventions.done[0].label, t(INTERVENTION_KEYS[1][0]));
  assert.equal(report.interventions.planned.length, 1); assert.equal(report.interventions.notApplicableCount, 1);
  assert.equal(report.interventions.recommended.length, INTERVENTION_KEYS[1].length - 3);
  assert.equal(interventionStatus(state.patientCase, 'inventada'), 'recommended');
});

test('plan e intervenciones: se sanean y sobreviven al caso guardado', () => {
  assert.deepEqual(normalizePlan({ interventionStatus: { [INTERVENTION_KEYS[2][0]]: 'done', inventada: 'done', [INTERVENTION_KEYS[2][1]]: 'hecho' }, plan: { nextReview: 'mañana', notes: 'x'.repeat(5000) } }), { interventionStatus: { [INTERVENTION_KEYS[2][0]]: 'done' }, plan: { nextReview: '', notes: 'x'.repeat(2000) } });
  const { state } = makeState('es', allFields, { interventionStatus: { [INTERVENTION_KEYS[1][0]]: 'planned' }, plan: { nextReview: '2027-01-10', notes: 'Revisión telefónica' } });
  const record = buildSavedCaseRecord(state);
  assert.deepEqual(record.interventionStatus, { [INTERVENTION_KEYS[1][0]]: 'planned' }); assert.equal(record.plan.nextReview, '2027-01-10');
  const back = hydrateStateFromSavedCase(createDefaultState(), record);
  assert.deepEqual(back.patientCase.interventionStatus, record.interventionStatus); assert.equal(back.patientCase.plan.notes, 'Revisión telefónica');
  assert.deepEqual(normalizePatientCase({}, 'es').interventionStatus, {}, 'un caso anterior sin plan se abre con valores vacíos');
});

test('etapa de seguimiento: contribuciones por sección y pendientes (con propuestas sin confirmar señaladas)', () => {
  const { state } = makeState('es', { depression: confirmed('yes'), viralLoad: { value: 'detectable', status: 'extracted', source: 'ai', evidence: 'x', clinicianConfirmed: false } });
  const view = followUpView(state, state.analysis);
  assert.ok(view.bySection.some((g) => g.items.some((c) => c.fieldId === 'depression')));
  assert.equal(view.pending.find((p) => p.id === 'viralLoad').unconfirmed, true);
  assert.equal(view.pending.some((p) => p.id === 'depression'), false);
});

test('traducciones: las claves nuevas existen en es, en y pt', () => {
  const keysOf = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
  for (const ns of ['gate', 'followUp']) for (const l of ['en', 'pt']) assert.deepEqual(keysOf(dict[l][ns]).sort(), keysOf(dict.es[ns]).sort(), `${ns} ${l}`);
  for (const k of ['stageFollowUp', 'continueToFollowUp']) for (const l of ['es', 'en', 'pt']) assert.ok(dict[l].wizard[k], `wizard.${k} ${l}`);
});
