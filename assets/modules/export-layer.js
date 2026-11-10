import { APP_VERSION } from './config.js';
import { isUnconfirmedProposal, reviewLines } from './review-gate.js';

export const EXPORT_SCHEMA = 'cmo-vih-export/1';
// Una celda que empieza por = + - @ se neutraliza para que una hoja de cálculo no la ejecute como fórmula.
const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

// Campos exportables: una propuesta sin confirmar no se exporta (ni su valor ni el fragmento de texto que la originó).
const exportableFields = (patientCase) => Object.fromEntries(Object.entries(patientCase.fields).map(([id, field]) => [id, isUnconfirmedProposal(field) ? { ...field, value: '', status: 'missing', evidence: '', suggestedValue: '' } : field]));

export function buildClinicalSummary(state, analysis, translate) {
  return [
    `${translate('exports.summaryTitle')}: ${analysis.priorityLabel}`,
    `${translate('traceability.caseId')}: ${state.patientCase.caseId}`,
    `${translate('savedCases.patientLabel')}: ${state.patientCase.pseudonymizedPatientLabel || translate('common.none')}`,
    `${translate('exports.totalScore')}: ${analysis.total}`,
    `${translate('exports.followUp')}: ${analysis.followUp}`,
    `${translate('exports.keyDrivers')}: ${analysis.explainability.keyDrivers.map((item) => item.label).join(', ') || translate('common.none')}`,
    `${translate('exports.riskFlags')}: ${analysis.riskFlags.join(', ') || translate('common.none')}`,
    `${translate('exports.source')}: ${analysis.traceability.inputSource}`,
    `${translate('exports.timestamp')}: ${analysis.traceability.timestamp}`,
    ...reviewLines(state.patientCase, analysis, translate)
  ].join('\n');
}

export function buildStructuredReport(state, analysis, translate) {
  return {
    schema: EXPORT_SCHEMA,
    version: APP_VERSION,
    locale: state.locale,
    caseId: state.patientCase.caseId,
    createdAt: state.patientCase.createdAt,
    updatedAt: state.patientCase.updatedAt,
    pseudonymizedPatientLabel: state.patientCase.pseudonymizedPatientLabel,
    storageRecommendation: translate('savedCases.helperStorage', { storage: translate(`savedCases.storageMode.${state.savedCases.storageMode}`) }),
    clinician: state.patientCase.clinician,
    traceability: analysis.traceability,
    // El texto clínico pegado no se exporta: solo datos estructurados confirmados.
    status: analysis.review?.provisional ? 'provisional' : 'final',
    review: analysis.review ? { pendingVariables: analysis.review.missing, unconfirmedProposals: analysis.review.unconfirmed } : null,
    override: state.patientCase.override,
    analysis: {
      total: analysis.total,
      automaticLevel: analysis.automaticLevel,
      finalLevel: analysis.finalLevel,
      priorityLabel: analysis.priorityLabel,
      followUp: analysis.followUp,
      sectionScores: analysis.sectionScores,
      riskFlags: analysis.riskFlags,
      interventions: analysis.interventions,
      explainability: analysis.explainability
    },
    fields: exportableFields(state.patientCase)
  };
}

export function buildClinicalRecordText(state, analysis, translate) {
  const locale = state.locale === 'es' ? 'es-ES' : state.locale === 'pt' ? 'pt-BR' : 'en-US';
  const timestamp = new Date(analysis.traceability.timestamp).toLocaleString(locale);
  const drivers = analysis.explainability.keyDrivers
    .map((item) => `- ${item.label}: ${item.valueLabel} (+${item.score})`)
    .join('\n') || `- ${translate('common.none')}`;
  const interventions = analysis.interventions.length
    ? analysis.interventions.map((item) => `- ${item}`).join('\n')
    : `- ${translate('common.none')}`;

  return [
    `${translate('exports.summaryTitle')} — ${APP_VERSION}`,
    `${translate('traceability.caseId')}: ${state.patientCase.caseId} | ${translate('savedCases.patientLabel')}: ${state.patientCase.pseudonymizedPatientLabel || translate('common.none')}`,
    `${translate('exports.timestamp')}: ${timestamp}`,
    '',
    `${analysis.priorityLabel} (${translate('exports.totalScore')}: ${analysis.total})`,
    `${translate('exports.followUp')}: ${analysis.followUp}`,
    ...reviewLines(state.patientCase, analysis, translate),
    '',
    `${translate('exports.keyDrivers')}:`,
    drivers,
    '',
    `${translate('exports.riskFlags')}: ${analysis.riskFlags.join('; ') || translate('common.none')}`,
    '',
    `${translate('dashboard.suggestedInterventions')}:`,
    interventions,
    '',
    translate('legal.clinicalDisclaimer')
  ].join('\n');
}

export function buildCsvExport(state, analysis) {
  const headers = ['version', 'caseId', 'patientLabel', 'timestamp', 'source', 'finalLevel', 'totalScore', 'followUp', 'riskFlags', 'status', 'automaticLevel', 'overrideLevel', 'overrideReason', 'pendingVariables', 'unconfirmedProposals'];
  const review = analysis.review;
  const row = [
    APP_VERSION,
    state.patientCase.caseId,
    state.patientCase.pseudonymizedPatientLabel || '',
    analysis.traceability.timestamp,
    analysis.traceability.inputSource,
    analysis.finalLevel,
    analysis.total,
    analysis.followUp,
    analysis.riskFlags.join('; '),
    review?.provisional ? 'provisional' : 'final',
    analysis.automaticLevel,
    review?.overrideApplied ? analysis.finalLevel : '',
    review?.overrideApplied ? String(state.patientCase.override.reason).trim() : '',
    review?.missing ?? '',
    review?.unconfirmed.length ?? ''
  ];
  return `${headers.join(',')}\n${row.map(csvCell).join(',')}`;
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function buildPrintableHtml(state, analysis, translate) {
  const drivers = analysis.explainability.keyDrivers.map((item) => `<li>${esc(item.label)}: ${esc(item.valueLabel)} (+${esc(item.score)})</li>`).join('');
  const flags = analysis.riskFlags.map((item) => `<li>${esc(item)}</li>`).join('');
  const interventions = analysis.interventions.map((item) => `<li>${esc(item)}</li>`).join('');

  return `
    <html>
      <head>
        <title>${APP_VERSION}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
          h1, h2 { color: #8b1e3f; }
          .muted { color: #6b7280; }
          .panel { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; margin: 16px 0; }
        </style>
      </head>
      <body>
        <h1>${APP_VERSION}</h1>
        <p class="muted">${translate('traceability.caseId')}: ${esc(state.patientCase.caseId)}</p>
        <p class="muted">${translate('savedCases.patientLabel')}: ${esc(state.patientCase.pseudonymizedPatientLabel || translate('common.none'))}</p>
        <p class="muted">${translate('exports.timestamp')}: ${esc(analysis.traceability.timestamp)}</p>
        ${reviewLines(state.patientCase, analysis, translate).map((line) => `<p class="muted">${esc(line)}</p>`).join('')}
        <div class="panel">
          <h2>${translate('exports.summaryTitle')}</h2>
          <p>${analysis.priorityLabel}</p>
          <p>${translate('exports.totalScore')}: ${analysis.total}</p>
          <p>${translate('exports.followUp')}: ${analysis.followUp}</p>
        </div>
        <div class="panel">
          <h2>${translate('exports.keyDrivers')}</h2>
          <ul>${drivers || `<li>${translate('common.none')}</li>`}</ul>
        </div>
        <div class="panel">
          <h2>${translate('exports.riskFlags')}</h2>
          <ul>${flags || `<li>${translate('common.none')}</li>`}</ul>
        </div>
        <div class="panel">
          <h2>${translate('dashboard.suggestedInterventions')}</h2>
          <ul>${interventions}</ul>
        </div>
      </body>
    </html>
  `;
}

export function downloadBlob(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
