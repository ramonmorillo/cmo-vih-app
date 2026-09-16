import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClinicalRecordText } from '../assets/modules/export-layer.js';

const noopTranslate = (key) => key;

function baseState(overrides = {}) {
  return {
    locale: 'en',
    patientCase: {
      caseId: 'CASE-123',
      pseudonymizedPatientLabel: 'P-001',
      ...overrides
    }
  };
}

function baseAnalysis(overrides = {}) {
  return {
    priorityLabel: 'Priority 1',
    total: 18,
    followUp: 'Monthly',
    riskFlags: ['viralLoad'],
    interventions: ['Review adherence'],
    explainability: {
      keyDrivers: [{ label: 'Viral load', valueLabel: 'Detectable', score: 5 }]
    },
    traceability: { timestamp: '2026-09-16T10:00:00.000Z' },
    ...overrides
  };
}

test('buildClinicalRecordText includes case identifiers, score, drivers and disclaimer', () => {
  const text = buildClinicalRecordText(baseState(), baseAnalysis(), noopTranslate);

  assert.match(text, /CASE-123/);
  assert.match(text, /P-001/);
  assert.match(text, /Priority 1/);
  assert.match(text, /Viral load: Detectable \(\+5\)/);
  assert.match(text, /Review adherence/);
  assert.match(text, /legal\.clinicalDisclaimer/);
});

test('buildClinicalRecordText falls back to common.none when there are no drivers, flags or interventions', () => {
  const analysis = baseAnalysis({ riskFlags: [], interventions: [], explainability: { keyDrivers: [] } });
  const text = buildClinicalRecordText(baseState(), analysis, noopTranslate);

  const noneCount = (text.match(/common\.none/g) || []).length;
  assert.equal(noneCount, 3);
});

test('buildClinicalRecordText falls back to common.none when the patient label is missing', () => {
  const state = baseState({ pseudonymizedPatientLabel: '' });
  const text = buildClinicalRecordText(state, baseAnalysis(), noopTranslate);

  assert.match(text, /savedCases\.patientLabel: common\.none/);
});
