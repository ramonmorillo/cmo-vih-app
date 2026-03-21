import { APP_VERSION } from './config.js';

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
    `${translate('exports.timestamp')}: ${analysis.traceability.timestamp}`
  ].join('\n');
}

export function buildStructuredReport(state, analysis, translate) {
  return {
    version: APP_VERSION,
    locale: state.locale,
    caseId: state.patientCase.caseId,
    createdAt: state.patientCase.createdAt,
    updatedAt: state.patientCase.updatedAt,
    pseudonymizedPatientLabel: state.patientCase.pseudonymizedPatientLabel,
    storageRecommendation: translate('savedCases.helperStorage', { storage: translate(`savedCases.storageMode.${state.savedCases.storageMode}`) }),
    clinician: state.patientCase.clinician,
    traceability: analysis.traceability,
    narrative: state.patientCase.narrative,
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
    fields: state.patientCase.fields
  };
}

export function buildCsvExport(state, analysis) {
  const headers = ['version', 'caseId', 'patientLabel', 'timestamp', 'source', 'finalLevel', 'totalScore', 'followUp', 'riskFlags'];
  const row = [
    APP_VERSION,
    state.patientCase.caseId,
    state.patientCase.pseudonymizedPatientLabel || '',
    analysis.traceability.timestamp,
    analysis.traceability.inputSource,
    analysis.finalLevel,
    analysis.total,
    analysis.followUp,
    analysis.riskFlags.join('; ')
  ];
  return `${headers.join(',')}\n${row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')}`;
}

export function buildPrintableHtml(state, analysis, translate) {
  const drivers = analysis.explainability.keyDrivers.map((item) => `<li>${item.label}: ${item.valueLabel} (+${item.score})</li>`).join('');
  const flags = analysis.riskFlags.map((item) => `<li>${item}</li>`).join('');
  const interventions = analysis.interventions.map((item) => `<li>${item}</li>`).join('');

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
        <p class="muted">${translate('traceability.caseId')}: ${state.patientCase.caseId}</p>
        <p class="muted">${translate('savedCases.patientLabel')}: ${state.patientCase.pseudonymizedPatientLabel || translate('common.none')}</p>
        <p class="muted">${translate('exports.timestamp')}: ${analysis.traceability.timestamp}</p>
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
