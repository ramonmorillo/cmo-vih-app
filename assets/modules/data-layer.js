import { APP_VERSION, FIELD_DEFINITIONS, STORAGE_KEY } from './config.js';
import {
  buildNewPatientCase,
  cloneState,
  createCaseId,
  createDefaultState,
  createUiState,
  normalizePatientCase
} from './case-model.js';
import { filterAndSortCases } from './case-search.js';

export { createDefaultState };

function applyStateDefaults(parsed = {}) {
  const base = createDefaultState();
  const merged = {
    ...base,
    ...parsed,
    patientCase: normalizePatientCase(parsed.patientCase || {}, parsed.locale || base.locale),
    autosave: {
      ...base.autosave,
      ...(parsed.autosave || {})
    },
    savedCases: {
      ...base.savedCases,
      ...(parsed.savedCases || {}),
      items: Array.isArray(parsed.savedCases?.items) ? parsed.savedCases.items : [],
      filteredItems: [],
      filters: {
        ...base.savedCases.filters,
        ...(parsed.savedCases?.filters || {})
      }
    },
    ui: {
      ...base.ui,
      ...(parsed.ui || {}),
      modals: {
        ...base.ui.modals,
        ...(parsed.ui?.modals || {}),
        newCase: {
          ...base.ui.modals.newCase,
          ...(parsed.ui?.modals?.newCase || {}),
          open: false
        }
      },
      unsavedChanges: false
    }
  };

  merged.patientCase.toolVersion = APP_VERSION;
  merged.patientCase.language = merged.locale;
  merged.savedCases.filteredItems = filterAndSortCases(merged.savedCases.items, merged.savedCases.filters);
  return merged;
}

export function saveState(state) {
  const nextState = cloneState(state);
  nextState.autosave = {
    status: 'saved',
    lastSavedAt: new Date().toISOString()
  };
  nextState.patientCase.updatedAt = new Date().toISOString();
  nextState.patientCase.toolVersion = APP_VERSION;
  nextState.patientCase.version = APP_VERSION;
  nextState.patientCase.language = nextState.locale;
  nextState.patientCase.traceability.updatedAt = nextState.patientCase.updatedAt;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return createDefaultState();
  }

  try {
    return applyStateDefaults(JSON.parse(saved));
  } catch {
    return createDefaultState();
  }
}

export function updateUi(state, payload) {
  const next = cloneState(state);
  next.ui = {
    ...next.ui,
    ...payload,
    modals: {
      ...next.ui.modals,
      ...(payload.modals || {})
    }
  };
  return next;
}

export function setSavedCases(state, items, storageMode, error = null) {
  const next = cloneState(state);
  next.savedCases.items = items;
  next.savedCases.filteredItems = filterAndSortCases(items, next.savedCases.filters);
  next.savedCases.storageMode = storageMode || next.savedCases.storageMode;
  next.savedCases.error = error;
  next.savedCases.lastLoadedAt = new Date().toISOString();
  return next;
}

export function updateSavedCasesFilters(state, payload) {
  const next = cloneState(state);
  next.savedCases.filters = {
    ...next.savedCases.filters,
    ...payload
  };
  next.savedCases.filteredItems = filterAndSortCases(next.savedCases.items, next.savedCases.filters);
  return next;
}

export function setNewCaseModal(state, open) {
  return updateUi(state, {
    modals: {
      ...state.ui.modals,
      newCase: {
        ...state.ui.modals.newCase,
        open
      }
    }
  });
}

function markCaseDirty(next) {
  next.ui.unsavedChanges = true;
  return next;
}

export function markCaseClean(state) {
  const next = cloneState(state);
  next.ui.unsavedChanges = false;
  return next;
}

export function updateField(state, fieldId, payload) {
  const next = cloneState(state);
  next.patientCase.fields[fieldId] = {
    ...next.patientCase.fields[fieldId],
    ...payload,
    updatedAt: new Date().toISOString()
  };
  next.patientCase.traceability.modifications.push({
    type: 'field-update',
    fieldId,
    source: payload.source || next.patientCase.fields[fieldId].source,
    at: new Date().toISOString(),
    value: payload.value
  });
  next.patientCase.source = payload.source === 'import'
    ? 'import'
    : (payload.source === 'ai' || next.patientCase.source === 'text' ? 'text' : 'manual');
  next.patientCase.updatedAt = new Date().toISOString();
  return markCaseDirty(next);
}

export function updateNarrative(state, narrative, source = 'text') {
  const next = cloneState(state);
  next.patientCase.narrative = narrative;
  next.patientCase.source = source;
  next.patientCase.traceability.modifications.push({
    type: 'narrative-update',
    source,
    at: new Date().toISOString()
  });
  next.patientCase.updatedAt = new Date().toISOString();
  return markCaseDirty(next);
}

export function updateClinician(state, clinician) {
  const next = cloneState(state);
  next.patientCase.clinician = {
    ...next.patientCase.clinician,
    ...clinician
  };
  next.patientCase.traceability.modifications.push({
    type: 'clinician-update',
    at: new Date().toISOString()
  });
  next.patientCase.updatedAt = new Date().toISOString();
  return markCaseDirty(next);
}

export function updatePatientLabel(state, pseudonymizedPatientLabel) {
  const next = cloneState(state);
  next.patientCase.pseudonymizedPatientLabel = pseudonymizedPatientLabel;
  next.patientCase.traceability.modifications.push({
    type: 'patient-label-update',
    at: new Date().toISOString()
  });
  next.patientCase.updatedAt = new Date().toISOString();
  return markCaseDirty(next);
}

export function setOverride(state, override) {
  const next = cloneState(state);
  next.patientCase.override = {
    ...next.patientCase.override,
    ...override
  };
  next.patientCase.traceability.modifications.push({
    type: 'override-update',
    at: new Date().toISOString(),
    override: next.patientCase.override
  });
  next.patientCase.updatedAt = new Date().toISOString();
  return markCaseDirty(next);
}

function normalizeImportedValue(rawValue) {
  if (rawValue === undefined || rawValue === null) return '';
  return String(rawValue).trim();
}

export function applyImportedRecord(state, record, source = 'import') {
  let next = cloneState(state);
  const normalizedRecord = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, normalizeImportedValue(value)])
  );

  FIELD_DEFINITIONS.forEach((field) => {
    if (normalizedRecord[field.id]) {
      next = updateField(next, field.id, {
        value: normalizedRecord[field.id],
        status: 'confirmed',
        source,
        evidence: source,
        clinicianConfirmed: true
      });
    }
  });

  if (normalizedRecord.narrative) {
    next = updateNarrative(next, normalizedRecord.narrative, source);
  }

  if (normalizedRecord.pseudonymizedPatientLabel) {
    next = updatePatientLabel(next, normalizedRecord.pseudonymizedPatientLabel);
  }

  next.patientCase.importRaw = JSON.stringify(normalizedRecord, null, 2);
  next.patientCase.source = source;
  next.patientCase.updatedAt = new Date().toISOString();
  return markCaseDirty(next);
}

export function parseJsonImport(text) {
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

export function parseCsvImport(text) {
  const [headerLine, ...rows] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map((item) => item.trim());
  const row = (rows[0] || '').split(',').map((item) => item.trim());
  return headers.reduce((acc, header, index) => {
    acc[header] = row[index] || '';
    return acc;
  }, {});
}

export function computeCompletion(fields) {
  const total = FIELD_DEFINITIONS.length;
  const completed = FIELD_DEFINITIONS.filter((field) => fields[field.id]?.value).length;
  return Math.round((completed / total) * 100);
}

export function hasCaseData(patientCase) {
  return Boolean(
    patientCase.pseudonymizedPatientLabel?.trim()
    || patientCase.narrative?.trim()
    || patientCase.importRaw?.trim()
    || patientCase.notes?.trim()
    || patientCase.override?.reason?.trim()
    || FIELD_DEFINITIONS.some((field) => patientCase.fields[field.id]?.value)
  );
}

export function resetCase(state, options = {}) {
  const next = cloneState(state);
  const preservedClinician = options.preserveClinician === false
    ? { name: '', center: '' }
    : { ...next.patientCase.clinician };

  next.patientCase = buildNewPatientCase({
    clinician: preservedClinician,
    language: state.locale
  });
  next.analysis = null;
  next.autosave = {
    status: 'idle',
    lastSavedAt: null
  };
  next.ui = createUiState();
  next.locale = state.locale;
  next.version = APP_VERSION;
  return next;
}

export function duplicateCurrentCase(state) {
  const next = cloneState(state);
  const timestamp = new Date().toISOString();
  next.patientCase.caseId = createCaseId();
  next.patientCase.createdAt = timestamp;
  next.patientCase.updatedAt = timestamp;
  next.patientCase.traceability.createdAt = timestamp;
  next.patientCase.traceability.updatedAt = timestamp;
  next.patientCase.toolVersion = APP_VERSION;
  next.patientCase.version = APP_VERSION;
  next.ui.unsavedChanges = true;
  return next;
}
