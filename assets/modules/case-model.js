import { APP_VERSION, FIELD_DEFINITIONS } from './config.js';

export function createEmptyField() {
  return {
    value: '',
    status: 'missing',
    source: 'manual',
    evidence: '',
    updatedAt: null,
    clinicianConfirmed: false
  };
}

export function createCaseId() {
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createUiState() {
  return {
    importType: 'json',
    savedCasesOpen: true,
    unsavedChanges: false,
    modals: {
      newCase: {
        open: false
      }
    }
  };
}

export function buildNewPatientCase(overrides = {}) {
  const timestamp = new Date().toISOString();
  return {
    caseId: createCaseId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    toolVersion: APP_VERSION,
    version: APP_VERSION,
    language: 'en',
    pseudonymizedPatientLabel: '',
    narrative: '',
    importRaw: '',
    source: 'manual',
    fields: Object.fromEntries(FIELD_DEFINITIONS.map((field) => [field.id, createEmptyField()])),
    notes: '',
    override: {
      enabled: false,
      level: 'auto',
      reason: ''
    },
    traceability: {
      createdAt: timestamp,
      updatedAt: timestamp,
      modifications: []
    },
    clinician: {
      name: '',
      center: ''
    },
    ...overrides
  };
}

export function createDefaultState() {
  return {
    locale: 'en',
    version: APP_VERSION,
    patientCase: buildNewPatientCase(),
    analysis: null,
    autosave: {
      status: 'idle',
      lastSavedAt: null
    },
    savedCases: {
      items: [],
      filteredItems: [],
      filters: {
        caseId: '',
        patientLabel: '',
        sortBy: 'updatedDesc'
      },
      storageMode: 'indexeddb',
      error: null,
      lastLoadedAt: null
    },
    ui: createUiState()
  };
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function normalizeFields(fields = {}) {
  const normalized = {};
  FIELD_DEFINITIONS.forEach((field) => {
    normalized[field.id] = {
      ...createEmptyField(),
      ...(fields[field.id] || {})
    };
  });
  return normalized;
}

export function normalizePatientCase(patientCase = {}, locale = 'en') {
  const base = buildNewPatientCase({ language: locale });
  return {
    ...base,
    ...patientCase,
    toolVersion: patientCase.toolVersion || patientCase.version || APP_VERSION,
    version: patientCase.version || patientCase.toolVersion || APP_VERSION,
    language: patientCase.language || locale,
    pseudonymizedPatientLabel: patientCase.pseudonymizedPatientLabel || '',
    fields: normalizeFields(patientCase.fields),
    override: {
      ...base.override,
      ...(patientCase.override || {})
    },
    traceability: {
      ...base.traceability,
      ...(patientCase.traceability || {}),
      createdAt: patientCase.traceability?.createdAt || patientCase.createdAt || base.traceability.createdAt,
      updatedAt: patientCase.traceability?.updatedAt || patientCase.updatedAt || base.traceability.updatedAt
    },
    clinician: {
      ...base.clinician,
      ...(patientCase.clinician || {})
    }
  };
}


function normalizeInputSource(source) {
  if (source === 'import') return 'import';
  if (source === 'text' || source === 'ai') return 'text';
  return 'manual';
}

export function buildSavedCaseRecord(state) {
  const timestamp = new Date().toISOString();
  const analysis = state.analysis || {};
  const patientCase = normalizePatientCase(state.patientCase, state.locale);
  const updatedAt = timestamp;
  const createdAt = patientCase.createdAt || timestamp;

  return {
    caseId: patientCase.caseId,
    createdAt,
    updatedAt,
    toolVersion: APP_VERSION,
    version: APP_VERSION,
    language: state.locale,
    pseudonymizedPatientLabel: patientCase.pseudonymizedPatientLabel || '',
    inputSource: normalizeInputSource(patientCase.source),
    structuredFormData: normalizeFields(patientCase.fields),
    calculatedScore: analysis.total ?? null,
    cmoLevel: analysis.priorityLabel || null,
    clinicianOverrideApplied: Boolean(patientCase.override?.enabled && patientCase.override?.level !== 'auto'),
    override: {
      ...patientCase.override
    },
    clinician: {
      ...patientCase.clinician
    },
    narrative: patientCase.narrative || '',
    importRaw: patientCase.importRaw || '',
    notes: patientCase.notes || '',
    analysis: analysis ? JSON.parse(JSON.stringify(analysis)) : null,
    traceability: {
      ...patientCase.traceability,
      createdAt,
      updatedAt
    }
  };
}

export function hydrateStateFromSavedCase(state, record) {
  const next = cloneState(state);
  const normalizedCase = normalizePatientCase({
    caseId: record.caseId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    toolVersion: record.toolVersion,
    language: record.language,
    pseudonymizedPatientLabel: record.pseudonymizedPatientLabel,
    source: normalizeInputSource(record.inputSource),
    fields: record.structuredFormData,
    narrative: record.narrative,
    importRaw: record.importRaw,
    notes: record.notes,
    override: record.override,
    traceability: record.traceability,
    clinician: record.clinician
  }, record.language || state.locale);

  next.locale = record.language || state.locale;
  next.patientCase = normalizedCase;
  next.analysis = record.analysis || null;
  next.autosave = {
    status: 'saved',
    lastSavedAt: new Date().toISOString()
  };
  next.ui.unsavedChanges = false;
  return next;
}
