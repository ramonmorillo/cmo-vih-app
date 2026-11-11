// Puerta de revisión profesional de CMO-VIH (flujo, no lógica clínica).
// El motor (cmo-engine.js) no se modifica: recibe una VISTA del caso en la que
//  - las propuestas del análisis de texto sin confirmar se tratan como no valoradas, y
//  - la modificación del clínico solo se aplica si tiene la justificación exigida.
// Una variable no valorada nunca se interpreta como negativa: no puntúa y el resultado queda provisional.
import { FIELD_DEFINITIONS } from './config.js';

export const OVERRIDE_MIN_REASON = 12;

/** Propuesta del análisis de texto con valor pero sin confirmación del profesional. */
export const isUnconfirmedProposal = (fieldState) => Boolean(fieldState && fieldState.source === 'ai' && !fieldState.clinicianConfirmed && fieldState.value);

export const unconfirmedFieldIds = (patientCase) => FIELD_DEFINITIONS.filter((field) => isUnconfirmedProposal(patientCase.fields?.[field.id])).map((field) => field.id);

/** ¿La modificación del clínico tiene efecto? Exige nivel válido y justificación. */
export function overrideInEffect(override) {
  return Boolean(override?.enabled) && [1, 2, 3].includes(Number(override.level)) && String(override.reason || '').trim().length >= OVERRIDE_MIN_REASON;
}

/** Caso que se entrega al motor: sin propuestas sin confirmar y sin modificaciones sin justificar. */
export function scoringView(patientCase) {
  const fields = { ...patientCase.fields };
  for (const id of unconfirmedFieldIds(patientCase)) fields[id] = { ...fields[id], value: '' };
  const override = overrideInEffect(patientCase.override) ? patientCase.override : { ...patientCase.override, enabled: false };
  return { ...patientCase, fields, override };
}

/** Información de revisión para la interfaz y las salidas, calculada a partir del caso y del resultado del motor. */
export function reviewSummary(patientCase, analysis) {
  const unconfirmed = unconfirmedFieldIds(patientCase);
  const missing = analysis.explainability.missing.length - unconfirmed.length;
  const requested = Boolean(patientCase.override?.enabled) && patientCase.override.level !== 'auto';
  const applied = overrideInEffect(patientCase.override);
  const ruleFired = FIELD_DEFINITIONS.some((field) => field.automaticPriority && field.automaticPriority[scoringView(patientCase).fields[field.id]?.value]);
  return {
    unconfirmed,
    missing,
    provisional: missing > 0 || unconfirmed.length > 0,
    overrideRequested: requested,
    overrideApplied: applied,
    overrideNotApplied: requested && !applied,
    overrideLowersAutomatic: applied && ruleFired && Number(patientCase.override.level) > analysis.automaticLevel
  };
}

/** Líneas comunes de estado para todas las salidas de texto (resumen, historia clínica, impresión). */
export function reviewLines(patientCase, analysis, translate) {
  const review = analysis.review;
  if (!review) return [];
  const lines = [`${translate('exports.status')}: ${review.provisional ? translate('gate.provisionalTitle') : translate('exports.final')}`];
  if (review.provisional) lines.push(translate('gate.provisionalDetail', { missing: review.missing, unconfirmed: review.unconfirmed.length }));
  if (analysis.automaticLevel !== analysis.finalLevel || review.overrideApplied) lines.push(`${translate('exports.automaticLevel')}: ${analysis.automaticPriorityLabel}`);
  if (review.overrideApplied) lines.push(translate('exports.overrideLine', { level: analysis.priorityLabel, reason: String(patientCase.override.reason).trim() }));
  if (review.overrideLowersAutomatic) lines.push(translate('gate.overrideLowersAuto'));
  return lines;
}

/** Valores admitidos por el modelo para cada variable (los de config.js). */
const VALID = Object.fromEntries(FIELD_DEFINITIONS.map((field) => [field.id, new Set(field.optionKeys)]));
export const isValidFieldValue = (fieldId, value) => Boolean(VALID[fieldId]) && VALID[fieldId].has(value);

/** Importación segura: solo variables del modelo con valores admitidos; el resto se descarta y se informa. */
export function sanitizeImportedRecord(record) {
  const clean = {}; const rejected = [];
  const source = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
  for (const field of FIELD_DEFINITIONS) {
    const raw = source[field.id];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const value = String(raw).trim();
    if (isValidFieldValue(field.id, value)) clean[field.id] = value; else rejected.push(field.id);
  }
  if (typeof source.pseudonymizedPatientLabel === 'string') clean.pseudonymizedPatientLabel = source.pseudonymizedPatientLabel.trim().replace(/^'(?=[=+\-@])/, '').slice(0, 80);
  return { clean, rejected };
}
