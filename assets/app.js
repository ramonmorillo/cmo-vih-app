import { APP_VERSION, EXAMPLE_CASE, FIELD_DEFINITIONS } from './modules/config.js';
import { extractFromNarrative } from './modules/ai-module.js';
import { evaluateCase } from './modules/cmo-engine.js';
import {
  applyImportedRecord,
  createDefaultState,
  duplicateCurrentCase,
  hasCaseData,
  loadState,
  markCaseClean,
  parseCsvImport,
  parseJsonImport,
  resetCase,
  saveState,
  setNewCaseModal,
  setOverride,
  setSavedCases,
  updateClinician,
  updateField,
  updateNarrative,
  updatePatientLabel,
  updateSavedCasesFilters,
  updateUi
} from './modules/data-layer.js';
import { buildSavedCaseRecord, createCaseId, hydrateStateFromSavedCase } from './modules/case-model.js';
import {
  deleteSavedCase,
  getCaseStorageMode,
  getSavedCase,
  initializeCaseStorage,
  listSavedCases,
  upsertSavedCase
} from './modules/case-storage.js';
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
  state.patientCase.toolVersion = APP_VERSION;
  state.patientCase.version = APP_VERSION;
  state.patientCase.language = state.locale;
  state.analysis = evaluateCase(state.patientCase, t);
}

function render() {
  renderApp(state);
  bindEvents();
}

function persistAndRender() {
  recomputeAnalysis();
  state = saveState(state);
  render();
}

function renderOnly() {
  recomputeAnalysis();
  render();
}

async function refreshSavedCases(error = null) {
  try {
    const items = await listSavedCases();
    state = setSavedCases(state, items, getCaseStorageMode(), error);
  } catch (storageError) {
    state = setSavedCases(state, [], getCaseStorageMode(), storageError.message);
  }
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
  persistAndRender();
}

function handleNarrativeChange(event) {
  state = updateNarrative(state, event.target.value, 'text');
  persistAndRender();
}

function handlePatientLabelChange(event) {
  state = updatePatientLabel(state, event.target.value.trim());
  persistAndRender();
}

function handleNarrativeInputForDraft(event) {
  state = updateNarrative(state, event.target.value, 'text');
  state = saveState(state);
}

function handleAnalyzeText() {
  const narrative = document.getElementById('narrativeInput').value.trim();
  state = updateNarrative(state, narrative, 'text');
  const extraction = extractFromNarrative(narrative, state.patientCase.fields, t);
  state.patientCase.notes = extraction.explanation;
  Object.entries(extraction.updates).forEach(([fieldId, payload]) => {
    state = updateField(state, fieldId, payload);
  });
  persistAndRender();
  window.alert(`${t('ai.analysisComplete')}\n${extraction.explanation}`);
}

function handleLoadExample() {
  state = updateNarrative(state, EXAMPLE_CASE.narrative, 'text');
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
    state = updateUi(state, { importType });
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

function handleImportTypeChange(event) {
  state = updateUi(state, { importType: event.target.value });
  persistAndRender();
}

function closeNewCaseModal(shouldPersist = false) {
  state = setNewCaseModal(state, false);
  if (shouldPersist) {
    persistAndRender();
    return;
  }
  renderOnly();
}

async function saveCurrentCase({ asNew = false, forceUpdate = false } = {}) {
  const existingSavedCase = state.savedCases.items.find((item) => item.caseId === state.patientCase.caseId);

  if (forceUpdate && !existingSavedCase) {
    window.alert(t('savedCases.updateMissing'));
    return;
  }

  if (asNew) {
    state = duplicateCurrentCase(state);
    if (!state.patientCase.pseudonymizedPatientLabel) {
      state.patientCase.pseudonymizedPatientLabel = t('savedCases.copyLabel', { caseId: state.patientCase.caseId });
    }
  }

  recomputeAnalysis();
  const record = buildSavedCaseRecord(state);
  await upsertSavedCase(record);
  state = markCaseClean(state);
  state = saveState(state);
  await refreshSavedCases();
  render();
  window.alert(existingSavedCase && !asNew ? t('savedCases.updatedMessage', { caseId: record.caseId }) : t('savedCases.savedMessage', { caseId: record.caseId }));
}

async function startFreshCase(shouldSaveCurrentCase) {
  let savedCaseId = null;

  if (shouldSaveCurrentCase && hasCaseData(state.patientCase)) {
    await saveCurrentCase();
    savedCaseId = state.patientCase.caseId;
  }

  state = resetCase(state);
  state = markCaseClean(state);
  state = saveState(state);
  await refreshSavedCases();
  render();

  if (savedCaseId) {
    window.alert(t('newCase.savedMessage', { id: savedCaseId }));
  }
}

function handleNewCaseClick() {
  if (state.ui.unsavedChanges && hasCaseData(state.patientCase)) {
    state = setNewCaseModal(state, true);
    renderOnly();
    return;
  }

  startFreshCase(false);
}

function exportSummary() {
  if (!state.analysis) return;
  downloadBlob('cmo-vih-summary.txt', buildClinicalSummary(state, state.analysis, t));
}

function exportJson() {
  if (!state.analysis) return;
  downloadBlob(`cmo-vih-${state.patientCase.caseId}.json`, JSON.stringify(buildStructuredReport(state, state.analysis, t), null, 2), 'application/json;charset=utf-8');
}

function exportCsv() {
  if (!state.analysis) return;
  downloadBlob('cmo-vih-research.csv', buildCsvExport(state, state.analysis), 'text/csv;charset=utf-8');
}

function printReport() {
  if (!state.analysis) return;
  const popup = window.open('', '_blank', 'width=960,height=720');
  popup.document.write(buildPrintableHtml(state, state.analysis, t));
  popup.document.close();
  popup.focus();
  popup.print();
}

async function handleSavedCaseAction(event) {
  const button = event.target.closest('[data-saved-case-action]');
  if (!button) return;

  const action = button.dataset.savedCaseAction;
  const caseId = button.dataset.caseId;
  if (!caseId) return;

  if (action === 'delete') {
    if (!window.confirm(t('savedCases.confirmDelete', { caseId }))) {
      return;
    }
    await deleteSavedCase(caseId);
    await refreshSavedCases();
    if (state.patientCase.caseId === caseId) {
      state = resetCase(state);
      state = markCaseClean(state);
      state = saveState(state);
    }
    render();
    return;
  }

  const record = await getSavedCase(caseId);
  if (!record) {
    window.alert(t('savedCases.notFound', { caseId }));
    return;
  }

  if (action === 'open') {
    if (record.language && record.language !== state.locale) {
      await loadLocale(record.language);
    }
    state = hydrateStateFromSavedCase(state, record);
    recomputeAnalysis();
    state = markCaseClean(state);
    state = saveState(state);
    await refreshSavedCases();
    render();
    return;
  }

  if (action === 'duplicate') {
    const duplicateTimestamp = new Date().toISOString();
    const duplicateRecord = {
      ...record,
      caseId: createCaseId(),
      createdAt: duplicateTimestamp,
      updatedAt: duplicateTimestamp,
      pseudonymizedPatientLabel: record.pseudonymizedPatientLabel
        ? `${record.pseudonymizedPatientLabel} (${t('savedCases.copySuffix')})`
        : t('savedCases.copyLabel', { caseId: record.caseId }),
      analysis: record.analysis ? {
        ...record.analysis,
        traceability: {
          ...record.analysis.traceability,
          timestamp: duplicateTimestamp,
          version: APP_VERSION
        }
      } : null,
      traceability: {
        ...record.traceability,
        createdAt: duplicateTimestamp,
        updatedAt: duplicateTimestamp
      }
    };
    await upsertSavedCase(duplicateRecord);
    await refreshSavedCases();
    render();
    window.alert(t('savedCases.duplicatedMessage', { caseId: duplicateRecord.caseId }));
    return;
  }

  if (action === 'export') {
    downloadBlob(`cmo-vih-saved-case-${record.caseId}.json`, JSON.stringify(record, null, 2), 'application/json;charset=utf-8');
  }
}

function handleSavedCasesFilterChange() {
  state = updateSavedCasesFilters(state, {
    caseId: document.getElementById('savedCaseIdSearch')?.value || '',
    patientLabel: document.getElementById('savedPatientSearch')?.value || '',
    sortBy: document.getElementById('savedCasesSort')?.value || 'updatedDesc'
  });
  state = saveState(state);
  render();
}

function bindEvents() {
  document.querySelectorAll('.manual-select').forEach((element) => element.addEventListener('change', handleManualChange));
  document.getElementById('narrativeInput')?.addEventListener('change', handleNarrativeChange);
  document.getElementById('narrativeInput')?.addEventListener('input', handleNarrativeInputForDraft);
  document.getElementById('patientLabel')?.addEventListener('change', handlePatientLabelChange);
  document.getElementById('analyzeTextBtn')?.addEventListener('click', handleAnalyzeText);
  document.getElementById('loadExampleBtn')?.addEventListener('click', handleLoadExample);
  document.getElementById('importBtn')?.addEventListener('click', handleImport);
  document.getElementById('importType')?.addEventListener('change', handleImportTypeChange);
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
  document.getElementById('toolbarExportBtn')?.addEventListener('click', exportJson);
  document.getElementById('newCaseBtn')?.addEventListener('click', handleNewCaseClick);
  document.getElementById('toolbarSaveBtn')?.addEventListener('click', () => saveCurrentCase());
  document.getElementById('saveCurrentCaseBtn')?.addEventListener('click', () => saveCurrentCase());
  document.getElementById('saveAsNewCaseBtn')?.addEventListener('click', () => saveCurrentCase({ asNew: true }));
  document.getElementById('updateExistingCaseBtn')?.addEventListener('click', () => saveCurrentCase({ forceUpdate: true }));
  document.getElementById('saveAndCreateCaseBtn')?.addEventListener('click', () => startFreshCase(true));
  document.getElementById('createWithoutSavingBtn')?.addEventListener('click', () => startFreshCase(false));
  document.getElementById('cancelNewCaseBtn')?.addEventListener('click', () => closeNewCaseModal(false));
  document.getElementById('cancelNewCaseBtnSecondary')?.addEventListener('click', () => closeNewCaseModal(false));
  document.getElementById('newCaseModalBackdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'newCaseModalBackdrop') {
      closeNewCaseModal(false);
    }
  });
  document.getElementById('localeSelect')?.addEventListener('change', async (event) => {
    state.locale = event.target.value;
    await loadLocale(state.locale);
    persistAndRender();
  });
  document.getElementById('savedCaseIdSearch')?.addEventListener('input', handleSavedCasesFilterChange);
  document.getElementById('savedPatientSearch')?.addEventListener('input', handleSavedCasesFilterChange);
  document.getElementById('savedCasesSort')?.addEventListener('change', handleSavedCasesFilterChange);
  document.getElementById('savedCasesSection')?.addEventListener('toggle', (event) => {
    state = updateUi(state, { savedCasesOpen: event.target.open });
    state = saveState(state);
  });
  document.getElementById('toggleSavedCasesBtn')?.addEventListener('click', () => {
    state = updateUi(state, { savedCasesOpen: !state.ui.savedCasesOpen });
    state = saveState(state);
    render();
  });
  document.querySelector('.saved-cases-list')?.addEventListener('click', handleSavedCaseAction);
  document.getElementById('foundationToggleBtn')?.addEventListener('click', () => {
    const accordion = document.getElementById('foundationAccordion');
    const isOpen = accordion.classList.toggle('foundation-accordion--open');
    document.getElementById('foundationToggleBtn').setAttribute('aria-expanded', String(isOpen));
  });
}

async function init() {
  state = loadState();
  await initializeCaseStorage();
  await loadLocale(state.locale || 'en');
  FIELD_DEFINITIONS.forEach((field) => {
    if (!state.patientCase.fields[field.id]) {
      state.patientCase.fields[field.id] = { value: '', status: 'missing', source: 'manual', evidence: '', updatedAt: null, clinicianConfirmed: false };
    }
  });
  recomputeAnalysis();
  await refreshSavedCases();
  render();
}

init();
