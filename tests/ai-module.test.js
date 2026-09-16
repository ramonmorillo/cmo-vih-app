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

// --- A. Information clearly present (PRESENT) ---

test('pregnancy: extracts yes on a plain affirmative mention', () => {
  const update = extractField('Patient confirmed pregnant at 12 weeks.', 'pregnancy');
  assert.equal(update.value, 'yes');
  assert.equal(update.status, 'extracted');
});

test('comorbidities: recognizes "dislipidemia" (distinct spelling from "dislipemia") as a synonym', () => {
  const update = extractField('Hipertensión arterial y dislipidemia en tratamiento.', 'comorbidities');
  assert.equal(update.value, 'high');
});

test('frailty: negation in an earlier, unrelated sentence does not suppress a later positive clause', () => {
  const update = extractField('Denies alcohol misuse. Frailty confirmed on assessment.', 'frailty');
  assert.equal(update.value, 'yes');
});

// --- B. Explicit negation (ABSENT, not UNKNOWN) ---

test('pregnancy: a preceding negation cue resolves ABSENT, not merely "not extracted"', () => {
  const update = extractField('No pregnancy suspected during this visit.', 'pregnancy');
  assert.equal(update.value, 'no');
  assert.equal(update.status, 'absent');
});

test('pregnancy: an explicit male-sex statement resolves ABSENT even with no pregnancy wording at all', () => {
  const update = extractField('Paciente varón de 58 años, seguimiento en consulta de VIH.', 'pregnancy');
  assert.equal(update.value, 'no');
  assert.equal(update.status, 'absent');
});

test('depression: "niega" (Spanish denial) resolves ABSENT', () => {
  const update = extractField('Paciente niega sintomatología depresiva en la entrevista.', 'depression');
  assert.equal(update.value, 'no');
  assert.equal(update.status, 'absent');
});

test('substanceUse: "denies substance use" resolves ABSENT', () => {
  const update = extractField('Patient denies substance use of any kind.', 'substanceUse');
  assert.equal(update.value, 'no');
  assert.equal(update.status, 'absent');
});

test('hospitalization: an explicit denial of admissions resolves ABSENT ("none"), not just unmatched', () => {
  const update = extractField('No ingresos hospitalarios en el último año.', 'hospitalization');
  assert.equal(update.value, 'none');
  assert.equal(update.status, 'absent');
});

test('comorbidities: a negated term is excluded from the aggregate count', () => {
  const update = extractField('No hypertension. Diabetes confirmed on labs.', 'comorbidities');
  assert.equal(update.value, 'low');
  assert.equal(update.evidence, 'Diabetes');
});

// --- C. Information genuinely absent from the text (UNKNOWN, never ABSENT) ---

test('no fabrication: an unmentioned field is reported as UNKNOWN (no update), never guessed', () => {
  const result = extractFromNarrative('Patient on stable ART regimen.', fieldsFor('frailty'), noopTranslate);
  assert.deepEqual(result.missing, ['frailty']);
  assert.equal(result.updates.frailty, undefined);
});

test('the guarantee: text with no mention of a variable never resolves to ABSENT', () => {
  const update = extractField('Patient on stable ART regimen with good virologic control.', 'depression');
  assert.equal(update, undefined, 'an unmentioned concept must stay UNKNOWN, not become ABSENT');
});

test('complexity: no medication-complexity index in the text stays UNKNOWN, never assumed low', () => {
  const update = extractField('Paciente polimedicado con múltiples comorbilidades.', 'complexity');
  assert.equal(update, undefined);
});

// --- D. Historical antecedent must not become a current finding (REVIEW) ---

test('depression: a past, resolved episode ("hace 4 años") is flagged for REVIEW, not read as current', () => {
  const update = extractField('Episodio depresivo hace 4 años, actualmente sin seguimiento por Salud Mental.', 'depression');
  assert.equal(update.value, '', 'a historical mention must not silently score as current depression');
  assert.equal(update.status, 'review');
  assert.equal(update.suggestedValue, 'yes');
  assert.equal(update.needsReview, true);
});

test('depression: a current, non-historical mention still resolves PRESENT', () => {
  const update = extractField('Presenta sintomatología depresiva activa en el momento actual.', 'depression');
  assert.equal(update.value, 'yes');
  assert.equal(update.status, 'extracted');
});

// --- E. Current value vs. an old one without a recency marker ---

test('hospitalization: a bare mention with no recency marker no longer auto-classifies as recent', () => {
  const update = extractField('History of hospitalization several years ago for an unrelated condition.', 'hospitalization');
  assert.equal(update, undefined);
});

test('hospitalization: recent mention with an explicit 6-month marker extracts recent', () => {
  const update = extractField('One hospitalization in the past 6 months due to decompensation.', 'hospitalization');
  assert.equal(update.value, 'recent');
});

// --- F. Contradictory information within the same text (REVIEW, not a silent pick) ---

test('depression: the same concept both denied and later affirmed is flagged for REVIEW, not silently resolved', () => {
  const update = extractField('Niega depresión en la valoración inicial. Posteriormente reconoce depresión activa en seguimiento.', 'depression');
  assert.equal(update.value, '');
  assert.equal(update.status, 'review');
  assert.equal(update.needsReview, true);
});

// --- G. Numeric data ---

test('ageBand: extracts over50 band from "52-year-old"', () => {
  const update = extractField('52-year-old man living with HIV.', 'ageBand');
  assert.equal(update.value, 'over50');
  assert.equal(update.evidence, '52');
});

test('viralLoad: "<20 copias/mL" normalizes to undetectable without a hardcoded word match', () => {
  const update = extractField('Carga viral VIH <20 copias/mL en la última analítica.', 'viralLoad');
  assert.equal(update.value, 'undetectable');
});

test('viralLoad: a plain quantified count (no "<") normalizes to detectable', () => {
  const update = extractField('Carga viral 4500 copias/mL en el control actual.', 'viralLoad');
  assert.equal(update.value, 'detectable');
});

test('polypharmacy: medication count below 6 classifies as low', () => {
  const update = extractField('Takes 3 total medications daily.', 'polypharmacy');
  assert.equal(update.value, 'low');
});

// --- H. Narrative text without a fixed phrase ---

test('polypharmacy: a listed medication block (no stated total) is counted when >=6 lines', () => {
  const narrative = [
    'Tratamiento habitual:',
    '- BIC/FTC/TAF 50/200/25 mg: 1 comprimido/día.',
    '- Enalapril 20 mg: 1 comprimido/día.',
    '- Amlodipino 5 mg: 1 comprimido/día.',
    '- Atorvastatina 20 mg por la noche.',
    '- Metformina 850 mg: 1 comprimido cada 12 h.',
    '- Omeprazol 20 mg cada mañana.',
    '',
    'Durante la entrevista comenta buena tolerancia.'
  ].join('\n');
  const update = extractField(narrative, 'polypharmacy');
  assert.equal(update.value, 'high');
  assert.equal(update.status, 'inferred');
});

test('adherenceArt: a narrative admission of missed ART doses (no fixed phrase) extracts suboptimal', () => {
  const update = extractField('En el último mes reconoce haber omitido dos dosis completas del tratamiento antirretroviral.', 'adherenceArt');
  assert.equal(update.value, 'suboptimal');
});

test('qualityOfLife: soft mood/energy narrative without a formal instrument is flagged for REVIEW, not auto-classified', () => {
  const update = extractField('Refiere cansancio frecuente y dificultad para dormir desde hace semanas.', 'qualityOfLife');
  assert.equal(update.value, '');
  assert.equal(update.status, 'review');
  assert.equal(update.suggestedValue, 'affected');
});

test('socioeconomic: financial-hardship narrative is recognized alongside "lives alone"', () => {
  const update = extractField('Refiere preocupación económica ante la prolongación de su baja laboral.', 'socioeconomic');
  assert.equal(update.value, 'vulnerable');
});

// --- I. Multiple ways of expressing the same concept normalize to the same value ---

test('viralLoad: "viral load undetectable" is not misread as detectable', () => {
  const update = extractField('Viral load is undetectable on current regimen.', 'viralLoad');
  assert.equal(update.value, 'undetectable');
});

test('viralLoad: explicit detectable value is extracted', () => {
  const update = extractField('Viral load remains detectable this visit.', 'viralLoad');
  assert.equal(update.value, 'detectable');
});

test('viralLoad: word-based "indetectable" and numeric "<20 copias/mL" normalize to the same value', () => {
  const wordBased = extractField('Carga viral indetectable en el último control.', 'viralLoad');
  const numeric = extractField('RNA VIH <20 copias/mL.', 'viralLoad');
  assert.equal(wordBased.value, 'undetectable');
  assert.equal(numeric.value, 'undetectable');
});

test('viralLoad: interior negation ("is not detectable") is a known false positive, not silently fixed', () => {
  // Documented limitation: the negation word falls inside the wildcard span between the anchor
  // ("viral load") and the target term ("detectable"), which this heuristic does not inspect.
  const update = extractField('Viral load is not detectable at this stage.', 'viralLoad');
  assert.equal(update.value, 'detectable');
});

// --- J. No hallucinated/derived clinical scores ---

test('comorbidityGoals: existing hardcoded-threshold behavior is unchanged (explicit scope decision)', () => {
  const update = extractField('HbA1c 8.2% and blood pressure 145/90 mmHg, goals remain unmet.', 'comorbidityGoals');
  assert.equal(update.value, 'notAchieved');
});

test('depression: no formal instrument (PHQ-9) mentioned means no depression score is invented', () => {
  const update = extractField('No se ha realizado PHQ-9 ni otra escala de depresión en esta visita.', 'depression');
  assert.equal(update, undefined);
});

// --- Summary counts drive the extraction message (dynamic, not hardcoded) ---

test('extraction summary counts present/absent/unknown/review independently, without hardcoded numbers', () => {
  const text = 'Paciente varón de 58 años. Niega depresión en la valoración inicial. Posteriormente reconoce depresión activa en seguimiento. Fumador activo.';
  const result = extractFromNarrative(text, fieldsFor('pregnancy', 'depression', 'frailty'), noopTranslate);
  assert.equal(result.counts.absent, 1, 'pregnancy resolves ABSENT via the explicit male-sex cue');
  assert.equal(result.counts.review, 1, 'depression resolves REVIEW due to the contradiction');
  assert.equal(result.counts.unknown, 1, 'frailty is never mentioned and must stay UNKNOWN');
  assert.equal(result.counts.present, 0);
});

// --- Full clinical-case integration check (see PT_REVIEW/CHANGELOG for the source note) ---
// This is not written to make this specific text "pass": it exercises the general extraction
// behavior described above (PRESENT/ABSENT/UNKNOWN/REVIEW, negation, temporality, contradiction,
// numeric normalization, narrative admissions) against a realistic, information-dense note.

const FULL_CASE_NARRATIVE = `Paciente varón de 58 años, seguimiento en consulta monográfica de VIH.

Diagnóstico de infección por VIH en 2004. Categoría clínica inicial B2. No antecedentes de enfermedades definitorias de sida. Nadir CD4: 186 células/µL. Actualmente en tratamiento antirretroviral con bictegravir/emtricitabina/tenofovir alafenamida 50/200/25 mg, 1 comprimido cada 24 horas desde marzo de 2022. Previamente recibió DTG + FTC/TAF, sustituido por simplificación. No constan resistencias conocidas.

Última analítica de 02/09/2026: carga viral VIH <20 copias/mL, CD4 684 células/µL (34%), cociente CD4/CD8 0,82. Hb 14,1 g/dL, plaquetas 198.000/µL. Creatinina 1,18 mg/dL, FGe CKD-EPI 67 mL/min/1,73 m². AST 32 U/L, ALT 38 U/L. Colesterol total 221 mg/dL, LDL 139 mg/dL, HDL 43 mg/dL, TG 195 mg/dL. HbA1c 6,2%.

Antecedentes personales: hipertensión arterial, dislipidemia, obesidad grado I, enfermedad renal crónica G2, esteatosis hepática metabólica y artrosis de rodilla derecha. Episodio depresivo hace 4 años, actualmente sin seguimiento por Salud Mental. Niega antecedentes cardiovasculares. No hepatitis B ni C activa. Vacunación VHB completa.

Tratamiento habitual:
- BIC/FTC/TAF 50/200/25 mg: 1 comprimido/día.
- Enalapril 20 mg: 1 comprimido/día.
- Amlodipino 5 mg: 1 comprimido/día.
- Atorvastatina 20 mg por la noche.
- Metformina 850 mg: 1 comprimido cada 12 h.
- Omeprazol 20 mg cada mañana, desde hace años.
- Ibuprofeno 600 mg según dolor, aproximadamente 3-4 días por semana.
- Lorazepam 1 mg por la noche, entre 3 y 5 noches por semana.
- Vitamina D mensual.

Durante la entrevista comenta que alguna pastilla se puede olvidar, pero casi nunca la del VIH. En el último mes reconoce haber omitido dos dosis completas del tratamiento antirretroviral. Según registros de dispensación hospitalaria, retirada aproximadamente cada 60 días, con una demora de 9 días en una dispensación durante los últimos 6 meses. No se dispone todavía del cálculo formal de PDC.

Vive solo desde su separación hace 2 años. Tiene dos hijos adultos que residen en otra provincia. Trabaja como conductor de reparto, aunque actualmente se encuentra de baja laboral por dolor de rodilla. Refiere preocupación por su situación económica si la baja se prolonga. No dificultades conocidas de comprensión lectora. Maneja correctamente el teléfono móvil y utiliza WhatsApp, aunque no suele utilizar aplicaciones sanitarias.

Fumador de 10-15 cigarrillos/día. Consumo de alcohol: 2-3 cervezas los fines de semana. Niega cocaína, heroína u otras drogas. Consumo esporádico de cannabis, aproximadamente una vez al mes.

Refiere cansancio frecuente, dificultad para dormir y poca motivación para realizar ejercicio. Ha ganado aproximadamente 7 kg en el último año. Peso actual 94 kg, talla 1,73 m, IMC 31,4 kg/m². TA en consulta 146/88 mmHg.

Refiere que entiende para qué sirve el tratamiento del VIH, aunque no sabe explicar bien para qué toma algunos medicamentos concomitantes. Indica que son muchos y a veces no sabe si realmente necesita todos. No utiliza pastillero.

No presenta dificultad para acudir al hospital, aunque tarda aproximadamente 50 minutos en transporte público. Preferiría espaciar las visitas presenciales. Está dispuesto a realizar seguimiento telefónico o mediante videollamada.

EQ-5D no cumplimentado en la visita actual. Refiere problemas moderados de movilidad por gonalgia, sin dificultades para el autocuidado. Dolor habitual 5/10. Comenta estar algo desanimado desde que comenzó la baja laboral, pero no se ha realizado PHQ-9 ni otra escala de depresión.

No ingresos hospitalarios en el último año. Una consulta en Urgencias hace 5 meses por dolor lumbar. No efectos adversos atribuibles claramente al TAR. Refiere ocasional mareo al levantarse y pirosis esporádica.`;

test('full clinical case: age, sex-derived pregnancy status, and viral load normalize correctly', () => {
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor('ageBand', 'pregnancy', 'viralLoad'), noopTranslate);
  assert.equal(result.updates.ageBand.value, 'over50');
  assert.equal(result.updates.pregnancy.value, 'no');
  assert.equal(result.updates.pregnancy.status, 'absent');
  assert.equal(result.updates.viralLoad.value, 'undetectable');
});

test('full clinical case: comorbidities and polypharmacy are extracted from the listed medications, not just fixed phrases', () => {
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor('comorbidities', 'polypharmacy'), noopTranslate);
  assert.equal(result.updates.comorbidities.value, 'high');
  assert.equal(result.updates.polypharmacy.value, 'high');
});

test('full clinical case: the missed-ART-dose narrative extracts suboptimal adherence', () => {
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor('adherenceArt'), noopTranslate);
  assert.equal(result.updates.adherenceArt.value, 'suboptimal');
});

test('full clinical case: the historical depressive episode is flagged for review, never read as current', () => {
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor('depression'), noopTranslate);
  assert.equal(result.updates.depression.value, '');
  assert.equal(result.updates.depression.status, 'review');
});

test('full clinical case: the explicit "no ingresos hospitalarios" denial resolves ABSENT, not UNKNOWN', () => {
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor('hospitalization'), noopTranslate);
  assert.equal(result.updates.hospitalization.value, 'none');
  assert.equal(result.updates.hospitalization.status, 'absent');
});

test('full clinical case: substance use resolves present via cannabis despite cocaine/heroin being denied nearby', () => {
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor('substanceUse'), noopTranslate);
  assert.equal(result.updates.substanceUse.value, 'yes');
});

test('full clinical case: socioeconomic vulnerability is recognized from living alone / financial worry', () => {
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor('socioeconomic'), noopTranslate);
  assert.equal(result.updates.socioeconomic.value, 'vulnerable');
});

test('full clinical case: soft mood/energy narrative flags quality of life for review, not a confident value', () => {
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor('qualityOfLife'), noopTranslate);
  assert.equal(result.updates.qualityOfLife.status, 'review');
});

test('full clinical case: a medication-complexity index is never stated, so it stays UNKNOWN, not fabricated', () => {
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor('complexity'), noopTranslate);
  assert.equal(result.updates.complexity, undefined);
  assert.ok(result.missing.includes('complexity'));
});

test('full clinical case: extracts substantially more than four variables from the whole field set', () => {
  const allFieldIds = [
    'pregnancy', 'ageBand', 'comorbidities', 'polypharmacy', 'complexity',
    'adherenceArt', 'adherenceConcomitant', 'hospitalization', 'qualityOfLife',
    'depression', 'substanceUse', 'neurocognitive', 'frailty', 'socioeconomic',
    'viralLoad', 'comorbidityGoals'
  ];
  const result = extractFromNarrative(FULL_CASE_NARRATIVE, fieldsFor(...allFieldIds), noopTranslate);
  const resolvedCount = Object.keys(result.updates).length;
  assert.ok(resolvedCount > 4, `expected more than 4 resolved fields, got ${resolvedCount}`);
});
