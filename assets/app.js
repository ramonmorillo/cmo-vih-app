import { APP_VERSION, EXAMPLE_CASE, FIELD_DEFINITIONS } from './modules/config.js';
import { extractFromNarrative } from './modules/ai-module.js';
import { evaluateCase } from './modules/cmo-engine.js';
import {
  applyImportedRecord,
  createDefaultState,
  loadState,
  parseCsvImport,
  parseJsonImport,
  saveState,
  setOverride,
  updateClinician,
  updateField,
  updateNarrative
} from './modules/data-layer.js';
import {
  buildClinicalSummary,
  buildCsvExport,
  buildPrintableHtml,
  buildStructuredReport,
  downloadBlob
} from './modules/export-layer.js';
import { loadLocale, t } from './modules/i18n.js';
import { renderApp } from './modules/ui.js';

let state = createDefaultState();

function recomputeAnalysis() {
  state.patientCase.version = APP_VERSION;
  state.analysis = evaluateCase(state.patientCase, t);
}

function persistAndRender() {
  recomputeAnalysis();
  state = saveState(state);
  render();
}

function applyFieldUpdate(fieldId, value, source = 'manual', status = 'confirmed', evidence = t('common.clinicianEntered')) {
  state = updateField(state, fieldId, {
    value,
    source,
    status,
    evidence,
    clinicianConfirmed: source === 'manual' || status === 'confirmed'
  });
}

function handleManualChange(event) {
  const fieldId = event.target.dataset.fieldId;
  if (!fieldId) return;
  applyFieldUpdate(fieldId, event.target.value || '', 'manual', event.target.value ? 'confirmed' : 'missing', event.target.value ? t('common.clinicianConfirmed') : '');
  state.patientCase.source = 'manual';
  persistAndRender();
}

function handleNarrativeChange(event) {
  state = updateNarrative(state, event.target.value, 'manual');
  persistAndRender();
}

function handleAnalyzeText() {
  const narrative = document.getElementById('narrativeInput').value.trim();
  state = updateNarrative(state, narrative, 'ai');
  const extraction = extractFromNarrative(narrative, state.patientCase.fields, t);
  state.patientCase.notes = extraction.explanation;
  Object.entries(extraction.updates).forEach(([fieldId, payload]) => {
    state = updateField(state, fieldId, payload);
  });
  persistAndRender();
  window.alert(`${t('ai.analysisComplete')}\n${extraction.explanation}`);
}

function handleLoadExample() {
  state = updateNarrative(state, EXAMPLE_CASE.narrative, 'manual');
  persistAndRender();
}

function handleImport() {
  const importType = document.getElementById('importType').value;
  const raw = document.getElementById('importInput').value.trim();
  if (!raw) {
    window.alert(t('inputs.importEmpty'));
    return;
  }
  try {
    const record = importType === 'json' ? parseJsonImport(raw) : parseCsvImport(raw);
    state = applyImportedRecord(state, record, 'import');
    persistAndRender();
  } catch (error) {
    window.alert(`${t('inputs.importError')}: ${error.message}`);
  }
}

function handleOverride() {
  state = setOverride(state, {
    enabled: document.getElementById('overrideEnabled').checked,
    level: document.getElementById('overrideLevel').value,
    reason: document.getElementById('overrideReason').value.trim()
  });
  persistAndRender();
}

function handleClinicianUpdate() {
  state = updateClinician(state, {
    name: document.getElementById('clinicianName').value,
    center: document.getElementById('centerName').value
  });
  persistAndRender();
}

function exportSummary() {
  if (!state.analysis) return;
  downloadBlob('cmo-vih-summary.txt', buildClinicalSummary(state, state.analysis, t));
}

function exportJson() {
  if (!state.analysis) return;
  downloadBlob('cmo-vih-report.json', JSON.stringify(buildStructuredReport(state, state.analysis, t), null, 2), 'application/json;charset=utf-8');
}

function exportCsv() {
  if (!state.analysis) return;
  downloadBlob('cmo-vih-research.csv', buildCsvExport(state, state.analysis, t), 'text/csv;charset=utf-8');
}

function printReport() {
  if (!state.analysis) return;
  const popup = window.open('', '_blank', 'width=960,height=720');
  popup.document.write(buildPrintableHtml(state, state.analysis, t));
  popup.document.close();
  popup.focus();
  popup.print();
}

function bindEvents() {
  document.querySelectorAll('.manual-select').forEach((element) => element.addEventListener('change', handleManualChange));
  document.getElementById('narrativeInput')?.addEventListener('change', handleNarrativeChange);
  document.getElementById('analyzeTextBtn')?.addEventListener('click', handleAnalyzeText);
  document.getElementById('loadExampleBtn')?.addEventListener('click', handleLoadExample);
  document.getElementById('importBtn')?.addEventListener('click', handleImport);
  document.getElementById('recalculateBtn')?.addEventListener('click', handleOverride);
  document.getElementById('overrideEnabled')?.addEventListener('change', handleOverride);
  document.getElementById('overrideLevel')?.addEventListener('change', handleOverride);
  document.getElementById('overrideReason')?.addEventListener('change', handleOverride);
  document.getElementById('clinicianName')?.addEventListener('change', handleClinicianUpdate);
  document.getElementById('centerName')?.addEventListener('change', handleClinicianUpdate);
  document.getElementById('summaryExportBtn')?.addEventListener('click', exportSummary);
  document.getElementById('jsonExportBtn')?.addEventListener('click', exportJson);
  document.getElementById('csvExportBtn')?.addEventListener('click', exportCsv);
  document.getElementById('printBtn')?.addEventListener('click', printReport);
  document.getElementById('localeSelect')?.addEventListener('change', async (event) => {
    state.locale = event.target.value;
    await loadLocale(state.locale);
    persistAndRender();
  });
}

function render() {
  renderApp(state);
  bindEvents();
}

async function init() {
  state = loadState();
  await loadLocale(state.locale || 'en');
  if (!state.patientCase.narrative) {
    state.patientCase.narrative = EXAMPLE_CASE.narrative;
  }
  FIELD_DEFINITIONS.forEach((field) => {
    if (!state.patientCase.fields[field.id]) {
      state.patientCase.fields[field.id] = { value: '', status: 'missing', source: 'manual', evidence: '', updatedAt: null, clinicianConfirmed: false };
    }
  });
  recomputeAnalysis();
  render();
}

init();
