import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFromNarrative } from '../assets/modules/ai-module.js';

const noopTranslate = (key) => key;

function fieldsFor(...ids) {
  return Object.fromEntries(ids.map((id) => [id, {}]));
}

function extractField(text, fieldId) {
  const result = extractFromNarrative(text, fieldsFor(fieldId), noopTranslate);
  return result.updates[fieldId];
}

// --- Positive extraction (unchanged baseline behavior) ---

test('pregnancy: extracts yes on a plain affirmative mention', () => {
  const update = extractField('Patient confirmed pregnant at 12 weeks.', 'pregnancy');
  assert.equal(update.value, 'yes');
  assert.equal(update.status, 'extracted');
});

test('ageBand: extracts over50 band from "52-year-old"', () => {
  const update = extractField('52-year-old man living with HIV.', 'ageBand');
  assert.equal(update.value, 'over50');
  assert.equal(update.evidence, '52');
});

test('ageBand: extracts band from Spanish "de 67 años"', () => {
  const update = extractField('Paciente de 67 años con VIH.', 'ageBand');
  assert.equal(update.value, 'over65');
});

test('comorbidities: two or more distinct terms classify as high', () => {
  const update = extractField('Comorbidities include diabetes, hypertension, and dyslipidemia.', 'comorbidities');
  assert.equal(update.value, 'high');
});

test('comorbidities: a single term classifies as low', () => {
  const update = extractField('History of diabetes.', 'comorbidities');
  assert.equal(update.value, 'low');
});

test('polypharmacy: "polimedicado" alone implies high', () => {
  const update = extractField('Paciente polimedicado en seguimiento.', 'polypharmacy');
  assert.equal(update.value, 'high');
});

test('polypharmacy: medication count below 6 classifies as low', () => {
  const update = extractField('Takes 3 total medications daily.', 'polypharmacy');
  assert.equal(update.value, 'low');
});

test('viralLoad: "viral load undetectable" is not misread as detectable', () => {
  const update = extractField('Viral load is undetectable on current regimen.', 'viralLoad');
  assert.equal(update.value, 'undetectable');
});

test('viralLoad: explicit detectable value is extracted', () => {
  const update = extractField('Viral load remains detectable this visit.', 'viralLoad');
  assert.equal(update.value, 'detectable');
});

// --- Negation handling (v3 fix) ---

test('pregnancy: a preceding negation cue in the same clause does not extract yes', () => {
  const update = extractField('No pregnancy suspected during this visit.', 'pregnancy');
  assert.equal(update, undefined);
});

test('depression: "niega" (Spanish denial) does not extract yes', () => {
  const update = extractField('Paciente niega sintomatología depresiva en la entrevista.', 'depression');
  assert.equal(update, undefined);
});

test('substanceUse: "denies substance use" does not extract yes', () => {
  const update = extractField('Patient denies substance use of any kind.', 'substanceUse');
  assert.equal(update, undefined);
});

test('comorbidities: a negated term is excluded from the aggregate count', () => {
  const update = extractField('No hypertension. Diabetes confirmed on labs.', 'comorbidities');
  assert.equal(update.value, 'low');
  assert.equal(update.evidence, 'Diabetes');
});

// Known limitation (documented in ai-module.js): "viral load is not detectable" is NOT caught,
// because the negation word falls inside the wildcard span between the anchor ("viral load") and
// the target term ("detectable"), not before the match start. This heuristic only inspects text
// preceding the match. Left as a false positive here rather than papering over it with a fix that
// would break adherenceArt's "no toma correctamente" pattern (see ai-module.js comment).
test('viralLoad: interior negation ("is not detectable") is a known false positive, not silently fixed', () => {
  const update = extractField('Viral load is not detectable at this stage.', 'viralLoad');
  assert.equal(update.value, 'detectable');
});

test('frailty: negation in an earlier, unrelated sentence does not suppress a later positive clause', () => {
  const update = extractField('Denies alcohol misuse. Frailty confirmed on assessment.', 'frailty');
  assert.equal(update.value, 'yes');
});

// --- Hospitalization recency (v3 fix) ---

test('hospitalization: recent mention with an explicit 6-month marker extracts recent', () => {
  const update = extractField('One hospitalization in the past 6 months due to decompensation.', 'hospitalization');
  assert.equal(update.value, 'recent');
});

test('hospitalization: "recent hospitalization" without a month figure still extracts recent', () => {
  const update = extractField('Recent hospitalization for decompensation last week.', 'hospitalization');
  assert.equal(update.value, 'recent');
});

test('hospitalization: a bare mention with no recency marker no longer auto-classifies as recent', () => {
  const update = extractField('History of hospitalization several years ago for an unrelated condition.', 'hospitalization');
  assert.equal(update, undefined);
});

// --- comorbidityGoals left untouched (explicit scope decision) ---

test('comorbidityGoals: existing hardcoded-threshold behavior is unchanged', () => {
  const update = extractField('HbA1c 8.2% and blood pressure 145/90 mmHg, goals remain unmet.', 'comorbidityGoals');
  assert.equal(update.value, 'notAchieved');
});

// --- Missing data stays missing (no fabrication) ---

test('no fabrication: an unmentioned field is reported as missing, not guessed', () => {
  const result = extractFromNarrative('Patient on stable ART regimen.', fieldsFor('frailty'), noopTranslate);
  assert.deepEqual(result.missing, ['frailty']);
  assert.equal(result.updates.frailty, undefined);
});
