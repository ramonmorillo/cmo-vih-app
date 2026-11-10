// Puerta de revisión profesional de CMO-VIH. El motor, la configuración y el analizador no se modifican.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { FIELD_DEFINITIONS } from '../assets/modules/config.js';
import { evaluateCase } from '../assets/modules/cmo-engine.js';
import { buildNewPatientCase, normalizeFields, normalizePatientCase } from '../assets/modules/case-model.js';
import { applyImportedRecord, createDefaultState, parseCsvImport, saveState } from '../assets/modules/data-layer.js';
import { OVERRIDE_MIN_REASON, isUnconfirmedProposal, overrideInEffect, reviewLines, reviewSummary, sanitizeImportedRecord, scoringView, unconfirmedFieldIds } from '../assets/modules/review-gate.js';
import { buildCsvExport, buildStructuredReport, buildClinicalRecordText, buildClinicalSummary } from '../assets/modules/export-layer.js';

const tr = (key, params = {}) => (Object.keys(params).length ? `${key} ${JSON.stringify(params)}` : key);
const confirmed = (value) => ({ value, status: 'confirmed', source: 'manual', evidence: 'x', clinicianConfirmed: true });
const proposed = (value) => ({ value, status: 'extracted', source: 'ai', evidence: 'fragmento del texto', clinicianConfirmed: false });
function makeCase(fields = {}, override = {}) {
  const base = buildNewPatientCase({});
  return { ...base, fields: { ...normalizeFields({}), ...fields }, override: { enabled: false, level: 'auto', reason: '', ...override } };
}
const run = (patientCase) => { const analysis = evaluateCase(scoringView(patientCase), tr); analysis.review = reviewSummary(patientCase, analysis); return analysis; };

test('el motor, la configuración y el analizador no se han modificado (huellas de la versión 3.1.0)', () => {
  const expected = JSON.parse(fs.readFileSync(new URL('./fixtures/clinical.sha256.json', import.meta.url), 'utf8'));
  for (const [file, hash] of Object.entries(expected)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(`../assets/modules/${file}`, import.meta.url))).digest('hex'), hash, file);
});

test('una propuesta sin confirmar no puntúa, no activa la prioridad automática ni genera alertas', () => {
  const pc = makeCase({ pregnancy: proposed('yes'), viralLoad: proposed('detectable'), depression: proposed('yes') });
  assert.deepEqual(unconfirmedFieldIds(pc).sort(), ['depression', 'pregnancy', 'viralLoad']);
  const a = run(pc);
  assert.equal(a.total, 0); assert.equal(a.finalLevel, 3); assert.deepEqual(a.riskFlags, []);
  assert.equal(a.review.provisional, true); assert.equal(a.review.unconfirmed.length, 3);
  // Al confirmar, el resultado pasa a ser el del motor sobre los mismos datos
  const ok = makeCase({ pregnancy: { ...proposed('yes'), clinicianConfirmed: true }, viralLoad: confirmed('detectable'), depression: confirmed('yes') });
  const b = run(ok);
  assert.equal(b.finalLevel, 1, 'embarazo confirmado → prioridad automática'); assert.ok(b.total > 0); assert.ok(b.riskFlags.length > 0);
  assert.equal(isUnconfirmedProposal(ok.fields.pregnancy), false);
});

test('paridad: con todo confirmado, la vista es idéntica y el resultado es el del motor (300 casos)', () => {
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < 300; i += 1) {
    const fields = {};
    for (const f of FIELD_DEFINITIONS) if (rnd() < 0.7) fields[f.id] = confirmed(f.optionKeys[Math.floor(rnd() * f.optionKeys.length)]);
    const pc = makeCase(fields);
    const direct = evaluateCase(pc, tr), viaGate = run(pc);
    for (const key of ['total', 'sectionScores', 'automaticLevel', 'finalLevel', 'riskFlags', 'interventions']) assert.deepEqual(viaGate[key], direct[key], key);
    assert.equal(viaGate.review.unconfirmed.length, 0);
    assert.equal(viaGate.review.provisional, direct.explainability.missing.length > 0);
  }
});

test('«Sin valorar» no es «No»: sin datos el resultado es provisional y lista lo pendiente', () => {
  const a = run(makeCase());
  assert.equal(a.total, 0); assert.equal(a.review.provisional, true); assert.equal(a.review.missing, FIELD_DEFINITIONS.length);
  assert.equal(run(makeCase({ pregnancy: confirmed('no') })).review.missing, FIELD_DEFINITIONS.length - 1);
});

test('modificación del clínico: exige nivel válido y justificación; conserva lo automático; avisa si rebaja una regla automática', () => {
  const base = { pregnancy: confirmed('yes') };
  assert.equal(overrideInEffect({ enabled: true, level: '3', reason: '' }), false);
  assert.equal(overrideInEffect({ enabled: true, level: 'auto', reason: 'x'.repeat(40) }), false);
  assert.equal(overrideInEffect({ enabled: true, level: '9', reason: 'x'.repeat(40) }), false);
  let a = run(makeCase(base, { enabled: true, level: '3', reason: 'corta' }));
  assert.equal(a.finalLevel, 1, 'sin justificación suficiente no se aplica'); assert.equal(a.review.overrideNotApplied, true);
  a = run(makeCase(base, { enabled: true, level: '3', reason: 'Justificación clínica documentada' }));
  assert.equal(a.finalLevel, 3); assert.equal(a.automaticLevel, 1, 'la clasificación automática se conserva'); assert.equal(a.review.overrideApplied, true); assert.equal(a.review.overrideLowersAutomatic, true);
  const lines = reviewLines(makeCase(base, { enabled: true, level: '3', reason: 'Justificación clínica documentada' }), a, tr).join('\n');
  assert.match(lines, /exports\.overrideLine[\s\S]*Justificación clínica documentada/); assert.match(lines, /gate\.overrideLowersAuto/);
  assert.ok(OVERRIDE_MIN_REASON >= 12);
});

test('importación: solo variables del modelo con valores admitidos; fórmulas y tipos raros neutralizados', () => {
  const { clean, rejected } = sanitizeImportedRecord({ viralLoad: 'banana', pregnancy: 'yes', ageBand: 'over65', inventado: 'x', narrative: 'texto clínico', pseudonymizedPatientLabel: "'=HYPERLINK(1)" });
  assert.deepEqual(clean, { pregnancy: 'yes', ageBand: 'over65', pseudonymizedPatientLabel: '=HYPERLINK(1)' });
  assert.deepEqual(rejected, ['viralLoad']);
  assert.deepEqual(sanitizeImportedRecord(null).clean, {}); assert.deepEqual(sanitizeImportedRecord([1]).clean, {}); assert.deepEqual(sanitizeImportedRecord('x').clean, {});
  const next = applyImportedRecord(createDefaultState(), { viralLoad: 'banana', pregnancy: 'yes', narrative: 'texto clínico libre' });
  assert.equal(next.patientCase.fields.viralLoad.value, ''); assert.equal(next.patientCase.fields.pregnancy.value, 'yes');
  assert.equal(next.patientCase.narrative || '', '', 'el texto clínico libre de un fichero no se incorpora');
});

test('un estado corrupto con valores inválidos no llega al motor (antes dejaba la aplicación en blanco)', () => {
  const pc = normalizePatientCase({ fields: { viralLoad: { value: 'banana', status: 'confirmed', source: 'manual', clinicianConfirmed: true } } }, 'es');
  assert.equal(pc.fields.viralLoad.value, ''); assert.doesNotThrow(() => run(pc));
  const strict = (key) => { if (key === undefined) throw new TypeError('clave de traducción indefinida'); return key; };
  assert.throws(() => evaluateCase({ ...makeCase(), fields: { ...makeCase().fields, viralLoad: confirmed('banana') } }, strict), TypeError, 'sin el saneado, el motor lanza TypeError (la causa del fallo observado)');
});

test('CSV importado: comillas, comas dentro de comillas y etiqueta con fórmula neutralizada al exportar', () => {
  assert.deepEqual(parseCsvImport('pseudonymizedPatientLabel,pregnancy\n"P, 01",yes'), { pseudonymizedPatientLabel: 'P, 01', pregnancy: 'yes' });
  assert.equal(parseCsvImport('a,b\n"x ""q"" y",2').a, 'x "q" y');
});

function exportState(patientCase) { return { locale: 'es', patientCase: { ...patientCase, caseId: 'CASO-1', pseudonymizedPatientLabel: '=HYPERLINK("x")', narrative: 'TEXTO CLÍNICO LIBRE', clinician: {} }, savedCases: { storageMode: 'localStorage' } }; }

test('exportaciones: sin texto clínico libre ni propuestas sin confirmar; con estado, esquema y modificación', () => {
  const pc = makeCase({ pregnancy: confirmed('yes'), viralLoad: proposed('detectable') }, { enabled: true, level: '2', reason: 'Justificación clínica documentada' });
  const analysis = run(pc);
  const state = exportState(pc);
  const json = buildStructuredReport(state, analysis, tr);
  assert.equal(json.schema, 'cmo-vih-export/1'); assert.equal(json.status, 'provisional');
  assert.ok(!JSON.stringify(json).includes('TEXTO CLÍNICO LIBRE') && !JSON.stringify(json).includes('fragmento del texto'), 'ni narrativa ni evidencia de una propuesta sin confirmar');
  assert.equal(json.fields.viralLoad.value, ''); assert.equal(json.fields.pregnancy.value, 'yes'); assert.equal(json.override.reason, 'Justificación clínica documentada');
  const csv = buildCsvExport(state, analysis);
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`), 'fórmula neutralizada');
  assert.match(csv.split('\n')[0], /status,automaticLevel,overrideLevel,overrideReason,pendingVariables,unconfirmedProposals$/);
  assert.match(csv.split('\n')[1], /"provisional","1","2","Justificación clínica documentada"/);
  for (const text of [buildClinicalRecordText(state, analysis, tr), buildClinicalSummary(state, analysis, tr)]) {
    assert.match(text, /exports\.status: gate\.provisionalTitle/); assert.match(text, /exports\.overrideLine/); assert.match(text, /Justificación clínica documentada/);
  }
});

test('el borrador del navegador no conserva el texto clínico pegado', () => {
  const store = new Map(); globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const state = createDefaultState(); state.patientCase.narrative = 'TEXTO CLÍNICO LIBRE'; state.patientCase.importRaw = '{"x":1}';
  const kept = saveState(state);
  assert.equal(kept.patientCase.narrative, 'TEXTO CLÍNICO LIBRE', 'en memoria se conserva');
  assert.ok(![...store.values()].some((v) => v.includes('TEXTO CLÍNICO LIBRE')), 'en localStorage no');
  delete globalThis.localStorage;
});
