import {
  APP_VERSION,
  EXAMPLE_CASE,
  FIELD_DEFINITIONS,
  PRIORITY_CONFIG,
  SECTION_LABEL_KEYS,
  SECTION_ORDER
} from './config.js';
import { t } from './i18n.js';
import { renderFoundationSection } from './foundation-section.js';
import { computeCompletion } from './data-layer.js';

function stateBadge(status, translate) {
  const map = {
    confirmed: translate('statuses.confirmed'),
    extracted: translate('statuses.extracted'),
    inferred: translate('statuses.inferred'),
    missing: translate('statuses.missing')
  };
  return map[status] || translate('statuses.missing');
}

function optionHtml(field, selectedValue) {
  return [`<option value="">${t('common.selectPlaceholder')}</option>`]
    .concat(
      field.optionKeys.map(
        (key) => `<option value="${key}" ${selectedValue === key ? 'selected' : ''}>${t(field.optionLabelKeys[key])}</option>`
      )
    )
    .join('');
}

function renderFieldCard(field, fieldState) {
  return `
    <label class="field-card">
      <span class="field-card__header">
        <span class="field-card__label">${t(field.labelKey)}</span>
        <span class="badge badge--${fieldState.status}">${stateBadge(fieldState.status, t)}</span>
      </span>
      <select data-field-id="${field.id}" class="manual-select">
        ${optionHtml(field, fieldState.value)}
      </select>
      <span class="field-card__meta">${t('traceability.source')}: ${fieldState.source || t('common.none')} · ${t('traceability.evidence')}: ${fieldState.evidence || t('common.none')}</span>
    </label>
  `;
}

function renderSection(sectionId, state) {
  const sectionFields = FIELD_DEFINITIONS.filter((field) => field.section === sectionId);
  return `
    <details class="section-card" open>
      <summary>${t(SECTION_LABEL_KEYS[sectionId])}</summary>
      <div class="section-grid">
        ${sectionFields.map((field) => renderFieldCard(field, state.patientCase.fields[field.id])).join('')}
      </div>
    </details>
  `;
}

function renderDashboard(analysis) {
  if (!analysis) {
    return `<div class="empty-panel">${t('dashboard.empty')}</div>`;
  }

  return `
    <div class="dashboard-grid">
      <article class="metric-card metric-card--accent">
        <span class="metric-card__label">${t('dashboard.cmoLevel')}</span>
        <strong>${analysis.priorityLabel}</strong>
        <small>${t('dashboard.followUpIntensity')}: ${analysis.followUp}</small>
      </article>
      <article class="metric-card">
        <span class="metric-card__label">${t('dashboard.totalScore')}</span>
        <strong>${analysis.total}</strong>
        <small>${t('dashboard.autoClass')}: ${analysis.automaticPriorityLabel}</small>
      </article>
      <article class="metric-card">
        <span class="metric-card__label">${t('dashboard.keyDrivers')}</span>
        <strong>${analysis.explainability.keyDrivers.length}</strong>
        <small>${analysis.explainability.keyDrivers.map((item) => item.label).join(', ') || t('common.none')}</small>
      </article>
      <article class="metric-card">
        <span class="metric-card__label">${t('dashboard.riskFlags')}</span>
        <strong>${analysis.riskFlags.length}</strong>
        <small>${analysis.riskFlags.join(', ') || t('common.none')}</small>
      </article>
    </div>
  `;
}

function renderTraceability(state, analysis) {
  const traceability = analysis?.traceability || {
    timestamp: state.patientCase.traceability.updatedAt,
    version: APP_VERSION,
    inputSource: state.patientCase.source,
    clinicianModifications: 0
  };

  return `
    <ul class="trace-list">
      <li><strong>${t('traceability.caseId')}:</strong> ${state.patientCase.caseId || t('common.none')}</li>
      <li><strong>${t('traceability.timestamp')}:</strong> ${traceability.timestamp || t('common.none')}</li>
      <li><strong>${t('traceability.version')}:</strong> ${APP_VERSION}</li>
      <li><strong>${t('traceability.inputSource')}:</strong> ${traceability.inputSource}</li>
      <li><strong>${t('traceability.modifications')}:</strong> ${traceability.clinicianModifications}</li>
      <li><strong>${t('traceability.autosave')}:</strong> ${state.autosave.lastSavedAt || t('common.none')}</li>
    </ul>
  `;
}

function renderExplainability(analysis) {
  if (!analysis) {
    return `<div class="empty-panel">${t('explainability.empty')}</div>`;
  }

  return `
    <div class="explainability-grid">
      <article class="panel-card">
        <h3>${t('explainability.whyTitle')}</h3>
        <ul>${analysis.explainability.why.map((item) => `<li>${item}</li>`).join('')}</ul>
      </article>
      <article class="panel-card">
        <h3>${t('explainability.contribTitle')}</h3>
        <div class="contribution-list">
          ${analysis.explainability.contributions.map((item) => `
            <div class="contribution-item">
              <div>
                <strong>${item.label}</strong>
                <p>${item.valueLabel}</p>
              </div>
              <div>
                <span class="badge badge--${item.status}">${stateBadge(item.status, t)}</span>
                <strong>+${item.score}</strong>
              </div>
            </div>
          `).join('')}
        </div>
      </article>
      <article class="panel-card">
        <h3>${t('explainability.missingTitle')}</h3>
        <ul>${analysis.explainability.missing.map((item) => `<li>${item.label}</li>`).join('') || `<li>${t('common.none')}</li>`}</ul>
      </article>
    </div>
  `;
}

function renderAiPanel(state) {
  const items = Object.entries(state.patientCase.fields)
    .filter(([, value]) => value.source === 'ai')
    .map(([fieldId, value]) => `
      <div class="ai-item">
        <strong>${t(`fields.${fieldId}`)}</strong>
        <span>${value.value ? t(`options.${value.value}`) : value.value}</span>
        <span class="badge badge--${value.status}">${stateBadge(value.status, t)}</span>
        <small>${value.evidence || t('common.none')}</small>
      </div>
    `)
    .join('');

  return items || `<div class="empty-panel">${t('ai.empty')}</div>`;
}

function renderInterventions(analysis) {
  if (!analysis) return `<div class="empty-panel">${t('dashboard.empty')}</div>`;
  return `<ul class="bullet-list">${analysis.interventions.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function renderNewCaseModal(state) {
  if (!state.ui?.modals?.newCase?.open) {
    return '';
  }

  return `
    <div class="modal-backdrop" id="newCaseModalBackdrop">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="newCaseModalTitle">
        <div class="modal-card__header">
          <div>
            <p class="eyebrow eyebrow--modal">${t('newCase.eyebrow')}</p>
            <h2 id="newCaseModalTitle">${t('newCase.title')}</h2>
          </div>
          <button type="button" class="icon-button" id="cancelNewCaseBtn" aria-label="${t('newCase.cancel')}">×</button>
        </div>
        <p class="modal-card__body">${t('newCase.prompt')}</p>
        <div class="modal-card__actions">
          <button id="saveAndCreateCaseBtn">${t('newCase.saveAndCreate')}</button>
          <button id="createWithoutSavingBtn" class="button-secondary">${t('newCase.createWithoutSaving')}</button>
          <button id="cancelNewCaseBtnSecondary" class="button-ghost">${t('newCase.cancel')}</button>
        </div>
      </div>
    </div>
  `;
}

export function renderApp(state) {
  const completion = computeCompletion(state.patientCase.fields);
  const analysis = state.analysis;

  document.title = `${APP_VERSION}`;
  document.getElementById('app').innerHTML = `
    <div class="app-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">${t('header.eyebrow')}</p>
          <h1>${APP_VERSION}</h1>
          <p class="hero__subtitle">${t('header.subtitle')}</p>
        </div>
        <div class="hero__actions">
          <button id="newCaseBtn" class="button-primary button-with-icon">
            <span class="button-icon" aria-hidden="true">＋</span>
            <span>${t('buttons.newCase')}</span>
          </button>
          <label class="locale-switcher">
            <span>${t('header.language')}</span>
            <select id="localeSelect">
              <option value="en" ${state.locale === 'en' ? 'selected' : ''}>English</option>
              <option value="es" ${state.locale === 'es' ? 'selected' : ''}>Español</option>
            </select>
          </label>
          <div class="version-pill">${APP_VERSION}</div>
        </div>
      </header>

      <section class="progress-card">
        <div>
          <strong>${t('progress.title')}</strong>
          <p>${t('progress.subtitle')}</p>
        </div>
        <div class="progress-right">
          <div class="progress-bar"><span style="width:${completion}%"></span></div>
          <strong>${completion}%</strong>
        </div>
      </section>

      <section class="dashboard-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">${t('dashboard.eyebrow')}</p>
            <h2>${t('dashboard.title')}</h2>
          </div>
          <div class="dashboard-section__meta">
            <span class="case-pill">${t('traceability.caseId')}: ${state.patientCase.caseId}</span>
            <span class="autosave-pill">${t('traceability.autosave')}: ${state.autosave.lastSavedAt ? new Date(state.autosave.lastSavedAt).toLocaleString(state.locale) : t('common.none')}</span>
          </div>
        </div>
        ${renderDashboard(analysis)}
      </section>

      <main class="layout-grid">
        <section class="column-stack">
          <details class="section-card" open>
            <summary>${t('inputs.manualSection')}</summary>
            <div class="section-grid">
              ${SECTION_ORDER.map((sectionId) => renderSection(sectionId, state)).join('')}
            </div>
          </details>

          <details class="section-card" open>
            <summary>${t('inputs.textSection')}</summary>
            <div class="section-body">
              <textarea id="narrativeInput" placeholder="${t('inputs.textPlaceholder')}">${state.patientCase.narrative || ''}</textarea>
              <div class="button-row">
                <button id="analyzeTextBtn">${t('buttons.analyzeText')}</button>
                <button id="loadExampleBtn" class="button-secondary">${t('buttons.loadExample')}</button>
              </div>
              <p class="supporting-text">${t('ai.instructions')}</p>
            </div>
          </details>

          <details class="section-card" open>
            <summary>${t('inputs.importSection')}</summary>
            <div class="section-body">
              <select id="importType">
                <option value="json" ${state.ui.importType === 'json' ? 'selected' : ''}>JSON</option>
                <option value="csv" ${state.ui.importType === 'csv' ? 'selected' : ''}>CSV</option>
              </select>
              <textarea id="importInput" placeholder="${t('inputs.importPlaceholder')}">${state.patientCase.importRaw || ''}</textarea>
              <button id="importBtn" class="button-secondary">${t('buttons.import')}</button>
              <p class="supporting-text">${t('inputs.futureIntegration')}</p>
            </div>
          </details>
        </section>

        <section class="column-stack">
          <details class="section-card" open>
            <summary>${t('dashboard.summaryPanel')}</summary>
            <div class="panel-grid panel-grid--two">
              <article class="panel-card">
                <h3>${t('dashboard.riskFlags')}</h3>
                <ul>${analysis?.riskFlags?.map((item) => `<li>${item}</li>`).join('') || `<li>${t('common.none')}</li>`}</ul>
              </article>
              <article class="panel-card">
                <h3>${t('dashboard.suggestedInterventions')}</h3>
                ${renderInterventions(analysis)}
              </article>
              <article class="panel-card">
                <h3>${t('dashboard.followUpIntensity')}</h3>
                <p>${analysis?.followUp || t('common.none')}</p>
              </article>
              <article class="panel-card">
                <h3>${t('traceability.title')}</h3>
                ${renderTraceability(state, analysis)}
              </article>
            </div>
          </details>

          <details class="section-card" open>
            <summary>${t('explainability.title')}</summary>
            ${renderExplainability(analysis)}
          </details>

          <details class="section-card" open>
            <summary>${t('ai.title')}</summary>
            <div class="panel-card">
              <p>${t('ai.instructions')}</p>
              <p class="supporting-text">${state.patientCase.notes || t('ai.empty')}</p>
              <div class="ai-grid">
                ${renderAiPanel(state)}
              </div>
            </div>
          </details>
        </section>

        <section class="column-stack">
          <details class="section-card" open>
            <summary>${t('override.title')}</summary>
            <div class="section-body">
              <label>${t('override.useOverride')}
                <input type="checkbox" id="overrideEnabled" ${state.patientCase.override.enabled ? 'checked' : ''}>
              </label>
              <label>${t('override.selectLevel')}
                <select id="overrideLevel">
                  <option value="auto" ${state.patientCase.override.level === 'auto' ? 'selected' : ''}>${t('override.auto')}</option>
                  <option value="1" ${String(state.patientCase.override.level) === '1' ? 'selected' : ''}>${t(PRIORITY_CONFIG[1].labelKey)}</option>
                  <option value="2" ${String(state.patientCase.override.level) === '2' ? 'selected' : ''}>${t(PRIORITY_CONFIG[2].labelKey)}</option>
                  <option value="3" ${String(state.patientCase.override.level) === '3' ? 'selected' : ''}>${t(PRIORITY_CONFIG[3].labelKey)}</option>
                </select>
              </label>
              <label>${t('override.reason')}
                <textarea id="overrideReason" placeholder="${t('override.reasonPlaceholder')}">${state.patientCase.override.reason || ''}</textarea>
              </label>
              <button id="recalculateBtn">${t('buttons.recalculate')}</button>
            </div>
          </details>

          <details class="section-card" open>
            <summary>${t('exports.title')}</summary>
            <div class="button-row button-row--wrap">
              <button id="summaryExportBtn">${t('buttons.exportSummary')}</button>
              <button id="jsonExportBtn" class="button-secondary">${t('buttons.exportJson')}</button>
              <button id="csvExportBtn" class="button-secondary">${t('buttons.exportCsv')}</button>
              <button id="printBtn" class="button-secondary">${t('buttons.print')}</button>
            </div>
            <pre class="report-box">${analysis ? `${t('exports.summaryTitle')}: ${analysis.priorityLabel}\n${t('exports.totalScore')}: ${analysis.total}\n${t('exports.followUp')}: ${analysis.followUp}\n${t('exports.riskFlags')}: ${analysis.riskFlags.join(', ') || t('common.none')}` : t('exports.pending')}</pre>
          </details>

          <details class="section-card" open>
            <summary>${t('settings.title')}</summary>
            <div class="section-body">
              <label>${t('settings.clinicianName')}
                <input id="clinicianName" value="${state.patientCase.clinician.name || ''}" placeholder="${t('settings.clinicianNamePlaceholder')}">
              </label>
              <label>${t('settings.centerName')}
                <input id="centerName" value="${state.patientCase.clinician.center || ''}" placeholder="${t('settings.centerNamePlaceholder')}">
              </label>
            </div>
          </details>
        </section>
      </main>

      ${renderFoundationSection()}
      ${renderNewCaseModal(state)}
    </div>
  `;
}
