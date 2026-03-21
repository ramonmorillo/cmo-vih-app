import {
  FIELD_DEFINITIONS,
  INTERVENTION_KEYS,
  PRIORITY_CONFIG,
  RISK_FLAG_RULES,
  SECTION_LABEL_KEYS,
  SECTION_ORDER
} from './config.js';

function getPriority(total) {
  if (total >= 15) return 1;
  if (total >= 7) return 2;
  return 3;
}

export function evaluateCase(patientCase, translate) {
  const contributions = [];
  const sectionScores = Object.fromEntries(SECTION_ORDER.map((section) => [section, 0]));
  let automaticPriority = null;
  const missing = [];

  FIELD_DEFINITIONS.forEach((field) => {
    const fieldState = patientCase.fields[field.id];
    if (!fieldState?.value) {
      missing.push({ fieldId: field.id, label: translate(field.missingHintKey) });
      return;
    }

    const score = field.weightMap[fieldState.value] ?? 0;
    sectionScores[field.section] += score;

    if (field.automaticPriority && field.automaticPriority[fieldState.value]) {
      automaticPriority = field.automaticPriority[fieldState.value];
    }

    contributions.push({
      fieldId: field.id,
      label: translate(field.labelKey),
      valueLabel: translate(field.optionLabelKeys[fieldState.value]),
      section: field.section,
      sectionLabel: translate(SECTION_LABEL_KEYS[field.section]),
      score,
      status: fieldState.status,
      source: fieldState.source,
      clinicianConfirmed: fieldState.clinicianConfirmed,
      evidence: fieldState.evidence || translate('common.noEvidence')
    });
  });

  const total = Object.values(sectionScores).reduce((sum, value) => sum + value, 0);
  const autoLevel = automaticPriority || getPriority(total);
  const finalLevel = patientCase.override.enabled && patientCase.override.level !== 'auto'
    ? Number(patientCase.override.level)
    : autoLevel;
  const followUp = PRIORITY_CONFIG[patientCase.override.enabled && patientCase.override.level !== 'auto' ? finalLevel : automaticPriority ? 'automatic' : finalLevel];

  const sortedDrivers = [...contributions].sort((a, b) => b.score - a.score).filter((item) => item.score > 0);
  const keyDrivers = sortedDrivers.slice(0, 4);
  const riskFlags = RISK_FLAG_RULES.filter((rule) => patientCase.fields[rule.fieldId]?.value === rule.value).map((rule) => translate(rule.labelKey));

  const explainability = {
    why: [
      translate('explainability.totalScore', { total }),
      translate('explainability.autoLevel', { level: translate(PRIORITY_CONFIG[autoLevel].labelKey) }),
      patientCase.override.enabled && patientCase.override.level !== 'auto'
        ? translate('explainability.overrideApplied', { level: translate(PRIORITY_CONFIG[finalLevel].labelKey) })
        : translate('explainability.noOverride')
    ],
    missing,
    contributions,
    keyDrivers
  };

  return {
    total,
    sectionScores,
    automaticLevel: autoLevel,
    finalLevel,
    followUp: translate(followUp.followUpKey),
    followUpLabelKey: followUp.followUpKey,
    priorityLabel: translate(PRIORITY_CONFIG[finalLevel].labelKey),
    automaticPriorityLabel: translate(PRIORITY_CONFIG[autoLevel].labelKey),
    interventions: INTERVENTION_KEYS[finalLevel].map((key) => translate(key)),
    riskFlags,
    explainability,
    traceability: {
      timestamp: new Date().toISOString(),
      version: patientCase.version || 'CMO-VIH Pro v2 — March 2026',
      inputSource: patientCase.source,
      clinicianModifications: patientCase.traceability.modifications.filter((item) => item.type === 'field-update' || item.type === 'override-update').length
    }
  };
}
