import { APP_VERSION, CASE_LIBRARY_KEY, FIELD_DEFINITIONS, STORAGE_KEY } from './config.js';

function createEmptyField() {
  return {
    value: '',
    status: 'missing',
    source: 'manual',
    evidence: '',
    updatedAt: null,
    clinicianConfirmed: false
  };
}

function createCaseId() {
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createUiState() {
  return {
    importType: 'json',
    modals: {
      newCase: {
        open: false
      }
    }
  };
}

function buildNewPatientCase(overrides = {}) {
  return {
    caseId: createCaseId(),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    ui: createUiState()
  };
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function saveState(state) {
  const nextState = cloneState(state);
  nextState.autosave = {
    status: 'saved',
    lastSavedAt: new Date().toISOString()
  };
  nextState.patientCase.traceability.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return createDefaultState();
  }

  const parsed = JSON.parse(saved);
  const base = createDefaultState();
  const merged = {
    ...base,
    ...parsed,
    patientCase: {
      ...base.patientCase,
      ...parsed.patientCase,
      fields: {
        ...base.patientCase.fields,
        ...(parsed.patientCase?.fields || {})
      },
      override: {
        ...base.patientCase.override,
        ...(parsed.patientCase?.override || {})
      },
      traceability: {
        ...base.patientCase.traceability,
        ...(parsed.patientCase?.traceability || {})
      },
      clinician: {
        ...base.patientCase.clinician,
        ...(parsed.patientCase?.clinician || {})
      }
    },
    autosave: {
      status: 'saved',
      lastSavedAt: parsed.autosave?.lastSavedAt || null
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
      }
    }
  };

  FIELD_DEFINITIONS.forEach((field) => {
    merged.patientCase.fields[field.id] = {
      ...createEmptyField(),
      ...merged.patientCase.fields[field.id]
    };
  });

  if (!merged.patientCase.caseId) {
    merged.patientCase.caseId = createCaseId();
  }

  return merged;
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
  return next;
}

export function updateNarrative(state, narrative, source = 'manual') {
  const next = cloneState(state);
  next.patientCase.narrative = narrative;
  next.patientCase.source = source;
  next.patientCase.traceability.modifications.push({
    type: 'narrative-update',
    source,
    at: new Date().toISOString()
  });
  return next;
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
  return next;
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
  return next;
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

  next.patientCase.importRaw = JSON.stringify(normalizedRecord, null, 2);
  next.patientCase.source = source;
  return next;
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
    patientCase.narrative?.trim()
    || patientCase.importRaw?.trim()
    || patientCase.notes?.trim()
    || patientCase.override?.reason?.trim()
    || FIELD_DEFINITIONS.some((field) => patientCase.fields[field.id]?.value)
  );
}

function readStoredCases() {
  try {
    return JSON.parse(localStorage.getItem(CASE_LIBRARY_KEY) || '[]');
  } catch {
    return [];
  }
}

function getCaseLabelValue(fieldState) {
  return fieldState?.value || null;
}

export function saveCase(state) {
  const existingCases = readStoredCases();
  const archivedAt = new Date().toISOString();
  const record = {
    id: state.patientCase.caseId,
    archivedAt,
    startedAt: state.patientCase.traceability.createdAt,
    updatedAt: state.patientCase.traceability.updatedAt,
    cmoLevel: state.analysis?.priorityLabel || null,
    cmoScore: state.analysis?.total ?? null,
    followUp: state.analysis?.followUp || null,
    source: state.patientCase.source,
    keyVariables: {
      ageBand: getCaseLabelValue(state.patientCase.fields.ageBand),
      pregnancy: getCaseLabelValue(state.patientCase.fields.pregnancy),
      viralLoad: getCaseLabelValue(state.patientCase.fields.viralLoad),
      adherenceArt: getCaseLabelValue(state.patientCase.fields.adherenceArt),
      frailty: getCaseLabelValue(state.patientCase.fields.frailty),
      hospitalization: getCaseLabelValue(state.patientCase.fields.hospitalization)
    }
  };

  const nextCases = [record, ...existingCases.filter((item) => item.id !== record.id)];
  localStorage.setItem(CASE_LIBRARY_KEY, JSON.stringify(nextCases));
  return record;
}

export function resetCase(state, options = {}) {
  const next = cloneState(state);
  const preservedClinician = options.preserveClinician === false
    ? { name: '', center: '' }
    : { ...next.patientCase.clinician };

  next.patientCase = buildNewPatientCase({
    clinician: preservedClinician
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
